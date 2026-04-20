'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string,string> = {
  draft:'Taslak', submitted:'İnceleniyor', read:'İncelendi', in_production:'Üretimde',
  revision:'Revizyon', approved:'Onay Bekliyor', delivered:'Teslim Edildi', cancelled:'İptal Edildi',
  ai_processing:'AI Üretiliyor...', ai_completed:'Önizleme Hazır', ai_archived:'Arşiv'
}
const statusColor: Record<string,string> = {
  draft:'#f59e0b', submitted:'#888', read:'#888', in_production:'#3b82f6',
  revision:'#ef4444', approved:'#f59e0b', delivered:'#22c55e', cancelled:'#555',
  ai_processing:'#f59e0b', ai_completed:'#3b82f6', ai_archived:'#888'
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
  const [aiChildrenMap, setAiChildrenMap] = useState<Record<string, any[]>>({})
  const [cpsChildrenMap, setCpsChildrenMap] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  // Notifications
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  // Activity
  const [activities, setActivities] = useState<any[]>([])
  // Stats
  const [totalSpent, setTotalSpent] = useState(0)
  const [aiProduced, setAiProduced] = useState(0)
  const [aiPurchased, setAiPurchased] = useState(0)
  const [avgDelivery, setAvgDelivery] = useState(0)
  const [homeVideos, setHomeVideos] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'client') { router.push('/login'); return }
      setUserName(userData.name)
      const { data: cu } = await supabase.from('client_users').select('id, allocated_credits, client_id, clients(company_name)').eq('user_id', user.id).single()
      if (cu) {
        setCredits(cu.allocated_credits)
        setClientUserId(cu.id)
        setCompanyName((cu as any).clients?.company_name || '')
        const { data: b, error: bError } = await supabase.from('briefs').select('*').eq('client_id', cu.client_id).neq('status','cancelled').is('parent_brief_id', null).order('created_at', { ascending: false })
        console.log('[DEBUG] clientId:', cu.client_id, '| briefs:', b?.length, '| error:', bError)
        setBriefs(b || [])

        // Fetch AI children for indicators
        const briefIds = (b || []).map(br => br.id)
        const rootIds = (b || []).map(br => br.root_campaign_id).filter(Boolean)
        const allLookupIds = [...new Set([...briefIds, ...rootIds])]
        if (allLookupIds.length > 0) {
          // Query by both root_campaign_id and parent_brief_id as fallback
          const { data: aiKids, error: aiErr } = await supabase.from('briefs')
            .select('id, root_campaign_id, parent_brief_id, status, ai_video_status, ai_video_url, created_at, campaign_name')
            .eq('client_id', cu.client_id)
            .ilike('campaign_name', '%Full AI%')
          console.log('[AI-IND] error:', aiErr?.message, '| aiKids count:', aiKids?.length, '| sample:', aiKids?.slice(0,3).map((k:any) => ({ name: k.campaign_name?.slice(0,30), root: k.root_campaign_id?.slice(0,8), parent: k.parent_brief_id?.slice(0,8), url: !!k.ai_video_url, status: k.ai_video_status })))
          const map: Record<string, any[]> = {}
          aiKids?.forEach((k: any) => {
            const key = k.root_campaign_id || k.parent_brief_id
            if (key) { if (!map[key]) map[key] = []; map[key].push(k) }
          })
          console.log('[AI-IND] map keys:', Object.keys(map).map(k => k.slice(0,8)), 'briefIds sample:', briefIds.slice(0,3).map(id => id.slice(0,8)))
          setAiChildrenMap(map)

          // CPS children
          const { data: cpsKids } = await supabase.from('briefs')
            .select('id, root_campaign_id, parent_brief_id, status, brief_type')
            .eq('client_id', cu.client_id)
            .eq('brief_type', 'cps_child')
          const cpsMap: Record<string, any[]> = {}
          cpsKids?.forEach((k: any) => {
            const key = k.root_campaign_id || k.parent_brief_id
            if (key) { if (!cpsMap[key]) cpsMap[key] = []; cpsMap[key].push(k) }
          })
          setCpsChildrenMap(cpsMap)
        }

        const withVideoIds = (b || []).filter(br => ['delivered','approved'].includes(br.status)).map(br => br.id)
        if (withVideoIds.length > 0) {
          const { data: vids } = await supabase.from('video_submissions').select('brief_id, video_url').in('brief_id', withVideoIds).order('version', { ascending: false })
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

        // AI video stats
        const { count: aiProd } = await supabase.from('briefs').select('id', { count: 'exact', head: true }).eq('client_id', cu.client_id).ilike('campaign_name', '%Full AI%').not('ai_video_url', 'is', null)
        setAiProduced(aiProd || 0)
        const { data: aiPurchData } = await supabase.from('video_submissions').select('id, briefs!inner(client_id)').eq('is_ai_generated', true).eq('briefs.client_id', cu.client_id)
        setAiPurchased(aiPurchData?.length || 0)

        // Activities (last 5 briefs activity)
        const acts: any[] = []
        for (const br of (b || []).slice(0, 10)) {
          acts.push({ msg: `${br.campaign_name} — ${statusLabel[br.status] || br.status}`, date: br.updated_at || br.created_at })
        }
        acts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setActivities(acts.slice(0, 5))
      }
      const { data: hvids } = await supabase.from('homepage_videos').select('id, title, video_url').eq('is_active', true).order('created_at', { ascending: false }).limit(10)
      const shuffled = (hvids || []).sort(() => Math.random() - 0.5).slice(0, 3)
      setHomeVideos(shuffled)
      setLoading(false)
    }
    load()
  }, [router])

  // Poll AI processing briefs every 5s
  useEffect(() => {
    const interval = setInterval(async () => {
      const processing = briefs.filter(b => b.status === 'ai_processing' || b.status === 'ai_completed')
      if (processing.length === 0) return
      const { data } = await supabase
        .from('briefs')
        .select('id, status, ai_video_status')
        .in('id', processing.map(b => b.id))
      if (data) {
        setBriefs(prev => prev.map(b => {
          const updated = data.find((d: any) => d.id === b.id)
          return updated && (updated.status !== b.status || updated.ai_video_status !== b.ai_video_status)
            ? { ...b, ...updated }
            : b
        }))
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [briefs])

  async function markNotifRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function handleLogout() { await supabase.auth.signOut(); router.push('/login') }

  const drafts = briefs.filter(b => b.status === 'draft')
  const nonDrafts = briefs.filter(b => b.status !== 'draft')
  const pending = briefs.filter(b => b.status === 'approved')
  const inProd = briefs.filter(b => ['submitted','read','in_production','revision'].includes(b.status))
  const done = briefs.filter(b => b.status === 'delivered')

  async function handleDeleteDraft(briefId: string) {
    if (!confirm('Bu taslağı silmek istediğinizden emin misiniz?')) return
    await supabase.from('briefs').delete().eq('id', briefId)
    setBriefs(prev => prev.filter(b => b.id !== briefId))
  }
  const unreadCount = notifications.filter(n => !n.is_read).length

  function getAiIndicators(brief: any): { label: string; color: string }[] {
    const kids = aiChildrenMap[brief.root_campaign_id] || aiChildrenMap[brief.id] || []
    if (kids.length === 0) return []
    const indicators: { label: string; color: string }[] = []
    const readyCount = kids.filter(k => !!k.ai_video_url).length
    if (readyCount > 0) indicators.push({ label: `${readyCount} AI Express Video`, color: '#1DB81D' })
    const processing = kids.some(k => k.status === 'ai_processing' && !k.ai_video_url)
    if (processing) indicators.push({ label: 'Üretiliyor', color: '#f59e0b' })
    return indicators
  }

  function getCpsIndicator(brief: any): { label: string; color: string } | null {
    const kids = cpsChildrenMap[brief.root_campaign_id] || cpsChildrenMap[brief.id] || []
    if (kids.length === 0) return null
    const total = kids.length
    const inProgress = kids.filter(k => ['submitted','read','in_production','revision'].includes(k.status)).length
    const delivered = kids.filter(k => k.status === 'delivered').length
    if (inProgress > 0) return { label: `${total} CPS Üretiliyor`, color: '#f59e0b' }
    if (delivered === total) return { label: `${total} CPS Hazır`, color: '#1DB81D' }
    return { label: `${total} CPS`, color: '#888' }
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"var(--font-dm-sans),'DM Sans',system-ui,sans-serif",background:'#f5f4f0'}}>

      {/* SIDEBAR */}
      <div style={{width:'240px',background:'#0A0A0A',display:'flex',flexDirection:'column',flexShrink:0,height:'100vh',position:'sticky',top:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{height:'28px'}} />
        </div>
        <div style={{margin:'12px 12px',padding:'16px 20px',background:'rgba(29,184,29,0.06)',borderLeft:'3px solid #1DB81D'}}>
          <div style={{fontSize:'18px',fontWeight:'700',color:'#fff',marginBottom:'2px'}}>{companyName || 'Dinamo'}</div>
          <div style={{fontSize:'13px',fontWeight:'400',color:'#888',marginBottom:'12px'}}>{userName}</div>
          <div style={{fontSize:'10px',color:'#AAA',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'8px'}}>KREDİ BAKİYESİ</div>
          <div style={{fontSize:'28px',fontWeight:'700',color:'#1DB81D',letterSpacing:'-1px'}}>{credits}</div>
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
              onMouseEnter={e=>{if(!item.active){e.currentTarget.style.background='rgba(255,255,255,0.06)';e.currentTarget.style.borderLeft='2px solid #1DB81D';(e.currentTarget.firstChild as HTMLElement).style.color='#fff'}}}
              onMouseLeave={e=>{if(!item.active){e.currentTarget.style.background='transparent';e.currentTarget.style.borderLeft='2px solid transparent';(e.currentTarget.firstChild as HTMLElement).style.color='rgba(255,255,255,0.4)'}}}
              style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',cursor:'pointer',background:item.active?'rgba(255,255,255,0.08)':'transparent',borderLeft:item.active?'2px solid #1DB81D':'2px solid transparent',marginBottom:'1px',transition:'all 0.15s ease'}}>
              <span style={{fontSize:'12px',color:item.active?'#fff':'rgba(255,255,255,0.4)',fontWeight:item.active?'500':'400',transition:'color 0.15s ease'}}>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{padding:'10px 8px',borderTop:'0.5px solid rgba(255,255,255,0.07)',marginTop:'auto',flexShrink:0}}>
          <button onClick={handleLogout}
            onMouseEnter={e=>{(e.currentTarget.firstChild as HTMLElement).style.color='#FF4444'}}
            onMouseLeave={e=>{(e.currentTarget.firstChild as HTMLElement).style.color='rgba(255,255,255,0.25)'}}
            style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',cursor:'pointer',width:'100%',background:'none',border:'none',transition:'all 0.15s ease'}}>
            <span style={{fontSize:'11px',color:'#aaa',fontFamily:'var(--font-dm-sans),sans-serif',transition:'color 0.15s ease'}}>Çıkış yap</span>
          </button>
          <img src="/powered_by_dcc.png" alt="Powered by DCC" style={{height:'20px',width:'auto',opacity:0.6,display:'block',margin:'16px 24px',cursor:'pointer'}} onClick={()=>window.open('https://dirtycheapcreative.com','_blank')} />
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
            onMouseEnter={e=>{e.currentTarget.style.opacity='0.85';e.currentTarget.style.transform='scale(0.98)'}}
            onMouseLeave={e=>{e.currentTarget.style.opacity='1';e.currentTarget.style.transform='scale(1)'}}
            style={{background:'#111113',color:'#fff',border:'none',padding:'8px 18px',fontSize:'12px',fontFamily:'var(--font-dm-sans),sans-serif',cursor:'pointer',fontWeight:'500',flexShrink:0,transition:'all 0.15s ease'}}>
            + Yeni Brief
          </button>
          </div>
        </div>

        <div style={{flex:1,overflow:'hidden'}}>
          {loading ? (
            <div style={{padding:'24px 28px',color:'#888',fontSize:'14px'}}>Yükleniyor...</div>
          ) : briefs.length === 0 ? (
            /* WELCOME SCREEN — white background */
            <div style={{background:'#FFFFFF',minHeight:'100%',display:'flex',flexDirection:'column',position:'relative'}}>

              {/* Main content centered */}
              <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 48px'}}>
                <div style={{maxWidth:'520px',width:'100%'}}>
                  <h1 style={{fontSize:'64px',fontWeight:'300',color:'#888',letterSpacing:'-0.02em',lineHeight:1.05,margin:0}}>
                    Hoş geldiniz,
                  </h1>
                  {companyName && (
                    <h1 style={{fontSize:'64px',fontWeight:'700',color:'#0A0A0A',letterSpacing:'-0.02em',lineHeight:1.05,margin:0}}>
                      {companyName}.
                    </h1>
                  )}
                  <div style={{width:'60px',height:'2px',background:'#1DB81D',marginTop:'20px',marginBottom:'28px'}}></div>
                  <p style={{fontSize:'18px',color:'rgba(255,255,255,0.4)',fontWeight:'300',letterSpacing:'0.01em',lineHeight:1.6,margin:'0 0 40px 0'}}>
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
                          <div style={{fontSize:'48px',fontWeight:'700',color:'#1DB81D',letterSpacing:'-0.02em',lineHeight:1,marginBottom:'8px'}}>{s.n}</div>
                          <div style={{fontSize:'16px',color:'#0A0A0A',fontWeight:'500'}}>{s.t}</div>
                        </div>
                        {i < 2 && <div style={{width:'40px',height:'1px',background:'#E0E0E0',margin:'8px 20px 0 20px',flexShrink:0}}></div>}
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button onClick={()=>router.push('/dashboard/client/brief/new')}
                    onMouseEnter={e=>{e.currentTarget.style.background='#1DB81D';e.currentTarget.style.color='#0A0A0A';const arrow=e.currentTarget.querySelector('svg');if(arrow)(arrow as unknown as HTMLElement).style.transform='translateX(4px)'}}
                    onMouseLeave={e=>{e.currentTarget.style.background='#0A0A0A';e.currentTarget.style.color='#fff';const arrow=e.currentTarget.querySelector('svg');if(arrow)(arrow as unknown as HTMLElement).style.transform='translateX(0)'}}
                    style={{padding:'14px 32px',background:'#0A0A0A',color:'#fff',border:'none',fontSize:'14px',fontWeight:'600',letterSpacing:'0.05em',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'8px',transition:'all 0.2s ease'}}>
                    İlk Brief'i Oluştur
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{transition:'transform 0.2s ease'}}><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>

                  {/* Video grid */}
                  {homeVideos.length > 0 && (
                    <div style={{marginTop:'56px'}}>
                      <div style={{fontSize:'18px',fontWeight:'600',color:'#0A0A0A',marginBottom:'16px',display:'flex',alignItems:'center',gap:'6px'}}>
                        <img src="/dinamo_logo_siyah.png" alt="Dinamo" style={{height:'20px'}} /> ile Üretildi
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
                        {homeVideos.map(v=>(
                          <div key={v.id} style={{position:'relative',overflow:'hidden',aspectRatio:'9/16',background:'#111',cursor:'pointer'}}
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
                <span style={{fontSize:'11px',color:'#999'}}>Sorularınız için hello@dinamo.media</span>
              </div>
            </div>
          ) : (
            <>
              {/* 6. STATS */}
              {briefs.length > 0 && (
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:'12px',marginBottom:'24px'}}>
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
                  {aiProduced > 0 && (
                    <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'14px'}}>
                      <div style={{fontSize:'10px',color:'#1DB81D',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px',display:'flex',alignItems:'center',gap:'4px'}}>&#9889; Full AI Video</div>
                      <div style={{fontSize:'11px',color:'#0a0a0a',lineHeight:1.8}}>{aiProduced} video üretildi</div>
                      <div style={{fontSize:'11px',color:'#888'}}>{aiPurchased} video satın alındı</div>
                    </div>
                  )}
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

              {/* BRIEF LIST */}
              {nonDrafts.length > 0 && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.08)',borderRadius:'10px',overflow:'hidden'}}>
                  {nonDrafts.map((b, i) => {
                    const isDone = b.status === 'delivered' || b.status === 'approved'
                    const aiList = getAiIndicators(b)
                    const cpsInd = getCpsIndicator(b)
                    return (
                      <div key={b.id} onClick={()=>router.push(`/dashboard/client/briefs/${b.id}`)}
                        style={{padding:'14px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:'12px',borderTop:i>0?'0.5px solid rgba(0,0,0,0.05)':'none',transition:'background 0.1s',background:isDone?'#f9f9f7':'#fff',borderLeft:isDone?'2px solid #22c55e':'2px solid transparent'}}
                        onMouseEnter={e=>(e.currentTarget.style.background=isDone?'#f4f4f2':'#fafaf8')}
                        onMouseLeave={e=>(e.currentTarget.style.background=isDone?'#f9f9f7':'#fff')}>
                        {videoMap[b.id] && (
                          <div style={{width:'36px',height:'64px',borderRadius:'6px',overflow:'hidden',background:'#0a0a0a',flexShrink:0}}>
                            <video src={videoMap[b.id]+'#t=0.1'} muted playsInline preload="metadata" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                          </div>
                        )}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:'13px',fontWeight:'600',color:'#0a0a0a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',letterSpacing:'-0.2px'}}>{b.campaign_name}</div>
                          <div style={{fontSize:'10px',color:'#999',marginTop:'3px'}}>{b.video_type} · {new Date(b.updated_at || b.created_at).toLocaleDateString('tr-TR')}</div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:'6px',flexShrink:0}}>
                          {aiList.map((ai,ai_i) => <span key={ai_i} style={{fontSize:'9px',padding:'3px 8px',borderRadius:'6px',background:`${ai.color}12`,color:ai.color,fontWeight:'600',display:'flex',alignItems:'center',gap:'3px',whiteSpace:'nowrap'}}>{ai.label==='Üretiliyor'?'':'\u26A1'} {ai.label}</span>)}
                          {cpsInd && <span style={{fontSize:'9px',padding:'3px 8px',borderRadius:'6px',background:`${cpsInd.color}12`,color:cpsInd.color,fontWeight:'600',display:'flex',alignItems:'center',gap:'3px',whiteSpace:'nowrap'}}>&#9638; {cpsInd.label}</span>}
                          <span style={{fontSize:'10px',padding:'4px 12px',borderRadius:'6px',background:`${statusColor[b.status]||'#888'}12`,color:statusColor[b.status]||'#888',fontWeight:'500',whiteSpace:'nowrap'}}>{statusLabel[b.status]||b.status}</span>
                        </div>
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
