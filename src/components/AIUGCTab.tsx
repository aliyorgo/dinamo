'use client'
import { useState, useEffect, useRef } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { UGCSettings, DEFAULT_SETTINGS } from './UGCSettingsModal'
import { UGC_MAX_CHARS } from '@/lib/ai-ugc-rules'
import { generateUgcCertificatePDF } from '@/lib/generate-certificate'
import { downloadFile } from '@/lib/download-helper'
import { pauseOtherVideos } from '@/lib/video-playback'
import StaticImageGeneratorModal from '@/components/StaticImageGeneratorModal'

const supabase = getSupabaseBrowser()

const UGC_STAGES = [
  { key: 'script', label: 'Konuşma metni hazırlanıyor', duration: 15 },
  { key: 'scene', label: 'Sahne kurgulanıyor', duration: 40 },
  { key: 'video', label: 'Karakter ve ortam oluşturuluyor', duration: 100 },
  { key: 'merge', label: 'Ses ve görüntü birleştiriliyor', duration: 25 },
]

interface Props { briefId: string; brief: any; clientUser: any; autoPlayVideoId?: string; onVideoCountChange?: (count: number) => void }

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0 }
  return hash.toString(36)
}

function formatDuration(start: string | null, end: string | null): string | null {
  if (!start || !end) return null
  const norm = (d: string) => d.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(d) ? d : d + 'Z'
  const seconds = Math.floor((new Date(norm(end)).getTime() - new Date(norm(start)).getTime()) / 1000)
  if (seconds <= 0) return null
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  if (min === 0) return `${sec} sn'de üretildi`
  if (sec === 0) return `${min} dk'da üretildi`
  return `${min} dk ${sec} sn'de üretildi`
}

function readScript(scripts: Record<string, any>, personaId: number | string): string {
  const val = scripts?.[String(personaId)]
  if (typeof val === 'string') return val
  if (val?.segments) return val.segments.map((s: any) => s.dialogue).join(' ').trim()
  if (val?.dialogue) return val.dialogue
  return ''
}

