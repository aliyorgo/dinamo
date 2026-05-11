'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { downloadFile } from '@/lib/download-helper'
import { pauseOtherVideos } from '@/lib/video-playback'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface Props {
  briefId: string
  brief: any
  clientUser: any
  onVideoCountChange?: (count: number) => void
}

// Stage progression for loading UI
const ANIMATION_STAGES = [
  { key: 'concept', label: 'Senaryo hazırlanıyor', duration: 15 },
  { key: 'generating', label: 'Animasyon üretiliyor', duration: 100 },
  { key: 'voiceover', label: 'Seslendirme ekleniyor', duration: 20 },
  { key: 'finalizing', label: 'Son dokunuşlar', duration: 15 },
]

function formatDuration(start: string, end: string) {
  const s = new Date(start.endsWith('Z') ? start : start + 'Z').getTime()
  const e = new Date(end.endsWith('Z') ? end : end + 'Z').getTime()
  const sec = Math.round((e - s) / 1000)
  if (sec < 60) return `${sec} sn'de üretildi`
  return `${Math.floor(sec / 60)} dk'da üretildi`
}

export default function AIAnimationTab({ briefId, brief, clientUser, onVideoCountChange }: Props) {
  const [styles, setStyles] = useState<any[]>([])
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [animationVideos, setAnimationVideos] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [timerStageMap, setTimerStageMap] = useState<Record<string, number>>({})
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({})
  const [editingFeedback, setEditingFeedback] = useState<Record<string, boolean>>({})
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const videoCardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => { loadData() }, [briefId])

  // Notify parent of video count changes
  useEffect(() => {
    const count = animationVideos.filter(v => v.status !== 'failed').length
    onVideoCountChange?.(count)
  }, [animationVideos])

  // Global polling — processing videos
  const hasProcessing = animationVideos.some(v => v.status === 'queued' || v.status === 'generating')
  useEffect(() => {
    if (!hasProcessing) return
    const poll = setInterval(async () => {
      const { data } = await supabase.from('animation_videos').select('*, animation_styles(label, icon_path)').eq('brief_id', briefId).order('created_at', { ascending: true })
      if (data) setAnimationVideos(data)
    }, 8000)
    return () => clearInterval(poll)
  }, [hasProcessing])

  // Timer-based stage progression
  useEffect(() => {
    const processing = animationVideos.filter(v => v.status === 'queued' || v.status === 'generating')
    if (processing.length === 0) return
    setTimerStageMap(prev => {
      const next = { ...prev }
      processing.forEach(v => { if (!(v.id in next)) next[v.id] = 0 })
      return next
    })
    const timers: ReturnType<typeof setTimeout>[] = []
    processing.forEach(v => {
      let cumulative = 0
      ANIMATION_STAGES.forEach((s, si) => {
        if (si === 0) return
        cumulative += ANIMATION_STAGES[si - 1].duration * 1000
        timers.push(setTimeout(() => { setTimerStageMap(prev => ({ ...prev, [v.id]: si })) }, cumulative))
      })
    })
    return () => timers.forEach(clearTimeout)
  }, [animationVideos.filter(v => v.status === 'queued' || v.status === 'generating').map(v => v.id).join(',')])

  async function loadData() {
    setLoading(true)
    const [{ data: stylesData }, { data: videos }, { data: freshBrief }] = await Promise.all([
      fetch('/api/animation/styles').then(r => r.json()).then(data => ({ data })),
      supabase.from('animation_videos').select('*, animation_styles(label, icon_path)').eq('brief_id', briefId).order('created_at', { ascending: true }),
      supabase.from('briefs').select('animation_feedbacks, last_animation_style').eq('id', briefId).single(),
    ])
    setStyles(Array.isArray(stylesData) ? stylesData : [])
    setAnimationVideos(videos || [])
    const b = freshBrief || brief
    setFeedbacks(b?.animation_feedbacks || [])
    if (b?.last_animation_style) setSelectedStyle(b.last_animation_style)
    setLoading(false)
  }

  async function handleGenerate(styleSlug: string) {
    if (generating) return
    setGenerating(true)
    setMsg('')
    try {
      const res = await fetch('/api/animation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief_id: briefId, style_slug: styleSlug, client_user_id: clientUser?.id }),
      })
      const data = await res.json()
      if (data.error) { setMsg(data.error); setGenerating(false); return }
      if (data.animation_video_ids?.length) {
        // Optimistic add
        const styleInfo = styles.find(s => s.slug === styleSlug)
        const optimistic = data.animation_video_ids.map((id: string, i: number) => ({
          id, status: 'queued', style_slug: styleSlug, version: i + 1,
          animation_styles: styleInfo ? { label: styleInfo.label, icon_path: styleInfo.icon_path } : null,
          created_at: new Date().toISOString(),
        }))
        setAnimationVideos(prev => [...prev, ...optimistic])
        setSelectedStyle(styleSlug)
      }
    } catch { setMsg('Bağlantı hatası') }
    setGenerating(false)
  }

  async function handlePurchase(videoId: string) {
    if (purchasing) return
    setPurchasing(videoId)
    try {
      const res = await fetch('/api/animation/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animation_video_id: videoId }),
      })
      const data = await res.json()
      if (data.error) { setMsg(data.error); setPurchasing(null); return }
      setAnimationVideos(prev => prev.map(v => v.id === videoId ? { ...v, status: 'sold' } : v))
    } catch { setMsg('Bağlantı hatası') }
    setPurchasing(null)
  }

  async function handleRetry(videoId: string) {
    try {
      await fetch('/api/animation/retry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ animation_video_id: videoId }) })
      setAnimationVideos(prev => prev.map(v => v.id === videoId ? { ...v, status: 'queued', error_message: null, final_url: null } : v))
    } catch { setMsg('Bağlantı hatası') }
  }

  async function saveFeedback(videoId: string, videoVersion: string, styleSlug: string) {
    const val = feedbackText[videoId]?.trim()
    if (!val) return
    const entry = { video_version: videoVersion, style_slug: styleSlug, feedback: val, created_at: new Date().toISOString() }
    const existing = [...feedbacks]
    const idx = existing.findIndex(f => f.video_version === videoVersion)
    if (idx >= 0) existing[idx] = entry; else existing.push(entry)
    await supabase.from('briefs').update({ animation_feedbacks: existing }).eq('id', briefId)
    setFeedbacks(existing)
    setEditingFeedback(prev => ({ ...prev, [videoId]: false }))
    setFeedbackText(prev => ({ ...prev, [videoId]: '' }))
  }

  if (loading) return <div style={{ padding: '24px', color: '#888', fontSize: '13px' }}>Yükleniyor...</div>

  const completedCount = animationVideos.filter(v => v.status !== 'failed').length
  const credits = clientUser?.allocated_credits || 0

  return (
    <div style={{ padding: '24px 28px' }}>
      {msg && <div style={{ padding: '10px 14px', background: msg.includes('hata') || msg.includes('Hata') || msg.includes('Yetersiz') ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${msg.includes('hata') || msg.includes('Hata') || msg.includes('Yetersiz') ? '#ef4444' : '#22c55e'}`, fontSize: '12px', color: '#0a0a0a', marginBottom: '16px' }}>{msg}</div>}

      {/* STIL GRID — 2×4 */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#888', fontWeight: '500', marginBottom: '12px' }}>ANİMASYON STİLİ SEÇ</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {styles.map(style => {
            const isSelected = selectedStyle === style.slug
            const isGeneratingThis = generating && selectedStyle === style.slug
            return (
              <div key={style.slug}
                onClick={() => { if (!generating) { setSelectedStyle(style.slug) } }}
                style={{ border: isSelected ? '2px solid #0a0a0a' : '1px solid #e5e4db', padding: '12px', textAlign: 'center', cursor: generating ? 'not-allowed' : 'pointer', background: isSelected ? '#fafaf7' : '#fff', transition: 'all 0.15s', opacity: generating && !isGeneratingThis ? 0.5 : 1 }}>
                <img src={style.icon_path} alt={style.label} style={{ width: '64px', height: '64px', objectFit: 'contain', marginBottom: '8px', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
                <div style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '0.5px', color: '#0a0a0a', textTransform: 'uppercase' }}>{style.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ÜRET BUTON */}
      {selectedStyle && (
        <button
          onClick={() => handleGenerate(selectedStyle)}
          disabled={generating || credits < 1}
          style={{ width: '100%', padding: '14px', background: generating || credits < 1 ? '#ccc' : '#0a0a0a', color: '#fff', border: 'none', fontSize: '13px', fontWeight: '600', cursor: generating || credits < 1 ? 'default' : 'pointer', marginBottom: '24px', letterSpacing: '0.5px' }}>
          {generating ? 'ÜRETİLİYOR...' : completedCount === 0 ? 'ÜRET (ÜCRETSİZ · 4 VERSİYON)' : 'ÜRET (1 KREDİ · 4 VERSİYON)'}
        </button>
      )}

      {/* VİDEO KARTLARI */}
      {animationVideos.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#888', fontWeight: '500', marginBottom: '12px' }}>ÜRETİLEN VİDEOLAR</div>
          {animationVideos.map((video, idx) => {
            const hasVideo = !!video.final_url
            const isPurchased = video.status === 'sold'
            const isFailed = video.status === 'failed'
            const isProcessing = video.status === 'queued' || video.status === 'generating'
            const styleLabel = video.animation_styles?.label || video.style_slug
            const versionLabel = `V${video.version || idx + 1}`
            const lastFb = feedbacks.find((f: any) => f.video_version === versionLabel)
            const isEditingFb = editingFeedback[video.id] || !lastFb
            const currentFbText = feedbackText[video.id] ?? ''
            const stageIdx = timerStageMap[video.id] || 0
            const stage = ANIMATION_STAGES[stageIdx] || ANIMATION_STAGES[0]

            return (
              <div key={video.id} ref={el => { videoCardRefs.current[video.id] = el }}
                style={{ display: 'flex', gap: '14px', padding: '14px', marginBottom: '8px', border: highlightId === video.id ? '2px solid #22c55e' : '1px solid #e5e4db', background: '#fff', alignItems: 'flex-start', transition: 'all 0.3s' }}>

                {/* Video / Loading / Failed */}
                <div style={{ width: '200px', aspectRatio: (brief?.format || '9:16').replace(':', '/'), background: '#0a0a0a', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                  {isFailed ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#1a1a1a' }}>
                      <span style={{ fontSize: '20px', color: '#555' }}>&#9888;</span>
                      <span style={{ fontSize: '10px', color: '#888', textAlign: 'center', padding: '0 8px' }}>{video.error_message?.substring(0, 60) || 'Üretim başarısız'}</span>
                      <button onClick={() => handleRetry(video.id)} style={{ marginTop: '4px', padding: '4px 12px', background: '#333', color: '#fff', border: 'none', fontSize: '10px', cursor: 'pointer' }}>Tekrar Dene</button>
                    </div>
                  ) : hasVideo ? (
                    <video src={video.final_url} controls preload="metadata" onPlay={e => pauseOtherVideos(e.currentTarget)}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'black' }} />
                  ) : isProcessing ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
                      <div className="spinner" style={{ width: '24px', height: '24px', border: '3px solid #333', borderTopColor: '#1DB81D', marginBottom: '10px' }} />
                      <div style={{ fontSize: '10px', color: '#888', letterSpacing: '1px', textTransform: 'uppercase' }}>{stage.label}</div>
                    </div>
                  ) : null}
                </div>

                {/* Info + Actions */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{versionLabel}</span>
                    <span style={{ fontSize: '9px', letterSpacing: '1px', padding: '2px 6px', background: 'rgba(139,92,246,0.08)', color: '#8b5cf6', fontWeight: '500', textTransform: 'uppercase' }}>{styleLabel}</span>
                    {isPurchased && <span style={{ fontSize: '9px', letterSpacing: '1px', padding: '2px 6px', background: 'rgba(34,197,94,0.08)', color: '#22c55e', fontWeight: '500' }}>SATIN ALINDI</span>}
                    {isProcessing && <span style={{ fontSize: '9px', letterSpacing: '1px', padding: '2px 6px', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', fontWeight: '500' }}>ÜRETİLİYOR</span>}
                  </div>

                  {video.completed_at && <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '6px' }}>{formatDuration(video.created_at, video.completed_at)}</div>}

                  {/* Feedback summary */}
                  {video.feedback_summary && (
                    <div style={{ fontSize: '11px', color: '#6b6b66', fontFamily: 'monospace', marginBottom: '8px', lineHeight: 1.5 }}>
                      {video.feedback_summary}<span style={{ display: 'inline-block', marginLeft: '2px', color: '#6b6b66', animation: 'blink 1s steps(1) infinite' }}>&#9610;</span>
                    </div>
                  )}

                  {/* Actions */}
                  {hasVideo && !isFailed && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {isPurchased ? (
                        <>
                          <button onClick={() => downloadFile(video.final_url, `dinamo_animation_${video.style_slug}_v${video.version}.mp4`)}
                            style={{ fontSize: '11px', color: '#0a0a0a', background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4 8l4 4 4-4" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/><path d="M2 13h12" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            İndir
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handlePurchase(video.id)} disabled={purchasing === video.id || credits < 1} className="btn btn-accent" style={{ padding: '6px 16px' }}>SATIN AL</button>
                          <span style={{ fontSize: '13px', color: '#888' }}>1 kredi</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Feedback (sold videos) */}
                  {isPurchased && (
                    <div style={{ borderTop: '1px solid #f0f0ee', paddingTop: '8px' }}>
                      {isEditingFb ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input value={currentFbText} onChange={e => setFeedbackText(prev => ({ ...prev, [video.id]: e.target.value }))}
                            placeholder="Yorum yazın (opsiyonel)..." style={{ flex: 1, padding: '6px 10px', border: '1px solid #e5e4db', fontSize: '12px', color: '#0a0a0a' }} />
                          <button onClick={() => saveFeedback(video.id, versionLabel, video.style_slug)}
                            style={{ padding: '8px 14px', background: '#0a0a0a', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap', height: '36px' }}>Kaydet</button>
                        </div>
                      ) : lastFb ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ fontSize: '12px', color: '#555', lineHeight: 1.5 }}>{lastFb.feedback}</div>
                          <button onClick={() => setEditingFeedback(prev => ({ ...prev, [video.id]: true }))}
                            style={{ fontSize: '10px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', flexShrink: 0, marginLeft: '8px' }}>Düzenle</button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
