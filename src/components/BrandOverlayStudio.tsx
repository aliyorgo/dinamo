'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const FEATURES = ['express', 'animation', 'persona', 'static_image'] as const
const FEATURE_LABELS: Record<string, string> = { express: 'Express', animation: 'Animation', persona: 'Persona', static_image: 'Static Image' }
const ASPECTS = ['9:16', '1:1', '16:9', '4:5', '2:3'] as const
const POSITIONS = ['top-left','top-center','top-right','middle-left','middle-center','middle-right','bottom-left','bottom-center','bottom-right'] as const
const REVEALS = ['none','fade','slide-up','slide-down','slide-left','slide-right','scale-in','blur-in'] as const

const DEFAULT_LOGO = { size_percent: 50, position: 'middle-center', margin_x_percent: 0, margin_y_percent: 0, opacity: 85, shadow_enabled: false, shadow_softness: 8, reveal_effect: 'none', reveal_duration_ms: 0, show_from_end_s: 2.0 }
const DEFAULT_CTA = { font: 'default', font_size_percent: 6, color: '#ffffff', bg_mode: 'transparent', bg_color: '#000000', bg_opacity: 50, position: 'custom', margin_x_percent: 15, margin_y_percent: 65, padding_x_percent: 0, padding_y_percent: 0, border_radius: 0, shadow_enabled: true, shadow_softness: 4, reveal_effect: 'none', reveal_duration_ms: 0, show_from_s: 5, hide_at_s: 15, show_until_end: false }

function getSettings(s: any, f: string, a: string) {
  return { logo: { ...DEFAULT_LOGO, ...(s?.[f]?.[a]?.logo || {}) }, cta: { ...DEFAULT_CTA, ...(s?.[f]?.[a]?.cta || {}) } }
}

// ── Position helpers ────────────────────────────────────────────────────────
function PositionGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px', width: '84px' }}>
      {POSITIONS.map(pos => (
        <div key={pos} onClick={() => onChange(pos)} style={{ width: '26px', height: '26px', border: value === pos ? '2px solid #8b5cf6' : '1px solid #ccc', background: value === pos ? 'rgba(139,92,246,0.1)' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '6px', height: '6px', background: value === pos ? '#8b5cf6' : '#ccc' }} />
        </div>
      ))}
    </div>
  )
}

function positionToCSS(pos: string, mxPct: number, myPct: number): React.CSSProperties {
  if (pos === 'custom') return { left: `${mxPct}%`, top: `${myPct}%` }
  const p: Record<string, React.CSSProperties> = {
    'top-left': { top: `${myPct}%`, left: `${mxPct}%` }, 'top-center': { top: `${myPct}%`, left: '50%', transform: 'translateX(-50%)' }, 'top-right': { top: `${myPct}%`, right: `${mxPct}%` },
    'middle-left': { top: '50%', left: `${mxPct}%`, transform: 'translateY(-50%)' }, 'middle-center': { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }, 'middle-right': { top: '50%', right: `${mxPct}%`, transform: 'translateY(-50%)' },
    'bottom-left': { bottom: `${myPct}%`, left: `${mxPct}%` }, 'bottom-center': { bottom: `${myPct}%`, left: '50%', transform: 'translateX(-50%)' }, 'bottom-right': { bottom: `${myPct}%`, right: `${mxPct}%` },
  }
  return p[pos] || p['middle-center']
}

function NumInput({ label, value, onChange, min = 0, max = 100, step = 1, suffix = '' }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <div style={{ marginBottom: '8px' }}>
      {label && <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input type="number" value={value} onChange={e => onChange(Math.min(max, Math.max(min, parseFloat(e.target.value) || 0)))} min={min} max={max} step={step} style={{ width: '70px', padding: '4px 6px', border: '1px solid #e5e4db', fontSize: '12px', boxSizing: 'border-box' }} />
        {suffix && <span style={{ fontSize: '10px', color: '#aaa' }}>{suffix}</span>}
      </div>
    </div>
  )
}

