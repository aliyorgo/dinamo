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
  const [tab, setTab] = useState<'jobs'|'wallet'>('jobs')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'creator') { router.push('/login'); return }
      setUserName(userData.name)
      const { data: creator } = await supabase.from('creators').select('id').eq('user_id', user.id).maybeSingle()
      if (!creator) { setLoading(false); return }
      setCreatorId(creator.id)
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
      setLoading(false)
    }
    load()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const totalEarned = earnings.reduce((s,e)=>s+Number(e.tl_amount),0)
  const totalPaid = payments.reduce((s,p)=>s+Number(p.amount_tl),0)
  const pending = earnings.filter(e=>!e.paid).reduce((s,e)=>s+Number(e.tl_amount),0)
  const totalCredits = earnings.reduce((s,e)=>s+e.credits,0)

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');`}</style>

      <div style={{width:'220px',background:'#111113',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'15px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'12px'}}>
            dinam<span style={{display:'inline-block',width:'9px',height:'9px',borderRadius:'50%',border:'2px solid #22c55e',position:'relative',top:'1px'}}></span>
          </div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'3px'}}>Creator</div>
          <div style={{fontSize:'13px',fontWeight:'500',color:'#fff'}}>{userName}</div>
        </div>

        <nav style={{padding:'10px 8px',flex:1}}>
          {[
            {val:'jobs',label:'İşlerim'},
            {val:'wallet',label:'Cüzdan'},
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
          <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>{tab==='jobs'?'İşlerim':'Cüzdan'}</div>
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
          ) : (
            <>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'28px'}}>
                {[
                  {label:'Toplam Kredi',value:totalCredits+' kredi'},
                  {label:'Toplam Kazanç',value:totalEarned.toLocaleString('tr-TR')+' ₺'},
                  {label:'Ödenen',value:totalPaid.toLocaleString('tr-TR')+' ₺'},
                  {label:'Bekleyen',value:pending.toLocaleString('tr-TR')+' ₺'},
                ].map(card=>(
                  <div key={card.label} style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px'}}>
                    <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'8px'}}>{card.label}</div>
                    <div style={{fontSize:'20px',fontWeight:'300',color:'#0a0a0a',letterSpacing:'-0.5px'}}>{card.value}</div>
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
                      <div style={{fontSize:'15px',fontWeight:'300',color:'#0a0a0a'}}>{Number(e.tl_amount).toLocaleString('tr-TR')} ₺</div>
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
                        <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{Number(p.amount_tl).toLocaleString('tr-TR')} ₺</div>
                        {p.note&&<div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>{p.note}</div>}
                      </div>
                      <div style={{fontSize:'12px',color:'#888'}}>{new Date(p.paid_at).toLocaleDateString('tr-TR')}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
