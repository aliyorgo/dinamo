'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)


const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  demo: { label: 'Demo', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  pending: { label: 'Beklemede', bg: 'rgba(156,163,175,0.1)', color: '#6b7280' },
  active: { label: 'Aktif', bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
  lost: { label: 'Kaybedildi', bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
}

export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = params.id as string

  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<any>(null)
  const [agency, setAgency] = useState<any>(null)
  const [briefs, setBriefs] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])

  const [msg, setMsg] = useState('')
  const [msgColor, setMsgColor] = useState('#22c55e')

  // Logo
  const logoRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // Edit modal
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ company_name: '', contact_email: '', status: '' })
  const [saving, setSaving] = useState(false)

  // Delete modal
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Credit load modal
  const [creditModal, setCreditModal] = useState(false)
  const [creditAmount, setCreditAmount] = useState('')
  const [loadingCredit, setLoadingCredit] = useState(false)

  // Credit sale modal
  const [saleModal, setSaleModal] = useState(false)
  const [packages, setPackages] = useState<any[]>([])
  const [saleForm, setSaleForm] = useState({ package_id: '', credits: '', amount: '', payment_method: 'havale', invoice_number: '', note: '' })
  const [savingSale, setSavingSale] = useState(false)
  const [sales, setSales] = useState<any[]>([])

  // Client users
  const [clientUsers, setClientUsers] = useState<any[]>([])
  const [creditAllocModal, setCreditAllocModal] = useState<any>(null) // { user, direction: 'give' | 'take' }
  const [allocAmount, setAllocAmount] = useState('')
  const [allocSaving, setAllocSaving] = useState(false)

  async function refreshClientUsers() {
    const { data: cu } = await supabase.from('client_users').select('*, users(name, email, role)').eq('client_id', clientId)
    setClientUsers(cu || [])
    return cu || []
  }

  async function openAllocModal(cu: any, direction: 'give' | 'take') {
    const fresh = await refreshClientUsers()
    const freshUser = fresh.find((u: any) => u.id === cu.id)
    if (freshUser) {
      setCreditAllocModal({ user: freshUser, direction })
      setAllocAmount('')
    }
  }

  // AI notes
  const [aiNotes, setAiNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  function showMsg(text: string, isError = false) {
    setMsg(text)
    setMsgColor(isError ? '#ef4444' : '#22c55e')
    setTimeout(() => setMsg(''), 3000)
  }

  useEffect(() => { load() }, [clientId])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: ud } = await supabase.from('users').select('name, role').eq('id', user.id).single()
    if (!ud || ud.role !== 'admin') { router.push('/login'); return }
    setUserName(ud.name)

    const [{ data: cl }, { data: br }, { data: tx }, { data: sl }, { data: pkgs }, { data: cu }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('briefs').select('id, campaign_name, status, credit_cost, created_at').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('credit_transactions').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('credit_sales').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('credit_packages').select('*').order('credits'),
      supabase.from('client_users').select('*, users(name, email, role)').eq('client_id', clientId),
    ])

    if (!cl) { router.push('/dashboard/admin/clients'); return }
    setClient(cl)
    setAiNotes(cl.ai_notes || '')
    setBriefs(br || [])
    setTransactions(tx || [])
    setSales(sl || [])
    setPackages(pkgs || [])
    setClientUsers(cu || [])

    if (cl.agency_id) {
      const { data: ag } = await supabase.from('agencies').select('id, name, logo_url, commission_rate, total_earnings').eq('id', cl.agency_id).single()
      setAgency(ag)
    }

    setLoading(false)
  }

  // -- Status change --
  async function changeStatus(newStatus: string) {
    const { error } = await supabase.from('clients').update({ status: newStatus }).eq('id', clientId)
    if (error) { showMsg(error.message, true); return }
    setClient((prev: any) => ({ ...prev, status: newStatus }))
    showMsg('Durum guncellendi.')
  }

  // -- Logo --
  async function handleLogoUpload() {
    const file = logoRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `client_${clientId}_logo.${ext}`
    const { error: upErr } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true })
    if (upErr) { showMsg(upErr.message, true); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
    const logoUrl = urlData.publicUrl
    await supabase.from('clients').update({ logo_url: logoUrl }).eq('id', clientId)
    setClient((prev: any) => ({ ...prev, logo_url: logoUrl + '?t=' + Date.now() }))
    if (logoRef.current) logoRef.current.value = ''
    showMsg('Logo guncellendi.')
    setUploading(false)
  }

  async function removeLogo() {
    await supabase.from('clients').update({ logo_url: null }).eq('id', clientId)
    setClient((prev: any) => ({ ...prev, logo_url: null }))
    showMsg('Logo kaldirildi.')
  }

  // -- Edit --
  function openEditModal() {
    setEditForm({
      company_name: client?.company_name || '',
      contact_email: client?.contact_email || '',
      status: client?.status || 'pending',
    })
    setEditModal(true)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('clients').update({
      company_name: editForm.company_name,
      contact_email: editForm.contact_email || null,
      status: editForm.status,
    }).eq('id', clientId)
    if (error) { showMsg(error.message, true); setSaving(false); return }
    setClient((prev: any) => ({ ...prev, ...editForm }))
    setEditModal(false)
    setSaving(false)
    showMsg('Musteri guncellendi.')
  }

  // -- Delete --
  async function confirmDelete() {
    setDeleting(true)
    const { error } = await supabase.from('clients').delete().eq('id', clientId)
    if (error) { showMsg(error.message, true); setDeleting(false); return }
    router.push('/dashboard/admin/clients')
  }

  // -- Credit load --
  async function loadCredit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseInt(creditAmount)
    if (!amount || amount <= 0) return
    setLoadingCredit(true)

    const newBalance = Number(client.credit_balance || 0) + amount
    const { error } = await supabase.from('clients').update({ credit_balance: newBalance }).eq('id', clientId)
    if (error) { showMsg(error.message, true); setLoadingCredit(false); return }

    await supabase.from('credit_transactions').insert({
      client_id: clientId,
      amount,
      type: 'top_up',
      description: 'Admin kredi yuklemesi',
    })

    setClient((prev: any) => ({ ...prev, credit_balance: newBalance }))
    setTransactions(prev => [{ id: Date.now(), amount, type: 'top_up', description: 'Admin kredi yuklemesi', created_at: new Date().toISOString() }, ...prev])
    setCreditModal(false)
    setCreditAmount('')
    setLoadingCredit(false)
    showMsg(`${amount} kredi yuklendi.`)
  }

  // -- Credit Sale --
  function openSaleModal() {
    setSaleForm({ package_id: '', credits: '', amount: '', payment_method: 'havale', invoice_number: '', note: '' })
    setSaleModal(true)
  }

  function onPackageSelect(pkgId: string) {
    const pkg = packages.find((p: any) => p.id === pkgId)
    if (pkg) {
      setSaleForm(prev => ({ ...prev, package_id: pkgId, credits: String(pkg.credits), amount: String(pkg.price_tl || 0) }))
    } else {
      setSaleForm(prev => ({ ...prev, package_id: '', credits: '', amount: '' }))
    }
  }

  async function saveSale(e: React.FormEvent) {
    e.preventDefault()
    const credits = parseInt(saleForm.credits)
    const amount = parseFloat(saleForm.amount)
    if (!credits || credits <= 0 || !amount) return
    setSavingSale(true)

    const pricePerCredit = amount / credits
    const platformFeeRate = 0.40
    const platformFee = amount * platformFeeRate
    const netAmount = amount * (1 - platformFeeRate)
    const { error } = await supabase.from('credit_sales').insert({
      client_id: clientId,
      agency_id: client?.agency_id || null,
      package_id: saleForm.package_id || null,
      credits,
      price_per_credit: pricePerCredit,
      total_amount: amount,
      platform_fee_rate: platformFeeRate,
      platform_fee: platformFee,
      net_amount: netAmount,
      note: saleForm.note || null,
      invoice_number: saleForm.invoice_number || null,
      payment_method: saleForm.payment_method,
    })

    if (error) { showMsg(error.message, true); setSavingSale(false); return }

    // Update client credit balance
    const newBalance = Number(client.credit_balance || 0) + credits
    await supabase.from('clients').update({ credit_balance: newBalance }).eq('id', clientId)
    setClient((prev: any) => ({ ...prev, credit_balance: newBalance }))

    // Log transaction
    await supabase.from('credit_transactions').insert({
      client_id: clientId,
      amount: credits,
      type: 'top_up',
      description: `Kredi satisi — ${credits} kredi, ${amount.toLocaleString('tr-TR')} TL`,
    })

    // If agency client, add commission to agency earnings
    if (client?.agency_id && agency) {
      const commissionRate = Number(agency.commission_rate || 0)
      const commission = amount * commissionRate
      if (commission > 0) {
        const newEarnings = Number(agency.total_earnings || 0) + commission
        await supabase.from('agencies').update({ total_earnings: newEarnings }).eq('id', client.agency_id)
        setAgency((prev: any) => ({ ...prev, total_earnings: newEarnings }))
      }
    }

    setSaleModal(false)
    setSavingSale(false)
    showMsg(`${credits} kredi satisi kaydedildi.`)

    // Refresh sales list
    const { data: freshSales } = await supabase.from('credit_sales').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setSales(freshSales || [])
    const { data: freshTx } = await supabase.from('credit_transactions').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setTransactions(freshTx || [])
  }

  // -- Credit Allocation --
  async function allocateCredit(e: React.FormEvent) {
    e.preventDefault()
    if (!creditAllocModal) return
    const amount = parseInt(allocAmount)
    if (!amount || amount <= 0) return
    setAllocSaving(true)

    const cu = creditAllocModal.user
    const isGive = creditAllocModal.direction === 'give'
    const pool = Number(client?.credit_balance || 0)
    const current = Number(cu.allocated_credits || 0)

    if (isGive) {
      if (amount > pool) { showMsg('Havuzda yeterli kredi yok.', true); setAllocSaving(false); return }
      await supabase.from('client_users').update({ allocated_credits: current + amount }).eq('id', cu.id)
      await supabase.from('clients').update({ credit_balance: pool - amount }).eq('id', clientId)
      setClient((prev: any) => ({ ...prev, credit_balance: pool - amount }))
      setClientUsers(prev => prev.map(u => u.id === cu.id ? { ...u, allocated_credits: current + amount } : u))
      showMsg(`${amount} kredi atandi.`)
    } else {
      const takeAmount = Math.min(amount, current)
      if (takeAmount <= 0) { showMsg('Geri alinacak kredi yok.', true); setAllocSaving(false); return }
      await supabase.from('client_users').update({ allocated_credits: current - takeAmount }).eq('id', cu.id)
      await supabase.from('clients').update({ credit_balance: pool + takeAmount }).eq('id', clientId)
      setClient((prev: any) => ({ ...prev, credit_balance: pool + takeAmount }))
      setClientUsers(prev => prev.map(u => u.id === cu.id ? { ...u, allocated_credits: current - takeAmount } : u))
      showMsg(`${takeAmount} kredi geri alindi.`)
    }

    setCreditAllocModal(null)
    setAllocAmount('')
    setAllocSaving(false)
  }

  const totalAllocated = clientUsers.reduce((sum, cu) => sum + Number(cu.allocated_credits || 0), 0)

  // -- AI Notes --
  async function saveAiNotes() {
    setSavingNotes(true)
    await supabase.from('clients').update({ ai_notes: aiNotes || null }).eq('id', clientId)
    setSavingNotes(false)
    showMsg('AI notlari kaydedildi.')
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

  const BRIEF_STATUS: Record<string, { label: string; color: string }> = {
    draft: { label: 'Taslak', color: '#6b7280' },
    submitted: { label: 'Gonderildi', color: '#3b82f6' },
    in_production: { label: 'Uretimde', color: '#f59e0b' },
    delivered: { label: 'Teslim', color: '#22c55e' },
    completed: { label: 'Tamamlandi', color: '#22c55e' },
    cancelled: { label: 'Iptal', color: '#ef4444' },
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
        <div style={{ color: '#888', fontSize: '14px' }}>Yukleniyor...</div>
      </div>
    )
  }

  const st = STATUS_MAP[client?.status] || STATUS_MAP.pending

  return (
    <>
        {/* HEADER */}
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button onClick={() => router.push('/dashboard/admin/clients')}
            style={{ fontSize: '12px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
            &#8592; Musteriler
          </button>
          <span style={{ color: '#ddd' }}>/</span>
          {client?.logo_url && (
            <div style={{ width: '24px', height: '24px', borderRadius: '6px', overflow: 'hidden', background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', flexShrink: 0 }}>
              <img src={client.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }} />
            </div>
          )}
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>{client?.company_name}</div>
          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', fontWeight: '500', background: st.bg, color: st.color }}>{st.label}</span>
          {msg && <div style={{ marginLeft: 'auto', fontSize: '12px', color: msgColor }}>{msg}</div>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>

            {/* LEFT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* LOGO */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>Logo</div>
                <div style={{ width: '100%', height: '120px', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: '10px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf8', overflow: 'hidden' }}>
                  {client?.logo_url ? (
                    <img src={client.logo_url} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '12px' }} />
                  ) : (
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#111113', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '22px', fontWeight: '500', color: '#fff' }}>{client?.company_name?.charAt(0)?.toUpperCase() || 'C'}</span>
                    </div>
                  )}
                </div>
                <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => logoRef.current?.click()} disabled={uploading}
                    style={{ flex: 1, padding: '7px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                    {uploading ? 'Yukleniyor...' : 'Logo Yukle'}
                  </button>
                  {client?.logo_url && (
                    <button onClick={removeLogo}
                      style={{ padding: '7px 12px', background: '#fff', color: '#888', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                      Kaldir
                    </button>
                  )}
                </div>
              </div>

              {/* INFO */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Bilgiler</div>
                {[
                  { label: 'Durum', value: st.label, color: st.color },
                  { label: 'E-posta', value: client?.contact_email || '\u2014' },
                  { label: 'Havuz Kredisi', value: `${client?.credit_balance || 0}`, color: '#22c55e' },
                  { label: 'Atanmis Kredi', value: `${totalAllocated}` },
                  { label: 'Toplam Kredi', value: `${(client?.credit_balance || 0) + totalAllocated}`, color: '#0a0a0a' },
                  { label: 'Ajans', value: agency ? agency.name : 'Direkt musteri' },
                  { label: 'Briefler', value: `${briefs.length}` },
                  { label: 'Olusturulma', value: client?.created_at ? new Date(client.created_at).toLocaleDateString('tr-TR') : '\u2014' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>{row.label}</span>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: row.color || '#0a0a0a' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* STATUS CHANGE */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Durum Degistir</div>
                <select value={client?.status || 'pending'} onChange={e => changeStatus(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  {Object.entries(STATUS_MAP).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>

              {/* ACTIONS */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={openSaleModal}
                  style={{ flex: 1, padding: '10px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  Kredi Satisi
                </button>
                <button onClick={() => { setCreditModal(true); setCreditAmount('') }}
                  style={{ flex: 1, padding: '10px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  Kredi Yukle
                </button>
                <button onClick={openEditModal}
                  style={{ flex: 1, padding: '10px', background: '#fff', color: '#0a0a0a', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  Duzenle
                </button>
                <button onClick={() => setDeleteModal(true)}
                  style={{ padding: '10px 14px', background: '#fff', color: '#ef4444', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  Sil
                </button>
              </div>

              {/* AI NOTES */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                  AI Notlari <span style={{ fontWeight: '400', color: '#bbb', textTransform: 'none' }}>\u2014 fikir/senaryo uretiminde kullanilir</span>
                </div>
                <textarea value={aiNotes} onChange={e => setAiNotes(e.target.value)}
                  placeholder="Musterinin tercihleri, tarzi, hassasiyetleri..."
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '12px', color: '#0a0a0a', resize: 'vertical', fontFamily: 'var(--font-dm-sans),sans-serif', outline: 'none', boxSizing: 'border-box' }} />
                <button onClick={saveAiNotes} disabled={savingNotes}
                  style={{ marginTop: '8px', padding: '7px 16px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '500', cursor: savingNotes ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  {savingNotes ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* BRIEFS */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
                  Briefler ({briefs.length})
                </div>
                {briefs.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>Bu musteriye ait brief yok.</div>
                ) : briefs.map(brief => {
                  const bs = BRIEF_STATUS[brief.status] || { label: brief.status, color: '#888' }
                  return (
                    <div key={brief.id} style={{
                      padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,0.06)',
                      display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
                    }} onClick={() => router.push(`/dashboard/admin/briefs/${brief.id}`)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{brief.campaign_name || 'Isimsiz Brief'}</div>
                        <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                          {brief.credit_cost || 0} kredi
                          {brief.created_at && <span style={{ marginLeft: '10px' }}>{new Date(brief.created_at).toLocaleDateString('tr-TR')}</span>}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '10px', padding: '2px 8px', borderRadius: '100px', fontWeight: '500',
                        background: `${bs.color}15`, color: bs.color,
                      }}>
                        {bs.label}
                      </span>
                      <div style={{ fontSize: '12px', color: '#ccc' }}>&#8250;</div>
                    </div>
                  )
                })}
              </div>

              {/* CLIENT USERS */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>Kullanicilar ({clientUsers.length})</span>
                  <span style={{ fontSize: '11px', color: '#888' }}>Havuz: {client?.credit_balance || 0} kr</span>
                </div>
                {clientUsers.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>Atanmis kullanici yok. Once Musteriler sayfasindan kullanici atayin.</div>
                ) : clientUsers.map((cu: any) => (
                  <div key={cu.id} style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{cu.users?.name || '\u2014'}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{cu.users?.email || '\u2014'}</div>
                    </div>
                    <div style={{ textAlign: 'right', marginRight: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>{cu.allocated_credits || 0}</div>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)' }}>kredi</div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button onClick={() => { openAllocModal(cu, 'give') }}
                        style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '500', border: '1px solid #22c55e', background: 'rgba(34,197,94,0.1)', color: '#22c55e', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                        + Ver
                      </button>
                      <button onClick={() => { openAllocModal(cu, 'take') }}
                        disabled={!cu.allocated_credits}
                        style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '500', border: '1px solid rgba(0,0,0,0.15)', background: '#fff', color: cu.allocated_credits ? '#888' : '#ddd', cursor: cu.allocated_credits ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                        - Geri Al
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* CREDIT TRANSACTIONS */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
                  Kredi Gecmisi ({transactions.length})
                </div>
                {transactions.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>Kredi islemi yok.</div>
                ) : transactions.map(tx => {
                  const isPositive = Number(tx.amount) > 0
                  return (
                    <div key={tx.id} style={{
                      padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,0.06)',
                      display: 'flex', alignItems: 'center', gap: '12px',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', color: '#0a0a0a' }}>{tx.description || tx.type}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>
                          {tx.created_at && new Date(tx.created_at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '10px', padding: '2px 8px', borderRadius: '100px', fontWeight: '500',
                        background: tx.type === 'demo' ? 'rgba(59,130,246,0.1)' : tx.type === 'top_up' ? 'rgba(34,197,94,0.1)' : 'rgba(156,163,175,0.1)',
                        color: tx.type === 'demo' ? '#3b82f6' : tx.type === 'top_up' ? '#22c55e' : '#6b7280',
                      }}>
                        {tx.type === 'demo' ? 'Demo' : tx.type === 'top_up' ? 'Yukleme' : tx.type === 'deduct' ? 'Harcama' : tx.type}
                      </span>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: isPositive ? '#22c55e' : '#ef4444', minWidth: '60px', textAlign: 'right' }}>
                        {isPositive ? '+' : ''}{tx.amount}
                      </div>
                    </div>
                  )
                })}
              {/* CREDIT SALES */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
                  Kredi Satislari ({sales.length})
                </div>
                {sales.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>Kredi satisi yok.</div>
                ) : sales.map((sale: any) => (
                  <div key={sale.id} style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: '#0a0a0a', fontWeight: '500' }}>{sale.credits} kredi</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                        {sale.created_at && new Date(sale.created_at).toLocaleDateString('tr-TR')}
                        {sale.payment_method && <span style={{ marginLeft: '8px' }}>{sale.payment_method === 'havale' ? 'Havale/EFT' : sale.payment_method === 'kredi_karti' ? 'Kredi Karti' : sale.payment_method}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>{Number(sale.total_amount || 0).toLocaleString('tr-TR')} TL</div>
                      {sale.invoice_number && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>{sale.invoice_number}</div>}
                    </div>
                  </div>
                ))}
              </div>

              </div>
            </div>
          </div>
        </div>

      {/* CREDIT ALLOCATION MODAL */}
      {creditAllocModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setCreditAllocModal(null)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '6px' }}>
              {creditAllocModal.direction === 'give' ? 'Kredi Ver' : 'Kredi Geri Al'}
            </div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '20px' }}>
              {creditAllocModal.user.users?.name || '\u2014'}
              {creditAllocModal.direction === 'give'
                ? ` \u00b7 Havuz: ${client?.credit_balance || 0} kr`
                : ` \u00b7 Mevcut: ${creditAllocModal.user.allocated_credits || 0} kr`
              }
            </div>
            <form onSubmit={allocateCredit}>
              <label style={labelStyle}>
                {creditAllocModal.direction === 'give' ? 'Verilecek Kredi' : 'Geri Alinacak Kredi'}
              </label>
              <input required type="number" min="1"
                max={creditAllocModal.direction === 'give' ? (client?.credit_balance || 0) : (creditAllocModal.user.allocated_credits || 0)}
                value={allocAmount} onChange={e => setAllocAmount(e.target.value)}
                style={{ ...inputStyle, marginBottom: '16px', fontSize: '18px', fontWeight: '300', letterSpacing: '-0.5px' }}
                placeholder="0" autoFocus />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setCreditAllocModal(null)}
                  style={{ flex: 1, padding: '10px', background: '#fff', color: '#888', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  Iptal
                </button>
                <button type="submit" disabled={allocSaving}
                  style={{ flex: 2, padding: '10px', background: creditAllocModal.direction === 'give' ? '#22c55e' : '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: allocSaving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  {allocSaving ? 'Isleniyor...' : creditAllocModal.direction === 'give' ? 'Kredi Ver' : 'Geri Al'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SALE MODAL */}
      {saleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setSaleModal(false)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '6px' }}>Kredi Satisi Ekle</div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '20px' }}>{client?.company_name}</div>
            <form onSubmit={saveSale}>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Paket Sec (veya manuel gir)</label>
                <select value={saleForm.package_id} onChange={e => onPackageSelect(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Manuel giris</option>
                  {packages.map((p: any) => <option key={p.id} value={p.id}>{p.name} — {p.credits} kredi — {Number(p.price_tl).toLocaleString('tr-TR')} TL</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={labelStyle}>Kredi Miktari *</label>
                  <input required type="number" min="1" value={saleForm.credits} onChange={e => setSaleForm({ ...saleForm, credits: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Odenen Tutar (TL) *</label>
                  <input required type="number" min="0" step="0.01" value={saleForm.amount} onChange={e => setSaleForm({ ...saleForm, amount: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Odeme Yontemi</label>
                <select value={saleForm.payment_method} onChange={e => setSaleForm({ ...saleForm, payment_method: e.target.value })}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="havale">Havale/EFT</option>
                  <option value="kredi_karti">Kredi Karti</option>
                  <option value="nakit">Nakit</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                <div>
                  <label style={labelStyle}>Fatura No</label>
                  <input value={saleForm.invoice_number} onChange={e => setSaleForm({ ...saleForm, invoice_number: e.target.value })} style={inputStyle} placeholder="Opsiyonel" />
                </div>
                <div>
                  <label style={labelStyle}>Not</label>
                  <input value={saleForm.note} onChange={e => setSaleForm({ ...saleForm, note: e.target.value })} style={inputStyle} placeholder="Opsiyonel" />
                </div>
              </div>
              {client?.agency_id && agency && (
                <div style={{ padding: '8px 12px', background: 'rgba(34,197,94,0.06)', borderRadius: '8px', fontSize: '11px', color: '#166534', marginBottom: '14px' }}>
                  Ajans komisyonu: %{(Number(agency.commission_rate || 0) * 100).toFixed(0)} — {saleForm.amount ? (Number(saleForm.amount) * Number(agency.commission_rate || 0)).toLocaleString('tr-TR') + ' TL' : '—'}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setSaleModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#fff', color: '#888', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  Iptal
                </button>
                <button type="submit" disabled={savingSale}
                  style={{ flex: 2, padding: '10px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: savingSale ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  {savingSale ? 'Kaydediliyor...' : 'Satisi Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setEditModal(false)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '18px' }}>Musteriyi Duzenle</div>
            <form onSubmit={saveEdit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Sirket Adi *</label>
                <input required value={editForm.company_name} onChange={e => setEditForm({ ...editForm, company_name: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Iletisim E-posta</label>
                <input type="email" value={editForm.contact_email} onChange={e => setEditForm({ ...editForm, contact_email: e.target.value })} style={inputStyle} placeholder="ornek@sirket.com" />
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Durum</label>
                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  {Object.entries(STATUS_MAP).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditModal(false)}
                  style={{ padding: '8px 16px', background: '#f5f4f0', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif', color: 'rgba(255,255,255,0.4)' }}>
                  Iptal
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: '8px 16px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setDeleteModal(false)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '12px' }}>Musteriyi Sil</div>
            <div style={{ fontSize: '13px', color: '#444', marginBottom: briefs.length > 0 ? '10px' : '20px', lineHeight: '1.5' }}>
              <strong>{client?.company_name}</strong> musterisini silmek istediginizden emin misiniz?
            </div>
            {briefs.length > 0 && (
              <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '0.5px solid rgba(245,158,11,0.25)', borderRadius: '8px', marginBottom: '20px', fontSize: '12px', color: '#b45309', lineHeight: '1.5' }}>
                Bu musteriye ait {briefs.length} brief var. Yine de silmek istiyor musunuz?
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteModal(false)}
                style={{ padding: '8px 16px', background: '#f5f4f0', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif', color: 'rgba(255,255,255,0.4)' }}>
                Iptal
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                {deleting ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREDIT LOAD MODAL */}
      {creditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setCreditModal(false)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '6px' }}>Kredi Yukle</div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '20px' }}>
              {client?.company_name} \u00b7 Mevcut: {client?.credit_balance || 0} kredi
            </div>
            <form onSubmit={loadCredit}>
              <label style={labelStyle}>Yuklenecek Kredi</label>
              <input required type="number" min="1" value={creditAmount} onChange={e => setCreditAmount(e.target.value)}
                style={{ ...inputStyle, marginBottom: '16px', fontSize: '18px', fontWeight: '300', letterSpacing: '-0.5px' }}
                placeholder="0" autoFocus />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setCreditModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#fff', color: '#888', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  Iptal
                </button>
                <button type="submit" disabled={loadingCredit}
                  style={{ flex: 2, padding: '10px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: loadingCredit ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  {loadingCredit ? 'Yukleniyor...' : 'Kredi Yukle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
