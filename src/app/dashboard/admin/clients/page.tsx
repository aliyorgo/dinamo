'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const NAV = [
  { label: 'Genel Bakis', href: '/dashboard/admin' },
  { label: 'Kullanicilar', href: '/dashboard/admin/users' },
  { label: 'Musteriler', href: '/dashboard/admin/clients' },
  { label: 'Briefler', href: '/dashboard/admin/briefs' },
  { label: "Creator'lar", href: '/dashboard/admin/creators' },
  { label: 'Krediler', href: '/dashboard/admin/credits' },
  { label: 'Raporlar', href: '/dashboard/admin/reports' },
  { label: 'Faturalar', href: '/dashboard/admin/invoices' },
  { label: 'Ajanslar', href: '/dashboard/admin/agencies' },
  { label: 'Ana Sayfa', href: '/dashboard/admin/homepage' },
  { label: 'Ayarlar', href: '/dashboard/admin/settings' },
]

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  demo: { label: 'Demo', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  pending: { label: 'Beklemede', bg: 'rgba(156,163,175,0.1)', color: '#6b7280' },
  active: { label: 'Aktif', bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
  lost: { label: 'Kaybedildi', bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
}

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [agencies, setAgencies] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ company_name: '', credit_balance: 0, agency_id: '' })
  const [userForm, setUserForm] = useState({ client_id: '', user_id: '', credit_balance: 0 })
  const [creating, setCreating] = useState(false)
  const [aiNotes, setAiNotes] = useState<Record<string,string>>({})
  const [aiNoteSaving, setAiNoteSaving] = useState<string|null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: c }, { data: u }, { data: ag }] = await Promise.all([
      supabase.from('clients').select('*, client_users(count)').order('created_at', { ascending: false }),
      supabase.from('users').select('id, name, email').eq('role', 'client'),
      supabase.from('agencies').select('id, name, logo_url').order('name'),
    ])
    setClients(c || [])
    setUsers(u || [])
    setAgencies(ag || [])
    const notes: Record<string,string> = {}
    c?.forEach((cl: any) => { if (cl.ai_notes) notes[cl.id] = cl.ai_notes })
    setAiNotes(notes)
    setLoading(false)
  }

  async function saveAiNote(clientId: string) {
    setAiNoteSaving(clientId)
    await supabase.from('clients').update({ ai_notes: aiNotes[clientId] || null }).eq('id', clientId)
    setAiNoteSaving(null)
    setMsg('AI notu kaydedildi.')
    setTimeout(() => setMsg(''), 2000)
  }

  async function createClient(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setMsg('')
    const isAgency = form.agency_id !== ''

    const dupRes = await fetch('/api/check-client-duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name: form.company_name, agency_id: isAgency ? form.agency_id : null }),
    })
    const dupData = await dupRes.json()
    if (!dupData.ok) { setMsg(dupData.message); setCreating(false); return }

    const insertData: any = {
      company_name: form.company_name,
      agency_id: isAgency ? form.agency_id : null,
      credit_balance: isAgency ? 30 : form.credit_balance,
      status: isAgency ? 'demo' : 'active',
    }
    const { data: newClient, error } = await supabase.from('clients').insert(insertData).select().single()
    if (error) { setMsg(error.message); setCreating(false); return }
    if (isAgency && newClient) {
      await supabase.from('credit_transactions').insert({
        client_id: newClient.id,
        amount: 30,
        type: 'demo',
        description: 'Admin demo kredisi',
      })
    }
    setMsg('Musteri olusturuldu.')
    setForm({ company_name: '', credit_balance: 0, agency_id: '' })
    loadData()
    setCreating(false)
  }

  async function addUserToClient(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setMsg('')
    const { error } = await supabase.from('client_users').insert(userForm)
    if (error) { setMsg(error.message); setCreating(false); return }
    setMsg('Kullanici musteriye eklendi.')
    setUserForm({ client_id: '', user_id: '', credit_balance: 0 })
    loadData()
    setCreating(false)
  }

  function toggleGroup(groupId: string) {
    setCollapsed(prev => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const directClients = clients.filter(c => !c.agency_id)
  const agencyGroups = agencies
    .map(ag => ({ ...ag, clients: clients.filter(c => c.agency_id === ag.id) }))
    .filter(ag => ag.clients.length > 0)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '0.5px solid rgba(0,0,0,0.15)',
    borderRadius: '8px', fontSize: '13px', color: '#0a0a0a',
    fontFamily: 'Inter,sans-serif', outline: 'none', boxSizing: 'border-box', background: '#fff',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  }

  function ClientRow({ client }: { client: any }) {
    const st = STATUS_MAP[client.status] || STATUS_MAP.pending
    return (
      <div style={{ padding: '14px 20px', borderTop: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{client.company_name}</span>
            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', fontWeight: '500', background: st.bg, color: st.color }}>
              {st.label}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>
            {client.credit_balance || 0} kredi
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <textarea value={aiNotes[client.id]||''} onChange={e=>setAiNotes(prev=>({...prev,[client.id]:e.target.value}))}
            placeholder="AI notlari..." rows={1}
            style={{ width: '180px', padding: '6px 8px', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '6px', fontSize: '11px', color: '#0a0a0a', resize: 'none', fontFamily: 'Inter,sans-serif', outline: 'none' }} />
          <button onClick={()=>saveAiNote(client.id)} disabled={aiNoteSaving===client.id}
            style={{ padding: '6px 10px', background: '#111113', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '10px', cursor: 'pointer', fontFamily: 'Inter,sans-serif', flexShrink: 0 }}>
            {aiNoteSaving===client.id?'...':'Kaydet'}
          </button>
          <button onClick={()=>router.push(`/dashboard/admin/clients/${client.id}`)}
            style={{ padding: '6px 14px', borderRadius: '100px', fontSize: '10px', fontWeight: '500', cursor: 'pointer', border: '0.5px solid rgba(0,0,0,0.15)', background: '#fff', color: '#555', fontFamily: 'Inter,sans-serif', flexShrink: 0 }}>
            Detay
          </button>
        </div>
      </div>
    )
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
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');`}</style>

      {/* SIDEBAR */}
      <div style={{ width: '220px', background: '#111113', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#fff', letterSpacing: '-0.5px', marginBottom: '12px' }}>
            dinam<span style={{ display: 'inline-block', width: '11px', height: '11px', borderRadius: '50%', border: '2.5px solid #22c55e', position: 'relative', top: '1px' }}></span>
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '3px' }}>Admin</div>
        </div>
        <nav style={{ padding: '10px 8px', flex: 1 }}>
          {NAV.map(item => (
            <div key={item.href} onClick={() => router.push(item.href)}
              style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: item.href === '/dashboard/admin/clients' ? 'rgba(255,255,255,0.08)' : 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '12px', color: item.href === '/dashboard/admin/clients' ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: item.href === '/dashboard/admin/clients' ? '500' : '400' }}>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} style={{ padding: '6px 8px', borderRadius: '7px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter,sans-serif' }}>Cikis yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Musteriler ({clients.length})</div>
          {msg && <div style={{ fontSize: '12px', color: msg.includes('Hata') || msg.includes('error') ? '#ef4444' : '#22c55e' }}>{msg}</div>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

          {/* FORMS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            {/* NEW CLIENT */}
            <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>Yeni Musteri</div>
              <form onSubmit={createClient}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Hesap Tipi</label>
                  <select value={form.agency_id} onChange={e=>setForm({...form, agency_id: e.target.value})} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">DINAMO</option>
                    {agencies.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Sirket Adi *</label>
                  <input required value={form.company_name} onChange={e=>setForm({...form,company_name:e.target.value})} style={inputStyle} placeholder="Sirket adi" />
                </div>
                {!form.agency_id && (
                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Baslangic Kredisi</label>
                    <input type="number" value={form.credit_balance} onChange={e=>setForm({...form,credit_balance:parseInt(e.target.value)||0})} style={inputStyle} />
                  </div>
                )}
                {form.agency_id && (
                  <div style={{ marginBottom: '14px', padding: '8px 12px', background: 'rgba(245,158,11,0.06)', borderRadius: '8px', fontSize: '11px', color: '#b45309' }}>
                    30 demo kredi otomatik yuklenecek, status: Demo
                  </div>
                )}
                <button type="submit" disabled={creating}
                  style={{ width: '100%', padding: '9px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif' }}>
                  {creating ? 'Olusturuluyor...' : 'Musteri Olustur'}
                </button>
              </form>
            </div>

            {/* ASSIGN USER */}
            <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>Kullanici Ata</div>
              <form onSubmit={addUserToClient}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Musteri</label>
                  <select value={userForm.client_id} onChange={e=>setUserForm({...userForm,client_id:e.target.value})} required style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">Secin</option>
                    {clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Kullanici</label>
                  <select value={userForm.user_id} onChange={e=>setUserForm({...userForm,user_id:e.target.value})} required style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">Secin</option>
                    {users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Kredi</label>
                  <input type="number" value={userForm.credit_balance} onChange={e=>setUserForm({...userForm,credit_balance:parseInt(e.target.value)||0})} style={inputStyle} />
                </div>
                <button type="submit" disabled={creating}
                  style={{ width: '100%', padding: '9px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif' }}>
                  {creating ? 'Ekleniyor...' : 'Kullanici Ata'}
                </button>
              </form>
            </div>
          </div>

          {/* DIRECT CLIENTS */}
          <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
            <div onClick={() => toggleGroup('direct')}
              style={{ padding: '14px 20px', borderBottom: collapsed['direct'] ? 'none' : '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ fontSize: '12px', color: '#aaa', transition: 'transform 0.2s', transform: collapsed['direct'] ? 'rotate(-90deg)' : 'rotate(0deg)' }}>&#9660;</span>
              <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: '#111113', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: '600', color: '#fff' }}>D</span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a', letterSpacing: '0.5px' }}>DINAMO</span>
              <span style={{ fontSize: '11px', color: '#888' }}>({directClients.length})</span>
            </div>
            {!collapsed['direct'] && (
              directClients.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#aaa', fontSize: '12px' }}>Dogrudan musteri yok.</div>
              ) : directClients.map(client => (
                <ClientRow key={client.id} client={client} />
              ))
            )}
          </div>

          {/* AGENCY GROUPS */}
          {agencyGroups.map(ag => (
            <div key={ag.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
              <div onClick={() => toggleGroup(ag.id)}
                style={{ padding: '14px 20px', borderBottom: collapsed[ag.id] ? 'none' : '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                <span style={{ fontSize: '12px', color: '#aaa', transition: 'transform 0.2s', transform: collapsed[ag.id] ? 'rotate(-90deg)' : 'rotate(0deg)' }}>&#9660;</span>
                {ag.logo_url ? (
                  <div style={{ width: '22px', height: '22px', borderRadius: '5px', overflow: 'hidden', background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', flexShrink: 0 }}>
                    <img src={ag.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }} />
                  </div>
                ) : (
                  <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: '#111113', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '10px', fontWeight: '500', color: '#fff' }}>{ag.name?.charAt(0)?.toUpperCase()}</span>
                  </div>
                )}
                <span style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>{ag.name}</span>
                <span style={{ fontSize: '11px', color: '#888' }}>({ag.clients.length})</span>
                <button onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/admin/agencies/${ag.id}`) }}
                  style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: '100px', fontSize: '10px', border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff', color: '#888', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                  Ajans Detay
                </button>
              </div>
              {!collapsed[ag.id] && (
                ag.clients.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#aaa', fontSize: '12px' }}>Musteri yok.</div>
                ) : ag.clients.map((client: any) => (
                  <div key={client.id} style={{ paddingLeft: '12px' }}>
                    <ClientRow client={client} />
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
