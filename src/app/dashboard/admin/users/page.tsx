'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const roleLabel: Record<string,string> = { admin: 'Admin', producer: 'Prodüktör', client: 'Müşteri', agency: 'Ajans', agency_member: 'Ajans Üyesi', creator: 'Creator' }
const roleColor: Record<string,string> = { admin: '#ef4444', producer: '#3b82f6', client: '#22c55e', agency: '#f59e0b', agency_member: '#a855f7', creator: '#8b5cf6' }
const roleOrder = ['admin', 'producer', 'client', 'agency', 'agency_member', 'creator']

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])
  const [demoRequests, setDemoRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [activeTab, setActiveTab] = useState<'users'|'demos'>('users')
  const [authInfo, setAuthInfo] = useState<Record<string,{last_sign_in_at:string|null}>>({})

  // Create modal
  const [createModal, setCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'client' })

  // Edit modal
  const [editUser, setEditUser] = useState<any>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', role: '' })

  // Delete modal
  const [deleteUser, setDeleteUser] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 13px', border: '1px solid #e8e7e3', borderRadius: '8px',
    fontSize: '14px', boxSizing: 'border-box', fontFamily: 'system-ui,sans-serif', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px',
    letterSpacing: '0.5px', textTransform: 'uppercase',
  }

  function formatLastLogin(d: string|null) {
    if (!d) return 'Henüz giriş yapılmadı'
    return new Date(d).toLocaleString('tr-TR', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
  }

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
    const { data: dr } = await supabase.from('demo_requests').select('*').order('created_at', { ascending: false })
    setDemoRequests(dr || [])
    if (data && data.length > 0) {
      const res = await fetch('/api/admin/auth-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: data.map((u:any) => u.id) }),
      })
      if (res.ok) setAuthInfo(await res.json())
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    })
    const data = await res.json()
    setLoading(false)
    if (data.error) { setMsg(data.error); return }
    setCreateModal(false)
    setCreateForm({ name: '', email: '', password: '', role: 'client' })
    setMsg('Kullanıcı oluşturuldu.')
    loadUsers()
    setTimeout(() => setMsg(''), 3000)
  }

  function openEdit(user: any) {
    setEditForm({ name: user.name || '', email: user.email || '', password: '', role: user.role || 'client' })
    setEditUser(user)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const res = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: editUser.id,
        name: editForm.name,
        email: editForm.email,
        password: editForm.password || undefined,
        role: editForm.role,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.error) { setMsg(data.error); return }
    setEditUser(null)
    setMsg('Kullanıcı güncellendi.')
    loadUsers()
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
    setMsg('Kullanıcı silindi.')
    loadUsers()
    setTimeout(() => setMsg(''), 3000)
  }

  const activeUsers = users.filter(u => u.status !== 'pending')
  const groupedUsers = roleOrder
    .map(role => ({ role, label: roleLabel[role] || role, color: roleColor[role] || '#888', users: activeUsers.filter(u => u.role === role) }))
    .filter(g => g.users.length > 0)

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'var(--font-dm-sans),sans-serif',background:'#f7f6f2'}}>
      <div className="dinamo-sidebar" style={{width:'240px',background:'#0A0A0A',padding:'32px 0',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'0 24px 32px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{height:"28px"}} />
          <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginTop:'4px',letterSpacing:'1px',fontFamily:'monospace'}}>ADMIN</div>
        </div>
        <nav style={{flex:1,padding:'24px 0'}}>
          {[
            {label:'Genel Bakış',href:'/dashboard/admin'},
            {label:'Briefler',href:'/dashboard/admin/briefs'},
            {label:'Kredi Yönetimi',href:'/dashboard/admin/credits'},
            {label:'Müşteriler',href:'/dashboard/admin/clients'},
            {label:'Kullanıcılar',href:'/dashboard/admin/users'},
            {label:"Creator'lar",href:'/dashboard/admin/creators'},
            {label:'Raporlar',href:'/dashboard/admin/reports'},
            {label:'Ayarlar',href:'/dashboard/admin/settings'},
          ].map(item => (
            <a key={item.href} href={item.href} className={`dinamo-nav-link${item.href==='/dashboard/admin/users'?' active':''}`}>{item.label}</a>
          ))}
        </nav>
      </div>

      <div className="dinamo-main-content" style={{flex:1,padding:'48px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'32px'}}>
          <h1 style={{fontSize:'28px',fontWeight:'300',letterSpacing:'-1px',margin:0}}>Kullanıcılar</h1>
          {msg && <div style={{fontSize:'12px',color:msg.includes('silindi') || msg.includes('Hata') || msg.includes('error') ? '#ef4444' : '#22c55e',marginLeft:'12px'}}>{msg}</div>}
          <div style={{display:'flex',gap:'6px',marginLeft:'auto'}}>
            <button onClick={()=>setActiveTab('users')} style={{padding:'7px 16px',borderRadius:'100px',border:'1px solid',borderColor:activeTab==='users'?'#0a0a0a':'rgba(0,0,0,0.15)',background:activeTab==='users'?'#0a0a0a':'#fff',color:activeTab==='users'?'#fff':'#555',fontSize:'12px',cursor:'pointer',fontFamily:'system-ui'}}>Kullanıcılar</button>
            <button onClick={()=>setActiveTab('demos')} style={{padding:'7px 16px',borderRadius:'100px',border:'1px solid',borderColor:activeTab==='demos'?'#0a0a0a':'rgba(0,0,0,0.15)',background:activeTab==='demos'?'#0a0a0a':'#fff',color:activeTab==='demos'?'#fff':'#555',fontSize:'12px',cursor:'pointer',fontFamily:'system-ui',display:'flex',alignItems:'center',gap:'6px'}}>
              Demo Talepleri
              {demoRequests.length > 0 && <span style={{background:'#3b82f6',color:'#fff',fontSize:'10px',padding:'1px 6px',borderRadius:'100px',fontWeight:'500'}}>{demoRequests.length}</span>}
            </button>
            {activeTab === 'users' && (
              <button onClick={() => { setCreateForm({ name: '', email: '', password: '', role: 'client' }); setCreateModal(true) }}
                style={{padding:'7px 16px',borderRadius:'100px',background:'#22c55e',color:'#fff',border:'none',fontSize:'12px',fontWeight:'500',cursor:'pointer',fontFamily:'system-ui'}}>
                + Yeni Kullanıcı
              </button>
            )}
          </div>
        </div>

        {activeTab === 'demos' ? (
          <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
            <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'12px',color:'rgba(255,255,255,0.4)',letterSpacing:'1px',fontFamily:'monospace'}}>
              DEMO TALEPLERİ ({demoRequests.length})
            </div>
            {demoRequests.length === 0 ? (
              <div style={{padding:'32px',textAlign:'center',color:'rgba(255,255,255,0.4)',fontSize:'14px'}}>Henüz demo talebi yok.</div>
            ) : demoRequests.map((d, i) => (
              <div key={d.id} style={{padding:'14px 24px',borderBottom:i<demoRequests.length-1?'1px solid #f0f0ee':'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:'14px',fontWeight:'500'}}>{d.name}</div>
                  <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',marginTop:'2px'}}>
                    {d.company && <span>{d.company} · </span>}
                    {d.email}
                    {d.phone && <span> · {d.phone}</span>}
                  </div>
                </div>
                <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>{new Date(d.created_at).toLocaleDateString('tr-TR')}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {groupedUsers.map((group) => (
              <div key={group.role} style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
                <div style={{padding:'12px 20px',background:'#0a0a0a',display:'flex',alignItems:'center',gap:'10px'}}>
                  <span style={{width:'8px',height:'8px',borderRadius:'50%',background:group.color,flexShrink:0}}></span>
                  <span style={{fontSize:'12px',fontWeight:'500',color:'#fff',flex:1}}>{group.label}</span>
                  <span style={{fontSize:'10px',fontWeight:'600',color:'#22c55e',background:'rgba(34,197,94,0.15)',padding:'2px 8px',borderRadius:'100px'}}>{group.users.length}</span>
                </div>
                {group.users.map((user: any, i: number) => (
                  <div key={user.id} style={{padding:'12px 20px',borderTop: i > 0 ? '1px solid #f0f0ee' : 'none',display:'flex',alignItems:'center',gap:'12px'}}>
                    <div className="dinamo-main-content" style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{user.name}</div>
                      <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',marginTop:'2px'}}>{user.email}</div>
                    </div>
                    <div style={{fontSize:'11px',color:'rgba(255,255,255,0.25)',flexShrink:0,textAlign:'right',minWidth:'140px'}}>
                      {formatLastLogin(authInfo[user.id]?.last_sign_in_at ?? null)}
                    </div>
                    <div style={{display:'flex',gap:'4px',flexShrink:0}}>
                      <button onClick={() => openEdit(user)}
                        style={{padding:'4px 10px',borderRadius:'6px',fontSize:'10px',fontWeight:'500',border:'1px solid rgba(0,0,0,0.15)',background:'#fff',color:'#555',cursor:'pointer',fontFamily:'system-ui'}}>
                        Düzenle
                      </button>
                      <button onClick={() => setDeleteUser(user)}
                        style={{padding:'4px 10px',borderRadius:'6px',fontSize:'10px',fontWeight:'500',border:'1px solid rgba(239,68,68,0.3)',background:'#fff',color:'#ef4444',cursor:'pointer',fontFamily:'system-ui'}}>
                        Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {createModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setCreateModal(false)}>
          <div style={{background:'#fff',borderRadius:'14px',padding:'28px',width:'400px',maxWidth:'90vw',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:'16px',fontWeight:'500',marginBottom:'20px'}}>Yeni Kullanıcı</div>
            <form onSubmit={handleCreate}>
              <div style={{marginBottom:'14px'}}>
                <label style={labelStyle}>Ad Soyad *</label>
                <input required value={createForm.name} onChange={e=>setCreateForm({...createForm,name:e.target.value})} style={inputStyle} />
              </div>
              <div style={{marginBottom:'14px'}}>
                <label style={labelStyle}>E-posta *</label>
                <input required type="email" value={createForm.email} onChange={e=>setCreateForm({...createForm,email:e.target.value})} style={inputStyle} />
              </div>
              <div style={{marginBottom:'14px'}}>
                <label style={labelStyle}>Şifre *</label>
                <input required type="password" value={createForm.password} onChange={e=>setCreateForm({...createForm,password:e.target.value})} style={inputStyle} />
              </div>
              <div style={{marginBottom:'20px'}}>
                <label style={labelStyle}>Rol</label>
                <select value={createForm.role} onChange={e=>setCreateForm({...createForm,role:e.target.value})} style={{...inputStyle,cursor:'pointer',background:'#fff'}}>
                  {roleOrder.map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}
                </select>
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <button type="button" onClick={()=>setCreateModal(false)} style={{flex:1,padding:'10px',background:'#f5f4f0',color:'#555',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>İptal</button>
                <button type="submit" disabled={loading} style={{flex:2,padding:'10px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:loading?'not-allowed':'pointer'}}>
                  {loading ? 'Oluşturuluyor...' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editUser && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setEditUser(null)}>
          <div style={{background:'#fff',borderRadius:'14px',padding:'28px',width:'400px',maxWidth:'90vw',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:'16px',fontWeight:'500',marginBottom:'20px'}}>Kullanıcıyı Düzenle</div>
            <form onSubmit={handleEdit}>
              <div style={{marginBottom:'14px'}}>
                <label style={labelStyle}>Ad Soyad</label>
                <input required value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})} style={inputStyle} />
              </div>
              <div style={{marginBottom:'14px'}}>
                <label style={labelStyle}>E-posta</label>
                <input required type="email" value={editForm.email} onChange={e=>setEditForm({...editForm,email:e.target.value})} style={inputStyle} />
              </div>
              <div style={{marginBottom:'14px'}}>
                <label style={labelStyle}>Yeni Şifre <span style={{color:'rgba(255,255,255,0.25)',fontWeight:'400',textTransform:'none'}}>(boş bırakırsa değişmez)</span></label>
                <input type="password" value={editForm.password} onChange={e=>setEditForm({...editForm,password:e.target.value})} style={inputStyle} placeholder="••••••••" />
              </div>
              <div style={{marginBottom:'20px'}}>
                <label style={labelStyle}>Rol</label>
                <select value={editForm.role} onChange={e=>setEditForm({...editForm,role:e.target.value})} style={{...inputStyle,cursor:'pointer',background:'#fff'}}>
                  {roleOrder.map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}
                </select>
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <button type="button" onClick={()=>setEditUser(null)} style={{flex:1,padding:'10px',background:'#f5f4f0',color:'#555',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>İptal</button>
                <button type="submit" disabled={loading} style={{flex:2,padding:'10px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:loading?'not-allowed':'pointer'}}>
                  {loading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteUser && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setDeleteUser(null)}>
          <div style={{background:'#fff',borderRadius:'14px',padding:'28px',width:'400px',maxWidth:'90vw',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:'16px',fontWeight:'500',marginBottom:'12px'}}>Kullanıcıyı Sil</div>
            <div style={{fontSize:'13px',color:'#555',lineHeight:1.7,marginBottom:'20px'}}>
              <strong>{deleteUser.name}</strong> ({deleteUser.email}) kullanıcısını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={()=>setDeleteUser(null)} style={{flex:1,padding:'10px',background:'#f5f4f0',color:'#555',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>İptal</button>
              <button onClick={handleDelete} disabled={deleting} style={{flex:1,padding:'10px',background:'#ef4444',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:deleting?'not-allowed':'pointer'}}>
                {deleting ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
