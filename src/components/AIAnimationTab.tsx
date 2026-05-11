'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { downloadFile } from '@/lib/download-helper'
import { pauseOtherVideos } from '@/lib/video-playback'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface Props { briefId: string; brief: any; clientUser: any; onVideoCountChange?: (count: number) => void }

const ANIMATION_STAGES = [
  { key: 'concept', label: 'Senaryo hazırlanıyor', duration: 15 },
  { key: 'generating', label: 'Animasyon üretiliyor', duration: 120 },
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
  const [hoveredStyle, setHoveredStyle] = useState<string | null>(null)
  const [styleFading, setStyleFading] = useState(false)

  useEffect(() => { loadData() }, [briefId])

  useEffect(() => {
    const count = animationVideos.filter(v => v.status !== 'failed').length
    onVideoCountChange?.(count)
  }, [animationVideos])

  // Global polling
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
    if (processing.length === 0) return
    setTimerStageMap(prev => { const next = { ...prev }; processing.forEach(v => { if (!(v.id in next)) next[v.id] = 0 }); return next })
    const timers: ReturnType<typeof setTimeout>[] = []
    processing.forEach(v => {
      let cumulative = 0
      ANIMATION_STAGES.forEach((s, si) => { if (si === 0) return; cumulative += ANIMATION_STAGES[si - 1].duration * 1000; timers.push(setTimeout(() => { setTimerStageMap(prev => ({ ...prev, [v.id]: si })) }, cumulative)) })
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
    else if (Array.isArray(stylesData) && stylesData.length > 0) setSelectedStyle(stylesData[0].slug)
    setLoading(false)
  }

  async function handleGenerate(styleSlug: string) {
    if (generating) return
    setGenerating(true); setMsg('')
    try {
      const res = await fetch('/api/animation/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, style_slug: styleSlug, client_user_id: clientUser?.id }) })
      const data = await res.json()
      if (data.error) { setMsg(data.error); setGenerating(false); return }
      if (data.animation_video_id) {
        const styleInfo = styles.find(s => s.slug === styleSlug)
        setAnimationVideos(prev => [...prev, { id: data.animation_video_id, status: 'queued', style_slug: styleSlug, version: data.version, animation_styles: styleInfo ? { label: styleInfo.label, icon_path: styleInfo.icon_path } : null, created_at: new Date().toISOString() }])
        setHighlightId(data.animation_video_id); setTimeout(() => setHighlightId(null), 1500)
      }
    } catch { setMsg('Bağlantı hatası') }
    setGenerating(false)
  }

  async function handlePurchase(videoId: string) {
    if (purchasing) return; setPurchasing(videoId)
    try {
      const res = await fetch('/api/animation/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ animation_video_id: videoId }) })
      const data = await res.json()
      if (data.error) { setMsg(data.error) } else { setAnimationVideos(prev => prev.map(v => v.id === videoId ? { ...v, status: 'sold' } : v)) }
    } catch { setMsg('Bağlantı hatası') }
    setPurchasing(null)
  }

  async function handleRetry(videoId: string) {
    try { await fetch('/api/animation/retry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ animation_video_id: videoId }) }); setAnimationVideos(prev => prev.map(v => v.id === videoId ? { ...v, status: 'queued', error_message: null, final_url: null } : v)) } catch { setMsg('Bağlantı hatası') }
  }

  async function saveFeedback(videoId: string, videoVersion: string, styleSlug: string) {
    const val = feedbackText[videoId]?.trim(); if (!val) return
    const entry = { video_version: videoVersion, style_slug: styleSlug, feedback: val, created_at: new Date().toISOString() }
    const existing = [...feedbacks]; const idx = existing.findIndex(f => f.video_version === videoVersion)
    if (idx >= 0) existing[idx] = entry; else existing.push(entry)
    await supabase.from('briefs').update({ animation_feedbacks: existing }).eq('id', briefId)
    setFeedbacks(existing); setEditingFeedback(prev => ({ ...prev, [videoId]: false })); setFeedbackText(prev => ({ ...prev, [videoId]: '' }))
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#888', fontSize: '13px' }}>Yükleniyor...</div>

  const totalCount = animationVideos.filter(v => v.status !== 'failed').length
  const credits = clientUser?.allocated_credits || 0
  const selectedStyleInfo = styles.find(s => s.slug === selectedStyle)

  return (
    <div>
      {msg && <div style={{ padding: '10px 14px', background: msg.includes('hata') || msg.includes('Hata') || msg.includes('Yetersiz') ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${msg.includes('hata') || msg.includes('Hata') || msg.includes('Yetersiz') ? '#ef4444' : '#22c55e'}`, fontSize: '12px', color: '#0a0a0a', marginBottom: '12px' }}>{msg}<button onClick={() => setMsg('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>x</button></div>}

      {/* VIDEO LIST — tüm stiller karışık, en yeni en üstte DEĞİL en altta (Persona pattern: ascending) */}
      <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px 24px', marginBottom: '16px' }}>
        {animationVideos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontSize: '13px' }}>Henüz video üretilmedi. Aşağıdan stil seçin ve üretin.</div>
        )}

        {animationVideos.map((video, idx) => {
          const hasVideo = !!video.final_url
          const isPurchased = video.status === 'sold'
          const isFailed = video.status === 'failed' && !isPurchased
          const isProcessing = video.status === 'queued' || video.status === 'generating'
          const styleLabel = video.animation_styles?.label || video.style_slug
          const versionLabel = `V${video.version || idx + 1}`
          const lastFb = feedbacks.find((f: any) => f.video_version === versionLabel)
          const isEditingFb = editingFeedback[video.id] || !lastFb
          const currentFbText = feedbackText[video.id] ?? ''
          const stageIdx = timerStageMap[video.id] || 0
          const stage = ANIMATION_STAGES[stageIdx] || ANIMATION_STAGES[0]

          return (
            <div key={video.id} style={{ display: 'flex', gap: '14px', padding: '14px', marginBottom: '8px', border: highlightId === video.id ? '2px solid #22c55e' : '1px solid var(--color-border-tertiary)', background: '#fff', alignItems: 'flex-start', transition: 'all 0.3s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-background-secondary)' }} onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}>
              {/* Video */}
              <div style={{ width: '200px', aspectRatio: (brief?.format || '9:16').replace(':', '/'), background: '#0a0a0a', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                {isFailed ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#1a1a1a' }}>
                    <span style={{ fontSize: '20px', color: '#555' }}>&#9888;</span>
                    <span style={{ fontSize: '10px', color: '#888', textAlign: 'center', padding: '0 8px' }}>{video.error_message?.substring(0, 60) || 'Üretim başarısız'}</span>
                    <button onClick={() => handleRetry(video.id)} style={{ marginTop: '4px', padding: '4px 12px', background: '#333', color: '#fff', border: 'none', fontSize: '10px', cursor: 'pointer' }}>Tekrar Dene</button>
                  </div>
                ) : hasVideo ? (
                  <video src={video.final_url} controls preload="metadata" onPlay={e => pauseOtherVideos(e.currentTarget)} style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'black' }} />
                ) : isProcessing ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
                    <div className="spinner" style={{ width: '24px', height: '24px', border: '3px solid #333', borderTopColor: '#1DB81D', marginBottom: '10px' }} />
                    <div style={{ fontSize: '10px', color: '#888', letterSpacing: '1px', textTransform: 'uppercase' }}>{stage.label}</div>
                  </div>
                ) : null}
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{versionLabel}</span>
                  <span style={{ fontSize: '9px', letterSpacing: '1px', padding: '2px 6px', background: 'rgba(139,92,246,0.08)', color: '#8b5cf6', fontWeight: '500', textTransform: 'uppercase' }}>{styleLabel}</span>
                  {isPurchased && <span style={{ fontSize: '9px', letterSpacing: '1px', padding: '2px 6px', background: 'rgba(34,197,94,0.08)', color: '#22c55e', fontWeight: '500' }}>SATIN ALINDI</span>}
                  {isProcessing && <span style={{ fontSize: '9px', letterSpacing: '1px', padding: '2px 6px', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', fontWeight: '500' }}>ÜRETİLİYOR</span>}
                </div>
                {video.completed_at && <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '6px' }}>{formatDuration(video.created_at, video.completed_at)}</div>}
                {video.feedback_summary && <div style={{ fontSize: '11px', color: '#6b6b66', fontFamily: 'monospace', marginBottom: '8px', lineHeight: 1.5 }}>{video.feedback_summary}<span style={{ display: 'inline-block', marginLeft: '2px', color: '#6b6b66', animation: 'blink 1s steps(1) infinite' }}>&#9610;</span></div>}
                {hasVideo && !isFailed && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {isPurchased ? (
                      <button onClick={() => downloadFile(video.final_url, `dinamo_animation_${video.style_slug}_v${video.version}.mp4`)} style={{ fontSize: '11px', color: '#0a0a0a', background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4 8l4 4 4-4" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/><path d="M2 13h12" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/></svg> İndir
                      </button>
                    ) : (
                      <><button onClick={() => handlePurchase(video.id)} disabled={purchasing === video.id || credits < 1} className="btn btn-accent" style={{ padding: '6px 16px' }}>SATIN AL</button><span style={{ fontSize: '13px', color: '#888' }}>1 kredi</span></>
                    )}
                  </div>
                )}
                {isPurchased && (
                  <div style={{ borderTop: '1px solid #f0f0ee', paddingTop: '8px' }}>
                    {isEditingFb ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input value={currentFbText} onChange={e => setFeedbackText(prev => ({ ...prev, [video.id]: e.target.value }))} placeholder="Yorum yazın (opsiyonel)..." style={{ flex: 1, padding: '6px 10px', border: '1px solid #e5e4db', fontSize: '12px', color: '#0a0a0a' }} />
                        <button onClick={() => saveFeedback(video.id, versionLabel, video.style_slug)} style={{ padding: '8px 14px', background: '#0a0a0a', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap' }}>Kaydet</button>
                      </div>
                    ) : lastFb ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '12px', color: '#555', lineHeight: 1.5 }}>{lastFb.feedback}</div>
                        <button onClick={() => setEditingFeedback(prev => ({ ...prev, [video.id]: true }))} style={{ fontSize: '10px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', flexShrink: 0, marginLeft: '8px' }}>Düzenle</button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* STIL SELECTION + GENERATE — Persona pattern */}
      <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px 24px' }}>
        {/* Selected style large card */}
        <div style={{ minHeight: '80px', marginBottom: '16px' }}>
          {selectedStyleInfo ? (
            <div style={{ opacity: styleFading ? 0 : 1, transition: 'opacity 300ms ease-in-out' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ width: '80px', height: '80px', background: '#f5f4f0', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={selectedStyleInfo.icon_path} alt={selectedStyleInfo.label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: '500', color: '#0a0a0a', marginBottom: '4px' }}>{selectedStyleInfo.label}</div>
                  {selectedStyleInfo.mood_hints?.length > 0 && <div style={{ fontSize: '11px', color: '#888' }}>{selectedStyleInfo.mood_hints.join(' · ')}</div>}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontSize: '13px' }}>Aşağıdan bir stil seçin</div>
          )}
        </div>

        {/* Generate button */}
        {selectedStyle && (
          <button onClick={() => handleGenerate(selectedStyle)} disabled={generating || credits < 1}
            style={{ width: '100%', padding: '12px', marginBottom: '16px', background: generating || credits < 1 ? '#ccc' : '#0a0a0a', color: '#fff', border: 'none', fontSize: '13px', fontWeight: '600', cursor: generating || credits < 1 ? 'default' : 'pointer', letterSpacing: '0.5px' }}>
            {(() => { const c = animationVideos.filter(v => v.status !== 'failed').length; return generating ? 'ÜRETİLİYOR...' : c === 0 ? 'ÜRET (ÜCRETSİZ)' : 'ÜRET (1 KREDİ)' })()}
          </button>
        )}

        {/* Style selection row — Persona pattern (yatay scroll, yuvarlak dot) */}
        <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a0a09a', marginBottom: '12px', fontWeight: '500', minHeight: '15px' }}>
          {hoveredStyle ? hoveredStyle.toUpperCase() : 'STİL SEÇ'}
        </div>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', overflowY: 'visible', padding: '10px 0' }}>
          {styles.map(style => (
            <div key={style.slug} title={style.label}
              onClick={() => { if (style.slug === selectedStyle) return; setStyleFading(true); setTimeout(() => { setSelectedStyle(style.slug); setStyleFading(false) }, 150) }}
              style={{ flexShrink: 0, cursor: 'pointer', opacity: selectedStyle === style.slug ? 1 : 0.6, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)'; setHoveredStyle(style.label) }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; setHoveredStyle(null) }}>
              <div className="dot" style={{ width: '52px', height: '52px', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: selectedStyle === style.slug ? '2px solid #8b5cf6' : '1px solid #e5e4db', overflow: 'hidden', transition: 'border-color 0.15s' }}>
                <img src={style.icon_path} alt={style.label} className="dot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
