'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string,string> = {
  submitted:'Yeni', read:'Okundu', in_production:'Üretimde',
  revision:'Revizyon', approved:'Onay Bekliyor', delivered:'Teslim Edildi', cancelled:'İptal'
}
const statusColor: Record<string,string> = {
  submitted:'#22c55e', read:'#888', in_production:'#3b82f6',
  revision:'#ef4444', approved:'#f59e0b', delivered:'#888', cancelled:'#555'
}

const NAV = [
  {label:'Genel Bakış',href:'/dashboard/admin'},
  {label:'Kullanıcılar',href:'/dashboard/admin/users'},
  {label:'Müşteriler',href:'/dashboard/admin/clients'},
  {label:'Briefler',href:'/dashboard/admin/briefs'},
  {label:"Creator'lar",href:'/dashboard/admin/creators'},
  {label:'Kredi Yönetimi',href:'/dashboard/admin/credits'},
  {label:'Raporlar',href:'/dashboard/admin/reports'},
  {label:'Faturalar',href:'/dashboard/admin/invoices'},
  {label:'Ajanslar',href:'/dashboard/admin/agencies'},
  {label:'Ana Sayfa',href:'/dashboard/admin/homepage'},
  {label:'Ayarlar',href:'/dashboard/admin/settings'},
]

