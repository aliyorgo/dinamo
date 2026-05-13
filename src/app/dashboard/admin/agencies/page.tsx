'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)


function formatTL(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₺'
}

const PIPELINE_STATUS: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Beklemede',   color: '#f59e0b' },
  contacted:  { label: 'İletişime Geçildi', color: '#3b82f6' },
  demo:       { label: 'Demo Verildi', color: '#8b5cf6' },
  negotiating:{ label: 'Müzakerede',  color: '#f97316' },
  converted:  { label: 'Dönüştü',     color: '#22c55e' },
  lost:       { label: 'Kaybedildi',  color: '#ef4444' },
}

const PAYMENT_REQUEST_TYPE: Record<string, string> = {
  commission: 'Komisyon Ödemesi',
  demo_credit: 'Demo Kredi Talebi',
  other: 'Diğer',
}

export default function AgenciesPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [msgColor, setMsgColor] = useState('#22c55e')

  const [agencies, setAgencies] = useState<any[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [agencyClients, setAgencyClients] = useState<Record<string, any[]>>({})
  const [agencyInvoices, setAgencyInvoices] = useState<Record<string, any[]>>({})
  const [paymentRequests, setPaymentRequests] = useState<Record<string, any[]>>({})

  // Create agency form
  const [form, setForm] = useState({
    name: '',
    contact_email: '',
    commission_rate: '15',
    demo_credits: '0',
    login_email: '',
    password: '',
  })
  const [creating, setCreating] = useState(false)
  const [pwCopied, setPwCopied] = useState(false)

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
    let pw = ''
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)]
    setForm(prev => ({ ...prev, password: pw }))
  }

  function copyPassword() {
    navigator.clipboard.writeText(form.password)
    setPwCopied(true)
    setTimeout(() => setPwCopied(false), 2000)
  }

  // Add pipeline client form
  const [pipelineForm, setPipelineForm] = useState({
    agency_id: '',
    company_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    notes: '',
    status: 'pending',
  })

  // Add agency invoice form
  const [invoiceForm, setInvoiceForm] = useState({
    agency_id: '',
    amount: '',
    invoice_date: '',
    invoice_number: '',
  })

  // Payment request note editing
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    const { data: ud } = await supabase.from('users').select('name, role').eq('id', user.id).single()
    if (!ud || ud.role !== 'admin') { router.push('/login'); return }
    setUserName(ud.name)
    await loadAgencies()
    setLoading(false)
  }

  async function loadAgencies() {
    const { data } = await supabase.from('agencies').select('*').order('created_at', { ascending: false })
    setAgencies(data || [])
  }

  async function loadAgencyDetail(agencyId: string) {
    const [{ data: clients }, { data: invoices }, { data: requests }] = await Promise.all([
      supabase.from('clients').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }),
      supabase.from('agency_invoices').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }),
      supabase.from('agency_payment_requests').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }),
    ])
    setAgencyClients(prev => ({ ...prev, [agencyId]: clients || [] }))
    setAgencyInvoices(prev => ({ ...prev, [agencyId]: invoices || [] }))
    setPaymentRequests(prev => ({ ...prev, [agencyId]: requests || [] }))
  }

  function toggleExpand(agencyId: string) {
    if (expanded === agencyId) {
      setExpanded(null)
    } else {
      setExpanded(agencyId)
      loadAgencyDetail(agencyId)
      setPipelineForm(prev => ({ ...prev, agency_id: agencyId }))
      setInvoiceForm(prev => ({ ...prev, agency_id: agencyId }))
    }
  }

  function showMsg(text: string, isError = false) {
    setMsg(text)
    setMsgColor(isError ? '#ef4444' : '#22c55e')
    setTimeout(() => setMsg(''), 3000)
  }

  async function createAgency(e: React.FormEvent) {
    e.preventDefault()
    if (!form.login_email || !form.password) { showMsg('Giriş e-postası ve şifre zorunlu.', true); return }
    setCreating(true)
    const res = await fetch('/api/admin/create-agency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        contact_email: form.contact_email || null,
        commission_rate: parseFloat(form.commission_rate) / 100,
        demo_credits: parseInt(form.demo_credits) || 0,
        login_email: form.login_email,
        password: form.password,
      }),
    })
    const data = await res.json()
    setCreating(false)
    if (data.error) { showMsg(data.error, true); return }
    showMsg('Ajans oluşturuldu, hoşgeldin maili gönderildi.')
    setForm({ name: '', contact_email: '', commission_rate: '15', demo_credits: '0', login_email: '', password: '' })
    loadAgencies()
  }

  async function toggleAgencyStatus(agency: any) {
    const newStatus = agency.status === 'active' ? 'passive' : 'active'
    await supabase.from('agencies').update({ status: newStatus }).eq('id', agency.id)
    setAgencies(prev => prev.map(a => a.id === agency.id ? { ...a, status: newStatus } : a))
  }

  async function addPipelineClient(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('clients').insert({
      agency_id: pipelineForm.agency_id,
      company_name: pipelineForm.company_name,
      contact_name: pipelineForm.contact_name || null,
      contact_email: pipelineForm.contact_email || null,
      contact_phone: pipelineForm.contact_phone || null,
      notes: pipelineForm.notes || null,
      status: pipelineForm.status,
    })
    if (error) { showMsg(error.message, true); return }
    showMsg('Müşteri pipeline\'a eklendi.')
    setPipelineForm(prev => ({ ...prev, company_name: '', contact_name: '', contact_email: '', contact_phone: '', notes: '', status: 'pending' }))
    loadAgencyDetail(pipelineForm.agency_id)
  }

  async function updatePipelineStatus(id: string, agencyId: string, status: string) {
    await supabase.from('clients').update({ status }).eq('id', id)
    setAgencyClients(prev => ({
      ...prev,
      [agencyId]: (prev[agencyId] || []).map(c => c.id === id ? { ...c, status } : c),
    }))
  }

  async function addInvoice(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('agency_invoices').insert({
      agency_id: invoiceForm.agency_id,
      amount: parseFloat(invoiceForm.amount),
      invoice_date: invoiceForm.invoice_date || null,
      invoice_number: invoiceForm.invoice_number || null,
    })
    if (error) { showMsg(error.message, true); return }
    // Update invoiced_amount on agency
    const agency = agencies.find(a => a.id === invoiceForm.agency_id)
    if (agency) {
      const newInvoiced = Number(agency.invoiced_amount || 0) + parseFloat(invoiceForm.amount)
      await supabase.from('agencies').update({ invoiced_amount: newInvoiced }).eq('id', invoiceForm.agency_id)
      setAgencies(prev => prev.map(a => a.id === invoiceForm.agency_id ? { ...a, invoiced_amount: newInvoiced } : a))
    }
    showMsg('Fatura eklendi.')
    setInvoiceForm(prev => ({ ...prev, amount: '', invoice_date: '', invoice_number: '' }))
    loadAgencyDetail(invoiceForm.agency_id)
  }

  async function toggleInvoicePaid(invoice: any, agencyId: string) {
    const isPaid = !invoice.is_paid
    await supabase.from('agency_invoices').update({
      is_paid: isPaid,
      paid_at: isPaid ? new Date().toISOString() : null,
    }).eq('id', invoice.id)
    // Update paid_amount on agency
    const delta = isPaid ? Number(invoice.amount) : -Number(invoice.amount)
    const agency = agencies.find(a => a.id === agencyId)
    if (agency) {
      const newPaid = Math.max(0, Number(agency.paid_amount || 0) + delta)
      await supabase.from('agencies').update({ paid_amount: newPaid }).eq('id', agencyId)
      setAgencies(prev => prev.map(a => a.id === agencyId ? { ...a, paid_amount: newPaid } : a))
    }
    setAgencyInvoices(prev => ({
      ...prev,
      [agencyId]: (prev[agencyId] || []).map(inv => inv.id === invoice.id ? { ...inv, is_paid: isPaid, paid_at: isPaid ? new Date().toISOString() : null } : inv),
    }))
  }

  async function updatePaymentRequestStatus(id: string, agencyId: string, status: string) {
    await supabase.from('agency_payment_requests').update({ status }).eq('id', id)
    setPaymentRequests(prev => ({
      ...prev,
      [agencyId]: (prev[agencyId] || []).map(r => r.id === id ? { ...r, status } : r),
    }))
  }

  async function saveRequestNote(id: string, agencyId: string) {
    await supabase.from('agency_payment_requests').update({ admin_note: noteInput }).eq('id', id)
    setPaymentRequests(prev => ({
      ...prev,
      [agencyId]: (prev[agencyId] || []).map(r => r.id === id ? { ...r, admin_note: noteInput } : r),
    }))
    setEditingNote(null)
  }


  const totalEarnings = agencies.reduce((s, a) => s + Number(a.total_earnings || 0), 0)
  const totalInvoiced = agencies.reduce((s, a) => s + Number(a.invoiced_amount || 0), 0)
  const totalPaid = agencies.reduce((s, a) => s + Number(a.paid_amount || 0), 0)
  const totalPending = totalInvoiced - totalPaid

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '0.5px solid rgba(0,0,0,0.15)',
    borderRadius: '8px', fontSize: '13px', color: '#0a0a0a',
     outline: 'none', boxSizing: 'border-box', background: '#fff',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Ajanslar</div>
        </div>

        <div style={{ flex: 1, padding: '24px 28px' }}>
          {loading ? <div style={{ color: '#888', fontSize: '14px' }}>Yükleniyor...</div> : (
            <>
              {/* SUMMARY CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
                {[
                  { label: 'Toplam Ajans', value: String(agencies.length), color: '#0a0a0a' },
                  { label: 'Toplam Kazanç', value: formatTL(totalEarnings), color: '#0a0a0a' },
                  { label: 'Faturalanan', value: formatTL(totalInvoiced), color: '#0a0a0a' },
                  { label: 'Ödeme Bekleyen', value: formatTL(totalPending), color: totalPending > 0 ? '#f59e0b' : '#888' },
                ].map(card => (
                  <div key={card.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{card.label}</div>
                    <div style={{ fontSize: '24px', fontWeight: '300', color: card.color, letterSpacing: '-1px' }}>{card.value}</div>
                  </div>
                ))}
              </div>

              {/* CREATE AGENCY FORM */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Yeni Ajans</div>
                <form onSubmit={createAgency}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={labelStyle}>Ajans Adı *</label>
                      <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="Ajans adı" />
                    </div>
                    <div>
                      <label style={labelStyle}>İletişim E-posta</label>
                      <input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} style={inputStyle} placeholder="email@ajans.com" />
                    </div>
                    <div>
                      <label style={labelStyle}>Komisyon Oranı (%)</label>
                      <input type="number" min="0" max="100" step="0.1" value={form.commission_rate} onChange={e => setForm({ ...form, commission_rate: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Demo Kredi</label>
                      <input type="number" min="0" value={form.demo_credits} onChange={e => setForm({ ...form, demo_credits: e.target.value })} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '14px', background: '#fafaf8', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: '10px', marginBottom: '14px' }}>
                    <div>
                      <label style={labelStyle}>Giriş E-postası *</label>
                      <input required type="email" value={form.login_email} onChange={e => setForm({ ...form, login_email: e.target.value })} style={inputStyle} placeholder="ajans@giris.com" />
                    </div>
                    <div>
                      <label style={labelStyle}>Şifre *</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '1px', flex: 1 }} placeholder="Şifre" />
                        <button type="button" onClick={generatePassword}
                          style={{ padding: '8px 10px', background: '#f5f4f0', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '11px', cursor: 'pointer',  flexShrink: 0, color: '#555' }}>
                          Oluştur
                        </button>
                        {form.password && (
                          <button type="button" onClick={copyPassword}
                            style={{ padding: '8px 10px', background: pwCopied ? 'rgba(34,197,94,0.1)' : '#f5f4f0', border: `0.5px solid ${pwCopied ? '#22c55e' : 'rgba(0,0,0,0.15)'}`, borderRadius: '8px', fontSize: '11px', cursor: 'pointer',  flexShrink: 0, color: pwCopied ? '#22c55e' : '#555' }}>
                            {pwCopied ? '✓' : 'Kopyala'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {msg && <div style={{ fontSize: '12px', color: msgColor, marginBottom: '10px' }}>{msg}</div>}
                  <button type="submit" disabled={creating}
                    style={{ padding: '8px 20px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: creating ? 'not-allowed' : 'pointer',  opacity: creating ? 0.7 : 1 }}>
                    {creating ? 'Oluşturuluyor...' : 'Ajans Oluştur'}
                  </button>
                </form>
              </div>

              {/* AGENCIES LIST */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
                  Ajans Listesi ({agencies.length})
                </div>

                {agencies.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#888', fontSize: '13px' }}>Henüz ajans yok.</div>
                ) : agencies.map((agency, i) => (
                  <div key={agency.id} style={{ borderBottom: i < agencies.length - 1 ? '0.5px solid rgba(0,0,0,0.06)' : 'none' }}>

                    {/* AGENCY ROW */}
                    <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
                      onClick={() => toggleExpand(agency.id)}>
                      {/* Logo thumbnail */}
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: agency.logo_url ? '#fff' : '#f0f0ee', border: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                        {agency.logo_url
                          ? <img src={agency.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '3px' }} />
                          : <span style={{ fontSize: '14px', fontWeight: '500', color: '#888' }}>{agency.name?.charAt(0)?.toUpperCase() || 'A'}</span>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{agency.name}</span>
                          <span style={{
                            fontSize: '10px', padding: '2px 8px', borderRadius: '100px', fontWeight: '500',
                            background: agency.status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(0,0,0,0.06)',
                            color: agency.status === 'active' ? '#22c55e' : '#888',
                          }}>{agency.status === 'active' ? 'Aktif' : 'Pasif'}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>
                          {agency.contact_email && <span style={{ marginRight: '12px' }}>{agency.contact_email}</span>}
                          <span style={{ marginRight: '12px' }}>Komisyon: %{(Number(agency.commission_rate || 0) * 100).toFixed(1)}</span>
                          <span style={{ marginRight: '12px' }}>Demo: {agency.demo_credits} kredi</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '20px', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>Kazanç</div>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{formatTL(Number(agency.total_earnings || 0))}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>Faturalanan</div>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{formatTL(Number(agency.invoiced_amount || 0))}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>Ödenen</div>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: '#22c55e' }}>{formatTL(Number(agency.paid_amount || 0))}</div>
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); router.push(`/dashboard/admin/agencies/${agency.id}`) }}
                        style={{ padding: '5px 14px', borderRadius: '100px', fontSize: '10px', fontWeight: '500', cursor: 'pointer', border: '0.5px solid rgba(0,0,0,0.15)', background: '#fff', color: '#555',  flexShrink: 0 }}>
                        Detay
                      </button>
                      <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.25)', flexShrink: 0, userSelect: 'none' }}>
                        {expanded === agency.id ? '▲' : '▼'}
                      </div>
                    </div>

                    {/* EXPANDED DETAIL */}
                    {expanded === agency.id && (
                      <div style={{ background: '#fafaf8', borderTop: '0.5px solid rgba(0,0,0,0.06)', padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                          <button onClick={e => { e.stopPropagation(); toggleAgencyStatus(agency) }}
                            style={{
                              padding: '5px 14px', borderRadius: '100px', fontSize: '10px', fontWeight: '500', cursor: 'pointer',
                              border: agency.status === 'active' ? '1px solid rgba(0,0,0,0.15)' : '1px solid #22c55e',
                              background: agency.status === 'active' ? '#fff' : 'rgba(34,197,94,0.1)',
                              color: agency.status === 'active' ? '#888' : '#22c55e', 
                            }}>
                            {agency.status === 'active' ? 'Pasife Al' : 'Aktife Al'}
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                          {/* PIPELINE */}
                          <div>
                            <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                              Müşteri Pipeline ({(agencyClients[agency.id] || []).length})
                            </div>

                            {/* Add pipeline client form */}
                            <form onSubmit={addPipelineClient} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                <div>
                                  <label style={labelStyle}>Şirket Adı *</label>
                                  <input required value={pipelineForm.company_name} onChange={e => setPipelineForm({ ...pipelineForm, company_name: e.target.value })} style={{ ...inputStyle, fontSize: '12px' }} placeholder="Şirket adı" />
                                </div>
                                <div>
                                  <label style={labelStyle}>Yetkili Adı</label>
                                  <input value={pipelineForm.contact_name} onChange={e => setPipelineForm({ ...pipelineForm, contact_name: e.target.value })} style={{ ...inputStyle, fontSize: '12px' }} placeholder="Ad soyad" />
                                </div>
                                <div>
                                  <label style={labelStyle}>E-posta</label>
                                  <input type="email" value={pipelineForm.contact_email} onChange={e => setPipelineForm({ ...pipelineForm, contact_email: e.target.value })} style={{ ...inputStyle, fontSize: '12px' }} placeholder="email@sirket.com" />
                                </div>
                                <div>
                                  <label style={labelStyle}>Telefon</label>
                                  <input value={pipelineForm.contact_phone} onChange={e => setPipelineForm({ ...pipelineForm, contact_phone: e.target.value })} style={{ ...inputStyle, fontSize: '12px' }} placeholder="+90 5xx" />
                                </div>
                              </div>
                              <div style={{ marginBottom: '8px' }}>
                                <label style={labelStyle}>Notlar</label>
                                <input value={pipelineForm.notes} onChange={e => setPipelineForm({ ...pipelineForm, notes: e.target.value })} style={{ ...inputStyle, fontSize: '12px' }} placeholder="Opsiyonel not..." />
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <select value={pipelineForm.status} onChange={e => setPipelineForm({ ...pipelineForm, status: e.target.value })}
                                  style={{ ...inputStyle, fontSize: '11px', width: 'auto', flex: 1 }}>
                                  {Object.entries(PIPELINE_STATUS).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                  ))}
                                </select>
                                <button type="submit" style={{ padding: '7px 16px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '500', cursor: 'pointer',  flexShrink: 0 }}>
                                  Ekle
                                </button>
                              </div>
                            </form>

                            {/* Pipeline list */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {(agencyClients[agency.id] || []).length === 0 ? (
                                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', padding: '12px', textAlign: 'center' }}>Pipeline boş.</div>
                              ) : (agencyClients[agency.id] || []).map(c => (
                                <div key={c.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: '8px', padding: '10px 12px', borderLeft: `3px solid ${PIPELINE_STATUS[c.status]?.color || '#888'}` }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                    <div>
                                      <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>{c.company_name}</div>
                                      {(c.contact_name || c.contact_email) && (
                                        <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                                          {c.contact_name}{c.contact_name && c.contact_email ? ' · ' : ''}{c.contact_email}
                                        </div>
                                      )}
                                      {c.notes && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '2px', fontStyle: 'italic' }}>{c.notes}</div>}
                                    </div>
                                    <select value={c.status} onChange={e => updatePipelineStatus(c.id, agency.id, e.target.value)}
                                      onClick={e => e.stopPropagation()}
                                      style={{ fontSize: '10px', padding: '3px 6px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '6px', background: '#fff', color: PIPELINE_STATUS[c.status]?.color || '#888', cursor: 'pointer', outline: 'none' }}>
                                      {Object.entries(PIPELINE_STATUS).map(([k, v]) => (
                                        <option key={k} value={k}>{v.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div style={{ fontSize: '10px', color: '#ccc', marginTop: '4px' }}>
                                    {new Date(c.created_at).toLocaleDateString('tr-TR')}
                                    {c.clients?.company_name && <span style={{ color: '#22c55e', marginLeft: '8px' }}>→ {c.clients.company_name}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* INVOICES & PAYMENT REQUESTS */}
                          <div>
                            {/* Agency Invoices */}
                            <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                              Faturalar ({(agencyInvoices[agency.id] || []).length})
                            </div>

                            <form onSubmit={addInvoice} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                <div>
                                  <label style={labelStyle}>Tutar (₺) *</label>
                                  <input required type="number" min="0" step="0.01" value={invoiceForm.amount} onChange={e => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} style={{ ...inputStyle, fontSize: '12px' }} placeholder="0.00" />
                                </div>
                                <div>
                                  <label style={labelStyle}>Fatura No</label>
                                  <input value={invoiceForm.invoice_number} onChange={e => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })} style={{ ...inputStyle, fontSize: '12px' }} placeholder="FAT-001" />
                                </div>
                                <div>
                                  <label style={labelStyle}>Fatura Tarihi</label>
                                  <input type="date" value={invoiceForm.invoice_date} onChange={e => setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })} style={{ ...inputStyle, fontSize: '12px' }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                  <button type="submit" style={{ width: '100%', padding: '8px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '500', cursor: 'pointer',  }}>
                                    Fatura Ekle
                                  </button>
                                </div>
                              </div>
                            </form>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                              {(agencyInvoices[agency.id] || []).length === 0 ? (
                                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', padding: '12px', textAlign: 'center' }}>Fatura yok.</div>
                              ) : (agencyInvoices[agency.id] || []).map(inv => (
                                <div key={inv.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px', borderLeft: `3px solid ${inv.is_paid ? '#22c55e' : '#f59e0b'}` }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{formatTL(Number(inv.amount))}</div>
                                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>
                                      {inv.invoice_number && <span style={{ marginRight: '8px' }}>{inv.invoice_number}</span>}
                                      {inv.invoice_date && new Date(inv.invoice_date).toLocaleDateString('tr-TR')}
                                    </div>
                                  </div>
                                  <button onClick={() => toggleInvoicePaid(inv, agency.id)}
                                    style={{
                                      padding: '4px 12px', borderRadius: '100px', fontSize: '10px', fontWeight: '500', cursor: 'pointer',
                                      border: inv.is_paid ? '1px solid #22c55e' : '1px solid rgba(0,0,0,0.15)',
                                      background: inv.is_paid ? 'rgba(34,197,94,0.1)' : '#fff',
                                      color: inv.is_paid ? '#22c55e' : '#888', 
                                    }}>
                                    {inv.is_paid ? '✓ Ödendi' : 'Bekliyor'}
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* Payment Requests */}
                            {(paymentRequests[agency.id] || []).length > 0 && (
                              <>
                                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                                  Ödeme Talepleri ({(paymentRequests[agency.id] || []).length})
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {(paymentRequests[agency.id] || []).map(req => (
                                    <div key={req.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: '8px', padding: '10px 12px', borderLeft: `3px solid ${req.status === 'approved' ? '#22c55e' : req.status === 'rejected' ? '#ef4444' : '#f59e0b'}` }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                        <div style={{ flex: 1 }}>
                                          <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
                                            {PAYMENT_REQUEST_TYPE[req.request_type] || req.request_type}
                                          </div>
                                          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                                            {req.amount && <span style={{ marginRight: '8px' }}>{formatTL(Number(req.amount))}</span>}
                                            {req.credits_requested && <span>{req.credits_requested} kredi</span>}
                                          </div>
                                          {editingNote === req.id ? (
                                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                              <input value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder="Admin notu..."
                                                style={{ ...inputStyle, fontSize: '11px' }} />
                                              <button onClick={() => saveRequestNote(req.id, agency.id)}
                                                style={{ padding: '5px 10px', background: '#111113', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '10px', cursor: 'pointer',  flexShrink: 0 }}>✓</button>
                                            </div>
                                          ) : (
                                            <div onClick={() => { setEditingNote(req.id); setNoteInput(req.admin_note || '') }}
                                              style={{ fontSize: '11px', color: req.admin_note ? '#0a0a0a' : '#ccc', cursor: 'pointer', marginTop: '4px', fontStyle: req.admin_note ? 'normal' : 'italic' }}>
                                              {req.admin_note || 'Not ekle...'}
                                            </div>
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                          {req.status === 'pending' && (
                                            <>
                                              <button onClick={() => updatePaymentRequestStatus(req.id, agency.id, 'approved')}
                                                style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '10px', border: '1px solid #22c55e', background: 'rgba(34,197,94,0.1)', color: '#22c55e', cursor: 'pointer',  }}>Onayla</button>
                                              <button onClick={() => updatePaymentRequestStatus(req.id, agency.id, 'rejected')}
                                                style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '10px', border: '1px solid rgba(0,0,0,0.15)', background: '#fff', color: '#888', cursor: 'pointer',  }}>Reddet</button>
                                            </>
                                          )}
                                          {req.status !== 'pending' && (
                                            <span style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '6px', background: req.status === 'approved' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: req.status === 'approved' ? '#22c55e' : '#ef4444' }}>
                                              {req.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div style={{ fontSize: '10px', color: '#ccc', marginTop: '4px' }}>{new Date(req.created_at).toLocaleDateString('tr-TR')}</div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
    </div>
  )
}
