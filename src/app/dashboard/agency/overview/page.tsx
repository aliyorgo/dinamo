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

function formatTL(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₺'
}

export default function AgencyOverviewPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [agency, setAgency] = useState<any>(null)
  const [clients, setClients] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [paymentRequests, setPaymentRequests] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  const [reqForm, setReqForm] = useState({ request_type: 'commission', amount: '', credits_requested: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: ud } = await supabase.from('users').select('name, role, agency_id').eq('id', user.id).single()
    if (!ud || ud.role !== 'agency' || !ud.agency_id) { router.push('/login'); return }

    setUserName(ud.name)

    const [{ data: ag }, { data: cls }, { data: invs }, { data: reqs }] = await Promise.all([
      supabase.from('agencies').select('*').eq('id', ud.agency_id).single(),
      supabase.from('clients').select('id, company_name, status, credit_balance').eq('agency_id', ud.agency_id),
      supabase.from('agency_invoices').select('*').eq('agency_id', ud.agency_id).order('created_at', { ascending: false }),
      supabase.from('agency_payment_requests').select('*').eq('agency_id', ud.agency_id).order('created_at', { ascending: false }),
    ])

    setAgency(ag)
    setClients(cls || [])
    setInvoices(invs || [])
    setPaymentRequests(reqs || [])
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
    fontFamily: 'Inter,sans-serif', outline: 'none', boxSizing: 'border-box', background: '#fff',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  }

  const activeClients = clients.filter(c => c.status === 'active')
  const paidInvoices = invoices.filter(i => i.is_paid)
  const pendingInvoices = invoices.filter(i => !i.is_paid)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');`}</style>

      {/* SIDEBAR */}
      <div style={{ width: '220px', background: '#111113', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>

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
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Genel Bakış</div>
          {msg && <div style={{ fontSize: '12px', color: '#22c55e' }}>{msg}</div>}
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#888', fontSize: '14px' }}>Yükleniyor...</div>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

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
                  {card.sub && <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>{card.sub}</div>}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

              {/* INVOICES */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
                  Faturalar ({invoices.length})
                </div>
                {invoices.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: '#aaa', fontSize: '12px' }}>Henüz fatura yok.</div>
                ) : invoices.map((inv, i) => (
                  <div key={inv.id} style={{ padding: '10px 20px', borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : 'none', display: 'flex', alignItems: 'center', gap: '10px', borderLeft: `3px solid ${inv.is_paid ? '#22c55e' : '#f59e0b'}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{formatTL(Number(inv.amount))}</div>
                      <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
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
                  <button type="submit" style={{ padding: '9px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                    Talep Gönder
                  </button>
                </form>

                {paymentRequests.length > 0 && (
                  <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)', paddingTop: '14px' }}>
                    <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Geçmiş</div>
                    {paymentRequests.map((req, i) => (
                      <div key={req.id} style={{ padding: '7px 0', borderBottom: i < paymentRequests.length - 1 ? '0.5px solid rgba(0,0,0,0.04)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#0a0a0a' }}>{req.request_type}</div>
                          <div style={{ fontSize: '10px', color: '#aaa' }}>
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
