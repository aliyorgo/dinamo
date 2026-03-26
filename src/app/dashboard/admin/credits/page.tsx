'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const NAV = [{label:'GENEL BAKIŞ',href:'/dashboard/admin'},{label:'KULLANICILAR',href:'/dashboard/admin/users'},{label:'MÜŞTERİLER',href:'/dashboard/admin/clients'},{label:'BRİEFLER',href:'/dashboard/admin/briefs'},{label:'KREDİLER',href:'/dashboard/admin/credits'},{label:'AYARLAR',href:'/dashboard/admin/settings'}]
export default function CreditsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [clientUsers, setClientUsers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ client_id: '', amount: 0, type: 'purchase', description: '' })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: c }, { data: cu }, { data: t }] = await Promise.all([
      supabase.from('clients').select('id, company_name, credit_balance').order('company_name'),
      supabase.from('client_users').select('*, users(name, email), clients(company_name)'),
      supabase.from('credit_transactions').select('*, clients(company_name)').order('created_at', { ascending: false }).limit(20)
    ])
    setClients(c || [])
    setClientUsers(cu || [])
    setTransactions(t || [])
  }

  async function addCredits(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const client = clients.find(c => c.id === form.client_id)
    if (!client) { setMsg('Müşteri bulunamadı.'); setLoading(false); return }
    const newBalance = form.type === 'purchase' 
      ? client.credit_balance + form.amount 
      : client.credit_balance - form.amount

    const { error: updateError } = await supabase
      .from('clients')
      .update({ credit_balance: newBalance })
      .eq('id', form.client_id)

    if (updateError) { setMsg(updateError.message); setLoading(false); return }

    await supabase.from('credit_transactions').insert({
      client_id: form.client_id,
      amount: form.type === 'purchase' ? form.amount : -form.amount,
      type: form.type,
      description: form.description
    })

    setMsg('Kredi işlemi tamamlandı.')
    setForm({ client_id: '', amount: 0, type: 'purchase', description: '' })
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
        <h1 style={{fontSize:'28px',fontWeight:'300',letterSpacing:'-1px',margin:'0 0 40px'}}>Kredi Yönetimi</h1>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'32px'}}>
          <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'28px'}}>
            <div style={{fontSize:'12px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'20px'}}>KREDİ İŞLEMİ</div>
            <form onSubmit={addCredits}>
              <div style={{marginBottom:'16px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#888',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace',textTransform:'uppercase'}}>MÜŞTERİ</label>
                <select value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})} required
                  style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box',background:'#fff'}}>
                  <option value="">Seçin</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.company_name} ({c.credit_balance} kredi)</option>)}
                </select>
              </div>
              <div style={{marginBottom:'16px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#888',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace',textTransform:'uppercase'}}>İŞLEM TİPİ</label>
                <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}
                  style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box',background:'#fff'}}>
                  <option value="purchase">Kredi Ekle</option>
                  <option value="deduct">Kredi Düş</option>
                  <option value="promo">Promosyon</option>
                </select>
              </div>
              <div style={{marginBottom:'16px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#888',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace',textTransform:'uppercase'}}>MİKTAR</label>
                <input type="number" value={form.amount} onChange={e=>setForm({...form,amount:parseInt(e.target.value)})} required min="1"
                  style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box'}} />
              </div>
              <div style={{marginBottom:'20px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#888',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace',textTransform:'uppercase'}}>AÇIKLAMA</label>
                <input type="text" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}
                  style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box'}} />
              </div>
              {msg && <div style={{fontSize:'13px',color:msg.includes('tamamlandı')?'#1db81d':'#e24b4a',marginBottom:'16px'}}>{msg}</div>}
              <button type="submit" disabled={loading}
                style={{width:'100%',padding:'11px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}>
                {loading?'İşlem yapılıyor...':'Uygula'}
              </button>
            </form>
          </div>
          <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
            <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'12px',color:'#888',letterSpacing:'1px',fontFamily:'monospace'}}>MÜŞTERİ BAKİYELERİ</div>
            {clients.map((c,i)=>(
              <div key={c.id} style={{padding:'14px 24px',borderBottom:i<clients.length-1?'1px solid #f0f0ee':'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{fontSize:'14px',fontWeight:'500'}}>{c.company_name}</div>
                <div style={{fontSize:'20px',fontWeight:'300',letterSpacing:'-0.5px'}}>{c.credit_balance}</div>
              </div>
            ))}
            {clients.length===0&&<div style={{padding:'32px',textAlign:'center',color:'#888',fontSize:'14px'}}>Müşteri yok.</div>}
          </div>
        </div>
        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
          <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'12px',color:'#888',letterSpacing:'1px',fontFamily:'monospace'}}>SON İŞLEMLER</div>
          {transactions.length===0?(
            <div style={{padding:'32px',textAlign:'center',color:'#888',fontSize:'14px'}}>İşlem yok.</div>
          ):transactions.map((t,i)=>(
            <div key={t.id} style={{padding:'14px 24px',borderBottom:i<transactions.length-1?'1px solid #f0f0ee':'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:'14px',fontWeight:'500'}}>{t.clients?.company_name}</div>
                <div style={{fontSize:'12px',color:'#888',marginTop:'2px'}}>{t.description||t.type} · {new Date(t.created_at).toLocaleDateString('tr-TR')}</div>
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