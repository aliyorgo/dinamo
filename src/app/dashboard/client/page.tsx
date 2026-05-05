'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useClientContext } from './layout'

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
  const { userName, companyName, credits, clientUserId, clientId } = useClientContext()
  const [briefs, setBriefs] = useState<any[]>([])
  const [videoMap, setVideoMap] = useState<Record<string,string>>({})
  const [aiChildrenMap, setAiChildrenMap] = useState<Record<string, any[]>>({})
  const [cpsChildrenMap, setCpsChildrenMap] = useState<Record<string, any[]>>({})
  const [ugcReadyMap, setUgcReadyMap] = useState<Record<string, any[]>>({})
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
    if (!clientId) return
    async function load() {
        const { data: b, error: bError } = await supabase.from('briefs').select('*').eq('client_id', clientId).neq('status','cancelled').is('parent_brief_id', null).eq('brief_type', 'primary').order('created_at', { ascending: false })
        console.log('[DEBUG] clientId:', clientId, '| briefs:', b?.length, '| error:', bError)
        setBriefs(b || [])

        // Fetch AI children for indicators
        const briefIds = (b || []).map(br => br.id)
        const rootIds = (b || []).map(br => br.root_campaign_id).filter(Boolean)
        const allLookupIds = [...new Set([...briefIds, ...rootIds])]
        if (allLookupIds.length > 0) {
          // Query by both root_campaign_id and parent_brief_id as fallback
          const { data: aiKids, error: aiErr } = await supabase.from('briefs')
            .select('id, root_campaign_id, parent_brief_id, status, ai_video_status, ai_video_url, created_at, campaign_name, ai_express_viewed_at')
            .eq('client_id', clientId)
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
            .select('id, root_campaign_id, parent_brief_id, status, brief_type, campaign_name, cps_hook, cps_ton, mvc_order')
            .eq('client_id', clientId)
            .eq('brief_type', 'cps_child')
          const cpsMap: Record<string, any[]> = {}
          cpsKids?.forEach((k: any) => {
            const key = k.root_campaign_id || k.parent_brief_id
            if (key) { if (!cpsMap[key]) cpsMap[key] = []; cpsMap[key].push(k) }
          })
          setCpsChildrenMap(cpsMap)

          // UGC videos — unviewed ready
          const { data: ugcVids } = await supabase.from('ugc_videos')
            .select('id, brief_id, final_url, viewed_at, created_at, personas(name, slug)')
            .in('brief_id', briefIds)
            .eq('status', 'ready')
            .is('viewed_at', null)
          const ugcMap: Record<string, any[]> = {}
          ugcVids?.forEach((v: any) => {
            if (!ugcMap[v.brief_id]) ugcMap[v.brief_id] = []
            ugcMap[v.brief_id].push(v)
          })
          setUgcReadyMap(ugcMap)
        }

        const withVideoIds = (b || []).filter(br => ['delivered','approved'].includes(br.status)).map(br => br.id)
        if (withVideoIds.length > 0) {
          const { data: vids } = await supabase.from('video_submissions').select('brief_id, video_url').in('brief_id', withVideoIds).order('version', { ascending: false })
          const map: Record<string,string> = {}
          vids?.forEach((v: any) => { if (!map[v.brief_id]) map[v.brief_id] = v.video_url })
          setVideoMap(map)
        }

        // Notifications
        const { data: notifs } = await supabase.from('notifications').select('*').eq('client_user_id', clientUserId).order('created_at', { ascending: false }).limit(10)
        setNotifications(notifs || [])

        // Stats
        const { data: txns } = await supabase.from('credit_transactions').select('amount').eq('client_id', clientId).lt('amount', 0)
        setTotalSpent(Math.abs((txns || []).reduce((s: number, t: any) => s + t.amount, 0)))

        // Avg delivery
        const delivered = (b || []).filter(br => br.status === 'delivered' && br.updated_at)
        if (delivered.length > 0) {
          const totalDays = delivered.reduce((s: number, br: any) => s + (new Date(br.updated_at).getTime() - new Date(br.created_at).getTime()) / 86400000, 0)
          setAvgDelivery(Math.round(totalDays / delivered.length * 10) / 10)
        }

        // AI video stats
        const { count: aiProd } = await supabase.from('briefs').select('id', { count: 'exact', head: true }).eq('client_id', clientId).ilike('campaign_name', '%Full AI%').not('ai_video_url', 'is', null)
        setAiProduced(aiProd || 0)
        const { data: aiPurchData } = await supabase.from('video_submissions').select('id, briefs!inner(client_id)').eq('is_ai_generated', true).eq('briefs.client_id', clientId)
        setAiPurchased(aiPurchData?.length || 0)

        // Activities (last 5 briefs activity)
        const acts: any[] = []
        for (const br of (b || []).slice(0, 10)) {
          acts.push({ msg: `${br.campaign_name} — ${statusLabel[br.status] || br.status}`, date: br.updated_at || br.created_at })
        }
        acts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setActivities(acts.slice(0, 5))

        // Unanswered questions
        const briefIds2 = (b || []).map((br: any) => br.id)
        if (briefIds2.length > 0) {
          const { data: qs } = await supabase.from('brief_questions').select('id, brief_id, question, asked_at, briefs!inner(campaign_name)').in('brief_id', briefIds2).is('answer', null).not('question', 'like', 'REVİZYON:%').not('question', 'like', 'İÇ REVİZYON:%').order('asked_at', { ascending: false })
          setUnansweredQuestions(qs || [])
        }

      const { data: hvids } = await supabase.from('homepage_videos').select('id, title, video_url').eq('is_active', true).order('created_at', { ascending: false }).limit(10)
      const shuffled = (hvids || []).sort(() => Math.random() - 0.5).slice(0, 3)
      setHomeVideos(shuffled)
      setLoading(false)
    }
    load()
  }, [clientId])

  // Poll processing briefs + AI children every 10s
  const aiChildrenRef = useRef(aiChildrenMap)
  aiChildrenRef.current = aiChildrenMap
  const briefsRef = useRef(briefs)
  briefsRef.current = briefs

  useEffect(() => {
    if (!clientId) return
    const interval = setInterval(async () => {
      const currentBriefs = briefsRef.current
      const currentAiMap = aiChildrenRef.current
      const hasProcessing = currentBriefs.some(b => b.status === 'ai_processing' || b.status === 'ai_completed' || b.ugc_status === 'queued' || b.ugc_status === 'generating') ||
        Object.values(currentAiMap).some((kids: any[]) => kids.some(k => k.status === 'ai_processing' && !k.ai_video_url))
      if (!hasProcessing) return

      // Refresh parent briefs
      const processing = currentBriefs.filter(b => b.status === 'ai_processing' || b.status === 'ai_completed' || b.ugc_status === 'queued' || b.ugc_status === 'generating')
      if (processing.length > 0) {
        const { data } = await supabase.from('briefs').select('id, status, ai_video_status, ugc_status').in('id', processing.map(b => b.id))
        if (data) {
          setBriefs(prev => prev.map(b => {
            const updated = data.find((d: any) => d.id === b.id)
            return updated && (updated.status !== b.status || updated.ai_video_status !== b.ai_video_status || updated.ugc_status !== b.ugc_status) ? { ...b, ...updated } : b
          }))
        }
      }
      // Refresh AI children
      const { data: aiKids } = await supabase.from('briefs')
        .select('id, root_campaign_id, parent_brief_id, status, ai_video_status, ai_video_url, created_at, campaign_name, ai_express_viewed_at')
        .eq('client_id', clientId)
        .ilike('campaign_name', '%Full AI%')
      if (aiKids) {
        const map: Record<string, any[]> = {}
        aiKids.forEach((k: any) => {
          const key = k.root_campaign_id || k.parent_brief_id
          if (key) { if (!map[key]) map[key] = []; map[key].push(k) }
        })
        setAiChildrenMap(map)
      }
      // Refresh UGC ready videos
      const ugcProcessing = currentBriefs.filter(b => b.ugc_status === 'queued' || b.ugc_status === 'generating')
      if (ugcProcessing.length > 0) {
        const { data: ugcVids } = await supabase.from('ugc_videos')
          .select('id, brief_id, final_url, viewed_at, created_at, personas(name, slug)')
          .in('brief_id', ugcProcessing.map(b => b.id))
          .eq('status', 'ready')
          .is('viewed_at', null)
        if (ugcVids) {
          const ugcMap: Record<string, any[]> = {}
          ugcVids.forEach((v: any) => {
            if (!ugcMap[v.brief_id]) ugcMap[v.brief_id] = []
            ugcMap[v.brief_id].push(v)
          })
          setUgcReadyMap(prev => ({ ...prev, ...ugcMap }))
        }
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [clientId])

  async function markNotifRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function handleLogout() { await supabase.auth.signOut(); router.push('/login') }

  // Category filters
  const [unansweredQuestions, setUnansweredQuestions] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<'categories'|'timeline'>('categories')

  // Helper: get brief indicators
  function getBriefIndicators(b: any) {
    const aiKids = aiChildrenMap[b.root_campaign_id] || aiChildrenMap[b.id] || []
    const cpsKids = cpsChildrenMap[b.root_campaign_id] || cpsChildrenMap[b.id] || []
    const indicators: { label: string; pulse?: boolean }[] = []
    if (aiKids.length > 0) {
      const processing = aiKids.some((k: any) => k.status === 'ai_processing' && !k.ai_video_url)
      indicators.push({ label: `AI EXPRESS · ${aiKids.length}`, pulse: processing })
    }
    if (cpsKids.length > 0) indicators.push({ label: `CPS · ${cpsKids.length} YÖN` })
    if (b.ugc_status) {
      const ugcProcessing = b.ugc_status === 'queued' || b.ugc_status === 'generating'
      indicators.push({ label: 'AI UGC', pulse: ugcProcessing })
    }
    if (b.static_image_files || b.static_images_url) indicators.push({ label: 'GÖRSEL' })
    return indicators
  }

  // Assign each brief to exactly ONE category (most critical wins)
  function getBriefCategory(b: any): 'question' | 'approval' | 'ai_ready' | 'ugc_ready' | 'producing' | 'draft' | 'done' {
    if (b.status === 'draft') return 'draft'

    const briefQs = unansweredQuestions.filter(q => q.brief_id === b.id)
    if (briefQs.length > 0) return 'question'

    // Check CPS children pending approval
    const cpsKids = cpsChildrenMap[b.root_campaign_id] || cpsChildrenMap[b.id] || []
    const cpsPending = cpsKids.filter((k: any) => k.status === 'approved')
    if (b.status === 'approved' || cpsPending.length > 0) return 'approval'

    // AI Express unviewed
    const aiKids = aiChildrenMap[b.root_campaign_id] || aiChildrenMap[b.id] || []
    const aiUnviewed = aiKids.filter((k: any) => k.ai_video_url && !k.ai_express_viewed_at && k.ai_video_status !== 'failed' && k.ai_video_status !== 'timeout')
    if (aiUnviewed.length > 0) return 'ai_ready'

    // UGC unviewed
    const ugcUnviewed = ugcReadyMap[b.id] || []
    if (ugcUnviewed.length > 0) return 'ugc_ready'

    // "Done" = ana video delivered + all CPS delivered
    if (b.status === 'delivered') {
      const allCpsDone = cpsKids.length === 0 || cpsKids.every((k: any) => k.status === 'delivered')
      if (allCpsDone) return 'done'
      return 'approval' // CPS not done yet
    }

    if (['submitted', 'read', 'in_production', 'revision', 'ai_processing', 'ai_completed'].includes(b.status)) return 'producing'
    return 'done'
  }

  const drafts = briefs.filter(b => b.status === 'draft')
  const nonDrafts = briefs.filter(b => b.status !== 'draft')
  const catQuestion = nonDrafts.filter(b => getBriefCategory(b) === 'question')
  const catApproval = nonDrafts.filter(b => getBriefCategory(b) === 'approval')
  const catAiReady = nonDrafts.filter(b => getBriefCategory(b) === 'ai_ready')
  const catUgcReady = nonDrafts.filter(b => getBriefCategory(b) === 'ugc_ready')
  const catProducing = nonDrafts.filter(b => getBriefCategory(b) === 'producing')
  const catDone = nonDrafts.filter(b => getBriefCategory(b) === 'done')

  // CPS pending for approval cards
  const cpsPendingApproval: any[] = []
  Object.values(cpsChildrenMap).forEach((kids: any[]) => {
    kids.forEach(k => { if (k.status === 'approved') cpsPendingApproval.push(k) })
  })

  // AI Express unviewed for cards
  const aiExpressReady: { parent: any; children: any[] }[] = []
  catAiReady.forEach(b => {
    const kids = (aiChildrenMap[b.root_campaign_id] || aiChildrenMap[b.id] || []).filter((k: any) => k.ai_video_url && !k.ai_express_viewed_at && k.ai_video_status !== 'failed' && k.ai_video_status !== 'timeout')
    if (kids.length > 0) aiExpressReady.push({ parent: b, children: kids })
  })
  const aiExpressCount = aiExpressReady.reduce((s, r) => s + r.children.length, 0)

  // UGC Ready unviewed for cards
  const ugcReadyList: { brief: any; videos: any[] }[] = []
  catUgcReady.forEach(b => {
    const vids = ugcReadyMap[b.id] || []
    if (vids.length > 0) ugcReadyList.push({ brief: b, videos: vids })
  })
  const ugcReadyCount = ugcReadyList.reduce((s, r) => s + r.videos.length, 0)

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
    <div style={{display:'flex',minHeight:'100vh',}}>

      {/* SIDEBAR */}
      <div style={{width:'240px',background:'#0A0A0A',display:'flex',flexDirection:'column',flexShrink:0,height:'100dvh',overflowY:'auto'}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)',cursor:'pointer'}} onClick={()=>router.push('/dashboard/client')}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{height:'28px'}} />
        </div>
        <div style={{margin:'12px 12px',padding:'16px 20px',background:'rgba(29,184,29,0.06)',borderLeft:'3px solid #1DB81D'}}>
          <div style={{fontSize:'18px',fontWeight:'700',color:'#fff',marginBottom:'2px'}}>{companyName || 'Dinamo'}</div>
          <div style={{fontSize:'13px',fontWeight:'400',color:'#888',marginBottom:'12px'}}>{userName}</div>
          <div style={{fontSize:'10px',color:'#AAA',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'8px'}}>KREDİ BAKİYESİ</div>
          <div style={{fontSize:'28px',fontWeight:'700',color:'#1DB81D',letterSpacing:'-1px'}}>{credits}</div>
        </div>
        <nav style={{padding:'10px 8px'}}>
          {[
            {label:'Projelerim', href:'/dashboard/client', active:true},
            {label:'Yeni Brief', href:'/dashboard/client/brief/new', active:false},
            {label:'Marka Ayarları', href:'/dashboard/client/brand-identity', active:false},
            {label:'Raporlar', href:'/dashboard/client/reports', active:false},
            {label:'Telif Belgeleri', href:'/dashboard/client/certificates', active:false},
            {label:'İçerik Güvencesi', href:'/dashboard/client/guarantee', active:false},
          ].map(item=>(
            <div key={item.href} onClick={()=>router.push(item.href)}
              onMouseEnter={e=>{if(!item.active){e.currentTarget.style.background='rgba(255,255,255,0.06)';e.currentTarget.style.borderLeft='2px solid #1DB81D';(e.currentTarget.firstChild as HTMLElement).style.color='#fff'}}}
              onMouseLeave={e=>{if(!item.active){e.currentTarget.style.background='transparent';e.currentTarget.style.borderLeft='2px solid transparent';(e.currentTarget.firstChild as HTMLElement).style.color='rgba(255,255,255,0.4)'}}}
              style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',cursor:'pointer',background:item.active?'rgba(255,255,255,0.08)':'transparent',borderLeft:item.active?'2px solid #1DB81D':'2px solid transparent',marginBottom:'1px',transition:'all 0.15s ease'}}>
              <span style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:item.active?'#fff':'rgba(255,255,255,0.4)',fontWeight:'500',transition:'color 0.15s ease'}}>{item.label}</span>
            </div>
          ))}
          <button onClick={handleLogout}
            onMouseEnter={e=>{(e.currentTarget.firstChild as HTMLElement).style.color='#FF4444'}}
            onMouseLeave={e=>{(e.currentTarget.firstChild as HTMLElement).style.color='#aaa'}}
            style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',marginTop:'16px',cursor:'pointer',width:'100%',background:'none',border:'none'}}>
            <span style={{fontSize:'11px',color:'#aaa',transition:'color 0.15s'}}>Çıkış yap</span>
          </button>
          <img src="/powered_by_dcc.png" alt="Powered by DCC" style={{height:'20px',width:'auto',opacity:0.6,display:'block',margin:'8px 8px',cursor:'pointer'}} onClick={()=>window.open('https://dirtycheapcreative.com','_blank')} />
        </nav>
      </div>

      {/* MAIN */}
      <div style={{flex:1,display:'flex',flexDirection:'column'}}>
        {/* TOP BAR with notifications */}
        <div style={{padding:'10px 28px',background:'#fff',borderBottom:'0.5px solid rgba(0,0,0,0.08)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          {briefs.length > 0 && <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>Projelerim</div>}
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
            style={{background:'#111113',color:'#fff',border:'none',padding:'8px 18px',fontSize:'12px',cursor:'pointer',fontWeight:'500',flexShrink:0,transition:'all 0.15s ease'}}>
            + Yeni Brief
          </button>
          </div>
        </div>

        <div style={{flex:1}}>
          {loading ? (
            <div style={{padding:'24px 28px',color:'#888',fontSize:'14px'}}>Yükleniyor...</div>
          ) : briefs.length === 0 ? (
            /* WELCOME SCREEN */
            <div style={{background:'var(--color-background-secondary)',minHeight:'100%',display:'flex',flexDirection:'column',position:'relative'}}>

              <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 48px'}}>
                <div style={{maxWidth:'600px',width:'100%'}}>
                  {/* Hero */}
                  <h1 style={{fontSize:'40px',fontWeight:'500',color:'var(--color-text-secondary)',letterSpacing:'-0.02em',lineHeight:1.1,margin:0}}>
                    Hoş geldiniz,
                  </h1>
                  {companyName && (
                    <h1 style={{fontSize:'40px',fontWeight:'600',color:'var(--color-text-primary)',letterSpacing:'-0.02em',lineHeight:1.1,margin:'0 0 12px 0'}}>
                      {companyName}.
                    </h1>
                  )}
                  <div style={{width:'40px',height:'2px',background:'#4ade80',marginBottom:'20px'}}></div>
                  <p style={{fontSize:'16px',color:'var(--color-text-secondary)',lineHeight:1.65,margin:'0 0 40px 0'}}>
                    Brief'inizi oluşturun, 24 saat içinde videonuz hazır.
                  </p>

                  {/* CTA */}
                  <button onClick={()=>router.push('/dashboard/client/brief/new')} className="btn" style={{padding:'16px 36px',marginBottom:'40px'}}>
                    İLK BRİEF'İ OLUŞTUR →
                  </button>

                  {/* How it works */}
                  <div style={{ marginBottom: '40px' }}>
                    <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: '500', marginBottom: '16px' }}>NASIL ÇALIŞIR</div>
                    {[
                      { n: '01', t: 'Brief yazın — ne istediğinizi anlatın' },
                      { n: '02', t: 'Prodüktör onaylar — ekibimiz üretir' },
                      { n: '03', t: 'Video teslim — onayla ve indir' },
                    ].map(s => (
                      <div key={s.n} style={{ display: 'flex', gap: '12px', marginBottom: '8px', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: '#4ade80', flexShrink: 0 }}>{s.n}</span>
                        <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>{s.t}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: '24px' }}>
                    Her brief gönderdikten sonra AI Express ve Creative Performance System özelliklerine erişirsiniz. AI Express ile briefinizden ~5 dakikada yapay zeka videosu üretin, CPS ile aynı kampanyadan farklı yaratıcı yönler ve varyasyonlar oluşturun.
                  </div>

                  {/* AI UGC Section */}
                  <div style={{ marginBottom: '40px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: '500' }}>AI UGC</div>
                      <span style={{ fontSize: '9px', padding: '2px 6px', background: '#4ade80', color: '#fff', fontWeight: '600' }}>Beta</span>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '8px' }}>AI UGC — Influencer Tarzı Dikey Video</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '12px' }}>Dinamo müşterilerine özel</div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
                      AI influencer videolarıyla mesajınızı çeşitlendirin. 3 dakikada seçtiğiniz persona brief'ten üretilen metni doğal ve karakterine uygun şekilde okusun.
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
                      Dinamo AI UGC, briefinizi ve seçtiğiniz personayı okur. Karakter, ortam, konuşma metni, ses ve dudak senkronu — tamamı yapay zeka tarafından üretilir. 8 saniyelik dikey video, 1 kredi ile, gerçek bir creator izlenimi yaratır. Ton, müzik ve CTA tercihlerinizi siz belirlersiniz.
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
                      AI UGC'yle TikTok ve Reels için içerik üretimini hızlandırın. Farklı personaları test edin, hangi tonun marka için doğru olduğunu görün, kampanyanızı dağıtmadan önce hissini deneyin.
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                      Beta sürecindedir. Sonuçlar garanti edilmez. Türkçe seslendirme ve karakter tutarlılığında iyileştirmeler devam ediyor — ama UGC stilinde içerik üretiminin maliyetini ve hızını değiştirir.
                    </div>
                  </div>

                  {/* Video grid */}
                  {homeVideos.length > 0 && (
                    <div style={{marginBottom:'40px'}}>
                      <div style={{fontSize:'11px',letterSpacing:'2px',textTransform:'uppercase',color:'var(--color-text-tertiary)',fontWeight:'500',marginBottom:'16px'}}>
                        DİNAMO İLE ÜRETİLDİ
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
                        {homeVideos.map(v=>(
                          <div key={v.id} style={{position:'relative',overflow:'hidden',aspectRatio:'9/16',background:'#0a0a0a',cursor:'pointer',border:'1px solid var(--color-border-tertiary)'}}
                            onMouseEnter={e=>{const vid=e.currentTarget.querySelector('video') as HTMLVideoElement;if(vid)vid.play().catch(()=>{});const ov=e.currentTarget.querySelector('[data-ov]') as HTMLElement;if(ov)ov.style.opacity='0'}}
                            onMouseLeave={e=>{const vid=e.currentTarget.querySelector('video') as HTMLVideoElement;if(vid){vid.pause();vid.currentTime=0}const ov=e.currentTarget.querySelector('[data-ov]') as HTMLElement;if(ov)ov.style.opacity='1'}}>
                            <video src={v.video_url} loop muted playsInline preload="metadata" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                            <div data-ov="" style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'flex-end',padding:'10px',transition:'opacity 0.3s'}}>
                              <span style={{fontSize:'11px',fontWeight:'500',color:'#fff'}}>{v.title || ''}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{padding:'20px',textAlign:'center'}}>
                <span style={{fontSize:'11px',color:'var(--color-text-tertiary)'}}>Sorularınız için hello@dinamo.media</span>
              </div>
            </div>
          ) : (
            <div style={{padding:'20px 28px',display:'flex',flexDirection:'column',gap:'24px'}}>

              {/* VIEW MODE TOGGLE */}
              {nonDrafts.length > 0 && (
                <div style={{display:'flex',gap:'0'}}>
                  {([['categories','İŞLERE GÖRE'],['timeline','TARİHE GÖRE']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setViewMode(key)}
                      style={{padding:'7px 18px',fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',cursor:'pointer',border:'1px solid #0a0a0a',background:viewMode===key?'#0a0a0a':'#fff',color:viewMode===key?'#fff':'#0a0a0a',marginRight:key==='categories'?'-1px':'0',transition:'all 0.15s'}}>
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {viewMode === 'categories' && <>
              {/* 1) SORUMUZ VAR */}
              {catQuestion.length > 0 && (
                <div>
                  <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:'#ef4444',marginBottom:'10px'}}>SORUMUZ VAR · {catQuestion.length}</div>
                  <div style={{fontSize:'11px',color:'var(--color-text-tertiary)',marginBottom:'10px'}}>Cevap vermeniz gereken sorular var</div>
                  {catQuestion.map(b => {
                    const briefQs = unansweredQuestions.filter(q => q.brief_id === b.id)
                    return briefQs.map(q => (
                      <div key={q.id} onClick={() => router.push(`/dashboard/client/briefs/${q.brief_id}`)}
                        style={{padding:'12px 16px',background:'#fff',borderLeft:'3px solid #ef4444',border:'1px solid #e5e4db',marginBottom:'6px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{b.campaign_name}</div>
                          <div style={{fontSize:'11px',color:'#888',marginTop:'2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'400px'}}>{q.question}</div>
                        </div>
                        <span style={{fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'#ef4444',fontWeight:'500',flexShrink:0}}>CEVAPLA →</span>
                      </div>
                    ))
                  })}
                </div>
              )}

              {/* 2) ONAY BEKLEYEN */}
              {catApproval.length > 0 && (
                <div>
                  <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:'#f5a623',marginBottom:'10px'}}>ONAY BEKLEYEN · {catApproval.reduce((s, b) => {
                    const cpsKids = cpsChildrenMap[b.root_campaign_id] || cpsChildrenMap[b.id] || []
                    return s + (b.status === 'approved' ? 1 : 0) + cpsKids.filter((k: any) => k.status === 'approved').length
                  }, 0)}</div>
                  <div className="approval-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                    {catApproval.flatMap(b => {
                      const cpsKids = cpsChildrenMap[b.root_campaign_id] || cpsChildrenMap[b.id] || []
                      const cpsPending = cpsKids.filter((k: any) => k.status === 'approved')
                      const cards: React.ReactNode[] = []
                      if (b.status === 'approved') {
                        cards.push(
                          <div key={`main-${b.id}`} onClick={() => router.push(`/dashboard/client/briefs/${b.id}`)}
                            style={{padding:'12px 14px',background:'#fff',borderLeft:'3px solid #f5a623',border:'1px solid #e5e4db',cursor:'pointer',display:'flex',alignItems:'center',gap:'10px'}}>
                            {videoMap[b.id] && <div style={{width:'32px',height:'56px',overflow:'hidden',background:'#0a0a0a',flexShrink:0}}><video src={videoMap[b.id]+'#t=0.1'} muted playsInline preload="metadata" style={{width:'100%',height:'100%',objectFit:'cover'}} /></div>}
                            <div><div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>{b.campaign_name}</div><div style={{fontSize:'10px',color:'#888',marginTop:'2px'}}>Ana Video</div></div>
                          </div>
                        )
                      }
                      cpsPending.forEach((k: any) => {
                        cards.push(
                          <div key={`cps-${k.id}`} onClick={() => router.push(`/dashboard/client/briefs/${b.id}?tab=cps`)}
                            style={{padding:'12px 14px',background:'#fff',borderLeft:'3px solid #f5a623',border:'1px solid #e5e4db',cursor:'pointer',display:'flex',alignItems:'center',gap:'10px'}}>
                            <div style={{width:'32px',height:'32px',background:'rgba(245,166,35,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:'12px',fontWeight:'600',color:'#f5a623'}}>{k.mvc_order || '?'}</span></div>
                            <div><div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>{b.campaign_name}</div><div style={{fontSize:'10px',color:'#888',marginTop:'2px'}}>CPS {k.cps_hook ? `· ${k.cps_hook}` : `Yön ${k.mvc_order || ''}`}</div></div>
                          </div>
                        )
                      })
                      return cards
                    })}
                  </div>
                </div>
              )}

              {/* 3) AI EXPRESS HAZIR */}
              {catAiReady.length > 0 && (
                <div>
                  <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:'#4ade80',marginBottom:'10px'}}>AI EXPRESS HAZIR · {aiExpressCount}</div>
                  <div className="ai-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
                    {aiExpressReady.map(({ parent, children }) => children.map((kid: any, i: number) => {
                      const versionPart = kid.campaign_name?.split('—')[1]?.trim() || ''
                      const versionNum = versionPart.match(/#(\d+)/)?.[1] || String(i + 1)
                      return (
                        <div key={kid.id} onClick={() => router.push(`/dashboard/client/briefs/${parent.id}?tab=express&ai_child=${kid.id}`)}
                          style={{padding:'12px 14px',background:'#fff',borderLeft:'3px solid #4ade80',border:'1px solid #e5e4db',cursor:'pointer',position:'relative'}}>
                          <div style={{position:'absolute',top:'8px',right:'8px',width:'8px',height:'8px',borderRadius:'50%',background:'#4ade80'}} />
                          <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>{parent.campaign_name}</div>
                          <div style={{fontSize:'10px',letterSpacing:'1px',textTransform:'uppercase',color:'#888',marginTop:'3px'}}>VERSİYON {versionNum}{versionPart && !versionPart.startsWith('Full AI') ? ` · ${versionPart.replace(/Full AI #\d+/,'').trim()}` : ''}</div>
                        </div>
                      )
                    }))}
                  </div>
                </div>
              )}

              {/* 3.5) AI UGC HAZIR */}
              {catUgcReady.length > 0 && (
                <div>
                  <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:'#4ade80',marginBottom:'10px'}}>AI UGC HAZIR · {ugcReadyCount}</div>
                  <div className="ai-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
                    {ugcReadyList.map(({ brief: parent, videos }) => videos.map((vid: any, i: number) => (
                      <div key={vid.id} onClick={() => router.push(`/dashboard/client/briefs/${parent.id}?tab=ugc&video=${vid.id}`)}
                        style={{padding:'12px 14px',background:'#fff',borderLeft:'3px solid #4ade80',border:'1px solid #e5e4db',cursor:'pointer',position:'relative'}}>
                        <div style={{position:'absolute',top:'8px',right:'8px',width:'8px',height:'8px',borderRadius:'50%',background:'#4ade80'}} />
                        <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>{parent.campaign_name}</div>
                        <div style={{fontSize:'10px',letterSpacing:'1px',textTransform:'uppercase',color:'#888',marginTop:'3px'}}>UGC · {vid.personas?.name || `Video ${i + 1}`}</div>
                      </div>
                    )))}
                  </div>
                </div>
              )}

              {/* 4) ÜRETİLİYOR */}
              {catProducing.length > 0 && (
                <div>
                  <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:'var(--color-text-secondary)',marginBottom:'10px'}}>ÜRETİLİYOR · {catProducing.length}</div>
                  <div style={{fontSize:'11px',color:'var(--color-text-tertiary)',marginBottom:'10px'}}>Ekibimiz çalışıyor, kısa süre içinde teslim edilecek</div>
                  {catProducing.map(b => {
                    const inds = getBriefIndicators(b)
                    return (
                      <div key={b.id} onClick={() => router.push(`/dashboard/client/briefs/${b.id}`)}
                        style={{padding:'12px 16px',background:'#fff',border:'1px solid #e5e4db',marginBottom:'6px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{b.campaign_name}</div>
                          <div style={{fontSize:'10px',color:'#888',marginTop:'2px'}}>{b.video_type} · {statusLabel[b.status]}</div>
                          {inds.length > 0 && <div style={{display:'flex',gap:'6px',marginTop:'4px'}}>{inds.map((ind,i) => <span key={i} style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',padding:'2px 7px',border:'1px solid #e5e4db',background:'#fafaf7',color:'#0a0a0a',whiteSpace:'nowrap',display:'inline-flex',alignItems:'center',gap:'5px'}}>{ind.pulse && <span className="dot" style={{width:'6px',height:'6px',minWidth:'6px',minHeight:'6px',background:'#4ade80',display:'inline-block',animation:'ai-pulse 1.2s ease-in-out infinite',flexShrink:0}} />}{ind.label}</span>)}</div>}
                        </div>
                        <span style={{fontSize:'10px',padding:'3px 8px',background:`${statusColor[b.status]}12`,color:statusColor[b.status],fontWeight:'500'}}>{statusLabel[b.status]}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 5) TASLAKTA */}
              {drafts.length > 0 && (
                <div>
                  <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:'var(--color-text-tertiary)',marginBottom:'10px'}}>TASLAKTA · {drafts.length}</div>
                  {drafts.map(b => (
                    <div key={b.id} style={{padding:'12px 16px',background:'#fff',border:'1px solid #e5e4db',marginBottom:'6px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{flex:1,cursor:'pointer'}} onClick={() => router.push(`/dashboard/client/brief/new?draft=${b.id}`)}>
                        <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{b.campaign_name || 'İsimsiz Taslak'}</div>
                        <div style={{fontSize:'10px',color:'#888',marginTop:'2px'}}>Son düzenleme: {timeAgo(b.updated_at || b.created_at)}</div>
                      </div>
                      <div style={{display:'flex',gap:'8px',flexShrink:0}}>
                        <span onClick={() => router.push(`/dashboard/client/brief/new?draft=${b.id}`)} style={{fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'#0a0a0a',fontWeight:'500',cursor:'pointer'}}>DEVAM ET →</span>
                        <button onClick={() => handleDeleteDraft(b.id)} style={{fontSize:'13px',color:'#888',background:'none',border:'none',cursor:'pointer',padding:'0 4px'}}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 6) TAMAMLANAN KAMPANYALAR */}
              {catDone.length > 0 && (
                <div>
                  <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:'var(--color-text-secondary)',marginBottom:'10px'}}>TAMAMLANAN KAMPANYALAR · {catDone.length}</div>
                  <div className="done-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(160px, 190px))',gap:'14px',justifyContent:'start'}}>
                    {catDone.map(b => {
                      const inds = getBriefIndicators(b)
                      return (
                        <div key={b.id} onClick={() => router.push(`/dashboard/client/briefs/${b.id}`)}
                          style={{background:'#fff',border:'1px solid #e5e4db',cursor:'pointer',overflow:'hidden'}}>
                          {videoMap[b.id] ? (
                            <div style={{aspectRatio:'9/16',overflow:'hidden',background:'#0a0a0a'}}><video src={videoMap[b.id]+'#t=0.5'} muted playsInline preload="metadata" style={{width:'100%',height:'100%',objectFit:'cover'}} /></div>
                          ) : (
                            <div style={{aspectRatio:'9/16',background:'var(--color-background-secondary)',display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:'10px',color:'var(--color-text-tertiary)'}}>Video</span></div>
                          )}
                          <div style={{padding:'8px 10px'}}>
                            <div style={{fontSize:'11px',fontWeight:'500',color:'#0a0a0a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.campaign_name}</div>
                            <div style={{fontSize:'9px',color:'#888',marginTop:'2px'}}>{new Date(b.updated_at || b.created_at).toLocaleDateString('tr-TR')}</div>
                            {inds.length > 0 && <div style={{display:'flex',gap:'4px',marginTop:'4px',flexWrap:'wrap'}}>{inds.map((ind,i) => <span key={i} style={{fontSize:'8px',letterSpacing:'1px',textTransform:'uppercase',padding:'1px 5px',border:'1px solid #e5e4db',color:'#888',whiteSpace:'nowrap',display:'inline-flex',alignItems:'center',gap:'4px'}}>{ind.pulse && <span className="dot" style={{width:'5px',height:'5px',minWidth:'5px',minHeight:'5px',background:'#4ade80',display:'inline-block',animation:'ai-pulse 1.2s ease-in-out infinite',flexShrink:0}} />}{ind.label}</span>)}</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              </>}

              {/* TIMELINE VIEW */}
              {viewMode === 'timeline' && (
                <div>
                  {[...nonDrafts, ...drafts].map(b => {
                    const aiKids = aiChildrenMap[b.root_campaign_id] || aiChildrenMap[b.id] || []
                    const cpsKids = cpsChildrenMap[b.root_campaign_id] || cpsChildrenMap[b.id] || []
                    const aiCount = aiKids.length
                    const cpsCount = cpsKids.length
                    const imgCount = (Array.isArray(b.static_image_files) ? b.static_image_files.length : b.static_image_files ? 1 : 0) * 5
                    const cat = getBriefCategory(b)
                    const catColors: Record<string,string> = { question:'#ef4444', approval:'#f5a623', ai_ready:'#4ade80', ugc_ready:'#4ade80', producing:'#888', done:'var(--color-text-tertiary)', draft:'#c5c5b8' }
                    const catLabels: Record<string,string> = { question:'Sorumuz Var', approval:'Onay Bekliyor', ai_ready:'AI Express Hazır', ugc_ready:'AI UGC Hazır', producing:'Üretiliyor', done:'Tamamlandı', draft:'Taslak' }
                    return (
                      <div key={b.id} onClick={() => b.status === 'draft' ? router.push(`/dashboard/client/brief/new?draft=${b.id}`) : router.push(`/dashboard/client/briefs/${b.id}`)}
                        style={{padding:'14px 18px',background:'#fff',border:'1px solid #e5e4db',marginBottom:'6px',cursor:'pointer',display:'flex',alignItems:'center',gap:'12px'}}>
                        {videoMap[b.id] && <div style={{width:'32px',height:'56px',overflow:'hidden',background:'#0a0a0a',flexShrink:0}}><video src={videoMap[b.id]+'#t=0.1'} muted playsInline preload="metadata" style={{width:'100%',height:'100%',objectFit:'cover'}} /></div>}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.campaign_name || 'İsimsiz Taslak'}</div>
                          <div style={{display:'flex',gap:'6px',marginTop:'5px',flexWrap:'wrap'}}>
                            <span style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',padding:'2px 7px',border:`1px solid ${catColors[cat]}`,color:catColors[cat],fontWeight:'500'}}>{catLabels[cat]}</span>
                            <span style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',padding:'2px 7px',border:'1px solid #e5e4db',color:aiCount > 0 ? '#0a0a0a' : '#c5c5b8',background:aiCount > 0 ? '#fafaf7' : 'transparent'}}>AI EXPRESS · {aiCount}</span>
                            <span style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',padding:'2px 7px',border:'1px solid #e5e4db',color:cpsCount > 0 ? '#0a0a0a' : '#c5c5b8',background:cpsCount > 0 ? '#fafaf7' : 'transparent'}}>CPS · {cpsCount} YÖN</span>
                            <span style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',padding:'2px 7px',border:'1px solid #e5e4db',color:imgCount > 0 ? '#0a0a0a' : '#c5c5b8',background:imgCount > 0 ? '#fafaf7' : 'transparent'}}>GÖRSEL · {imgCount}</span>
                          </div>
                        </div>
                        <div style={{fontSize:'10px',letterSpacing:'1px',textTransform:'uppercase',color:'#aaa',flexShrink:0}}>{new Date(b.updated_at || b.created_at).toLocaleDateString('tr-TR',{day:'numeric',month:'short'})}</div>
                      </div>
                    )
                  })}
                </div>
              )}

              <style>{`
                @keyframes ai-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.85)} }
                @media (max-width: 768px) {
                  .approval-grid { grid-template-columns: 1fr !important; }
                  .ai-grid { grid-template-columns: 1fr !important; }
                  .done-grid { grid-template-columns: repeat(2, 1fr) !important; justify-content: stretch !important; }
                }
              `}</style>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
