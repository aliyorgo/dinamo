'use client'
import { useState } from 'react'
import { downloadCampaignZip } from '@/lib/campaign-zip'
import { downloadFile } from '@/lib/download-helper'

interface Props {
  brief: any
  clientName: string
  deliveryDate: string
  caption: string
  videos: any[]
  aiChildren: any[]
  cpsChildren: any[]
}

export default function SharePageClient({ brief, clientName, deliveryDate, caption, videos, aiChildren, cpsChildren }: Props) {
  const [lightbox, setLightbox] = useState<{ type: 'video' | 'image'; url: string } | null>(null)
  const [zipping, setZipping] = useState(false)
  const [captionCopied, setCaptionCopied] = useState(false)

  const totalVideos = videos.length + aiChildren.length + cpsChildren.length
  const hasStaticImages = !!brief.static_images_url || !!brief.static_image_files
  const aiWithImages = aiChildren.filter((c: any) => c.static_image_files && (Array.isArray(c.static_image_files) ? c.static_image_files.length > 0 : Object.keys(c.static_image_files).length > 0))
  const hasAnyImages = hasStaticImages || aiWithImages.length > 0

  function VideoThumb({ url, label, width = 200 }: { url: string; label: string; width?: number }) {
    return (
      <div style={{ width: `${width}px` }}>
        <div onClick={() => setLightbox({ type: 'video', url })} style={{ aspectRatio: '9/16', background: '#0a0a0a', position: 'relative', cursor: 'pointer', border: '1px solid var(--color-border-tertiary)', overflow: 'hidden' }}>
          <video src={url + '#t=0.5'} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '1' }} onMouseLeave={e => { e.currentTarget.style.opacity = '0' }}>
            <div style={{ width: '44px', height: '44px', background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#0a0a0a', fontSize: '16px', marginLeft: '2px' }}>▶</span>
            </div>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-primary)', fontWeight: '500', marginTop: '6px', marginBottom: '4px' }}>{label}</div>
        <button onClick={() => downloadFile(url, `${label.replace(/\s+/g, '_')}.mp4`)}
          style={{ display: 'block', width: '100%', textAlign: 'center', padding: '6px 12px', border: '1px solid #0a0a0a', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: '#0a0a0a', background: 'transparent', cursor: 'pointer' }}>
          İNDİR ↓
        </button>
      </div>
    )
  }

  function CaptionBox() {
    if (!caption) return null
    return (
      <div style={{ flex: '1 1 240px', maxWidth: '320px', border: '1px solid #0a0a0a', background: '#fff', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: 'var(--color-text-tertiary)' }}>CAPTION</div>
          <button onClick={() => { navigator.clipboard.writeText(caption); setCaptionCopied(true); setTimeout(() => setCaptionCopied(false), 2000) }}
            style={{ padding: '4px 12px', border: '1px solid #0a0a0a', background: 'transparent', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: '#0a0a0a', cursor: 'pointer' }}>
            {captionCopied ? 'KOPYALANDİ ✓' : 'KOPYALA'}
          </button>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{caption}</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background-secondary)' }}>
      {/* HEADER */}
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--color-border-tertiary)', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src="/dinamo_logo_siyah.png" alt="Dinamo" style={{ height: '24px' }} />
          {clientName && <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: '500' }}>{clientName}</span>}
        </div>
      </div>

      {/* HERO */}
      <div style={{ padding: '48px 28px 32px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '36px', fontWeight: '500', color: 'var(--color-text-primary)', letterSpacing: '-0.02em', marginBottom: '8px' }}>{brief.campaign_name}</div>
            <div style={{ fontSize: '12px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: '500' }}>
              {clientName} · {deliveryDate} TESLİM
            </div>
          </div>
          <button onClick={async () => {
            if (zipping) return; setZipping(true)
            try { await downloadCampaignZip(brief.id) } catch {}
            setZipping(false)
          }} disabled={zipping}
            style={{ padding: '12px 24px', background: '#0a0a0a', color: '#fff', border: '1px solid #0a0a0a', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', cursor: zipping ? 'wait' : 'pointer', opacity: zipping ? 0.6 : 1 }}>
            {zipping ? 'HAZIRLANIYOR...' : 'TÜMÜNÜ ZİP İNDİR ↓'}
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: '0 28px 60px', maxWidth: '900px', margin: '0 auto' }}>

        {/* VIDEOS */}
        {totalVideos > 0 && (
          <>
            <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '20px' }}>VİDEOLAR · {totalVideos}</div>

            {videos.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>ANA VİDEO</div>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {videos.map((v: any) => (
                      <VideoThumb key={v.id} url={v.video_url} label={`V${v.version}`} width={260} />
                    ))}
                  </div>
                  <CaptionBox />
                </div>
              </div>
            )}

            {cpsChildren.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>CPS PAKETİ · {cpsChildren.length}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                  {cpsChildren.map((c: any, i: number) => {
                    const vid = c.video_submissions?.[0]
                    if (!vid?.video_url) return null
                    return <VideoThumb key={c.id} url={vid.video_url} label={c.cps_hook ? `Yön ${i + 1} · ${c.cps_hook}` : `Yön ${i + 1}`} />
                  })}
                </div>
              </div>
            )}

            {aiChildren.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>AI EXPRESS · {aiChildren.length}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                  {aiChildren.map((c: any, i: number) => (
                    <VideoThumb key={c.id} url={c.ai_video_url} label={`Versiyon ${i + 1}`} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* IMAGES — grouped by source */}
        {hasAnyImages && (() => {
          const formats = [
            { key: '9x16', label: '9:16 Reel', aspect: '9/16' },
            { key: '4x5', label: '4:5 IG', aspect: '4/5' },
            { key: '1x1', label: '1:1 Kare', aspect: '1/1' },
            { key: '16x9', label: '16:9 Yatay', aspect: '16/9' },
            { key: '1200x628', label: '1200x628', aspect: '1.91/1' },
          ]
          function parseFrames(raw: any): any[] {
            return Array.isArray(raw) ? raw : (raw && typeof raw === 'object' && Object.keys(raw).length > 0) ? [raw] : []
          }
          const sources: { label: string; frames: any[] }[] = []
          const mainFrames = parseFrames(brief.static_image_files)
          if (mainFrames.length > 0) sources.push({ label: 'ANA VIDEODAN', frames: mainFrames })
          aiWithImages.forEach((child: any) => {
            const idx = aiChildren.indexOf(child)
            const frames = parseFrames(child.static_image_files)
            if (frames.length > 0) sources.push({ label: `AI EXPRESS V${idx + 1}'DEN`, frames })
          })
          return (
            <div style={{ borderTop: '1px solid var(--color-border-tertiary)', paddingTop: '28px' }}>
              <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '20px' }}>GÖRSELLER · TOPLAM {sources.reduce((s, src) => s + src.frames.length, 0)}</div>
              {sources.map((src, si) => (
                <div key={si} style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#9b9b95', fontWeight: '500', marginBottom: '10px' }}>{src.label} · 5 FORMAT</div>
                  {src.frames.map((ff: any, fi: number) => (
                    <div key={fi} style={{ marginBottom: fi < src.frames.length - 1 ? '16px' : '0' }}>
                      {src.frames.length > 1 && <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>FRAME {fi + 1}</div>}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                        {formats.map(f => {
                          const url = ff[f.key]?.with_text
                          return (
                            <div key={f.key} onClick={() => url && setLightbox({ type: 'image', url })}
                              style={{ border: '1px solid var(--color-border-tertiary)', background: '#f5f4f0', aspectRatio: f.aspect, overflow: 'hidden', cursor: url ? 'pointer' : 'default' }}>
                              {url ? <img src={url} alt={f.label} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)' }}>{f.label}</span></div>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
        })()}

        {totalVideos === 0 && !hasAnyImages && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-tertiary)', fontSize: '13px' }}>Henüz paylaşılabilir içerik yok</div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ padding: '24px 28px', borderTop: '1px solid var(--color-border-tertiary)', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>DCC FİLM TARAFINDAN ÜRETİLDİ · 2026</div>
      </div>

      {/* LIGHTBOX */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: '20px', right: '20px', width: '36px', height: '36px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>&#215;</button>
          <div onClick={e => e.stopPropagation()}>
            {lightbox.type === 'video'
              ? <video src={lightbox.url} controls autoPlay style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'block' }} />
              : <img src={lightbox.url} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', display: 'block' }} />}
          </div>
        </div>
      )}
    </div>
  )
}
