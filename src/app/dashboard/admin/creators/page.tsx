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
  {label:'CREATOR\'LAR',href:'/dashboard/admin/creators'},
  {label:'KREDİLER',href:'/dashboard/admin/credits'},
  {label:'AYARLAR',href:'/dashboard/admin/settings'},
]

export default function AdminCreators() {
  const router = useRouter()
  const [creators, setCreators] = useState<any[]>([])
  const [earnings, setEarnings] = useState<Record<string,any[]>>({})
  const [selected, setSelected] = useState<string|null>(null)
  const [paymentForm, setPaymentForm] = useState({ amount_tl: '', note: '' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: c } = await supabase.from('creators').select('*, users(name, email)').eq('is_active', true)
    setCreators(c || [])

    if (c && c.length > 0) {
      const earningsMap: Record<string,any[]> = {}
      for (const creator of c) {
        const { data: e } = await supabase.from('creator_earnings')
          .select('*, briefs(campaign_name)')
          .eq('creator_id', creator.id)
          .order('created_at', { ascending: false })
        earningsMap[creator.id] = e || []
      }
      setEarnings(earningsMap)
    }
  }

  async function handlePayment(creatorId: string) {
    if (!paymentForm.amount_tl) { setMsg('Tutar girin.'); return }
    setLoading(true)
    setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    const amount = parseFloat(paymentForm.amount_tl)

    // Ödeme kaydı oluştur
    const { error } = await supabase.from('creator_payments').insert({
      creator_id: creatorId,
      amount_tl: amount,
      note: paymentForm.note,
      admin_id: user?.id
    })
    if (error) { setMsg('Hata: ' + error.message); setLoading(false); return }

    // Bekleyen kazançları ödendi olarak işaretle (toplam tutara kadar)
    const pending = (earnings[creatorId] || []).filter(e => !e.paid).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    let remaining = amount
    for (const e of pending) {
      if (remaining <= 0) break
      if (Number(e.tl_amount) <= remaining) {
        await supabase.from('creator_earnings').update({ paid: true, paid_at: new Date().toISOString() }).eq('id', e.id)
        remaining -= Number(e.tl_amount)
      }
    }

    setMsg(`${amount.toLocaleString('tr-TR')} ₺ ödeme kaydedildi.`)
    setPaymentForm({ amount_tl: '', note: '' })
    setSelected(null)
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
            <a key={item.href} href={item.href} style={{display:'block',padding:'10px 24px',fontSize:'11px',color:item.href==='/dashboard/admin/creators'?'#fff':'#888',textDecoration:'none',letterSpacing:'1px',fontFamily:'monospace'}}
              onMouseEnter={e=>(e.currentTarget.style.color='#fff')} onMouseLeave={e=>(e.currentTarget.style.color=item.href==='/dashboard/admin/creators'?'#fff':'#888')}>{item.label}</a>
          ))}
        </nav>
      </div>

      <div style={{flex:1,padding:'48px'}}>
        <h1 style={{fontSize:'28px',fontWeight:'300',letterSpacing:'-1px',margin:'0 0 32px',color:'#0a0a0a'}}>Creator Ödemeleri</h1>

        {msg && <div style={{padding:'12px 16px',background:msg.includes('Hata')?'#fef2f2':'#e8f7e8',borderRadius:'8px',fontSize:'13px',color:msg.includes('Hata')?'#e24b4a':'#1db81d',marginBottom:'24px'}}>{msg}</div>}

        <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
          {creators.map(creator => {
            const creatorEarnings = earnings[creator.id] || []
            const totalEarned = creatorEarnings.reduce((s,e)=>s+Number(e.tl_amount),0)
            const pendingAmount = creatorEarnings.filter(e=>!e.paid).reduce((s,e)=>s+Number(e.tl_amount),0)
            const pendingCredits = creatorEarnings.filter(e=>!e.paid).reduce((s,e)=>s+e.credits,0)
            const lifetimeCredits = creatorEarnings.reduce((s,e)=>s+e.credits,0)
            const isSelected = selected === creator.id

            return (
              <div key={creator.id} style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
                <div style={{padding:'20px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}
                  onClick={()=>setSelected(isSelected?null:creator.id)}>
                  <div>
                    <div style={{fontSize:'15px',fontWeight:'500',color:'#0a0a0a'}}>{creator.users?.name}</div>
                    <div style={{fontSize:'13px',color:'#888',marginTop:'2px'}}>{creator.users?.email}</div>
                  </div>
                  <div style={{display:'flex',gap:'24px',alignItems:'center'}}>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'2px'}}>TOPLAM KREDİ</div>
                      <div style={{fontSize:'16px',fontWeight:'300',color:'#0a0a0a'}}>{lifetimeCredits}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'2px'}}>TOPLAM KAZANÇ</div>
                      <div style={{fontSize:'16px',fontWeight:'300',color:'#0a0a0a'}}>{totalEarned.toLocaleString('tr-TR')} ₺</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'2px'}}>BEKLEYEN</div>
                      <div style={{fontSize:'16px',fontWeight:'300',color:pendingAmount>0?'#f59e0b':'#888'}}>{pendingAmount.toLocaleString('tr-TR')} ₺</div>
                    </div>
                    <div style={{fontSize:'18px',color:'#888'}}>{isSelected?'↑':'↓'}</div>
                  </div>
                </div>

                {isSelected && (
                  <div style={{borderTop:'1px solid #f0f0ee',padding:'24px'}}>
                    {pendingAmount > 0 && (
                      <div style={{background:'#f7f6f2',borderRadius:'10px',padding:'20px',marginBottom:'20px'}}>
                        <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>ÖDEME YAP</div>
                        <div style={{fontSize:'14px',color:'#555',marginBottom:'16px'}}>
                          Bekleyen: <strong style={{color:'#0a0a0a'}}>{pendingCredits} kredi = {pendingAmount.toLocaleString('tr-TR')} ₺</strong>
                        </div>
                        <div style={{display:'flex',gap:'12px',flexWrap:'wrap'}}>
                          <input
                            type="number"
                            value={paymentForm.amount_tl}
                            onChange={e=>setPaymentForm({...paymentForm,amount_tl:e.target.value})}
                            placeholder="Tutar (TL)"
                            style={{padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',width:'160px',color:'#0a0a0a'}} />
                          <input
                            type="text"
                            value={paymentForm.note}
                            onChange={e=>setPaymentForm({...paymentForm,note:e.target.value})}
                            placeholder="Not (opsiyonel)"
                            style={{padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',flex:1,color:'#0a0a0a'}} />
                          <button onClick={()=>handlePayment(creator.id)} disabled={loading}
                            style={{padding:'9px 20px',background:'#1db81d',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontWeight:'500',whiteSpace:'nowrap'}}>
                            {loading?'Kaydediliyor...':'Ödeme Yap'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'12px'}}>KAZANÇ DETAYI</div>
                    {creatorEarnings.length === 0 ? (
                      <div style={{fontSize:'13px',color:'#888'}}>Henüz kazanç yok.</div>
                    ) : (
                      <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead>
                          <tr style={{borderBottom:'1px solid #e8e7e3'}}>
                            {['Kampanya','Kredi','TL','Fiyat/Kredi','Durum','Tarih'].map(h=>(
                              <th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:'11px',color:'#888',letterSpacing:'0.5px',fontFamily:'monospace',fontWeight:'400'}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {creatorEarnings.map((e,i)=>(
                            <tr key={e.id} style={{borderBottom:i<creatorEarnings.length-1?'1px solid #f0f0ee':'none'}}>
                              <td style={{padding:'10px 12px',fontSize:'13px',color:'#0a0a0a'}}>{e.briefs?.campaign_name||'—'}</td>
                              <td style={{padding:'10px 12px',fontSize:'13px',color:'#555'}}>{e.credits}</td>
                              <td style={{padding:'10px 12px',fontSize:'13px',color:'#0a0a0a',fontWeight:'500'}}>{Number(e.tl_amount).toLocaleString('tr-TR')} ₺</td>
                              <td style={{padding:'10px 12px',fontSize:'12px',color:'#888'}}>{Number(e.tl_rate).toLocaleString('tr-TR')} ₺</td>
                              <td style={{padding:'10px 12px'}}>
                                <span style={{fontSize:'11px',padding:'3px 8px',borderRadius:'100px',background:e.paid?'#e8f7e8':'#fff7e6',color:e.paid?'#1db81d':'#f59e0b',fontFamily:'monospace'}}>
                                  {e.paid?'Ödendi':'Bekliyor'}
                                </span>
                              </td>
                              <td style={{padding:'10px 12px',fontSize:'12px',color:'#888'}}>{new Date(e.created_at).toLocaleDateString('tr-TR')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
