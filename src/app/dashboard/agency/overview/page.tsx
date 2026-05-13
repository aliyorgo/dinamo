'use client'
import { useState, useEffect } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

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

export default function AgencyOverviewPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [agency, setAgency] = useState<any>(null)
  const [agencyMargin, setAgencyMargin] = useState(0)
  const [clients, setClients] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [paymentRequests, setPaymentRequests] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [briefs, setBriefs] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  const [reqForm, setReqForm] = useState({ request_type: 'commission', amount: '', credits_requested: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }

    const { data: ud } = await supabase.from('users').select('name, role, agency_id').eq('id', user.id).single()
    if (!ud || ud.role !== 'agency' || !ud.agency_id) { router.push('/login'); return }

    setUserName(ud.name)

    const [{ data: ag }, { data: cls }, { data: invs }, { data: reqs }, { data: mb }, { data: br }] = await Promise.all([
      supabase.from('agencies').select('*').eq('id', ud.agency_id).single(),
      supabase.from('clients').select('id, company_name, status, credit_balance').eq('agency_id', ud.agency_id),
      supabase.from('agency_invoices').select('*').eq('agency_id', ud.agency_id).order('created_at', { ascending: false }),
      supabase.from('agency_payment_requests').select('*').eq('agency_id', ud.agency_id).order('created_at', { ascending: false }),
      supabase.from('users').select('id, name, email').eq('agency_id', ud.agency_id).eq('role', 'agency_member'),
      supabase.from('briefs').select('id, campaign_name, client_name, agency_member_id, credit_cost, sale_price, status, created_at').eq('agency_id', ud.agency_id).order('created_at', { ascending: false }),
    ])

    setAgency(ag)
    setClients(cls || [])
    setInvoices(invs || [])
    setPaymentRequests(reqs || [])
    setMembers(mb || [])
    setBriefs(br || [])
    const tSales = (br || []).reduce((s: number, b: any) => s + Number(b.sale_price || 0), 0)
    const tCost = (br || []).reduce((s: number, b: any) => s + Number(b.credit_cost || 0) * 3000, 0)
    setAgencyMargin(tSales - tCost)
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function submitPaymentRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!agency) return
    const { error } = await supabase.from('agency_payment_requests').insert({
      agency_id: agency.id,
      request_type: reqForm.request_type,
      amount: reqForm.amount ? parseFloat(reqForm.amount) : null,
      credits_requested: reqForm.credits_requested ? parseInt(reqForm.credits_requested) : null,
    })
    if (error) { setMsg('Hata: ' + error.message); return }
    setMsg('Talep gönderildi.')
    setReqForm({ request_type: 'commission', amount: '', credits_requested: '' })
    const { data } = await supabase.from('agency_payment_requests').select('*').eq('agency_id', agency.id).order('created_at', { ascending: false })
    setPaymentRequests(data || [])
    setTimeout(() => setMsg(''), 3000)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '0.5px solid rgba(0,0,0,0.15)',
    borderRadius: '8px', fontSize: '13px', color: '#0a0a0a',
     outline: 'none', boxSizing: 'border-box', background: '#fff',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  }

  const activeClients = clients.filter(c => c.status === 'active')
  const paidInvoices = invoices.filter(i => i.is_paid)
  const pendingInvoices = invoices.filter(i => !i.is_paid)

  // This month stats
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thisMonthBriefs = briefs.filter(b => b.created_at >= monthStart)
  const thisMonthCredits = thisMonthBriefs.reduce((s, b) => s + Number(b.credit_cost || 0), 0)
  const thisMonthSales = thisMonthBriefs.reduce((s, b) => s + Number(b.sale_price || 0), 0)

  // Member map for names
  const memberMap: Record<string, string> = {}
  members.forEach(m => { memberMap[m.id] = m.name })

  // Member this-month counts
  const memberMonthCounts: Record<string, number> = {}
  thisMonthBriefs.forEach(b => {
    if (b.agency_member_id) memberMonthCounts[b.agency_member_id] = (memberMonthCounts[b.agency_member_id] || 0) + 1
  })

  const statusLabel: Record<string, { label: string; color: string }> = {
    draft: { label: 'Taslak', color: '#f59e0b' }, submitted: { label: 'Gonderildi', color: '#888' },
    in_production: { label: 'Uretimde', color: '#3b82f6' }, revision: { label: 'Revizyon', color: '#ef4444' },
    approved: { label: 'Onaylandi', color: '#22c55e' }, delivered: { label: 'Teslim', color: '#22c55e' },
    cancelled: { label: 'Iptal', color: '#555' },
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh',  }}>

      {/* SIDEBAR */}
      <div style={{ width: '240px', background: '#0A0A0A', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>

        {/* LOGO AREA */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          {loading ? (
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', marginBottom: '12px' }} />
          ) : agency?.logo_url ? (
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', overflow: 'hidden' }}>
              <img src={agency.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
            </div>
          ) : (
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px', fontWeight: '500', color: '#fff' }}>
                {agency?.name?.charAt(0)?.toUpperCase() || 'A'}
              </span>
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
              style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: item.href === '/dashboard/agency/overview' ? 'rgba(255,255,255,0.08)' : 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '12px', color: item.href === '/dashboard/agency/overview' ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: item.href === '/dashboard/agency/overview' ? '500' : '400' }}>{item.label}</span>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Kazanc</span>
            <span style={{ fontSize: '11px', color: '#888' }}>{Number(agency?.total_earnings || 0).toLocaleString('tr-TR')} TL</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Marj</span>
            <span style={{ fontSize: '10px', fontStyle: 'italic', color: agencyMargin >= 0 ? 'rgba(255,255,255,0.4)' : '#ef4444' }}>{agencyMargin.toLocaleString('tr-TR')} TL</span>
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
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Genel Bakış</div>
          {msg && <div style={{ fontSize: '12px', color: '#22c55e' }}>{msg}</div>}
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#888', fontSize: '14px' }}>Yükleniyor...</div>
          </div>
        ) : (
          <div style={{ flex: 1, padding: '24px 28px' }}>

            {/* STATS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Aktif Müşteri', value: String(activeClients.length), sub: `${clients.length} toplam`, link: '/dashboard/agency/clients' },
                { label: 'Toplam Kazanç', value: formatTL(Number(agency?.total_earnings || 0)), color: '#0a0a0a' },
                { label: 'Tahsil Edilen', value: formatTL(paidInvoices.reduce((s, i) => s + Number(i.amount || 0), 0)), color: '#22c55e' },
                { label: 'Bekleyen', value: formatTL(pendingInvoices.reduce((s, i) => s + Number(i.amount || 0), 0)), color: pendingInvoices.length > 0 ? '#f59e0b' : '#888' },
              ].map(card => (
                <div key={card.label}
                  onClick={() => card.link && router.push(card.link)}
                  style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '16px', cursor: card.link ? 'pointer' : 'default' }}>
                  <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{card.label}</div>
                  <div style={{ fontSize: '22px', fontWeight: '300', color: card.color || '#0a0a0a', letterSpacing: '-0.5px' }}>{card.value}</div>
                  {card.sub && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '4px' }}>{card.sub}</div>}
                </div>
              ))}
            </div>

            {/* MONTHLY STATS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Ekip Uyeleri', value: String(members.length), link: '/dashboard/agency/members' },
                { label: 'Bu Ay Uretilen', value: String(thisMonthBriefs.length), sub: 'is' },
                { label: 'Bu Ay Kredi', value: String(thisMonthCredits), sub: 'kredi' },
                { label: 'Bu Ay Satis', value: thisMonthSales > 0 ? formatTL(thisMonthSales) : '0', color: thisMonthSales > 0 ? '#22c55e' : '#888' },
              ].map(card => (
                <div key={card.label}
                  onClick={() => card.link && router.push(card.link)}
                  style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '16px', cursor: card.link ? 'pointer' : 'default' }}>
                  <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{card.label}</div>
                  <div style={{ fontSize: '22px', fontWeight: '300', color: card.color || '#0a0a0a', letterSpacing: '-0.5px' }}>
                    {card.value}
                    {card.sub && <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', marginLeft: '4px', fontWeight: '400' }}>{card.sub}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* RECENT PRODUCTIONS + TEAM ACTIVITY */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>

              {/* SON URETIMLER */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>Son Uretimler</span>
                  <span onClick={() => router.push('/dashboard/agency/production')} style={{ fontSize: '10px', color: '#3b82f6', cursor: 'pointer' }}>Tum Uretimler</span>
                </div>
                {briefs.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>Henuz uretim yok.</div>
                ) : briefs.slice(0, 5).map((b, i) => {
                  const sl = statusLabel[b.status] || { label: b.status, color: '#888' }
                  return (
                    <div key={b.id} onClick={() => router.push(`/dashboard/agency/studio/briefs/${b.id}`)}
                      style={{ padding: '10px 20px', borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : 'none', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>{b.campaign_name}</div>
                        <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                          {b.agency_member_id ? memberMap[b.agency_member_id] || '' : 'Ajans'}
                          {b.client_name ? ` · ${b.client_name}` : ''}
                          {b.credit_cost ? ` · ${b.credit_cost} kr` : ''}
                          {b.sale_price ? ` · ${Number(b.sale_price).toLocaleString('tr-TR')} TL` : ''}
                        </div>
                      </div>
                      <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '100px', fontWeight: '500', background: `${sl.color}15`, color: sl.color, flexShrink: 0 }}>{sl.label}</span>
                    </div>
                  )
                })}
              </div>

              {/* EKIP AKTIVITESI */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>Ekip Aktivitesi</span>
                  <span onClick={() => router.push('/dashboard/agency/members')} style={{ fontSize: '10px', color: '#3b82f6', cursor: 'pointer' }}>Ekibi Yonet</span>
                </div>
                {members.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>Henuz ekip uyesi yok.</div>
                ) : members.map((m, i) => (
                  <div key={m.id} onClick={() => router.push(`/dashboard/agency/members/${m.id}`)}
                    style={{ padding: '10px 20px', borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : 'none', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '12px', fontWeight: '500', color: '#fff' }}>{m.name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>{m.name}</div>
                      <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{m.email}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>{memberMonthCounts[m.id] || 0}</div>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)' }}>bu ay</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

              {/* INVOICES */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
                  Faturalar ({invoices.length})
                </div>
                {invoices.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>Henüz fatura yok.</div>
                ) : invoices.map((inv, i) => (
                  <div key={inv.id} style={{ padding: '10px 20px', borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : 'none', display: 'flex', alignItems: 'center', gap: '10px', borderLeft: `3px solid ${inv.is_paid ? '#22c55e' : '#f59e0b'}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{formatTL(Number(inv.amount))}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>
                        {inv.invoice_number && <span style={{ marginRight: '8px' }}>{inv.invoice_number}</span>}
                        {inv.invoice_date && new Date(inv.invoice_date).toLocaleDateString('tr-TR')}
                      </div>
                    </div>
                    <span style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '100px', fontWeight: '500', background: inv.is_paid ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: inv.is_paid ? '#22c55e' : '#f59e0b' }}>
                      {inv.is_paid ? 'Ödendi' : 'Bekliyor'}
                    </span>
                  </div>
                ))}
              </div>

              {/* PAYMENT REQUESTS */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
                  Ödeme Talebi
                </div>
                <form onSubmit={submitPaymentRequest} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>Talep Türü</label>
                    <select value={reqForm.request_type} onChange={e => setReqForm({ ...reqForm, request_type: e.target.value })} style={inputStyle}>
                      <option value="commission">Komisyon Ödemesi</option>
                      <option value="demo_credit">Demo Kredi Talebi</option>
                      <option value="other">Diğer</option>
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={labelStyle}>Tutar (₺)</label>
                      <input type="number" min="0" step="0.01" value={reqForm.amount} onChange={e => setReqForm({ ...reqForm, amount: e.target.value })} style={inputStyle} placeholder="0.00" />
                    </div>
                    <div>
                      <label style={labelStyle}>Kredi</label>
                      <input type="number" min="0" value={reqForm.credits_requested} onChange={e => setReqForm({ ...reqForm, credits_requested: e.target.value })} style={inputStyle} placeholder="0" />
                    </div>
                  </div>
                  <button type="submit" style={{ padding: '9px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer',  }}>
                    Talep Gönder
                  </button>
                </form>

                {paymentRequests.length > 0 && (
                  <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)', paddingTop: '14px' }}>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Geçmiş</div>
                    {paymentRequests.map((req, i) => (
                      <div key={req.id} style={{ padding: '7px 0', borderBottom: i < paymentRequests.length - 1 ? '0.5px solid rgba(0,0,0,0.04)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#0a0a0a' }}>{req.request_type}</div>
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
                            {req.amount && formatTL(Number(req.amount))}
                            {req.credits_requested && ` · ${req.credits_requested} kredi`}
                            {req.admin_note && <span style={{ marginLeft: '8px', fontStyle: 'italic' }}>{req.admin_note}</span>}
                          </div>
                        </div>
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', background: req.status === 'approved' ? 'rgba(34,197,94,0.1)' : req.status === 'rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: req.status === 'approved' ? '#22c55e' : req.status === 'rejected' ? '#ef4444' : '#f59e0b' }}>
                          {req.status === 'approved' ? 'Onaylandı' : req.status === 'rejected' ? 'Reddedildi' : 'Beklemede'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
