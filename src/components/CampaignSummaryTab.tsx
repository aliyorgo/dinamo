'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { generateCertificatePDF } from '@/lib/generate-certificate'
import { downloadCampaignZip } from '@/lib/campaign-zip'
import { pauseOtherVideos } from '@/lib/video-playback'
import { downloadFile } from '@/lib/download-helper'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface Props {
  brief: any
  companyName: string
  videos: any[]
  aiChildren: any[]
  cpsChildren: any[]
  ugcVideos?: any[]
  onRefresh?: () => void
  captionText: string
  setCaptionText: (v: string) => void
  savedCaption: string
  captionLoading: boolean
  captionToast: string
  onGenerateCaption: () => void
  onCaptionAction: () => void
  onRegenerateConfirm: () => void
}

function slugify(name: string): string {
  const map: Record<string, string> = { 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ı': 'i', 'ö': 'o', 'ç': 'c', 'Ğ': 'G', 'Ü': 'U', 'Ş': 'S', 'İ': 'I', 'Ö': 'O', 'Ç': 'C' }
  let s = name || ''
  for (const [k, v] of Object.entries(map)) s = s.replace(new RegExp(k, 'g'), v)
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export default function CampaignSummaryTab({ brief, companyName, videos, aiChildren, cpsChildren, ugcVideos = [], onRefresh, captionText, setCaptionText, savedCaption, captionLoading, captionToast, onGenerateCaption, onCaptionAction, onRegenerateConfirm }: Props) {
  const [lightbox, setLightbox] = useState<{ type: 'video' | 'image'; url: string } | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [zipping, setZipping] = useState(false)

  // Polling: auto-refresh when processing
  const hasProcessing = aiChildren.some(c => c.status === 'ai_processing') ||
    brief.static_images_job_status === 'processing' || brief.static_images_job_status === 'pending'
  useEffect(() => {
    if (!hasProcessing || !onRefresh) return
    const interval = setInterval(onRefresh, 8000)
    return () => clearInterval(interval)
  }, [hasProcessing, onRefresh])

  const approvedVideos = videos.filter(v => ['producer_approved', 'admin_approved'].includes(v.status))
  const deliveredAi = aiChildren.filter(c => c.status === 'delivered' && c.ai_video_url)
  const deliveredCps = cpsChildren.filter((c: any) => c.video_submissions?.length > 0)

  const totalVideos = approvedVideos.length + deliveredAi.length + deliveredCps.length + ugcVideos.length
  const draftCount = aiChildren.filter(c => c.status !== 'delivered' && c.ai_video_url).length + cpsChildren.filter((c: any) => !c.video_submissions?.length).length
  const hasStaticImages = !!(brief.static_images_url && brief.ai_video_url)
  const aiWithImages = aiChildren.filter(c => c.status === 'delivered' && c.static_image_files && (Array.isArray(c.static_image_files) ? c.static_image_files.length > 0 : Object.keys(c.static_image_files).length > 0))
  const ugcWithImages = ugcVideos.filter(v => v.status === 'sold' && (v.static_images_url || v.static_image_files))
  const hasAnyImages = hasStaticImages || aiWithImages.length > 0 || ugcWithImages.length > 0
  // TODO: CPS child görsel üretimi sonraki fazda — cpsChildren.filter(c => c.static_image_files) eklenecek

  const totalCredits = (brief.credit_cost || 0) +
    aiChildren.reduce((s: number, c: any) => s + (c.credit_cost || 0), 0) +
    cpsChildren.reduce((s: number, c: any) => s + (c.credit_cost || 0), 0) +
    ugcVideos.reduce((s: number, v: any) => s + (v.credit_cost || 0), 0)

  function copyLink() {
    const url = `${window.location.origin}/share/${brief.id}`
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
          <button onClick={() => downloadFile(url, `${label.replace(/\s+/g,'_')}.mp4`)}
            style={{ flex: 1, textAlign: 'center', padding: '5px 8px', border: '1px solid #0a0a0a', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: '#0a0a0a', background: 'transparent', cursor: 'pointer' }}>
            İNDİR ↓
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(menuOpen === id ? null : id)}
              style={{ width: '30px', height: '100%', border: '1px solid #0a0a0a', background: 'transparent', fontSize: '14px', cursor: 'pointer', color: '#0a0a0a' }}>⋯</button>
            {menuOpen === id && (
              <div style={{ position: 'absolute', top: '100%', right: 0, background: '#fff', border: '1px solid #0a0a0a', padding: '4px', zIndex: 100, minWidth: '180px' }}
                onMouseLeave={() => setMenuOpen(null)}>
                <div onClick={() => { generateCertificatePDF(brief, companyName, (brief as any)?.clients?.legal_name); setMenuOpen(null) }}
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
          <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--color-text-primary)' }}>{brief.campaign_name}</div>
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
          <button onClick={async () => {
            if (zipping) return
            setZipping(true)
            try { await downloadCampaignZip(brief.id) } catch (e) { console.error(e) }
            setZipping(false)
          }} disabled={zipping}
            style={{ padding: '8px 14px', border: '1px solid #0a0a0a', background: '#0a0a0a', color: '#fff', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', cursor: zipping ? 'wait' : 'pointer', opacity: zipping ? 0.6 : 1 }}>
            {zipping ? 'HAZIRLANIYOR...' : 'TÜMÜNÜ ZİP İNDİR ↓'}
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

            {/* Main Video + Caption */}
            {approvedVideos.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>ANA VİDEO · {approvedVideos.length} video</div>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {approvedVideos.map((v: any, i: number) => (
                      <VideoThumb key={v.id} id={`main-${v.id}`} url={v.video_url} label={`V${v.version}`} width={280} aspect={(brief.format||'9:16').replace(':','/')} />
                    ))}
                  </div>
                  {brief.status === 'delivered' && (
                    <div style={{ flex: '1 1 260px', maxWidth: '360px', border: '1px solid #0a0a0a', background: '#fff', padding: '16px 18px' }}>
                      <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>SOSYAL MEDYA CAPTION'I</div>
                      {!captionText && !captionLoading ? (
                        <button onClick={onGenerateCaption} className="btn" style={{ padding: '8px 16px' }}>CAPTION ÜRET</button>
                      ) : (
                        <>
                          <textarea value={captionText} onChange={e => { if (e.target.value.length <= 2200) setCaptionText(e.target.value) }}
                            maxLength={2200} rows={4} disabled={captionLoading}
                            style={{ width: '100%', padding: '10px', border: '1px solid #0a0a0a', fontSize: '13px', color: '#0a0a0a', lineHeight: '1.6', resize: 'vertical', boxSizing: 'border-box', opacity: captionLoading ? 0.5 : 1 }}
                            placeholder={captionLoading ? 'Üretiliyor...' : 'Caption yazın...'} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                            <div style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--color-text-tertiary)' }}>{captionText.length} / 2200</div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={onRegenerateConfirm} className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '10px' }} disabled={captionLoading}>YENİDEN ÜRET</button>
                              <button onClick={onCaptionAction} className="btn" style={{ padding: '4px 10px', fontSize: '10px' }} disabled={!captionText.trim()}>
                                {captionToast ? (captionToast + ' ✓') : (captionText !== savedCaption ? 'KAYDET VE KOPYALA' : 'KOPYALA')}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
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
                    return <VideoThumb key={c.id} id={`cps-${c.id}`} url={vid.video_url} label={c.cps_hook ? `Yön ${i + 1} · ${c.cps_hook}` : `Yön ${i + 1}`} aspect={(c.format||brief.format||'9:16').replace(':','/')} />
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
                    <VideoThumb key={c.id} id={`ai-${c.id}`} url={c.ai_video_url} label={`Versiyon ${i + 1}`} aspect={(c.format||brief.format||'9:16').replace(':','/')} />
                  ))}
                </div>
              </div>
            )}

            {/* AI Persona Videos */}
            {ugcVideos.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>AI PERSONA · {ugcVideos.length} video</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                  {ugcVideos.map((v: any, i: number) => (
                    <VideoThumb key={v.id} id={`ugc-${v.id}`} url={v.final_url} label={`V${i + 1} — ${v.personas?.name || 'Persona'}`} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* IMAGES SECTION */}
        {hasAnyImages && (() => {
          function getImageUrl(raw: any, fallbackUrl?: string): string | null {
            if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.url) return raw.url
            if (fallbackUrl && typeof fallbackUrl === 'string' && /\.(png|jpg|jpeg|webp)$/i.test(fallbackUrl)) return fallbackUrl
            return null
          }
          const images: { label: string; url: string }[] = []
          const mainUrl = getImageUrl(brief.static_image_files, brief.static_images_url)
          if (mainUrl) images.push({ label: 'ANA VİDEO', url: mainUrl })
          aiWithImages.forEach((child: any) => {
            const idx = aiChildren.indexOf(child)
            const childUrl = getImageUrl(child.static_image_files, child.static_images_url)
            if (childUrl) images.push({ label: `AI EXPRESS V${idx + 1}`, url: childUrl })
          })
          ugcWithImages.forEach((video: any, i: number) => {
            const url = getImageUrl(video.static_image_files, video.static_images_url)
            if (url) images.push({ label: `AI PERSONA V${i + 1}`, url })
          })
          if (images.length === 0) return null
          return (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderTop: '1px solid var(--color-border-tertiary)', paddingTop: '28px' }}>
                <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '600', color: 'var(--color-text-primary)' }}>GÖRSELLER · {images.length}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: images.length === 1 ? 'min(320px, 100%)' : `repeat(${Math.min(images.length, 3)}, 1fr)`, gap: '16px', marginBottom: '28px' }}>
                {images.map((img, i) => (
                  <div key={i}>
                    <div onClick={() => setLightbox({ type: 'image', url: img.url })}
                      style={{ border: '1px solid var(--color-border-tertiary)', background: '#f5f4f0', aspectRatio: '4/5', overflow: 'hidden', cursor: 'pointer' }}>
                      <img src={img.url} alt={img.label} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                    <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: '500', marginTop: '6px' }}>{img.label}</div>
                    <button onClick={() => downloadFile(img.url, `${slugify(img.label)}_gorsel.png`)}
                      style={{ display: 'block', width: '100%', textAlign: 'center', padding: '6px 12px', border: '1px solid #0a0a0a', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: '#0a0a0a', background: 'transparent', cursor: 'pointer', marginTop: '6px' }}>
                      İNDİR ↓
                    </button>
                  </div>
                ))}
              </div>
            </>
          )
        })()}

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
              <video src={lightbox.url} controls autoPlay onPlay={e=>pauseOtherVideos(e.currentTarget)} style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'block' }} />
            ) : (
              <img src={lightbox.url} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', display: 'block' }} />
            )}
          </div>
        </div>
      )}
    </>
  )
}
