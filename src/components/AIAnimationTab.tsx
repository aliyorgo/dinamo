'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { downloadFile } from '@/lib/download-helper'
import { pauseOtherVideos } from '@/lib/video-playback'
import { generateCertificatePDF } from '@/lib/generate-certificate'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface Props { briefId: string; brief: any; clientUser: any; autoPlayVideoId?: string; onVideoCountChange?: (count: number) => void }

const STAGES = [
  { key: 'concept', label: 'Senaryo hazırlanıyor', duration: 15 },
  { key: 'generating', label: 'Animasyon üretiliyor', duration: 120 },
  { key: 'voiceover', label: 'Seslendirme ekleniyor', duration: 20 },
  { key: 'finalizing', label: 'Son dokunuşlar', duration: 15 },
]

function formatDuration(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start || !end) return null
  const s = new Date(start.endsWith('Z') ? start : start + 'Z').getTime()
  const e = new Date(end.endsWith('Z') ? end : end + 'Z').getTime()
  if (isNaN(s) || isNaN(e)) return null
  const sec = Math.round((e - s) / 1000)
  if (sec <= 0) return null
  return sec < 60 ? `${sec} sn'de uretildi` : `${Math.floor(sec / 60)} dk'da uretildi`
}

export default function AIAnimationTab({ briefId, brief, clientUser, autoPlayVideoId, onVideoCountChange }: Props) {
  const [styles, setStyles] = useState<any[]>([])
  const [hasMascot, setHasMascot] = useState(false)
  const [mascotIcons, setMascotIcons] = useState<Record<string, string | null>>({})

  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [voiceoverText, setVoiceoverText] = useState('')
  const [voiceoverLoading, setVoiceoverLoading] = useState(false)
  const [animationVideos, setAnimationVideos] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [timerStageMap, setTimerStageMap] = useState<Record<string, number>>({})
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({})
  const [editingFeedback, setEditingFeedback] = useState<Record<string, boolean>>({})
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [hoveredStyle, setHoveredStyle] = useState<string | null>(null)
  const [styleFading, setStyleFading] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [animSettings, setAnimSettings] = useState<{ logo_enabled: boolean; cta_enabled: boolean; packshot_enabled: boolean }>({ logo_enabled: true, cta_enabled: true, packshot_enabled: false })
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [suggestedSlug, setSuggestedSlug] = useState<string | null>(null)
  const suggestedRef = useRef(false)
  const videoCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const autoScrolledRef = useRef(false)

  useEffect(() => { loadData() }, [briefId])

  useEffect(() => {
    const count = animationVideos.filter(v => v.status !== 'failed').length
    onVideoCountChange?.(count)
  }, [animationVideos])

  // Polling
  const hasProcessing = animationVideos.some(v => v.status === 'queued' || v.status === 'generating')
  useEffect(() => {
    if (!hasProcessing) return
    const poll = setInterval(async () => {
      const { data } = await supabase.from('animation_videos').select('*, animation_styles(label, icon_path)').eq('brief_id', briefId).order('created_at', { ascending: true })
      if (data) setAnimationVideos(data)
    }, 8000)
    return () => clearInterval(poll)
  }, [hasProcessing])

  // Timer stages
  useEffect(() => {
    const processing = animationVideos.filter(v => v.status === 'queued' || v.status === 'generating')
    if (!processing.length) return
    setTimerStageMap(prev => { const n = { ...prev }; processing.forEach(v => { if (!(v.id in n)) n[v.id] = 0 }); return n })
    const timers: ReturnType<typeof setTimeout>[] = []
    processing.forEach(v => { let c = 0; STAGES.forEach((s, si) => { if (!si) return; c += STAGES[si-1].duration*1000; timers.push(setTimeout(() => setTimerStageMap(p => ({...p,[v.id]:si})), c)) }) })
    return () => timers.forEach(clearTimeout)
  }, [animationVideos.filter(v => v.status === 'queued' || v.status === 'generating').map(v => v.id).join(',')])

  // Auto-scroll + autoplay from dashboard click (Persona pattern)
  useEffect(() => {
    if (!autoPlayVideoId || autoScrolledRef.current || loading) return
    const el = videoCardRefs.current[autoPlayVideoId]
    if (!el) return
    autoScrolledRef.current = true
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const vid = el.querySelector('video')
      if (vid) vid.play().catch(() => {})
    }, 300)
  }, [autoPlayVideoId, loading, animationVideos])

  async function loadData() {
    setLoading(true)
    const [stylesRes, { data: videos }, { data: fb }] = await Promise.all([
      fetch(`/api/animation/styles?client_id=${brief?.client_id || ''}`).then(r => r.json()),
      supabase.from('animation_videos').select('*, animation_styles(label, icon_path)').eq('brief_id', briefId).order('created_at', { ascending: true }),
      supabase.from('briefs').select('animation_feedbacks, last_animation_style, last_animation_voiceover, animation_settings').eq('id', briefId).single(),
    ])
    setStyles(stylesRes.styles || [])
    setHasMascot(stylesRes.hasMascot || false)
    setMascotIcons(stylesRes.mascotIcons || {})
    setAnimationVideos(videos || [])
    setFeedbacks(fb?.animation_feedbacks || [])
    if (fb?.animation_settings) setAnimSettings({ logo_enabled: true, cta_enabled: true, packshot_enabled: false, ...fb.animation_settings })

    const stickyStyle = fb?.last_animation_style
    const stickyVoiceover = fb?.last_animation_voiceover

    console.log('[STICKY DEBUG]', { stickyStyle, stickyVoiceover, fbKeys: fb ? Object.keys(fb) : 'null', rawFb: JSON.stringify(fb).substring(0, 300) })

    // Sticky read: both exist → use cached, skip Claude (Persona pattern)
    if (stickyStyle && stickyVoiceover) {
      setSelectedStyle(stickyStyle)
      setSuggestedSlug(stickyStyle)
      setVoiceoverText(stickyVoiceover)
      suggestedRef.current = true
      setLoading(false)
      return
    }

    if (stickyStyle) setSelectedStyle(stickyStyle)
    setLoading(false)

    // No sticky → Claude suggest (first time only)
    if (!suggestedRef.current && (stylesRes.styles || []).length > 0) {
      suggestedRef.current = true
      setSuggestLoading(true)
      try {
        const sr = await fetch('/api/animation/suggest-style', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId }) })
        const sd = await sr.json()
        if (sd.suggestedStyleSlug) {
          setSuggestedSlug(sd.suggestedStyleSlug)
          if (!stickyStyle) setSelectedStyle(sd.suggestedStyleSlug)
          // Persist sticky — only write voiceover if truthy
          const persistUpdate: any = { last_animation_style: sd.suggestedStyleSlug }
          if (sd.voiceoverText) persistUpdate.last_animation_voiceover = sd.voiceoverText
          await supabase.from('briefs').update(persistUpdate).eq('id', briefId)
        }
        if (sd.voiceoverText) setVoiceoverText(sd.voiceoverText)
      } catch {}
      setSuggestLoading(false)
    }
  }

  async function persistSticky(style?: string, voiceover?: string) {
    const updates: any = {}
    if (style !== undefined) updates.last_animation_style = style
    if (voiceover !== undefined) updates.last_animation_voiceover = voiceover
    if (Object.keys(updates).length > 0) {
      console.log('[STICKY WRITE]', { briefId, updates })
      const { error } = await supabase.from('briefs').update(updates).eq('id', briefId)
      if (error) console.error('[STICKY WRITE ERROR]', error)
    }
  }

  async function handleGenerateVoiceover() {
    if (!selectedStyle || voiceoverLoading) return
    setVoiceoverLoading(true)
    try {
      const res = await fetch('/api/animation/generate-voiceover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, style_slug: selectedStyle }) })
      const data = await res.json()
      if (data.voiceoverText) { setVoiceoverText(data.voiceoverText); persistSticky(undefined, data.voiceoverText) }
    } catch {}
    setVoiceoverLoading(false)
  }

  async function handleGenerate() {
    if (generating || !selectedStyle || !voiceoverText.trim()) return
    setGenerating(true); setMsg('')
    try {
      const res = await fetch('/api/animation/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, style_slug: selectedStyle, client_user_id: clientUser?.id, voiceover_text: voiceoverText.trim() }) })
      const data = await res.json()
      if (data.error) { setMsg(data.error); setGenerating(false); return }
      if (data.animation_video_id) {
        const si = styles.find(s => s.slug === selectedStyle)
        setAnimationVideos(prev => [...prev, { id: data.animation_video_id, status: 'queued', style_slug: selectedStyle, version: data.version, animation_styles: si ? { label: si.label, icon_path: si.icon_path } : null, created_at: new Date().toISOString() }])
        setHighlightId(data.animation_video_id); setTimeout(() => setHighlightId(null), 1500)
      }
    } catch { setMsg('Bağlantı hatası') }
    setGenerating(false)
  }

  async function handlePurchase(vid: string) {
    if (purchasing) return; setPurchasing(vid)
    try {
      const res = await fetch('/api/animation/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ animation_video_id: vid }) })
      const d = await res.json()
      if (d.error) setMsg(d.error); else setAnimationVideos(prev => prev.map(v => v.id === vid ? { ...v, status: 'sold' } : v))
    } catch { setMsg('Bağlantı hatası') }
    setPurchasing(null)
  }

  async function handleRetry(vid: string) {
    try { await fetch('/api/animation/retry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ animation_video_id: vid }) }); setAnimationVideos(prev => prev.map(v => v.id === vid ? { ...v, status: 'queued', error_message: null, final_url: null } : v)) } catch {}
  }

  async function saveFeedback(vid: string, vLabel: string, styleSlug: string) {
    const val = feedbackText[vid]?.trim(); if (!val) return
    const entry = { video_version: vLabel, style_slug: styleSlug, feedback: val, created_at: new Date().toISOString() }
    const ex = [...feedbacks]; const idx = ex.findIndex(f => f.video_version === vLabel)
    if (idx >= 0) ex[idx] = entry; else ex.push(entry)
    await supabase.from('briefs').update({ animation_feedbacks: ex }).eq('id', briefId)
    setFeedbacks(ex); setEditingFeedback(prev => ({ ...prev, [vid]: false })); setFeedbackText(prev => ({ ...prev, [vid]: '' }))
    // Brand learning (Express pattern — 20+ karakter)
    if (val.length > 20 && brief?.client_id) {
      fetch('/api/brand-learning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: brief.client_id, sourceType: 'feedback', sourceId: vid, text: val }) }).catch(() => {})
    }
  }

  async function markViewed(videoId: string) {
    await supabase.from('animation_videos').update({ viewed_at: new Date().toISOString() }).eq('id', videoId).is('viewed_at', null)
  }

  function toggleAnimSetting(key: 'logo_enabled' | 'cta_enabled' | 'packshot_enabled') {
    setAnimSettings(prev => {
      const next = { ...prev, [key]: !prev[key] }
      if (key === 'packshot_enabled' && next.packshot_enabled) next.logo_enabled = false
      if (key === 'logo_enabled' && next.logo_enabled) next.packshot_enabled = false
      supabase.from('briefs').update({ animation_settings: next }).eq('id', briefId)
      setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 1500)
      return next
    })
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#888', fontSize: '13px' }}>Yükleniyor...</div>

  const totalCount = animationVideos.filter(v => v.status !== 'failed').length
  const soldCount = animationVideos.filter(v => v.status === 'sold').length
  const totalCreditsUsed = animationVideos.reduce((s, v) => s + (v.credit_cost_generate || 0), 0) + soldCount
  const credits = clientUser?.allocated_credits || 0
  const selectedStyleInfo = styles.find(s => s.slug === selectedStyle)
  const wordCount = voiceoverText.trim().split(/\s+/).filter(Boolean).length
  const getStyleIcon = (s: any) => mascotIcons[s.slug] || s.icon_path

  return (
    <div>
      {/* HEADER — Express pattern */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={() => { setInfoOpen(p => !p); setSettingsOpen(false) }} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', border: '1px solid #e5e4db', background: infoOpen ? '#f5f4f0' : '#fff', fontSize: '11px', color: '#555', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>Bilgi
          </button>
          <button onClick={() => { setSettingsOpen(p => !p); setInfoOpen(false) }} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', border: '1px solid #e5e4db', background: settingsOpen ? '#f5f4f0' : '#fff', fontSize: '11px', color: '#555', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>Ayarlar
          </button>
          {settingsSaved && <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: '500' }}>Kaydedildi</span>}
        </div>
        <div style={{ display: 'inline-flex', padding: '6px 14px', border: '1px solid #0a0a0a', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: totalCreditsUsed > 0 ? '#0a0a0a' : '#9ca3af', flexShrink: 0, whiteSpace: 'nowrap' }}>{totalCreditsUsed} KREDi</div>
      </div>

      {/* INFO PANEL — Express pattern */}
      {infoOpen && (
        <div style={{ background: '#f9f7f3', border: '1px solid #e5e4db', padding: '20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a' }}>AI Animation Hakkında</div>
            <button onClick={() => setInfoOpen(false)} style={{ width: '24px', height: '24px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => { e.currentTarget.style.color = '#0a0a0a' }} onMouseLeave={e => { e.currentTarget.style.color = '#888' }}>×</button>
          </div>
          <div style={{ fontSize: '13px', color: '#333', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 12px' }}>AI Animation ile brief'inize göre farklı animasyon stillerinde 15 saniyelik videolar üretin. Deneysel bir özelliktir — sonuçlar garanti edilmez.</p>
            <p style={{ margin: '0 0 12px' }}>Stil, dış ses ve görseller tamamen brief'inizden yola çıkarak yapay zeka tarafından üretilmektedir. Maskot yüklü markalarda maskot karakterinizle özelleştirilmiş animasyonlar oluşturulabilir.</p>
            <p style={{ margin: '0 0 12px' }}>Dinamo sadece marka bilgileri ile AI prompt'larına müdahale eder.</p>
            <p style={{ margin: 0 }}>Önerilen stil ve dış ses metnini Claude otomatik üretir, dilediğiniz gibi değiştirebilirsiniz.</p>
          </div>
        </div>
      )}

      {/* SETTINGS PANEL — Express pattern */}
      {settingsOpen && (
        <div style={{ background: '#f9f7f3', border: '1px solid #e5e4db', padding: '20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a' }}>AI Animation Ayarları{settingsSaved && <span style={{ fontSize: '11px', color: '#22c55e', marginLeft: '12px', fontWeight: '500' }}>✓ Kaydedildi</span>}</div>
            <button onClick={() => setSettingsOpen(false)} style={{ width: '24px', height: '24px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => { e.currentTarget.style.color = '#0a0a0a' }} onMouseLeave={e => { e.currentTarget.style.color = '#888' }}>×</button>
          </div>
          {[
            { key: 'logo_enabled' as const, title: 'Logo', desc: 'Video sonunda marka logosu göster' },
            { key: 'cta_enabled' as const, title: 'CTA', desc: 'Video sonunda CTA yazısı göster' },
            { key: 'packshot_enabled' as const, title: 'Packshot', desc: 'Video sonuna packshot ekle' },
          ].map(item => (
            <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: item.key !== 'packshot_enabled' ? '1px solid #e5e4db' : 'none' }}>
              <div><div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{item.title}</div><div style={{ fontSize: '11px', color: '#888' }}>{item.desc}</div></div>
              <button onClick={() => toggleAnimSetting(item.key)} style={{ width: '36px', height: '20px', border: 'none', cursor: 'pointer', background: animSettings[item.key] ? '#22c55e' : '#ddd', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <span className="dot" style={{ position: 'absolute', top: '2px', left: animSettings[item.key] ? '18px' : '2px', width: '16px', height: '16px', background: '#fff', transition: 'left 0.2s' }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {msg && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid #ef4444', fontSize: '12px', color: '#0a0a0a', marginBottom: '12px' }}>{msg}<button onClick={() => setMsg('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>x</button></div>}

      {/* VIDEO LIST */}
      <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px 24px', marginBottom: '16px' }}>
        {animationVideos.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontSize: '13px' }}>Henüz video üretilmedi. Aşağıdan stil seçin, metin oluşturun ve üretin.</div>}
        {animationVideos.map((video, idx) => {
          const hasVideo = !!video.final_url; const isPurchased = video.status === 'sold'; const isFailed = video.status === 'failed'
          const isProcessing = video.status === 'queued' || video.status === 'generating'
          const styleLabel = video.animation_styles?.label || video.style_slug
          const vLabel = `V${video.version || idx + 1}`
          const lastFb = feedbacks.find((f: any) => f.video_version === vLabel)
          const stageIdx = timerStageMap[video.id] || 0; const stage = STAGES[stageIdx]

          return (
            <div key={video.id} ref={el => { videoCardRefs.current[video.id] = el }} style={{ display: 'flex', gap: '14px', padding: '14px', marginBottom: '8px', border: highlightId === video.id ? '2px solid #22c55e' : '1px solid var(--color-border-tertiary)', background: '#fff', alignItems: 'flex-start', transition: 'all 0.3s' }}>
              {/* Preview — Express pattern */}
              <div style={{ width: '200px', aspectRatio: (brief?.format || '9:16').replace(':', '/'), background: '#0a0a0a', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                {isFailed ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#1a1a1a' }}>
                    <span style={{ fontSize: '20px', color: '#555' }}>&#9888;</span>
                    <span style={{ fontSize: '10px', color: '#999', fontWeight: '500' }}>Uretilemedi</span>
                    <span style={{ fontSize: '8px', color: '#555' }}>Gecici sistem hatasi</span>
                  </div>
                ) : hasVideo ? (
                  <>
                    <video src={video.final_url} controls preload="metadata" onPlay={e => { pauseOtherVideos(e.currentTarget); markViewed(video.id) }} style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'black' }} />
                    {!isPurchased && <img src="/dinamo_logo.png" alt="" style={{ position: 'absolute', top: '14px', left: '14px', width: '60px', opacity: 0.65, pointerEvents: 'none' }} />}
                  </>
                ) : isProcessing ? (
                  <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#ebe9e3' }}>
                    <video src="/videos/dinamo_static_progress.mp4" autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1 }} />
                    <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <img src="/dinamo_logo.png" alt="" style={{ width: '115px', objectFit: 'contain', display: 'block', animation: 'pulse 1.8s ease-in-out infinite' }} />
                      <div style={{ fontSize: '10px', fontWeight: '500', letterSpacing: '0.1em', color: '#fff', marginTop: '2px', animation: 'pulse 1.5s ease infinite' }}>CALISIYOR</div>
                    </div>
                  </div>
                ) : null}
              </div>
              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>{vLabel}</span>
                  <span style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(139,92,246,0.08)', color: '#8b5cf6', fontWeight: '500', textTransform: 'uppercase' }}>{styleLabel}</span>
                  {isPurchased && <span style={{ fontSize: '9px', color: '#1DB81D', fontWeight: '600' }}>&#10003; Satin Alindi</span>}
                  {isProcessing && <span style={{ fontSize: '9px', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span className="dot" style={{ width: '6px', height: '6px', background: '#4ade80', display: 'inline-block', animation: 'pulse 1.5s ease infinite' }} /><span style={{ color: '#0a0a0a' }}>Uretiliyor</span> <span style={{ color: '#6b6b66' }}>(~5 dakika)</span></span>}
                  {isFailed && <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: '500' }}>Basarisiz</span>}
                </div>
                {(() => { const dur = formatDuration(video.generating_started_at || video.created_at, video.completed_at); return dur ? <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '6px' }}>{dur}</div> : null })()}
                {video.feedback_summary && <div style={{ fontFamily: "'JetBrains Mono','Menlo','Monaco',monospace", fontSize: '11px', color: '#3a3a3a', borderLeft: '2px solid #d4d2cc', paddingLeft: '18px', paddingTop: '8px', paddingBottom: '8px', marginBottom: '8px', lineHeight: 1.6, letterSpacing: '-0.01em' }}>{video.feedback_summary}</div>}
                {/* Retry — failed */}
                {isFailed && (
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                    <button onClick={() => handleRetry(video.id)} style={{ padding: '5px 12px', background: '#0a0a0a', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>Tekrar Dene</button>
                  </div>
                )}
                {/* Purchase / Download / Certificate */}
                {hasVideo && !isFailed && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {isPurchased ? (
                      <>
                        <button onClick={() => downloadFile(video.final_url, `dinamo_animation_${video.style_slug}_v${video.version}.mp4`)} style={{ fontSize: '11px', color: '#0a0a0a', background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4 8l4 4 4-4" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/><path d="M2 13h12" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/></svg> Indir
                        </button>
                        <button onClick={() => generateCertificatePDF(brief, brief?.clients?.company_name || '', brief?.clients?.legal_name)} style={{ fontSize: '11px', color: '#555', background: 'none', border: '0.5px solid rgba(0,0,0,0.12)', padding: '5px 12px', cursor: 'pointer' }}>Telif Belgesi</button>
                      </>
                    ) : (<><button onClick={() => handlePurchase(video.id)} disabled={purchasing === video.id || credits < 1} className="btn btn-accent" style={{ padding: '6px 16px' }}>SATIN AL</button><span style={{ fontSize: '13px', color: '#888' }}>1 kredi</span></>)}
                  </div>
                )}
                {/* Feedback — hasVideo based (Express pattern, not isPurchased) */}
                {hasVideo && !isFailed && (
                  <div style={{ marginTop: '10px' }}>
                    {(editingFeedback[video.id] || !lastFb) ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
                        <textarea value={feedbackText[video.id] ?? ''} onChange={e => setFeedbackText(prev => ({ ...prev, [video.id]: e.target.value }))} placeholder="Yorum / revizyon yazin, bir sonraki uretiminiz daha iyi olsun." rows={3} style={{ flex: 1, padding: '12px 14px', border: '0.5px solid rgba(0,0,0,0.1)', fontSize: '11px', color: '#0a0a0a', resize: 'vertical', boxSizing: 'border-box' }} />
                        <button onClick={() => saveFeedback(video.id, vLabel, video.style_slug)} style={{ padding: '8px 14px', background: '#0a0a0a', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap', height: '36px' }}>Kaydet</button>
                      </div>
                    ) : lastFb ? (
                      <div style={{ fontSize: '11px', color: '#555', padding: '8px 10px', background: '#f5f4f0', lineHeight: 1.5 }}>
                        <span style={{ color: '#0a0a0a' }}>{lastFb.feedback}</span>
                        <span onClick={() => { setEditingFeedback(prev => ({ ...prev, [video.id]: true })); setFeedbackText(prev => ({ ...prev, [video.id]: lastFb.feedback })) }} style={{ marginLeft: '8px', fontSize: '10px', color: '#3b82f6', cursor: 'pointer' }}>Duzenle</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* SELECTED STYLE + VOICEOVER + GENERATE — Persona pattern */}
      <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px 24px' }}>
        {suggestLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100px', gap: '10px' }}>
            <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px', borderStyle: 'solid', borderColor: '#e5e4db #e5e4db #e5e4db #0a0a0a' }} />
            <span style={{ fontSize: '12px', color: '#888' }}>Brief'e uygun stil belirleniyor...</span>
          </div>
        ) : selectedStyleInfo ? (
          <div style={{ opacity: styleFading ? 0 : 1, transition: 'opacity 300ms ease-in-out' }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8b5cf6', fontWeight: '500', marginBottom: '10px', visibility: selectedStyle === suggestedSlug ? 'visible' : 'hidden' }}>ONERILEN ANIMASYON</div>
            <div style={{ display: 'flex', gap: '30px', alignItems: 'stretch', flexWrap: 'wrap' }}>
              {/* Left: style image — Persona pattern (210px, full height) */}
              <div style={{ width: '210px', flexShrink: 0 }}>
                <div style={{ position: 'relative', width: '210px', height: '210px', background: '#f5f4f0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {getStyleIcon(selectedStyleInfo) ? <img src={getStyleIcon(selectedStyleInfo)} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /> : <span style={{ fontSize: '52px', color: '#ccc' }}>{selectedStyleInfo.label?.[0]}</span>}
                  <span style={{ position: 'absolute', top: 0, left: 0, fontSize: '11px', fontWeight: '700', color: '#0a0a0a', background: 'rgba(255,255,255,0.95)', padding: '5px 11px' }}>{selectedStyleInfo.label}</span>
                  {selectedStyleInfo.description_tr && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5), rgba(0,0,0,0))', padding: '24px 12px 10px' }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.85)', letterSpacing: '0.01em', lineHeight: 1.4 }}>{selectedStyleInfo.description_tr}</div>
                    </div>
                  )}
                </div>
              </div>
              {/* Right: voiceover + generate */}
              {generating ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 0' }}>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderStyle: 'solid', borderColor: '#8b5cf6 transparent transparent transparent' }} />
                  <span style={{ fontSize: '12px', color: '#888' }}>Üretim başlatılıyor...</span>
                </div>
              ) : (
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <button onClick={handleGenerateVoiceover} disabled={voiceoverLoading || !selectedStyle} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '10px' }}>
                      {voiceoverLoading ? 'ÜRETİLİYOR...' : voiceoverText ? 'YENİ DIŞ SES METNİ YAZ' : 'DIŞ SES METNİ YAZ'}
                    </button>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: wordCount > 30 ? '#ef4444' : wordCount >= 25 ? '#22c55e' : wordCount >= 15 ? '#f59e0b' : '#888' }}>{wordCount} / 30</span>
                  </div>
                  <textarea value={voiceoverText} onChange={e => setVoiceoverText(e.target.value)} onBlur={() => { if (voiceoverText.trim()) persistSticky(undefined, voiceoverText.trim()) }} placeholder={voiceoverLoading ? 'Üretiliyor...' : 'Bu stil için dış ses metni henüz üretilmedi. DIŞ SES METNİ YAZ butonuna basın veya buraya yazın.'} style={{ width: '100%', flex: 1, minHeight: '80px', fontSize: '13px', color: '#0a0a0a', lineHeight: 1.6, border: '1px solid #e5e4db', padding: '10px 12px', resize: 'none', boxSizing: 'border-box' }} />
                  <button onClick={handleGenerate} disabled={generating || !selectedStyle || !voiceoverText.trim() || credits < 1} style={{ width: '100%', padding: '12px', marginTop: '10px', background: (generating || !selectedStyle || !voiceoverText.trim() || credits < 1) ? '#ccc' : '#0a0a0a', color: '#fff', border: 'none', fontSize: '13px', fontWeight: '600', cursor: (generating || !voiceoverText.trim()) ? 'default' : 'pointer' }}>
                    {totalCount === 0 ? 'ÜRET (ÜCRETSİZ)' : 'ÜRET (1 KREDİ)'}
                  </button>
                  <div style={{ fontSize: '13px', color: '#999', textAlign: 'center', marginTop: '6px' }}>~5 dakika</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontSize: '13px' }}>Aşağıdan bir stil seçin</div>
        )}

        {/* Style selection — single row: mascot (left, bigger) + regular (right) */}
        {(() => {
          const mascotStyles = styles.filter(s => s.requires_mascot_image)
          const regularStyles = styles.filter(s => !s.requires_mascot_image)
          const showMascotSection = hasMascot && mascotStyles.length > 0

          const styleClick = (slug: string) => { if (slug === selectedStyle) return; setStyleFading(true); setVoiceoverText(''); persistSticky(slug, ''); setTimeout(() => { setSelectedStyle(slug); setStyleFading(false) }, 150) }

          return (
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a0a09a', marginBottom: '12px', fontWeight: '500', minHeight: '15px' }}>
                {hoveredStyle ? hoveredStyle.toUpperCase() : 'ANİMASYON STİLİ SEC'}
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', overflowX: 'auto', overflowY: 'visible', padding: '10px 0 10px 24px' }}>
                {showMascotSection && mascotStyles.map(style => (
                  <div key={style.slug} title={style.label}
                    onClick={() => styleClick(style.slug)}
                    style={{ flexShrink: 0, cursor: 'pointer', opacity: selectedStyle === style.slug ? 1 : 0.6, transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)'; setHoveredStyle(style.label) }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; setHoveredStyle(null) }}>
                    <div className="dot" style={{ width: '52px', height: '52px', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: selectedStyle === style.slug ? '2px solid #8b5cf6' : '1px solid #e5e4db', overflow: 'hidden', transition: 'border-color 0.15s' }}>
                      {getStyleIcon(style) ? <img src={getStyleIcon(style)} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /> : <span style={{ fontSize: '18px', color: '#888' }}>{style.label?.[0]}</span>}
                    </div>
                  </div>
                ))}
                {showMascotSection && <div style={{ width: '0', height: '52px', borderLeft: '1px solid #e5e4db', flexShrink: 0, marginLeft: '18px', marginRight: '18px' }} />}
                {regularStyles.length > 0 ? regularStyles.map(style => (
                  <div key={style.slug} title={style.label}
                    onClick={() => styleClick(style.slug)}
                    style={{ flexShrink: 0, cursor: 'pointer', opacity: selectedStyle === style.slug ? 1 : 0.6, transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)'; setHoveredStyle(style.label) }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; setHoveredStyle(null) }}>
                    <div className="dot" style={{ width: '52px', height: '52px', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: selectedStyle === style.slug ? '2px solid #8b5cf6' : '1px solid #e5e4db', overflow: 'hidden', transition: 'border-color 0.15s' }}>
                      {getStyleIcon(style) ? <img src={getStyleIcon(style)} className="dot" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /> : <span style={{ fontSize: '14px', color: '#888' }}>{style.label?.[0]}</span>}
                    </div>
                  </div>
                )) : (
                  <div style={{ fontSize: '12px', color: '#aaa', padding: '10px 0' }}>Henüz stil atanmadi</div>
                )}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
