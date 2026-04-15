'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string,string> = {
  draft:'Taslak', submitted:'İnceleniyor', read:'İncelendi', in_production:'Üretimde',
  revision:'Revizyon', approved:'Onay Bekliyor', delivered:'Teslim Edildi', cancelled:'İptal Edildi'
}
const statusColor: Record<string,string> = {
  draft:'#f59e0b', submitted:'#888', read:'#888', in_production:'#3b82f6',
  revision:'#ef4444', approved:'#f59e0b', delivered:'#22c55e', cancelled:'#555'
}
const PROGRESS_STEPS = ['Brief Alındı','Üretimde','İncelemenizde','Teslim']
function getProgressStep(status: string) {
  if (['submitted','read'].includes(status)) return 0
  if (['in_production','revision'].includes(status)) return 1
  if (status === 'approved') return 2
  if (status === 'delivered') return 3
  return 0
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff/60000)
  if (mins < 60) return `${mins} dk önce`
  const hrs = Math.floor(mins/60)
  if (hrs < 24) return `${hrs} saat önce`
  const days = Math.floor(hrs/24)
  return `${days} gün önce`
}

export default function ClientDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [credits, setCredits] = useState(0)
  const [clientUserId, setClientUserId] = useState('')
  const [briefs, setBriefs] = useState<any[]>([])
  const [videoMap, setVideoMap] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(true)
  // Notifications
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  // Activity
  const [activities, setActivities] = useState<any[]>([])
  // Stats
  const [totalSpent, setTotalSpent] = useState(0)
  const [avgDelivery, setAvgDelivery] = useState(0)
  const [homeVideos, setHomeVideos] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'client') { router.push('/login'); return }
      setUserName(userData.name)
      const { data: cu } = await supabase.from('client_users').select('id, credit_balance, client_id, clients(company_name)').eq('user_id', user.id).single()
      if (cu) {
        setCredits(cu.credit_balance)
        setClientUserId(cu.id)
        setCompanyName((cu as any).clients?.company_name || '')
        const { data: b } = await supabase.from('briefs').select('*').eq('client_id', cu.client_id).neq('status','cancelled').order('created_at', { ascending: false })
        setBriefs(b || [])

        const deliveredIds = (b || []).filter(br => br.status === 'delivered').map(br => br.id)
        if (deliveredIds.length > 0) {
          const { data: vids } = await supabase.from('video_submissions').select('brief_id, video_url').in('brief_id', deliveredIds).order('version', { ascending: false })
          const map: Record<string,string> = {}
          vids?.forEach((v: any) => { if (!map[v.brief_id]) map[v.brief_id] = v.video_url })
          setVideoMap(map)
        }

        // Notifications
        const { data: notifs } = await supabase.from('notifications').select('*').eq('client_user_id', cu.id).order('created_at', { ascending: false }).limit(10)
        setNotifications(notifs || [])

        // Stats
        const { data: txns } = await supabase.from('credit_transactions').select('amount').eq('client_id', cu.client_id).lt('amount', 0)
        setTotalSpent(Math.abs((txns || []).reduce((s: number, t: any) => s + t.amount, 0)))

        // Avg delivery
        const delivered = (b || []).filter(br => br.status === 'delivered' && br.updated_at)
        if (delivered.length > 0) {
          const totalDays = delivered.reduce((s: number, br: any) => s + (new Date(br.updated_at).getTime() - new Date(br.created_at).getTime()) / 86400000, 0)
          setAvgDelivery(Math.round(totalDays / delivered.length * 10) / 10)
        }

        // Activities (last 5 briefs activity)
        const acts: any[] = []
        for (const br of (b || []).slice(0, 10)) {
          acts.push({ msg: `${br.campaign_name} — ${statusLabel[br.status] || br.status}`, date: br.updated_at || br.created_at })
        }
        acts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setActivities(acts.slice(0, 5))
      }
      const { data: hvids } = await supabase.from('homepage_videos').select('id, title, video_url').eq('is_active', true).order('created_at', { ascending: false }).limit(6)
      setHomeVideos(hvids || [])
      setLoading(false)
    }
    load()
  }, [router])

  async function markNotifRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function handleLogout() { await supabase.auth.signOut(); router.push('/login') }

  const drafts = briefs.filter(b => b.status === 'draft')
  const pending = briefs.filter(b => b.status === 'approved')
  const inProd = briefs.filter(b => ['submitted','read','in_production','revision'].includes(b.status))
  const done = briefs.filter(b => b.status === 'delivered')

  async function handleDeleteDraft(briefId: string) {
    if (!confirm('Bu taslağı silmek istediğinizden emin misiniz?')) return
    await supabase.from('briefs').delete().eq('id', briefId)
    setBriefs(prev => prev.filter(b => b.id !== briefId))
  }
  const unreadCount = notifications.filter(n => !n.is_read).length
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  function toggleGroup(id: string) {
    setExpandedGroups(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // Group by parent — only for done briefs
  const doneGrouped: Record<string,any[]> = {}
  done.forEach(b => {
    const parentId = b.parent_brief_id || b.id
    if (!doneGrouped[parentId]) doneGrouped[parentId] = []
    doneGrouped[parentId].push(b)
  })
  // Get root briefs for each group (the one without parent_brief_id, or first in group)
  const doneRoots = Object.entries(doneGrouped).map(([parentId, items]) => {
    const root = items.find(b => !b.parent_brief_id) || items[0]
    const children = items.filter(b => b.id !== root.id).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    return { root, children, parentId }
  })

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"var(--font-dm-sans),'DM Sans',system-ui,sans-serif",background:'#f5f4f0'}}>

      {/* SIDEBAR */}
      <div style={{width:'240px',background:'#0A0A0A',display:'flex',flexDirection:'column',flexShrink:0,height:'100vh',position:'sticky',top:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'18px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'12px'}}>
            dinam<span style={{display:'inline-block',width:'11px',height:'11px',borderRadius:'50%',border:'2.5px solid #22c55e',position:'relative',top:'1px'}}></span>
          </div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'3px'}}>{companyName}</div>
          <div style={{fontSize:'13px',fontWeight:'500',color:'#fff'}}>{userName}</div>
        </div>
        <div style={{padding:'12px 16px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',textTransform:'uppercase',marginBottom:'4px'}}>Kredi Bakiyesi</div>
          <div style={{fontSize:'24px',fontWeight:'300',color:'#fff',letterSpacing:'-1px'}}>{credits}</div>
        </div>
        <nav style={{padding:'10px 8px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          {[
            {label:'Projelerim', href:'/dashboard/client', active:true},
            {label:'Yeni Brief', href:'/dashboard/client/brief/new', active:false},
            {label:'Marka Paketi', href:'/dashboard/client/brand', active:false},
            {label:'Raporlar', href:'/dashboard/client/reports', active:false},
            {label:'Telif Belgeleri', href:'/dashboard/client/certificates', active:false},
            {label:'İçerik Güvencesi', href:'/dashboard/client/guarantee', active:false},
          ].map(item=>(
            <div key={item.href} onClick={()=>router.push(item.href)}
              style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',background:item.active?'rgba(255,255,255,0.08)':'transparent',marginBottom:'1px'}}>
              <span style={{fontSize:'12px',color:item.active?'#fff':'rgba(255,255,255,0.4)',fontWeight:item.active?'500':'400'}}>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{flex:1}}></div>
        <div style={{padding:'10px 8px',borderTop:'0.5px solid rgba(255,255,255,0.07)'}}>
          <button onClick={handleLogout} style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',borderRadius:'7px',cursor:'pointer',width:'100%',background:'none',border:'none'}}>
            <span style={{fontSize:'11px',color:'rgba(255,255,255,0.25)',fontFamily:'var(--font-dm-sans),sans-serif'}}>Çıkış yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* TOP BAR with notifications */}
        <div style={{padding:'10px 28px',background:'#fff',borderBottom:'0.5px solid rgba(0,0,0,0.08)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>Projelerim</div>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          {/* Notification bell */}
          <div style={{position:'relative'}}>
            <button onClick={()=>setShowNotifs(!showNotifs)} style={{background:'none',border:'none',cursor:'pointer',padding:'6px',position:'relative'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
              {unreadCount > 0 && <div style={{position:'absolute',top:'2px',right:'2px',width:'8px',height:'8px',borderRadius:'50%',background:'#ef4444'}}></div>}
            </button>
            {showNotifs && (
              <div style={{position:'absolute',top:'40px',right:0,width:'320px',background:'#fff',borderRadius:'12px',boxShadow:'0 8px 32px rgba(0,0,0,0.12)',border:'0.5px solid rgba(0,0,0,0.08)',zIndex:50,maxHeight:'360px',overflowY:'auto'}}>
                <div style={{padding:'12px 16px',borderBottom:'0.5px solid rgba(0,0,0,0.06)',fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Bildirimler</div>
                {notifications.length === 0 ? (
                  <div style={{padding:'20px',textAlign:'center',fontSize:'12px',color:'#888'}}>Bildirim yok.</div>
                ) : notifications.map(n=>(
                  <div key={n.id} onClick={()=>{markNotifRead(n.id);if(n.brief_id) router.push(`/dashboard/client/briefs/${n.brief_id}`)}}
                    style={{padding:'10px 16px',borderBottom:'0.5px solid rgba(0,0,0,0.04)',cursor:'pointer',background:n.is_read?'transparent':'rgba(34,197,94,0.03)'}}>
                    <div style={{fontSize:'12px',color:'#0a0a0a',fontWeight:n.is_read?'400':'500'}}>{n.message}</div>
                    <div style={{fontSize:'10px',color:'#aaa',marginTop:'2px'}}>{timeAgo(n.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={()=>router.push('/dashboard/client/brief/new')}
            style={{background:'#111113',color:'#fff',border:'none',borderRadius:'8px',padding:'8px 18px',fontSize:'12px',fontFamily:'var(--font-dm-sans),sans-serif',cursor:'pointer',fontWeight:'500',flexShrink:0}}>
            + Yeni Brief
          </button>
          </div>
        </div>

        <div style={{flex:1,overflow:'hidden'}}>
          {loading ? (
            <div style={{padding:'24px 28px',color:'#888',fontSize:'14px'}}>Yükleniyor...</div>
          ) : briefs.length === 0 ? (
            /* WELCOME SCREEN — full black, centered */
            <div style={{background:'#0A0A0A',minHeight:'100%',display:'flex',flexDirection:'column',position:'relative'}}>
              {/* Logo top-left */}
              <div style={{padding:'28px 36px'}}>
                <img src="/logo.svg" alt="Dinamo" style={{height:'28px'}} />
              </div>

              {/* Main content centered */}
              <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 48px'}}>
                <div style={{maxWidth:'520px',width:'100%'}}>
                  <h1 style={{fontSize:'64px',fontWeight:'300',color:'#fff',letterSpacing:'-0.02em',lineHeight:1.05,margin:0}}>
                    Hoş geldiniz,
                  </h1>
                  {companyName && (
                    <h1 style={{fontSize:'64px',fontWeight:'700',color:'#fff',letterSpacing:'-0.02em',lineHeight:1.05,margin:0}}>
                      {companyName}.
                    </h1>
                  )}
                  <div style={{width:'60px',height:'2px',background:'#1DB81D',marginTop:'20px',marginBottom:'28px'}}></div>
                  <p style={{fontSize:'18px',color:'#888',fontWeight:'300',letterSpacing:'0.01em',lineHeight:1.6,margin:'0 0 40px 0'}}>
                    Brief'inizi oluşturun, 24 saat içinde videonuz hazır.
                  </p>

                  {/* Steps */}
                  <div style={{display:'flex',alignItems:'flex-start',gap:'0',marginBottom:'48px'}}>
                    {[
                      {n:'01',t:'Brief Yazın'},
                      {n:'02',t:'Prodüktör Onaylar'},
                      {n:'03',t:'Video Teslim'},
                    ].map((s,i)=>(
                      <div key={s.n} style={{display:'flex',alignItems:'flex-start'}}>
                        <div>
                          <div style={{fontSize:'11px',color:'#1DB81D',letterSpacing:'0.15em',marginBottom:'8px'}}>{s.n}</div>
                          <div style={{fontSize:'14px',color:'#fff',fontWeight:'500'}}>{s.t}</div>
                        </div>
                        {i < 2 && <div style={{width:'40px',height:'1px',background:'#2A2A2A',margin:'8px 20px 0 20px',flexShrink:0}}></div>}
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button onClick={()=>router.push('/dashboard/client/brief/new')}
                    onMouseEnter={e=>{e.currentTarget.style.background='#F0F0F0'}}
                    onMouseLeave={e=>{e.currentTarget.style.background='#fff'}}
                    style={{padding:'14px 32px',background:'#fff',color:'#0A0A0A',border:'none',fontSize:'14px',fontWeight:'600',letterSpacing:'0.05em',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'8px',transition:'background 0.2s'}}>
                    İlk Brief'i Oluştur
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>

                  {/* Video grid */}
                  {homeVideos.length > 0 && (
                    <div style={{marginTop:'56px'}}>
                      <div style={{fontSize:'13px',fontWeight:'700',color:'#fff',marginBottom:'16px'}}>Dinamo ile Üretildi</div>
                      <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(homeVideos.length, 4)},1fr)`,gap:'8px'}}>
                        {homeVideos.map(v=>(
                          <div key={v.id} style={{position:'relative',overflow:'hidden',aspectRatio:'16/9',background:'#111',cursor:'pointer'}}
                            onMouseEnter={e=>{const vid=e.currentTarget.querySelector('video') as HTMLVideoElement;if(vid)vid.play().catch(()=>{});const ov=e.currentTarget.querySelector('[data-ov]') as HTMLElement;if(ov)ov.style.opacity='0'}}
                            onMouseLeave={e=>{const vid=e.currentTarget.querySelector('video') as HTMLVideoElement;if(vid){vid.pause();vid.currentTime=0}const ov=e.currentTarget.querySelector('[data-ov]') as HTMLElement;if(ov)ov.style.opacity='1'}}>
                            <video src={v.video_url} loop muted playsInline preload="metadata" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                            <div data-ov="" style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'flex-end',padding:'10px',transition:'opacity 0.3s'}}>
                              <span style={{fontSize:'11px',fontWeight:'500',color:'#fff'}}>{v.title || ''}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom email */}
              <div style={{padding:'20px',textAlign:'center'}}>
                <span style={{fontSize:'11px',color:'#444'}}>Sorularınız için hello@dinamo.media</span>
              </div>
            </div>
          ) : (
            <>
              {/* 6. STATS */}
              {briefs.length > 0 && (
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'24px'}}>
                  {[
                    {label:'Toplam Video',value:String(done.length),color:'#22c55e'},
                    {label:'Üretimde',value:String(inProd.length + pending.length),color:'#3b82f6'},
                    {label:'Harcanan Kredi',value:String(totalSpent),color:'#0a0a0a'},
                    {label:'Ort. Teslim',value:avgDelivery > 0 ? `${avgDelivery} gün` : '—',color:'#888'},
                  ].map(c=>(
                    <div key={c.label} style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'14px'}}>
                      <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}>{c.label}</div>
                      <div style={{fontSize:'22px',fontWeight:'300',color:c.color,letterSpacing:'-0.5px'}}>{c.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* DRAFTS */}
              {drafts.length > 0 && (
                <div style={{marginBottom:'24px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
                    <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#f59e0b',animation:'pulse 2s infinite'}}></div>
                    <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Taslaklar — Gönderilmedi</div>
                    <div style={{fontSize:'10px',color:'#aaa'}}>{drafts.length}</div>
                  </div>
                  <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
                  {drafts.map(b=>(
                    <div key={b.id}
                      style={{background:'#fffbeb',border:'1.5px dashed #f59e0b',borderRadius:'12px',padding:'14px 18px',marginBottom:'8px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'relative',transition:'box-shadow 0.2s'}}
                      onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 2px 12px rgba(245,158,11,0.15)';(e.currentTarget.querySelector('[data-actions]') as HTMLElement)?.style.setProperty('opacity','1')}}
                      onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';(e.currentTarget.querySelector('[data-actions]') as HTMLElement)?.style.setProperty('opacity','0')}}>
                      <div style={{flex:1,cursor:'pointer'}} onClick={()=>router.push(`/dashboard/client/brief/new?draft=${b.id}`)}>
                        <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{b.campaign_name || 'İsimsiz Taslak'}</div>
                        <div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>{b.video_type ? `${b.video_type} · ` : ''}{timeAgo(b.created_at)}</div>
                      </div>
                      <div style={{position:'absolute',top:'10px',right:'14px',fontSize:'9px',fontWeight:'600',color:'#f59e0b',background:'rgba(245,158,11,0.1)',padding:'2px 8px',borderRadius:'100px',letterSpacing:'0.5px'}}>TASLAK</div>
                      <div data-actions="" style={{display:'flex',gap:'6px',opacity:0,transition:'opacity 0.15s'}}>
                        <button onClick={()=>router.push(`/dashboard/client/brief/new?draft=${b.id}`)}
                          style={{padding:'6px 14px',background:'#22c55e',color:'#fff',border:'none',borderRadius:'8px',fontSize:'11px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',fontWeight:'500'}}>
                          Düzenle ve Gönder
                        </button>
                        <button onClick={()=>handleDeleteDraft(b.id)}
                          style={{padding:'6px 14px',background:'none',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',borderRadius:'8px',fontSize:'11px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>
                          Sil
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* PENDING */}
              {pending.length > 0 && (
                <div style={{marginBottom:'24px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
                    <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#f59e0b'}}></div>
                    <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Onayınızı Bekliyor</div>
                  </div>
                  {pending.map(b=>(
                    <div key={b.id} onClick={()=>router.push(`/dashboard/client/briefs/${b.id}`)}
                      style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'14px 18px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px',transition:'border-color 0.2s'}}
                      onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.25)')}
                      onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.1)')}>
                      <div>
                        <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{b.campaign_name}</div>
                        <div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>{b.video_type} · {new Date(b.created_at).toLocaleDateString('tr-TR')}</div>
                      </div>
                      <div style={{fontSize:'10px',padding:'4px 12px',borderRadius:'100px',background:'rgba(245,158,11,0.1)',color:'#f59e0b',fontWeight:'500'}}>İncele & Onayla</div>
                    </div>
                  ))}
                </div>
              )}

              {/* IN PRODUCTION with progress bars */}
              {inProd.length > 0 && (
                <div style={{marginBottom:'24px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
                    <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#3b82f6'}}></div>
                    <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Devam Edenler</div>
                  </div>
                  {inProd.map(b=>{
                    const step = getProgressStep(b.status)
                    return (
                      <div key={b.id} onClick={()=>router.push(`/dashboard/client/briefs/${b.id}`)}
                        style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'14px 18px',cursor:'pointer',marginBottom:'8px',transition:'border-color 0.2s'}}
                        onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.25)')}
                        onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.1)')}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                          <div>
                            <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{b.campaign_name}</div>
                            <div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>{b.video_type}</div>
                          </div>
                          <div style={{fontSize:'10px',padding:'4px 12px',borderRadius:'100px',background:`${statusColor[b.status]}15`,color:statusColor[b.status],fontWeight:'500'}}>{statusLabel[b.status]}</div>
                        </div>
                        {/* Progress bar */}
                        <div style={{display:'flex',gap:'4px'}}>
                          {PROGRESS_STEPS.map((s,i)=>(
                            <div key={s} style={{flex:1}}>
                              <div style={{height:'3px',borderRadius:'2px',background:i<=step?'#22c55e':'rgba(0,0,0,0.06)',transition:'background 0.3s'}}></div>
                              <div style={{fontSize:'9px',color:i<=step?'#22c55e':'#ccc',marginTop:'4px',textAlign:'center'}}>{s}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* DONE — grouped by parent */}
              {done.length > 0 && (
                <div style={{marginBottom:'24px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
                    <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#22c55e'}}></div>
                    <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Tamamlananlar</div>
                    <div style={{fontSize:'11px',color:'#888'}}>{done.length}</div>
                  </div>
                  {doneRoots.map(({root, children, parentId}) => {
                    const isExpanded = expandedGroups.has(parentId)
                    const videoUrl = videoMap[root.id]
                    return (
                      <div key={parentId} style={{marginBottom:'8px'}}>
                        {/* ROOT CARD */}
                        <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',overflow:'hidden',transition:'border-color 0.2s'}}
                          onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.25)')}
                          onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.1)')}>
                          <div style={{display:'flex',alignItems:'center',gap:'14px',padding:'14px 18px',cursor:'pointer'}}
                            onClick={()=>router.push(`/dashboard/client/briefs/${root.id}`)}>
                            {/* Thumbnail */}
                            <div style={{width:'48px',height:'48px',borderRadius:'8px',overflow:'hidden',background:'#1a1a1f',flexShrink:0}}>
                              {videoUrl ? <video src={videoUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} preload="metadata" muted playsInline />
                              : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M5 3l9 5-9 5V3z" fill="white"/></svg></div>}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>{root.campaign_name}</div>
                              <div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>{root.video_type} · {new Date(root.created_at).toLocaleDateString('tr-TR')}</div>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0}}>
                              <span style={{fontSize:'10px',padding:'3px 10px',borderRadius:'100px',background:'rgba(34,197,94,0.1)',color:'#22c55e',fontWeight:'500'}}>Teslim</span>
                              {children.length > 0 && (
                                <button onClick={e=>{e.stopPropagation();toggleGroup(parentId)}}
                                  style={{fontSize:'10px',padding:'3px 10px',borderRadius:'100px',background:'rgba(0,0,0,0.05)',color:'#555',border:'none',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',fontWeight:'500'}}>
                                  {children.length} versiyon {isExpanded?'▲':'▼'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* CHILDREN — accordion */}
                        {isExpanded && children.length > 0 && (
                          <div style={{marginLeft:'24px',borderLeft:'2px solid #22c55e',paddingLeft:'16px',marginTop:'4px'}}>
                            {children.map(child=>(
                              <div key={child.id} onClick={()=>router.push(`/dashboard/client/briefs/${child.id}`)}
                                style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.08)',borderRadius:'10px',padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'4px',transition:'border-color 0.15s'}}
                                onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.2)')}
                                onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.08)')}>
                                <div>
                                  <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{child.campaign_name}</div>
                                  <div style={{fontSize:'10px',color:'#888',marginTop:'2px'}}>{child.video_type} · {new Date(child.created_at).toLocaleDateString('tr-TR')}</div>
                                </div>
                                <span style={{fontSize:'10px',padding:'3px 10px',borderRadius:'100px',background:`${statusColor[child.status]}15`,color:statusColor[child.status],fontWeight:'500'}}>{statusLabel[child.status]}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* EMPTY STATE */}
              {briefs.length === 0 && (
                <div style={{display:'flex',justifyContent:'center',padding:'48px 0'}}>
                  <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'16px',padding:'48px 56px',textAlign:'center',maxWidth:'420px'}}>
                    <div style={{fontSize:'32px',fontWeight:'300',color:'#0a0a0a',letterSpacing:'-0.5px',marginBottom:'12px'}}>Hoş geldin, {userName.split(' ')[0]}!</div>
                    <div style={{fontSize:'14px',color:'#888',lineHeight:1.6,marginBottom:'28px'}}>İlk brief'ini oluştur, 24 saat içinde vidyon hazır olsun.</div>
                    <button onClick={()=>router.push('/dashboard/client/brief/new')}
                      style={{background:'#22c55e',color:'#fff',border:'none',borderRadius:'10px',padding:'14px 32px',fontSize:'15px',fontFamily:'var(--font-dm-sans),sans-serif',cursor:'pointer',fontWeight:'500'}}>
                      İlk Brief'ini Oluştur
                    </button>
                  </div>
                </div>
              )}

              {/* ACTIVITY PANEL */}
              {activities.length > 0 && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px 20px',marginTop:'8px'}}>
                  <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'12px'}}>Son Aktiviteler</div>
                  {activities.map((a,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:'10px',padding:'6px 0',borderBottom:i<activities.length-1?'0.5px solid rgba(0,0,0,0.04)':'none'}}>
                      <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#22c55e',flexShrink:0}}></div>
                      <div style={{fontSize:'12px',color:'#0a0a0a',flex:1}}>{a.msg}</div>
                      <div style={{fontSize:'10px',color:'#aaa',flexShrink:0}}>{timeAgo(a.date)}</div>
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
