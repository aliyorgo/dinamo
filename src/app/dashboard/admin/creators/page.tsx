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
  {label:'RAPORLAR',href:'/dashboard/admin/reports'},
  {label:'FATURALAR',href:'/dashboard/admin/invoices'},
  {label:'AJANSLAR',href:'/dashboard/admin/agencies'},
  {label:'ANA SAYFA',href:'/dashboard/admin/homepage'},
  {label:'AYARLAR',href:'/dashboard/admin/settings'},
]

export default function AdminCreators() {
  const router = useRouter()
  const [creators, setCreators] = useState<any[]>([])
  const [earnings, setEarnings] = useState<Record<string,any[]>>({})
  const [selected, setSelected] = useState<string|null>(null)
  const [paymentForm, setPaymentForm] = useState({ amount_tl: '', note: '', vat_included: false })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [pendingApplicants, setPendingApplicants] = useState<any[]>([])
  const [authInfo, setAuthInfo] = useState<Record<string,{last_sign_in_at:string|null}>>({})

  function formatLastLogin(d: string|null) {
    if (!d) return 'Henüz giriş yapılmadı'
    return new Date(d).toLocaleString('tr-TR', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
  }

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: c } = await supabase.from('creators').select('*, users(name, email)').eq('is_active', true)
    setCreators(c || [])
    // Load pending applicants
    const { data: pending } = await supabase.from('users').select('*').eq('role', 'creator').eq('status', 'pending').order('created_at', { ascending: false })
    const pendingWithCreator: any[] = []
    for (const u of (pending || [])) {
      const { data: cr } = await supabase.from('creators').select('phone, website').eq('user_id', u.id).maybeSingle()
      pendingWithCreator.push({ ...u, creator: cr })
    }
    setPendingApplicants(pendingWithCreator)

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

      // Fetch last login for active creators + pending applicants
      const allIds = [
        ...(c || []).map((cr:any) => cr.user_id),
        ...(pending || []).map((u:any) => u.id),
      ].filter(Boolean)
      if (allIds.length > 0) {
        const res = await fetch('/api/admin/auth-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: allIds }),
        })
        if (res.ok) setAuthInfo(await res.json())
      }
    }
  }

  async function approveApplicant(userId: string) {
    await supabase.from('users').update({ status: 'active' }).eq('id', userId)
    await supabase.from('creators').update({ is_active: true }).eq('user_id', userId)
    setMsg('Creator onaylandı.')
    loadData()
  }

  async function rejectApplicant(userId: string) {
    if (!confirm('Bu başvuruyu silmek istediğinizden emin misiniz?')) return
    await supabase.from('creators').delete().eq('user_id', userId)
    await supabase.from('users').delete().eq('id', userId)
    setMsg('Başvuru reddedildi.')
    loadData()
  }

  async function handlePayment(creatorId: string) {
    if (!paymentForm.amount_tl) { setMsg('Tutar girin.'); return }
    setLoading(true)
    setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    const grossAmount = parseFloat(paymentForm.amount_tl)
    const creator = creators.find(c => c.id === creatorId)
    const isPersonal = creator?.entity_type === 'personal' || (!creator?.entity_type)
    const taxDeduction = isPersonal ? Math.round(grossAmount * 0.25) : 0
    const netAmount = grossAmount - taxDeduction

    // Ödeme kaydı oluştur
    const vatAmount = paymentForm.vat_included ? Math.round(netAmount * 0.2) : 0
    const { error } = await supabase.from('creator_payments').insert({
      creator_id: creatorId,
      amount_tl: netAmount,
      gross_amount: grossAmount,
      tax_deduction: taxDeduction,
      vat_included: paymentForm.vat_included,
      vat_amount: vatAmount,
      note: paymentForm.note,
      admin_id: user?.id
    })
    if (error) { setMsg('Hata: ' + error.message); setLoading(false); return }

    // Bekleyen kazançları ödendi olarak işaretle (toplam tutara kadar)
    const pending = (earnings[creatorId] || []).filter(e => !e.paid).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    let remaining = grossAmount
    for (const e of pending) {
      if (remaining <= 0) break
      if (Number(e.tl_amount) <= remaining) {
        await supabase.from('creator_earnings').update({ paid: true, paid_at: new Date().toISOString() }).eq('id', e.id)
        remaining -= Number(e.tl_amount)
      }
    }

    setMsg(`${grossAmount.toLocaleString('tr-TR')} ₺ ödeme kaydedildi.`)
    setPaymentForm({ amount_tl: '', note: '', vat_included: false })
    setSelected(null)
    loadData()
    setLoading(false)
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'var(--font-dm-sans),sans-serif',background:'#f7f6f2'}}>
      <div style={{width:'240px',background:'#0A0A0A',padding:'32px 0',display:'flex',flexDirection:'column',flexShrink:0}}>
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

        {pendingApplicants.length > 0 && (
          <div style={{background:'#fff',border:'2px solid #f59e0b',borderRadius:'12px',overflow:'hidden',marginBottom:'24px'}}>
            <div style={{padding:'16px 24px',borderBottom:'1px solid #f0f0ee',display:'flex',alignItems:'center',gap:'8px'}}>
              <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#f59e0b'}}></div>
              <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>Bekleyen Başvurular ({pendingApplicants.length})</div>
            </div>
            {pendingApplicants.map((u, i) => (
              <div key={u.id} style={{padding:'16px 24px',borderBottom:i<pendingApplicants.length-1?'1px solid #f0f0ee':'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>{u.name}</div>
                  <div style={{fontSize:'12px',color:'#888',marginTop:'3px',display:'flex',gap:'10px',flexWrap:'wrap'}}>
                    <span>{u.email}</span>
                    {u.creator?.phone && <span>· {u.creator.phone}</span>}
                    {u.creator?.website && <a href={u.creator.website.startsWith('http')?u.creator.website:`https://${u.creator.website}`} target="_blank" style={{color:'#3b82f6',textDecoration:'none'}}>· {u.creator.website}</a>}
                    <span style={{color:'#aaa'}}>· Son Giriş: {formatLastLogin(authInfo[u.id]?.last_sign_in_at ?? null)}</span>
                  </div>
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  <button onClick={() => approveApplicant(u.id)} style={{padding:'8px 18px',background:'#22c55e',color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontWeight:'500',fontFamily:'var(--font-dm-sans),sans-serif'}}>Onayla</button>
                  <button onClick={() => rejectApplicant(u.id)} style={{padding:'8px 18px',background:'#fff',color:'#ef4444',border:'1px solid #ef4444',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>Reddet</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
          {creators.map(creator => {
            const creatorEarnings = earnings[creator.id] || []
            const totalEarned = creatorEarnings.reduce((s,e)=>s+Number(e.tl_amount),0)
            const pendingAmount = creatorEarnings.filter(e=>!e.paid).reduce((s,e)=>s+Number(e.tl_amount),0)
            const pendingCredits = creatorEarnings.filter(e=>!e.paid).reduce((s,e)=>s+e.credits,0)
            const lifetimeCredits = creatorEarnings.reduce((s,e)=>s+e.credits,0)
            const totalJobs = creatorEarnings.length
            // Performance: count unique briefs with revisions
            const briefIds = [...new Set(creatorEarnings.map(e => e.brief_id))]
            const revisedBriefs = briefIds.filter(bid => creatorEarnings.filter(e => e.brief_id === bid).length > 1).length
            const revisionRate = totalJobs > 0 ? Math.round((revisedBriefs / briefIds.length) * 100) : 0
            const perfColor = revisionRate < 20 ? '#22c55e' : revisionRate < 40 ? '#f59e0b' : '#ef4444'
            const perfLabel = revisionRate < 20 ? 'İyi' : revisionRate < 40 ? 'Orta' : 'Dikkat'
            const isSelected = selected === creator.id

            return (
              <div key={creator.id} style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
                <div style={{padding:'20px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}
                  onClick={()=>setSelected(isSelected?null:creator.id)}>
                  <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                    <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'#22c55e',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:'500',color:'#fff',flexShrink:0}}>
                      {(creator.users?.name || '?').split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{fontSize:'15px',fontWeight:'500',color:'#0a0a0a'}}>{creator.users?.name}</div>
                      <div style={{fontSize:'12px',color:'#888',marginTop:'2px',display:'flex',gap:'10px',flexWrap:'wrap'}}>
                        <span>{creator.users?.email}</span>
                        {creator.phone&&<span>· {creator.phone}</span>}
                        <span style={{color:'#aaa'}}>· Son Giriş: {formatLastLogin(authInfo[creator.user_id]?.last_sign_in_at ?? null)}</span>
                        {creator.entity_type==='company'&&<span style={{color:'#3b82f6'}}>· Şirket</span>}
                        <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'100px',marginLeft:'4px',background:creator.agreement_accepted?'rgba(34,197,94,0.1)':'rgba(245,158,11,0.1)',color:creator.agreement_accepted?'#22c55e':'#f59e0b'}}>{creator.agreement_accepted?'Taahhüt ✓':'Taahhüt Bekleniyor'}</span>
                        {totalJobs > 0 && <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'100px',marginLeft:'4px',background:`${perfColor}15`,color:perfColor}}>{perfLabel} · %{revisionRate} rev.</span>}
                      </div>
                    </div>
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
                    {/* Creator profile info */}
                    <div style={{display:'flex',gap:'24px',marginBottom:'20px',flexWrap:'wrap'}}>
                      {creator.phone&&<div><div style={{fontSize:'10px',color:'#888',letterSpacing:'0.5px',marginBottom:'2px'}}>TELEFON</div><a href={`tel:${creator.phone}`} style={{fontSize:'13px',color:'#0a0a0a',textDecoration:'none'}}>{creator.phone}</a></div>}
                      {creator.iban&&<div><div style={{fontSize:'10px',color:'#888',letterSpacing:'0.5px',marginBottom:'2px'}}>IBAN</div><div style={{fontSize:'13px',color:'#0a0a0a',fontFamily:'monospace'}}>{creator.iban}</div></div>}
                      {creator.entity_type&&<div><div style={{fontSize:'10px',color:'#888',letterSpacing:'0.5px',marginBottom:'2px'}}>TİP</div><div style={{fontSize:'13px',color:'#0a0a0a'}}>{creator.entity_type==='company'?`Şirket${creator.tax_no?' · VN: '+creator.tax_no:''}`:'Şahıs'}</div></div>}
                      {creator.address&&<div><div style={{fontSize:'10px',color:'#888',letterSpacing:'0.5px',marginBottom:'2px'}}>ADRES</div><div style={{fontSize:'13px',color:'#0a0a0a'}}>{creator.address}</div></div>}
                    </div>

                    {pendingAmount > 0 && (() => {
                      const isPersonal = creator.entity_type === 'personal' || (!creator.entity_type)
                      const grossInput = parseFloat(paymentForm.amount_tl) || 0
                      const taxAmount = isPersonal ? Math.round(grossInput * 0.25) : 0
                      const netAmount = grossInput - taxAmount
                      return (
                        <div style={{background:'#f7f6f2',borderRadius:'10px',padding:'20px',marginBottom:'20px'}}>
                          <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>ÖDEME YAP</div>
                          <div style={{fontSize:'14px',color:'#555',marginBottom:'16px'}}>
                            Bekleyen: <strong style={{color:'#0a0a0a'}}>{pendingCredits} kredi = {pendingAmount.toLocaleString('tr-TR')} ₺</strong>
                            {isPersonal && <span style={{fontSize:'12px',color:'#f59e0b',marginLeft:'8px'}}>(Şahıs — %25 stopaj)</span>}
                          </div>
                          <div style={{display:'flex',gap:'12px',flexWrap:'wrap',marginBottom:isPersonal && grossInput > 0 ? '12px' : '0'}}>
                            <input
                              type="number"
                              value={paymentForm.amount_tl}
                              onChange={e=>setPaymentForm({...paymentForm,amount_tl:e.target.value})}
                              placeholder={isPersonal ? 'Brüt tutar (TL)' : 'Tutar (TL)'}
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
                          <div style={{display:'flex',alignItems:'center',gap:'16px',marginTop:'10px',flexWrap:'wrap'}}>
                            <label style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',fontSize:'12px',color:'#555'}}>
                              <input type="checkbox" checked={paymentForm.vat_included} onChange={e=>setPaymentForm({...paymentForm,vat_included:e.target.checked})} style={{accentColor:'#22c55e'}} />
                              KDV'li fatura kesildi
                            </label>
                            {paymentForm.vat_included && netAmount > 0 && (
                              <span style={{fontSize:'11px',color:'#3b82f6'}}>KDV (%20): {Math.round(netAmount * 0.2).toLocaleString('tr-TR')} ₺</span>
                            )}
                          </div>
                          {grossInput > 0 && (
                            <div style={{fontSize:'12px',color:'#555',display:'flex',gap:'16px',marginTop:'8px'}}>
                              {isPersonal && <><span>Brüt: <strong>{grossInput.toLocaleString('tr-TR')} ₺</strong></span><span style={{color:'#ef4444'}}>Stopaj: -{taxAmount.toLocaleString('tr-TR')} ₺</span></>}
                              <span style={{color:'#22c55e'}}>Net ödenecek: <strong>{netAmount.toLocaleString('tr-TR')} ₺</strong></span>
                              {paymentForm.vat_included && <span style={{color:'#3b82f6'}}>+ KDV {Math.round(netAmount * 0.2).toLocaleString('tr-TR')} ₺</span>}
                            </div>
                          )}
                        </div>
                      )
                    })()}

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
