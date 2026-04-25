'use client'
import { useState } from 'react'

interface Props {
  brief: any
  clientName: string
  videos: any[]
  aiChildren: any[]
  cpsChildren: any[]
}

export default function SharePageClient({ brief, clientName, videos, aiChildren, cpsChildren }: Props) {
  const [lightbox, setLightbox] = useState<{ type: 'video' | 'image'; url: string } | null>(null)

  const totalVideos = videos.length + aiChildren.length + cpsChildren.length
  const hasStaticImages = !!brief.static_images_url
  const deliveryDate = new Date(brief.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

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
        <a href={url} download target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', textAlign: 'center', padding: '6px 12px', border: '1px solid #0a0a0a', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: '#0a0a0a', textDecoration: 'none' }}>
          İNDİR ↓
        </a>
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
          {brief.static_images_url && (
            <a href={brief.static_images_url} target="_blank" rel="noopener noreferrer"
              style={{ padding: '12px 24px', background: '#0a0a0a', color: '#fff', border: '1px solid #0a0a0a', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              TÜMÜNÜ İNDİR ↓
            </a>
          )}
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
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {videos.map((v: any) => (
                    <VideoThumb key={v.id} url={v.video_url} label={`V${v.version}`} width={260} />
                  ))}
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

        {/* IMAGES */}
        {hasStaticImages && (
          <div style={{ borderTop: '1px solid var(--color-border-tertiary)', paddingTop: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '600', color: 'var(--color-text-primary)' }}>GÖRSELLER · 5 FORMAT</div>
              <a href={brief.static_images_url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', textDecoration: 'underline' }}>
                ZIP İNDİR
              </a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {['9:16 Reel', '4:5 IG', '1:1 Kare', '16:9 Yatay', '1200x628'].map((fmt, i) => (
                <div key={fmt} style={{ border: '1px solid var(--color-border-tertiary)', background: '#f5f4f0', aspectRatio: ['9/16', '4/5', '1/1', '16/9', '1.91/1'][i], display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <div style={{ fontSize: '16px', color: 'var(--color-text-tertiary)', opacity: 0.3 }}>&#9634;</div>
                  <span style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: '500', color: 'var(--color-text-tertiary)' }}>{fmt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalVideos === 0 && !hasStaticImages && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-tertiary)', fontSize: '13px' }}>Henüz paylaşılabilir içerik yok</div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ padding: '24px 28px', borderTop: '1px solid var(--color-border-tertiary)', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>DCC FİLM TARAFINDAN ÜRETİLDİ · {new Date().getFullYear()}</div>
      </div>

      {/* LIGHTBOX */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: '20px', right: '20px', width: '36px', height: '36px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>&#215;</button>
          <div onClick={e => e.stopPropagation()}>
            <video src={lightbox.url} controls autoPlay style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'block' }} />
          </div>
        </div>
      )}
    </div>
  )
}
