'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const FEATURES = ['express', 'animation', 'persona', 'static_image'] as const
const FEATURE_LABELS: Record<string, string> = { express: 'Express', animation: 'Animation', persona: 'Persona', static_image: 'Static Image' }
const ASPECTS = ['9:16', '1:1', '16:9', '4:5', '2:3'] as const
const POSITIONS = ['top-left','top-center','top-right','middle-left','middle-center','middle-right','bottom-left','bottom-center','bottom-right'] as const
const REVEALS = ['none','fade','slide-up','slide-down','slide-left','slide-right','scale-in','blur-in'] as const

const DEFAULT_LOGO = { size_percent: 50, position: 'middle-center', margin_x: 0, margin_y: 0, opacity: 85, shadow_enabled: false, shadow_softness: 8, reveal_effect: 'none', reveal_duration_ms: 0, show_from_end_s: 2.0 }
const DEFAULT_CTA = { font: 'default', font_size_percent: 6, color: '#ffffff', bg_mode: 'transparent', bg_color: '#000000', bg_opacity: 50, position: 'custom', margin_x: 15, margin_y: 65, padding_x: 0, padding_y: 0, border_radius: 0, shadow_enabled: true, shadow_softness: 4, reveal_effect: 'none', reveal_duration_ms: 0, show_from_end_s: 2.5 }

function getSettings(allSettings: any, feature: string, aspect: string) {
  return {
    logo: { ...DEFAULT_LOGO, ...(allSettings?.[feature]?.[aspect]?.logo || {}) },
    cta: { ...DEFAULT_CTA, ...(allSettings?.[feature]?.[aspect]?.cta || {}) },
  }
}

// ── 9-Grid Position Picker ──────────────────────────────────────────────────
function PositionGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px', width: '84px' }}>
      {POSITIONS.map(pos => (
        <div key={pos} onClick={() => onChange(pos)}
          style={{ width: '26px', height: '26px', border: value === pos ? '2px solid #8b5cf6' : '1px solid #ccc', background: value === pos ? 'rgba(139,92,246,0.1)' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '6px', height: '6px', background: value === pos ? '#8b5cf6' : '#ccc' }} />
        </div>
      ))}
    </div>
  )
}

