'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

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

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: c }, { data: u }, { data: ag }] = await Promise.all([
      supabase.from('clients').select('*, client_users(count)').order('company_name', { ascending: true }),
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
    const { data: existing } = await supabase.from('client_users').select('id').eq('client_id', userForm.client_id).eq('user_id', userForm.user_id).maybeSingle()
    if (existing) { setMsg('Bu kullanici zaten bu musteriye atanmis.'); setCreating(false); return }
    const { error } = await supabase.from('client_users').insert(userForm)
    if (error) { setMsg(error.message); setCreating(false); return }
    setMsg('Kullanici musteriye eklendi.')
    setUserForm({ client_id: '', user_id: '', credit_balance: 0 })
    loadData()
    setCreating(false)
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
            style={{ width: '180px', padding: '6px 8px', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '6px', fontSize: '11px', color: '#0a0a0a', resize: 'none', fontFamily: 'var(--font-dm-sans),sans-serif', outline: 'none' }} />
          <button onClick={()=>saveAiNote(client.id)} disabled={aiNoteSaving===client.id}
            style={{ padding: '6px 10px', background: '#111113', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '10px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif', flexShrink: 0 }}>
            {aiNoteSaving===client.id?'...':'Kaydet'}
          </button>
          <button onClick={()=>router.push(`/dashboard/admin/clients/${client.id}`)}
            style={{ padding: '6px 14px', borderRadius: '100px', fontSize: '10px', fontWeight: '500', cursor: 'pointer', border: '0.5px solid rgba(0,0,0,0.15)', background: '#fff', color: '#555', fontFamily: 'var(--font-dm-sans),sans-serif', flexShrink: 0 }}>
            Detay
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
        <div style={{ color: '#888', fontSize: '14px' }}>Yukleniyor...</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
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
                  style={{ width: '100%', padding: '9px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
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
                  style={{ width: '100%', padding: '9px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                  {creating ? 'Ekleniyor...' : 'Kullanici Ata'}
                </button>
              </form>
            </div>
          </div>

          {/* CLIENT LIST */}
          <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
              Müşteriler ({clients.length})
            </div>
            {clients.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#aaa', fontSize: '12px' }}>Henüz müşteri yok.</div>
            ) : clients.map(client => (
              <ClientRow key={client.id} client={client} />
            ))}
          </div>
        </div>
    </div>
  )
}
