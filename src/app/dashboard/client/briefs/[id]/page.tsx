'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams, useRouter } from 'next/navigation'
import { generateCertificatePDF } from '@/lib/generate-certificate'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string,string> = {
  draft:'Taslak', submitted:'İnceleniyor', read:'İncelendi', in_production:'Üretimde',
  revision:'Revizyon', approved:'Onay Bekliyor', delivered:'Teslim Edildi', cancelled:'İptal Edildi'
}
const statusColor: Record<string,string> = {
  draft:'#f59e0b', submitted:'#888', read:'#888', in_production:'#3b82f6',
  revision:'#ef4444', approved:'#f59e0b', delivered:'#22c55e', cancelled:'#555'
}
const REVISION_COST = 4
const BASE_COSTS: Record<string,number> = {'Bumper / Pre-roll':12,'Story / Reels':18,'Feed Video':24,'Long Form':36}
const VIDEO_TYPES = ['Bumper / Pre-roll','Story / Reels','Feed Video','Long Form']

export default function ClientBriefDetail() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [brief, setBrief] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [answers, setAnswers] = useState<Record<string,string>>({})
  const [videos, setVideos] = useState<any[]>([])
  const [clientUser, setClientUser] = useState<any>(null)
  const [companyName, setCompanyName] = useState('')
  const [userName, setUserName] = useState('')
  const [revisionNote, setRevisionNote] = useState('')
  const [revisionCount, setRevisionCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [activeVideoId, setActiveVideoId] = useState<string|null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [approveSuccess, setApproveSuccess] = useState(false)
  const [showReorderModal, setShowReorderModal] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [reorderType, setReorderType] = useState('')
  const [reorderSuccess, setReorderSuccess] = useState(false)
  const [captions, setCaptions] = useState<{tiktok:string[],instagram:string[]}|null>(null)
  const [captionsLoading, setCaptionsLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<string|null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: userData } = await supabase.from('users').select('name').eq('id', user.id).single()
    setUserName(userData?.name || '')
    const { data: cu } = await supabase.from('client_users').select('*, clients(company_name, credit_balance)').eq('user_id', user.id).single()
    setClientUser(cu)
    setCompanyName((cu as any)?.clients?.company_name || '')
    const { data: b } = await supabase.from('briefs').select('*').eq('id', id).single()
    setBrief(b)
    const { data: q } = await supabase.from('brief_questions').select('*').eq('brief_id', id).order('asked_at')
    setQuestions(q || [])
    const { data: v } = await supabase.from('video_submissions').select('*').eq('brief_id', id).order('version', { ascending: true })
    setVideos(v || [])
    const revCount = (q || []).filter((x:any) => x.question.startsWith('REVİZYON:')).length
    setRevisionCount(revCount)
  }

  async function loadCaptions() {
    if (!brief || captionsLoading || captions) return
    setCaptionsLoading(true)
    try {
      const res = await fetch('/api/generate-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_name: brief.campaign_name,
          message: brief.message,
          cta: brief.cta,
          target_audience: brief.target_audience,
          brand_name: companyName,
        })
      })
      const data = await res.json()
      if (data.tiktok && data.instagram) setCaptions(data)
      else if (data.error) console.error('[captions]', data.error)
    } catch (err) { console.error('[captions] fetch error:', err) }
    setCaptionsLoading(false)
  }

  function copyCaption(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedIdx(key)
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  function handleCertificateDownload() {
    if (brief) generateCertificatePDF(brief, companyName)
  }

  async function handleReorder() {
    if (!brief || !clientUser || !reorderType) return
    setReordering(true)
    const fullCost = BASE_COSTS[reorderType] || 12
    const halfCost = Math.ceil(fullCost / 2)
    if (clientUser.allocated_credits < halfCost) { setReordering(false); return }
    const originalId = brief.parent_brief_id || brief.id
    const { count } = await supabase.from('briefs').select('id', { count: 'exact', head: true }).eq('parent_brief_id', originalId)
    const copyNum = (count || 0) + 2
    const baseName = brief.campaign_name.replace(/\s*—\s*\d+$/, '')
    const newName = `${baseName} — ${copyNum}`
    await supabase.from('client_users').update({ credit_balance: clientUser.allocated_credits - halfCost }).eq('id', clientUser.id)
    await supabase.from('credit_transactions').insert({ client_id: brief.client_id, client_user_id: clientUser.id, amount: -halfCost, type: 'deduct', description: `${newName} (tekrar sipariş)` })
    await supabase.from('briefs').insert({
      client_id: brief.client_id, client_user_id: brief.client_user_id,
      campaign_name: newName,
      video_type: reorderType, format: brief.format, message: brief.message,
      cta: brief.cta, target_audience: brief.target_audience,
      voiceover_type: brief.voiceover_type, voiceover_gender: brief.voiceover_gender,
      voiceover_text: brief.voiceover_text, notes: brief.notes,
      status: 'submitted', credit_cost: halfCost,
      parent_brief_id: originalId,
    })
    setReordering(false)
    setReorderSuccess(true)
  }

  async function handleAnswer(qId: string) {
    const answer = answers[qId]
    if (!answer?.trim()) return
    await supabase.from('brief_questions').update({ answer, answered_at: new Date().toISOString() }).eq('id', qId)
    setAnswers(prev => ({...prev, [qId]: ''}))
    loadData()
  }

  function formatTimecode(t: number) {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    const ms = Math.floor((t % 1) * 10)
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${ms}`
  }

  async function handleRevision(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!revisionNote.trim()) { setMsg('Revizyon notunuzu yazın.'); return }
    if (!clientUser || !brief) return
    setLoading(true)
    setMsg('')
    if (revisionCount >= 1) {
      if (clientUser.allocated_credits < REVISION_COST) { setMsg(`Yetersiz kredi. Bu revizyon için ${REVISION_COST} kredi gerekiyor.`); setLoading(false); return }
      await supabase.from('client_users').update({ credit_balance: clientUser.allocated_credits - REVISION_COST }).eq('id', clientUser.id)
      await supabase.from('credit_transactions').insert({ client_id: brief.client_id, client_user_id: clientUser.id, brief_id: id, amount: -REVISION_COST, type: 'deduct', description: `${brief.campaign_name} — ${revisionCount+1}. revizyon` })
    }
    // Delete unpaid earnings for this brief
    const { data: existingEarnings } = await supabase.from('creator_earnings').select('id, paid').eq('brief_id', id)
    if (existingEarnings) {
      const unpaid = existingEarnings.filter(e => !e.paid)
      const paid = existingEarnings.filter(e => e.paid)
      if (unpaid.length > 0) await supabase.from('creator_earnings').delete().in('id', unpaid.map(e => e.id))
      if (paid.length > 0) console.warn(`Brief ${id}: ${paid.length} paid earning(s) found during revision, not deleted.`)
    }
    await supabase.from('briefs').update({ status: 'revision' }).eq('id', id)
    const tcStr = currentTime > 0 ? `[${formatTimecode(currentTime)}] ` : ''
    await supabase.from('brief_questions').insert({ brief_id: id, question: `REVİZYON: ${tcStr}${revisionNote}` })
    setRevisionNote('')
    setMsg(revisionCount === 0 ? 'Revizyon talebiniz gönderildi (ücretsiz).' : `Revizyon talebiniz gönderildi (${REVISION_COST} kredi düşüldü).`)
    loadData()
    setLoading(false)
  }

  async function handleApprove() {
    if (!brief || !clientUser) return
    setLoading(true)
    const newBalance = Math.max(0, clientUser.allocated_credits - (brief.credit_cost || 0))
    await supabase.from('client_users').update({ credit_balance: newBalance }).eq('id', clientUser.id)
    await supabase.from('credit_transactions').insert({ client_id: brief.client_id, client_user_id: clientUser.id, brief_id: id, amount: -(brief.credit_cost||0), type: 'deduct', description: `${brief.campaign_name} — müşteri onayı` })
    const { data: pb } = await supabase.from('producer_briefs').select('assigned_creator_id').eq('brief_id', id).maybeSingle()
    if (pb?.assigned_creator_id) {
      const { data: rate } = await supabase.from('admin_settings').select('value').eq('key', 'creator_credit_rate').maybeSingle()
      const tlRate = parseFloat((rate as any)?.value || '500')
      await supabase.from('creator_earnings').insert({ brief_id: id, creator_id: pb.assigned_creator_id, credits: brief.credit_cost, tl_rate: tlRate, tl_amount: brief.credit_cost * tlRate, paid: false })
    }
    await supabase.from('briefs').update({ status: 'delivered' }).eq('id', id)
    setShowApproveModal(false)
    setApproveSuccess(true)
    setTimeout(() => setApproveSuccess(false), 3000)
    loadData()
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm('Bu briefi silmek istediğinizden emin misiniz?')) return
    await supabase.from('briefs').delete().eq('id', id)
    router.push('/dashboard/client')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function generatePublicLink() {
    setGeneratingLink(true)
    const { data: subs } = await supabase.from('video_submissions').select('*').eq('brief_id', id)
      .in('status', ['admin_approved','producer_approved','approved']).order('submitted_at', { ascending: false }).limit(1)
    let sub = subs?.[0]
    if (!sub?.video_url) {
      const { data: anySubs } = await supabase.from('video_submissions').select('*').eq('brief_id', id).order('submitted_at', { ascending: false }).limit(1)
      sub = anySubs?.[0]
      if (!sub?.video_url) { alert('Bu brief için yüklenmiş video bulunamadı.'); setGeneratingLink(false); return }
    }
    const srcPath = sub.video_url.split('/videos/')[1]
    if (!srcPath) { alert('Video storage yolu bulunamadı.'); setGeneratingLink(false); return }
    const decodedPath = decodeURIComponent(srcPath)
    const destPath = `${id}.mp4`
    const { data: fileData, error: dlErr } = await supabase.storage.from('videos').download(decodedPath)
    if (dlErr || !fileData) {
      console.log('[PublicLink] Download failed, using original URL:', dlErr?.message)
      await supabase.from('briefs').update({ public_link: sub.video_url }).eq('id', id)
      setBrief((prev: any) => ({ ...prev, public_link: sub.video_url }))
      setGeneratingLink(false); return
    }
    const { error: upErr } = await supabase.storage.from('delivered-videos').upload(destPath, fileData, { upsert: true })
    if (upErr) { alert('Dosya kopyalama hatası: ' + upErr.message); setGeneratingLink(false); return }
    const { data: urlData } = supabase.storage.from('delivered-videos').getPublicUrl(destPath)
    const publicLink = urlData.publicUrl
    await supabase.from('briefs').update({ public_link: publicLink }).eq('id', id)
    setBrief((prev: any) => ({ ...prev, public_link: publicLink }))
    setGeneratingLink(false)
  }

  function getShareLink() {
    return `${window.location.origin}/video/${id}`
  }

  function copyPublicLink() {
    navigator.clipboard.writeText(getShareLink())
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 1500)
  }

  const unansweredQ = questions.filter(q => !q.question.startsWith('REVİZYON:') && !q.question.startsWith('İÇ REVİZYON:') && !q.answer)
  const visibleQ = questions.filter(q => !q.question.startsWith('REVİZYON:') && !q.question.startsWith('İÇ REVİZYON:') && q.answer)
  const clientRevisions = questions.filter(q => q.question.startsWith('REVİZYON:'))
  const approvedVideo = [...videos].reverse().find(v => v.status === 'producer_approved' || v.status === 'admin_approved') || (brief?.status === 'approved' || brief?.status === 'delivered' ? videos[videos.length-1] : null)
  const currentVideo = activeVideoId ? videos.find(v => v.id === activeVideoId) : approvedVideo

  // Aspect ratio from brief.format
  const briefFormat = brief?.format || '9:16'
  const aspectMap: Record<string,{padding:string,maxW:string}> = {
    '9:16':{padding:'177.78%',maxW:'320px'}, '16:9':{padding:'56.25%',maxW:'100%'},
    '1:1':{padding:'100%',maxW:'420px'}, '4:5':{padding:'125%',maxW:'360px'}, '2:3':{padding:'150%',maxW:'340px'},
  }
  const aspect = aspectMap[briefFormat] || aspectMap['9:16']

  function buildDownloadName() {
    const client = (companyName || 'client').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const campaign = (brief?.campaign_name || 'video').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const fmtSlug = briefFormat.replace(':', 'x')
    const date = new Date().toISOString().slice(0, 10)
    return `dinamo_${client}_${campaign}_${fmtSlug}_${date}.mp4`
  }

  const inputStyle: React.CSSProperties = { width:'100%', boxSizing:'border-box', background:'#fff', border:'0.5px solid rgba(0,0,0,0.12)', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#0a0a0a', fontFamily:'var(--font-dm-sans),sans-serif', outline:'none' }

  if (reorderSuccess) {
    const baseName = brief?.campaign_name?.replace(/\s*—\s*\d+$/, '') || ''
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0a0a',fontFamily:"var(--font-dm-sans),'DM Sans',system-ui,sans-serif"}}>
        <div style={{textAlign:'center',maxWidth:'520px',padding:'0 24px'}}>
          <div style={{fontSize:'28px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'32px'}}>
            <img src="/dinamo_logo_siyah.png" alt="Dinamo" style={{height:'28px'}} />
          </div>
          <div style={{fontSize:'36px',fontWeight:'300',color:'#fff',letterSpacing:'-1px',marginBottom:'12px'}}>Brief'iniz alındı.</div>
          <div style={{fontSize:'18px',fontWeight:'300',color:'#fff',fontStyle:'italic',marginBottom:'24px'}}>"{baseName}"</div>
          <div style={{fontSize:'15px',color:'rgba(255,255,255,0.45)',lineHeight:1.8,marginBottom:'24px',maxWidth:'480px',margin:'0 auto 24px'}}>
            Ekibimiz en kısa sürede incelemeye başlayacak. Sorularımız olursa platform üzerinden iletişime geçeceğiz. Videonuz hazır olduğunda bildirim alacaksınız.
          </div>
          <div style={{display:'inline-block',padding:'6px 16px',borderRadius:'100px',background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.2)',fontSize:'13px',color:'#22c55e',fontWeight:'400',marginBottom:'36px'}}>
            Tahmini teslim süresi: 24 saat
          </div>
          <div style={{display:'flex',gap:'12px',justifyContent:'center'}}>
            <a href="/dashboard/client" style={{padding:'13px 28px',borderRadius:'10px',border:'1px solid rgba(255,255,255,0.15)',background:'transparent',color:'#fff',fontSize:'14px',fontWeight:'400',textDecoration:'none',fontFamily:'var(--font-dm-sans),sans-serif'}}>Tüm Projelerim</a>
            <a href="/dashboard/client/brief/new" style={{padding:'13px 28px',borderRadius:'10px',background:'#22c55e',color:'#fff',fontSize:'14px',fontWeight:'500',textDecoration:'none',fontFamily:'var(--font-dm-sans),sans-serif'}}>Yeni Brief</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"var(--font-dm-sans),'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');
        @keyframes successPulse { 0% { transform: scale(0.8); opacity: 0; } 50% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* SIDEBAR */}
      <div style={{width:'240px',background:'#fff',borderRight:'1px solid #E8E8E4',display:'flex',flexDirection:'column',flexShrink:0,height:'100vh',position:'sticky',top:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'1px solid #E8E8E4'}}>
          <div style={{fontSize:'18px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'12px'}}>
            <img src="/dinamo_logo_siyah.png" alt="Dinamo" style={{height:'28px'}} />
          </div>
          <div style={{fontSize:'10px',color:'#999',marginBottom:'3px'}}>{companyName}</div>
          <div style={{fontSize:'13px',fontWeight:'500',color:'#fff'}}>{userName}</div>
        </div>
        <div style={{padding:'12px 16px',borderBottom:'1px solid #E8E8E4'}}>
          <div style={{fontSize:'10px',color:'#999',textTransform:'uppercase',marginBottom:'4px'}}>Kredi Bakiyesi</div>
          <div style={{fontSize:'22px',fontWeight:'300',color:'#fff',letterSpacing:'-1px'}}>{clientUser?.credit_balance||0}</div>
        </div>
        <nav style={{padding:'10px 8px',flex:1}}>
          <div onClick={()=>router.push('/dashboard/client')} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',marginBottom:'1px'}}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{fontSize:'12px',color:'#666'}}>Projelerime dön</span>
          </div>
          <div onClick={()=>router.push('/dashboard/client/brief/new')} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',marginBottom:'1px'}}>
            <span style={{fontSize:'12px',color:'#666'}}>Yeni Brief</span>
          </div>
          <div onClick={()=>router.push('/dashboard/client/brand')} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',marginBottom:'1px'}}>
            <span style={{fontSize:'12px',color:'#666'}}>Marka Paketi</span>
          </div>
          <div onClick={()=>router.push('/dashboard/client/certificates')} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',marginBottom:'1px'}}>
            <span style={{fontSize:'12px',color:'#666'}}>Telif Belgeleri</span>
          </div>
          <div onClick={()=>router.push('/dashboard/client/guarantee')} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer'}}>
            <span style={{fontSize:'12px',color:'#666'}}>İçerik Güvencesi</span>
          </div>
        </nav>
        <div style={{padding:'10px 8px',borderTop:'1px solid #E8E8E4'}}>
          <button onClick={handleLogout} style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',borderRadius:'7px',cursor:'pointer',width:'100%',background:'none',border:'none'}}>
            <span style={{fontSize:'11px',color:'#aaa',fontFamily:'var(--font-dm-sans),sans-serif'}}>Çıkış yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f5f4f0',overflow:'hidden'}}>
        {/* HEADER */}
        <div style={{padding:'14px 28px',background:'#fff',borderBottom:'0.5px solid rgba(0,0,0,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div>
            <div style={{fontSize:'18px',fontWeight:'500',color:'#0a0a0a',letterSpacing:'-0.3px'}}>{brief?.campaign_name || 'Yükleniyor...'}</div>
            {brief && <div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>{brief.video_type} · {Array.isArray(brief.format)?brief.format.join(', '):brief.format} · {new Date(brief.created_at).toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'})}</div>}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            {currentVideo && <span style={{fontSize:'11px',padding:'4px 12px',borderRadius:'100px',background:'rgba(0,0,0,0.06)',color:'#555',fontWeight:'500'}}>V{currentVideo.version}</span>}
            {brief && <span style={{fontSize:'11px',padding:'4px 12px',borderRadius:'100px',background:`${statusColor[brief.status]}15`,color:statusColor[brief.status],fontWeight:'500'}}>{statusLabel[brief.status]||brief.status}</span>}
          </div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>
          {!brief ? <div style={{color:'#888',fontSize:'14px'}}>Yükleniyor...</div> : (
            <>
              {/* SUCCESS TOAST */}
              {approveSuccess && (
                <div style={{position:'fixed',top:'24px',left:'50%',transform:'translateX(-50%)',zIndex:200,background:'#22c55e',color:'#fff',padding:'14px 28px',borderRadius:'12px',fontSize:'14px',fontWeight:'500',boxShadow:'0 8px 32px rgba(34,197,94,0.3)',animation:'slideUp 0.4s ease',display:'flex',alignItems:'center',gap:'10px'}}>
                  <div style={{width:'24px',height:'24px',borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',animation:'successPulse 0.5s ease'}}>✓</div>
                  Onaylandı! Teşekkürler.
                </div>
              )}

              {/* DRAFT BANNER */}
              {brief.status === 'draft' && (
                <div style={{background:'#fffbeb',border:'1.5px dashed #f59e0b',borderRadius:'12px',padding:'14px 18px',marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>Bu brief henüz gönderilmedi.</div>
                    <div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>Taslak olarak kaydedildi. Düzenleyip gönderebilirsiniz.</div>
                  </div>
                  <button onClick={()=>router.push(`/dashboard/client/brief/new?draft=${id}`)} style={{padding:'8px 18px',background:'#f59e0b',color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',fontWeight:'500',whiteSpace:'nowrap'}}>Düzenle ve Gönder</button>
                </div>
              )}

              {/* EDIT — within 15 min and still submitted */}
              {['submitted','read'].includes(brief.status) && (Date.now() - new Date(brief.created_at).getTime()) < 15*60*1000 && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'14px 18px',marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:'13px',color:'#555'}}>Brief'inizi henüz düzenleyebilirsiniz.</div>
                  <button onClick={()=>router.push(`/dashboard/client/brief/new?edit=${id}`)} style={{padding:'8px 18px',background:'#111113',color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',fontWeight:'500'}}>Brief'i Düzenle</button>
                </div>
              )}

              {/* CANCELLED */}
              {brief.status==='cancelled' && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:'13px',color:'#888'}}>Bu brief admin tarafından iptal edildi.</div>
                  <button onClick={handleDelete} style={{padding:'8px 18px',background:'#ef4444',color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>Sil</button>
                </div>
              )}

              {/* UNANSWERED QUESTIONS */}
              {unansweredQ.length > 0 && (
                <div style={{background:'#fff',border:'2px solid #22c55e',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px'}}>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#22c55e'}}></div>
                    <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Cevabınızı Bekliyoruz</div>
                    <div style={{fontSize:'11px',color:'#888'}}>{unansweredQ.length} soru</div>
                    {brief.question_sent_at && (() => {
                      const allAnswered = unansweredQ.length === 0
                      if (allAnswered) return <div style={{fontSize:'10px',color:'#22c55e',marginLeft:'auto'}}>Cevaplandı ✓</div>
                      const hrs = Math.floor((Date.now() - new Date(brief.question_sent_at).getTime()) / 3600000)
                      const remaining = Math.max(0, 24 - hrs)
                      return remaining > 0 ? <div style={{fontSize:'10px',color:remaining<6?'#ef4444':'#f59e0b',marginLeft:'auto'}}>{remaining}s kaldı</div> : <div style={{fontSize:'10px',color:'#ef4444',marginLeft:'auto'}}>Süre doldu</div>
                    })()}
                  </div>
                  {unansweredQ.map(q=>(
                    <div key={q.id} style={{marginBottom:'12px',padding:'12px 16px',background:'#f5f4f0',borderRadius:'10px'}}>
                      <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a',marginBottom:'10px',lineHeight:'1.5'}}>{q.question}</div>
                      <div style={{display:'flex',gap:'8px'}}>
                        <input value={answers[q.id]||''} onChange={e=>setAnswers(prev=>({...prev,[q.id]:e.target.value}))} placeholder="Cevabınız..." style={{...inputStyle,flex:1,padding:'8px 12px'}} />
                        <button onClick={()=>handleAnswer(q.id)} style={{padding:'8px 16px',background:'#111113',color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',fontWeight:'500',whiteSpace:'nowrap'}}>Yanıtla</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* VIDEO PLAYER + ACTION PANEL */}
              {currentVideo && (brief.status==='approved'||brief.status==='delivered') && (
                <div style={{display:'flex',gap:'20px',marginBottom:'16px',alignItems:'flex-start'}}>
                  {/* VIDEO */}
                  <div style={{flex:1,minWidth:0}}>
                      <div style={{borderRadius:'12px',overflow:'hidden',position:'relative',maxWidth:aspect.maxW,margin:briefFormat==='16:9'?'0':'0 auto'}}>
                      <div style={{paddingTop:aspect.padding,position:'relative'}}>
                        <video ref={videoRef} key={currentVideo.id} controls
                          onTimeUpdate={()=>{if(videoRef.current) setCurrentTime(videoRef.current.currentTime)}}
                          style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',borderRadius:'12px'}}>
                          <source src={currentVideo.video_url} />
                        </video>
                      </div>
                      <div style={{position:'absolute',bottom:'12px',right:'14px',fontSize:'10px',color:'#999',letterSpacing:'0.5px',pointerEvents:'none',zIndex:2}}>
                        made by dinamo
                      </div>
                    </div>

                    {/* VERSION TIMELINE */}
                    {videos.length > 0 && (
                      <div style={{marginTop:'12px',display:'flex',alignItems:'center',gap:'6px'}}>
                        <span style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginRight:'4px'}}>Versiyonlar</span>
                        {videos.map(v=>{
                          const isActive = currentVideo?.id === v.id
                          return (
                            <button key={v.id} onClick={()=>setActiveVideoId(v.id)}
                              style={{padding:'6px 14px',borderRadius:'100px',fontSize:'12px',fontWeight:'500',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',transition:'all 0.2s',border:isActive?'1.5px solid #22c55e':'1px solid rgba(0,0,0,0.1)',background:isActive?'#22c55e':'#fff',color:isActive?'#fff':'#555'}}>
                              V{v.version}
                            </button>
                          )
                        })}
                        <span style={{fontSize:'10px',color:'#aaa',marginLeft:'auto'}}>{currentVideo && new Date(currentVideo.submitted_at).toLocaleDateString('tr-TR',{day:'numeric',month:'short'})}</span>
                      </div>
                    )}
                  </div>

                  {/* ACTION PANEL — sticky */}
                  <div style={{width:'280px',flexShrink:0,position:'sticky',top:'24px'}}>
                    {/* Download */}
                    <a href={currentVideo.video_url} download={buildDownloadName()} target="_blank" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',padding:'10px',background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'10px',fontSize:'13px',color:'#0a0a0a',textDecoration:'none',marginBottom:'10px',transition:'border-color 0.2s'}}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4 8l4 4 4-4" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 13h12" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      Videoyu İndir
                    </a>

                    {brief.status==='approved' && (
                      <>
                        {/* APPROVE */}
                        <button onClick={()=>setShowApproveModal(true)} disabled={loading}
                          style={{width:'100%',padding:'14px',background:'#22c55e',color:'#fff',border:'none',borderRadius:'10px',fontSize:'15px',fontWeight:'500',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',marginBottom:'10px',transition:'transform 0.2s,box-shadow 0.2s'}}>
                          ✓ Onayla ve Teslim Al
                        </button>

                        {/* REVISION */}
                        <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'10px',padding:'16px'}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                            <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Revizyon İste</div>
                            <span style={{fontSize:'10px',padding:'3px 10px',borderRadius:'100px',background:revisionCount===0?'rgba(34,197,94,0.1)':'rgba(245,158,11,0.1)',color:revisionCount===0?'#22c55e':'#f59e0b',fontWeight:'500'}}>
                              {revisionCount===0?'İlk revizyon ücretsiz':`${REVISION_COST} kredi`}
                            </span>
                          </div>
                          <form onSubmit={handleRevision}>
                            {currentTime > 0 && (
                              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px',padding:'8px 10px',background:'rgba(245,158,11,0.06)',borderRadius:'8px',border:'0.5px solid rgba(245,158,11,0.15)'}}>
                                <div style={{fontSize:'16px',fontWeight:'500',fontFamily:'monospace',color:'#f59e0b'}}>{formatTimecode(currentTime)}</div>
                                <div style={{fontSize:'10px',color:'#f59e0b'}}>📍 Bu kareye yorum yap</div>
                              </div>
                            )}
                            <textarea value={revisionNote} onChange={e=>setRevisionNote(e.target.value)}
                              placeholder="Neyi değiştirmek istiyorsunuz?" rows={3}
                              style={{...inputStyle,resize:'vertical',lineHeight:'1.6',marginBottom:'8px',fontSize:'12px'}} />
                            {msg && <div style={{fontSize:'11px',color:msg.includes('Yetersiz')||msg.includes('yazın')?'#ef4444':'#22c55e',marginBottom:'8px'}}>{msg}</div>}
                            <button type="submit" disabled={loading} style={{width:'100%',padding:'9px',background:'#fff',color:'#0a0a0a',border:'0.5px solid rgba(0,0,0,0.15)',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>
                              {loading?'Gönderiliyor...':'Revizyon Gönder'}
                            </button>
                          </form>
                        </div>
                      </>
                    )}

                    {brief.status==='delivered' && (
                      <>
                        <div style={{background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.15)',borderRadius:'10px',padding:'16px',textAlign:'center',marginBottom:'10px'}}>
                          <div style={{fontSize:'24px',marginBottom:'6px'}}>✓</div>
                          <div style={{fontSize:'13px',fontWeight:'500',color:'#22c55e'}}>Teslim Edildi</div>
                          <div style={{fontSize:'11px',color:'#888',marginTop:'4px'}}>Bu proje tamamlandı</div>
                        </div>
                        <button onClick={handleCertificateDownload}
                          style={{width:'100%',padding:'10px',background:'#fff',border:'0.5px solid rgba(0,0,0,0.12)',borderRadius:'10px',fontSize:'12px',color:'#0a0a0a',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',fontWeight:'500',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',transition:'border-color 0.2s',marginBottom:'10px'}}>
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 1h5l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="#0a0a0a" strokeWidth="1.2"/><path d="M9 1v4h4" stroke="#0a0a0a" strokeWidth="1.2"/><path d="M6 9h4M6 11h2" stroke="#0a0a0a" strokeWidth="1.2" strokeLinecap="round"/></svg>
                          Telif Sertifikası İndir
                        </button>

                        {/* PUBLIC LINK */}
                        <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'10px',padding:'14px 16px',marginBottom:'10px'}}>
                          {brief.public_link ? (
                            <>
                              <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'8px'}}>
                                <span style={{fontSize:'10px',padding:'3px 8px',borderRadius:'100px',background:'rgba(34,197,94,0.1)',color:'#22c55e',fontWeight:'500'}}>Link Hazır</span>
                              </div>
                              <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'8px'}}>
                                <a href={`/video/${id}`} target="_blank" rel="noopener noreferrer"
                                  style={{fontSize:'12px',color:'#3b82f6',textDecoration:'underline',wordBreak:'break-all',flex:1}}>
                                  {typeof window !== 'undefined' ? `${window.location.origin}/video/${id}` : `/video/${id}`}
                                </a>
                                <button onClick={copyPublicLink}
                                  style={{fontSize:'10px',padding:'4px 10px',borderRadius:'6px',border:'0.5px solid rgba(0,0,0,0.12)',background:'#fff',color:linkCopied?'#22c55e':'#555',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',whiteSpace:'nowrap',flexShrink:0}}>
                                  {linkCopied ? 'Kopyalandı ✓' : 'Kopyala'}
                                </button>
                              </div>
                            </>
                          ) : (
                            <button onClick={generatePublicLink} disabled={generatingLink}
                              style={{width:'100%',padding:'10px',background:'#fff',border:'0.5px solid rgba(0,0,0,0.12)',borderRadius:'8px',fontSize:'12px',color:'#0a0a0a',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',fontWeight:'500',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                              {generatingLink ? 'Oluşturuluyor...' : 'Public Link Oluştur'}
                            </button>
                          )}
                          <div style={{fontSize:'10px',color:'#aaa',marginTop:'6px',lineHeight:'1.5'}}>
                            Bu linke sahip herkes videonuzu izleyebilir. Linki yalnızca güvendiğiniz kişilerle paylaşın.
                          </div>
                        </div>
                      </>
                    )}

                  </div>
                </div>
              )}

              {/* REORDER */}
              {brief.status !== 'cancelled' && (
                <div style={{marginBottom:'16px'}}>
                  <button onClick={()=>{setReorderType(brief.video_type);setShowReorderModal(true)}}
                    onMouseEnter={e=>(e.currentTarget.style.background='rgba(29,184,29,0.08)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                    style={{padding:'10px 20px',background:'transparent',color:'#1db81d',border:'1.5px solid #1db81d',borderRadius:'10px',fontSize:'13px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',fontWeight:'500',display:'flex',alignItems:'center',gap:'8px',transition:'background 0.15s'}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1db81d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
                    Aynı Brief'ten Yeni Video
                  </button>
                </div>
              )}

              {/* SOSYAL MEDYA BAŞLIKLARI */}
              {brief.status === 'delivered' && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
                    <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px'}}>Sosyal Medya Başlıkları</div>
                    {!captions && (
                      <button onClick={loadCaptions} disabled={captionsLoading}
                        style={{fontSize:'11px',padding:'6px 14px',borderRadius:'8px',border:'none',background:'#111113',color:'#fff',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',fontWeight:'500'}}>
                        {captionsLoading ? 'Oluşturuluyor...' : 'Başlıkları Oluştur'}
                      </button>
                    )}
                  </div>
                  {captions && (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
                      <div>
                        <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>TikTok</div>
                        {captions.tiktok.map((c, i) => {
                          const key = `tt-${i}`
                          return (
                            <div key={key} style={{padding:'10px 12px',background:'#f5f4f0',borderRadius:'8px',marginBottom:'6px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'8px'}}>
                              <div style={{fontSize:'12px',color:'#0a0a0a',lineHeight:'1.5',flex:1}}>{c}</div>
                              <button onClick={() => copyCaption(c, key)}
                                style={{fontSize:'10px',padding:'4px 10px',borderRadius:'6px',border:'0.5px solid rgba(0,0,0,0.12)',background:'#fff',color:copiedIdx===key?'#22c55e':'#555',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',whiteSpace:'nowrap',flexShrink:0}}>
                                {copiedIdx===key ? 'Kopyalandı' : 'Kopyala'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                      <div>
                        <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>Instagram</div>
                        {captions.instagram.map((c, i) => {
                          const key = `ig-${i}`
                          return (
                            <div key={key} style={{padding:'10px 12px',background:'#f5f4f0',borderRadius:'8px',marginBottom:'6px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'8px'}}>
                              <div style={{fontSize:'12px',color:'#0a0a0a',lineHeight:'1.5',flex:1}}>{c}</div>
                              <button onClick={() => copyCaption(c, key)}
                                style={{fontSize:'10px',padding:'4px 10px',borderRadius:'6px',border:'0.5px solid rgba(0,0,0,0.12)',background:'#fff',color:copiedIdx===key?'#22c55e':'#555',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',whiteSpace:'nowrap',flexShrink:0}}>
                                {copiedIdx===key ? 'Kopyalandı' : 'Kopyala'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* WAITING FOR PRODUCTION */}
              {!approvedVideo && ['in_production','submitted','read'].includes(brief.status) && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'32px',marginBottom:'16px',textAlign:'center'}}>
                  <div style={{width:'48px',height:'48px',borderRadius:'50%',background:'#f5f4f0',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5" stroke="#888" strokeWidth="1.2"/><path d="M8 5v3l2 1" stroke="#888" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  </div>
                  <div style={{fontSize:'15px',fontWeight:'500',color:'#0a0a0a',marginBottom:'6px'}}>Videonuz hazırlanıyor</div>
                  <div style={{fontSize:'13px',color:'#888'}}>24 saat içinde incelemenize sunulacak.</div>
                </div>
              )}

              {/* REVISION HISTORY */}
              {clientRevisions.length > 0 && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px 20px',marginBottom:'16px'}}>
                  <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'12px'}}>Revizyon Geçmişi</div>
                  {clientRevisions.map((r,i)=>(
                    <div key={r.id} style={{padding:'10px 14px',background:'#f5f4f0',borderRadius:'8px',marginBottom:'6px'}}>
                      <div style={{fontSize:'11px',color:'#888',fontWeight:'500',marginBottom:'4px'}}>{i+1}. revizyon{i===0?' (ücretsiz)':` (${REVISION_COST} kredi)`}</div>
                      <div style={{fontSize:'13px',color:'#0a0a0a'}}>{r.question.replace('REVİZYON: ','')}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* TIMELINE */}
              <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'14px'}}>Süreç</div>
                {(() => {
                  const steps: {label:string,date:string|null,done:boolean}[] = [
                    {label:'Brief Gönderildi',date:brief.created_at,done:true},
                    {label:'Üretime Alındı',date:['in_production','revision','approved','delivered'].includes(brief.status)?brief.read_at||brief.created_at:null,done:['in_production','revision','approved','delivered'].includes(brief.status)},
                    {label:'Video Yüklendi',date:videos.length>0?videos[0].submitted_at:null,done:videos.length>0},
                    ...clientRevisions.map((_,i)=>({label:`${i+1}. Revizyon`,date:clientRevisions[i]?.asked_at||null,done:true})),
                    {label:'Teslim Edildi',date:brief.status==='delivered'?brief.updated_at:null,done:brief.status==='delivered'},
                  ]
                  return steps.map((s,i)=>(
                    <div key={i} style={{display:'flex',gap:'12px',marginBottom:i<steps.length-1?'0':'0'}}>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:'12px'}}>
                        <div style={{width:'10px',height:'10px',borderRadius:'50%',background:s.done?'#22c55e':'rgba(0,0,0,0.08)',border:s.done?'none':'1.5px solid rgba(0,0,0,0.12)',flexShrink:0}}></div>
                        {i<steps.length-1&&<div style={{width:'1.5px',flex:1,minHeight:'20px',background:s.done?'#22c55e':'rgba(0,0,0,0.06)'}}></div>}
                      </div>
                      <div style={{paddingBottom:i<steps.length-1?'12px':'0'}}>
                        <div style={{fontSize:'12px',color:s.done?'#0a0a0a':'#aaa',fontWeight:s.done?'500':'400'}}>{s.label}</div>
                        {s.date&&<div style={{fontSize:'10px',color:'#888',marginTop:'2px'}}>{new Date(s.date).toLocaleDateString('tr-TR',{day:'numeric',month:'short'})} · {new Date(s.date).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</div>}
                      </div>
                    </div>
                  ))
                })()}
              </div>



              {/* BRIEF DETAILS */}
              <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'16px'}}>Brief Detayları</div>
                {[
                  {label:'Video Tipi', value: brief.video_type},
                  {label:'Format', value: Array.isArray(brief.format)?brief.format.join(', '):brief.format},
                  {label:'Mesaj', value: brief.message},
                  {label:'CTA', value: brief.cta},
                  {label:'Hedef Kitle', value: brief.target_audience},
                  {label:'Seslendirme', value: brief.voiceover_type==='real'?'Gerçek Seslendirme':brief.voiceover_type==='ai'?'AI Seslendirme':null},
                  {label:'Seslendirme Metni', value: brief.voiceover_text},
                  {label:'Notlar', value: brief.notes},
                ].filter(f=>f.value).map(f=>(
                  <div key={f.label} style={{marginBottom:'12px',paddingBottom:'12px',borderBottom:'0.5px solid rgba(0,0,0,0.06)'}}>
                    <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>{f.label}</div>
                    <div style={{fontSize:'13px',color:'#0a0a0a',lineHeight:'1.6'}}>{f.value}</div>
                  </div>
                ))}
                <div style={{background:'#f5f4f0',borderRadius:'8px',padding:'12px 16px'}}>
                  <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'8px'}}>Kredi</div>
                  <div style={{fontSize:'16px',fontWeight:'500',color:'#0a0a0a'}}>{brief.credit_cost} kredi</div>
                </div>
              </div>

              {/* ANSWERED Q */}
              {visibleQ.length > 0 && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px 20px'}}>
                  <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'12px'}}>Yanıtlanan Sorular</div>
                  {visibleQ.map(q=>(
                    <div key={q.id} style={{marginBottom:'10px',padding:'10px 14px',background:'#f5f4f0',borderRadius:'8px'}}>
                      <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a',marginBottom:'4px'}}>{q.question}</div>
                      <div style={{fontSize:'12px',color:'#22c55e'}}>↳ {q.answer}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* APPROVE MODAL */}
      {showApproveModal && (
        <div style={{position:'fixed',inset:0,zIndex:150,display:'flex',alignItems:'center',justifyContent:'center',animation:'fadeIn 0.2s ease'}}
          onClick={()=>setShowApproveModal(false)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(4px)'}} />
          <div onClick={e=>e.stopPropagation()} style={{position:'relative',background:'#fff',borderRadius:'16px',padding:'32px',width:'100%',maxWidth:'400px',animation:'slideUp 0.3s ease',textAlign:'center'}}>
            <div style={{width:'48px',height:'48px',borderRadius:'50%',background:'rgba(34,197,94,0.1)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{fontSize:'18px',fontWeight:'500',color:'#0a0a0a',marginBottom:'8px'}}>Videoyu Onayla</div>
            <div style={{fontSize:'14px',color:'#888',lineHeight:1.6,marginBottom:'24px'}}>
              <strong style={{color:'#0a0a0a'}}>{brief?.credit_cost} kredi</strong> hesabınızdan düşecektir. Onaylıyor musunuz?
            </div>
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={()=>setShowApproveModal(false)} style={{flex:1,padding:'12px',background:'#f5f4f0',color:'#555',border:'none',borderRadius:'10px',fontSize:'14px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>Vazgeç</button>
              <button onClick={handleApprove} disabled={loading} style={{flex:1,padding:'12px',background:'#22c55e',color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:'500',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>
                {loading?'İşleniyor...':'Evet, Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* REORDER MODAL */}
      {showReorderModal && brief && (() => {
        const currentCost = BASE_COSTS[brief.video_type] || 12
        const selectedCost = BASE_COSTS[reorderType] || 12
        const halfCost = Math.ceil(selectedCost / 2)
        const canAfford = clientUser && clientUser.allocated_credits >= halfCost
        return (
          <div style={{position:'fixed',inset:0,zIndex:150,display:'flex',alignItems:'center',justifyContent:'center',animation:'fadeIn 0.2s ease'}}
            onClick={()=>setShowReorderModal(false)}>
            <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(4px)'}} />
            <div onClick={e=>e.stopPropagation()} style={{position:'relative',background:'#fff',borderRadius:'16px',padding:'32px',width:'100%',maxWidth:'440px',animation:'slideUp 0.3s ease'}}>
              <div style={{textAlign:'center',marginBottom:'20px'}}>
                <div style={{fontSize:'18px',fontWeight:'500',color:'#0a0a0a',marginBottom:'6px'}}>Aynı Brief'ten Yeni Video</div>
                <div style={{fontSize:'13px',color:'#888'}}><strong style={{color:'#0a0a0a'}}>{brief.campaign_name}</strong></div>
              </div>

              {/* Video Type Selector */}
              <div style={{marginBottom:'20px'}}>
                <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'8px'}}>Video Tipi</div>
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                  {VIDEO_TYPES.map(vt => {
                    const cost = BASE_COSTS[vt]
                    const isSelected = reorderType === vt
                    const isDisabled = cost > currentCost
                    return (
                      <div key={vt} style={{position:'relative'}}>
                        <button
                          onClick={() => !isDisabled && setReorderType(vt)}
                          disabled={isDisabled}
                          title={isDisabled ? 'Mevcut planınızda mevcut değil' : ''}
                          style={{
                            padding:'8px 14px',borderRadius:'100px',fontSize:'12px',fontWeight:'500',
                            cursor:isDisabled?'not-allowed':'pointer',fontFamily:'var(--font-dm-sans),sans-serif',
                            transition:'all 0.15s',
                            border:isSelected?'1.5px solid #22c55e':isDisabled?'1px solid rgba(0,0,0,0.06)':'1px solid rgba(0,0,0,0.12)',
                            background:isSelected?'#22c55e':isDisabled?'#f5f4f0':'#fff',
                            color:isSelected?'#fff':isDisabled?'#ccc':'#555',
                            opacity:isDisabled?0.5:1,
                          }}>
                          {vt} · {cost}kr
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Cost Breakdown */}
              <div style={{background:'#f5f4f0',borderRadius:'10px',padding:'14px',marginBottom:'20px'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px',marginBottom:'6px'}}>
                  <span style={{color:'#888'}}>Normal fiyat ({reorderType})</span>
                  <span style={{color:'#0a0a0a'}}>{selectedCost} kredi</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px',marginBottom:'6px'}}>
                  <span style={{color:'#888'}}>Tekrar sipariş (%50)</span>
                  <span style={{color:'#22c55e',fontWeight:'500'}}>{halfCost} kredi</span>
                </div>
                <div style={{borderTop:'0.5px solid rgba(0,0,0,0.1)',paddingTop:'6px',marginTop:'6px',display:'flex',justifyContent:'space-between',fontSize:'13px'}}>
                  <span style={{color:'#888'}}>Bakiyeniz</span>
                  <span style={{color:canAfford?'#0a0a0a':'#ef4444',fontWeight:'500'}}>{clientUser?.credit_balance || 0} kredi</span>
                </div>
              </div>

              {!canAfford && <div style={{fontSize:'12px',color:'#ef4444',marginBottom:'12px',textAlign:'center'}}>Yetersiz kredi.</div>}

              <div style={{display:'flex',gap:'10px'}}>
                <button onClick={()=>setShowReorderModal(false)} style={{flex:1,padding:'12px',background:'#f5f4f0',color:'#555',border:'none',borderRadius:'10px',fontSize:'14px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>Vazgeç</button>
                <button onClick={handleReorder} disabled={reordering || !canAfford}
                  style={{flex:1,padding:'12px',background:'#111113',color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:'500',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',opacity:canAfford?1:0.4}}>
                  {reordering ? 'Oluşturuluyor...' : 'Onaylıyorum'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
