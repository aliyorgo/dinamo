'use client'
import { useState, useEffect } from 'react'

type Mode = 'package' | 'tier'

interface Props {
  isOpen: boolean
  onClose: () => void
  mode: Mode
  initialTab: string
  pricesVisible?: boolean
  advancedCustomizationPrice?: number
}

const basicGroups = [
  { label: 'Marka tanıma', items: ['Web research ile marka URL\'inizden otomatik analiz', 'Marka tonu ve hedef kitle temel girişi', 'Marka renk paleti'] },
  { label: 'Görsel varlıklar', items: ['Logo yüklemesi ve boyutlandırma'] },
  { label: 'Ses ve müzik', items: ['Geniş ses kütüphanesinden seslendirme tercihi', 'Ücretsiz müzik kütüphanesine erişim'] },
  { label: 'AI öğrenmesi', items: ['Yorumlarınızdan ve revizyonlarınızdan otomatik öğrenme', 'Her üretimde markanızı biraz daha iyi tanır'] },
  { label: 'AI Persona', items: ['Sistem persona havuzundan Persona video üretimi (sınırlı seçim)'] },
]

const advancedGroups = [
  { label: 'Derin marka eğitimi', items: ['Marka rehberinizin sisteme işlenmesi', 'Kurallar ve yasakların kategorize edilmesi', 'Marka tonunun cümle örnekleriyle kalibrasyonu', 'Ekibimizin manuel eğitim katkısı'] },
  { label: 'Custom marka grafikleri', items: ['Renk, tipografi ve özel boyutlandırmalar', 'Markaya özel CTA tasarımları'] },
  { label: 'Markaya özel ses', items: ['Markaya özel AI seslendirme sanatçısı*', 'Marka sesinin AI\'a öğretilmesi*'] },
  { label: 'Markaya özel persona havuzu', items: ['Hedef kitlenize özel persona üretimi', 'Sistem persona havuzunun tamamına erişim'] },
  { label: 'Hizmet', items: ['Onboarding görüşmesi', 'Marka rehberi PDF', 'İlk üretimlerde tanıtım desteği', 'Öncelikli destek'] },
]

const kurumsalItems = ['Yıllık brand refresh — Advanced kurulumun yıllık tekrarı', 'Üç aylık marka raporu — Tutarlılık, kurallar, performans', 'Özel hesap yöneticisi — Sürekli iletişim noktası', 'Yeni özelliklere öncelikli erişim — Beta sürümlere ilk erişim']

function GroupList({ groups }: { groups: { label: string; items: string[] }[] }) {
  return <>{groups.map((g, i) => (
    <div key={i} style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', fontWeight: '600' }}>{g.label}</div>
      {g.items.map((item, j) => (
        <div key={j} style={{ fontSize: '13px', color: '#e5e5e5', display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '4px', lineHeight: 1.5 }}>
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#1db81d', flexShrink: 0, marginTop: '7px' }} />
          {item}
        </div>
      ))}
    </div>
  ))}</>
}

export default function PackageDetailModal({ isOpen, onClose, mode, initialTab, pricesVisible = true, advancedCustomizationPrice = 150000 }: Props) {
  const [activeTab, setActiveTab] = useState(initialTab)
  useEffect(() => { setActiveTab(initialTab) }, [initialTab])

  if (!isOpen) return null

  const advPriceStr = advancedCustomizationPrice.toLocaleString('tr-TR')

  const packageTabs = [
    { key: 'demo', label: 'DEMO' },
    { key: 'baslangic', label: 'BAŞLANGIÇ' },
    { key: 'standart', label: 'STANDART' },
    { key: 'kurumsal', label: 'KURUMSAL' },
  ]
  const tierTabs = [
    { key: 'basic', label: 'BASIC' },
    { key: 'advanced', label: 'ADVANCED' },
    { key: 'corporate', label: 'KURUMSAL' },
  ]
  const tabs = mode === 'package' ? packageTabs : tierTabs

  const packageTitles: Record<string, string> = pricesVisible
    ? { demo: 'Demo Paketi · 30 Kredi · Ücretsiz', baslangic: `Başlangıç Paketi · 100 Kredi · 350.000 TL +KDV`, standart: 'Standart Paket · 500 Kredi · 1.750.000 TL +KDV', kurumsal: 'Kurumsal Paket · 1.000+ Kredi · İletişim' }
    : { demo: 'Demo Paketi · 30 Kredi', baslangic: 'Başlangıç Paketi · 100 Kredi', standart: 'Standart Paket · 500 Kredi', kurumsal: 'Kurumsal Paket · 1.000+ Kredi' }
  const tierTitles: Record<string, string> = { basic: 'Basic Customization', advanced: 'Advanced Customization', corporate: 'Kurumsal Paket' }
  const refs: Record<string, string> = { standart: 'Basic Marka Customization\'daki tüm hizmetler ve...', kurumsal: 'Advanced Marka Customization\'daki tüm hizmetler ve...', advanced: 'Basic Marka Customization\'daki tüm hizmetler ve...', corporate: 'Advanced Marka Customization\'daki tüm hizmetler ve...' }

  const title = mode === 'package' ? (packageTitles[activeTab] || activeTab) : (tierTitles[activeTab] || activeTab)
  const ref = refs[activeTab]

  return (
    <div onClick={onClose} onKeyDown={e => { if (e.key === 'Escape') onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', maxWidth: '720px', width: '90%', maxHeight: '80vh', overflowY: 'auto', padding: '40px', position: 'relative', color: '#fff' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', width: '32px', height: '32px', border: 'none', background: 'none', fontSize: '20px', color: '#666', cursor: 'pointer' }}>×</button>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding: '12px 20px', background: 'transparent', border: 'none', borderBottom: activeTab === tab.key ? '2px solid #1db81d' : '2px solid transparent', color: activeTab === tab.key ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: activeTab === tab.key ? 600 : 400, fontSize: '13px', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.2s' }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>{title}</div>
        {ref && <div style={{ fontSize: '13px', color: '#888', fontStyle: 'italic', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{ref}</div>}

        {/* Content */}
        {(activeTab === 'demo' || activeTab === 'baslangic' || activeTab === 'basic') && <>
          <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 12px' }}>Basic Marka Customization</h3>
          <GroupList groups={basicGroups} />
          {activeTab === 'baslangic' && <p style={{ fontSize: '12px', color: '#888', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>{pricesVisible ? `Advanced Marka Customization ${advPriceStr} TL karşılığı eklenebilir.` : 'Advanced Marka Customization eklenebilir.'}</p>}
        </>}

        {(activeTab === 'standart' || activeTab === 'advanced') && <>
          <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 12px' }}>Advanced Marka Customization <span style={{ fontSize: '9px', padding: '2px 8px', background: 'rgba(29,184,29,0.15)', color: '#4ade80', marginLeft: '8px', verticalAlign: 'middle' }}>Dahil</span></h3>
          <GroupList groups={advancedGroups} />
          <p style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', marginTop: '8px' }}>* Telif anlaşmaları gerekli durumlarda Dinamo tarafından koordine edilir.</p>
        </>}

        {(activeTab === 'kurumsal' || activeTab === 'corporate') && <>
          <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 12px' }}>Kurumsal Eklentileri</h3>
          {kurumsalItems.map((item, j) => (
            <div key={j} style={{ fontSize: '13px', color: '#e5e5e5', display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px', lineHeight: 1.5 }}>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#1db81d', flexShrink: 0, marginTop: '7px' }} />
              {item}
            </div>
          ))}
        </>}
      </div>
    </div>
  )
}
