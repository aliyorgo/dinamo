'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import UGCSettingsModal, { UGCSettings, DEFAULT_SETTINGS } from './UGCSettingsModal'
import InfoModal, { InfoParagraph } from './InfoModal'
import { UGC_MAX_CHARS } from '@/lib/ai-ugc-rules'
import { generateUgcCertificatePDF } from '@/lib/generate-certificate'
import { downloadFile } from '@/lib/download-helper'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const UGC_STAGES = [
  { key: 'script', label: 'Konuşma metni hazırlanıyor', duration: 15 },
  { key: 'scene', label: 'Sahne kurgulanıyor', duration: 40 },
  { key: 'video', label: 'Karakter ve ortam oluşturuluyor', duration: 100 },
  { key: 'merge', label: 'Ses ve görüntü birleştiriliyor', duration: 25 },
]

interface Props { briefId: string; brief: any; clientUser: any }

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0 }
  return hash.toString(36)
}

function readScript(scripts: Record<string, any>, personaId: number | string): string {
  const val = scripts?.[String(personaId)]
  if (typeof val === 'string') return val
  if (val?.segments) return val.segments.map((s: any) => s.dialogue).join(' ').trim()
  if (val?.dialogue) return val.dialogue
  return ''
}

export default function AIUGCTab({ briefId, brief, clientUser }: Props) {
  // Data
  const [ugcVideos, setUgcVideos] = useState<any[]>([])
  const [personas, setPersonas] = useState<any[]>([])
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [personaLoading, setPersonaLoading] = useState(true)
  // Feedback editing
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({})
  const [editingFeedback, setEditingFeedback] = useState<Record<string, boolean>>({})
  // Progress timer (AI Express pattern)
  const [timerStageMap, setTimerStageMap] = useState<Record<string, number>>({})
  // Generate panel
  const [selectedPersona, setSelectedPersona] = useState<number | null>(null)
  const [recommendedPersona, setRecommendedPersona] = useState<number | null>(null)
  const [scriptText, setScriptText] = useState('')
  const [scriptLoading, setScriptLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [ugcScripts, setUgcScripts] = useState<Record<string, any>>({})
  // Product toggle disabled: Veo 3.1 Fast image_url = first-frame, not reference. Kalitesiz sonuç verir.
  const useProduct = false
  // Settings + modals
  const [settings, setSettings] = useState<UGCSettings>(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(() => { if (typeof window === 'undefined') return false; const k = 'dinamo_seen_intro_ugc'; if (!localStorage.getItem(k)) { localStorage.setItem(k, 'true'); return true }; return false })
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [shortTextWarning, setShortTextWarning] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const viewedIdsRef = useRef<Set<string>>(new Set())

  async function markUgcVideoViewed(videoId: string) {
    if (viewedIdsRef.current.has(videoId)) return
    viewedIdsRef.current.add(videoId)
    await supabase.from('ugc_videos').update({ viewed_at: new Date().toISOString() }).eq('id', videoId).is('viewed_at', null)
  }

  useEffect(() => { loadData() }, [briefId])

  // Timer-based stage progression for processing videos
  useEffect(() => {
    const processing = ugcVideos.filter(v => v.status === 'queued' || v.status === 'generating')
    if (processing.length === 0) return
    // Initialize stage map
    setTimerStageMap(prev => {
      const next = { ...prev }
      processing.forEach(v => { if (!(v.id in next)) next[v.id] = 0 })
      return next
    })
    const timers: ReturnType<typeof setTimeout>[] = []
    processing.forEach(v => {
      let cumulative = 0
      UGC_STAGES.forEach((s, si) => {
        if (si === 0) return
        cumulative += UGC_STAGES[si - 1].duration * 1000
        timers.push(setTimeout(() => { setTimerStageMap(prev => ({ ...prev, [v.id]: si })) }, cumulative))
      })
    })
    return () => timers.forEach(clearTimeout)
  }, [ugcVideos.filter(v => v.status === 'queued' || v.status === 'generating').map(v => v.id).join(',')])

  async function loadData() {
    setLoading(true)
    setPersonaLoading(true)
    const [{ data: videos }, { data: p }, { data: freshBrief }] = await Promise.all([
      supabase.from('ugc_videos').select('*, personas(name, slug)').eq('brief_id', briefId).order('created_at', { ascending: false }),
      supabase.from('personas').select('*').order('id'),
      supabase.from('briefs').select('ugc_feedbacks, ugc_settings, ugc_persona_analysis, ugc_selected_persona_id, ugc_scripts, product_image_url, message, client_id').eq('id', briefId).single(),
    ])
    setUgcVideos(videos || [])
    setPersonas(p || [])
    const b = freshBrief || brief
    setFeedbacks(b?.ugc_feedbacks || [])
    if (b?.ugc_settings) setSettings({ ...DEFAULT_SETTINGS, ...b.ugc_settings })
    const scripts = b?.ugc_scripts || {}
    setUgcScripts(scripts)

    // Persona recommendation — cache check + API call if miss
    const briefHash = simpleHash(JSON.stringify({ m: b?.message, p: b?.product_image_url, c: b?.client_id }))
    const cached = b?.ugc_persona_analysis
    let recPersonaId: number | null = null
    if (cached && cached.brief_hash === briefHash && cached.recommended_persona_id) {
      recPersonaId = cached.recommended_persona_id
    } else if (p?.length) {
      try {
        const res = await fetch('/api/ugc/recommend-persona', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId }) })
        const data = await res.json()
        if (data.recommended_persona_id) {
          recPersonaId = data.recommended_persona_id
          await supabase.from('briefs').update({ ugc_persona_analysis: { ...data, brief_hash: briefHash, analyzed_at: new Date().toISOString() } }).eq('id', briefId)
        }
      } catch {}
    }
    if (recPersonaId) setRecommendedPersona(recPersonaId)
    setPersonaLoading(false)

    // Set default persona (prefer last video > user selection > recommended)
    const lastVideo = (videos || []).slice(-1)[0]
    const defaultPersona = lastVideo?.persona_id || b?.ugc_selected_persona_id || recPersonaId || (p?.[0]?.id)
    setSelectedPersona(defaultPersona)
    if (defaultPersona) setScriptText(readScript(scripts, defaultPersona))
    setLoading(false)
  }

  // Auto-generate script ONLY on first mount for recommended persona (if no saved script)
  const ugcScriptsRef = useRef(ugcScripts)
  ugcScriptsRef.current = ugcScripts
  const [autoGenerated, setAutoGenerated] = useState(false)
  useEffect(() => {
    if (!selectedPersona || scriptLoading || loading) return
    const existing = readScript(ugcScriptsRef.current, selectedPersona)
    if (existing) return
    // No saved script — only auto-generate once on mount for recommended persona
    if (!autoGenerated && selectedPersona === recommendedPersona) {
      setAutoGenerated(true)
      ;(async () => {
        setScriptLoading(true)
        try {
          const res = await fetch('/api/ugc/generate-script', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, persona_id: selectedPersona, use_product: false, settings, previous_feedbacks: feedbacks }) })
          const data = await res.json()
          if (data.dialogue) {
            setScriptText(data.dialogue)
            const updated = { ...ugcScriptsRef.current, [String(selectedPersona)]: data.dialogue }
            setUgcScripts(updated)
            supabase.from('briefs').update({ ugc_scripts: updated }).eq('id', briefId)
          }
        } catch {}
        setScriptLoading(false)
      })()
    }
  }, [selectedPersona, loading, recommendedPersona])

  // Feedback save (AI Express pattern: inline supabase update to brief.ugc_feedbacks)
  async function saveFeedback(videoId: string, videoVersion: string, personaSlug: string) {
    const val = feedbackText[videoId]?.trim()
    if (!val) return
    const entry = { video_version: videoVersion, persona_slug: personaSlug, feedback: val, created_at: new Date().toISOString() }
    const existing = [...feedbacks]
    // Replace if same version exists, else push
    const idx = existing.findIndex(f => f.video_version === videoVersion)
    if (idx >= 0) existing[idx] = entry; else existing.push(entry)
    await supabase.from('briefs').update({ ugc_feedbacks: existing }).eq('id', briefId)
    setFeedbacks(existing)
    setEditingFeedback(prev => ({ ...prev, [videoId]: false }))
    setFeedbackText(prev => ({ ...prev, [videoId]: '' }))
  }

  // Retry failed video with same settings
  const [retryingId, setRetryingId] = useState<string | null>(null)
  async function handleRetry(failedVideo: any) {
    setRetryingId(failedVideo.id)
    try {
      const scriptPayload = failedVideo.script || { segments: [] }
      const genRes = await fetch('/api/ugc/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, persona_id: failedVideo.persona_id, use_product: false, script: scriptPayload, settings: failedVideo.settings_snapshot || settings }) })
      const genData = await genRes.json()
      if (genData.ugc_video_id) {
        const persona = personas.find(p => p.id === failedVideo.persona_id)
        setUgcVideos(prev => [{ id: genData.ugc_video_id, status: 'queued', persona_id: failedVideo.persona_id, personas: persona, created_at: new Date().toISOString() }, ...prev])
        const poll = setInterval(async () => {
          const { data: v } = await supabase.from('ugc_videos').select('*, personas(name, slug)').eq('id', genData.ugc_video_id).single()
          if (v && (v.status === 'ready' || v.status === 'failed')) { clearInterval(poll); setHighlightId(genData.ugc_video_id); setTimeout(() => setHighlightId(null), 1500); loadData() }
          else if (v && v.status !== 'queued') { setUgcVideos(prev => prev.map(x => x.id === genData.ugc_video_id ? v : x)) }
        }, 10000)
      } else { setMsg(genData.error || 'Tekrar deneme başarısız') }
    } catch { setMsg('Bağlantı hatası') }
    setRetryingId(null)
  }

  // Generate new version
  async function handleGenerate() {
    if (!selectedPersona || !scriptText) return
    setGenerating(true)
    try {
      const scriptPayload = { dialogue: scriptText.trim() }
      const genRes = await fetch('/api/ugc/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, persona_id: selectedPersona, use_product: false, script: scriptPayload, settings }) })
      const genData = await genRes.json()
      if (genData.ugc_video_id) {
        // Poll
        const poll = setInterval(async () => {
          const { data: v } = await supabase.from('ugc_videos').select('*, personas(name, slug)').eq('id', genData.ugc_video_id).single()
          if (v && (v.status === 'ready' || v.status === 'failed')) { clearInterval(poll); setHighlightId(genData.ugc_video_id); setTimeout(() => setHighlightId(null), 1500); loadData() }
          else if (v && v.status !== 'queued') { setUgcVideos(prev => prev.map(x => x.id === genData.ugc_video_id ? v : x)) }
        }, 10000)
        // Optimistic add + scroll to top
        setUgcVideos(prev => [{ id: genData.ugc_video_id, status: 'queued', persona_id: selectedPersona, personas: personas.find(p => p.id === selectedPersona), created_at: new Date().toISOString() }, ...prev])
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else { setMsg(genData.error || 'Üretim başarısız') }
    } catch { setMsg('Bağlantı hatası') }
    setGenerating(false)
  }

  // Purchase
  async function handlePurchase(videoId: string) {
    setPurchasing(videoId)
    try {
      const res = await fetch('/api/ugc/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ugc_video_id: videoId }) })
      const data = await res.json()
      if (data.download_url) { setUgcVideos(prev => prev.map(v => v.id === videoId ? { ...v, status: 'sold' } : v)) }
      else { setMsg(data.error || 'Satın alma başarısız') }
    } catch { setMsg('Bağlantı hatası') }
    setPurchasing(null)
  }

  function handleSettingsChange(s: UGCSettings) { setSettings(s); supabase.from('briefs').update({ ugc_settings: s }).eq('id', briefId) }

  const brandSlug = (clientUser?.clients?.company_name || 'brand').toLowerCase().replace(/[^a-z0-9]+/g, '-')

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#888', fontSize: '13px' }}>Yükleniyor...</div>

  return (
    <div>
      {/* HEADER ROW */}
      <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', marginBottom: '16px', gap: '8px' }}>
        <button onClick={() => setInfoOpen(true)} title="AI UGC Hakkında" onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }} style={{ width: '28px', height: '28px', minWidth: '28px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s', flexShrink: 0, padding: '4px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
        </button>
        <button onClick={() => setSettingsOpen(true)} title="AI UGC Ayarları" onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }} style={{ width: '28px', height: '28px', minWidth: '28px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-1.42 3.42 2 2 0 0 1-1.42-.59l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-3.42-1.42 2 2 0 0 1 .59-1.42l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 1.42-3.42 2 2 0 0 1 1.42.59l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10.07 3V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 3.42 1.42 2 2 0 0 1-.59 1.42l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'inline-flex', padding: '6px 14px', border: '1px solid #0a0a0a', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: ugcVideos.length > 0 ? '#0a0a0a' : '#9ca3af', flexShrink: 0, whiteSpace: 'nowrap' }}>{ugcVideos.reduce((s, v) => s + (v.status === 'sold' ? 2 : 1), 0)} KREDİ</div>
      </div>

      {msg && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid #ef4444', fontSize: '12px', color: '#0a0a0a', marginBottom: '12px' }}>{msg}<button onClick={() => setMsg('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>×</button></div>}

      {/* VERSION LIST (AI Express pattern) */}
      <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px 24px', marginBottom: '16px' }}>
        {ugcVideos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontSize: '13px' }}>Henüz UGC video üretilmedi. Aşağıdan metin oluşturun ve üretin.</div>
        )}

        {ugcVideos.map((video, idx) => {
          const hasVideo = !!video.final_url
          const isPurchased = video.status === 'sold'
          const isFailed = video.status === 'failed'
          const isProcessing = video.status === 'queued' || video.status === 'generating'
          const personaName = video.personas?.name || personas.find(p => p.id === video.persona_id)?.name || ''
          const personaSlug = video.personas?.slug || personas.find(p => p.id === video.persona_id)?.slug || ''
          const versionLabel = `V${ugcVideos.length - idx}`
          const lastFb = feedbacks.find(f => f.video_version === versionLabel)
          const isEditingFb = editingFeedback[video.id] || !lastFb
          const currentFbText = feedbackText[video.id] ?? ''

          return (
            <div key={video.id} style={{ display: 'flex', gap: '14px', padding: '14px', marginBottom: '8px', border: highlightId === video.id ? '2px solid #22c55e' : '1px solid var(--color-border-tertiary)', background: '#fff', alignItems: 'flex-start', transition: 'all 0.3s' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-background-secondary)' }} onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}>
              {/* Video */}
              <div style={{ width: '200px', aspectRatio: '9/16', background: '#0a0a0a', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                {hasVideo ? (
                  <>
                    <video src={video.final_url} controls preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'black' }} onPlay={() => markUgcVideoViewed(video.id)} />
                    {!isPurchased && <img src="/dinamo_logo.png" alt="" style={{ position: 'absolute', bottom: '30%', left: '50%', transform: 'translateX(-50%)', width: '80px', opacity: 0.35, pointerEvents: 'none' }} />}
                  </>
                ) : isProcessing ? (
                  (() => {
                    const curSi = timerStageMap[video.id] || 0
                    return (
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '16px', background: '#0a0a0a' }}>
                        <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b6b66', marginBottom: '12px' }}>TAHMİNİ SÜRE: 2-3 dakika</div>
                        {UGC_STAGES.map((s, si) => {
                          const done = curSi > si
                          const active = curSi === si
                          return (
                            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <div style={{ width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {done ? <span style={{ color: '#4ade80', fontSize: '10px' }}>&#10003;</span>
                                  : active ? <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', borderStyle: 'solid', borderColor: '#4ade80 transparent transparent transparent' }} />
                                  : <div style={{ width: '4px', height: '4px', background: '#555' }} />}
                              </div>
                              <span style={{ fontSize: '13px', lineHeight: '1.8', color: done ? '#4ade80' : active ? '#fff' : '#6b6b66', fontWeight: active ? '500' : '400', transition: 'all 0.3s' }}>{s.label}</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '20px', color: '#555' }}>&#9888;</span>
                    <span style={{ fontSize: '10px', color: '#999' }}>Üretilemedi</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{versionLabel}{personaName ? ` — ${personaName}` : ''}</span>
                  {isPurchased && <span style={{ fontSize: '9px', color: '#1DB81D', fontWeight: '600' }}>&#10003; Satın Alındı</span>}
                  {isProcessing && <span style={{ fontSize: '9px', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span className="dot" style={{ width: '6px', height: '6px', background: '#4ade80', display: 'inline-block', animation: 'pulse 1.5s ease infinite' }} /><span style={{ color: '#0a0a0a' }}>Üretiliyor</span> <span style={{ color: '#6b6b66' }}>(~3 dakika)</span></span>}
                  {isFailed && <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: '500' }}>Başarısız</span>}
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px' }}>{new Date(video.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>

                {/* Failed actions */}
                {isFailed && (
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                    <button onClick={() => handleRetry(video)} disabled={retryingId === video.id} style={{ padding: '5px 12px', background: '#0a0a0a', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '500', cursor: retryingId === video.id ? 'not-allowed' : 'pointer', opacity: retryingId === video.id ? 0.5 : 1 }}>{retryingId === video.id ? 'Üretiliyor...' : 'Tekrar Dene'}</button>
                  </div>
                )}

                {/* Actions for completed video */}
                {hasVideo && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {isPurchased ? (
                      <>
                        <button onClick={() => downloadFile(video.final_url, `dinamo_${brandSlug}_ugc_${personaSlug}_v${idx + 1}.mp4`)} style={{ fontSize: '11px', color: '#0a0a0a', background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4 8l4 4 4-4" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/><path d="M2 13h12" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          İndir
                        </button>
                        <button onClick={() => generateUgcCertificatePDF(brief, clientUser?.clients?.company_name || '', personaName)} style={{ fontSize: '11px', color: '#555', background: 'none', border: '0.5px solid rgba(0,0,0,0.12)', padding: '5px 12px', cursor: 'pointer' }}>Telif Belgesi</button>
                        <button disabled style={{ fontSize: '11px', color: '#888', background: 'none', border: '0.5px solid rgba(0,0,0,0.08)', padding: '5px 12px', cursor: 'default', opacity: 0.4 }} title="Yakında">Görsel Oluştur</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handlePurchase(video.id)} disabled={purchasing === video.id || (clientUser?.allocated_credits || 0) < 1} className="btn btn-accent" style={{ padding: '6px 16px' }}>SATIN AL</button>
                        <span style={{ fontSize: '13px', color: '#888' }}>1 kredi</span>
                      </>
                    )}
                  </div>
                )}

                {/* Feedback (AI Express pattern) */}
                {hasVideo && (
                  <div style={{ marginTop: '10px' }}>
                    {!isEditingFb && lastFb ? (
                      <div style={{ fontSize: '11px', color: '#555', padding: '8px 10px', background: '#f5f4f0', lineHeight: 1.5 }}>
                        <span style={{ color: '#0a0a0a' }}>{lastFb.feedback}</span>
                        <span onClick={() => { setEditingFeedback(p => ({ ...p, [video.id]: true })); setFeedbackText(p => ({ ...p, [video.id]: lastFb.feedback })) }} style={{ marginLeft: '8px', fontSize: '10px', color: '#3b82f6', cursor: 'pointer' }}>Düzenle</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
                        <textarea
                          value={currentFbText}
                          onChange={e => { if (e.target.value.length <= 200) setFeedbackText(p => ({ ...p, [video.id]: e.target.value })) }}
                          placeholder="AI UGC videolar şimdilik harika olmayabilir ama gelişebilir. Yorum bırakın — bir sonraki üretimde dikkate alınır."
                          rows={3}
                          style={{ flex: 1, padding: '12px 14px', border: '0.5px solid rgba(0,0,0,0.1)', fontSize: '11px', color: '#0a0a0a', resize: 'vertical', boxSizing: 'border-box' }}
                        />
                        <button onClick={() => saveFeedback(video.id, versionLabel, personaSlug)} style={{ padding: '8px 14px', background: '#0a0a0a', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap', height: '36px' }}>Kaydet</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

      </div>

      {/* PERSONA SELECTION + GENERATE PANEL */}
      <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px 24px' }}>
        {/* Recommended persona large card */}
        <div style={{ minHeight: '100px', marginBottom: '16px' }}>
          {personaLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100px', gap: '10px' }}>
              <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px', borderStyle: 'solid', borderColor: '#e5e4db #e5e4db #e5e4db #0a0a0a' }} />
              <span style={{ fontSize: '12px', color: '#888' }}>Brief'e uygun persona belirleniyor...</span>
            </div>
          ) : (() => {
            const p = personas.find(x => x.id === selectedPersona)
            if (!p) return null
            const isRecommended = selectedPersona === recommendedPersona
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="dot" style={{ width: '80px', height: '80px', minWidth: '80px', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', overflow: 'hidden' }}>
                  {p.thumbnail_url ? <img src={p.thumbnail_url} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  {isRecommended && <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#22c55e', fontWeight: '500', marginBottom: '4px' }}>ÖNERİLEN PERSONA</div>}
                  <div style={{ fontSize: '16px', fontWeight: '500', color: '#0a0a0a', marginBottom: '4px' }}>{p.name}</div>
                  <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.4 }}>{p.description}</div>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Alternative personas (thumbnails) */}
        <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>PERSONA SEÇ</div>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '16px' }}>
          {personas.map(p => (
            <div key={p.id} onClick={() => { setSelectedPersona(p.id); setScriptText(readScript(ugcScripts, p.id)); supabase.from('briefs').update({ ugc_selected_persona_id: p.id }).eq('id', briefId) }} style={{ flexShrink: 0, width: '60px', textAlign: 'center', cursor: 'pointer', opacity: selectedPersona === p.id ? 1 : 0.6, transition: 'opacity 0.15s' }}>
              <div className="dot" style={{ width: '40px', height: '40px', minWidth: '40px', margin: '0 auto 4px', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', border: selectedPersona === p.id ? '2px solid #22c55e' : '1px solid #e5e4db', overflow: 'hidden', transition: 'border-color 0.15s' }}>
                {p.thumbnail_url ? <img src={p.thumbnail_url} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.name[0]}
              </div>
              <div style={{ fontSize: '9px', color: '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
            </div>
          ))}
        </div>

        {/* GENERATE */}
        {generating ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 0' }}>
            <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderStyle: 'solid', borderColor: '#1DB81D transparent transparent transparent' }} />
            <span style={{ fontSize: '12px', color: '#888' }}>Üretim başlatılıyor...</span>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--color-border-tertiary)', padding: '16px' }}>
            {/* Script */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>KONUŞMA METNİ</div>
                <button onClick={async () => {
                  if (!selectedPersona) return
                  setScriptLoading(true)
                  try {
                    const res = await fetch('/api/ugc/generate-script', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, persona_id: selectedPersona, use_product: false, settings, previous_feedbacks: feedbacks }) })
                    const data = await res.json()
                    if (data.dialogue) {
                      setScriptText(data.dialogue)
                      const updated = { ...ugcScripts, [String(selectedPersona)]: data.dialogue }
                      setUgcScripts(updated)
                      supabase.from('briefs').update({ ugc_scripts: updated }).eq('id', briefId)
                    } else { setMsg(data.error || 'Script üretilemedi') }
                  } catch { setMsg('Bağlantı hatası') }
                  setScriptLoading(false)
                }} disabled={scriptLoading || !selectedPersona} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '10px' }}>
                  {scriptLoading ? 'ÜRETİLİYOR...' : scriptText ? 'YENİ SCRİPT ÜRET' : 'SCRİPT ÜRET'}
                </button>
              </div>
              <div>
                <textarea value={scriptText} onChange={e => { if (e.target.value.length <= UGC_MAX_CHARS) setScriptText(e.target.value) }} onBlur={() => { if (!selectedPersona || scriptText === readScript(ugcScripts, selectedPersona)) return; const updated = { ...ugcScripts, [String(selectedPersona)]: scriptText }; setUgcScripts(updated); supabase.from('briefs').update({ ugc_scripts: updated }).eq('id', briefId) }} placeholder={scriptLoading ? 'Üretiliyor...' : 'Bu persona için konuşma metni henüz üretilmedi. SCRİPT ÜRET butonuna basın veya buraya yazın.'} style={{ width: '100%', minHeight: '60px', fontSize: '13px', color: '#0a0a0a', lineHeight: 1.6, border: '1px solid #e5e4db', padding: '10px 12px', resize: 'none', boxSizing: 'border-box' }} />
                <div style={{ textAlign: 'right', fontSize: '10px', color: scriptText.length > 160 ? '#ef4444' : scriptText.length >= 155 ? '#f59e0b' : scriptText.length >= 140 ? '#22c55e' : scriptText.length >= 110 ? '#f59e0b' : '#888', marginTop: '4px' }}>{scriptText.length} / {UGC_MAX_CHARS}</div>
              </div>
            </div>
            {/* ÜRET */}
            <button onClick={() => { if (scriptText.length < 100) { setShortTextWarning(true) } else { handleGenerate() } }} disabled={generating || !selectedPersona || !scriptText || (clientUser?.allocated_credits || 0) < 1} style={{ width: '100%', padding: '12px', background: (!selectedPersona || !scriptText || (clientUser?.allocated_credits || 0) < 1) ? '#ccc' : '#0a0a0a', color: '#fff', border: 'none', fontSize: '13px', fontWeight: '600', cursor: (!selectedPersona || !scriptText) ? 'default' : 'pointer' }}>
              ÜRET (1 KREDİ)
            </button>
          </div>
        )}
      </div>

      {/* Info Modal */}
      <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)} title="AI UGC hakkında" badge="BETA">
        <InfoParagraph primary>AI UGC ile gerçek bir influencer/creator izlenimi veren dikey video içerikleri üretin. Deneysel bir özelliktir — sonuçlar garanti edilmez.</InfoParagraph>
        <InfoParagraph>24 saniyelik üç planlı anlatım, brief'inize ve seçtiğiniz personaya göre tamamen yapay zeka tarafından oluşturulur. Karakter, ortam, metin, ses ve dudak senkronu AI tarafından üretilir; ton, konuşma hızı, CTA ve müzik tercihleri ayarlardan özelleştirilebilir.</InfoParagraph>
        <InfoParagraph>Dinamo sadece marka bilgileri ve seçtiğiniz tercihlerle AI prompt'larına müdahale eder. Beta sürümünde özellikle Türkçe seslendirme ve karakter tutarlılığında iyileştirmeler devam etmektedir — geri bildirimleriniz değerlidir.</InfoParagraph>
        <InfoParagraph>Şu anda test edebilmeniz için AI UGC videoları 8 saniye ile sınırlıdır.</InfoParagraph>
      </InfoModal>

      {/* Settings Modal */}
      <UGCSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onChange={handleSettingsChange} brandDefaults={null} />

      {/* Short Text Warning Modal */}
      {shortTextWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShortTextWarning(false)}>
          <div style={{ background: '#fff', padding: '28px', maxWidth: '400px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a', marginBottom: '12px' }}>Kısa Metin Uyarısı</div>
            <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.6, marginBottom: '20px' }}>
              Yazdığınız metin {scriptText.length} karakter. 8 saniyelik video için Veo metni çok hızlı konuşturabilir veya sona sessiz kapanış ekleyebilir. En az 110-120 karakter önerilir.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShortTextWarning(false)} style={{ flex: 1, padding: '10px', background: '#fff', color: '#0a0a0a', border: '1px solid #0a0a0a', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>Düzelt</button>
              <button onClick={() => { setShortTextWarning(false); handleGenerate() }} style={{ flex: 1, padding: '10px', background: '#0a0a0a', color: '#fff', border: '1px solid #0a0a0a', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>Yine de Üret</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
