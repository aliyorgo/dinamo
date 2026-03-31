'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const NAV = [
  {label:'GENEL BAKIŞ',href:'/dashboard/admin'},
  {label:'KULLANICILAR',href:'/dashboard/admin/users'},
  {label:'MÜŞTERİLER',href:'/dashboard/admin/clients'},
  {label:'BRİEFLER',href:'/dashboard/admin/briefs'},
  {label:"CREATOR'LAR",href:'/dashboard/admin/creators'},
  {label:'KREDİLER',href:'/dashboard/admin/credits'},
  {label:'AYARLAR',href:'/dashboard/admin/settings'},
]

export default function CreditsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [clientUsers, setClientUsers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [clientForm, setClientForm] = useState({ client_id: '', amount: 0, type: 'purchase', description: '' })
  const [userForm, setUserForm] = useState({ client_user_id: '', amount: 0, description: '' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: c } = await supabase.from('clients').select('*').order('company_name')
    setClients(c || [])
    const { data: cu } = await supabase.from('client_users').select('*, users(name, email), clients(company_name, credit_balance)').order('created_at', { ascending: false })
    setClientUsers(cu || [])
    const { data: t } = await supabase.from('credit_transactions').select('*, clients(company_name), client_users(*, users(name))').order('created_at', { ascending: false }).limit(40)
    setTransactions(t || [])
  }

  async function handleClientCredit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!clientForm.client_id || clientForm.amount <= 0) { setMsg('Müşteri seçin ve geçerli miktar girin.'); return }
    setLoading(true)
    setMsg('')
    const client = clients.find(c => c.id === clientForm.client_id)
    if (!client) { setMsg('Müşteri bulunamadı.'); setLoading(false); return }
    const delta = clientForm.type === 'deduct' ? -clientForm.amount : clientForm.amount
    const newBalance = Math.max(0, client.credit_balance + delta)
    const { error } = await supabase.from('clients').update({ credit_balance: newBalance }).eq('id', clientForm.client_id)
    if (error) { setMsg('Hata: ' + error.message); setLoading(false); return }
    await supabase.from('credit_transactions').insert({
      client_id: clientForm.client_id,
      amount: delta,
      type: clientForm.type,
      description: clientForm.description || (delta > 0 ? 'Müşteri kredi yükleme' : 'Müşteri kredi düşme')
    })
    setMsg(`${client.company_name} havuzuna ${clientForm.amount} kredi ${delta > 0 ? 'yüklendi' : 'düşüldü'}.`)
    setClientForm({ client_id: '', amount: 0, type: 'purchase', description: '' })
    loadData()
    setLoading(false)
  }

  async function handleUserCredit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!userForm.client_user_id || userForm.amount <= 0) { setMsg('Kullanıcı seçin ve geçerli miktar girin.'); return }
    setLoading(true)
    setMsg('')
    const cu = clientUsers.find(c => c.id === userForm.client_user_id)
    if (!cu) { setMsg('Kullanıcı bulunamadı.'); setLoading(false); return }
    const client = clients.find(c => c.id === cu.client_id)
    if (!client) { setMsg('Müşteri bulunamadı.'); setLoading(false); return }
    if (client.credit_balance < userForm.amount) {
      setMsg(`Yetersiz havuz kredisi. ${client.company_name} havuzunda ${client.credit_balance} kredi var.`)
      setLoading(false)
      return
    }
    const { error: userError } = await supabase.from('client_users').update({ credit_balance: cu.credit_balance + userForm.amount }).eq('id', userForm.client_user_id)
    if (userError) { setMsg('Hata: ' + userError.message); setLoading(false); return }
    const { error: clientError } = await supabase.from('clients').update({ credit_balance: client.credit_balance - userForm.amount }).eq('id', cu.client_id)
    if (clientError) { setMsg('Hata: ' + clientError.message); setLoading(false); return }
    await supabase.from('credit_transactions').insert({
      client_id: cu.client_id,
      client_user_id: cu.id,
      amount: userForm.amount,
      type: 'allocation',
      description: userForm.description || `${cu.users?.name} kullanıcısına tahsis`
    })
    setMsg(`${cu.users?.name} kullanıcısına ${userForm.amount} kredi tahsis edildi. ${client.company_name} havuzundan düşüldü.`)
    setUserForm({ client_user_id: '', amount: 0, description: '' })
    loadData()
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
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
            <a key={item.href} href={item.href} style={{display:'block',padding:'10px 24px',fontSize:'11px',color:item.href==='/dashboard/admin/credits'?'#fff':'#888',textDecoration:'none',letterSpacing:'1px',fontFamily:'monospace'}}
              onMouseEnter={e=>(e.currentTarget.style.color='#fff')}
              onMouseLeave={e=>(e.currentTarget.style.color=item.href==='/dashboard/admin/credits'?'#fff':'#888')}>
              {item.label}
            </a>
          ))}
        </nav>
        <div style={{padding:'24px',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
          <button onClick={handleLogout} style={{fontSize:'11px',color:'#666',background:'none',border:'none',cursor:'pointer',letterSpacing:'1px',fontFamily:'monospace',padding:0}}>ÇIKIŞ YAP</button>
        </div>
      </div>

      <div style={{flex:1,padding:'48px'}}>
        <h1 style={{fontSize:'28px',fontWeight:'300',letterSpacing:'-1px',margin:'0 0 32px',color:'#0a0a0a'}}>Kredi Yönetimi</h1>

        {msg && (
          <div style={{padding:'12px 16px',background:msg.includes('Hata')||msg.includes('Yetersiz')||msg.includes('seçin')?'#fef2f2':'#e8f7e8',borderRadius:'8px',fontSize:'13px',color:msg.includes('Hata')||msg.includes('Yetersiz')||msg.includes('seçin')?'#e24b4a':'#1db81d',marginBottom:'24px'}}>
            {msg}
          </div>
        )}

        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden',marginBottom:'24px'}}>
          <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'12px',color:'#888',letterSpacing:'1px',fontFamily:'monospace'}}>MÜŞTERİ KREDİ HAVUZLARI</div>
          {clients.map((c,i)=>{
            const users = clientUsers.filter(cu=>cu.client_id===c.id)
            const allocated = users.reduce((s,cu)=>s+cu.credit_balance,0)
            return (
              <div key={c.id} style={{padding:'16px 24px',borderBottom:i<clients.length-1?'1px solid #f0f0ee':'none'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                  <div style={{fontSize:'15px',fontWeight:'500',color:'#0a0a0a'}}>{c.company_name}</div>
                  <div style={{display:'flex',gap:'24px',alignItems:'center'}}>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'2px'}}>HAVUZ</div>
                      <div style={{fontSize:'18px',fontWeight:'300',color:'#0a0a0a'}}>{c.credit_balance}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'2px'}}>KULLANICILARDA</div>
                      <div style={{fontSize:'18px',fontWeight:'300',color:'#555'}}>{allocated}</div>
                    </div>
                  </div>
                </div>
                {users.length > 0 && (
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    {users.map(cu=>(
                      <div key={cu.id} style={{padding:'4px 12px',background:'#f7f6f2',borderRadius:'100px',fontSize:'12px',color:'#555'}}>
                        {cu.users?.name}: {cu.credit_balance} kredi
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'32px'}}>
          <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'28px'}}>
            <div style={{fontSize:'12px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'8px'}}>MÜŞTERİ HAVUZUNA KREDİ</div>
            <p style={{fontSize:'12px',color:'#888',marginBottom:'20px',lineHeight:'1.5'}}>Müşterinin toplam kredi havuzuna ekler veya düşer.</p>
            <form onSubmit={handleClientCredit}>
              <div style={{marginBottom:'14px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#555',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace'}}>MÜŞTERİ</label>
                <select value={clientForm.client_id} onChange={e=>setClientForm({...clientForm,client_id:e.target.value})} required
                  style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',background:'#fff',color:'#0a0a0a'}}>
                  <option value="">Seçin</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.company_name} ({c.credit_balance} kredi)</option>)}
                </select>
              </div>
              <div style={{marginBottom:'14px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#555',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace'}}>İŞLEM</label>
                <div style={{display:'flex',gap:'8px'}}>
                  {[{val:'purchase',label:'Ekle'},{val:'deduct',label:'Düş'},{val:'promo',label:'Promo'}].map(t=>(
                    <button key={t.val} type="button" onClick={()=>setClientForm({...clientForm,type:t.val})}
                      style={{flex:1,padding:'8px',borderRadius:'8px',border:'1px solid',borderColor:clientForm.type===t.val?'#0a0a0a':'#e8e7e3',background:clientForm.type===t.val?'#0a0a0a':'#fff',color:clientForm.type===t.val?'#fff':'#555',fontSize:'12px',cursor:'pointer'}}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{marginBottom:'14px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#555',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace'}}>MİKTAR</label>
                <input type="number" min="1" value={clientForm.amount||''} onChange={e=>setClientForm({...clientForm,amount:parseInt(e.target.value)||0})} required
                  style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',color:'#0a0a0a'}} />
              </div>
              <div style={{marginBottom:'20px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#555',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace'}}>AÇIKLAMA</label>
                <input type="text" value={clientForm.description} onChange={e=>setClientForm({...clientForm,description:e.target.value})}
                  style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',color:'#0a0a0a'}} />
              </div>
              <button type="submit" disabled={loading}
                style={{width:'100%',padding:'11px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}>
                {loading?'İşleniyor...':'Uygula'}
              </button>
            </form>
          </div>

          <div style={{background:'#fff',border:'1px solid rgba(29,184,29,0.2)',borderRadius:'12px',padding:'28px'}}>
            <div style={{fontSize:'12px',color:'#1db81d',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'8px'}}>KULLANICIYA KREDİ TAHSİS ET</div>
            <p style={{fontSize:'12px',color:'#888',marginBottom:'20px',lineHeight:'1.5'}}>Müşteri havuzundan kullanıcıya kredi tahsis eder. Havuzdan otomatik düşer.</p>
            <form onSubmit={handleUserCredit}>
              <div style={{marginBottom:'14px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#555',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace'}}>KULLANICI</label>
                <select value={userForm.client_user_id} onChange={e=>setUserForm({...userForm,client_user_id:e.target.value})} required
                  style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',background:'#fff',color:'#0a0a0a'}}>
                  <option value="">Seçin</option>
                  {clientUsers.map(cu=>(
                    <option key={cu.id} value={cu.id}>
                      {cu.users?.name} — {cu.clients?.company_name} (Havuz: {cu.clients?.credit_balance} | Kullanıcı: {cu.credit_balance})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{marginBottom:'14px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#555',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace'}}>MİKTAR</label>
                <input type="number" min="1" value={userForm.amount||''} onChange={e=>setUserForm({...userForm,amount:parseInt(e.target.value)||0})} required
                  style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',color:'#0a0a0a'}} />
              </div>
              <div style={{marginBottom:'20px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#555',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace'}}>AÇIKLAMA</label>
                <input type="text" value={userForm.description} onChange={e=>setUserForm({...userForm,description:e.target.value})}
                  style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',color:'#0a0a0a'}} />
              </div>
              <button type="submit" disabled={loading}
                style={{width:'100%',padding:'11px',background:'#1db81d',color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}>
                {loading?'İşleniyor...':'Tahsis Et'}
              </button>
            </form>
          </div>
        </div>

        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
          <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'12px',color:'#888',letterSpacing:'1px',fontFamily:'monospace'}}>SON İŞLEMLER</div>
          {transactions.length === 0 ? (
            <div style={{padding:'32px',textAlign:'center',color:'#888',fontSize:'14px'}}>İşlem yok.</div>
          ) : transactions.map((t,i)=>(
            <div key={t.id} style={{padding:'14px 24px',borderBottom:i<transactions.length-1?'1px solid #f0f0ee':'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>
                  {t.client_users?.users?.name || t.clients?.company_name}
                </div>
                <div style={{fontSize:'12px',color:'#888',marginTop:'2px'}}>
                  {t.description} · {new Date(t.created_at).toLocaleDateString('tr-TR')}
                </div>
              </div>
              <div style={{fontSize:'18px',fontWeight:'300',color:t.amount>0?'#1db81d':'#e24b4a'}}>
                {t.amount>0?'+':''}{t.amount}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
