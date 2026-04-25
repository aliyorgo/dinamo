'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)


export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [packages, setPackages] = useState<any[]>([])
  const [pkgEdits, setPkgEdits] = useState<Record<string,{name:string,credits:string,price_tl:string}>>({})
  const [newPkg, setNewPkg] = useState({name:'',credits:'',price_tl:''})

  // User management
  const [admins, setAdmins] = useState<any[]>([])
  const [producers, setProducers] = useState<any[]>([])
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'admin' })
  const [userSaving, setUserSaving] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '' })
  const [addingRole, setAddingRole] = useState<string|null>(null)

  useEffect(() => { loadSettings(); loadUsers() }, [])

  async function loadSettings() {
    const { data } = await supabase.from('admin_settings').select('*')
    const map: Record<string,string> = {}
    data?.forEach(s => map[s.key] = s.value)
    setSettings(map)
    const { data: pkgs } = await supabase.from('credit_packages').select('*').order('credits')
    setPackages(pkgs || [])
    const edits: Record<string,{name:string,credits:string,price_tl:string}> = {}
    pkgs?.forEach(p => { edits[p.id] = { name: p.name, credits: String(p.credits), price_tl: String(p.price_tl || 0) } })
    setPkgEdits(edits)
  }

  async function loadUsers() {
    const { data } = await supabase.from('users').select('*').in('role', ['admin', 'producer']).order('created_at', { ascending: false })
    setAdmins((data || []).filter(u => u.role === 'admin'))
    setProducers((data || []).filter(u => u.role === 'producer'))
  }

  async function createUser(role: string) {
    setUserSaving(true)
    const res = await fetch('/api/admin/create-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...userForm, role }) })
    const data = await res.json()
    setUserSaving(false)
    if (data.error) { setMsg(data.error); return }
    setUserForm({ name: '', email: '', password: '', role: 'admin' })
    setMsg('Kullanıcı oluşturuldu.')
    loadUsers()
    setTimeout(() => setMsg(''), 3000)
  }

  async function updateUser() {
    if (!editingUser) return
    setUserSaving(true)
    const res = await fetch('/api/admin/update-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: editingUser.id, name: editForm.name, email: editForm.email, password: editForm.password || undefined, role: editingUser.role }) })
    const data = await res.json()
    setUserSaving(false)
    if (data.error) { setMsg(data.error); return }
    setEditingUser(null)
    setMsg('Kullanıcı güncellendi.')
    loadUsers()
    setTimeout(() => setMsg(''), 3000)
  }

  async function deleteUser(user: any) {
    if (!confirm(`"${user.name}" kullanıcısını silmek istediğinizden emin misiniz?`)) return
    await fetch('/api/admin/delete-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) })
    setMsg('Kullanıcı silindi.')
    loadUsers()
    setTimeout(() => setMsg(''), 3000)
  }

  async function saveSetting(key: string, value: string) {
    setLoading(true)
    const { data: existing } = await supabase.from('admin_settings').select('id').eq('key', key).maybeSingle()
    if (existing) {
      await supabase.from('admin_settings').update({ value }).eq('key', key)
    } else {
      await supabase.from('admin_settings').insert({ key, value })
    }
    setMsg('Kaydedildi.')
    setTimeout(() => setMsg(''), 2000)
    setLoading(false)
  }

  async function savePkg(id: string) {
    const e = pkgEdits[id]
    if (!e) return
    await supabase.from('credit_packages').update({ name: e.name, credits: parseInt(e.credits), price_tl: parseFloat(e.price_tl) || 0 }).eq('id', id)
    setMsg('Paket güncellendi.')
    setTimeout(() => setMsg(''), 2000)
    loadSettings()
  }

  async function addPkg() {
    if (!newPkg.name || !newPkg.credits) return
    await supabase.from('credit_packages').insert({ name: newPkg.name, credits: parseInt(newPkg.credits), price_tl: parseFloat(newPkg.price_tl) || 0 })
    setNewPkg({ name: '', credits: '', price_tl: '' })
    setMsg('Paket eklendi.')
    setTimeout(() => setMsg(''), 2000)
    loadSettings()
  }

  async function deletePkg(id: string, name: string) {
    if (!confirm(`"${name}" paketini silmek istediğinizden emin misiniz?`)) return
    await supabase.from('credit_packages').delete().eq('id', id)
    setMsg('Paket silindi.')
    setTimeout(() => setMsg(''), 2000)
    loadSettings()
  }

  const fields = [
    { key: 'approval_delegated_to_producer', label: 'Onay yetkisi prodüktöre devredildi', type: 'toggle' },
    { key: 'creator_credit_rate', label: '1 kredinın TL karşılığı (Creator ödemesi)', type: 'number', unit: '₺' },
    { key: 'credit_bumper', label: 'Bumper kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_story', label: 'Story/Reels kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_feed', label: 'Feed Video kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_longform', label: 'Long Form kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_extra_format', label: 'Ekstra format kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_revision', label: 'Müşteri revizyon kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_voiceover_real', label: 'Gerçek seslendirme kredi değeri', type: 'number', unit: 'kredi' },
  ]

  return (
    <div style={{padding:'48px'}}>
        <h1 style={{fontSize:'28px',fontWeight:'300',letterSpacing:'-1px',margin:'0 0 40px',color:'#0a0a0a'}}>Ayarlar</h1>
        {msg && <div style={{marginBottom:'20px',padding:'12px 16px',background:'#e8f7e8',borderRadius:'8px',fontSize:'13px',color:'#1db81d'}}>{msg}</div>}
        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
          <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'12px',color:'rgba(255,255,255,0.4)',letterSpacing:'1px',fontFamily:'monospace'}}>SİSTEM AYARLARI</div>
          {fields.map((field, i) => (
            <div key={field.key} style={{padding:'20px 24px',borderBottom:i<fields.length-1?'1px solid #f0f0ee':'none',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'24px'}}>
              <div style={{fontSize:'14px',color:'#0a0a0a'}}>{field.label}</div>
              {field.type === 'toggle' ? (
                <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                  <span style={{fontSize:'13px',color:'rgba(255,255,255,0.4)'}}>{settings[field.key]==='true'?'Açık':'Kapalı'}</span>
                  <button onClick={()=>{const newVal=settings[field.key]==='true'?'false':'true'; setSettings({...settings,[field.key]:newVal}); saveSetting(field.key,newVal)}}
                    style={{width:'44px',height:'24px',borderRadius:'100px',border:'none',cursor:'pointer',background:settings[field.key]==='true'?'#1db81d':'#ddd',position:'relative',transition:'background 0.2s'}}>
                    <span style={{position:'absolute',top:'3px',left:settings[field.key]==='true'?'23px':'3px',width:'18px',height:'18px',borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}></span>
                  </button>
                </div>
              ) : (
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <input type="number" defaultValue={settings[field.key]} onBlur={e=>saveSetting(field.key, e.target.value)}
                    style={{width:'100px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',textAlign:'right',color:'#0a0a0a'}} />
                  {field.unit && <span style={{fontSize:'13px',color:'rgba(255,255,255,0.4)'}}>{field.unit}</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* KREDİ PAKETLERİ */}
        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden',marginTop:'32px'}}>
          <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'12px',color:'rgba(255,255,255,0.4)',letterSpacing:'1px',fontFamily:'monospace'}}>KREDİ PAKETLERİ</div>
          {packages.map((p, i) => {
            const e = pkgEdits[p.id] || { name: p.name, credits: String(p.credits), price_tl: String(p.price_tl || 0) }
            const isKurumsal = p.name === 'Kurumsal' || e.name === 'Kurumsal'
            return (
              <div key={p.id} style={{padding:'16px 24px',borderBottom:i<packages.length-1?'1px solid #f0f0ee':'none',display:'flex',alignItems:'center',gap:'12px'}}>
                <div>
                  <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>İsim</div>
                  <input value={e.name} onChange={ev=>setPkgEdits({...pkgEdits,[p.id]:{...e,name:ev.target.value}})}
                    style={{width:'120px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a'}} />
                </div>
                <div>
                  <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>Kredi</div>
                  <input type="number" value={e.credits} onChange={ev=>setPkgEdits({...pkgEdits,[p.id]:{...e,credits:ev.target.value}})}
                    style={{width:'80px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a',textAlign:'right'}} />
                </div>
                <div>
                  <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>Fiyat (TL)</div>
                  {isKurumsal ? (
                    <div style={{padding:'7px 10px',fontSize:'12px',color:'rgba(255,255,255,0.4)',fontStyle:'italic'}}>İletişime Geçin</div>
                  ) : (
                    <input type="number" value={e.price_tl} onChange={ev=>setPkgEdits({...pkgEdits,[p.id]:{...e,price_tl:ev.target.value}})}
                      style={{width:'120px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a',textAlign:'right'}} />
                  )}
                </div>
                <div style={{display:'flex',gap:'6px',marginTop:'16px'}}>
                  <button onClick={()=>savePkg(p.id)} style={{padding:'7px 14px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'6px',fontSize:'11px',cursor:'pointer'}}>Kaydet</button>
                  <button onClick={()=>deletePkg(p.id,p.name)} style={{padding:'7px 14px',background:'#fff',color:'#ef4444',border:'1px solid #ef4444',borderRadius:'6px',fontSize:'11px',cursor:'pointer'}}>Sil</button>
                </div>
              </div>
            )
          })}
          {/* New package form */}
          <div style={{padding:'16px 24px',borderTop:'1px solid #e8e7e3',background:'#fafaf8',display:'flex',alignItems:'center',gap:'12px'}}>
            <div>
              <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>İsim</div>
              <input value={newPkg.name} onChange={e=>setNewPkg({...newPkg,name:e.target.value})} placeholder="Paket adı"
                style={{width:'120px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a'}} />
            </div>
            <div>
              <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>Kredi</div>
              <input type="number" value={newPkg.credits} onChange={e=>setNewPkg({...newPkg,credits:e.target.value})} placeholder="0"
                style={{width:'80px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a',textAlign:'right'}} />
            </div>
            <div>
              <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>Fiyat (TL)</div>
              <input type="number" value={newPkg.price_tl} onChange={e=>setNewPkg({...newPkg,price_tl:e.target.value})} placeholder="0"
                style={{width:'120px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a',textAlign:'right'}} />
            </div>
            <button onClick={addPkg} disabled={!newPkg.name||!newPkg.credits} style={{padding:'7px 18px',background:'#1db81d',color:'#fff',border:'none',borderRadius:'6px',fontSize:'11px',cursor:'pointer',fontWeight:'500',marginTop:'16px',opacity:!newPkg.name||!newPkg.credits?0.4:1}}>
              Yeni Paket Ekle
            </button>
          </div>
        </div>
        {/* ADMIN KULLANICILARI */}
        {(['admin', 'producer'] as const).map(role => {
          const list = role === 'admin' ? admins : producers
          const label = role === 'admin' ? 'ADMİN KULLANICILARI' : 'PRODÜKTÖR KULLANICILARI'
          return (
            <div key={role} style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden',marginTop:'32px'}}>
              <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',letterSpacing:'1px',fontFamily:'monospace'}}>{label}</div>
                <div style={{fontSize:'11px',color:'#888'}}>{list.length} kişi</div>
              </div>
              {list.map(u => (
                <div key={u.id} style={{padding:'12px 24px',borderBottom:'1px solid #f0f0ee',display:'flex',alignItems:'center',gap:'12px'}}>
                  {editingUser?.id === u.id ? (
                    <>
                      <input value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})} placeholder="Ad" style={{flex:1,padding:'6px 10px',border:'1px solid #e8e7e3',borderRadius:'6px',fontSize:'13px'}} />
                      <input value={editForm.email} onChange={e=>setEditForm({...editForm,email:e.target.value})} placeholder="Email" style={{flex:1,padding:'6px 10px',border:'1px solid #e8e7e3',borderRadius:'6px',fontSize:'13px'}} />
                      <input value={editForm.password} onChange={e=>setEditForm({...editForm,password:e.target.value})} placeholder="Yeni şifre (boş = değişmez)" style={{flex:1,padding:'6px 10px',border:'1px solid #e8e7e3',borderRadius:'6px',fontSize:'13px'}} />
                      <button onClick={updateUser} disabled={userSaving} style={{padding:'5px 12px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'6px',fontSize:'11px',cursor:'pointer'}}>Kaydet</button>
                      <button onClick={()=>setEditingUser(null)} style={{padding:'5px 12px',background:'#fff',color:'#888',border:'1px solid #e8e7e3',borderRadius:'6px',fontSize:'11px',cursor:'pointer'}}>İptal</button>
                    </>
                  ) : (
                    <>
                      <div style={{flex:1}}>
                        <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{u.name || '—'}</div>
                        <div style={{fontSize:'11px',color:'#888'}}>{u.email}</div>
                      </div>
                      <button onClick={()=>{setEditingUser(u);setEditForm({name:u.name||'',email:u.email||'',password:''})}} style={{padding:'4px 10px',background:'#fff',color:'#555',border:'1px solid #e8e7e3',borderRadius:'6px',fontSize:'10px',cursor:'pointer'}}>Düzenle</button>
                      <button onClick={()=>deleteUser(u)} style={{padding:'4px 10px',background:'#fff',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'6px',fontSize:'10px',cursor:'pointer'}}>Sil</button>
                    </>
                  )}
                </div>
              ))}
              <div style={{padding:'12px 24px',borderTop:'1px solid #e8e7e3'}}>
                {addingRole === role ? (
                  <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                    <input value={role === userForm.role ? userForm.name : ''} onChange={e=>setUserForm({...userForm,name:e.target.value,role})} placeholder="Ad Soyad" style={{flex:1,minWidth:'120px',padding:'7px 10px',border:'1px solid #0a0a0a',fontSize:'13px'}} />
                    <input value={role === userForm.role ? userForm.email : ''} onChange={e=>setUserForm({...userForm,email:e.target.value,role})} placeholder="Email" style={{flex:1,minWidth:'140px',padding:'7px 10px',border:'1px solid #0a0a0a',fontSize:'13px'}} />
                    <input value={role === userForm.role ? userForm.password : ''} onChange={e=>setUserForm({...userForm,password:e.target.value,role})} placeholder="Şifre (boş = dinamo2026)" style={{width:'160px',padding:'7px 10px',border:'1px solid #0a0a0a',fontSize:'13px'}} />
                    <button onClick={async () => { await createUser(role); setAddingRole(null) }} disabled={userSaving||!(role===userForm.role&&userForm.email)} className="btn" style={{padding:'7px 16px',whiteSpace:'nowrap'}}>OLUŞTUR</button>
                    <button onClick={()=>setAddingRole(null)} className="btn btn-outline" style={{padding:'7px 12px'}}>İPTAL</button>
                  </div>
                ) : (
                  <button onClick={()=>{setAddingRole(role);setUserForm({name:'',email:'',password:'',role})}} className="btn" style={{padding:'8px 20px',width:'100%'}}>
                    + YENİ {role === 'admin' ? 'ADMİN' : 'PRODÜKTÖR'} EKLE
                  </button>
                )}
              </div>
            </div>
          )
        })}
    </div>
  )
}
