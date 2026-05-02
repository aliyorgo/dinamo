'use client'
import { useState, useEffect } from 'react'

export interface UGCSettings {
  watermark: boolean
  tone: 'samimi' | 'normal' | 'resmi'
  speed: 'yavas' | 'normal' | 'hizli'
  cta: boolean
  music: boolean
}

export const DEFAULT_SETTINGS: UGCSettings = {
  watermark: true,
  tone: 'samimi',
  speed: 'normal',
  cta: true,
  music: true,
}

interface Props {
  open: boolean
  onClose: () => void
  settings: UGCSettings
  onChange: (s: UGCSettings) => void
  brandDefaults?: { cta?: boolean; music?: boolean } | null
}

export default function UGCSettingsModal({ open, onClose, settings, onChange, brandDefaults }: Props) {
  if (!open) return null

  function reset() {
    onChange({
      ...DEFAULT_SETTINGS,
      cta: brandDefaults?.cta ?? DEFAULT_SETTINGS.cta,
      music: brandDefaults?.music ?? DEFAULT_SETTINGS.music,
    })
  }

  const TONE_LABELS = { samimi: 'Samimi', normal: 'Normal', resmi: 'Resmi' }
  const SPEED_LABELS = { yavas: 'Yavaş', normal: 'Normal', hizli: 'Hızlı' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid #0a0a0a', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflow: 'auto', padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#0a0a0a' }}>AI UGC AYARLARI</div>
          <button onClick={onClose} style={{ width: '28px', height: '28px', border: '1px solid #e5e4db', background: '#fff', color: '#0a0a0a', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Watermark */}
        <SettingRow label="AI Watermark" desc="Videoda 'Yapay Zeka Tarafından Yapılmıştır' işareti görünür">
          <Toggle value={settings.watermark} onChange={v => onChange({ ...settings, watermark: v })} />
        </SettingRow>

        {/* Tone */}
        <SettingRow label="Ton" desc="Anlatım dilinin tonunu belirler">
          <StepSlider
            options={['samimi', 'normal', 'resmi'] as const}
            labels={TONE_LABELS}
            value={settings.tone}
            onChange={v => onChange({ ...settings, tone: v })}
          />
        </SettingRow>

        {/* Speed */}
        <SettingRow label="Konuşma Hızı" desc="Persona'nın konuşma temposu">
          <StepSlider
            options={['yavas', 'normal', 'hizli'] as const}
            labels={SPEED_LABELS}
            value={settings.speed}
            onChange={v => onChange({ ...settings, speed: v })}
          />
        </SettingRow>

        {/* CTA */}
        <SettingRow label="CTA Dahil Et" desc="Son shot'ta harekete geçirici çağrı">
          <Toggle value={settings.cta} onChange={v => onChange({ ...settings, cta: v })} />
        </SettingRow>

        {/* Music */}
        <SettingRow label="Müzik" desc="Veo'nun ürettiği ortam müziği/sesi">
          <Toggle value={settings.music} onChange={v => onChange({ ...settings, music: v })} />
        </SettingRow>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={reset} style={{ fontSize: '11px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Varsayılana Sıfırla</button>
          <button onClick={onClose} className="btn btn-outline" style={{ padding: '8px 20px' }}>Kapat</button>
        </div>
      </div>
    </div>
  )
}

function SettingRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '18px', paddingBottom: '18px', borderBottom: '1px solid #f0f0ee' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{label}</span>
        {children}
      </div>
      <div style={{ fontSize: '11px', color: '#888' }}>{desc}</div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} style={{ width: '36px', height: '20px', border: 'none', cursor: 'pointer', background: value ? '#22c55e' : '#ddd', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <span className="dot" style={{ position: 'absolute', top: '2px', left: value ? '18px' : '2px', width: '16px', height: '16px', background: '#fff', transition: 'left 0.2s' }} />
    </button>
  )
}

function StepSlider<T extends string>({ options, labels, value, onChange }: { options: readonly T[]; labels: Record<T, string>; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: '0', border: '1px solid #e5e4db', flexShrink: 0 }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)}
          style={{ padding: '4px 10px', fontSize: '10px', letterSpacing: '0.5px', border: 'none', cursor: 'pointer', background: value === opt ? '#0a0a0a' : '#fff', color: value === opt ? '#fff' : '#888', fontWeight: value === opt ? '600' : '400', transition: 'all 0.15s' }}>
          {labels[opt]}
        </button>
      ))}
    </div>
  )
}
