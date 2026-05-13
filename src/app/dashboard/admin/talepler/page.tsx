'use client'
import { useState, useEffect, Suspense } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useSearchParams } from 'next/navigation'

const supabase = getSupabaseBrowser()

export default function TaleplerWrapper() { return <Suspense><TaleplerPage /></Suspense> }

function TaleplerPage() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'demo')
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('demo_requests').select('*').order('created_at', { ascending: false })
      setRequests(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const demos = requests.filter(r => !r.name?.startsWith('[YÜKSELTME'))
  const upgrades = requests.filter(r => r.name?.startsWith('[YÜKSELTME'))

  const filtered = tab === 'upgrade' ? upgrades : demos

  function parseUpgradeInfo(name: string) {
    const match = name.match(/\[YÜKSELTME\s*→?\s*([^\]]*)\]\s*(.*)/)
    return { targetTier: match?.[1] || '', company: match?.[2] || name }
  }

  return (
    <div style={{ padding: '48px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: '300', letterSpacing: '-1px', margin: '0 0 20px' }}>Talepler</h1>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[
          { val: 'demo', label: `DEMO TALEPLERİ (${demos.length})` },
          { val: 'upgrade', label: `YÜKSELTME TALEPLERİ (${upgrades.length})` },
        ].map(t => (
          <button key={t.val} onClick={() => setTab(t.val)}
            style={{ padding: '6px 16px', border: '1px solid', borderColor: tab === t.val ? '#0a0a0a' : '#e8e7e3', background: tab === t.val ? '#0a0a0a' : '#fff', color: tab === t.val ? '#fff' : '#888', fontSize: '12px', cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e7e3', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#888', fontSize: '14px' }}>Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#888', fontSize: '14px' }}>Talep yok.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e8e7e3' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: '#888', letterSpacing: '0.5px', fontWeight: '400' }}>Şirket</th>
                {tab === 'upgrade' && <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: '#888', letterSpacing: '0.5px', fontWeight: '400' }}>Hedef Paket</th>}
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: '#888', letterSpacing: '0.5px', fontWeight: '400' }}>Kişi</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: '#888', letterSpacing: '0.5px', fontWeight: '400' }}>E-posta</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: '#888', letterSpacing: '0.5px', fontWeight: '400' }}>Telefon</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', color: '#888', letterSpacing: '0.5px', fontWeight: '400' }}>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const info = tab === 'upgrade' ? parseUpgradeInfo(r.name) : null
                return (
                  <tr key={r.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f0f0ee' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafaf8')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>{tab === 'upgrade' ? (info?.company || r.company) : (r.company || r.name)}</td>
                    {tab === 'upgrade' && <td style={{ padding: '12px 16px' }}>{info?.targetTier ? <span style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontWeight: '500', letterSpacing: '0.5px' }}>{info.targetTier}</span> : '—'}</td>}
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#888' }}>{tab === 'demo' ? r.name : '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#888' }}>{r.email || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#888' }}>{r.phone || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#888' }}>{new Date(r.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
