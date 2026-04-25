'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import CountUp from 'react-countup'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string,string> = {
  submitted:'Yeni', read:'Okundu', in_production:'Üretimde',
  revision:'Revizyon', approved:'Onay Bekliyor', delivered:'Teslim Edildi', cancelled:'İptal'
}
const statusColor: Record<string,string> = {
  submitted:'#22c55e', read:'#888', in_production:'#3b82f6',
  revision:'#ef4444', approved:'#f59e0b', delivered:'#888', cancelled:'#555'
}


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
  const [activityLogs, setActivityLogs] = useState<any[]>([])

  async function loadLogs() {
    const { data: logs } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(15)
    setActivityLogs(logs || [])
  }

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
      const { count: uq } = await supabase.from('brief_questions').select('id', { count: 'exact', head: true }).is('answer', null)
      setUnansweredCount(uq || 0)
      const { count: ac } = await supabase.from('video_submissions').select('id', { count: 'exact', head: true }).eq('status', 'producer_approved')
      setApprovalCount(ac || 0)
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const overdue = allBriefs.filter(br => ['submitted','read','in_production'].includes(br.status) && br.created_at < fortyEightHoursAgo)
      setOverdueBriefs(overdue)
      await loadLogs()
      setLoading(false)
    }
    load()
  }, [router])

  // Auto-refresh activity logs every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadLogs, 30000)
    return () => clearInterval(interval)
  }, [])


  return (
    <div style={{display:'flex',flexDirection:'column'}}>
        <div style={{padding:'14px 28px',background:'#fff',borderBottom:'1px solid var(--color-border-tertiary)',flexShrink:0}}>
          <div style={{fontSize:'11px',letterSpacing:'2px',textTransform:'uppercase',fontWeight:'500',color:'var(--color-text-secondary)'}}>ADMİN PANEL · {new Date().toLocaleDateString('tr-TR',{day:'numeric',month:'long'}).toUpperCase()}</div>
        </div>

        <div style={{flex:1,padding:'24px 28px'}}>
          {loading ? <div style={{color:'rgba(255,255,255,0.4)',fontSize:'14px'}}>Yükleniyor...</div> : (
            <>
              {/* BUGÜN YAPILACAKLAR */}
              {(approvalCount > 0 || unansweredCount > 0 || pendingCount > 0 || demoCount > 0) && (
                <div style={{background:'#fff',border:'1px solid var(--color-border-tertiary)',overflow:'hidden',marginBottom:'20px'}}>
                  <div style={{padding:'12px 20px',borderBottom:'1px solid var(--color-border-tertiary)',fontSize:'11px',letterSpacing:'2px',textTransform:'uppercase',fontWeight:'500',color:'var(--color-text-primary)'}}>BUGÜN YAPILACAKLAR</div>
                  {[
                    approvalCount > 0 ? { label: `${approvalCount} video onay bekliyor`, href: '/dashboard/admin/briefs', color: '#ef4444', urgent: true } : null,
                    unansweredCount > 0 ? { label: `${unansweredCount} cevaplanmamış müşteri sorusu`, href: '/dashboard/admin/briefs', color: '#f59e0b', urgent: false } : null,
                    demoCount > 0 ? { label: `${demoCount} yeni demo talebi (son 7 gün)`, href: '/dashboard/admin/creators', color: '#3b82f6', urgent: false } : null,
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
                  {label:'TOPLAM',value:stats.total},
                  {label:'YENİ',value:stats.new,color:'#4ade80'},
                  {label:'ÜRETİMDE',value:stats.inProd,color:'#3b82f6'},
                  {label:'REVİZYON',value:stats.revision,color:'#ef4444'},
                  {label:'TAMAMLANAN',value:stats.delivered},
                ].map(card=>(
                  <div key={card.label} style={{background:'#fff',border:'1px solid var(--color-border-tertiary)',padding:'20px'}}>
                    <div style={{fontSize:'10px',letterSpacing:'2px',color:'var(--color-text-tertiary)',fontWeight:'500',marginBottom:'8px'}}>{card.label}</div>
                    <div style={{fontSize:'28px',fontWeight:'500',color:card.color||'var(--color-text-primary)',letterSpacing:'-1px'}}><CountUp end={card.value} duration={1.2} /></div>
                  </div>
                ))}
              </div>

              <div style={{background:'#fff',border:'1px solid var(--color-border-tertiary)',overflow:'hidden'}}>
                <div style={{padding:'14px 20px',borderBottom:'1px solid var(--color-border-tertiary)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:'11px',letterSpacing:'2px',textTransform:'uppercase',fontWeight:'500',color:'var(--color-text-primary)'}}>TÜM BRİEFLER</div>
                  <div onClick={()=>router.push('/dashboard/admin/briefs')} style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--color-text-secondary)',cursor:'pointer'}}>TÜMÜNÜ GÖR →</div>
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

          {/* LIVE ACTIVITY TICKER */}
          {activityLogs.length > 0 && (
            <div style={{background:'#fff',border:'1px solid var(--color-border-tertiary)',padding:'16px 20px',marginTop:'16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#22c55e',animation:'pulse 2s infinite'}} />
                  <div style={{fontSize:'11px',letterSpacing:'2px',textTransform:'uppercase',fontWeight:'500',color:'var(--color-text-primary)'}}>CANLI AKTİVİTE</div>
                </div>
                <a href="/dashboard/admin/activity" style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--color-text-secondary)',textDecoration:'none'}}>TÜMÜNÜ GÖR →</a>
              </div>
              {activityLogs.map((log: any, i: number) => {
                const actionLabels: Record<string,string> = {
                  'auth.login':'giriş yaptı','auth.logout':'çıkış yaptı','brief.created':'brief oluşturdu',
                  'brief.submitted':'brief gönderdi','video.approved':'videoyu onayladı','video.purchased':'video satın aldı',
                  'video.revision_requested':'revizyon istedi','static_images.generated':'görsel üretti',
                  'static_images.downloaded':'görsel indirdi','cps.package_selected':'CPS paketi seçti',
                  'public_link.created':'link oluşturdu','admin.client_created':'müşteri ekledi',
                }
                const diff = Date.now() - new Date(log.created_at).getTime()
                const mins = Math.floor(diff / 60000)
                const timeStr = mins < 1 ? 'az önce' : mins < 60 ? `${mins} dk` : mins < 1440 ? `${Math.floor(mins/60)} sa` : `${Math.floor(mins/1440)} gün`
                const colors: Record<string,string> = {auth:'#3b82f6',brief:'#f59e0b',video:'#22c55e',static_images:'#8b5cf6',cps:'#ec4899',admin:'#ef4444'}
                const dotColor = colors[log.action_type?.split('.')[0]] || '#888'
                return (
                  <div key={log.id} style={{display:'flex',gap:'8px',padding:'6px 0',borderBottom:i<activityLogs.length-1?'0.5px solid rgba(0,0,0,0.04)':'none',alignItems:'flex-start'}}>
                    <div style={{width:'6px',height:'6px',borderRadius:'50%',background:dotColor,flexShrink:0,marginTop:'6px'}} />
                    <div style={{flex:1,fontSize:'12px',color:'#0a0a0a',lineHeight:1.5}}>
                      <span style={{fontWeight:'500'}}>{log.user_name||log.user_email||'—'}</span>
                      {log.client_name && <span style={{color:'#888'}}> ({log.client_name})</span>}
                      {' '}{actionLabels[log.action_type]||log.action_type}
                      {log.target_label && <span style={{color:'#555'}}> — {log.target_label}</span>}
                    </div>
                    <div style={{fontSize:'10px',color:'#aaa',flexShrink:0}}>{timeStr}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
    </div>
  )
}
