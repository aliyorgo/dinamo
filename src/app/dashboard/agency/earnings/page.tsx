'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const AGENCY_NAV = [
  { label: 'Genel Bakis', href: '/dashboard/agency/overview' },
  { label: 'Musteriler', href: '/dashboard/agency/clients' },
  { label: 'Briefler', href: '/dashboard/agency/studio/briefs' },
  { label: 'Krediler', href: '/dashboard/agency/studio/credits' },
  { label: 'Uyeler', href: '/dashboard/agency/members' },
  { label: 'Uretim Raporu', href: '/dashboard/agency/production' },
  { label: 'Kazanclar', href: '/dashboard/agency/earnings' },
]

export default function AgencyEarningsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [agency, setAgency] = useState<any>(null)
  const [userName, setUserName] = useState('')
  const [sales, setSales] = useState<any[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: ud } = await supabase.from('users').select('name, role, agency_id').eq('id', user.id).single()
    if (!ud || ud.role !== 'agency' || !ud.agency_id) { router.push('/login'); return }
    setUserName(ud.name)

    const [{ data: ag }, { data: sl }] = await Promise.all([
      supabase.from('agencies').select('*').eq('id', ud.agency_id).single(),
      supabase.from('credit_sales').select('*, clients(company_name)').eq('agency_id', ud.agency_id).order('created_at', { ascending: false }),
    ])
    setAgency(ag)
    setSales(sl || [])
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function formatTL(n: number) {
    return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TL'
  }

  const commissionRate = Number(agency?.commission_rate || 0)
  const totalEarnings = Number(agency?.total_earnings || 0)
  const invoiced = Number(agency?.invoiced_amount || 0)
  const paid = Number(agency?.paid_amount || 0)

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0',  }}>
        <div style={{ color: '#888', fontSize: '14px' }}>Yukleniyor...</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh',  }}>

      {/* SIDEBAR */}
      <div style={{ width: '240px', background: '#0A0A0A', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          {agency?.logo_url ? (
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', overflow: 'hidden' }}>
              <img src={agency.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
            </div>
          ) : (
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px', fontWeight: '500', color: '#fff' }}>{agency?.name?.charAt(0)?.toUpperCase() || 'A'}</span>
            </div>
          )}
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff', marginBottom: '2px' }}>{agency?.name || ''}</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Ajans Paneli</div>
        </div>
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{userName}</div>
        </div>
        <nav style={{ padding: '10px 8px', flex: 1 }}>
          {AGENCY_NAV.map(item => (
            <div key={item.href} onClick={() => router.push(item.href)}
              style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: item.href === '/dashboard/agency/earnings' ? 'rgba(255,255,255,0.08)' : 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '12px', color: item.href === '/dashboard/agency/earnings' ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: item.href === '/dashboard/agency/earnings' ? '500' : '400' }}>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{ padding: '10px 8px' }}>
          <button onClick={() => router.push('/dashboard/agency/studio/briefs/new')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '9px 0', background: '#22c55e', color: '#111113', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',  }}>
            <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span> Brief Olustur
          </button>
        </div>
        <div onClick={() => router.push('/dashboard/agency/studio/credits')} style={{ padding: '10px 12px', margin: '0 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Kredi</span>
            <span style={{ fontSize: '12px', fontWeight: '500', color: '#22c55e' }}>{agency?.demo_credits || 0} kr</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Kazanc</span>
            <span style={{ fontSize: '11px', color: '#888' }}>{formatTL(totalEarnings)}</span>
          </div>
        </div>
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} style={{ padding: '6px 8px', borderRadius: '7px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)',  }}>Cikis yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Kazanc Hareketleri</div>
        </div>

        <div style={{ flex: 1, padding: '24px 28px' }}>

          {/* STAT CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Komisyon Orani', value: `%${(commissionRate * 100).toFixed(0)}`, color: '#0a0a0a' },
              { label: 'Toplam Kazanc', value: formatTL(totalEarnings), color: '#22c55e' },
              { label: 'Faturalanan', value: formatTL(invoiced), color: '#0a0a0a' },
              { label: 'Odenen', value: formatTL(paid), color: '#22c55e' },
            ].map(c => (
              <div key={c.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{c.label}</div>
                <div style={{ fontSize: '24px', fontWeight: '300', color: c.color, letterSpacing: '-0.5px' }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* SALES LIST */}
          <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
              Satis Gecmisi ({sales.length})
            </div>
            {sales.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>Henuz kazanc hareketi yok.</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 80px 100px', gap: '8px', padding: '10px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                  {['Musteri', 'Kredi', 'Satis TL', 'Komisyon', 'Kazanc'].map(h => (
                    <div key={h} style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
                  ))}
                </div>
                {sales.map((sale: any) => {
                  const saleAmount = Number(sale.total_amount || 0)
                  const commission = saleAmount * commissionRate
                  return (
                    <div key={sale.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 80px 100px', gap: '8px', padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,0.04)', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>{(sale.clients as any)?.company_name || '—'}</div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>{sale.created_at && new Date(sale.created_at).toLocaleDateString('tr-TR')}</div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#0a0a0a' }}>{sale.credits} kr</div>
                      <div style={{ fontSize: '12px', color: '#0a0a0a' }}>{formatTL(saleAmount)}</div>
                      <div style={{ fontSize: '11px', color: '#888' }}>%{(commissionRate * 100).toFixed(0)}</div>
                      <div style={{ fontSize: '12px', fontWeight: '500', color: '#22c55e' }}>+{formatTL(commission)}</div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
