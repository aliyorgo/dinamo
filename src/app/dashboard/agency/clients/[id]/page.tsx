'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const AGENCY_NAV = [
  { label: 'Genel Bakis', href: '/dashboard/agency/overview' },
  { label: 'Musteriler', href: '/dashboard/agency/clients' },
  { label: 'Briefler', href: '/dashboard/agency/studio/briefs' },
  { label: 'Krediler', href: '/dashboard/agency/studio/credits' },
  { label: 'Kazanclar', href: '/dashboard/agency/earnings' },
]

function formatTL(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₺'
}

export default function AgencyClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = params.id as string

  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [agency, setAgency] = useState<any>(null)
  const [client, setClient] = useState<any>(null)
  const [briefs, setBriefs] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])

  useEffect(() => { load() }, [clientId])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: ud } = await supabase.from('users').select('name, role, agency_id').eq('id', user.id).single()
    if (!ud || ud.role !== 'agency' || !ud.agency_id) { router.push('/login'); return }

    setUserName(ud.name)

    const [{ data: ag }, { data: cl }, { data: br }, { data: tx }] = await Promise.all([
      supabase.from('agencies').select('id, name, logo_url, commission_rate, demo_credits, total_earnings').eq('id', ud.agency_id).single(),
      supabase.from('clients').select('*').eq('id', clientId).eq('agency_id', ud.agency_id).single(),
      supabase.from('briefs').select('id, campaign_name, status, created_at').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('credit_transactions').select('amount, type, created_at').eq('client_id', clientId).order('created_at', { ascending: true }),
    ])

    if (!cl) { router.push('/dashboard/agency/clients'); return }

    setAgency(ag)
    setClient(cl)
    setBriefs(br || [])
    setTransactions(tx || [])
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Derived stats
  const completedBriefs = briefs.filter(b => b.status === 'delivered').length
  const totalSpent = transactions
    .filter(t => t.type !== 'top_up' && Number(t.amount) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0)

  // Monthly spending chart data
  const monthlyMap: Record<string, number> = {}
  transactions.forEach(t => {
    if (t.type === 'top_up') return
    const month = new Date(t.created_at).toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' })
    monthlyMap[month] = (monthlyMap[month] || 0) + Math.abs(Number(t.amount))
  })
  const chartData = Object.entries(monthlyMap).map(([month, credits]) => ({ month, credits }))

  // Commission for this client: total spent × commission_rate
  const commissionRate = Number(agency?.commission_rate || 0)
  const commissionEarned = totalSpent * commissionRate

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');`}</style>

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
              style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{ padding: '10px 8px' }}>
          <button onClick={() => router.push('/dashboard/agency/studio/briefs/new')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '9px 0', background: '#22c55e', color: '#111113', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span> Brief Olustur
          </button>
        </div>
        <div onClick={() => router.push('/dashboard/agency/studio/credits')} style={{ padding: '10px 12px', margin: '0 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>Kredi</span>
            <span style={{ fontSize: '12px', fontWeight: '500', color: '#22c55e' }}>{agency?.demo_credits || 0} kr</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>Kazanc</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{Number(agency?.total_earnings || 0).toLocaleString('tr-TR')} TL</span>
          </div>
        </div>
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} style={{ padding: '6px 8px', borderRadius: '7px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter,sans-serif' }}>Çıkış yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button onClick={() => router.push('/dashboard/agency/clients')}
            style={{ fontSize: '12px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontFamily: 'Inter,sans-serif' }}>
            ← Müşteriler
          </button>
          <span style={{ color: '#ddd' }}>/</span>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>{client?.company_name || '...'}</div>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#888', fontSize: '14px' }}>Yükleniyor...</div>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

            {/* STATS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'Kredi Bakiyesi', value: String(client?.credit_balance || 0), unit: 'kredi', color: '#0a0a0a' },
                { label: 'Harcanan Kredi', value: String(totalSpent), unit: 'kredi', color: '#0a0a0a' },
                { label: 'Tamamlanan İş', value: String(completedBriefs), unit: 'brief', color: completedBriefs > 0 ? '#22c55e' : '#888' },
                { label: 'Komisyon Kazancı', value: formatTL(commissionEarned), color: commissionEarned > 0 ? '#22c55e' : '#888' },
              ].map(card => (
                <div key={card.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{card.label}</div>
                  <div style={{ fontSize: '22px', fontWeight: '300', color: card.color, letterSpacing: '-0.5px' }}>
                    {card.value}
                    {card.unit && <span style={{ fontSize: '12px', color: '#aaa', marginLeft: '4px', fontWeight: '400' }}>{card.unit}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

              {/* MONTHLY CHART */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Aylık Kredi Harcaması</div>
                {chartData.length === 0 ? (
                  <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '12px' }}>Veri yok</div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#111113', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                        labelStyle={{ color: '#aaa' }}
                        formatter={(v: any) => [`${v} kredi`, 'Harcama']}
                      />
                      <Line type="monotone" dataKey="credits" stroke="#22c55e" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* CLIENT INFO */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>Müşteri Bilgisi</div>
                {[
                  { label: 'Şirket', value: client?.company_name },
                  { label: 'Durum', value: client?.status === 'active' ? 'Aktif' : 'Beklemede', color: client?.status === 'active' ? '#22c55e' : '#f59e0b' },
                  { label: 'Toplam Brief', value: String(briefs.length) },
                  { label: 'Tamamlanan', value: String(completedBriefs) },
                  { label: 'Aktif Brief', value: String(briefs.filter(b => !['delivered','cancelled'].includes(b.status)).length) },
                  { label: 'Komisyon Oranı', value: `%${(commissionRate * 100).toFixed(1)}` },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>{row.label}</span>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: row.color || '#0a0a0a' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
