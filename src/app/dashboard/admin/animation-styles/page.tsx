'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function AnimationStylesPage() {
  const [styles, setStyles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [globalEnabled, setGlobalEnabled] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: stylesData }, { data: settings }] = await Promise.all([
      supabase.from('animation_styles').select('*').order('sort_order'),
      supabase.from('admin_settings').select('value').eq('key', 'animation_global_enabled').single(),
    ])
    setStyles(stylesData || [])
    setGlobalEnabled(settings?.value === 'true')
    setLoading(false)
  }

  async function toggleGlobal() {
    setSaving(true)
    const newVal = !globalEnabled
    const { data: existing } = await supabase.from('admin_settings').select('id').eq('key', 'animation_global_enabled').maybeSingle()
    if (existing) {
      await supabase.from('admin_settings').update({ value: String(newVal) }).eq('key', 'animation_global_enabled')
    } else {
      await supabase.from('admin_settings').insert({ key: 'animation_global_enabled', value: String(newVal) })
    }
    setGlobalEnabled(newVal)
    setSaving(false)
  }

  async function toggleStyle(slug: string, currentActive: boolean) {
    await supabase.from('animation_styles').update({ active: !currentActive }).eq('slug', slug)
    setStyles(prev => prev.map(s => s.slug === slug ? { ...s, active: !currentActive } : s))
  }

  if (loading) return <div style={{ padding: '48px', color: '#888', fontSize: '14px' }}>Yükleniyor...</div>

  return (
    <div style={{ padding: '48px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: '300', letterSpacing: '-1px', margin: '0 0 20px' }}>AI Animation Stilleri</h1>

      {/* GLOBAL TOGGLE */}
      <div style={{ background: '#fff', border: '1px solid #e8e7e3', padding: '20px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '4px' }}>Animation Global</div>
          <div style={{ fontSize: '12px', color: '#888' }}>Müşteri panelinde AI Animation sekmesi {globalEnabled ? 'AÇIK' : 'KAPALI'}</div>
        </div>
        <button onClick={toggleGlobal} disabled={saving}
          style={{ width: '44px', height: '24px', borderRadius: '100px', border: 'none', cursor: 'pointer', background: globalEnabled ? '#1db81d' : '#ddd', position: 'relative', transition: 'background 0.2s' }}>
          <span style={{ position: 'absolute', top: '3px', left: globalEnabled ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
        </button>
      </div>

      {/* STIL LİSTESİ */}
      <div style={{ background: '#fff', border: '1px solid #e8e7e3', overflow: 'hidden' }}>
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #e8e7e3', fontSize: '12px', color: '#888', letterSpacing: '1px', fontFamily: 'monospace' }}>STİLLER · {styles.length}</div>
        {styles.map((style, i) => (
          <div key={style.slug} style={{ padding: '14px 24px', borderBottom: i < styles.length - 1 ? '1px solid #f0f0ee' : 'none', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img src={style.icon_path} alt={style.label} style={{ width: '40px', height: '40px', objectFit: 'contain', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{style.label}</div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{style.slug} · {style.model} · {style.task_type}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: style.active ? '#22c55e' : '#888' }}>{style.active ? 'Aktif' : 'Pasif'}</span>
              <button onClick={() => toggleStyle(style.slug, style.active)}
                style={{ width: '44px', height: '24px', borderRadius: '100px', border: 'none', cursor: 'pointer', background: style.active ? '#22c55e' : '#ddd', position: 'relative', transition: 'background 0.2s' }}>
                <span style={{ position: 'absolute', top: '3px', left: style.active ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
