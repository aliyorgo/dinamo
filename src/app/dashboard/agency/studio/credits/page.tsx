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
  { label: 'Kazanclar', href: '/dashboard/agency/earnings' },
]

const AGENCY_DISCOUNT = 0.10
const CORPORATE_DISCOUNT = 0.20
const CORPORATE_THRESHOLD = 1_500_000

export default function AgencyCreditsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [agency, setAgency] = useState<any>(null)
  const [agencyId, setAgencyId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [packages, setPackages] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [purchasing, setPurchasing] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: ud } = await supabase.from('users').select('name, role, agency_id').eq('id', user.id).single()
    if (!ud || ud.role !== 'agency' || !ud.agency_id) { router.push('/login'); return }
    setUserName(ud.name)
    setAgencyId(ud.agency_id)

    const [{ data: ag }, { data: pkgs }] = await Promise.all([
      supabase.from('agencies').select('*').eq('id', ud.agency_id).single(),
      supabase.from('credit_packages').select('*').order('credits'),
    ])
    setAgency(ag)
    setPackages(pkgs || [])
    setLoading(false)
  }

  const availableBalance = Number(agency?.total_earnings || 0) - Number(agency?.invoiced_amount || 0)
  const isCorporate = availableBalance >= CORPORATE_THRESHOLD

  function agencyPrice(pkg: any) {
    const discount = isCorporate ? CORPORATE_DISCOUNT : AGENCY_DISCOUNT
    return Math.round(Number(pkg.price_tl) * (1 - discount))
  }

  async function purchasePackage(pkg: any) {
    if (!agencyId) return
    setPurchasing(pkg.id)
    const price = agencyPrice(pkg)

    const { error } = await supabase.from('agency_payment_requests').insert({
      agency_id: agencyId,
      request_type: 'credits',
      credit_package_id: pkg.id,
      credits_requested: pkg.credits,
      amount: price,
      status: 'pending',
    })

    setPurchasing(null)
    if (error) { setMsg('Hata: ' + error.message); return }
    setMsg('Talebiniz alindi, admin onayindan sonra krediniz yuklenecek.')
    setTimeout(() => setMsg(''), 6000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function formatTL(n: number) {
    return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TL'
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0', fontFamily: 'Inter,sans-serif' }}>
        <div style={{ color: '#888', fontSize: '14px' }}>Yukleniyor...</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');`}</style>

      {/* SIDEBAR */}
      <div style={{ width: '220px', background: '#111113', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>
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
              style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: item.href === '/dashboard/agency/studio/credits' ? 'rgba(255,255,255,0.08)' : 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '12px', color: item.href === '/dashboard/agency/studio/credits' ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: item.href === '/dashboard/agency/studio/credits' ? '500' : '400' }}>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{ padding: '10px 8px' }}>
          <button onClick={() => router.push('/dashboard/agency/studio/briefs/new')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '9px 0', background: '#22c55e', color: '#111113', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span> Brief Olustur
          </button>
        </div>
        <div style={{ padding: '10px 12px', margin: '0 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>Kredi</span>
            <span style={{ fontSize: '12px', fontWeight: '500', color: '#22c55e' }}>{agency?.demo_credits || 0} kr</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>Kazanc</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{formatTL(Number(agency?.total_earnings || 0))}</span>
          </div>
        </div>
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} style={{ padding: '6px 8px', borderRadius: '7px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter,sans-serif' }}>Cikis yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Krediler</div>
          {msg && <div style={{ fontSize: '12px', color: '#22c55e' }}>{msg}</div>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

          {/* STAT CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
            <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '24px' }}>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Kredi Bakiyesi</div>
              <div style={{ fontSize: '36px', fontWeight: '300', color: '#22c55e', letterSpacing: '-1px' }}>{agency?.demo_credits || 0}</div>
              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>kullanilabilir kredi</div>
            </div>
            <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '24px' }}>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Kullanilabilir Bakiye</div>
              <div style={{ fontSize: '36px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-1px' }}>{formatTL(availableBalance)}</div>
              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>toplam kazanc - faturalanan</div>
            </div>
          </div>

          {/* PACKAGES */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a', marginBottom: '4px' }}>Kredi Paketleri</div>
            <div style={{ fontSize: '11px', color: '#888' }}>Ajans ortaklari icin %{Math.round((isCorporate ? CORPORATE_DISCOUNT : AGENCY_DISCOUNT) * 100)} ozel indirim uygulanir.</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
            {packages.map(pkg => {
              const price = agencyPrice(pkg)
              const canAfford = availableBalance >= price
              const showCorporate = isCorporate
              return (
                <div key={pkg.id} style={{ background: '#fff', border: showCorporate ? '1.5px solid #22c55e' : '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '24px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                  {showCorporate && (
                    <div style={{ position: 'absolute', top: '-8px', right: '16px', fontSize: '9px', fontWeight: '600', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '3px 10px', borderRadius: '100px', letterSpacing: '0.5px' }}>Size Ozel</div>
                  )}
                  <div style={{ fontSize: '15px', fontWeight: '500', color: '#0a0a0a', marginBottom: '6px' }}>{pkg.name}</div>
                  <div style={{ fontSize: '28px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-1px', marginBottom: '4px' }}>{pkg.credits} <span style={{ fontSize: '13px', color: '#888', fontWeight: '400' }}>kredi</span></div>
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ fontSize: '12px', color: '#aaa', textDecoration: 'line-through', marginRight: '8px' }}>{formatTL(Number(pkg.price_tl))}</span>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#22c55e' }}>{formatTL(price)}</span>
                  </div>
                  <div style={{ marginTop: 'auto' }}>
                    <button onClick={() => canAfford && purchasePackage(pkg)} disabled={!canAfford || purchasing === pkg.id}
                      style={{ width: '100%', padding: '10px', background: canAfford ? '#111113' : '#f5f4f0', color: canAfford ? '#fff' : '#aaa', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: canAfford && purchasing !== pkg.id ? 'pointer' : 'not-allowed', fontFamily: 'Inter,sans-serif' }}>
                      {purchasing === pkg.id ? 'Gonderiliyor...' : canAfford ? 'Satin Al' : 'Bakiye yetersiz'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