// ── Number Input ────────────────────────────────────────────────────────────
function NumInput({ label, value, onChange, min = 0, max = 100, step = 1, suffix = '' }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input type="number" value={value} onChange={e => onChange(Math.min(max, Math.max(min, parseFloat(e.target.value) || 0)))} min={min} max={max} step={step} style={{ width: '70px', padding: '4px 6px', border: '1px solid #e5e4db', fontSize: '12px', boxSizing: 'border-box' }} />
        {suffix && <span style={{ fontSize: '10px', color: '#aaa' }}>{suffix}</span>}
      </div>
    </div>
  )
}

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function BrandOverlayStudio({ clientId }: { clientId: string }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [allSettings, setAllSettings] = useState<any>({})
  const [activeFeature, setActiveFeature] = useState<string>('express')
  const [activeAspect, setActiveAspect] = useState<string>('9:16')
  const [saving, setSaving] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('clients').select('brand_overlay_settings, brand_overlay_preview_url').eq('id', clientId).single().then(({ data }) => {
      if (data?.brand_overlay_settings) setAllSettings(data.brand_overlay_settings)
      if (data?.brand_overlay_preview_url) setPreviewUrl(data.brand_overlay_preview_url)
    })
  }, [clientId])

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

  function importFromAspect(sourceAspect: string) {
    const source = getSettings(allSettings, activeFeature, sourceAspect)
    setAllSettings((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev || {}))
      if (!next[activeFeature]) next[activeFeature] = {}
      next[activeFeature][activeAspect] = { logo: { ...source.logo }, cta: { ...source.cta } }
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/admin/clients/${clientId}/overlay-settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brand_overlay_settings: allSettings }) })
    setSaving(false); setModalOpen(false)
  }

  async function handlePreviewUpload() {
    const file = fileRef.current?.files?.[0]; if (!file) return
    setUploading(true)
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch(`/api/admin/clients/${clientId}/overlay-preview-upload`, { method: 'POST', body: fd })
    const data = await res.json()
    if (data.preview_url) setPreviewUrl(data.preview_url)
    setUploading(false)
  }

  // ── CARD ────────────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '6px' }}>MARKA GORSEL KIMLIGI</div>
        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '14px' }}>Logo + CTA ayarlarini her ozellik ve aspect icin yonet</div>
        <button onClick={() => setModalOpen(true)} style={{ padding: '7px 16px', background: '#0a0a0a', color: '#fff', border: 'none', fontSize: '11px', cursor: 'pointer' }}>Duzenle</button>
      </div>

      {/* ── MODAL ──────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '95vw', maxWidth: '1100px', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* HEADER */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e4db', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>Marka Gorsel Kimligi</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSave} disabled={saving} style={{ padding: '6px 16px', background: '#0a0a0a', color: '#fff', border: 'none', fontSize: '11px', cursor: 'pointer' }}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
                <button onClick={() => setModalOpen(false)} style={{ width: '32px', height: '32px', border: '1px solid #e5e4db', background: '#fff', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
              </div>
            </div>

            {/* BODY */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* LEFT: Feature tabs */}
              <div style={{ width: '140px', borderRight: '1px solid #e5e4db', padding: '12px 0', flexShrink: 0, overflowY: 'auto' }}>
                {FEATURES.map(f => (
                  <div key={f} onClick={() => { setActiveFeature(f); if (f === 'persona') setActiveAspect('9:16') }}
                    style={{ padding: '10px 16px', fontSize: '12px', fontWeight: activeFeature === f ? '600' : '400', color: activeFeature === f ? '#0a0a0a' : '#888', background: activeFeature === f ? '#f5f4f0' : 'transparent', cursor: 'pointer', borderLeft: activeFeature === f ? '3px solid #8b5cf6' : '3px solid transparent' }}>
                    {FEATURE_LABELS[f]}
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #e5e4db', margin: '12px 16px', paddingTop: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#888', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Preview</div>
                  <div style={{ width: '100%', aspectRatio: '9/16', background: '#0a0a0a', overflow: 'hidden', marginBottom: '6px', cursor: 'pointer', position: 'relative' }} onClick={() => fileRef.current?.click()}>
                    {previewUrl ? <video src={previewUrl} muted loop playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#333' }}>+</div>}
                  </div>
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: '100%', padding: '4px', background: '#fff', border: '1px solid #e5e4db', fontSize: '9px', cursor: 'pointer', color: '#555' }}>{uploading ? 'Yukleniyor...' : previewUrl ? 'Degistir' : 'Video Yukle'}</button>
                  <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handlePreviewUpload} />
                </div>
              </div>

              {/* RIGHT: Settings panel */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                {/* Aspect selector */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', alignItems: 'center' }}>
                  {(availableAspects as readonly string[]).map(a => (
                    <button key={a} onClick={() => setActiveAspect(a)}
                      style={{ padding: '5px 12px', border: activeAspect === a ? '2px solid #8b5cf6' : '1px solid #e5e4db', background: activeAspect === a ? 'rgba(139,92,246,0.05)' : '#fff', fontSize: '11px', fontWeight: activeAspect === a ? '600' : '400', cursor: 'pointer' }}>{a}</button>
                  ))}
                  {!isPersona && activeAspect !== '9:16' && (
                    <button onClick={() => importFromAspect('9:16')} style={{ padding: '5px 12px', border: '1px dashed #ccc', background: '#fff', fontSize: '10px', color: '#888', cursor: 'pointer' }}>9:16'dan kopyala</button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  {/* LOGO SECTION (Persona'da yok) */}
                  {!isPersona && (
                    <div style={{ flex: '1 1 280px', minWidth: '280px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#0a0a0a', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Logo</div>
                      <NumInput label="Boy" value={current.logo.size_percent} onChange={v => updateField('logo', 'size_percent', v)} min={5} max={80} suffix="% video genisligi" />
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Konum</div>
                        <PositionGrid value={current.logo.position} onChange={v => updateField('logo', 'position', v)} />
                      </div>
                      <NumInput label="Margin X" value={current.logo.margin_x} onChange={v => updateField('logo', 'margin_x', v)} max={200} suffix="px" />
                      <NumInput label="Margin Y" value={current.logo.margin_y} onChange={v => updateField('logo', 'margin_y', v)} max={200} suffix="px" />
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>Opacity</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input type="range" min={0} max={100} value={current.logo.opacity} onChange={e => updateField('logo', 'opacity', parseInt(e.target.value))} style={{ flex: 1 }} />
                          <span style={{ fontSize: '11px', color: '#555', width: '30px' }}>{current.logo.opacity}%</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <input type="checkbox" checked={current.logo.shadow_enabled} onChange={e => updateField('logo', 'shadow_enabled', e.target.checked)} />
                        <span style={{ fontSize: '11px', color: '#555' }}>Golge</span>
                        {current.logo.shadow_enabled && <NumInput label="" value={current.logo.shadow_softness} onChange={v => updateField('logo', 'shadow_softness', v)} max={30} suffix="px" />}
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>Reveal</div>
                        <select value={current.logo.reveal_effect} onChange={e => updateField('logo', 'reveal_effect', e.target.value)} style={{ width: '100%', padding: '4px 6px', border: '1px solid #e5e4db', fontSize: '11px' }}>
                          {REVEALS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      {current.logo.reveal_effect !== 'none' && <NumInput label="Reveal suresi" value={current.logo.reveal_duration_ms} onChange={v => updateField('logo', 'reveal_duration_ms', v)} max={2000} step={100} suffix="ms" />}
                      <NumInput label="Son N saniye" value={current.logo.show_from_end_s} onChange={v => updateField('logo', 'show_from_end_s', v)} min={0.5} max={10} step={0.1} suffix="s" />
                    </div>
                  )}

                  {/* CTA SECTION */}
                  <div style={{ flex: '1 1 280px', minWidth: '280px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#0a0a0a', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>CTA</div>
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>Font</div>
                      <select value={current.cta.font} onChange={e => updateField('cta', 'font', e.target.value)} style={{ width: '100%', padding: '4px 6px', border: '1px solid #e5e4db', fontSize: '11px' }}>
                        <option value="default">Default (Arial)</option>
                        <option value="brand">Marka fontu</option>
                      </select>
                    </div>
                    <NumInput label="Font boyutu" value={current.cta.font_size_percent} onChange={v => updateField('cta', 'font_size_percent', v)} min={2} max={15} step={0.5} suffix="% video yuksekligi" />
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>Renk</div>
                      <input type="color" value={current.cta.color} onChange={e => updateField('cta', 'color', e.target.value)} style={{ width: '40px', height: '28px', border: '1px solid #e5e4db', cursor: 'pointer' }} />
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Arka plan</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <label style={{ fontSize: '11px', cursor: 'pointer' }}><input type="radio" name={`bg-${activeFeature}-${activeAspect}`} checked={current.cta.bg_mode === 'transparent'} onChange={() => updateField('cta', 'bg_mode', 'transparent')} /> Seffaf</label>
                        <label style={{ fontSize: '11px', cursor: 'pointer' }}><input type="radio" name={`bg-${activeFeature}-${activeAspect}`} checked={current.cta.bg_mode === 'solid'} onChange={() => updateField('cta', 'bg_mode', 'solid')} /> Dolgulu</label>
                      </div>
                    </div>
                    {current.cta.bg_mode === 'solid' && (
                      <>
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>BG renk</div>
                          <input type="color" value={current.cta.bg_color} onChange={e => updateField('cta', 'bg_color', e.target.value)} style={{ width: '40px', height: '28px', border: '1px solid #e5e4db', cursor: 'pointer' }} />
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>BG opacity</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input type="range" min={0} max={100} value={current.cta.bg_opacity} onChange={e => updateField('cta', 'bg_opacity', parseInt(e.target.value))} style={{ flex: 1 }} />
                            <span style={{ fontSize: '11px', color: '#555', width: '30px' }}>{current.cta.bg_opacity}%</span>
                          </div>
                        </div>
                      </>
                    )}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Konum</div>
                      <PositionGrid value={current.cta.position === 'custom' ? 'bottom-left' : current.cta.position} onChange={v => updateField('cta', 'position', v)} />
                    </div>
                    <NumInput label="Margin X" value={current.cta.margin_x} onChange={v => updateField('cta', 'margin_x', v)} max={200} suffix="px" />
                    <NumInput label="Margin Y" value={current.cta.margin_y} onChange={v => updateField('cta', 'margin_y', v)} max={200} suffix="px" />
                    <NumInput label="Padding X" value={current.cta.padding_x} onChange={v => updateField('cta', 'padding_x', v)} max={50} suffix="px" />
                    <NumInput label="Padding Y" value={current.cta.padding_y} onChange={v => updateField('cta', 'padding_y', v)} max={50} suffix="px" />
                    <NumInput label="Border radius" value={current.cta.border_radius} onChange={v => updateField('cta', 'border_radius', v)} max={50} suffix="px" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <input type="checkbox" checked={current.cta.shadow_enabled} onChange={e => updateField('cta', 'shadow_enabled', e.target.checked)} />
                      <span style={{ fontSize: '11px', color: '#555' }}>Golge</span>
                      {current.cta.shadow_enabled && <NumInput label="" value={current.cta.shadow_softness} onChange={v => updateField('cta', 'shadow_softness', v)} max={30} suffix="px" />}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>Reveal</div>
                      <select value={current.cta.reveal_effect} onChange={e => updateField('cta', 'reveal_effect', e.target.value)} style={{ width: '100%', padding: '4px 6px', border: '1px solid #e5e4db', fontSize: '11px' }}>
                        {REVEALS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    {current.cta.reveal_effect !== 'none' && <NumInput label="Reveal suresi" value={current.cta.reveal_duration_ms} onChange={v => updateField('cta', 'reveal_duration_ms', v)} max={2000} step={100} suffix="ms" />}
                    <NumInput label="Son N saniye" value={current.cta.show_from_end_s} onChange={v => updateField('cta', 'show_from_end_s', v)} min={0.5} max={10} step={0.1} suffix="s" />
                  </div>
                </div>

                <div style={{ fontSize: '10px', color: '#aaa', marginTop: '16px', borderTop: '1px solid #e5e4db', paddingTop: '12px' }}>Preview Parca 3'te canli olacak. Simdilik ayarlari kaydedin, pipeline uretimde kullanir.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
