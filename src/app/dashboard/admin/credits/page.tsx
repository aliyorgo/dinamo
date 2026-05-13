'use client'
import { useState, useEffect } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

const supabase = getSupabaseBrowser()


export default function CreditsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  // Data
  const [clients, setClients] = useState<any[]>([])
  const [agencies, setAgencies] = useState<any[]>([])
  const [packages, setPackages] = useState<any[]>([])

  // Selected client
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [clientUsers, setClientUsers] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])

  // Search
  const [search, setSearch] = useState('')

  // Create client form
  const [showCreateClient, setShowCreateClient] = useState(false)
  const [newClient, setNewClient] = useState({ company_name: '', contact_email: '', agency_id: '' })
  const [creating, setCreating] = useState(false)

  // Credit load form
  const [showCreditLoad, setShowCreditLoad] = useState(false)
  const [creditForm, setCreditForm] = useState({ package_id: '', credits: '', amount: '', payment_method: 'havale', invoice_number: '', note: '' })
  const [creditLoading, setCreditLoading] = useState(false)

  // Add user form
  const [showAddUser, setShowAddUser] = useState(false)
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '' })
  const [existingUserId, setExistingUserId] = useState('')
  const [existingUsers, setExistingUsers] = useState<any[]>([])
  const [addingUser, setAddingUser] = useState(false)

  // Alloc modal
  const [allocUser, setAllocUser] = useState<any>(null)
  const [allocDir, setAllocDir] = useState<'give' | 'take'>('give')
  const [allocAmount, setAllocAmount] = useState('')

  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    if (!user) { router.push('/login'); return }
    const { data: ud } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (!ud || ud.role !== 'admin') { router.push('/login'); return }

    const [{ data: c }, { data: ag }, { data: pk }] = await Promise.all([
      supabase.from('clients').select('*, client_users(count)').order('company_name'),
      supabase.from('agencies').select('id, name').order('name'),
      supabase.from('credit_packages').select('*').order('credits'),
    ])
    setClients(c || [])
    setAgencies(ag || [])
    setPackages(pk || [])
    setLoading(false)
  }

  async function loadClientDetail(clientId: string) {
    const [{ data: cu }, { data: sl }, { data: tx }] = await Promise.all([
      supabase.from('client_users').select('*, users(name, email)').eq('client_id', clientId),
      supabase.from('credit_sales').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20),
      supabase.from('credit_transactions').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(30),
    ])
    setClientUsers(cu || [])
    setSales(sl || [])
    setHistory(tx || [])
  }

  function selectClient(id: string) {
    setSelectedId(id)
    setShowCreditLoad(false)
    setShowAddUser(false)
    loadClientDetail(id)
  }

  const selected = clients.find(c => c.id === selectedId)
  const filtered = clients.filter(c => c.company_name?.toLowerCase().includes(search.toLowerCase()))

  function showMessage(text: string) { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  // ── CREATE CLIENT ───
  async function createClientFn(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const { data: nc, error } = await supabase.from('clients').insert({
      company_name: newClient.company_name,
      contact_email: newClient.contact_email || null,
      agency_id: newClient.agency_id || null,
      status: 'active',
      credit_balance: 0,
    }).select().single()
    setCreating(false)
    if (error) { showMessage('Hata: ' + error.message); return }
    setNewClient({ company_name: '', contact_email: '', agency_id: '' })
    setShowCreateClient(false)
    const { data: c } = await supabase.from('clients').select('*, client_users(count)').order('company_name')
    setClients(c || [])
    if (nc) selectClient(nc.id)
    showMessage('Müşteri oluşturuldu.')
  }

  // ── CREDIT LOAD ───
  function onPackageSelect(pkgId: string) {
    const pkg = packages.find(p => p.id === pkgId)
    if (pkg) setCreditForm(prev => ({ ...prev, package_id: pkgId, credits: String(pkg.credits), amount: String(pkg.price_tl || 0) }))
    else setCreditForm(prev => ({ ...prev, package_id: '', credits: '', amount: '' }))
  }

  async function loadCreditFn(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    const credits = parseInt(creditForm.credits)
    const amount = parseFloat(creditForm.amount)
    if (!credits || credits <= 0) return
    setCreditLoading(true)

    const ppc = amount > 0 ? amount / credits : 0
    await supabase.from('credit_sales').insert({
      client_id: selectedId,
      agency_id: selected?.agency_id || null,
      package_id: creditForm.package_id || null,
      credits,
      price_per_credit: ppc,
      total_amount: amount || 0,
      platform_fee_rate: 0.40,
      platform_fee: (amount || 0) * 0.40,
      net_amount: (amount || 0) * 0.60,
      payment_method: creditForm.payment_method,
      invoice_number: creditForm.invoice_number || null,
      note: creditForm.note || null,
    })

    const newBal = Number(selected?.credit_balance || 0) + credits
    await supabase.from('clients').update({ credit_balance: newBal }).eq('id', selectedId)
    await supabase.from('credit_transactions').insert({
      client_id: selectedId, amount: credits, type: 'top_up',
      description: `${credits} kredi yüklendi${creditForm.invoice_number ? ' — ' + creditForm.invoice_number : ''}`,
    })

    setClients(prev => prev.map(c => c.id === selectedId ? { ...c, credit_balance: newBal } : c))
    setCreditForm({ package_id: '', credits: '', amount: '', payment_method: 'havale', invoice_number: '', note: '' })
    setShowCreditLoad(false)
    setCreditLoading(false)
    loadClientDetail(selectedId)
    showMessage(`${credits} kredi yüklendi.`)
  }

  // ── ADD USER ───
  async function addUserFn(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    setAddingUser(true)

    if (existingUserId) {
      const { data: exists } = await supabase.from('client_users').select('id').eq('client_id', selectedId).eq('user_id', existingUserId).maybeSingle()
      if (exists) { showMessage('Bu kullanıcı zaten atanmış.'); setAddingUser(false); return }
      await supabase.from('client_users').insert({ client_id: selectedId, user_id: existingUserId, credit_balance: 0 })
    } else {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userForm.name, email: userForm.email, password: userForm.password, role: 'client' }),
      })
      const data = await res.json()
      if (data.error) { showMessage(data.error); setAddingUser(false); return }
      // Find the new user
      const { data: nu } = await supabase.from('users').select('id').eq('email', userForm.email).single()
      if (nu) await supabase.from('client_users').insert({ client_id: selectedId, user_id: nu.id, credit_balance: 0 })
    }

    setAddingUser(false)
    setShowAddUser(false)
    setUserForm({ name: '', email: '', password: '' })
    setExistingUserId('')
    loadClientDetail(selectedId)
    const { data: c } = await supabase.from('clients').select('*, client_users(count)').order('company_name')
    setClients(c || [])
    showMessage('Kullanıcı eklendi.')
  }

  // ── ALLOCATE ───
  async function allocateFn() {
    if (!allocUser || !selectedId) return
    const amt = parseInt(allocAmount)
    if (!amt || amt <= 0) return
    const pool = Number(selected?.credit_balance || 0)
    const current = Number(allocUser.allocated_credits || 0)

    if (allocDir === 'give') {
      if (amt > pool) { showMessage('Havuzda yeterli kredi yok.'); return }
      await supabase.from('client_users').update({ allocated_credits: current + amt }).eq('id', allocUser.id)
      await supabase.from('clients').update({ credit_balance: pool - amt }).eq('id', selectedId)
      setClients(prev => prev.map(c => c.id === selectedId ? { ...c, credit_balance: pool - amt } : c))
      await supabase.from('credit_transactions').insert({ client_id: selectedId, amount: -amt, type: 'allocate', description: `${allocUser.users?.name || 'Kullanıcı'}'ya ${amt} kredi atandı` })
    } else {
      const take = Math.min(amt, current)
      if (take <= 0) return
      await supabase.from('client_users').update({ allocated_credits: current - take }).eq('id', allocUser.id)
      await supabase.from('clients').update({ credit_balance: pool + take }).eq('id', selectedId)
      setClients(prev => prev.map(c => c.id === selectedId ? { ...c, credit_balance: pool + take } : c))
      await supabase.from('credit_transactions').insert({ client_id: selectedId, amount: take, type: 'deallocate', description: `${allocUser.users?.name || 'Kullanıcı'}'dan ${take} kredi geri alındı` })
    }

    setAllocUser(null)
    setAllocAmount('')
    loadClientDetail(selectedId)
    showMessage(allocDir === 'give' ? 'Kredi atandı.' : 'Kredi geri alındı.')
  }

  // ── REMOVE USER ───
  async function removeUser(cuId: string) {
    if (!selectedId) return
    const cu = clientUsers.find(u => u.id === cuId)
    if (cu && Number(cu.allocated_credits) > 0) {
      const pool = Number(selected?.credit_balance || 0) + Number(cu.allocated_credits)
      await supabase.from('clients').update({ credit_balance: pool }).eq('id', selectedId)
      setClients(prev => prev.map(c => c.id === selectedId ? { ...c, credit_balance: pool } : c))
    }
    await supabase.from('client_users').delete().eq('id', cuId)
    loadClientDetail(selectedId)
    const { data: c } = await supabase.from('clients').select('*, client_users(count)').order('company_name')
    setClients(c || [])
    showMessage('Kullanıcı ayrıldı.')
  }

  // ── SEARCH EXISTING USERS ───
  async function searchUsers(q: string) {
    if (q.length < 2) { setExistingUsers([]); return }
    const { data } = await supabase.from('users').select('id, name, email').eq('role', 'client').ilike('email', `%${q}%`).limit(5)
    setExistingUsers(data || [])
  }


  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '1px solid #E8E8E4', fontSize: '13px', color: '#0a0a0a',
     outline: 'none', boxSizing: 'border-box', background: '#fff',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px',
  }
  const btnPrimary: React.CSSProperties = {
    padding: '8px 16px', background: '#0a0a0a', color: '#fff', border: 'none', fontSize: '12px', fontWeight: '500', cursor: 'pointer', 
  }
  const btnSecondary: React.CSSProperties = {
    padding: '8px 16px', background: '#fff', color: '#555', border: '1px solid #E8E8E4', fontSize: '12px', cursor: 'pointer', 
  }

  const totalLoaded = sales.reduce((s, sl) => s + Number(sl.credits || 0), 0)
  const totalAllocated = clientUsers.reduce((s, cu) => s + Number(cu.allocated_credits || 0), 0)

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0' }}><div style={{ color: '#888', fontSize: '14px' }}>Yükleniyor...</div></div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* LEFT — Client List */}
      <div style={{ width: '280px', background: '#fff', borderRight: '1px solid #E8E8E4', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #E8E8E4' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a' }}>Müşteriler</span>
            <button onClick={() => setShowCreateClient(!showCreateClient)} style={{ ...btnPrimary, padding: '5px 12px', fontSize: '11px' }}>+ Yeni</button>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Müşteri ara..." style={{ ...inputStyle, fontSize: '12px' }} />
        </div>

        {showCreateClient && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8E8E4', background: '#FAFAF8' }}>
            <form onSubmit={createClientFn}>
              <div style={{ marginBottom: '8px' }}><label style={labelStyle}>Şirket Adı *</label><input required value={newClient.company_name} onChange={e => setNewClient({ ...newClient, company_name: e.target.value })} style={inputStyle} /></div>
              <div style={{ marginBottom: '8px' }}><label style={labelStyle}>Email</label><input type="email" value={newClient.contact_email} onChange={e => setNewClient({ ...newClient, contact_email: e.target.value })} style={inputStyle} /></div>
              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Ajans</label>
                <select value={newClient.agency_id} onChange={e => setNewClient({ ...newClient, agency_id: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Yok</option>
                  {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <button type="submit" disabled={creating} style={btnPrimary}>{creating ? '...' : 'Oluştur'}</button>
            </form>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#aaa', fontSize: '12px' }}>Henüz müşteri yok.</div>
          ) : filtered.map(c => (
            <div key={c.id} onClick={() => selectClient(c.id)}
              style={{ padding: '12px 16px', borderBottom: '1px solid #F0F0EE', cursor: 'pointer', borderLeft: selectedId === c.id ? '3px solid #1DB81D' : '3px solid transparent', background: selectedId === c.id ? '#F8FFF8' : 'transparent', transition: 'all 0.1s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{c.company_name}</span>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#1DB81D' }}>{c.credit_balance || 0}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{c.client_users?.[0]?.count || 0} kullanıcı</div>
            </div>
          ))}
        </div>
        {msg && <div style={{ padding: '10px 16px', background: '#F0F7F0', fontSize: '12px', color: '#166534', borderTop: '1px solid #E8E8E4' }}>{msg}</div>}
      </div>

      {/* RIGHT — Client Detail */}
      <div style={{ flex: 1, background: '#f5f4f0', overflowY: 'auto' }}>
        {!selectedId ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>Soldan bir müşteri seçin</div>
              <div style={{ fontSize: '12px' }}>veya yeni müşteri oluşturun</div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '28px' }}>

            {/* SECTION 1 — CREDIT POOL */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#0a0a0a', margin: 0 }}>{selected?.company_name}</h2>
                  <button onClick={() => router.push(`/dashboard/admin/clients/${selectedId}`)}
                    className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '10px', letterSpacing: '1.5px' }}>MARKA STÜDYOSU →</button>
                </div>
                <button onClick={() => setShowCreditLoad(!showCreditLoad)} style={{ ...btnPrimary, background: '#1DB81D', color: '#0a0a0a', fontWeight: '600' }}>Kredi Yükle</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: 'Toplam Yüklenen', value: totalLoaded, color: '#0a0a0a' },
                  { label: 'Atanan', value: totalAllocated, color: '#3b82f6' },
                  { label: 'Havuzda Kalan', value: selected?.credit_balance || 0, color: '#1DB81D' },
                ].map(c => (
                  <div key={c.label} style={{ background: '#fff', border: '1px solid #E8E8E4', padding: '16px' }}>
                    <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{c.label}</div>
                    <div style={{ fontSize: '28px', fontWeight: '700', color: c.color, letterSpacing: '-1px' }}>{c.value}</div>
                  </div>
                ))}
              </div>

              {/* Credit load inline form */}
              {showCreditLoad && (
                <div style={{ background: '#fff', border: '1px solid #E8E8E4', padding: '20px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '14px' }}>Kredi Yükle</div>
                  <form onSubmit={loadCreditFn}>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={labelStyle}>Paket Seç</label>
                      <select value={creditForm.package_id} onChange={e => onPackageSelect(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                        <option value="">Manuel giriş</option>
                        {packages.map(p => <option key={p.id} value={p.id}>{p.name} — {p.credits} kr — {Number(p.price_tl).toLocaleString('tr-TR')} TL</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div><label style={labelStyle}>Kredi *</label><input required type="number" min="1" value={creditForm.credits} onChange={e => setCreditForm({ ...creditForm, credits: e.target.value })} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Tutar (TL)</label><input type="number" min="0" step="0.01" value={creditForm.amount} onChange={e => setCreditForm({ ...creditForm, amount: e.target.value })} style={inputStyle} /></div>
                      <div>
                        <label style={labelStyle}>Ödeme</label>
                        <select value={creditForm.payment_method} onChange={e => setCreditForm({ ...creditForm, payment_method: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                          <option value="havale">Havale/EFT</option><option value="kredi_karti">Kredi Kartı</option><option value="nakit">Nakit</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                      <div><label style={labelStyle}>Fatura No</label><input value={creditForm.invoice_number} onChange={e => setCreditForm({ ...creditForm, invoice_number: e.target.value })} style={inputStyle} placeholder="Opsiyonel" /></div>
                      <div><label style={labelStyle}>Not</label><input value={creditForm.note} onChange={e => setCreditForm({ ...creditForm, note: e.target.value })} style={inputStyle} placeholder="Opsiyonel" /></div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="submit" disabled={creditLoading} style={btnPrimary}>{creditLoading ? 'Yükleniyor...' : 'Yükle'}</button>
                      <button type="button" onClick={() => setShowCreditLoad(false)} style={btnSecondary}>İptal</button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* SECTION 2 — USERS */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a' }}>Kullanıcılar</span>
                  <span style={{ fontSize: '10px', fontWeight: '600', color: '#1DB81D', background: 'rgba(29,184,29,0.1)', padding: '2px 8px' }}>{clientUsers.length}</span>
                </div>
                <button onClick={() => { setShowAddUser(!showAddUser); setExistingUserId(''); setExistingUsers([]) }} style={{ ...btnPrimary, padding: '5px 12px', fontSize: '11px' }}>+ Kullanıcı Ekle</button>
              </div>

              {/* Add user inline form */}
              {showAddUser && (
                <div style={{ background: '#fff', border: '1px solid #E8E8E4', padding: '16px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '10px' }}>Var olan kullanıcı ata veya yeni oluştur</div>
                  <form onSubmit={addUserFn}>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={labelStyle}>Email ile Ara (var olan)</label>
                      <input value={existingUserId ? '' : undefined} onChange={e => { searchUsers(e.target.value); setExistingUserId('') }} placeholder="email@..." style={inputStyle} />
                      {existingUsers.length > 0 && (
                        <div style={{ border: '1px solid #E8E8E4', marginTop: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                          {existingUsers.map(u => (
                            <div key={u.id} onClick={() => { setExistingUserId(u.id); setExistingUsers([]) }}
                              style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #F0F0EE' }}>
                              {u.name} — {u.email}
                            </div>
                          ))}
                        </div>
                      )}
                      {existingUserId && <div style={{ fontSize: '11px', color: '#1DB81D', marginTop: '4px' }}>Kullanıcı seçildi</div>}
                    </div>
                    {!existingUserId && (
                      <>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginBottom: '8px' }}>veya yeni oluştur:</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                          <div><label style={labelStyle}>Ad Soyad</label><input value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} style={inputStyle} /></div>
                          <div><label style={labelStyle}>Email</label><input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} style={inputStyle} /></div>
                          <div><label style={labelStyle}>Şifre</label><input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} style={inputStyle} /></div>
                        </div>
                      </>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="submit" disabled={addingUser} style={btnPrimary}>{addingUser ? '...' : existingUserId ? 'Ata' : 'Oluştur + Ata'}</button>
                      <button type="button" onClick={() => setShowAddUser(false)} style={btnSecondary}>İptal</button>
                    </div>
                  </form>
                </div>
              )}

              {/* User list */}
              <div style={{ background: '#fff', border: '1px solid #E8E8E4' }}>
                {clientUsers.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>Atanmış kullanıcı yok.</div>
                ) : clientUsers.map((cu, i) => (
                  <div key={cu.id} style={{ padding: '12px 16px', borderTop: i > 0 ? '1px solid #F0F0EE' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', background: '#E8E8E4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>{cu.users?.name?.charAt(0)?.toUpperCase() || '?'}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{cu.users?.name || '—'}</div>
                      <div style={{ fontSize: '11px', color: '#888' }}>{cu.users?.email || '—'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button onClick={() => { setAllocUser(cu); setAllocDir('take'); setAllocAmount('') }} disabled={!cu.allocated_credits}
                        style={{ width: '24px', height: '24px', background: '#fff', border: '1px solid #E8E8E4', cursor: cu.allocated_credits ? 'pointer' : 'not-allowed', fontSize: '14px', color: cu.allocated_credits ? '#555' : '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a', minWidth: '28px', textAlign: 'center' }}>{cu.allocated_credits || 0}</span>
                      <button onClick={() => { setAllocUser(cu); setAllocDir('give'); setAllocAmount('') }} disabled={!selected?.credit_balance}
                        style={{ width: '24px', height: '24px', background: '#fff', border: '1px solid #E8E8E4', cursor: selected?.credit_balance ? 'pointer' : 'not-allowed', fontSize: '14px', color: selected?.credit_balance ? '#1DB81D' : '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                    <button onClick={() => removeUser(cu.id)} style={{ fontSize: '10px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Ayır</button>
                  </div>
                ))}
              </div>

              {/* Alloc inline */}
              {allocUser && (
                <div style={{ background: '#fff', border: '1px solid #E8E8E4', padding: '14px 16px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#555' }}>{allocUser.users?.name}: {allocDir === 'give' ? 'Kredi ver' : 'Kredi geri al'}</span>
                  <input type="number" min="1" max={allocDir === 'give' ? (selected?.credit_balance || 0) : (allocUser.allocated_credits || 0)} value={allocAmount} onChange={e => setAllocAmount(e.target.value)}
                    style={{ ...inputStyle, width: '80px' }} placeholder="0" />
                  <button onClick={allocateFn} style={btnPrimary}>Onayla</button>
                  <button onClick={() => setAllocUser(null)} style={btnSecondary}>İptal</button>
                </div>
              )}
            </div>

            {/* SECTION 3 — HISTORY */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a', marginBottom: '12px' }}>Geçmiş</div>
              <div style={{ background: '#fff', border: '1px solid #E8E8E4' }}>
                {history.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>İşlem yok.</div>
                ) : history.map((tx, i) => {
                  const dotColor = tx.type === 'top_up' || tx.type === 'demo' ? '#1DB81D' : tx.type === 'allocate' ? '#3b82f6' : tx.type === 'deallocate' ? '#f59e0b' : '#888'
                  return (
                    <div key={tx.id} style={{ padding: '10px 16px', borderTop: i > 0 ? '1px solid #F0F0EE' : 'none', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ width: '8px', height: '8px', background: dotColor, marginTop: '5px', flexShrink: 0 }}></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: '#0a0a0a' }}>{tx.description || tx.type}</div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>{tx.created_at ? new Date(tx.created_at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: Number(tx.amount) > 0 ? '#1DB81D' : '#ef4444' }}>{Number(tx.amount) > 0 ? '+' : ''}{tx.amount}</span>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
