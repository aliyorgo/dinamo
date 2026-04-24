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
  { label: 'Uyeler', href: '/dashboard/agency/members' },
  { label: 'Uretim Raporu', href: '/dashboard/agency/production' },
  { label: 'Kazanclar', href: '/dashboard/agency/earnings' },
]

export default function AgencyClientsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [agency, setAgency] = useState<any>(null)
  const [clients, setClients] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  // Add client form
  const [form, setForm] = useState({ company_name: '', contact_email: '', contact_phone: '' })
  const [adding, setAdding] = useState(false)

  // Edit modal
  const [editClient, setEditClient] = useState<any>(null)
  const [editForm, setEditForm] = useState({ company_name: '', contact_email: '' })
  const [saving, setSaving] = useState(false)

  // Delete modal
  const [deleteClient, setDeleteClient] = useState<any>(null)
  const [deleteHasBriefs, setDeleteHasBriefs] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: ud } = await supabase.from('users').select('name, role, agency_id').eq('id', user.id).single()
    if (!ud || ud.role !== 'agency' || !ud.agency_id) { router.push('/login'); return }

    setUserName(ud.name)

    const [{ data: ag }, { data: cls }, { data: allBriefs }] = await Promise.all([
      supabase.from('agencies').select('id, name, logo_url, commission_rate, demo_credits, total_earnings').eq('id', ud.agency_id).single(),
      supabase.from('clients').select('*').eq('agency_id', ud.agency_id).order('created_at', { ascending: false }),
      supabase.from('briefs').select('id, client_id, status, credit_cost, sale_price, created_at').eq('agency_id', ud.agency_id),
    ])

    setAgency(ag)
    // Enrich clients with brief stats
    const briefsByClient: Record<string, any[]> = {}
    ;(allBriefs || []).forEach((b: any) => {
      if (b.client_id) {
        if (!briefsByClient[b.client_id]) briefsByClient[b.client_id] = []
        briefsByClient[b.client_id].push(b)
      }
    })
    const enriched = (cls || []).map((c: any) => {
      const cb = briefsByClient[c.id] || []
      const approved = cb.filter((b: any) => b.status === 'approved' || b.status === 'delivered' || b.status === 'completed')
      const lastBrief = cb.length > 0 ? cb.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] : null
      return { ...c, _briefCount: cb.length, _approvedCount: approved.length, _lastActivity: lastBrief?.created_at || null }
    })
    setClients(enriched)
    setLoading(false)
  }

  const DEMO_CREDITS = 30

  async function addClient(e: React.FormEvent) {
    e.preventDefault()
    if (!agency) return
    setAdding(true)

    const dupRes = await fetch('/api/check-client-duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name: form.company_name, agency_id: agency.id }),
    })
    const dupData = await dupRes.json()
    if (!dupData.ok) { setMsg(dupData.message); setAdding(false); return }

    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        company_name: form.company_name,
        agency_id: agency.id,
        status: 'demo',
        credit_balance: DEMO_CREDITS,
      })
      .select()
      .single()

    if (error || !newClient) { setMsg('Hata: ' + (error?.message || 'Bilinmeyen hata')); setAdding(false); return }

    // Log demo credit transaction
    await supabase.from('credit_transactions').insert({
      client_id: newClient.id,
      amount: DEMO_CREDITS,
      type: 'demo',
      description: 'Ajans demo kredisi — otomatik yüklendi',
    })

    setMsg(`Müşteri eklendi, ${DEMO_CREDITS} demo kredi yüklendi.`)
    setForm({ company_name: '', contact_email: '', contact_phone: '' })
    const { data: cls } = await supabase.from('clients').select('*').eq('agency_id', agency.id).order('created_at', { ascending: false })
    setClients(cls || [])
    setAdding(false)
    setTimeout(() => setMsg(''), 4000)
  }

  async function openEditModal(client: any) {
    setEditForm({ company_name: client.company_name || '', contact_email: client.contact_email || '' })
    setEditClient(client)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editClient) return
    setSaving(true)
    const { error } = await supabase.from('clients').update({
      company_name: editForm.company_name,
      contact_email: editForm.contact_email || null,
    }).eq('id', editClient.id)
    if (error) { setMsg('Hata: ' + error.message); setSaving(false); return }
    setMsg('Müşteri güncellendi.')
    setEditClient(null)
    setSaving(false)
    const { data: cls } = await supabase.from('clients').select('*').eq('agency_id', agency.id).order('created_at', { ascending: false })
    setClients(cls || [])
    setTimeout(() => setMsg(''), 4000)
  }

  async function openDeleteModal(client: any) {
    const { count } = await supabase.from('briefs').select('id', { count: 'exact', head: true }).eq('client_id', client.id)
    setDeleteHasBriefs((count || 0) > 0)
    setDeleteClient(client)
  }

  async function confirmDelete() {
    if (!deleteClient) return
    setDeleting(true)
    const { error } = await supabase.from('clients').delete().eq('id', deleteClient.id)
    if (error) { setMsg('Hata: ' + error.message); setDeleting(false); return }
    setMsg('Müşteri silindi.')
    setDeleteClient(null)
    setDeleting(false)
    const { data: cls } = await supabase.from('clients').select('*').eq('agency_id', agency.id).order('created_at', { ascending: false })
    setClients(cls || [])
    setTimeout(() => setMsg(''), 4000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
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

  const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
    demo: { label: 'Demo', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
    pending: { label: 'Beklemede', bg: 'rgba(156,163,175,0.1)', color: '#6b7280' },
    active: { label: 'Aktif', bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
    lost: { label: 'Kaybedildi', bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
  }

  const activeClients = clients.filter(c => c.status === 'active')
  const pendingClients = clients.filter(c => c.status !== 'active')

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
              style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: item.href === '/dashboard/agency/clients' ? 'rgba(255,255,255,0.08)' : 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '12px', color: item.href === '/dashboard/agency/clients' ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: item.href === '/dashboard/agency/clients' ? '500' : '400' }}>{item.label}</span>
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Müşteriler</div>
          {msg && <div style={{ fontSize: '12px', color: '#22c55e' }}>{msg}</div>}
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#888', fontSize: '14px' }}>Yükleniyor...</div>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

            {/* STATS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'Toplam Müşteri', value: String(clients.length) },
                { label: 'Aktif', value: String(activeClients.length), color: '#22c55e' },
                { label: 'Kredi Bekliyor', value: String(pendingClients.length), color: pendingClients.length > 0 ? '#f59e0b' : '#888' },
              ].map(c => (
                <div key={c.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{c.label}</div>
                  <div style={{ fontSize: '28px', fontWeight: '300', color: c.color || '#0a0a0a', letterSpacing: '-1px' }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* ADD CLIENT FORM */}
            <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>Yeni Müşteri Ekle</div>
              <form onSubmit={addClient} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: 2 }}>
                  <label style={labelStyle}>Şirket Adı *</label>
                  <input required value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} style={inputStyle} placeholder="Şirket adı" />
                </div>
                <button type="submit" disabled={adding}
                  style={{ padding: '8px 20px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: adding ? 'not-allowed' : 'pointer',  flexShrink: 0, height: '38px' }}>
                  {adding ? 'Ekleniyor...' : 'Ekle'}
                </button>
              </form>
              <div style={{ marginTop: '10px', fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
                Eklenen her müşteriye otomatik olarak {DEMO_CREDITS} demo kredi yüklenir.
              </div>
            </div>

            {/* CLIENTS LIST */}
            <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
                Müşteri Listesi ({clients.length})
              </div>
              {clients.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>Henüz müşteri eklenmemiş.</div>
              ) : clients.map((client, i) => {
                const st = STATUS_MAP[client.status] || STATUS_MAP.pending
                return (
                <div key={client.id} style={{
                  padding: '14px 20px', borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : 'none',
                  display: 'flex', alignItems: 'center', gap: '14px',
                  cursor: 'pointer',
                }}
                  onClick={() => router.push(`/dashboard/agency/clients/${client.id}`)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{client.company_name}</span>
                      <span style={{
                        fontSize: '10px', padding: '2px 8px', borderRadius: '100px', fontWeight: '500',
                        background: st.bg, color: st.color,
                      }}>
                        {st.label}
                      </span>
                      {Number(client.credit_balance) === 0 && (
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', fontWeight: '500', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                          Kredi bitti
                        </span>
                      )}
                      {Number(client.credit_balance) > 0 && Number(client.credit_balance) < 10 && (
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', fontWeight: '500', background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                          Kredi azalıyor
                        </span>
                      )}
                    </div>
                    {client._lastActivity && (
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '3px' }}>
                        Son aktivite: {new Date(client._lastActivity).toLocaleDateString('tr-TR')}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>Kredi</div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: Number(client.credit_balance) === 0 ? '#ef4444' : Number(client.credit_balance) < 10 ? '#f59e0b' : '#0a0a0a' }}>{client.credit_balance || 0}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>İş</div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{client._approvedCount || 0}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEditModal(client)} title="Düzenle"
                      style={{ width: '30px', height: '30px', borderRadius: '7px', border: '0.5px solid rgba(0,0,0,0.1)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
                      ✎
                    </button>
                    <button onClick={() => openDeleteModal(client)} title="Sil"
                      style={{ width: '30px', height: '30px', borderRadius: '7px', border: '0.5px solid rgba(0,0,0,0.1)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#ef4444' }}>
                      🗑
                    </button>
                  </div>
                  <div style={{ fontSize: '12px', color: '#ccc' }}>›</div>
                </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setEditClient(null)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '400px', maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '18px' }}>Müşteriyi Düzenle</div>
            <form onSubmit={saveEdit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Şirket Adı *</label>
                <input required value={editForm.company_name} onChange={e => setEditForm({ ...editForm, company_name: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>İletişim E-posta</label>
                <input type="email" value={editForm.contact_email} onChange={e => setEditForm({ ...editForm, contact_email: e.target.value })} style={inputStyle} placeholder="ornek@sirket.com" />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditClient(null)}
                  style={{ padding: '8px 16px', background: '#f5f4f0', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',  color: 'rgba(255,255,255,0.4)' }}>
                  İptal
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

      {/* DELETE CONFIRM MODAL */}
      {deleteClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDeleteClient(null)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '400px', maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '12px' }}>Müşteriyi Sil</div>
            {deleteHasBriefs ? (
              <>
                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '0.5px solid rgba(239,68,68,0.2)', borderRadius: '8px', marginBottom: '20px', fontSize: '12px', color: '#b91c1c', lineHeight: '1.5' }}>
                  Bu müşteriye ait briefler olduğu için silinemez. Silme işlemi için admin ile iletişime geçin.
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setDeleteClient(null)}
                    style={{ padding: '8px 16px', background: '#f5f4f0', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',  color: 'rgba(255,255,255,0.4)' }}>
                    Kapat
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '13px', color: '#444', marginBottom: '20px', lineHeight: '1.5' }}>
                  <strong>{deleteClient.company_name}</strong> müşterisini silmek istediğinizden emin misiniz?
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setDeleteClient(null)}
                    style={{ padding: '8px 16px', background: '#f5f4f0', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',  color: 'rgba(255,255,255,0.4)' }}>
                    İptal
                  </button>
                  <button onClick={confirmDelete} disabled={deleting}
                    style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: deleting ? 'not-allowed' : 'pointer',  }}>
                    {deleting ? 'Siliniyor...' : 'Evet, Sil'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
