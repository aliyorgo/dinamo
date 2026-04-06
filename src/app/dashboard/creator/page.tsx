'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string,string> = {
  submitted:'İnceleniyor', read:'İncelendi', in_production:'Üretimde',
  revision:'Müşteri Revizyonu', approved:'Onay Bekliyor', delivered:'Teslim Edildi'
}
const statusColor: Record<string,string> = {
  submitted:'#888', read:'#888', in_production:'#3b82f6',
  revision:'#ef4444', approved:'#f59e0b', delivered:'#22c55e'
}

export default function CreatorDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [creatorId, setCreatorId] = useState('')
  const [jobs, setJobs] = useState<any[]>([])
  const [earnings, setEarnings] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [tab, setTab] = useState<'jobs'|'wallet'|'profile'>('jobs')
  const [loading, setLoading] = useState(true)
  const [creditRate, setCreditRate] = useState(0)
  const [profile, setProfile] = useState({ phone:'', iban:'', entity_type:'personal' as 'personal'|'company', tax_no:'', address:'' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [showAgreement, setShowAgreement] = useState(false)
  const [agreementChecked, setAgreementChecked] = useState(false)
  const [agreementAccepted, setAgreementAccepted] = useState(false)
  const [agreementDate, setAgreementDate] = useState<string|null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'creator') { router.push('/login'); return }
      setUserName(userData.name)
      const { data: creator } = await supabase.from('creators').select('*').eq('user_id', user.id).maybeSingle()
      if (!creator) { setLoading(false); return }
      setCreatorId(creator.id)
      setProfile({ phone: creator.phone||'', iban: creator.iban||'', entity_type: creator.entity_type||'personal', tax_no: creator.tax_no||'', address: creator.address||'' })
      if (creator.agreement_accepted) { setAgreementAccepted(true); setAgreementDate(creator.agreement_accepted_at || null) }
      else { setShowAgreement(true) }
      // Redirect to profile if incomplete
      if (!creator.phone || !creator.iban) { setTab('profile'); setLoading(false); setProfileMsg('Lütfen önce profilinizi tamamlayın.') }
      const { data: pb } = await supabase.from('producer_briefs').select('brief_id').eq('assigned_creator_id', creator.id)
      const briefIds = (pb || []).map((x:any) => x.brief_id)
      if (briefIds.length > 0) {
        const { data: b } = await supabase.from('briefs').select('*, clients(company_name)').in('id', briefIds).neq('status','cancelled').order('created_at', { ascending: false })
        setJobs(b || [])
      }
      const { data: e } = await supabase.from('creator_earnings').select('*, briefs(campaign_name)').eq('creator_id', creator.id).order('created_at', { ascending: false })
      setEarnings(e || [])
      const { data: p } = await supabase.from('creator_payments').select('*').eq('creator_id', creator.id).order('paid_at', { ascending: false })
      setPayments(p || [])
      const { data: st } = await supabase.from('admin_settings').select('*').eq('key', 'creator_credit_rate').maybeSingle()
      if (st) setCreditRate(Number(st.value) || 0)
      setLoading(false)
    }
    load()
  }, [router])

  async function handleAgreementAccept() {
    const now = new Date().toISOString()
    await supabase.from('creators').update({ agreement_accepted: true, agreement_accepted_at: now }).eq('id', creatorId)
    setAgreementAccepted(true)
    setAgreementDate(now)
    setShowAgreement(false)
  }

  async function handleProfileSave() {
    setProfileSaving(true); setProfileMsg('')
    const { error } = await supabase.from('creators').update({
      phone: profile.phone||null, iban: profile.iban||null,
      entity_type: profile.entity_type, tax_no: profile.entity_type==='company'?profile.tax_no||null:null,
      address: profile.address||null,
    }).eq('id', creatorId)
    setProfileMsg(error ? 'Hata: '+error.message : 'Kaydedildi.')
    setProfileSaving(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isIndividual = profile.entity_type === 'personal'
  const taxRate = isIndividual ? 0.25 : 0
  const totalEarned = earnings.reduce((s,e)=>s+Number(e.tl_amount),0)
  const totalTax = Math.round(totalEarned * taxRate)
  const totalNet = totalEarned - totalTax
  const totalPaid = payments.reduce((s,p)=>s+Number(p.amount_tl),0)
  const pendingGross = earnings.filter(e=>!e.paid).reduce((s,e)=>s+Number(e.tl_amount),0)
  const pendingTax = Math.round(pendingGross * taxRate)
  const pendingNet = pendingGross - pendingTax
  const totalCredits = earnings.reduce((s,e)=>s+e.credits,0)

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');`}</style>

      <div style={{width:'220px',background:'#111113',display:'flex',flexDirection:'column',flexShrink:0,height:'100vh',position:'sticky',top:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'18px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'12px'}}>
            dinam<span style={{display:'inline-block',width:'11px',height:'11px',borderRadius:'50%',border:'2.5px solid #22c55e',position:'relative',top:'1px'}}></span>
          </div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'3px'}}>Creator</div>
          <div style={{fontSize:'13px',fontWeight:'500',color:'#fff'}}>{userName}</div>
        </div>

        {creditRate > 0 && (
          <div style={{padding:'12px 16px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
            <div style={{background:'rgba(34,197,94,0.1)',border:'0.5px solid rgba(34,197,94,0.2)',borderRadius:'8px',padding:'10px 12px'}}>
              <div style={{fontSize:'9px',color:'rgba(34,197,94,0.7)',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'4px'}}>Kredi Başına Kazanç</div>
              <div style={{fontSize:'22px',fontWeight:'300',color:'#22c55e',letterSpacing:'-1px'}}>
                {creditRate.toLocaleString('tr-TR')} <span style={{fontSize:'12px',fontWeight:'400'}}>₺</span>
              </div>
              <div style={{fontSize:'9px',color:'rgba(34,197,94,0.5)',marginTop:'2px'}}>1 kredi = {creditRate.toLocaleString('tr-TR')} ₺</div>
            </div>
          </div>
        )}

        <nav style={{padding:'10px 8px',flex:1}}>
          {[
            {val:'jobs',label:'İşlerim'},
            {val:'wallet',label:'Cüzdan'},
            {val:'profile',label:'Profil'},
          ].map(item=>(
            <button key={item.val} onClick={()=>setTab(item.val as any)}
              style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',background:tab===item.val?'rgba(255,255,255,0.08)':'transparent',marginBottom:'1px',width:'100%',border:'none',fontFamily:'Inter,sans-serif'}}>
              <span style={{fontSize:'12px',color:tab===item.val?'#fff':'rgba(255,255,255,0.4)',fontWeight:tab===item.val?'500':'400'}}>{item.label}</span>
            </button>
          ))}
        </nav>

        <div style={{padding:'10px 8px',borderTop:'0.5px solid rgba(255,255,255,0.07)'}}>
          <button onClick={handleLogout} style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',borderRadius:'7px',cursor:'pointer',width:'100%',background:'none',border:'none'}}>
            <span style={{fontSize:'11px',color:'rgba(255,255,255,0.25)',fontFamily:'Inter,sans-serif'}}>Çıkış yap</span>
          </button>
        </div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f5f4f0',overflow:'hidden'}}>
        <div style={{padding:'14px 28px',background:'#fff',borderBottom:'0.5px solid rgba(0,0,0,0.08)',flexShrink:0}}>
          <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>{tab==='jobs'?'İşlerim':tab==='wallet'?'Cüzdan':'Profil'}</div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'20px 28px'}}>
          {loading ? <div style={{color:'#888',fontSize:'14px'}}>Yükleniyor...</div> : tab==='jobs' ? (
            jobs.length === 0 ? (
              <div style={{textAlign:'center',padding:'60px 0',color:'#888',fontSize:'14px'}}>Atanmış iş yok.</div>
            ) : jobs.map(job=>(
              <div key={job.id} onClick={()=>router.push(`/dashboard/creator/jobs/${job.id}`)}
                style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px 20px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}
                onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.2)')}
                onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.1)')}>
                <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
                  <div style={{width:'8px',height:'8px',borderRadius:'50%',background:statusColor[job.status],flexShrink:0}}></div>
                  <div>
                    <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>{job.campaign_name}</div>
                    <div style={{fontSize:'12px',color:'#888',marginTop:'3px'}}>{job.clients?.company_name} · {job.video_type}</div>
                  </div>
                </div>
                <div style={{fontSize:'11px',padding:'4px 12px',borderRadius:'100px',background:`${statusColor[job.status]}15`,color:statusColor[job.status],fontWeight:'500'}}>
                  {statusLabel[job.status]||job.status}
                </div>
              </div>
            ))
          ) : tab==='wallet' ? (
            <>
              {isIndividual && (
                <div style={{background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:'10px',padding:'12px 16px',marginBottom:'16px',fontSize:'12px',color:'#92400e',lineHeight:1.6}}>
                  Şahıs olarak çalıştığınız için ödemelerinizde %25 stopaj kesintisi uygulanmaktadır.
                </div>
              )}
              <div style={{display:'grid',gridTemplateColumns:isIndividual?'repeat(5,1fr)':'repeat(4,1fr)',gap:'12px',marginBottom:'28px'}}>
                {[
                  {label:'Brüt Kazanç',value:totalEarned.toLocaleString('tr-TR')+' ₺',color:'#0a0a0a'},
                  ...(isIndividual?[{label:'Stopaj (%25)',value:'-'+totalTax.toLocaleString('tr-TR')+' ₺',color:'#ef4444'}]:[]),
                  {label:isIndividual?'Net Kazanç':'Toplam Kazanç',value:(isIndividual?totalNet:totalEarned).toLocaleString('tr-TR')+' ₺',color:'#0a0a0a'},
                  {label:'Ödenen',value:totalPaid.toLocaleString('tr-TR')+' ₺',color:'#22c55e'},
                  {label:'Bekleyen',value:(isIndividual?pendingNet:pendingGross).toLocaleString('tr-TR')+' ₺',color:pendingGross>0?'#f59e0b':'#888'},
                ].map(card=>(
                  <div key={card.label} style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px'}}>
                    <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'8px'}}>{card.label}</div>
                    <div style={{fontSize:'20px',fontWeight:'300',color:card.color,letterSpacing:'-0.5px'}}>{card.value}</div>
                  </div>
                ))}
              </div>

              <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',overflow:'hidden',marginBottom:'20px'}}>
                <div style={{padding:'14px 20px',borderBottom:'0.5px solid rgba(0,0,0,0.08)',fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Kazanç Geçmişi</div>
                {earnings.length===0 ? (
                  <div style={{padding:'32px',textAlign:'center',color:'#888',fontSize:'14px'}}>Henüz kazanç yok.</div>
                ) : earnings.map((e,i)=>(
                  <div key={e.id} style={{padding:'14px 20px',borderBottom:i<earnings.length-1?'0.5px solid rgba(0,0,0,0.06)':'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{e.briefs?.campaign_name||'—'}</div>
                      <div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>{e.credits} kredi · {Number(e.tl_rate).toLocaleString('tr-TR')} ₺/kredi · {new Date(e.created_at).toLocaleDateString('tr-TR')}</div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:'15px',fontWeight:'300',color:'#0a0a0a'}}>{Number(e.tl_amount).toLocaleString('tr-TR')} ₺</div>
                        {isIndividual && <div style={{fontSize:'10px',color:'#ef4444',marginTop:'1px'}}>net {Math.round(Number(e.tl_amount)*0.75).toLocaleString('tr-TR')} ₺</div>}
                      </div>
                      <span style={{fontSize:'10px',padding:'3px 8px',borderRadius:'100px',background:e.paid?'rgba(34,197,94,0.1)':'rgba(245,158,11,0.1)',color:e.paid?'#22c55e':'#f59e0b'}}>{e.paid?'Ödendi':'Bekliyor'}</span>
                    </div>
                  </div>
                ))}
              </div>

              {payments.length>0&&(
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',overflow:'hidden'}}>
                  <div style={{padding:'14px 20px',borderBottom:'0.5px solid rgba(0,0,0,0.08)',fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Ödeme Geçmişi</div>
                  {payments.map((p,i)=>(
                    <div key={p.id} style={{padding:'14px 20px',borderBottom:i<payments.length-1?'0.5px solid rgba(0,0,0,0.06)':'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                          <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{Number(p.amount_tl).toLocaleString('tr-TR')} ₺</div>
                          {p.vat_included&&<span style={{fontSize:'9px',padding:'2px 6px',borderRadius:'100px',background:'rgba(59,130,246,0.1)',color:'#3b82f6',fontWeight:'500'}}>KDV dahil</span>}
                        </div>
                        {p.note&&<div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>{p.note}</div>}
                      </div>
                      <div style={{fontSize:'12px',color:'#888'}}>{new Date(p.paid_at).toLocaleDateString('tr-TR')}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* PROFILE TAB */
            <div style={{maxWidth:'480px'}}>
              <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'24px',marginBottom:'16px'}}>
                <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'20px'}}>Kişisel Bilgiler</div>
                <div style={{marginBottom:'16px'}}>
                  <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'6px'}}>Ad Soyad</div>
                  <div style={{fontSize:'14px',color:'#0a0a0a',fontWeight:'500'}}>{userName}</div>
                </div>
                <div style={{marginBottom:'16px'}}>
                  <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'6px'}}>Telefon</div>
                  <input value={profile.phone} onChange={e=>setProfile({...profile,phone:e.target.value})} placeholder="05XX XXX XXXX"
                    style={{width:'100%',boxSizing:'border-box',padding:'9px 13px',border:'0.5px solid rgba(0,0,0,0.12)',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a',fontFamily:'Inter,sans-serif',outline:'none'}} />
                </div>
                <div style={{marginBottom:'16px'}}>
                  <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'6px'}}>IBAN</div>
                  <input value={profile.iban} onChange={e=>setProfile({...profile,iban:e.target.value})} placeholder="TR..."
                    style={{width:'100%',boxSizing:'border-box',padding:'9px 13px',border:'0.5px solid rgba(0,0,0,0.12)',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a',fontFamily:'Inter,sans-serif',outline:'none'}} />
                </div>
                <div style={{marginBottom:'16px'}}>
                  <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'8px'}}>Fatura Tipi</div>
                  <div style={{display:'flex',gap:'8px'}}>
                    {([['personal','Şahıs'],['company','Şirket']] as const).map(([val,label])=>(
                      <button key={val} onClick={()=>setProfile({...profile,entity_type:val})}
                        style={{flex:1,padding:'9px',borderRadius:'8px',border:'1px solid',borderColor:profile.entity_type===val?'#111113':'rgba(0,0,0,0.12)',background:profile.entity_type===val?'#111113':'#fff',color:profile.entity_type===val?'#fff':'#555',fontSize:'12px',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:'500'}}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {profile.entity_type==='company'&&(
                  <div style={{marginBottom:'16px'}}>
                    <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'6px'}}>Vergi No</div>
                    <input value={profile.tax_no} onChange={e=>setProfile({...profile,tax_no:e.target.value})} placeholder="Vergi numarası"
                      style={{width:'100%',boxSizing:'border-box',padding:'9px 13px',border:'0.5px solid rgba(0,0,0,0.12)',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a',fontFamily:'Inter,sans-serif',outline:'none'}} />
                  </div>
                )}
                <div style={{marginBottom:'20px'}}>
                  <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'6px'}}>Adres</div>
                  <textarea value={profile.address} onChange={e=>setProfile({...profile,address:e.target.value})} placeholder="Açık adres" rows={3}
                    style={{width:'100%',boxSizing:'border-box',padding:'9px 13px',border:'0.5px solid rgba(0,0,0,0.12)',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a',fontFamily:'Inter,sans-serif',outline:'none',resize:'vertical'}} />
                </div>
                {profileMsg&&<div style={{fontSize:'12px',color:profileMsg.includes('Hata')?'#ef4444':'#22c55e',marginBottom:'12px'}}>{profileMsg}</div>}
                <button onClick={handleProfileSave} disabled={profileSaving}
                  style={{padding:'10px 24px',background:'#111113',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:'500'}}>
                  {profileSaving?'Kaydediliyor...':'Kaydet'}
                </button>
              </div>
              {/* Agreement Status */}
              <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px'}}>
                <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'12px'}}>Taahhütname</div>
                {agreementAccepted ? (
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <span style={{fontSize:'10px',padding:'4px 12px',borderRadius:'100px',background:'rgba(34,197,94,0.1)',color:'#22c55e',fontWeight:'500'}}>Onaylandı ✓</span>
                    {agreementDate && <span style={{fontSize:'11px',color:'#888'}}>{new Date(agreementDate).toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'})}</span>}
                  </div>
                ) : (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span style={{fontSize:'12px',color:'#f59e0b'}}>Henüz onaylanmadı</span>
                    <button onClick={()=>setShowAgreement(true)} style={{padding:'7px 16px',background:'#111113',color:'#fff',border:'none',borderRadius:'8px',fontSize:'11px',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Taahhütnameyi Oku</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AGREEMENT MODAL */}
      {showAgreement && (
        <div style={{position:'fixed',inset:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}}>
          <div style={{background:'#fff',borderRadius:'16px',width:'100%',maxWidth:'560px',maxHeight:'90vh',display:'flex',flexDirection:'column',margin:'24px'}}>
            <div style={{padding:'24px 28px',borderBottom:'0.5px solid rgba(0,0,0,0.08)',flexShrink:0}}>
              <div style={{fontSize:'18px',fontWeight:'500',color:'#0a0a0a'}}>Dinamo Creator Taahhütnamesi</div>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'24px 28px',fontSize:'13px',color:'#333',lineHeight:1.8}}>
              <p style={{marginBottom:'16px'}}>Dinamo platformu üzerinden gerçekleştireceğim tüm prodüksiyon çalışmalarında aşağıdaki koşulları kabul ettiğimi beyan ederim.</p>
              <p style={{marginBottom:'8px'}}><strong>TELİF HAKLARI:</strong> Ürettiğim içeriklerde telif hakkı koruması altındaki hiçbir görsel, ses, müzik veya materyali izinsiz kullanmayacağımı taahhüt ederim. Stok görüntü, fotoğraf veya video kullanmam halinde yalnızca ticari kullanıma uygun, lisansı bana ait kaynaklardan yararlanacağımı kabul ederim.</p>
              <p style={{marginBottom:'8px'}}><strong>YAPAY ZEKA ARAÇLARI:</strong> AI ile ürettiğim tüm görsel ve ses içeriklerinde yalnızca ticari kullanıma izin veren ve sektörde saygınlığı kabul görmüş platformları kullanacağımı taahhüt ederim. Kullandığım promptların tamamen bana ait olduğunu, başkasına ait içerik veya promptları kopyalamayacağımı beyan ederim.</p>
              <p style={{marginBottom:'8px'}}><strong>GİZLİLİK:</strong> Müşteri bilgilerini, brief içeriklerini ve platform üzerinden edindiğim tüm ticari bilgileri gizli tutacağımı, üçüncü şahıslarla paylaşmayacağımı taahhüt ederim.</p>
              <p style={{marginBottom:'8px'}}><strong>PLATFORM DIŞI İLETİŞİM:</strong> Müşterilerle platform dışında ticari ilişki kurmayacağımı, iş anlaşmazlıklarını öncelikle Dinamo ekibi aracılığıyla çözmeye çalışacağımı kabul ederim.</p>
              <p><strong>SORUMLULUK:</strong> Bu taahhütname kapsamındaki yükümlülüklerimi yerine getirmediğim durumlarda doğabilecek hukuki ve mali sorumluluğun tarafıma ait olduğunu, DCC Film Yapım San. ve Tic. Ltd. Şti.'nin bu tür ihlallerden kaynaklanan üçüncü taraf taleplerine karşı sorumlu tutulamayacağını kabul ederim.</p>
            </div>
            <div style={{padding:'20px 28px',borderTop:'0.5px solid rgba(0,0,0,0.08)',flexShrink:0}}>
              <label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',marginBottom:'16px'}}>
                <input type="checkbox" checked={agreementChecked} onChange={e=>setAgreementChecked(e.target.checked)} style={{accentColor:'#22c55e',width:'18px',height:'18px'}} />
                <span style={{fontSize:'13px',color:'#0a0a0a'}}>Yukarıdaki taahhütnameyi okudum ve kabul ediyorum</span>
              </label>
              <button onClick={handleAgreementAccept} disabled={!agreementChecked}
                style={{width:'100%',padding:'13px',background:agreementChecked?'#22c55e':'#ccc',color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:'500',cursor:agreementChecked?'pointer':'not-allowed',fontFamily:'Inter,sans-serif',transition:'background 0.2s'}}>
                Onaylıyorum
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
