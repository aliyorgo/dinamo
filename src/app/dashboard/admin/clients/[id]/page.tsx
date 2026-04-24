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
  // Brand
  const [brand, setBrand] = useState({ primary_color:'', secondary_color:'', forbidden_colors:'', tone:'', avoid:'', notes:'' })
  const [savingBrand, setSavingBrand] = useState(false)
  const [brandLogoUrl, setBrandLogoUrl] = useState('')
  const [brandFontUrl, setBrandFontUrl] = useState('')
  const [brandLogoPosition, setBrandLogoPosition] = useState('bottom')
  const [logoUploading, setLogoUploading] = useState(false)
  const [fontUploading, setFontUploading] = useState(false)
  const brandLogoRef = useRef<HTMLInputElement>(null)
  const brandFontRef = useRef<HTMLInputElement>(null)

  // Brand learning
  const [learningCandidates, setLearningCandidates] = useState<any[]>([])
  const [brandRules, setBrandRules] = useState<any[]>([])
  const [seedImporting, setSeedImporting] = useState(false)
  const [newRule, setNewRule] = useState({ text: '', condition: '', type: 'rule' })
  const [rulesTab, setRulesTab] = useState<'pending'|'active'|'add'>('pending')
  const [aiNotesInput, setAiNotesInput] = useState('')

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
    setBrand({ primary_color: cl.brand_primary_color||'', secondary_color: cl.brand_secondary_color||'', forbidden_colors: cl.brand_forbidden_colors||'', tone: cl.brand_tone||'', avoid: cl.brand_avoid||'', notes: cl.brand_notes||'' })
    setBrandLogoUrl(cl.brand_logo_url || '')
    setBrandFontUrl(cl.brand_font_url || '')
    setBrandLogoPosition(cl.brand_logo_position || 'bottom')
    setBriefs(br || [])
    setTransactions(tx || [])
    setSales(sl || [])
    setPackages(pkgs || [])
    setClientUsers(cu || [])

    if (cl.agency_id) {
      const { data: ag } = await supabase.from('agencies').select('id, name, logo_url, commission_rate, total_earnings').eq('id', cl.agency_id).single()
      setAgency(ag)
    }

    // Brand learning
    const { data: blc, error: blcErr } = await supabase.from('brand_learning_candidates').select('*').eq('client_id', clientId).eq('status', 'pending').order('created_at', { ascending: false })
    if (blcErr) console.error('[admin] brand_learning_candidates error:', blcErr.message)
    console.log('[admin] Learning candidates loaded:', blc?.length || 0)
    setLearningCandidates(blc || [])
    const { data: br2 } = await supabase.from('brand_rules').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setBrandRules(br2 || [])

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

  async function saveBrand() {
    setSavingBrand(true)
    await supabase.from('clients').update({
      brand_primary_color: brand.primary_color || null,
      brand_secondary_color: brand.secondary_color || null,
      brand_logo_position: brandLogoPosition,
    }).eq('id', clientId)
    setSavingBrand(false)
    showMsg('Marka bilgileri kaydedildi.')
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0',  }}>
        <div style={{ color: '#888', fontSize: '14px' }}>Yukleniyor...</div>
      </div>
    )
  }

  const st = STATUS_MAP[client?.status] || STATUS_MAP.pending

  return (
    <>
        {/* HEADER */}
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '1px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button onClick={() => router.push('/dashboard/admin/clients')} className="btn-ghost"
            style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '4px 8px' }}>
            ← MÜŞTERİLER
          </button>
          <span style={{ color: 'var(--color-border-tertiary)' }}>/</span>
          {client?.logo_url && (
            <div style={{ width: '24px', height: '24px', overflow: 'hidden', background: '#fff', border: '1px solid var(--color-border-tertiary)', flexShrink: 0 }}>
              <img src={client.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }} />
            </div>
          )}
          <div style={{ fontSize: '18px', fontWeight: '500', color: 'var(--color-text-primary)' }}>{client?.company_name}</div>
          <span style={{ fontSize: '10px', padding: '3px 8px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', background: st.bg, color: st.color }}>{st.label}</span>
          {msg && <div style={{ marginLeft: 'auto', fontSize: '12px', color: msgColor }}>{msg}</div>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>

            {/* LEFT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* LOGO */}
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '14px' }}>Logo</div>
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
                    style={{ flex: 1, padding: '7px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: uploading ? 'not-allowed' : 'pointer',  }}>
                    {uploading ? 'Yukleniyor...' : 'Logo Yukle'}
                  </button>
                  {client?.logo_url && (
                    <button onClick={removeLogo}
                      style={{ padding: '7px 12px', background: '#fff', color: '#888', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',  }}>
                      Kaldir
                    </button>
                  )}
                </div>
              </div>

              {/* INFO */}
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '12px' }}>Bilgiler</div>
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
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '12px' }}>Durum Degistir</div>
                <select value={client?.status || 'pending'} onChange={e => changeStatus(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  {Object.entries(STATUS_MAP).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>

              {/* ACTIONS */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={openSaleModal} className="btn btn-accent" style={{ flex: 1, padding: '10px' }}>
                  KREDİ SATIŞI
                </button>
                <button onClick={() => { setCreditModal(true); setCreditAmount('') }} className="btn" style={{ flex: 1, padding: '10px' }}>
                  KREDİ YÜKLE
                </button>
                <button onClick={openEditModal} className="btn btn-outline" style={{ flex: 1, padding: '10px' }}>
                  DÜZENLE
                </button>
                <button onClick={() => setDeleteModal(true)}
                  style={{ padding: '10px 14px', background: '#fff', color: '#ef4444', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer',  }}>
                  Sil
                </button>
              </div>

              {/* AI NOTES */}
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '10px' }}>
                  AI Notlari <span style={{ fontWeight: '400', color: '#bbb', textTransform: 'none' }}>\u2014 fikir/senaryo uretiminde kullanilir</span>
                </div>
                <textarea value={aiNotes} onChange={e => setAiNotes(e.target.value)}
                  placeholder="Musterinin tercihleri, tarzi, hassasiyetleri..."
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border-tertiary)', borderRadius: '8px', fontSize: '12px', color: '#0a0a0a', resize: 'vertical',  outline: 'none', boxSizing: 'border-box' }} />
                <button onClick={saveAiNotes} disabled={savingNotes}
                  style={{ marginTop: '8px', padding: '7px 16px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '500', cursor: savingNotes ? 'not-allowed' : 'pointer',  }}>
                  {savingNotes ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>

              {/* BRAND ASSETS */}
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '14px' }}>
                  Marka Varlıkları
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '10px 12px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>AI Express</div>
                    <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{client?.ai_video_enabled ? 'Müşteri AI video üretebilir' : 'Devre dışı'}</div>
                  </div>
                  <button onClick={async () => {
                    const newVal = !client?.ai_video_enabled
                    await supabase.from('clients').update({ ai_video_enabled: newVal }).eq('id', clientId)
                    setClient((prev: any) => ({ ...prev, ai_video_enabled: newVal }))
                    showMsg(newVal ? 'AI Video açıldı' : 'AI Video kapatıldı')
                  }}
                    style={{ width: '44px', height: '24px', borderRadius: '100px', border: 'none', cursor: 'pointer', background: client?.ai_video_enabled ? '#1db81d' : '#ddd', position: 'relative', transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', top: '3px', left: client?.ai_video_enabled ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }}></span>
                  </button>
                </div>
                {/* Brand Logo */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Marka Logosu (Transparan PNG)</div>
                  {brandLogoUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '80px', height: '40px', background: '#fff', border: '1px solid var(--color-border-tertiary)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                        <img src={brandLogoUrl} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      </div>
                      <button onClick={async () => { await supabase.from('clients').update({ brand_logo_url: null }).eq('id', clientId); setBrandLogoUrl(''); showMsg('Logo kaldırıldı.') }}
                        style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer',  }}>Kaldır</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input ref={brandLogoRef} type="file" accept=".png" onChange={async () => {
                        const file = brandLogoRef.current?.files?.[0]
                        if (!file) return
                        if (file.size > 2 * 1024 * 1024) { alert('Max 2MB'); return }
                        setLogoUploading(true)
                        const path = `brand-logos/${clientId}_${Date.now()}.png`
                        const { error: upErr } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true })
                        if (upErr) { showMsg(upErr.message, true); setLogoUploading(false); return }
                        const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
                        await supabase.from('clients').update({ brand_logo_url: urlData.publicUrl }).eq('id', clientId)
                        setBrandLogoUrl(urlData.publicUrl)
                        setLogoUploading(false)
                        showMsg('Logo yüklendi.')
                      }} style={{ fontSize: '11px' }} disabled={logoUploading} />
                      {logoUploading && <span style={{ fontSize: '11px', color: '#888' }}>Yükleniyor...</span>}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="color" value={brand.primary_color || '#000000'} onChange={e => setBrand({ ...brand, primary_color: e.target.value })}
                      style={{ width: '32px', height: '32px', border: '1px solid #0a0a0a', cursor: 'pointer', padding: 0 }} />
                    <span style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '500', color: 'var(--color-text-secondary)' }}>PRIMARY</span>
                    <input value={brand.primary_color} onChange={e => setBrand({ ...brand, primary_color: e.target.value })} placeholder="#000000"
                      style={{ width: '80px', padding: '4px 8px', border: '1px solid var(--color-border-tertiary)', fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="color" value={brand.secondary_color || '#000000'} onChange={e => setBrand({ ...brand, secondary_color: e.target.value })}
                      style={{ width: '32px', height: '32px', border: '1px solid #0a0a0a', cursor: 'pointer', padding: 0 }} />
                    <span style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '500', color: 'var(--color-text-secondary)' }}>SECONDARY</span>
                    <input value={brand.secondary_color} onChange={e => setBrand({ ...brand, secondary_color: e.target.value })} placeholder="#000000"
                      style={{ width: '80px', padding: '4px 8px', border: '1px solid var(--color-border-tertiary)', fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }} />
                  </div>
                </div>
                {/* Logo pozisyonu */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Logo Pozisyonu (Statik Görsel Yan Panel)</div>
                  <select value={brandLogoPosition} onChange={e => setBrandLogoPosition(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--color-border-tertiary)', borderRadius: '8px', fontSize: '12px', color: '#0a0a0a',  }}>
                    <option value="top">Üst</option>
                    <option value="middle">Orta</option>
                    <option value="bottom">Alt</option>
                  </select>
                </div>

                {/* Marka fontu */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Marka Fontu (TTF/OTF)</div>
                  {brandFontUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f5f4f0', borderRadius: '8px', padding: '10px 14px' }}>
                      <span style={{ fontSize: '12px', color: '#0a0a0a', flex: 1 }}>Font yüklendi</span>
                      <button onClick={async () => { await supabase.from('clients').update({ brand_font_url: null }).eq('id', clientId); setBrandFontUrl(''); showMsg('Font kaldırıldı.') }}
                        style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer',  }}>Kaldır</button>
                    </div>
                  ) : (
                    <div>
                      <input ref={brandFontRef} type="file" accept=".ttf,.otf" onChange={async () => {
                        const file = brandFontRef.current?.files?.[0]
                        if (!file) return
                        if (file.size > 5 * 1024 * 1024) { showMsg('Font 5MB\'dan küçük olmalı', true); return }
                        setFontUploading(true)
                        const ext = file.name.split('.').pop()?.toLowerCase() || 'ttf'
                        const storagePath = `brand-fonts/${clientId}_${Date.now()}.${ext}`
                        const { error: upErr } = await supabase.storage.from('brand-assets').upload(storagePath, file, { upsert: true })
                        if (upErr) { showMsg('Yükleme hatası: ' + upErr.message, true); setFontUploading(false); return }
                        const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(storagePath)
                        await supabase.from('clients').update({ brand_font_url: urlData.publicUrl }).eq('id', clientId)
                        setBrandFontUrl(urlData.publicUrl)
                        setFontUploading(false)
                        showMsg('Font yüklendi.')
                      }} style={{ fontSize: '11px' }} disabled={fontUploading} />
                      {fontUploading && <span style={{ fontSize: '11px', color: '#888', marginLeft: '8px' }}>Yükleniyor...</span>}
                    </div>
                  )}
                </div>

                <button onClick={saveBrand} disabled={savingBrand}
                  style={{ padding: '7px 16px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '500', cursor: savingBrand ? 'not-allowed' : 'pointer',  }}>
                  {savingBrand ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>

            {/* AI NOTES + RULES SYSTEM */}
            <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px' }}>
              {/* AI Notes Bucket */}
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '8px' }}>AI Notları Kovası</div>
              <textarea value={aiNotesInput} onChange={e => setAiNotesInput(e.target.value)} rows={4} placeholder="Marka hakkında bilgi, wiki, analiz, sektör notu, serbest metin yapıştırın..."
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border-tertiary)', borderRadius: '8px', fontSize: '12px', color: '#0a0a0a', resize: 'vertical',  boxSizing: 'border-box', marginBottom: '8px' }} />
              <button disabled={seedImporting || aiNotesInput.trim().length < 20} onClick={async () => {
                  setSeedImporting(true)
                  const seedText = aiNotesInput.trim()
                  if (seedText.length > 20) {
                    const resp = await fetch('/api/brand-learning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, sourceType: 'admin_notes', sourceId: clientId, text: seedText }) })
                    const respData = await resp.json()
                    console.log('[admin] Seed import response:', respData)
                    // Refetch immediately — API awaits extraction now
                    const { data, error: refetchErr } = await supabase.from('brand_learning_candidates').select('*').eq('client_id', clientId).eq('status', 'pending').order('created_at', { ascending: false })
                    if (refetchErr) console.error('[admin] Refetch error:', refetchErr.message)
                    console.log('[admin] Refetched candidates:', data?.length || 0)
                    setLearningCandidates(data || [])
                    setSeedImporting(false)
                    setAiNotesInput('')
                    setRulesTab('pending')
                    showMsg('Kurallar çıkarıldı.')
                  } else { setSeedImporting(false); showMsg('Metin yetersiz (20+ karakter gerekli).', true) }
                }}
                  style={{ padding: '7px 16px', background: seedImporting || aiNotesInput.trim().length < 20 ? '#ccc' : '#111113', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '500', cursor: 'pointer',  }}>
                  {seedImporting ? 'Çıkarılıyor...' : 'Kural Çıkar'}
                </button>

              {/* 3-TAB RULES */}
              <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--color-border-tertiary)', marginTop: '20px', marginBottom: '14px' }}>
                {([['pending', `Onay Bekleyen (${learningCandidates.length})`], ['active', `Aktif (${brandRules.length})`], ['add', 'Manuel Ekle']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setRulesTab(key as any)}
                    style={{ padding: '8px 14px', fontSize: '11px', fontWeight: rulesTab === key ? '600' : '400', color: rulesTab === key ? '#0a0a0a' : '#888', background: 'none', border: 'none', borderBottom: rulesTab === key ? '2px solid #1DB81D' : '2px solid transparent', cursor: 'pointer',  }}>
                    {label}
                  </button>
                ))}
              </div>

              {rulesTab === 'pending' && (
                learningCandidates.length === 0 ? <div style={{ fontSize: '12px', color: '#aaa', textAlign: 'center', padding: '16px 0' }}>Onay bekleyen kural yok</div> :
                learningCandidates.map((c: any) => {
                  const typeColors: Record<string,{bg:string,fg:string,label:string}> = { rule:{bg:'rgba(34,197,94,0.1)',fg:'#22c55e',label:'Kural'}, restriction:{bg:'rgba(239,68,68,0.1)',fg:'#ef4444',label:'Yasak'}, insight:{bg:'rgba(139,92,246,0.1)',fg:'#8b5cf6',label:'İçgörü'} }
                  const tc = typeColors[c.type] || typeColors.rule
                  return (
                    <div key={c.id} style={{ padding: '10px 0', borderTop: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a', marginBottom: '4px' }}>{c.rule_text}</div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '3px', background: tc.bg, color: tc.fg }}>{tc.label}</span>
                          <span style={{ fontSize: '9px', color: '#aaa' }}>{['brief','revision','feedback'].includes(c.source_type) ? 'Müşteriden' : 'Notlardan'}</span>
                        </div>
                        {c.rule_condition && <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', marginTop: '2px' }}>{c.rule_condition}</div>}
                      </div>
                      <button onClick={async () => {
                        const { error: upErr } = await supabase.from('brand_learning_candidates').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', c.id)
                        if (upErr) { console.error('[approve] candidate update error:', upErr.message); showMsg('Hata: ' + upErr.message, true); return }
                        const { error: insErr } = await supabase.from('brand_rules').insert({ client_id: clientId, rule_text: c.rule_text, rule_condition: c.rule_condition || null, type: c.type || 'rule', rule_type: c.rule_type || 'positive', source_candidate_id: c.id, source_type: c.source_type || 'learned', manually_added: false })
                        if (insErr) { console.error('[approve] brand_rules insert error:', insErr.message); showMsg('Hata: ' + insErr.message, true); return }
                        setLearningCandidates(prev => prev.filter(x => x.id !== c.id))
                        const { data: r } = await supabase.from('brand_rules').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
                        setBrandRules(r || [])
                        showMsg('Kural onaylandı.')
                      }} style={{ fontSize: '11px', color: '#22c55e', background: 'none', border: '0.5px solid rgba(34,197,94,0.3)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',  }}>✓</button>
                      <button onClick={async () => {
                        await supabase.from('brand_learning_candidates').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', c.id)
                        setLearningCandidates(prev => prev.filter(x => x.id !== c.id))
                        showMsg('Reddedildi.')
                      }} style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',  }}>✗</button>
                    </div>
                  )
                })
              )}

              {rulesTab === 'active' && (
                brandRules.length === 0 ? <div style={{ fontSize: '12px', color: '#aaa', textAlign: 'center', padding: '16px 0' }}>Henüz aktif kural yok</div> :
                brandRules.map((r: any) => {
                  const typeColors: Record<string,{bg:string,fg:string,label:string}> = { rule:{bg:'rgba(34,197,94,0.1)',fg:'#22c55e',label:'Kural'}, restriction:{bg:'rgba(239,68,68,0.1)',fg:'#ef4444',label:'Yasak'}, insight:{bg:'rgba(139,92,246,0.1)',fg:'#8b5cf6',label:'İçgörü'} }
                  const tc = typeColors[r.type] || typeColors.rule
                  const srcLabel = r.manually_added ? 'Manuel' : r.source_type === 'migrated' ? 'Migrate' : ['brief','revision','feedback'].includes(r.source_type) ? 'Müşteriden' : 'Notlardan'
                  return (
                    <div key={r.id} style={{ padding: '8px 0', borderTop: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a', marginBottom: '3px' }}>{r.rule_text}</div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '3px', background: tc.bg, color: tc.fg }}>{tc.label}</span>
                          {r.rule_condition && <span style={{ fontSize: '9px', color: '#888', fontStyle: 'italic' }}>{r.rule_condition}</span>}
                          <span style={{ fontSize: '9px', color: '#aaa' }}>{srcLabel}</span>
                        </div>
                      </div>
                      <button onClick={async () => {
                        await supabase.from('brand_rules').delete().eq('id', r.id)
                        setBrandRules(prev => prev.filter(x => x.id !== r.id))
                        showMsg('Kural silindi.')
                      }} style={{ fontSize: '10px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer',  }}>Sil</button>
                    </div>
                  )
                })
              )}

              {rulesTab === 'add' && (
                <div style={{ padding: '8px 0' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Tip</div>
                    <select value={newRule.type} onChange={e => setNewRule({ ...newRule, type: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--color-border-tertiary)', borderRadius: '6px', fontSize: '12px',  }}>
                      <option value="rule">Kural (pozitif talimat)</option>
                      <option value="restriction">Yasak</option>
                      <option value="insight">İçgörü (yaratıcı yönlendirme)</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Metin *</div>
                    <input value={newRule.text} onChange={e => setNewRule({ ...newRule, text: e.target.value })} placeholder="Erkek model kullanılmasın"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--color-border-tertiary)', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Koşul (opsiyonel)</div>
                    <input value={newRule.condition} onChange={e => setNewRule({ ...newRule, condition: e.target.value })} placeholder="Eğer ürün bikini/mayo ise"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--color-border-tertiary)', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' }} />
                  </div>
                  <button disabled={!newRule.text} onClick={async () => {
                    await supabase.from('brand_rules').insert({ client_id: clientId, rule_text: newRule.text, rule_condition: newRule.condition || null, type: newRule.type, rule_type: newRule.type === 'restriction' ? 'negative' : 'positive', manually_added: true, source_type: 'manual' })
                    const { data: r } = await supabase.from('brand_rules').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
                    setBrandRules(r || [])
                    setNewRule({ text: '', condition: '', type: 'rule' })
                    setRulesTab('active')
                    showMsg('Kural eklendi.')
                  }} style={{ padding: '7px 16px', background: !newRule.text ? '#ccc' : '#111113', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '500', cursor: 'pointer',  }}>
                    Kaydet
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* BRIEFS */}
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border-tertiary)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
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
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                        style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '500', border: '1px solid #22c55e', background: 'rgba(34,197,94,0.1)', color: '#22c55e', cursor: 'pointer',  }}>
                        + Ver
                      </button>
                      <button onClick={() => { openAllocModal(cu, 'take') }}
                        disabled={!cu.allocated_credits}
                        style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '500', border: '1px solid rgba(0,0,0,0.15)', background: '#fff', color: cu.allocated_credits ? '#888' : '#ddd', cursor: cu.allocated_credits ? 'pointer' : 'not-allowed',  }}>
                        - Geri Al
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* CREDIT TRANSACTIONS */}
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border-tertiary)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
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
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border-tertiary)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
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
                  style={{ flex: 1, padding: '10px', background: '#fff', color: '#888', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',  }}>
                  Iptal
                </button>
                <button type="submit" disabled={allocSaving}
                  style={{ flex: 2, padding: '10px', background: creditAllocModal.direction === 'give' ? '#22c55e' : '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: allocSaving ? 'not-allowed' : 'pointer',  }}>
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
                  style={{ flex: 1, padding: '10px', background: '#fff', color: '#888', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',  }}>
                  Iptal
                </button>
                <button type="submit" disabled={savingSale}
                  style={{ flex: 2, padding: '10px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: savingSale ? 'not-allowed' : 'pointer',  }}>
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
                  style={{ padding: '8px 16px', background: '#f5f4f0', border: '1px solid var(--color-border-tertiary)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',  color: 'rgba(255,255,255,0.4)' }}>
                  Iptal
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: '8px 16px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer',  }}>
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
                style={{ padding: '8px 16px', background: '#f5f4f0', border: '1px solid var(--color-border-tertiary)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',  color: 'rgba(255,255,255,0.4)' }}>
                Iptal
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: deleting ? 'not-allowed' : 'pointer',  }}>
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
                  style={{ flex: 1, padding: '10px', background: '#fff', color: '#888', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',  }}>
                  Iptal
                </button>
                <button type="submit" disabled={loadingCredit}
                  style={{ flex: 2, padding: '10px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: loadingCredit ? 'not-allowed' : 'pointer',  }}>
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