// ── LIVE PREVIEW ────────────────────────────────────────────────────────────
function LivePreview({ logoSettings, ctaSettings, aspect, previewUrl, logoUrl, isPersona, hasBrandFont }: { logoSettings: any; ctaSettings: any; aspect: string; previewUrl: string; logoUrl: string; isPersona: boolean; hasBrandFont: boolean }) {
  const aspectRatio = aspect.replace(':', '/')
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 200, h: 356 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setDims({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [aspect])

  const ctaFontPx = Math.round(dims.h * (ctaSettings.font_size_percent / 100))

  const logoCSS: React.CSSProperties = {
    position: 'absolute', ...positionToCSS(logoSettings.position, logoSettings.margin_x_percent ?? logoSettings.margin_x ?? 0, logoSettings.margin_y_percent ?? logoSettings.margin_y ?? 0),
    width: `${logoSettings.size_percent}%`, opacity: logoSettings.opacity / 100, pointerEvents: 'none',
    ...(logoSettings.shadow_enabled ? { filter: `drop-shadow(0 2px ${logoSettings.shadow_softness}px rgba(0,0,0,0.5))` } : {}),
  }

  const ctaPadX = Math.round(dims.w * ((ctaSettings.padding_x_percent ?? ctaSettings.padding_x ?? 0) / 100))
  const ctaPadY = Math.round(dims.h * ((ctaSettings.padding_y_percent ?? ctaSettings.padding_y ?? 0) / 100))
  const ctaCSS: React.CSSProperties = {
    position: 'absolute', ...positionToCSS(ctaSettings.position, ctaSettings.margin_x_percent ?? ctaSettings.margin_x ?? 15, ctaSettings.margin_y_percent ?? ctaSettings.margin_y ?? 65),
    fontSize: `${ctaFontPx}px`, fontFamily: (ctaSettings.font === 'brand' && hasBrandFont) ? "'BrandFont', Arial, sans-serif" : "'Inter', Arial, sans-serif", color: ctaSettings.color, fontWeight: 'bold', pointerEvents: 'none', lineHeight: 1.2, maxWidth: '80%',
    ...(ctaSettings.bg_mode === 'solid' ? { background: ctaSettings.bg_color, padding: `${ctaPadY}px ${ctaPadX}px`, borderRadius: `${ctaSettings.border_radius}px`, opacity: ctaSettings.bg_opacity / 100 } : {}),
    ...(ctaSettings.shadow_enabled ? { textShadow: `0 2px ${ctaSettings.shadow_softness}px rgba(0,0,0,0.6)` } : {}),
  }

  return (
    <div ref={containerRef} style={{ width: '100%', maxWidth: '200px', aspectRatio, background: '#0a0a0a', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      {previewUrl ? (
        <video src={previewUrl} muted loop playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a' }}>
          <span style={{ fontSize: '10px', color: '#555' }}>Video yukleyin</span>
        </div>
      )}
      {!isPersona && logoUrl && <img src={logoUrl} style={logoCSS} />}
      <div style={ctaCSS}>Ornek CTA</div>
    </div>
  )
}

// ── MAIN ────────────────────────────────────────────────────────────────────
export default function BrandOverlayStudio({ clientId }: { clientId: string }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [allSettings, setAllSettings] = useState<any>({})
  const [activeFeature, setActiveFeature] = useState<string>('express')
  const [activeAspect, setActiveAspect] = useState<string>('9:16')
  const [saving, setSaving] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [brandFontUrl, setBrandFontUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('clients').select('brand_overlay_settings, brand_overlay_preview_url, brand_logo_url, brand_font_url').eq('id', clientId).single().then(({ data }) => {
      if (data?.brand_overlay_settings) setAllSettings(data.brand_overlay_settings)
      if (data?.brand_overlay_preview_url) setPreviewUrl(data.brand_overlay_preview_url)
      if (data?.brand_logo_url) setLogoUrl(data.brand_logo_url)
      if (data?.brand_font_url) setBrandFontUrl(data.brand_font_url)
    })
  }, [clientId])

  // Brand font @font-face injection
  useEffect(() => {
    if (!brandFontUrl) return
    const id = 'brand-overlay-font'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `@font-face { font-family: 'BrandFont'; src: url('${brandFontUrl}'); font-display: swap; }`
    document.head.appendChild(style)
    return () => { document.getElementById(id)?.remove() }
  }, [brandFontUrl])

  const current = getSettings(allSettings, activeFeature, activeAspect)
  const isPersona = activeFeature === 'persona'
  const availableAspects = isPersona ? ['9:16'] : ASPECTS

  function updateField(section: 'logo' | 'cta', field: string, value: any) {
    setAllSettings((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev || {}))
      if (!next[activeFeature]) next[activeFeature] = {}
      if (!next[activeFeature][activeAspect]) next[activeFeature][activeAspect] = {}
      if (!next[activeFeature][activeAspect][section]) next[activeFeature][activeAspect][section] = {}
      next[activeFeature][activeAspect][section][field] = value
      return next
    })
  }

  function importFromAspect(src: string) {
    const source = getSettings(allSettings, activeFeature, src)
    setAllSettings((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev || {}))
      if (!next[activeFeature]) next[activeFeature] = {}
      next[activeFeature][activeAspect] = { logo: { ...source.logo }, cta: { ...source.cta } }
      return next
    })
  }

  async function handleSave() { setSaving(true); await fetch(`/api/admin/clients/${clientId}/overlay-settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brand_overlay_settings: allSettings }) }); setSaving(false); setModalOpen(false); window.location.reload() }

  async function handlePreviewUpload() {
    const file = fileRef.current?.files?.[0]; if (!file) return; setUploading(true)
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch(`/api/admin/clients/${clientId}/overlay-preview-upload`, { method: 'POST', body: fd })
    const data = await res.json(); if (data.preview_url) setPreviewUrl(data.preview_url); setUploading(false)
  }

  return (
    <>
      <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '6px' }}>MARKA GORSEL KIMLIGI</div>
        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '14px' }}>Logo + CTA overlay ayarlari (Express, Animation, Persona, Static Image)</div>
        <button onClick={() => setModalOpen(true)} style={{ padding: '7px 16px', background: '#0a0a0a', color: '#fff', border: 'none', fontSize: '11px', cursor: 'pointer' }}>Duzenle</button>
      </div>

      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '95vw', maxWidth: '1200px', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* HEADER */}
            <div style={{ padding: '14px 24px', borderBottom: '1px solid #e5e4db', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: '600' }}>Marka Gorsel Kimligi</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSave} disabled={saving} style={{ padding: '6px 16px', background: '#0a0a0a', color: '#fff', border: 'none', fontSize: '11px', cursor: 'pointer' }}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
                <button onClick={() => setModalOpen(false)} style={{ width: '32px', height: '32px', border: '1px solid #e5e4db', background: '#fff', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
              </div>
            </div>

            {/* BODY: tabs | settings | preview */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* LEFT: Feature tabs */}
              <div style={{ width: '120px', borderRight: '1px solid #e5e4db', padding: '12px 0', flexShrink: 0 }}>
                {FEATURES.map(f => (
                  <div key={f} onClick={() => { setActiveFeature(f); if (f === 'persona') setActiveAspect('9:16') }}
                    style={{ padding: '10px 14px', fontSize: '11px', fontWeight: activeFeature === f ? '600' : '400', color: activeFeature === f ? '#0a0a0a' : '#888', background: activeFeature === f ? '#f5f4f0' : 'transparent', cursor: 'pointer', borderLeft: activeFeature === f ? '3px solid #8b5cf6' : '3px solid transparent' }}>
                    {FEATURE_LABELS[f]}
                  </div>
                ))}
              </div>

              {/* CENTER: Settings */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', borderRight: '1px solid #e5e4db' }}>
                {/* Aspect selector */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {(availableAspects as readonly string[]).map(a => (
                    <button key={a} onClick={() => setActiveAspect(a)} style={{ padding: '4px 10px', border: activeAspect === a ? '2px solid #8b5cf6' : '1px solid #e5e4db', background: activeAspect === a ? 'rgba(139,92,246,0.05)' : '#fff', fontSize: '10px', fontWeight: activeAspect === a ? '600' : '400', cursor: 'pointer' }}>{a}</button>
                  ))}
                  {!isPersona && activeAspect !== '9:16' && <button onClick={() => importFromAspect('9:16')} style={{ padding: '4px 10px', border: '1px dashed #ccc', fontSize: '9px', color: '#888', cursor: 'pointer', background: '#fff' }}>9:16'dan kopyala</button>}
                </div>

                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  {/* LOGO */}
                  {!isPersona && (
                    <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Logo</div>
                      <NumInput label="Boy" value={current.logo.size_percent} onChange={v => updateField('logo', 'size_percent', v)} min={5} max={80} suffix="%" />
                      <div style={{ marginBottom: '8px' }}><div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Konum</div><PositionGrid value={current.logo.position} onChange={v => updateField('logo', 'position', v)} /></div>
                      <NumInput label="Margin X" value={current.logo.margin_x_percent ?? current.logo.margin_x ?? 0} onChange={v => updateField('logo', 'margin_x_percent', v)} max={50} step={0.5} suffix="%" />
                      <NumInput label="Margin Y" value={current.logo.margin_y_percent ?? current.logo.margin_y ?? 0} onChange={v => updateField('logo', 'margin_y_percent', v)} max={50} step={0.5} suffix="%" />
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>Opacity</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="range" min={0} max={100} value={current.logo.opacity} onChange={e => updateField('logo', 'opacity', parseInt(e.target.value))} style={{ flex: 1 }} /><span style={{ fontSize: '10px', color: '#555', width: '28px' }}>{current.logo.opacity}%</span></div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}><input type="checkbox" checked={current.logo.shadow_enabled} onChange={e => updateField('logo', 'shadow_enabled', e.target.checked)} /><span style={{ fontSize: '10px' }}>Golge</span></div>
                      <div style={{ marginBottom: '6px' }}>
                        <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>Reveal</div>
                        <select value={current.logo.reveal_effect} onChange={e => updateField('logo', 'reveal_effect', e.target.value)} style={{ width: '100%', padding: '3px 6px', border: '1px solid #e5e4db', fontSize: '10px' }}>{REVEALS.map(r => <option key={r} value={r}>{r}</option>)}</select>
                      </div>
                      <NumInput label="Sondan kac sn once belirir" value={current.logo.show_from_end_s} onChange={v => updateField('logo', 'show_from_end_s', v)} min={0.5} max={10} step={0.1} suffix="s" />
                      <div style={{ fontSize: '9px', color: '#aaa' }}>Belirdikten sonra video sonuna kadar gorunur</div>
                    </div>
                  )}

                  {/* CTA */}
                  <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>CTA</div>
                    <div style={{ marginBottom: '6px' }}>
                      <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>Font</div>
                      <select value={current.cta.font} onChange={e => updateField('cta', 'font', e.target.value)} style={{ width: '100%', padding: '3px 6px', border: '1px solid #e5e4db', fontSize: '10px' }}><option value="default">Default (Arial)</option><option value="brand">Marka fontu</option></select>
                      {current.cta.font === 'brand' && !brandFontUrl && <div style={{ fontSize: '9px', color: '#ef4444', marginTop: '2px' }}>Marka fontu yuklenmemis</div>}
                    </div>
                    <NumInput label="Font boyutu" value={current.cta.font_size_percent} onChange={v => updateField('cta', 'font_size_percent', v)} min={2} max={15} step={0.5} suffix="%" />
                    <div style={{ marginBottom: '6px' }}><div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>Renk</div><input type="color" value={current.cta.color} onChange={e => updateField('cta', 'color', e.target.value)} style={{ width: '36px', height: '24px', border: '1px solid #e5e4db', cursor: 'pointer' }} /></div>
                    <div style={{ marginBottom: '6px' }}>
                      <div style={{ fontSize: '10px', color: '#888', marginBottom: '3px' }}>Arka plan</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <label style={{ fontSize: '10px', cursor: 'pointer' }}><input type="radio" name={`bg-${activeFeature}-${activeAspect}`} checked={current.cta.bg_mode === 'transparent'} onChange={() => updateField('cta', 'bg_mode', 'transparent')} /> Seffaf</label>
                        <label style={{ fontSize: '10px', cursor: 'pointer' }}><input type="radio" name={`bg-${activeFeature}-${activeAspect}`} checked={current.cta.bg_mode === 'solid'} onChange={() => updateField('cta', 'bg_mode', 'solid')} /> Dolgulu</label>
                      </div>
                    </div>
                    {current.cta.bg_mode === 'solid' && (<><div style={{ marginBottom: '6px' }}><div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>BG renk</div><input type="color" value={current.cta.bg_color} onChange={e => updateField('cta', 'bg_color', e.target.value)} style={{ width: '36px', height: '24px', border: '1px solid #e5e4db', cursor: 'pointer' }} /></div><div style={{ marginBottom: '6px' }}><div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>BG opacity</div><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="range" min={0} max={100} value={current.cta.bg_opacity} onChange={e => updateField('cta', 'bg_opacity', parseInt(e.target.value))} style={{ flex: 1 }} /><span style={{ fontSize: '10px', width: '28px' }}>{current.cta.bg_opacity}%</span></div></div></>)}
                    <div style={{ marginBottom: '6px' }}><div style={{ fontSize: '10px', color: '#888', marginBottom: '3px' }}>Konum</div><PositionGrid value={current.cta.position === 'custom' ? 'bottom-left' : current.cta.position} onChange={v => updateField('cta', 'position', v)} /></div>
                    <NumInput label="Margin X" value={current.cta.margin_x_percent ?? current.cta.margin_x ?? 15} onChange={v => updateField('cta', 'margin_x_percent', v)} max={50} step={0.5} suffix="%" />
                    <NumInput label="Margin Y" value={current.cta.margin_y_percent ?? current.cta.margin_y ?? 65} onChange={v => updateField('cta', 'margin_y_percent', v)} max={100} step={0.5} suffix="%" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}><input type="checkbox" checked={current.cta.shadow_enabled} onChange={e => updateField('cta', 'shadow_enabled', e.target.checked)} /><span style={{ fontSize: '10px' }}>Golge</span></div>
                    <div style={{ marginBottom: '6px' }}>
                      <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>Reveal</div>
                      <select value={current.cta.reveal_effect} onChange={e => updateField('cta', 'reveal_effect', e.target.value)} style={{ width: '100%', padding: '3px 6px', border: '1px solid #e5e4db', fontSize: '10px' }}>{REVEALS.map(r => <option key={r} value={r}>{r}</option>)}</select>
                    </div>
                    <NumInput label="Belirir (saniye)" value={current.cta.show_from_s || 5} onChange={v => updateField('cta', 'show_from_s', v)} min={0} max={30} step={0.1} suffix="s" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}><input type="checkbox" checked={current.cta.show_until_end || false} onChange={e => updateField('cta', 'show_until_end', e.target.checked)} /><span style={{ fontSize: '10px' }}>Sona kadar</span></div>
                    {!current.cta.show_until_end && <NumInput label="Kaybolur (saniye)" value={current.cta.hide_at_s || 15} onChange={v => updateField('cta', 'hide_at_s', v)} min={0} max={30} step={0.1} suffix="s" />}
                  </div>
                </div>
              </div>

              {/* RIGHT: Live Preview */}
              <div style={{ width: '240px', padding: '16px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Onizleme</div>
                <LivePreview logoSettings={current.logo} ctaSettings={current.cta} aspect={activeAspect} previewUrl={previewUrl} logoUrl={logoUrl} isPersona={isPersona} hasBrandFont={!!brandFontUrl} />
                <div style={{ width: '100%' }}>
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: '100%', padding: '5px', background: '#fff', border: '1px solid #e5e4db', fontSize: '9px', cursor: 'pointer', color: '#555' }}>{uploading ? 'Yukleniyor...' : previewUrl ? 'Video degistir' : 'Preview video yukle'}</button>
                  <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handlePreviewUpload} />
                </div>
                <div style={{ fontSize: '9px', color: '#aaa', textAlign: 'center' }}>Ayar degisiklikleri anlik yansir. Timing preview icin video yukleyin.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
