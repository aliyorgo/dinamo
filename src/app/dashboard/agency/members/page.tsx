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

export default function AgencyMembersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [agency, setAgency] = useState<any>(null)
  const [agencyId, setAgencyId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  // Create modal
  const [createModal, setCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '' })
  const [creating, setCreating] = useState(false)

  // Delete modal
  const [deleteUser, setDeleteUser] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: ud } = await supabase.from('users').select('name, role, agency_id').eq('id', user.id).single()
    if (!ud || ud.role !== 'agency' || !ud.agency_id) { router.push('/login'); return }
    setUserName(ud.name)
    setAgencyId(ud.agency_id)

    const [{ data: ag }, { data: mb }] = await Promise.all([
      supabase.from('agencies').select('id, name, logo_url, demo_credits, total_earnings').eq('id', ud.agency_id).single(),
      supabase.from('users').select('*').eq('agency_id', ud.agency_id).eq('role', 'agency_member').order('created_at', { ascending: false }),
    ])
    setAgency(ag)
    setMembers(mb || [])
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!agencyId) return
    setCreating(true)
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: createForm.name, email: createForm.email, password: createForm.password, role: 'agency_member', agency_id: agencyId }),
    })
    const data = await res.json()
    setCreating(false)
    if (data.error) { setMsg(data.error); setTimeout(() => setMsg(''), 4000); return }
    setCreateModal(false)
    setCreateForm({ name: '', email: '', password: '' })
    setMsg('Uye olusturuldu.')
    load()
    setTimeout(() => setMsg(''), 3000)
  }

  async function handleDelete() {
    if (!deleteUser) return
    setDeleting(true)
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: deleteUser.id }),
    })
    const data = await res.json()
    setDeleting(false)
    if (data.error) { setMsg(data.error); setDeleteUser(null); return }
    setDeleteUser(null)
    setMsg('Uye silindi.')
    load()
    setTimeout(() => setMsg(''), 3000)
  }

  async function handleLogout() { await supabase.auth.signOut(); router.push('/login') }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 13px', border: '1px solid #e8e7e3', borderRadius: '8px',
    fontSize: '14px', boxSizing: 'border-box', fontFamily: 'var(--font-dm-sans),sans-serif', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0', fontFamily: 'var(--font-dm-sans),sans-serif' }}><div style={{ color: '#888', fontSize: '14px' }}>Yukleniyor...</div></div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "var(--font-dm-sans),'DM Sans',system-ui,sans-serif" }}>

      {/* SIDEBAR */}
      <div style={{ width: '240px', background: '#0A0A0A', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          {agency?.logo_url ? (
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', overflow: 'hidden' }}>
              <img src={agency.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
            </div>
          ) : (
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px', fontWeight: '500', color: '#fff' }}>{agency?.name?.charAt(0)?.toUpperCase() || 'A'}</span>
            </div>
          )}
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff', marginBottom: '2px' }}>{agency?.name || ''}</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Ajans Paneli</div>
        </div>
        <nav style={{ padding: '10px 8px', flex: 1 }}>
          {AGENCY_NAV.map(item => (
            <div key={item.href} onClick={() => router.push(item.href)}
              style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: item.href === '/dashboard/agency/members' ? 'rgba(255,255,255,0.08)' : 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '12px', color: item.href === '/dashboard/agency/members' ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: item.href === '/dashboard/agency/members' ? '500' : '400' }}>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} style={{ padding: '6px 8px', borderRadius: '7px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-dm-sans),sans-serif' }}>Cikis yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Ekip Uyeleri ({members.length})</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {msg && <div style={{ fontSize: '12px', color: '#22c55e' }}>{msg}</div>}
            <button onClick={() => { setCreateForm({ name: '', email: '', password: '' }); setCreateModal(true) }}
              style={{ padding: '8px 18px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
              + Yeni Uye Ekle
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
            {members.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>Henuz ekip uyesi yok.</div>
            ) : members.map((m, i) => (
              <div key={m.id} style={{ padding: '14px 20px', borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : 'none', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}
                onClick={() => router.push(`/dashboard/agency/members/${m.id}`)}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#fff' }}>{m.name?.charAt(0)?.toUpperCase() || '?'}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{m.name}</div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{m.email}</div>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => setDeleteUser(m)}
                    style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '500', border: '1px solid rgba(239,68,68,0.3)', background: '#fff', color: '#ef4444', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                    Sil
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: '#ccc' }}>{'\u203A'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CREATE MODAL */}
      {createModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setCreateModal(false)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '400px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '20px' }}>Yeni Uye Ekle</div>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '14px' }}><label style={labelStyle}>Ad Soyad *</label><input required value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} style={inputStyle} /></div>
              <div style={{ marginBottom: '14px' }}><label style={labelStyle}>E-posta *</label><input required type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} style={inputStyle} /></div>
              <div style={{ marginBottom: '20px' }}><label style={labelStyle}>Sifre *</label><input required type="password" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} style={inputStyle} /></div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setCreateModal(false)} style={{ flex: 1, padding: '10px', background: '#f5f4f0', color: '#555', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Iptal</button>
                <button type="submit" disabled={creating} style={{ flex: 2, padding: '10px', background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: creating ? 'not-allowed' : 'pointer' }}>
                  {creating ? 'Olusturuluyor...' : 'Uye Olustur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setDeleteUser(null)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '400px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '12px' }}>Uyeyi Sil</div>
            <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.7, marginBottom: '20px' }}>
              <strong>{deleteUser.name}</strong> uyesini silmek istediginizden emin misiniz?
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setDeleteUser(null)} style={{ flex: 1, padding: '10px', background: '#f5f4f0', color: '#555', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Iptal</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
