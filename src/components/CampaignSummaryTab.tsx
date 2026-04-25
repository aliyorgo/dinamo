'use client'
import { useState } from 'react'
import { generateCertificatePDF } from '@/lib/generate-certificate'

interface Props {
  brief: any
  companyName: string
  videos: any[]
  aiChildren: any[]
  cpsChildren: any[]
}

function slugify(name: string): string {
  const map: Record<string, string> = { 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ı': 'i', 'ö': 'o', 'ç': 'c', 'Ğ': 'G', 'Ü': 'U', 'Ş': 'S', 'İ': 'I', 'Ö': 'O', 'Ç': 'C' }
  let s = name || ''
  for (const [k, v] of Object.entries(map)) s = s.replace(new RegExp(k, 'g'), v)
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export default function CampaignSummaryTab({ brief, companyName, videos, aiChildren, cpsChildren }: Props) {
  const [lightbox, setLightbox] = useState<{ type: 'video' | 'image'; url: string } | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [zipping, setZipping] = useState(false)

  const approvedVideos = videos.filter(v => ['producer_approved', 'admin_approved'].includes(v.status))
  const deliveredAi = aiChildren.filter(c => c.status === 'delivered' && c.ai_video_url)
  const deliveredCps = cpsChildren.filter((c: any) => c.video_submissions?.length > 0)

  const totalVideos = approvedVideos.length + deliveredAi.length + deliveredCps.length
  const draftCount = aiChildren.filter(c => c.status !== 'delivered' && c.ai_video_url).length + cpsChildren.filter((c: any) => !c.video_submissions?.length).length
  const hasStaticImages = !!brief.static_images_url

  const totalCredits = (brief.credit_cost || 0) +
    aiChildren.length + deliveredAi.length * 2 +
    cpsChildren.reduce((s: number, c: any) => s + (c.credit_cost || 0), 0)

  function copyLink() {
    const url = `${window.location.origin}/video/${brief.id}`
    navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  function VideoThumb({ url, label, id, aspect = '9/16', width = 180 }: { url: string; label: string; id: string; aspect?: string; width?: number }) {
    return (
      <div style={{ width: `${width}px` }}>
        <div onClick={() => setLightbox({ type: 'video', url })} style={{ aspectRatio: aspect, background: '#0a0a0a', position: 'relative', cursor: 'pointer', border: '1px solid var(--color-border-tertiary)', overflow: 'hidden' }}>
          <video src={url + '#t=0.5'} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '1' }} onMouseLeave={e => { e.currentTarget.style.opacity = '0' }}>
            <div style={{ width: '44px', height: '44px', background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#0a0a0a', fontSize: '16px', marginLeft: '2px' }}>▶</span>
            </div>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-primary)', fontWeight: '500', marginTop: '6px', marginBottom: '4px' }}>{label}</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <a href={url} download target="_blank" rel="noopener noreferrer"
            style={{ flex: 1, textAlign: 'center', padding: '5px 8px', border: '1px solid #0a0a0a', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: '#0a0a0a', textDecoration: 'none', cursor: 'pointer' }}>
            İNDİR ↓
          </a>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(menuOpen === id ? null : id)}
              style={{ width: '30px', height: '100%', border: '1px solid #0a0a0a', background: 'transparent', fontSize: '14px', cursor: 'pointer', color: '#0a0a0a' }}>⋯</button>
            {menuOpen === id && (
              <div style={{ position: 'absolute', top: '100%', right: 0, background: '#fff', border: '1px solid #0a0a0a', padding: '4px', zIndex: 100, minWidth: '180px' }}
                onMouseLeave={() => setMenuOpen(null)}>
                <div onClick={() => { generateCertificatePDF(brief, companyName); setMenuOpen(null) }}
                  style={{ padding: '8px 14px', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fafaf7' }} onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}>
                  TELİF BELGESİ İNDİR
                </div>
                <div onClick={() => { navigator.clipboard.writeText(url); setMenuOpen(null) }}
                  style={{ padding: '8px 14px', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fafaf7' }} onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}>
                  PAYLAŞIM LİNKİ KOPYALA
                </div>
                {/* // TODO: Başka brief'e kopyala — sonraki fazda */}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* STICKY SUMMARY BAR */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 28px', background: 'var(--color-background-secondary)', borderBottom: '1px solid var(--color-border-tertiary)' }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: '500' }}>KAMPANYA ADI</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', marginTop: '4px' }}>
            <strong>{totalVideos}</strong><span style={{ color: 'var(--color-text-tertiary)' }}> onaylı çıktı</span>
            {draftCount > 0 && <><span style={{ color: 'var(--color-text-tertiary)' }}> · </span><strong>{draftCount}</strong><span style={{ color: 'var(--color-text-tertiary)' }}> taslak</span></>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={copyLink}
            style={{ padding: '8px 14px', border: '1px solid #0a0a0a', background: 'transparent', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: '#0a0a0a', cursor: 'pointer' }}>
            {linkCopied ? 'KOPYALANDI ✓' : 'PAYLAŞIM LİNKİ'}
          </button>
          <div style={{ padding: '7px 14px', border: '1px solid #f5a623', background: 'rgba(245,166,35,0.1)', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '600', color: '#0a0a0a' }}>
            TOPLAM {totalCredits} KREDİ
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: '28px' }}>

        {/* VIDEOS SECTION */}
        {totalVideos > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '600', color: 'var(--color-text-primary)' }}>VİDEOLAR · {totalVideos}</div>
            </div>

            {/* Main Video */}
            {approvedVideos.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>ANA VİDEO · {approvedVideos.length} video</div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {approvedVideos.map((v: any, i: number) => (
                    <VideoThumb key={v.id} id={`main-${v.id}`} url={v.video_url} label={`V${v.version}`} width={280} />
                  ))}
                </div>
              </div>
            )}

            {/* CPS Videos */}
            {deliveredCps.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>CPS PAKETİ · {deliveredCps.length} video</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                  {deliveredCps.map((c: any, i: number) => {
                    const vid = c.video_submissions?.[0]
                    if (!vid?.video_url) return null
                    return <VideoThumb key={c.id} id={`cps-${c.id}`} url={vid.video_url} label={c.cps_hook ? `Yön ${i + 1} · ${c.cps_hook}` : `Yön ${i + 1}`} />
                  })}
                </div>
              </div>
            )}

            {/* AI Express Videos */}
            {deliveredAi.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>AI EXPRESS · {deliveredAi.length} video</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                  {deliveredAi.map((c: any, i: number) => (
                    <VideoThumb key={c.id} id={`ai-${c.id}`} url={c.ai_video_url} label={`Versiyon ${i + 1}`} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* IMAGES SECTION */}
        {hasStaticImages && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderTop: '1px solid var(--color-border-tertiary)', paddingTop: '28px' }}>
              <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '600', color: 'var(--color-text-primary)' }}>GÖRSELLER · 5 FORMAT</div>
              <a href={brief.static_images_url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', textDecoration: 'underline', cursor: 'pointer' }}>
                GÖRSELLERİ İNDİR
              </a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {['9:16 Reel', '4:5 IG', '1:1 Kare', '16:9 Yatay', '1200x628'].map((fmt, i) => (
                <div key={fmt} style={{ border: '1px solid var(--color-border-tertiary)', background: '#f5f4f0', aspectRatio: ['9/16', '4/5', '1/1', '16/9', '1.91/1'][i], display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{fmt}</span>
                  <div style={{ position: 'absolute', bottom: '6px', left: '6px', padding: '2px 6px', background: '#fff', border: '1px solid #0a0a0a', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: '500' }}>{fmt.split(' ')[0]}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {totalVideos === 0 && !hasStaticImages && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-tertiary)', fontSize: '13px' }}>Henüz teslim edilen içerik yok</div>
        )}
      </div>

      {/* LIGHTBOX */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: '20px', right: '20px', width: '36px', height: '36px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>&#215;</button>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
            {lightbox.type === 'video' ? (
              <video src={lightbox.url} controls autoPlay style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'block' }} />
            ) : (
              <img src={lightbox.url} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', display: 'block' }} />
            )}
          </div>
        </div>
      )}
    </>
  )
}