export default function AIUGCTab({ briefId, brief: briefProp, clientUser, autoPlayVideoId, onVideoCountChange }: Props) {
  // Data — local brief copy for lock updates
  const [brief, setBrief] = useState<any>(briefProp)
  useEffect(() => { setBrief(briefProp) }, [briefProp])
  const [ugcVideos, setUgcVideos] = useState<any[]>([])
  const [personas, setPersonas] = useState<any[]>([])
  const videoCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
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
  const [personaFading, setPersonaFading] = useState(false)
  const [hoveredPersona, setHoveredPersona] = useState<string | null>(null)
  const [staticImageModal, setStaticImageModal] = useState<{ briefId: string; videoUrl: string; ugcVideoId?: string } | null>(null)
  const [scriptText, setScriptText] = useState('')
  const [scriptLoading, setScriptLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [ugcScripts, setUgcScripts] = useState<Record<string, any>>({})
  const [changesSummary, setChangesSummary] = useState('')
  // Product toggle disabled: Veo 3.1 Fast image_url = first-frame, not reference. Kalitesiz sonuç verir.
  const useProduct = false
  // Settings + modals
  const [settings, setSettings] = useState<UGCSettings>(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(() => { if (typeof window === 'undefined') return false; const k = 'dinamo_seen_intro_ugc'; if (!localStorage.getItem(k)) { localStorage.setItem(k, 'true'); return true }; return false })
  const [panelLastMove, setPanelLastMove] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelButtonsRef = useRef<HTMLDivElement>(null)
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

  // Panel mutual exclusion helpers
  function toggleInfo() { setInfoOpen(p => !p); setSettingsOpen(false) }
  function toggleSettings() { setSettingsOpen(p => !p); setInfoOpen(false) }

  // Outside click closes panels
  useEffect(() => {
    if (!infoOpen && !settingsOpen) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || panelButtonsRef.current?.contains(t)) return
      setInfoOpen(false); setSettingsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [infoOpen, settingsOpen])

  // 30s auto-close
  useEffect(() => {
    if (!infoOpen && !settingsOpen) return
    const timer = setTimeout(() => { setInfoOpen(false); setSettingsOpen(false) }, 30000)
    return () => clearTimeout(timer)
  }, [infoOpen, settingsOpen, panelLastMove])

  useEffect(() => { loadData() }, [briefId])

  // Notify parent of video count changes (for tab label)
  useEffect(() => {
    const count = ugcVideos.filter(v => v.status !== 'failed').length
    onVideoCountChange?.(count)
  }, [ugcVideos])

  // Global polling — processing video varsa 8sn'de bir tüm listeyi fresh fetch
  const hasProcessingVideos = ugcVideos.some(v => v.status === 'queued' || v.status === 'generating')
  useEffect(() => {
    if (!hasProcessingVideos) return
    const poll = setInterval(async () => {
      const { data } = await supabase.from('ugc_videos').select('*, personas(name, slug)').eq('brief_id', briefId).order('created_at', { ascending: true })
      if (data) setUgcVideos(data)
    }, 8000)
    return () => clearInterval(poll)
  }, [hasProcessingVideos])

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
      supabase.from('ugc_videos').select('*, personas(name, slug)').eq('brief_id', briefId).order('created_at', { ascending: true }),
      fetch(`/api/ugc/personas?client_id=${brief.client_id}`).then(r => r.json()).then(data => ({ data })),
      supabase.from('briefs').select('ugc_feedbacks, ugc_settings, ugc_persona_analysis, ugc_selected_persona_id, ugc_scripts, product_image_url, message, client_id, static_images_url').eq('id', briefId).single(),
    ])
    setUgcVideos(videos || [])
    setPersonas(p || [])
    const b = freshBrief || brief
    if (freshBrief) setBrief((prev: any) => ({ ...prev, ...freshBrief }))
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
    if (defaultPersona) {
      const dbScript = readScript(scripts, defaultPersona)
      if (dbScript) setScriptText(dbScript)
    }
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
            setChangesSummary(data.changes_summary || '')
            const updated = { ...ugcScriptsRef.current, [String(selectedPersona)]: data.dialogue }
            setUgcScripts(updated)
            persistUgcScripts(updated)
          }
        } catch {}
        setScriptLoading(false)
      })()
    }
  }, [selectedPersona, loading, recommendedPersona])

  // Auto-scroll + autoplay from dashboard notification click
  const ugcAutoScrolledRef = useRef(false)
  useEffect(() => {
    if (ugcAutoScrolledRef.current || !autoPlayVideoId || loading || ugcVideos.length === 0) return
    const el = videoCardRefs.current[autoPlayVideoId]
    if (!el) return
    ugcAutoScrolledRef.current = true
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const vid = el.querySelector('video') as HTMLVideoElement
      if (vid) vid.play().catch(() => {})
    }, 400)
  }, [autoPlayVideoId, loading, ugcVideos.length])

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

  // Retry failed video — service-role endpoint resets record, worker re-picks it
  const [retryingId, setRetryingId] = useState<string | null>(null)
  async function handleRetry(failedVideo: any) {
    if (retryingId) return // prevent double-click
    setRetryingId(failedVideo.id)
    try {
      // Fix script format if old format
      let script = failedVideo.script
      if (!script?.dialogue) {
        const dialogue = readScript(ugcScripts, failedVideo.persona_id) || scriptText
        script = { dialogue: dialogue.trim() || 'Merhaba' }
      }

      // Service-role endpoint — bypasses RLS
      const res = await fetch('/api/ugc/retry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ video_id: failedVideo.id, script }) })
      if (!res.ok) { const d = await res.json(); setMsg(d.error || 'Yeniden deneme başarısız'); setRetryingId(null); return }

      // Optimistic UI update — same card switches to processing
      setUgcVideos(prev => prev.map(v => v.id === failedVideo.id ? { ...v, status: 'queued', error_message: null, final_url: null } : v))

      // Poll same video id
      const poll = setInterval(async () => {
        const { data: v } = await supabase.from('ugc_videos').select('*, personas(name, slug)').eq('id', failedVideo.id).single()
        if (v && (v.status === 'ready' || v.status === 'failed')) { clearInterval(poll); setRetryingId(null); setUgcVideos(prev => prev.map(x => x.id === failedVideo.id ? v : x)) }
        else if (v && v.status !== 'queued') { setUgcVideos(prev => prev.map(x => x.id === failedVideo.id ? v : x)) }
      }, 10000)
    } catch { setMsg('Bağlantı hatası'); setRetryingId(null) }
  }

  // Generate new version
  async function handleGenerate() {
    if (!selectedPersona || !scriptText) return
    setGenerating(true)

    let finalScript = scriptText.trim()
    let finalSummary = changesSummary

    // Auto-regenerate script if there's feedback since last video
    const lastVersion = `V${ugcVideos.length}`
    const hasNewFeedback = feedbacks.some(f => f.video_version === lastVersion)
    if (hasNewFeedback && feedbacks.length > 0) {
      try {
        const scriptRes = await fetch('/api/ugc/generate-script', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, persona_id: selectedPersona, use_product: false, settings, previous_feedbacks: feedbacks }) })
        const scriptData = await scriptRes.json()
        if (scriptData.dialogue) {
          finalScript = scriptData.dialogue
          finalSummary = scriptData.changes_summary || ''
          setScriptText(finalScript)
          setChangesSummary(finalSummary)
          const updated = { ...ugcScripts, [String(selectedPersona)]: finalScript }
          setUgcScripts(updated)
          persistUgcScripts(updated)
        }
      } catch (e) { console.warn('[auto-script] regenerate failed:', e) }
    }

    try {
      const scriptPayload = { dialogue: finalScript }
      const genRes = await fetch('/api/ugc/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, persona_id: selectedPersona, use_product: false, script: scriptPayload, settings, changes_summary: finalSummary }) })
      const genData = await genRes.json()
      if (genData.ugc_video_id) {
        // Poll
        const poll = setInterval(async () => {
          const { data: v } = await supabase.from('ugc_videos').select('*, personas(name, slug)').eq('id', genData.ugc_video_id).single()
          if (v && (v.status === 'ready' || v.status === 'failed')) { clearInterval(poll); setHighlightId(genData.ugc_video_id); setTimeout(() => setHighlightId(null), 1500); setUgcVideos(prev => prev.map(x => x.id === genData.ugc_video_id ? v : x)); setGenerating(false) }
          else if (v && v.status !== 'queued') { setUgcVideos(prev => prev.map(x => x.id === genData.ugc_video_id ? v : x)) }
        }, 10000)
        setUgcVideos(prev => [...prev, { id: genData.ugc_video_id, status: 'queued', persona_id: selectedPersona, personas: personas.find(p => p.id === selectedPersona), created_at: new Date().toISOString() }])
      } else { setMsg(genData.error || 'Üretim başarısız') }
    } catch { setMsg('Bağlantı hatası') }
    setGenerating(false)
  }

  // Persist ugc_scripts via service role endpoint (RLS bypass)
  async function persistUgcScripts(scripts: Record<string, any>) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    fetch(`/api/briefs/${briefId}/ugc-scripts`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ ugc_scripts: scripts }) })
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

  const [settingsSaved, setSettingsSaved] = useState(false)
  function handleSettingsChange(s: UGCSettings) {
    setSettings(s)
    supabase.from('briefs').update({ ugc_settings: s }).eq('id', briefId)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 1500)
  }

  const brandSlug = (clientUser?.clients?.company_name || 'brand').toLowerCase().replace(/[^a-z0-9]+/g, '-')

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#888', fontSize: '13px' }}>Yükleniyor...</div>

  return (
    <div>
      {/* HEADER ROW */}
      <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', marginBottom: '16px', gap: '8px' }}>
        <div ref={panelButtonsRef} style={{ display: 'contents' }}>
        <button onClick={toggleInfo} title="AI Persona Hakkında"
          onMouseEnter={e => { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#f5f4f0'; e.currentTarget.style.color = '#888' }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#f5f4f0', border: 'none', fontSize: '11px', color: '#888', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          Bilgi
        </button>
        <button onClick={toggleSettings} title="AI Persona Ayarları"
          onMouseEnter={e => { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#f5f4f0'; e.currentTarget.style.color = '#888' }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#f5f4f0', border: 'none', fontSize: '11px', color: '#888', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
          Ayarlar
        </button>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'inline-flex', padding: '6px 14px', border: '1px solid #0a0a0a', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: ugcVideos.length > 0 ? '#0a0a0a' : '#9ca3af', flexShrink: 0, whiteSpace: 'nowrap' }}>{ugcVideos.reduce((s, v) => s + (v.status === 'sold' ? 2 : 1), 0)} KREDİ</div>
      </div>

      {/* Panels container (for outside click ref) */}
      <div ref={panelRef} onMouseMove={() => setPanelLastMove(Date.now())}>
      {/* Info Collapse Panel */}
      {infoOpen && (
        <div style={{ background: '#f9f7f3', border: '1px solid #e5e4db', padding: '20px', marginBottom: '16px', transition: 'all 0.2s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a' }}>AI Persona Hakkında</div>
            <button onClick={() => setInfoOpen(false)} style={{ width: '24px', height: '24px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => { e.currentTarget.style.color = '#0a0a0a' }} onMouseLeave={e => { e.currentTarget.style.color = '#888' }}>×</button>
          </div>
          <div style={{ fontSize: '13px', color: '#333', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 12px' }}>AI Persona ile gerçek bir influencer/creator izlenimi veren dikey video içerikleri üretin. Deneysel bir özelliktir — sonuçlar garanti edilmez. Beta sürümü mevcut modellerde en iyi sonuçları elde edebilmek için 8 saniye ile sınırlıdır.</p>
            <p style={{ margin: '0 0 12px' }}>Brief'inize ve seçtiğiniz personaya göre tamamen yapay zeka tarafından oluşturulur. Karakter, ortam, metin, ses ve dudak senkronu AI tarafından üretilir; ton ve CTA tercihleri ayarlardan özelleştirilebilir.</p>
            <p style={{ margin: '0 0 12px' }}>Dinamo sadece marka bilgileri ve seçtiğiniz tercihlerle AI prompt'larına müdahale eder. Beta sürümünde özellikle Türkçe seslendirme ve karakter tutarlılığında iyileştirmeler devam etmektedir.</p>
            <p style={{ margin: 0 }}>AI ile üretilen bu tarzda içeriklere watermark koymak kanun, şirket politikası ya da etik gereklilik olabilir. Ayarlardan bu uyarıyı videonuza ekleyebilirsiniz.</p>
          </div>
        </div>
      )}

      {/* Settings Collapse Panel */}
      {settingsOpen && (
        <div style={{ background: '#f9f7f3', border: '1px solid #e5e4db', padding: '20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a' }}>AI Persona Ayarları{settingsSaved && <span style={{ fontSize: '11px', color: '#22c55e', marginLeft: '12px', fontWeight: '500' }}>✓ Kaydedildi</span>}</div>
            <button onClick={() => setSettingsOpen(false)} style={{ width: '24px', height: '24px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => { e.currentTarget.style.color = '#0a0a0a' }} onMouseLeave={e => { e.currentTarget.style.color = '#888' }}>×</button>
          </div>
          {/* Ton */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #e5e4db' }}>
            <div><div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>Ton</div><div style={{ fontSize: '11px', color: '#888' }}>Anlatım dilinin tonunu belirler</div></div>
            <div style={{ display: 'flex', gap: '0', border: '1px solid #e5e4db', flexShrink: 0 }}>
              {(['samimi', 'normal', 'resmi'] as const).map(t => (
                <button key={t} onClick={() => handleSettingsChange({ ...settings, tone: t })}
                  style={{ padding: '4px 10px', fontSize: '10px', border: 'none', cursor: 'pointer', background: settings.tone === t ? '#0a0a0a' : '#fff', color: settings.tone === t ? '#fff' : '#888', fontWeight: settings.tone === t ? '600' : '400', transition: 'all 0.15s' }}>
                  {t === 'samimi' ? 'Samimi' : t === 'resmi' ? 'Resmi' : 'Normal'}
                </button>
              ))}
            </div>
          </div>
          {/* CTA */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #e5e4db' }}>
            <div><div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>CTA</div><div style={{ fontSize: '11px', color: '#888' }}>Harekete geçirici çağrı ekle</div></div>
            <button onClick={() => handleSettingsChange({ ...settings, cta: !settings.cta })}
              style={{ width: '36px', height: '20px', border: 'none', cursor: 'pointer', background: settings.cta ? '#22c55e' : '#ddd', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <span className="dot" style={{ position: 'absolute', top: '2px', left: settings.cta ? '18px' : '2px', width: '16px', height: '16px', background: '#fff', transition: 'left 0.2s' }} />
            </button>
          </div>
          {/* Watermark */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
            <div><div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>Watermark</div><div style={{ fontSize: '11px', color: '#888' }}>AI ile üretildi işareti</div></div>
            <button onClick={() => handleSettingsChange({ ...settings, watermark: !settings.watermark })}
              style={{ width: '36px', height: '20px', border: 'none', cursor: 'pointer', background: settings.watermark ? '#22c55e' : '#ddd', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <span className="dot" style={{ position: 'absolute', top: '2px', left: settings.watermark ? '18px' : '2px', width: '16px', height: '16px', background: '#fff', transition: 'left 0.2s' }} />
            </button>
          </div>
        </div>
      )}

      </div>

      {msg && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid #ef4444', fontSize: '12px', color: '#0a0a0a', marginBottom: '12px' }}>{msg}<button onClick={() => setMsg('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>×</button></div>}

      {/* VERSION LIST (AI Express pattern) */}
      <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px 24px', marginBottom: '16px' }}>
        {ugcVideos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontSize: '13px' }}>Henüz video üretilmedi. Yukarıdan persona seçin, metin oluşturun ve üretin.</div>
        )}

        {ugcVideos.map((video, idx) => {
          const hasVideo = !!video.final_url
          const isPurchased = video.status === 'sold'
          const isFailed = video.status === 'failed' && !isPurchased
          const isProcessing = video.status === 'queued' || video.status === 'generating'
          const personaName = video.personas?.name || personas.find(p => p.id === video.persona_id)?.name || ''
          const personaSlug = video.personas?.slug || personas.find(p => p.id === video.persona_id)?.slug || ''
          const versionLabel = `V${idx + 1}`
          const lastFb = feedbacks.find(f => f.video_version === versionLabel)
          const isEditingFb = editingFeedback[video.id] || !lastFb
          const currentFbText = feedbackText[video.id] ?? ''

          return (
            <div key={video.id} ref={el => { videoCardRefs.current[video.id] = el }} style={{ display: 'flex', gap: '14px', padding: '14px', marginBottom: '8px', border: highlightId === video.id ? '2px solid #22c55e' : '1px solid var(--color-border-tertiary)', background: '#fff', alignItems: 'flex-start', transition: 'all 0.3s' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-background-secondary)' }} onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}>
              {/* Video */}
              <div style={{ width: '200px', aspectRatio: '9/16', background: '#0a0a0a', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                {isFailed ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#1a1a1a' }}>
                    <span style={{ fontSize: '20px', color: '#555' }}>&#9888;</span>
                    <span style={{ fontSize: '10px', color: '#999' }}>Üretilemedi</span>
                  </div>
                ) : hasVideo ? (
                  <>
                    <video src={video.final_url} controls preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'black' }} onPlay={e => { pauseOtherVideos(e.currentTarget); markUgcVideoViewed(video.id) }} />
                    {!isPurchased && <img src="/dinamo_logo.png" alt="" style={{ position: 'absolute', top: '14px', left: '14px', width: '60px', opacity: 0.65, pointerEvents: 'none' }} />}
                  </>
                ) : isProcessing ? (
                  <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#ebe9e3' }}>
                    <video src="/videos/dinamo_static_progress.mp4" autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1 }} />
                    <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <img src="/dinamo_logo.png" alt="" style={{ width: '115px', objectFit: 'contain', display: 'block', animation: 'pulse 1.8s ease-in-out infinite' }} />
                      <div style={{ fontSize: '10px', fontWeight: '500', letterSpacing: '0.1em', color: '#fff', marginTop: '2px', animation: 'pulse 1.5s ease infinite' }}>ÇALIŞIYOR</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '20px', color: '#555' }}>&#9888;</span>
                    <span style={{ fontSize: '10px', color: '#999' }}>Üretilemedi</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{versionLabel}</span>
                  {personaName && <span style={{ fontSize: '10px', padding: '2px 8px', background: '#1DB81D', color: '#fff', letterSpacing: '0.5px', fontWeight: 600, textTransform: 'uppercase' }}>{personaName}</span>}
                  {video.settings_snapshot && (() => { const s = video.settings_snapshot; const badges: string[] = []; if (s.tone) badges.push(s.tone.toUpperCase()); if (s.cta) badges.push('CTA'); if (s.watermark) badges.push('WATERMARK'); return badges.map((b: string) => <span key={b} style={{ fontSize: '9px', padding: '2px 6px', background: '#f5f4f0', color: '#888', letterSpacing: '0.5px', fontWeight: 600 }}>{b}</span>) })()}
                  {isPurchased && <span style={{ fontSize: '9px', color: '#1DB81D', fontWeight: '600' }}>&#10003; Satın Alındı</span>}
                  {isProcessing && <span style={{ fontSize: '9px', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span className="dot" style={{ width: '6px', height: '6px', background: '#3b82f6', display: 'inline-block', animation: 'pulse 1.5s ease infinite' }} /><span style={{ color: '#0a0a0a' }}>Üretiliyor</span> <span style={{ color: '#6b6b66' }}>(~3 dakika)</span></span>}
                  {isFailed && <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: '500' }}>Başarısız</span>}
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px' }}>
                  {new Date(video.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {!isFailed && video.completed_at && <><span style={{ margin: '0 8px', color: '#ccc' }}>|</span><span style={{ color: '#aaa' }}>{formatDuration(video.created_at, video.completed_at)}</span></>}
                </div>

                {/* Feedback summary */}
                {video.feedback_summary && (
                  <div style={{ fontFamily: "'JetBrains Mono','Menlo','Monaco',monospace", fontSize: '11px', color: '#3a3a3a', borderLeft: '2px solid #d4d2cc', paddingLeft: '18px', paddingTop: '8px', paddingBottom: '8px', marginBottom: '8px', lineHeight: 1.6, letterSpacing: '-0.01em' }}>
                    {video.feedback_summary}<span style={{ display: 'inline-block', marginLeft: '2px', color: '#6b6b66', animation: 'blink 1s steps(1) infinite' }}>▊</span>
                  </div>
                )}

                {/* Failed actions */}
                {isFailed && (
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                    <button onClick={() => handleRetry(video)} disabled={retryingId === video.id} style={{ padding: '5px 12px', background: '#0a0a0a', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '500', cursor: retryingId === video.id ? 'not-allowed' : 'pointer', opacity: retryingId === video.id ? 0.5 : 1 }}>{retryingId === video.id ? 'Üretiliyor...' : 'Tekrar Dene'}</button>
                  </div>
                )}

                {/* Actions for completed video */}
                {hasVideo && !isFailed && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {isPurchased ? (
                      <>
                        <button onClick={() => downloadFile(video.final_url, `dinamo_${brandSlug}_ugc_${personaSlug}_v${idx + 1}.mp4`)} style={{ fontSize: '11px', color: '#0a0a0a', background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4 8l4 4 4-4" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/><path d="M2 13h12" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          İndir
                        </button>
                        <button onClick={() => generateUgcCertificatePDF(brief, clientUser?.clients?.company_name || '', personaName, clientUser?.clients?.legal_name)} style={{ fontSize: '11px', color: '#555', background: 'none', border: '0.5px solid rgba(0,0,0,0.12)', padding: '5px 12px', cursor: 'pointer' }}>Telif Belgesi</button>
                        {video.static_images_url && /\.(png|jpg|jpeg|webp)$/i.test(video.static_images_url) ? (
                          <button onClick={() => downloadFile(video.static_images_url, `${(brief?.campaign_name || 'brief').replace(/\s+/g, '_').toLowerCase()}_persona_v${idx + 1}.png`)} style={{ fontSize: '11px', color: '#0a0a0a', background: 'none', border: '1px solid #0a0a0a', padding: '5px 12px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' }}>GÖRSEL İNDİR ↓</button>
                        ) : (
                          <button onClick={() => setStaticImageModal({ briefId, videoUrl: video.raw_video_url || video.final_url, ugcVideoId: video.id })} style={{ fontSize: '11px', color: '#0a0a0a', background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', padding: '5px 12px', cursor: 'pointer' }}>Görsel Oluştur</button>
                        )}
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
                {hasVideo && !isFailed && (
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
                          placeholder="Yorum / revizyon yazın, bir sonraki üretiminiz daha iyi olsun."
                          rows={3}
                          style={{ flex: 1, padding: '12px 14px', border: '0.5px solid rgba(0,0,0,0.1)', fontSize: '11px', color: '#0a0a0a', resize: 'vertical', boxSizing: 'border-box' }}
                        />
                        <button onClick={() => saveFeedback(video.id, versionLabel, personaSlug)} style={{ padding: '8px 14px', background: '#0a0a0a', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap', height: '36px' }}>Kaydet</button>
                      </div>
                    )}
                  </div>
                )}

                {/* Lock appearance toggle — anchor based */}
                {hasVideo && !isFailed && (() => {
                  const isAnchor = brief?.locked_anchor_video_id === video.id
                  return (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fff', border: '1px solid #e5e4db', maxWidth: '280px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', color: isAnchor ? '#0a0a0a' : '#3a3a3a' }}>BU TİPİ FİKSLE</span>
                      <button onClick={async () => {
                        await fetch('/api/ugc/lock-appearance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, video_id: video.id, locked: !isAnchor }) })
                        const { data: fb } = await supabase.from('briefs').select('locked_persona_appearance, locked_anchor_video_id, locked_anchor_persona_id').eq('id', briefId).single()
                        if (fb) setBrief((prev: any) => ({ ...prev, ...fb }))
                      }} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: isAnchor ? '#22c55e' : '#d4d2cc', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                        <span className="dot" style={{ position: 'absolute', top: '2px', left: isAnchor ? '22px' : '2px', width: '20px', height: '20px', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                      </button>
                    </div>
                  )
                })()}
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
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                  <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#22c55e', fontWeight: '500', visibility: isRecommended ? 'visible' : 'hidden' }}>ÖNERİLEN PERSONA</div>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: scriptText.length > 160 ? '#ef4444' : scriptText.length >= 155 ? '#f59e0b' : scriptText.length >= 140 ? '#22c55e' : scriptText.length >= 110 ? '#f59e0b' : '#888' }}>{scriptText.length} / {UGC_MAX_CHARS}</span>
                </div>
                <div style={{ display: 'flex', gap: '30px', alignItems: 'stretch' }}>
                  {/* Left: persona image */}
                  <div style={{ width: '210px', flexShrink: 0 }}>
                    <div style={{ position: 'relative', width: '210px', height: '100%', minHeight: '280px', background: '#f5f4f0', overflow: 'hidden', opacity: personaFading ? 0 : 1, transition: 'opacity 300ms ease-in-out' }}>
                      {p.thumbnail_url ? <img src={p.thumbnail_url} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: '52px', color: '#ccc' }}>{p.name[0]}</span>}
                      <span className="rounded-br" style={{ position: 'absolute', top: 0, left: 0, fontSize: '11px', fontWeight: '700', color: '#0a0a0a', background: 'rgba(255,255,255,0.95)', padding: '5px 11px', textTransform: 'uppercase' }}>{p.name}</span>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5), rgba(0,0,0,0))', padding: '24px 12px 10px' }}>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.85)', letterSpacing: '0.01em', lineHeight: 1.4 }}>{p.description}</div>
                      </div>
                    </div>
                  </div>
                  {/* Right: script + generate */}
                  {generating ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 0' }}>
                      <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderStyle: 'solid', borderColor: '#3b82f6 transparent transparent transparent' }} />
                      <span style={{ fontSize: '12px', color: '#888' }}>Üretim başlatılıyor...</span>
                    </div>
                  ) : (
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <textarea value={scriptText} onChange={e => { if (e.target.value.length <= UGC_MAX_CHARS) setScriptText(e.target.value) }} onBlur={() => { if (!selectedPersona || scriptText === readScript(ugcScripts, selectedPersona)) return; const updated = { ...ugcScripts, [String(selectedPersona)]: scriptText }; setUgcScripts(updated); persistUgcScripts(updated) }} placeholder={scriptLoading ? 'Üretiliyor...' : 'Bu persona için konuşma metni henüz üretilmedi. Butona basın veya buraya yazın.'} style={{ width: '100%', flex: 1, minHeight: '80px', fontSize: '22px', color: '#0a0a0a', lineHeight: 1.5, border: '1px solid #e5e4db', padding: '10px 12px', resize: 'none', boxSizing: 'border-box' }} />
                      {(() => {
                        const isTextEmpty = !scriptText.trim()
                        const isLoading = scriptLoading || generating
                        const completedCount = ugcVideos.filter(v => v.status !== 'failed').length
                        const label = isLoading ? 'ÜRETİLİYOR...' : isTextEmpty ? 'KONUŞMA METNİ YAZ' : (completedCount === 0 ? 'ÜRET (ÜCRETSİZ · ~3 DAKİKA)' : 'ÜRET (1 KREDİ · ~3 DAKİKA)')
                        const disabled = isLoading || !selectedPersona || (!isTextEmpty && (clientUser?.allocated_credits || 0) < 1)
                        const onClick = async () => {
                          if (isTextEmpty) {
                            if (!selectedPersona) return
                            setScriptLoading(true)
                            try {
                              const res = await fetch('/api/ugc/generate-script', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, persona_id: selectedPersona, use_product: false, settings, previous_feedbacks: feedbacks }) })
                              const data = await res.json()
                              if (data.dialogue) { setScriptText(data.dialogue); setChangesSummary(data.changes_summary || ''); const updated = { ...ugcScripts, [String(selectedPersona)]: data.dialogue }; setUgcScripts(updated); persistUgcScripts(updated) }
                              else { setMsg(data.error || 'Script üretilemedi') }
                            } catch { setMsg('Bağlantı hatası') }
                            setScriptLoading(false)
                          } else {
                            if (scriptText.length < 100) { setShortTextWarning(true) } else { handleGenerate() }
                          }
                        }
                        return (
                          <>
                            <button onClick={onClick} disabled={disabled} style={{ width: '100%', padding: '12px', marginTop: '10px', background: disabled ? '#ccc' : '#0a0a0a', color: '#fff', border: 'none', fontSize: '13px', fontWeight: '600', cursor: disabled ? 'default' : 'pointer', flexShrink: 0 }}>{label}</button>
                          </>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </>
            )
          })()}

          {/* Persona selection row */}
          <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a0a09a', marginBottom: '12px', marginTop: '20px', fontWeight: '500', transition: 'opacity 0.2s', minHeight: '15px' }}>{hoveredPersona ? hoveredPersona.toUpperCase() : 'PERSONA SEÇ'}</div>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', overflowY: 'visible', padding: '10px 0' }}>
            {personas.map(p => (
              <div key={p.id} title={p.name} onClick={() => { if (p.id === selectedPersona) return; setPersonaFading(true); setTimeout(() => { setSelectedPersona(p.id); setScriptText(readScript(ugcScripts, p.id)); supabase.from('briefs').update({ ugc_selected_persona_id: p.id }).eq('id', briefId); setPersonaFading(false) }, 150) }} style={{ flexShrink: 0, cursor: 'pointer', opacity: selectedPersona === p.id ? 1 : 0.6, transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)'; setHoveredPersona(p.name) }} onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; setHoveredPersona(null) }}>
                <div className="dot" style={{ width: '52px', height: '52px', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', border: selectedPersona === p.id ? '2px solid #3b82f6' : '1px solid #e5e4db', overflow: 'hidden', transition: 'border-color 0.15s' }}>
                  {p.thumbnail_url ? <img src={p.thumbnail_url} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} className="dot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.name[0]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>



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
      {staticImageModal && (
        <StaticImageGeneratorModal
          briefId={staticImageModal.briefId}
          videoUrl={staticImageModal.videoUrl}
          ugcVideoId={staticImageModal.ugcVideoId}
          existingUrl={ugcVideos.find(v => v.id === staticImageModal.ugcVideoId)?.static_images_url || null}
          fileName={`${(brief?.campaign_name || 'brief').replace(/\s+/g, '_').toLowerCase()}_persona_gorsel.png`}
          onClose={() => setStaticImageModal(null)}
          onGenerated={(url: string) => {
            if (staticImageModal?.ugcVideoId) {
              setUgcVideos(prev => prev.map(v => v.id === staticImageModal.ugcVideoId ? { ...v, static_images_url: url } : v))
            }
          }}
        />
      )}
    </div>
  )
}
