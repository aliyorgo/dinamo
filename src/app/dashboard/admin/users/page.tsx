'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'client' })
  const [msg, setMsg] = useState('')

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    const data = await res.json()
    if (data.error) { setMsg(data.error); setLoading(false); return }
    setMsg('Kullanıcı oluşturuldu.')
    setForm({ name: '', email: '', password: '', role: 'client' })
    loadUsers()
    setLoading(false)
  }

  const roleLabel: Record<string,string> = { admin: 'Admin', producer: 'Prodüktör', creator: 'Creator', client: 'Müşteri' }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'system-ui,sans-serif',background:'#f7f6f2'}}>
      <div style={{width:'220px',background:'#0a0a0a',padding:'32px 0',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'0 24px 32px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:'20px',fontWeight:'500',color:'#fff'}}>dinamo</div>
          <div style={{fontSize:'11px',color:'#666',marginTop:'4px',letterSpacing:'1px',fontFamily:'monospace'}}>ADMIN</div>
        </div>
        <nav style={{flex:1,padding:'24px 0'}}>
          {[
            {label:'GENEL BAKIŞ',href:'/dashboard/admin'},
            {label:'KULLANICILAR',href:'/dashboard/admin/users'},
            {label:'MÜŞTERİLER',href:'/dashboard/admin/clients'},
            {label:'BRİEFLER',href:'/dashboard/admin/briefs'},
            {label:'KREDİLER',href:'/dashboard/admin/credits'},
            {label:'AYARLAR',href:'/dashboard/admin/settings'},
          ].map(item => (
            <a key={item.href} href={item.href} style={{display:'block',padding:'10px 24px',fontSize:'11px',color:'#888',textDecoration:'none',letterSpacing:'1px',fontFamily:'monospace'}}
              onMouseEnter={e=>(e.currentTarget.style.color='#fff')} onMouseLeave={e=>(e.currentTarget.style.color='#888')}>{item.label}</a>
          ))}
        </nav>
        <div style={{padding:'24px',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
          <a href="/dashboard/admin" style={{fontSize:'11px',color:'#666',textDecoration:'none',letterSpacing:'1px',fontFamily:'monospace'}}>← GERİ</a>
        </div>
      </div>
      <div style={{flex:1,padding:'48px'}}>
        <h1 style={{fontSize:'28px',fontWeight:'300',letterSpacing:'-1px',margin:'0 0 40px'}}>Kullanıcılar</h1>
        
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'32px'}}>
          <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'28px'}}>
            <div style={{fontSize:'12px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'20px'}}>YENİ KULLANICI</div>
            <form onSubmit={createUser}>
              {[
                {label:'Ad Soyad',key:'name',type:'text'},
                {label:'E-posta',key:'email',type:'email'},
                {label:'Şifre',key:'password',type:'password'},
              ].map(f => (
                <div key={f.key} style={{marginBottom:'16px'}}>
                  <label style={{display:'block',fontSize:'11px',color:'#888',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace',textTransform:'uppercase'}}>{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})} required
                    style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box'}} />
                </div>
              ))}
              <div style={{marginBottom:'20px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#888',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace',textTransform:'uppercase'}}>ROL</label>
                <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}
                  style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box',background:'#fff'}}>
                  <option value="client">Müşteri</option>
                  <option value="producer">Prodüktör</option>
                  <option value="creator">Creator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {msg && <div style={{fontSize:'13px',color:msg.includes('oluşturuldu')?'#1db81d':'#e24b4a',marginBottom:'16px'}}>{msg}</div>}
              <button type="submit" disabled={loading}
                style={{width:'100%',padding:'11px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}>
                {loading ? 'Oluşturuluyor...' : 'Kullanıcı Oluştur'}
              </button>
            </form>
          </div>

          <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
            <div style={{padding:'20px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'12px',color:'#888',letterSpacing:'1px',fontFamily:'monospace'}}>
              MEVCUT KULLANICILAR ({users.length})
            </div>
            {users.map((user,i) => (
              <div key={user.id} style={{padding:'14px 24px',borderBottom:i<users.length-1?'1px solid #f0f0ee':'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:'14px',fontWeight:'500'}}>{user.name}</div>
                  <div style={{fontSize:'12px',color:'#888',marginTop:'2px'}}>{user.email}</div>
                </div>
                <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'100px',background:'#f0f0ee',color:'#666',fontFamily:'monospace'}}>
                  {roleLabel[user.role] || user.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}