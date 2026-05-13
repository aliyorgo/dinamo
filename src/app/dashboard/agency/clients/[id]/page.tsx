'use client'
import { useState, useEffect } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useRouter, useParams } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const supabase = getSupabaseBrowser()

const AGENCY_NAV = [
  { label: 'Genel Bakis', href: '/dashboard/agency/overview' },
  { label: 'Musteriler', href: '/dashboard/agency/clients' },
  { label: 'Briefler', href: '/dashboard/agency/studio/briefs' },
  { label: 'Krediler', href: '/dashboard/agency/studio/credits' },
  { label: 'Uyeler', href: '/dashboard/agency/members' },
  { label: 'Uretim Raporu', href: '/dashboard/agency/production' },
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
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }

    const { data: ud } = await supabase.from('users').select('name, role, agency_id').eq('id', user.id).single()
    if (!ud || ud.role !== 'agency' || !ud.agency_id) { router.push('/login'); return }

    setUserName(ud.name)

    const [{ data: ag }, { data: cl }, { data: br }, { data: tx }] = await Promise.all([
      supabase.from('agencies').select('id, name, logo_url, commission_rate, demo_credits, total_earnings').eq('id', ud.agency_id).single(),
      supabase.from('clients').select('*').eq('id', clientId).eq('agency_id', ud.agency_id).single(),
      supabase.from('briefs').select('id, campaign_name, video_type, format, status, credit_cost, sale_price, created_at').eq('client_id', clientId).order('created_at', { ascending: false }),
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

  const CREDIT_TL = 3000
  const completedBriefs = briefs.filter(b => ['approved', 'delivered', 'completed'].includes(b.status)).length
  const totalSpentCredits = briefs.reduce((s, b) => s + Number(b.credit_cost || 0), 0)
  const totalSpentTL = totalSpentCredits * CREDIT_TL
  const commissionRate = Number(agency?.commission_rate || 0)
  const commissionEarned = totalSpentTL * commissionRate
  const creditBalance = Number(client?.credit_balance || 0)

  // Brief status distribution
  const statusCounts: Record<string, number> = {}
  briefs.forEach(b => { statusCounts[b.status] = (statusCounts[b.status] || 0) + 1 })

  // Monthly spending (last 6 months from briefs)
  const now = new Date()
  const monthlyMap: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = d.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' })
    monthlyMap[key] = 0
  }
  briefs.forEach(b => {
    if (!b.created_at) return
    const key = new Date(b.created_at).toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' })
    if (key in monthlyMap) monthlyMap[key] = (monthlyMap[key] || 0) + Number(b.credit_cost || 0)
  })
  const chartData = Object.entries(monthlyMap).map(([month, credits]) => ({ month, credits }))

  const statusLabel: Record<string, { label: string; color: string }> = {
    draft: { label: 'Taslak', color: '#6b7280' },
    submitted: { label: 'Gonderildi', color: '#3b82f6' },
    in_production: { label: 'Uretimde', color: '#f59e0b' },
    revision: { label: 'Revizyon', color: '#ef4444' },
    approved: { label: 'Onaylandi', color: '#22c55e' },
    delivered: { label: 'Teslim', color: '#22c55e' },
    completed: { label: 'Tamamlandi', color: '#22c55e' },
    cancelled: { label: 'Iptal', color: '#888' },
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
              style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{item.label}</span>
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
            <span style={{ fontSize: '11px', color: '#888' }}>{Number(agency?.total_earnings || 0).toLocaleString('tr-TR')} TL</span>
          </div>
        </div>
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} style={{ padding: '6px 8px', borderRadius: '7px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)',  }}>Çıkış yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button onClick={() => router.push('/dashboard/agency/clients')}
            style={{ fontSize: '12px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '0',  }}>
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
          <div style={{ flex: 1, padding: '24px 28px' }}>

            {/* CREDIT WARNING */}
            {creditBalance === 0 && (
              <div style={{ padding: '12px 20px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', color: '#b91c1c' }}>
                Bu musterinin kredisi bitti.
              </div>
            )}
            {creditBalance > 0 && creditBalance < 10 && (
              <div style={{ padding: '12px 20px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', color: '#b45309' }}>
                Bu musterinin kredisi azaliyor ({creditBalance} kredi kaldi).
              </div>
            )}

            {/* STATS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'Kredi Bakiyesi', value: String(creditBalance), unit: 'kredi', color: creditBalance === 0 ? '#ef4444' : creditBalance < 10 ? '#f59e0b' : '#22c55e' },
                { label: 'Toplam Brief', value: String(briefs.length), unit: 'brief', color: '#0a0a0a' },
                { label: 'Tamamlanan Is', value: String(completedBriefs), unit: 'brief', color: completedBriefs > 0 ? '#22c55e' : '#888' },
                { label: 'Toplam Harcama', value: formatTL(totalSpentTL), color: '#0a0a0a' },
                { label: 'Ajans Komisyonu', value: formatTL(commissionEarned), color: commissionEarned > 0 ? '#22c55e' : '#888' },
              ].map(card => (
                <div key={card.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{card.label}</div>
                  <div style={{ fontSize: '22px', fontWeight: '300', color: card.color, letterSpacing: '-0.5px' }}>
                    {card.value}
                    {card.unit && <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', marginLeft: '4px', fontWeight: '400' }}>{card.unit}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

              {/* MONTHLY CHART */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Aylik Harcama (Son 6 Ay)</div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#111113', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                      labelStyle={{ color: 'rgba(255,255,255,0.25)' }}
                      formatter={(v: any) => [`${v} kredi`, 'Harcama']}
                    />
                    <Line type="monotone" dataKey="credits" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* STATUS DISTRIBUTION */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Brief Dagilimi</div>
                {Object.keys(statusCounts).length === 0 ? (
                  <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>Brief yok</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(statusCounts).map(([status, count]) => {
                      const sl = statusLabel[status] || { label: status, color: '#888' }
                      const pct = briefs.length > 0 ? (count / briefs.length) * 100 : 0
                      return (
                        <div key={status}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <span style={{ fontSize: '11px', color: '#555' }}>{sl.label}</span>
                            <span style={{ fontSize: '11px', fontWeight: '500', color: sl.color }}>{count}</span>
                          </div>
                          <div style={{ height: '6px', background: 'rgba(0,0,0,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: sl.color, borderRadius: '3px' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* LAST 5 BRIEFS */}
            <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
                Son Briefler ({Math.min(briefs.length, 5)}/{briefs.length})
              </div>
              {briefs.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>Brief yok.</div>
              ) : briefs.slice(0, 5).map((b, i) => {
                const sl = statusLabel[b.status] || { label: b.status, color: '#888' }
                return (
                  <div key={b.id} style={{ padding: '12px 20px', borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{b.campaign_name || 'Isimsiz'}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                        {b.video_type || ''}{b.format ? ` \u00b7 ${b.format}` : ''}{b.credit_cost ? ` \u00b7 ${b.credit_cost} kr` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', fontWeight: '500', background: `${sl.color}15`, color: sl.color }}>{sl.label}</span>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>{b.created_at ? new Date(b.created_at).toLocaleDateString('tr-TR') : ''}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
