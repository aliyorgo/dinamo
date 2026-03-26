'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const NAV = [{label:'GENEL BAKIŞ',href:'/dashboard/admin'},{label:'KULLANICILAR',href:'/dashboard/admin/users'},{label:'MÜŞTERİLER',href:'/dashboard/admin/clients'},{label:'BRİEFLER',href:'/dashboard/admin/briefs'},{label:'KREDİLER',href:'/dashboard/admin/credits'},{label:'AYARLAR',href:'/dashboard/admin/settings'}]
export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ company_name: '', credit_balance: 0 })
  const [userForm, setUserForm] = useState({ client_id: '', user_id: '', credit_balance: 0 })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: c }, { data: u }] = await Promise.all([
      supabase.from('clients').select('*, client_users(count)').order('created_at', { ascending: false }),
      supabase.from('users').select('id, name, email').eq('role', 'client')
    ])
    setClients(c || [])
    setUsers(u || [])
  }

  async function createClient(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const { error } = await supabase.from('clients').insert(form)
    if (error) { setMsg(error.message); setLoading(false); return }
    setMsg('Müşteri oluşturuldu.')
    setForm({ company_name: '', credit_balance: 0 })
    loadData()
    setLoading(false)
  }

  async function addUserToClient(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const { error } = await supabase.from('client_users').insert(userForm)
    if (error) { setMsg(error.message); setLoading(false); return }
    setMsg('Kullanıcı müşteriye eklendi.')
    setUserForm({ client_id: '', user_id: '', credit_balance: 0 })
    loadData()
    setLoading(false)
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'system-ui,sans-serif',background:'#f7f6f2'}}>
      <div style={{width:'220px',background:'#0a0a0a',padding:'32px 0',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'0 24px 32px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:'20px',fontWeight:'500',color:'#fff'}}>dinamo</div>
          <div style={{fontSize:'11px',color:'#666',marginTop:'4px',letterSpacing:'1px',fontFamily:'monospace'}}>ADMIN</div>
        </div>
        <nav style={{flex:1,padding:'24px 0'}}>
          {NAV.map(item=>(
            <a key={item.href} href={item.href} style={{display:'block',padding:'10px 24px',fontSize:'11px',color:'#888',textDecoration:'none',letterSpacing:'1px',fontFamily:'monospace'}}
              onMouseEnter={e=>(e.currentTarget.style.color='#fff')} onMouseLeave={e=>(e.currentTarget.style.color='#888')}>{item.label}</a>
          ))}
        </nav>
      </div>
      <div style={{flex:1,padding:'48px'}}>
        <h1 style={{fontSize:'28px',fontWeight:'300',letterSpacing:'-1px',margin:'0 0 40px'}}>Müşteriler</h1>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'32px'}}>
          <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'28px'}}>
            <div style={{fontSize:'12px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'20px'}}>YENİ MÜŞTERİ</div>
            <form onSubmit={createClient}>
              <div style={{marginBottom:'16px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#888',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace',textTransform:'uppercase'}}>ŞİRKET ADI</label>
                <input type="text" value={form.company_name} onChange={e=>setForm({...form,company_name:e.target.value})} required
                  style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box'}} />
              </div>
              <div style={{marginBottom:'20px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#888',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace',textTransform:'uppercase'}}>BAŞLANGIÇ KREDİSİ</label>
                <input type="number" value={form.credit_balance} onChange={e=>setForm({...form,credit_balance:parseInt(e.target.value)})}
                  style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box'}} />
              </div>
              {msg && <div style={{fontSize:'13px',color:msg.includes('oluşturuldu')||msg.includes('eklendi')?'#1db81d':'#e24b4a',marginBottom:'16px'}}>{msg}</div>}
              <button type="submit" disabled={loading}
                style={{width:'100%',padding:'11px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}>
                {loading?'Oluşturuluyor...':'Müşteri Oluştur'}
              </button>
            </form>
          </div>
          <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'28px'}}>
            <div style={{fontSize:'12px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'20px'}}>KULLANICI ATAYIN</div>
            <form onSubmit={addUserToClient}>
              <div style={{marginBottom:'16px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#888',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace',textTransform:'uppercase'}}>MÜŞTERİ</label>
                <select value={userForm.client_id} onChange={e=>setUserForm({...userForm,client_id:e.target.value})} required
                  style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box',background:'#fff'}}>
                  <option value="">Seçin</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div style={{marginBottom:'16px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#888',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace',textTransform:'uppercase'}}>KULLANICI</label>
                <select value={userForm.user_id} onChange={e=>setUserForm({...userForm,user_id:e.target.value})} required
                  style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box',background:'#fff'}}>
                  <option value="">Seçin</option>
                  {users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              <div style={{marginBottom:'20px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#888',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace',textTransform:'uppercase'}}>KREDİ</label>
                <input type="number" value={userForm.credit_balance} onChange={e=>setUserForm({...userForm,credit_balance:parseInt(e.target.value)})}
                  style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box'}} />
              </div>
              <button type="submit" disabled={loading}
                style={{width:'100%',padding:'11px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}>
                {loading?'Ekleniyor...':'Kullanıcı Ata'}
              </button>
            </form>
          </div>
        </div>
        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
          <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'12px',color:'#888',letterSpacing:'1px',fontFamily:'monospace'}}>MÜŞTERİ LİSTESİ ({clients.length})</div>
          {clients.length === 0 ? (
            <div style={{padding:'48px',textAlign:'center',color:'#888',fontSize:'14px'}}>Henüz müşteri yok.</div>
          ) : clients.map((client,i) => (
            <div key={client.id} style={{padding:'16px 24px',borderBottom:i<clients.length-1?'1px solid #f0f0ee':'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:'14px',fontWeight:'500'}}>{client.company_name}</div>
                <div style={{fontSize:'12px',color:'#888',marginTop:'2px'}}>{client.credit_balance} kredi</div>
              </div>
              <button onClick={()=>router.push(`/dashboard/admin/clients/${client.id}`)}
                style={{fontSize:'12px',padding:'6px 14px',border:'1px solid #e8e7e3',borderRadius:'100px',background:'#fff',cursor:'pointer'}}>
                Detay
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}