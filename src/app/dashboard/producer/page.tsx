'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string,string> = {
  submitted:'Yeni', read:'Okundu', in_production:'Üretimde',
  revision:'Revizyon', approved:'Onay Bekliyor', delivered:'Teslim Edildi'
}
const statusColor: Record<string,string> = {
  submitted:'#22c55e', read:'#888', in_production:'#3b82f6',
  revision:'#ef4444', approved:'#f59e0b', delivered:'#888'
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const hrs = Math.floor(diff / 3600000)
  if (hrs < 1) return 'Az önce'
  if (hrs < 24) return `${hrs} saat önce`
  return `${Math.floor(hrs / 24)} gün önce`
}

export default function ProducerDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [briefs, setBriefs] = useState<any[]>([])
  const [tab, setTab] = useState<'briefs'|'ai'>('briefs')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [lastUploads, setLastUploads] = useState<Record<string,string>>({})

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'producer') { router.push('/login'); return }
      setUserName(userData.name)
      const { data: b } = await supabase.from('briefs').select('*, clients(company_name)').neq('status','cancelled').order('created_at', { ascending: false })
      setBriefs(b || [])
      const { count } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'creator').eq('status', 'pending')
      setPendingCount(count || 0)
      // Last video uploads per brief
      const activeIds = (b || []).filter(br => ['in_production','revision'].includes(br.status)).map(br => br.id)
      if (activeIds.length > 0) {
        const { data: vids } = await supabase.from('video_submissions').select('brief_id, submitted_at').in('brief_id', activeIds).order('submitted_at', { ascending: false })
        const map: Record<string,string> = {}
        vids?.forEach((v: any) => { if (!map[v.brief_id]) map[v.brief_id] = v.submitted_at })
        setLastUploads(map)
      }
      setLoading(false)
    }
    load()
  }, [router])

  async function handleLogout() { await supabase.auth.signOut(); router.push('/login') }

  const isAiBrief = (b: any) => b.campaign_name?.includes('Full AI')
  const tabBriefs = tab === 'ai' ? briefs.filter(b => isAiBrief(b) && b.ai_video_url) : briefs.filter(b => !isAiBrief(b))
  const filtered = filter === 'all' ? tabBriefs : tabBriefs.filter(b => b.status === filter)
  const newCount = briefs.filter(b => b.status === 'submitted').length
  const revisionCount = briefs.filter(b => b.status === 'revision').length

  // Daily work items
  const now = Date.now()
  const h24 = 24 * 3600000
  const h48 = 48 * 3600000
  const overdue = briefs.filter(b => ['in_production','submitted','read'].includes(b.status) && (now - new Date(b.created_at).getTime()) > h48)
  const newToday = briefs.filter(b => b.status === 'submitted' && (now - new Date(b.created_at).getTime()) < h24)
  const waitingApproval = briefs.filter(b => b.status === 'approved')

  function uploadBadge(briefId: string, status: string) {
    if (!['in_production','revision'].includes(status)) return null
    const last = lastUploads[briefId]
    if (!last) {
      const brief = briefs.find(b => b.id === briefId)
      const days = brief ? Math.floor((now - new Date(brief.created_at).getTime()) / 86400000) : 0
      return { text: `Henüz video yüklenmedi · ${days} gün`, color: '#f59e0b' }
    }
    const hrs = Math.floor((now - new Date(last).getTime()) / 3600000)
    if (hrs > 48) return { text: `${Math.floor(hrs / 24)} gün önce yüklendi`, color: '#ef4444' }
    return { text: `Son yükleme: ${timeAgo(last)}`, color: '#22c55e' }
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"var(--font-dm-sans),'DM Sans',system-ui,sans-serif"}}>

      <div style={{width:'240px',background:'#0A0A0A',display:'flex',flexDirection:'column',flexShrink:0,height:'100vh',position:'sticky',top:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'18px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'12px'}}>
            <img src="/dinamo_logo.png" alt="Dinamo" style={{height:'28px'}} />
          </div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'3px'}}>Prodüktör</div>
          <div style={{fontSize:'13px',fontWeight:'500',color:'#fff'}}>{userName}</div>
        </div>
        <nav style={{padding:'10px 8px',flex:1}}>
          <div style={{display:'flex',gap:'4px',marginBottom:'10px'}}>
            <button onClick={()=>{setTab('briefs');setFilter('all')}} style={{flex:1,padding:'6px',border:'none',background:tab==='briefs'?'rgba(255,255,255,0.1)':'transparent',color:tab==='briefs'?'#fff':'rgba(255,255,255,0.4)',fontSize:'11px',fontWeight:tab==='briefs'?'600':'400',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',borderRadius:'6px'}}>Brief'ler</button>
            <button onClick={()=>{setTab('ai');setFilter('all')}} style={{flex:1,padding:'6px',border:'none',background:tab==='ai'?'rgba(255,255,255,0.1)':'transparent',color:tab==='ai'?'#fff':'rgba(255,255,255,0.4)',fontSize:'11px',fontWeight:tab==='ai'?'600':'400',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',borderRadius:'6px'}}>AI Video</button>
          </div>
          <div style={{fontSize:'9px',letterSpacing:'1.5px',color:'rgba(255,255,255,0.2)',padding:'0 6px',marginBottom:'6px',textTransform:'uppercase'}}>Filtrele</div>
          {[
            {val:'all',label:'Tümü'},
            {val:'submitted',label:'Yeni Briefler',badge:newCount},
            {val:'in_production',label:'Üretimde'},
            {val:'revision',label:'Revizyon',badge:revisionCount},
            {val:'approved',label:'Onay Bekliyor'},
            {val:'delivered',label:'Tamamlananlar'},
          ].map(item=>(
            <div key={item.val} onClick={()=>setFilter(item.val)}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',background:filter===item.val?'rgba(255,255,255,0.08)':'transparent',marginBottom:'1px'}}>
              <span style={{fontSize:'12px',color:filter===item.val?'#fff':'rgba(255,255,255,0.4)',fontWeight:filter===item.val?'500':'400'}}>{item.label}</span>
              {item.badge&&item.badge>0&&<span style={{fontSize:'9px',background:'rgba(239,68,68,0.3)',color:'#fca5a5',borderRadius:'100px',padding:'1px 7px'}}>{item.badge}</span>}
            </div>
          ))}
        </nav>
        <div style={{padding:'10px 8px',borderTop:'0.5px solid rgba(255,255,255,0.07)'}}>
          <button onClick={handleLogout} style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',borderRadius:'7px',cursor:'pointer',width:'100%',background:'none',border:'none'}}>
            <span style={{fontSize:'11px',color:'rgba(255,255,255,0.25)',fontFamily:'var(--font-dm-sans),sans-serif'}}>Çıkış yap</span>
          </button>
        </div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f5f4f0',overflow:'hidden'}}>
        <div style={{padding:'14px 28px',background:'#fff',borderBottom:'0.5px solid rgba(0,0,0,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>Briefler</div>
          <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>{filtered.length} proje</div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'20px 28px'}}>
          {/* DAILY WORK LIST */}
          {!loading && (overdue.length > 0 || newToday.length > 0 || waitingApproval.length > 0) && (
            <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',overflow:'hidden',marginBottom:'20px'}}>
              <div style={{padding:'12px 20px',borderBottom:'0.5px solid rgba(0,0,0,0.06)',fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Bugün</div>
              {overdue.map(b=>(
                <div key={b.id+'o'} onClick={()=>router.push(`/dashboard/producer/briefs/${b.id}`)}
                  style={{padding:'10px 20px',borderBottom:'0.5px solid rgba(0,0,0,0.04)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',borderLeft:'3px solid #ef4444'}}
                  onMouseEnter={e=>(e.currentTarget.style.background='#fef2f2')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{b.campaign_name}</div>
                    <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>{b.clients?.company_name} · {statusLabel[b.status]}</div>
                  </div>
                  <div style={{fontSize:'11px',color:'#ef4444',fontWeight:'500'}}>{Math.floor((now - new Date(b.created_at).getTime()) / 86400000)} gün gecikmiş</div>
                </div>
              ))}
              {waitingApproval.map(b=>(
                <div key={b.id+'a'} onClick={()=>router.push(`/dashboard/producer/briefs/${b.id}`)}
                  style={{padding:'10px 20px',borderBottom:'0.5px solid rgba(0,0,0,0.04)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',borderLeft:'3px solid #f59e0b'}}
                  onMouseEnter={e=>(e.currentTarget.style.background='#fffbeb')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{b.campaign_name}</div>
                    <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>{b.clients?.company_name}</div>
                  </div>
                  <div style={{fontSize:'11px',color:'#f59e0b',fontWeight:'500'}}>Onay bekliyor</div>
                </div>
              ))}
              {newToday.map(b=>(
                <div key={b.id+'n'} onClick={()=>router.push(`/dashboard/producer/briefs/${b.id}`)}
                  style={{padding:'10px 20px',borderBottom:'0.5px solid rgba(0,0,0,0.04)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',borderLeft:'3px solid #22c55e'}}
                  onMouseEnter={e=>(e.currentTarget.style.background='#f0fdf4')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{b.campaign_name}</div>
                    <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>{b.clients?.company_name} · {b.video_type}</div>
                  </div>
                  <div style={{fontSize:'11px',color:'#22c55e',fontWeight:'500'}}>Yeni</div>
                </div>
              ))}
            </div>
          )}

          {pendingCount > 0 && (
            <div onClick={()=>router.push('/dashboard/admin/creators')} style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:'10px',padding:'12px 18px',marginBottom:'16px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#f59e0b'}}></div>
                <div style={{fontSize:'13px',color:'#0a0a0a'}}><strong>{pendingCount}</strong> bekleyen creator başvurusu</div>
              </div>
              <div style={{fontSize:'12px',color:'#f59e0b'}}>→</div>
            </div>
          )}

          {loading ? <div style={{color:'rgba(255,255,255,0.4)',fontSize:'14px'}}>Yükleniyor...</div> : filtered.length === 0 ? (
            <div style={{textAlign:'center',padding:'60px 0',color:'rgba(255,255,255,0.4)',fontSize:'14px'}}>Proje yok.</div>
          ) : filtered.map(b=>{
            const badge = uploadBadge(b.id, b.status)
            return (
              <div key={b.id} onClick={()=>router.push(`/dashboard/producer/briefs/${b.id}`)}
                style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'14px 20px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px',transition:'border-color 0.15s'}}
                onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.2)')}
                onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.1)')}>
                <div style={{display:'flex',alignItems:'center',gap:'14px',flex:1,minWidth:0}}>
                  <div style={{width:'8px',height:'8px',borderRadius:'50%',background:statusColor[b.status],flexShrink:0}}></div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>{b.campaign_name}</div>
                    <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',marginTop:'3px'}}>
                      {b.clients?.company_name} · {b.video_type} · {new Date(b.created_at).toLocaleDateString('tr-TR')}
                      {badge && <span style={{marginLeft:'8px',fontSize:'10px',color:badge.color}}>· {badge.text}</span>}
                    </div>
                  </div>
                </div>
                <div style={{fontSize:'11px',padding:'4px 12px',borderRadius:'100px',background:`${statusColor[b.status]}15`,color:statusColor[b.status],fontWeight:'500',flexShrink:0}}>
                  {b.status==='revision'?'Müşteri Revizyonu':statusLabel[b.status]||b.status}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
