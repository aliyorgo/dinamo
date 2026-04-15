'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const NAV = [
  { label: 'Genel Bakış', href: '/dashboard/admin' },
  { label: 'Kullanıcılar', href: '/dashboard/admin/users' },
  { label: 'Müşteriler', href: '/dashboard/admin/clients' },
  { label: 'Briefler', href: '/dashboard/admin/briefs' },
  { label: "Creator'lar", href: '/dashboard/admin/creators' },
  { label: 'Krediler', href: '/dashboard/admin/credits' },
  { label: 'Raporlar', href: '/dashboard/admin/reports' },
  { label: 'Faturalar', href: '/dashboard/admin/invoices' },
  { label: 'Ajanslar', href: '/dashboard/admin/agencies' },
  { label: 'Ana Sayfa', href: '/dashboard/admin/homepage' },
  { label: 'Ayarlar', href: '/dashboard/admin/settings' },
]

function formatTL(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₺'
}

export default function AgencyDetailPage() {
  const router = useRouter()
  const params = useParams()
  const agencyId = params.id as string

  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [agency, setAgency] = useState<any>(null)
  const [clients, setClients] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [paymentRequests, setPaymentRequests] = useState<any[]>([])
  const [agencySales, setAgencySales] = useState<any[]>([])

  const [msg, setMsg] = useState('')
  const [msgColor, setMsgColor] = useState('#22c55e')

  // Logo
  const logoRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // Credit load modal
  const [creditClient, setCreditClient] = useState<any>(null)
  const [creditAmount, setCreditAmount] = useState('')
  const [loadingCredit, setLoadingCredit] = useState(false)

  // Invoice form
  const [invoiceForm, setInvoiceForm] = useState({ amount: '', invoice_date: '', invoice_number: '' })

  // Add client form (admin)
  const [addForm, setAddForm] = useState({ company_name: '', credit_amount: '30', status: 'demo' })
  const [addingClient, setAddingClient] = useState(false)

  // Client edit modal
  const [editClient, setEditClient] = useState<any>(null)
  const [editClientForm, setEditClientForm] = useState({ company_name: '', status: '' })
  const [savingClient, setSavingClient] = useState(false)

  // Client delete modal
  const [deleteClient, setDeleteClient] = useState<any>(null)
  const [deleteHasBriefs, setDeleteHasBriefs] = useState(false)
  const [deletingClient, setDeletingClient] = useState(false)

  // Note editing
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState('')

  // Credentials
  const [agencyUserId, setAgencyUserId] = useState<string | null>(null)
  const [credEmail, setCredEmail] = useState('')
  const [editingEmail, setEditingEmail] = useState(false)

  // Commission editing
  const [editingCommission, setEditingCommission] = useState(false)
  const [commissionInput, setCommissionInput] = useState('')
  const [recalcPast, setRecalcPast] = useState(false)
  const [savingCommission, setSavingCommission] = useState(false)
  const [newEmailInput, setNewEmailInput] = useState('')
  const [lastLogin, setLastLogin] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  // Password modal
  const [pwModal, setPwModal] = useState(false)
  const [modalPassword, setModalPassword] = useState('')
  const [pwCopied, setPwCopied] = useState(false)
  // Create user modal (when no user exists)
  const [createUserModal, setCreateUserModal] = useState(false)
  const [createUserForm, setCreateUserForm] = useState({ email: '', password: '' })
  const [createUserLoading, setCreateUserLoading] = useState(false)

  function formatLastLogin(d: string | null) {
    if (!d) return 'Henüz giriş yapılmadı'
    return new Date(d).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  useEffect(() => { load() }, [agencyId])

  // Refresh data when tab regains focus (catches changes made from agency panel)
  useEffect(() => {
    const onFocus = () => { if (!loading) load() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [agencyId, loading])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: ud } = await supabase.from('users').select('name, role').eq('id', user.id).single()
    if (!ud || ud.role !== 'admin') { router.push('/login'); return }
    setUserName(ud.name)

    const [{ data: ag }, { data: cls }, { data: invs }, { data: reqs }, { data: agUser }, { data: agSales }] = await Promise.all([
      supabase.from('agencies').select('*').eq('id', agencyId).single(),
      supabase.from('clients').select('*, client_users(count)').eq('agency_id', agencyId).order('created_at', { ascending: false }),
      supabase.from('agency_invoices').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }),
      supabase.from('agency_payment_requests').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }),
      supabase.from('users').select('id, email').eq('agency_id', agencyId).eq('role', 'agency').maybeSingle(),
      supabase.from('credit_sales').select('*, clients(company_name)').eq('agency_id', agencyId).order('created_at', { ascending: false }),
    ])

    // Fetch last login for agency user
    setAgencyUserId(agUser?.id ?? null)
    if (agUser) {
      setCredEmail(agUser.email || '')
      setNewEmailInput(agUser.email || '')
      const res = await fetch('/api/admin/auth-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [agUser.id] }),
      })
      if (res.ok) {
        const info = await res.json()
        setLastLogin(info[agUser.id]?.last_sign_in_at ?? null)
      }
    }

    if (!ag) { router.push('/dashboard/admin/agencies'); return }
    setAgency(ag)
    setClients(cls || [])
    setInvoices(invs || [])
    setPaymentRequests(reqs || [])
    setAgencySales(agSales || [])
    setLoading(false)
  }

  function showMsg(text: string, isError = false) {
    setMsg(text)
    setMsgColor(isError ? '#ef4444' : '#22c55e')
    setTimeout(() => setMsg(''), 3000)
  }

  // ── LOGO ─────────────────────────────────────────────────────────────────
  async function handleLogoUpload() {
    const file = logoRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `agency_${agencyId}_logo.${ext}`
    const { error: upErr } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true })
    if (upErr) { showMsg(upErr.message, true); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
    const logoUrl = urlData.publicUrl
    await supabase.from('agencies').update({ logo_url: logoUrl }).eq('id', agencyId)
    setAgency((prev: any) => ({ ...prev, logo_url: logoUrl + '?t=' + Date.now() }))
    if (logoRef.current) logoRef.current.value = ''
    showMsg('Logo güncellendi.')
    setUploading(false)
  }

  async function removeLogo() {
    await supabase.from('agencies').update({ logo_url: null }).eq('id', agencyId)
    setAgency((prev: any) => ({ ...prev, logo_url: null }))
    showMsg('Logo kaldırıldı.')
  }

  // ── CREDIT LOAD ───────────────────────────────────────────────────────────
  async function loadCredit(e: React.FormEvent) {
    e.preventDefault()
    if (!creditClient) return
    const amount = parseInt(creditAmount)
    if (!amount || amount <= 0) return
    setLoadingCredit(true)

    const newBalance = Number(creditClient.credit_balance || 0) + amount
    const { error } = await supabase.from('clients')
      .update({ credit_balance: newBalance, status: 'active' })
      .eq('id', creditClient.id)

    if (error) { showMsg(error.message, true); setLoadingCredit(false); return }

    // Log transaction
    await supabase.from('credit_transactions').insert({
      client_id: creditClient.id,
      amount,
      type: 'top_up',
      description: `Ajans kredi yüklemesi (${agency?.name})`,
    })

    setClients(prev => prev.map(c => c.id === creditClient.id ? { ...c, credit_balance: newBalance, status: 'active' } : c))
    setCreditClient(null)
    setCreditAmount('')
    showMsg(`${amount} kredi yüklendi, hesap aktifleştirildi.`)
    setLoadingCredit(false)
  }

  // ── INVOICES ──────────────────────────────────────────────────────────────
  async function addInvoice(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(invoiceForm.amount)
    const { error } = await supabase.from('agency_invoices').insert({
      agency_id: agencyId, amount: amt,
      invoice_date: invoiceForm.invoice_date || null,
      invoice_number: invoiceForm.invoice_number || null,
    })
    if (error) { showMsg(error.message, true); return }
    const newInvoiced = Number(agency.invoiced_amount || 0) + amt
    await supabase.from('agencies').update({ invoiced_amount: newInvoiced }).eq('id', agencyId)
    setAgency((prev: any) => ({ ...prev, invoiced_amount: newInvoiced }))
    setInvoiceForm({ amount: '', invoice_date: '', invoice_number: '' })
    showMsg('Fatura eklendi.')
    const { data } = await supabase.from('agency_invoices').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false })
    setInvoices(data || [])
  }

  async function toggleInvoicePaid(inv: any) {
    const isPaid = !inv.is_paid
    await supabase.from('agency_invoices').update({ is_paid: isPaid, paid_at: isPaid ? new Date().toISOString() : null }).eq('id', inv.id)
    const delta = isPaid ? Number(inv.amount) : -Number(inv.amount)
    const newPaid = Math.max(0, Number(agency.paid_amount || 0) + delta)
    await supabase.from('agencies').update({ paid_amount: newPaid }).eq('id', agencyId)
    setAgency((prev: any) => ({ ...prev, paid_amount: newPaid }))
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, is_paid: isPaid } : i))
  }

  // ── PAYMENT REQUESTS ──────────────────────────────────────────────────────
  async function updateRequestStatus(id: string, status: string) {
    const res = await fetch('/api/admin/approve-credit-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: id, status }),
    })
    const data = await res.json()
    if (data.error) { showMsg(data.error, true); return }

    if (status === 'approved' && data.newCredits !== undefined) {
      setAgency((prev: any) => ({
        ...prev,
        demo_credits: data.newCredits ?? prev.demo_credits,
        invoiced_amount: data.newInvoiced ?? prev.invoiced_amount,
      }))
      showMsg(`${data.creditsAdded || 0} kredi yuklendi, ${formatTL(data.amountInvoiced || 0)} faturalandi.`)
    }

    setPaymentRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  async function saveNote(id: string) {
    await supabase.from('agency_payment_requests').update({ admin_note: noteInput }).eq('id', id)
    setPaymentRequests(prev => prev.map(r => r.id === id ? { ...r, admin_note: noteInput } : r))
    setEditingNote(null)
  }

  // ── CREDENTIALS ───────────────────────────────────────────────────────────
  async function saveEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!agencyUserId) return
    const res = await fetch('/api/admin/reset-agency-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agencyId, newEmail: newEmailInput }),
    })
    const data = await res.json()
    if (data.error) { showMsg(data.error, true); return }
    setCredEmail(newEmailInput)
    setEditingEmail(false)
    showMsg('E-posta güncellendi.')
  }

  async function resetPassword() {
    if (!agencyUserId) return
    setResetLoading(true)
    const res = await fetch('/api/admin/reset-agency-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agencyId }),
    })
    const data = await res.json()
    setResetLoading(false)
    if (data.error) { showMsg(data.error, true); return }
    setModalPassword(data.password)
    setPwCopied(false)
    setPwModal(true)
  }

  function copyPassword() {
    navigator.clipboard.writeText(modalPassword)
    setPwCopied(true)
    setTimeout(() => setPwCopied(false), 2000)
  }

  function generateCreatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
    let pw = ''
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)]
    setCreateUserForm(prev => ({ ...prev, password: pw }))
  }

  async function createAgencyUser(e: React.FormEvent) {
    e.preventDefault()
    setCreateUserLoading(true)
    const res = await fetch('/api/admin/create-agency-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyId,
        agencyName: agency?.name,
        email: createUserForm.email,
        password: createUserForm.password,
      }),
    })
    const data = await res.json()
    setCreateUserLoading(false)
    if (data.error) { showMsg(data.error, true); return }
    setAgencyUserId(data.userId)
    setCredEmail(createUserForm.email)
    setNewEmailInput(createUserForm.email)
    setCreateUserModal(false)
    setCreateUserForm({ email: '', password: '' })
    showMsg('Kullanıcı oluşturuldu.')
  }

  const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
    demo: { label: 'Demo', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
    pending: { label: 'Beklemede', bg: 'rgba(156,163,175,0.1)', color: '#6b7280' },
    active: { label: 'Aktif', bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
    lost: { label: 'Kaybedildi', bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
  }

  async function addClient(e: React.FormEvent) {
    e.preventDefault()
    setAddingClient(true)
    const creditAmount = parseInt(addForm.credit_amount) || 0

    const dupRes = await fetch('/api/check-client-duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name: addForm.company_name, agency_id: agencyId }),
    })
    const dupData = await dupRes.json()
    if (!dupData.ok) { showMsg(dupData.message, true); setAddingClient(false); return }

    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        company_name: addForm.company_name,
        agency_id: agencyId,
        status: addForm.status,
        credit_balance: creditAmount,
      })
      .select()
      .single()

    if (error || !newClient) { showMsg(error?.message || 'Bilinmeyen hata', true); setAddingClient(false); return }

    if (creditAmount > 0) {
      await supabase.from('credit_transactions').insert({
        client_id: newClient.id,
        amount: creditAmount,
        type: addForm.status === 'demo' ? 'demo' : 'top_up',
        description: addForm.status === 'demo'
          ? `Admin demo kredisi — ${agency?.name}`
          : `Admin kredi yüklemesi — ${agency?.name}`,
      })
    }

    const { data: freshClients } = await supabase.from('clients').select('*, client_users(count)').eq('agency_id', agencyId).order('created_at', { ascending: false })
    setClients(freshClients || [])
    setAddForm({ company_name: '', credit_amount: '30', status: 'demo' })
    setAddingClient(false)
    showMsg(`Müşteri eklendi${creditAmount > 0 ? `, ${creditAmount} kredi yüklendi` : ''}.`)
  }

  async function changeClientStatus(clientId: string, newStatus: string) {
    const { error } = await supabase.from('clients').update({ status: newStatus }).eq('id', clientId)
    if (error) { showMsg(error.message, true); return }
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: newStatus } : c))
    showMsg('Durum güncellendi.')
  }

  function openEditClientModal(client: any) {
    setEditClientForm({ company_name: client.company_name || '', status: client.status || 'pending' })
    setEditClient(client)
  }

  async function saveClientEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editClient) return
    setSavingClient(true)
    const { error } = await supabase.from('clients').update({
      company_name: editClientForm.company_name,
      status: editClientForm.status,
    }).eq('id', editClient.id)
    if (error) { showMsg(error.message, true); setSavingClient(false); return }
    setClients(prev => prev.map(c => c.id === editClient.id ? { ...c, company_name: editClientForm.company_name, status: editClientForm.status } : c))
    setEditClient(null)
    setSavingClient(false)
    showMsg('Müşteri güncellendi.')
  }

  async function openDeleteClientModal(client: any) {
    const { count } = await supabase.from('briefs').select('id', { count: 'exact', head: true }).eq('client_id', client.id)
    setDeleteHasBriefs((count || 0) > 0)
    setDeleteClient(client)
  }

  async function confirmDeleteClient() {
    if (!deleteClient) return
    setDeletingClient(true)
    const { error } = await supabase.from('clients').delete().eq('id', deleteClient.id)
    if (error) { showMsg(error.message, true); setDeletingClient(false); return }
    setClients(prev => prev.filter(c => c.id !== deleteClient.id))
    setDeleteClient(null)
    setDeletingClient(false)
    showMsg('Müşteri silindi.')
  }

  function openCommissionEdit() {
    setCommissionInput(String((Number(agency?.commission_rate || 0) * 100).toFixed(1)).replace(/\.0$/, ''))
    setRecalcPast(false)
    setEditingCommission(true)
  }

  async function saveCommission(e: React.FormEvent) {
    e.preventDefault()
    const pct = parseFloat(commissionInput)
    if (isNaN(pct) || pct < 0 || pct > 100) { showMsg('Gecersiz oran', true); return }
    setSavingCommission(true)
    const newRate = pct / 100

    await supabase.from('agencies').update({ commission_rate: newRate }).eq('id', agencyId)

    if (recalcPast && agencySales.length > 0) {
      let totalEarnings = 0
      for (const sale of agencySales) {
        totalEarnings += Number(sale.total_amount || 0) * newRate
      }
      await supabase.from('agencies').update({ total_earnings: totalEarnings }).eq('id', agencyId)
      setAgency((prev: any) => ({ ...prev, commission_rate: newRate, total_earnings: totalEarnings }))
      showMsg(`Komisyon %${pct} olarak guncellendi, gecmis kazanclar yeniden hesaplandi.`)
    } else {
      setAgency((prev: any) => ({ ...prev, commission_rate: newRate }))
      showMsg(`Komisyon %${pct} olarak guncellendi.`)
    }

    setEditingCommission(false)
    setSavingCommission(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '0.5px solid rgba(0,0,0,0.15)',
    borderRadius: '8px', fontSize: '13px', color: '#0a0a0a',
    fontFamily: 'var(--font-dm-sans),sans-serif', outline: 'none', boxSizing: 'border-box', background: '#fff',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  }

  const activeClients = clients.filter(c => c.status === 'active')
  const pendingClients = clients.filter(c => c.status !== 'active')

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
        <div style={{ color: '#888', fontSize: '14px' }}>Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "var(--font-dm-sans),'DM Sans',system-ui,sans-serif" }}>

      {/* SIDEBAR */}
      <div style={{ width: '220px', background: '#111113', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#fff', letterSpacing: '-0.5px', marginBottom: '12px' }}>
            dinam<span style={{ display: 'inline-block', width: '11px', height: '11px', borderRadius: '50%', border: '2.5px solid #22c55e', position: 'relative', top: '1px' }}></span>
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '3px' }}>Admin</div>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff' }}>{userName}</div>
        </div>
        <nav style={{ padding: '10px 8px', flex: 1 }}>
          {NAV.map(item => (
            <div key={item.href} onClick={() => router.push(item.href)}
              style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: item.href === '/dashboard/admin/agencies' ? 'rgba(255,255,255,0.08)' : 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '12px', color: item.href === '/dashboard/admin/agencies' ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: item.href === '/dashboard/admin/agencies' ? '500' : '400' }}>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} style={{ padding: '6px 8px', borderRadius: '7px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-dm-sans),sans-serif' }}>Çıkış yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button onClick={() => router.push('/dashboard/admin/agencies')}
            style={{ fontSize: '12px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
            ← Ajanslar
          </button>
          <span style={{ color: '#ddd' }}>/</span>
          {agency?.logo_url && (
            <div style={{ width: '24px', height: '24px', borderRadius: '6px', overflow: 'hidden', background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', flexShrink: 0 }}>
              <img src={agency.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }} />
            </div>
          )}
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>{agency?.name}</div>
          {msg && <div style={{ marginLeft: 'auto', fontSize: '12px', color: msgColor }}>{msg}</div>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>

            {/* LEFT — Logo + Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* LOGO */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>Logo</div>
                <div style={{ width: '100%', height: '120px', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: '10px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf8', overflow: 'hidden' }}>
                  {agency?.logo_url ? (
                    <img src={agency.logo_url} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '12px' }} />
                  ) : (
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#111113', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '22px', fontWeight: '500', color: '#fff' }}>{agency?.name?.charAt(0)?.toUpperCase() || 'A'}</span>
                    </div>
                  )}
                </div>
                <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => logoRef.current?.click()} disabled={uploading}
                    style={{ flex: 1, padding: '7px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                    {uploading ? 'Yükleniyor...' : 'Logo Yükle'}
                  </button>
                  {agency?.logo_url && (
                    <button onClick={removeLogo}
                      style={{ padding: '7px 12px', background: '#fff', color: '#888', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                      Kaldır
                    </button>
                  )}
                </div>
              </div>

              {/* INFO */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Bilgiler</div>
                {[
                  { label: 'Durum', value: agency?.status === 'active' ? 'Aktif' : 'Pasif', color: agency?.status === 'active' ? '#22c55e' : '#888' },
                  { label: 'Iletisim', value: agency?.contact_email || '\u2014' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>{row.label}</span>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: row.color || '#0a0a0a' }}>{row.value}</span>
                  </div>
                ))}
                {/* KOMISYON — editable */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: '12px', color: '#888' }}>Komisyon</span>
                  {editingCommission ? (
                    <form onSubmit={saveCommission} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#888' }}>%</span>
                        <input type="number" step="0.1" min="0" max="100" value={commissionInput} onChange={e => setCommissionInput(e.target.value)} autoFocus
                          style={{ width: '60px', padding: '3px 6px', border: '0.5px solid rgba(0,0,0,0.2)', borderRadius: '5px', fontSize: '12px', fontWeight: '500', color: '#0a0a0a', fontFamily: 'var(--font-dm-sans),sans-serif', outline: 'none', textAlign: 'right' }} />
                        <button type="submit" disabled={savingCommission}
                          style={{ padding: '3px 8px', background: '#111113', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '10px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                          {savingCommission ? '...' : '\u2713'}
                        </button>
                        <button type="button" onClick={() => setEditingCommission(false)}
                          style={{ padding: '3px 8px', background: '#fff', color: '#888', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '5px', fontSize: '10px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                          \u2715
                        </button>
                      </div>
                      {agencySales.length > 0 && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={recalcPast} onChange={e => setRecalcPast(e.target.checked)}
                            style={{ width: '12px', height: '12px' }} />
                          <span style={{ fontSize: '10px', color: '#888' }}>Gecmis kazanclari yeniden hesapla</span>
                        </label>
                      )}
                    </form>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>%{(Number(agency?.commission_rate || 0) * 100).toFixed(1)}</span>
                      <button onClick={openCommissionEdit}
                        style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '100px', border: '0.5px solid rgba(0,0,0,0.15)', background: '#fff', color: '#555', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                        Duzenle
                      </button>
                    </div>
                  )}
                </div>
                {[
                  { label: 'Demo Kredi', value: `${agency?.demo_credits || 0}` },
                  { label: 'Toplam Kazanc', value: formatTL(Number(agency?.total_earnings || 0)) },
                  { label: 'Faturalanan', value: formatTL(Number(agency?.invoiced_amount || 0)) },
                  { label: 'Odenen', value: formatTL(Number(agency?.paid_amount || 0)), color: '#22c55e' },
                  { label: 'Musteri', value: `${clients.length} (${activeClients.length} aktif)` },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>{row.label}</span>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: row.color || '#0a0a0a' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* GİRİŞ BİLGİLERİ */}
              {!loading && (
                <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>Giriş Bilgileri</div>

                  {agencyUserId === null ? (
                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                      <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '12px' }}>Bu ajans için henüz kullanıcı oluşturulmamış.</div>
                      <button onClick={() => setCreateUserModal(true)}
                        style={{ padding: '8px 18px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                        Kullanıcı Oluştur
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Email */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>E-posta</div>
                        {editingEmail ? (
                          <form onSubmit={saveEmail} style={{ display: 'flex', gap: '6px' }}>
                            <input required type="email" value={newEmailInput} onChange={e => setNewEmailInput(e.target.value)}
                              style={{ flex: 1, padding: '6px 10px', border: '0.5px solid rgba(0,0,0,0.2)', borderRadius: '7px', fontSize: '12px', color: '#0a0a0a', fontFamily: 'var(--font-dm-sans),sans-serif', outline: 'none' }} autoFocus />
                            <button type="submit" style={{ padding: '6px 10px', background: '#111113', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '11px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>✓ Kaydet</button>
                            <button type="button" onClick={() => { setEditingEmail(false); setNewEmailInput(credEmail) }}
                              style={{ padding: '6px 10px', background: '#fff', color: '#888', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '7px', fontSize: '11px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>İptal</button>
                          </form>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: '#0a0a0a', flex: 1 }}>{credEmail}</span>
                            <button onClick={() => setEditingEmail(true)}
                              style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '100px', border: '0.5px solid rgba(0,0,0,0.15)', background: '#fff', color: '#555', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif', flexShrink: 0 }}>
                              Düzenle
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Password reset */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Şifre</div>
                        <button onClick={resetPassword} disabled={resetLoading}
                          style={{ padding: '7px 16px', background: '#fff', color: '#0a0a0a', border: '0.5px solid rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: resetLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                          {resetLoading ? 'Sıfırlanıyor...' : 'Şifre Sıfırla'}
                        </button>
                      </div>

                      {/* Last login */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '0.5px solid rgba(0,0,0,0.05)' }}>
                        <span style={{ fontSize: '12px', color: '#888' }}>Son Giriş</span>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: lastLogin ? '#0a0a0a' : '#aaa' }}>
                          {formatLastLogin(lastLogin)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT — Clients + Invoices + Requests */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* ADD CLIENT FORM */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Müşteri Ekle</div>
                <form onSubmit={addClient} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px auto', gap: '10px', alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>Şirket Adı *</label>
                    <input required value={addForm.company_name} onChange={e => setAddForm({ ...addForm, company_name: e.target.value })}
                      style={{ ...inputStyle, fontSize: '12px' }} placeholder="Şirket adı" />
                  </div>
                  <div>
                    <label style={labelStyle}>Kredi</label>
                    <input type="number" min="0" value={addForm.credit_amount} onChange={e => setAddForm({ ...addForm, credit_amount: e.target.value })}
                      style={{ ...inputStyle, fontSize: '12px' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Durum</label>
                    <select value={addForm.status} onChange={e => setAddForm({ ...addForm, status: e.target.value })}
                      style={{ ...inputStyle, fontSize: '12px', cursor: 'pointer' }}>
                      {Object.entries(STATUS_MAP).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" disabled={addingClient}
                    style={{ padding: '8px 16px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: addingClient ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif', height: '36px' }}>
                    {addingClient ? '...' : 'Ekle'}
                  </button>
                </form>
              </div>

              {/* CLIENTS */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
                  Müşteriler ({clients.length}) · {activeClients.length} aktif · {pendingClients.length} beklemede
                </div>
                {clients.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#aaa', fontSize: '12px' }}>Bu ajansa bağlı müşteri yok.</div>
                ) : clients.map(client => {
                  const st = STATUS_MAP[client.status] || STATUS_MAP.pending
                  return (
                  <div key={client.id} style={{
                    padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,0.06)',
                    display: 'flex', alignItems: 'center', gap: '12px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{client.company_name}</span>
                        <select value={client.status || 'pending'} onChange={e => changeClientStatus(client.id, e.target.value)}
                          style={{
                            fontSize: '10px', padding: '2px 6px', borderRadius: '100px', fontWeight: '500',
                            background: st.bg, color: st.color, border: `1px solid ${st.color}30`,
                            cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif', outline: 'none',
                          }}>
                          {Object.entries(STATUS_MAP).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '3px', display: 'flex', gap: '12px' }}>
                        <span>{client.credit_balance || 0} kredi</span>
                        {client.created_at && <span>{new Date(client.created_at).toLocaleDateString('tr-TR')}</span>}
                      </div>
                    </div>
                    <button onClick={() => { setCreditClient(client); setCreditAmount('') }}
                      style={{ padding: '5px 14px', borderRadius: '100px', fontSize: '10px', fontWeight: '500', cursor: 'pointer', border: '0.5px solid rgba(0,0,0,0.15)', background: '#fff', color: '#555', fontFamily: 'var(--font-dm-sans),sans-serif', flexShrink: 0 }}>
                      Kredi Yükle
                    </button>
                    <button onClick={() => openEditClientModal(client)} title="Düzenle"
                      style={{ width: '28px', height: '28px', borderRadius: '7px', border: '0.5px solid rgba(0,0,0,0.1)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#666', flexShrink: 0 }}>
                      ✎
                    </button>
                    <button onClick={() => openDeleteClientModal(client)} title="Sil"
                      style={{ width: '28px', height: '28px', borderRadius: '7px', border: '0.5px solid rgba(0,0,0,0.1)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#ef4444', flexShrink: 0 }}>
                      🗑
                    </button>
                    <button onClick={() => router.push(`/dashboard/admin/clients/${client.id}`)}
                      style={{ padding: '5px 14px', borderRadius: '100px', fontSize: '10px', fontWeight: '500', cursor: 'pointer', border: '0.5px solid rgba(0,0,0,0.15)', background: '#fff', color: '#555', fontFamily: 'var(--font-dm-sans),sans-serif', flexShrink: 0 }}>
                      Detay
                    </button>
                  </div>
                  )
                })}
              </div>

              {/* INVOICES */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
                  Faturalar ({invoices.length})
                </div>
                <div style={{ padding: '14px 20px', borderBottom: invoices.length > 0 ? '0.5px solid rgba(0,0,0,0.06)' : 'none' }}>
                  <form onSubmit={addInvoice} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
                    <div>
                      <label style={labelStyle}>Tutar (₺) *</label>
                      <input required type="number" min="0" step="0.01" value={invoiceForm.amount} onChange={e => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} style={{ ...inputStyle, fontSize: '12px' }} placeholder="0.00" />
                    </div>
                    <div>
                      <label style={labelStyle}>Fatura No</label>
                      <input value={invoiceForm.invoice_number} onChange={e => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })} style={{ ...inputStyle, fontSize: '12px' }} placeholder="FAT-001" />
                    </div>
                    <div>
                      <label style={labelStyle}>Tarih</label>
                      <input type="date" value={invoiceForm.invoice_date} onChange={e => setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })} style={{ ...inputStyle, fontSize: '12px' }} />
                    </div>
                    <button type="submit" style={{ padding: '8px 16px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                      Ekle
                    </button>
                  </form>
                </div>
                {invoices.map(inv => (
                  <div key={inv.id} style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: `3px solid ${inv.is_paid ? '#22c55e' : '#f59e0b'}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{formatTL(Number(inv.amount))}</div>
                      <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                        {inv.invoice_number && <span style={{ marginRight: '8px' }}>{inv.invoice_number}</span>}
                        {inv.invoice_date && new Date(inv.invoice_date).toLocaleDateString('tr-TR')}
                      </div>
                    </div>
                    <button onClick={() => toggleInvoicePaid(inv)}
                      style={{ padding: '5px 14px', borderRadius: '100px', fontSize: '10px', fontWeight: '500', cursor: 'pointer', border: inv.is_paid ? '1px solid #22c55e' : '1px solid rgba(0,0,0,0.15)', background: inv.is_paid ? 'rgba(34,197,94,0.1)' : '#fff', color: inv.is_paid ? '#22c55e' : '#888', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                      {inv.is_paid ? '✓ Ödendi' : 'Bekliyor'}
                    </button>
                  </div>
                ))}
              </div>

              {/* PAYMENT REQUESTS */}
              {paymentRequests.length > 0 && (
                <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>Kredi Talepleri ({paymentRequests.length})</span>
                    <span style={{ fontSize: '10px', color: '#f59e0b' }}>{paymentRequests.filter(r => r.status === 'pending').length} bekliyor</span>
                  </div>
                  {paymentRequests.map(req => (
                    <div key={req.id} style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,0.06)', borderLeft: `3px solid ${req.status === 'approved' ? '#22c55e' : req.status === 'rejected' ? '#ef4444' : '#f59e0b'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
                              {req.request_type === 'credits' ? 'Kredi Talebi' : req.request_type}
                            </span>
                            {req.credits_requested && (
                              <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '100px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontWeight: '500' }}>
                                {req.credits_requested} kredi
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                            {req.amount && formatTL(Number(req.amount))}
                            {req.created_at && <span style={{ marginLeft: '8px' }}>{new Date(req.created_at).toLocaleDateString('tr-TR')}</span>}
                          </div>
                          {editingNote === req.id ? (
                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                              <input value={noteInput} onChange={e => setNoteInput(e.target.value)} style={{ ...inputStyle, fontSize: '11px' }} placeholder="Admin notu..." />
                              <button onClick={() => saveNote(req.id)} style={{ padding: '5px 10px', background: '#111113', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '10px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>✓</button>
                            </div>
                          ) : (
                            <div onClick={() => { setEditingNote(req.id); setNoteInput(req.admin_note || '') }}
                              style={{ fontSize: '11px', color: req.admin_note ? '#0a0a0a' : '#ccc', cursor: 'pointer', marginTop: '4px', fontStyle: req.admin_note ? 'normal' : 'italic' }}>
                              {req.admin_note || 'Not ekle...'}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          {req.status === 'pending' ? (
                            <>
                              <button onClick={() => updateRequestStatus(req.id, 'approved')} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', border: '1px solid #22c55e', background: 'rgba(34,197,94,0.1)', color: '#22c55e', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>Onayla</button>
                              <button onClick={() => updateRequestStatus(req.id, 'rejected')} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', border: '1px solid rgba(0,0,0,0.15)', background: '#fff', color: '#888', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>Reddet</button>
                            </>
                          ) : (
                            <span style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '6px', background: req.status === 'approved' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: req.status === 'approved' ? '#22c55e' : '#ef4444' }}>
                              {req.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* AGENCY EARNINGS / CREDIT SALES */}
              {agencySales.length > 0 && (
                <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
                    Kazanc Hareketleri ({agencySales.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 70px 90px', gap: '6px', padding: '8px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                    {['Musteri', 'Kredi', 'Satis', 'Oran', 'Kazanc'].map(h => (
                      <div key={h} style={{ fontSize: '9px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
                    ))}
                  </div>
                  {agencySales.map((sale: any) => {
                    const saleAmount = Number(sale.total_amount || 0)
                    const rate = Number(agency?.commission_rate || 0)
                    const commission = saleAmount * rate
                    return (
                      <div key={sale.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 70px 90px', gap: '6px', padding: '10px 20px', borderTop: '0.5px solid rgba(0,0,0,0.04)', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>{(sale.clients as any)?.company_name || '\u2014'}</div>
                          <div style={{ fontSize: '10px', color: '#aaa' }}>{sale.created_at && new Date(sale.created_at).toLocaleDateString('tr-TR')}</div>
                        </div>
                        <div style={{ fontSize: '11px', color: '#0a0a0a' }}>{sale.credits} kr</div>
                        <div style={{ fontSize: '11px', color: '#0a0a0a' }}>{formatTL(saleAmount)}</div>
                        <div style={{ fontSize: '10px', color: '#888' }}>%{(rate * 100).toFixed(0)}</div>
                        <div style={{ fontSize: '11px', fontWeight: '500', color: '#22c55e' }}>+{formatTL(commission)}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PASSWORD MODAL */}
      {pwModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setPwModal(false)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '6px' }}>Yeni Şifre</div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>Şifreyi kopyalayıp ajansa iletin.</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ flex: 1, padding: '10px 14px', background: '#fafaf8', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '16px', fontFamily: 'monospace', letterSpacing: '2px', color: '#0a0a0a' }}>
                {modalPassword}
              </div>
              <button onClick={copyPassword}
                style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: '500', cursor: 'pointer', border: pwCopied ? '0.5px solid #22c55e' : '0.5px solid rgba(0,0,0,0.15)', background: pwCopied ? 'rgba(34,197,94,0.1)' : '#fff', color: pwCopied ? '#22c55e' : '#555', fontFamily: 'var(--font-dm-sans),sans-serif', flexShrink: 0 }}>
                {pwCopied ? '✓ Kopyalandı' : 'Kopyala'}
              </button>
            </div>
            <button onClick={() => setPwModal(false)}
              style={{ width: '100%', padding: '10px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {createUserModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setCreateUserModal(false)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '6px' }}>Kullanıcı Oluştur</div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '20px' }}>{agency?.name} için giriş bilgileri</div>
            <form onSubmit={createAgencyUser}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '10px', color: '#aaa', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>E-posta</label>
                <input required type="email" value={createUserForm.email}
                  onChange={e => setCreateUserForm({ ...createUserForm, email: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '0.5px solid rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '13px', fontFamily: 'var(--font-dm-sans),sans-serif', outline: 'none', boxSizing: 'border-box' }}
                  placeholder="ajans@example.com" autoFocus />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '10px', color: '#aaa', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Şifre</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input required value={createUserForm.password}
                    onChange={e => setCreateUserForm({ ...createUserForm, password: e.target.value })}
                    style={{ flex: 1, padding: '8px 12px', border: '0.5px solid rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '13px', fontFamily: 'monospace', outline: 'none' }}
                    placeholder="şifre" />
                  <button type="button" onClick={generateCreatePassword}
                    style={{ padding: '8px 12px', background: '#f5f4f0', color: '#555', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '11px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif', flexShrink: 0 }}>
                    Oluştur
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setCreateUserModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#fff', color: '#888', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  İptal
                </button>
                <button type="submit" disabled={createUserLoading}
                  style={{ flex: 2, padding: '10px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: createUserLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  {createUserLoading ? 'Oluşturuluyor...' : 'Kullanıcı Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREDIT LOAD MODAL */}
      {creditClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setCreditClient(null)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '6px' }}>Kredi Yükle</div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '20px' }}>
              {creditClient.company_name} · Mevcut: {creditClient.credit_balance || 0} kredi
            </div>
            <form onSubmit={loadCredit}>
              <label style={labelStyle}>Yüklenecek Kredi</label>
              <input required type="number" min="1" value={creditAmount} onChange={e => setCreditAmount(e.target.value)}
                style={{ ...inputStyle, marginBottom: '16px', fontSize: '18px', fontWeight: '300', letterSpacing: '-0.5px' }}
                placeholder="0" autoFocus />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setCreditClient(null)}
                  style={{ flex: 1, padding: '10px', background: '#fff', color: '#888', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  İptal
                </button>
                <button type="submit" disabled={loadingCredit}
                  style={{ flex: 2, padding: '10px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: loadingCredit ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  {loadingCredit ? 'Yükleniyor...' : 'Kredi Yükle → Aktifleştir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLIENT EDIT MODAL */}
      {editClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setEditClient(null)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '18px' }}>Müşteriyi Düzenle</div>
            <form onSubmit={saveClientEdit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Şirket Adı *</label>
                <input required value={editClientForm.company_name} onChange={e => setEditClientForm({ ...editClientForm, company_name: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Durum</label>
                <select value={editClientForm.status} onChange={e => setEditClientForm({ ...editClientForm, status: e.target.value })}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  {Object.entries(STATUS_MAP).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditClient(null)}
                  style={{ padding: '8px 16px', background: '#f5f4f0', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif', color: '#666' }}>
                  İptal
                </button>
                <button type="submit" disabled={savingClient}
                  style={{ padding: '8px 16px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: savingClient ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  {savingClient ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLIENT DELETE MODAL */}
      {deleteClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setDeleteClient(null)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '12px' }}>Müşteriyi Sil</div>
            <div style={{ fontSize: '13px', color: '#444', marginBottom: deleteHasBriefs ? '10px' : '20px', lineHeight: '1.5' }}>
              <strong>{deleteClient.company_name}</strong> müşterisini silmek istediğinizden emin misiniz?
            </div>
            {deleteHasBriefs && (
              <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '0.5px solid rgba(245,158,11,0.25)', borderRadius: '8px', marginBottom: '20px', fontSize: '12px', color: '#b45309', lineHeight: '1.5' }}>
                Bu müşteriye ait briefler var. Yine de silmek istiyor musunuz?
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteClient(null)}
                style={{ padding: '8px 16px', background: '#f5f4f0', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif', color: '#666' }}>
                İptal
              </button>
              <button onClick={confirmDeleteClient} disabled={deletingClient}
                style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: deletingClient ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                {deletingClient ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