export default function AdminDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [briefs, setBriefs] = useState<any[]>([])
  const [stats, setStats] = useState({ total:0, new:0, inProd:0, revision:0, delivered:0 })
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [demoCount, setDemoCount] = useState(0)
  const [unansweredCount, setUnansweredCount] = useState(0)
  const [approvalCount, setApprovalCount] = useState(0)
  const [overdueBriefs, setOverdueBriefs] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'admin') { router.push('/login'); return }
      setUserName(userData.name)
      const { data: b } = await supabase.from('briefs').select('*, clients(company_name)').neq('status','cancelled').order('created_at', { ascending: false })
      const allBriefs = b || []
      setBriefs(allBriefs)
      setStats({
        total: allBriefs.length,
        new: allBriefs.filter(x=>x.status==='submitted').length,
        inProd: allBriefs.filter(x=>x.status==='in_production').length,
        revision: allBriefs.filter(x=>x.status==='revision').length,
        delivered: allBriefs.filter(x=>x.status==='delivered').length,
      })
      const { count } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'creator').eq('status', 'pending')
      setPendingCount(count || 0)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { count: dc } = await supabase.from('demo_requests').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo)
      setDemoCount(dc || 0)
      // Unanswered questions
      const { count: uq } = await supabase.from('brief_questions').select('id', { count: 'exact', head: true }).is('answer', null)
      setUnansweredCount(uq || 0)
      // Videos awaiting admin approval
      const { count: ac } = await supabase.from('video_submissions').select('id', { count: 'exact', head: true }).eq('status', 'producer_approved')
      setApprovalCount(ac || 0)
      // Overdue briefs (48h+ in submitted/in_production)
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const overdue = allBriefs.filter(br => ['submitted','read','in_production'].includes(br.status) && br.created_at < fortyEightHoursAgo)
      setOverdueBriefs(overdue)
      setLoading(false)
    }
    load()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"var(--font-dm-sans),'DM Sans',system-ui,sans-serif"}}>

      <div className="dinamo-sidebar">
        <div style={{padding:'20px 24px 16px'}}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{height:'28px'}} />
        </div>
        <div className="dinamo-user-block">
          <div className="dinamo-user-company">Admin</div>
          <div className="dinamo-user-name">{userName}</div>
        </div>

        <nav style={{flex:1}}>
          {NAV.map(item=>(
            <div key={item.href} onClick={()=>router.push(item.href)}
              className={`dinamo-nav-link${item.href==='/dashboard/admin'?' active':''}`}>
              {item.label}
            </div>
          ))}
        </nav>

        <button onClick={handleLogout} className="dinamo-signout">Çıkış Yap</button>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f5f4f0',overflow:'hidden'}}>
        <div style={{padding:'14px 28px',background:'#fff',borderBottom:'0.5px solid rgba(0,0,0,0.08)',flexShrink:0}}>
          <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>Genel Bakış</div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>
          {loading ? <div style={{color:'rgba(255,255,255,0.4)',fontSize:'14px'}}>Yükleniyor...</div> : (
            <>
              {/* BUGÜN YAPILACAKLAR */}
              {(approvalCount > 0 || unansweredCount > 0 || pendingCount > 0 || demoCount > 0) && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',overflow:'hidden',marginBottom:'20px'}}>
                  <div style={{padding:'12px 20px',borderBottom:'0.5px solid rgba(0,0,0,0.06)',fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Bugün Yapılacaklar</div>
                  {[
                    approvalCount > 0 ? { label: `${approvalCount} video onay bekliyor`, href: '/dashboard/admin/briefs', color: '#ef4444', urgent: true } : null,
                    unansweredCount > 0 ? { label: `${unansweredCount} cevaplanmamış müşteri sorusu`, href: '/dashboard/admin/briefs', color: '#f59e0b', urgent: false } : null,
                    demoCount > 0 ? { label: `${demoCount} yeni demo talebi (son 7 gün)`, href: '/dashboard/admin/users', color: '#3b82f6', urgent: false } : null,
                    pendingCount > 0 ? { label: `${pendingCount} bekleyen creator başvurusu`, href: '/dashboard/admin/creators', color: '#f59e0b', urgent: false } : null,
                  ].filter(Boolean).map((item: any) => (
                    <div key={item.label} onClick={() => router.push(item.href)}
                      style={{ padding: '10px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafaf8')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: item.color, flexShrink: 0 }}></div>
                        <div style={{ fontSize: '13px', color: '#0a0a0a' }}>{item.label}</div>
                      </div>
                      <div style={{ fontSize: '11px', color: item.color }}>→</div>
                    </div>
                  ))}
                </div>
              )}

              {/* OVERDUE ALERTS */}
              {overdueBriefs.length > 0 && (
                <div style={{background:'#fff',border:'2px solid #ef4444',borderRadius:'12px',overflow:'hidden',marginBottom:'20px'}}>
                  <div style={{padding:'12px 20px',borderBottom:'0.5px solid rgba(0,0,0,0.06)',fontSize:'12px',fontWeight:'500',color:'#ef4444'}}>Geciken İşler</div>
                  {overdueBriefs.map(b => {
                    const daysLate = Math.floor((Date.now() - new Date(b.created_at).getTime()) / 86400000)
                    return (
                      <div key={b.id} onClick={() => router.push(`/dashboard/admin/briefs/${b.id}`)}
                        style={{ padding: '10px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{b.campaign_name}</div>
                          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{b.clients?.company_name} · {statusLabel[b.status]}</div>
                        </div>
                        <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: '500' }}>{daysLate} gün gecikmiş</div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'12px',marginBottom:'28px'}}>
                {[
                  {label:'Toplam',value:stats.total},
                  {label:'Yeni Brief',value:stats.new,color:'#22c55e'},
                  {label:'Üretimde',value:stats.inProd,color:'#3b82f6'},
                  {label:'Revizyon',value:stats.revision,color:'#ef4444'},
                  {label:'Tamamlanan',value:stats.delivered,color:'rgba(255,255,255,0.4)'},
                ].map(card=>(
                  <div key={card.label} style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px'}}>
                    <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'8px'}}>{card.label}</div>
                    <div style={{fontSize:'28px',fontWeight:'300',color:card.color||'#0a0a0a',letterSpacing:'-1px'}}>{card.value}</div>
                  </div>
                ))}
              </div>

              <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',overflow:'hidden'}}>
                <div style={{padding:'14px 20px',borderBottom:'0.5px solid rgba(0,0,0,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Tüm Briefler</div>
                  <div onClick={()=>router.push('/dashboard/admin/briefs')} style={{fontSize:'12px',color:'#3b82f6',cursor:'pointer'}}>Tümünü gör →</div>
                </div>
                {briefs.slice(0,10).map((b,i)=>(
                  <div key={b.id} onClick={()=>router.push(`/dashboard/admin/briefs/${b.id}`)}
                    style={{padding:'14px 20px',borderBottom:i<Math.min(briefs.length,10)-1?'0.5px solid rgba(0,0,0,0.06)':'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='#fafaf8')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                      <div style={{width:'7px',height:'7px',borderRadius:'50%',background:statusColor[b.status],flexShrink:0}}></div>
                      <div>
                        <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{b.campaign_name}</div>
                        <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginTop:'2px'}}>{b.clients?.company_name} · {b.video_type} · {new Date(b.created_at).toLocaleDateString('tr-TR')}</div>
                      </div>
                    </div>
                    <div style={{fontSize:'11px',padding:'3px 10px',borderRadius:'100px',background:`${statusColor[b.status]}15`,color:statusColor[b.status]}}>
                      {b.status==='revision'?'Müşteri Revizyonu':statusLabel[b.status]||b.status}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
