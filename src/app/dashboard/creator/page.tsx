'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const NAV = [
  {label:'İŞLERİM',href:'/dashboard/creator'},
  {label:'CÜZDAN',href:'/dashboard/creator#wallet'},
]

export default function CreatorDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [creatorId, setCreatorId] = useState('')
  const [jobs, setJobs] = useState<any[]>([])
  const [earnings, setEarnings] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'jobs'|'wallet'>('jobs')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'creator') { router.push('/login'); return }
      setUserName(userData.name)
      const { data: creator } = await supabase.from('creators').select('id').eq('user_id', user.id).single()
      if (!creator) { setLoading(false); return }
      setCreatorId(creator.id)

      // İşler: bu creator'a atanmış briefler
      const { data: pb } = await supabase.from('producer_briefs').select('brief_id').eq('assigned_creator_id', creator.id)
      const briefIds = (pb || []).map((x: any) => x.brief_id)
      if (briefIds.length > 0) {
        const { data: briefs } = await supabase.from('briefs')
          .select('*, clients(company_name)')
          .in('id', briefIds)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
        setJobs(briefs || [])
      }

      // Kazançlar
      const { data: earn } = await supabase.from('creator_earnings')
        .select('*, briefs(campaign_name)')
        .eq('creator_id', creator.id)
        .order('created_at', { ascending: false })
      setEarnings(earn || [])

      // Ödemeler
      const { data: pay } = await supabase.from('creator_payments')
        .select('*')
        .eq('creator_id', creator.id)
        .order('paid_at', { ascending: false })
      setPayments(pay || [])

      setLoading(false)
    }
    load()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const statusLabel: Record<string,string> = {
    submitted:'İnceleniyor', read:'İncelendi', in_production:'Üretimde',
    revision:'Revizyon', approved:'Onay Bekliyor', delivered:'Teslim Edildi'
  }
  const statusColor: Record<string,string> = {
    submitted:'#888', read:'#888', in_production:'#f59e0b',
    revision:'#e24b4a', approved:'#f59e0b', delivered:'#1db81d'
  }

  // Cüzdan hesapları
  const totalCreditsEarned = earnings.reduce((sum,e) => sum + e.credits, 0)
  const totalTlEarned = earnings.reduce((sum,e) => sum + Number(e.tl_amount), 0)
  const totalTlPaid = payments.reduce((sum,p) => sum + Number(p.amount_tl), 0)
  const pendingTl = earnings.filter(e=>!e.paid).reduce((sum,e) => sum + Number(e.tl_amount), 0)
  const pendingCredits = earnings.filter(e=>!e.paid).reduce((sum,e) => sum + e.credits, 0)

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'system-ui,sans-serif',background:'#f7f6f2'}}>
      <div style={{width:'220px',background:'#0a0a0a',padding:'32px 0',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'0 24px 32px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:'20px',fontWeight:'500',color:'#fff'}}>dinamo</div>
          <div style={{fontSize:'11px',color:'#666',marginTop:'4px',letterSpacing:'1px',fontFamily:'monospace'}}>CREATOR</div>
        </div>
        <nav style={{flex:1,padding:'24px 0'}}>
          <button onClick={()=>setActiveTab('jobs')} style={{display:'block',width:'100%',textAlign:'left',padding:'10px 24px',fontSize:'11px',color:activeTab==='jobs'?'#fff':'#888',background:'none',border:'none',cursor:'pointer',letterSpacing:'1px',fontFamily:'monospace'}}>İŞLERİM</button>
          <button onClick={()=>setActiveTab('wallet')} style={{display:'block',width:'100%',textAlign:'left',padding:'10px 24px',fontSize:'11px',color:activeTab==='wallet'?'#fff':'#888',background:'none',border:'none',cursor:'pointer',letterSpacing:'1px',fontFamily:'monospace'}}>CÜZDAN</button>
        </nav>
        <div style={{padding:'24px',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:'13px',color:'#666',marginBottom:'12px'}}>{userName}</div>
          <button onClick={handleLogout} style={{fontSize:'11px',color:'#666',background:'none',border:'none',cursor:'pointer',letterSpacing:'1px',fontFamily:'monospace',padding:0}}>ÇIKIŞ YAP</button>
        </div>
      </div>

      <div style={{flex:1,padding:'48px'}}>
        {loading ? (
          <div style={{color:'#888',fontSize:'14px'}}>Yükleniyor...</div>
        ) : activeTab === 'jobs' ? (
          <>
            <h1 style={{fontSize:'28px',fontWeight:'300',letterSpacing:'-1px',margin:'0 0 32px',color:'#0a0a0a'}}>İşlerim</h1>
            <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
              {jobs.length === 0 ? (
                <div style={{padding:'48px',textAlign:'center',color:'#888',fontSize:'14px'}}>Atanmış iş yok.</div>
              ) : (
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{borderBottom:'1px solid #e8e7e3'}}>
                      {['Kampanya','Marka','Video Tipi','Durum','Tarih'].map(h=>(
                        <th key={h} style={{padding:'12px 20px',textAlign:'left',fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',fontWeight:'400'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job,i)=>(
                      <tr key={job.id} style={{borderBottom:i<jobs.length-1?'1px solid #f0f0ee':'none',cursor:'pointer'}}
                        onClick={()=>router.push(`/dashboard/creator/jobs/${job.id}`)}
                        onMouseEnter={e=>(e.currentTarget.style.background='#fafaf8')}
                        onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                        <td style={{padding:'14px 20px',fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>{job.campaign_name}</td>
                        <td style={{padding:'14px 20px',fontSize:'13px',color:'#555'}}>{job.clients?.company_name||'—'}</td>
                        <td style={{padding:'14px 20px',fontSize:'13px',color:'#555'}}>{job.video_type}</td>
                        <td style={{padding:'14px 20px'}}>
                          <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'100px',background:`${statusColor[job.status]}15`,color:statusColor[job.status],fontFamily:'monospace'}}>
                            {job.status==='revision'?'Müşteri Revizyonu':statusLabel[job.status]||job.status}
                          </span>
                        </td>
                        <td style={{padding:'14px 20px',fontSize:'13px',color:'#555'}}>{new Date(job.created_at).toLocaleDateString('tr-TR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : (
          <>
            <h1 style={{fontSize:'28px',fontWeight:'300',letterSpacing:'-1px',margin:'0 0 32px',color:'#0a0a0a'}}>Cüzdan</h1>

            {/* ÖZET KARTLAR */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px',marginBottom:'32px'}}>
              {[
                {label:'Toplam Kazanılan Kredi',value:totalCreditsEarned,unit:'kredi',color:'#0a0a0a'},
                {label:'Toplam Kazanılan TL',value:`${totalTlEarned.toLocaleString('tr-TR')} ₺`,unit:'',color:'#0a0a0a'},
                {label:'Ödenen TL',value:`${totalTlPaid.toLocaleString('tr-TR')} ₺`,unit:'',color:'#1db81d'},
                {label:'Bekleyen TL',value:`${pendingTl.toLocaleString('tr-TR')} ₺`,unit:'',color:'#f59e0b'},
              ].map(card=>(
                <div key={card.label} style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'20px'}}>
                  <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'8px'}}>{card.label.toUpperCase()}</div>
                  <div style={{fontSize:'24px',fontWeight:'300',letterSpacing:'-1px',color:card.color}}>{card.value} <span style={{fontSize:'13px',color:'#888'}}>{card.unit}</span></div>
                </div>
              ))}
            </div>

            {/* KAZANÇ DETAYI */}
            <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden',marginBottom:'24px'}}>
              <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace'}}>
                KAZANÇ GEÇMİŞİ
              </div>
              {earnings.length === 0 ? (
                <div style={{padding:'32px',textAlign:'center',color:'#888',fontSize:'14px'}}>Henüz kazanç yok.</div>
              ) : (
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{borderBottom:'1px solid #e8e7e3'}}>
                      {['Kampanya','Kredi','TL','Fiyat/Kredi','Durum','Tarih'].map(h=>(
                        <th key={h} style={{padding:'12px 16px',textAlign:'left',fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',fontWeight:'400'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.map((e,i)=>(
                      <tr key={e.id} style={{borderBottom:i<earnings.length-1?'1px solid #f0f0ee':'none'}}>
                        <td style={{padding:'12px 16px',fontSize:'13px',color:'#0a0a0a',fontWeight:'500'}}>{e.briefs?.campaign_name||'—'}</td>
                        <td style={{padding:'12px 16px',fontSize:'13px',color:'#555'}}>{e.credits}</td>
                        <td style={{padding:'12px 16px',fontSize:'13px',color:'#0a0a0a',fontWeight:'500'}}>{Number(e.tl_amount).toLocaleString('tr-TR')} ₺</td>
                        <td style={{padding:'12px 16px',fontSize:'13px',color:'#888'}}>{Number(e.tl_rate).toLocaleString('tr-TR')} ₺/kredi</td>
                        <td style={{padding:'12px 16px'}}>
                          <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'100px',background:e.paid?'#e8f7e8':'#fff7e6',color:e.paid?'#1db81d':'#f59e0b',fontFamily:'monospace'}}>
                            {e.paid?'Ödendi':'Bekliyor'}
                          </span>
                        </td>
                        <td style={{padding:'12px 16px',fontSize:'12px',color:'#888'}}>{new Date(e.created_at).toLocaleDateString('tr-TR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ÖDEME GEÇMİŞİ */}
            {payments.length > 0 && (
              <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
                <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace'}}>
                  ÖDEME GEÇMİŞİ
                </div>
                {payments.map((p,i)=>(
                  <div key={p.id} style={{padding:'14px 24px',borderBottom:i<payments.length-1?'1px solid #f0f0ee':'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>{Number(p.amount_tl).toLocaleString('tr-TR')} ₺</div>
                      {p.note && <div style={{fontSize:'12px',color:'#888',marginTop:'2px'}}>{p.note}</div>}
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
  )
}
