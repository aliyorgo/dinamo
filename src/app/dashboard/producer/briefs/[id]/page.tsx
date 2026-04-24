'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import ProductionStudio from '@/components/ProductionStudio'
import { useParams, useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string,string> = { submitted:'Yeni', read:'Okundu', in_production:'Üretimde', revision:'Revizyon', approved:'Onay Bekliyor', delivered:'Teslim Edildi' }

async function recordCreatorEarning(briefId: string, submissionId: string) {
  const { data: pb } = await supabase.from('producer_briefs').select('assigned_creator_id').eq('brief_id', briefId).maybeSingle()
  if (!pb?.assigned_creator_id) return
  const { data: b } = await supabase.from('briefs').select('credit_cost').eq('id', briefId).single()
  if (!b) return
  const { data: rate } = await supabase.from('admin_settings').select('value').eq('key', 'creator_credit_rate').maybeSingle()
  const tlRate = parseFloat((rate as any)?.value || '500')
  await supabase.from('creator_earnings').insert({ brief_id: briefId, creator_id: pb.assigned_creator_id, video_submission_id: submissionId, credits: b.credit_cost, tl_rate: tlRate, tl_amount: b.credit_cost * tlRate, paid: false })
}

async function deductClientCredits(briefId: string) {
  const { data: b } = await supabase.from('briefs').select('credit_cost, client_id, client_user_id, campaign_name').eq('id', briefId).single()
  if (!b?.client_user_id) return
  const { data: cu } = await supabase.from('client_users').select('credit_balance').eq('id', b.client_user_id).single()
  if (!cu) return
  const newBal = Math.max(0, cu.credit_balance - (b.credit_cost || 0))
  await supabase.from('client_users').update({ credit_balance: newBal }).eq('id', b.client_user_id)
  await supabase.from('credit_transactions').insert({ client_id: b.client_id, client_user_id: b.client_user_id, brief_id: briefId, amount: -(b.credit_cost||0), type: 'deduct', description: `${b.campaign_name} — teslim` })
}

export default function ProducerBriefDetail() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [brief, setBrief] = useState<any>(null)
  const [creators, setCreators] = useState<any[]>([])
  const [voiceArtists, setVoiceArtists] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [approvalDelegated, setApprovalDelegated] = useState(false)
  const [form, setForm] = useState({ producer_note: '', assigned_creator_id: '', assigned_voice_artist_id: '' })
  const [revisionNotes, setRevisionNotes] = useState<Record<string,string>>({})
  const [question, setQuestion] = useState('')
  const [questions, setQuestions] = useState<any[]>([])
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [answerEditing, setAnswerEditing] = useState<string|null>(null)
  const [answerText, setAnswerText] = useState('')
  const [showClientApproveModal, setShowClientApproveModal] = useState(false)
  const [sharedFields, setSharedFields] = useState<string[]>(['message','cta','target_audience','voiceover_text','notes'])
  const [voUpload, setVoUpload] = useState(false)
  const voFileRef = useRef<HTMLInputElement>(null)
  const [creatorJobs, setCreatorJobs] = useState<Record<string,number>>({})
  const [prevBriefs, setPrevBriefs] = useState<any[]>([])
  const [selectedCreatorBriefs, setSelectedCreatorBriefs] = useState<any[]>([])
  const [inspirations, setInspirations] = useState<any[]>([])
  const [inspLoading, setInspLoading] = useState(false)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) { const { data: ud } = await supabase.from('users').select('name').eq('id', user.id).single(); setUserName(ud?.name||'') }
    const { data: b } = await supabase.from('briefs').select('*, clients(company_name, logo_url, font_url, brand_primary_color, brand_secondary_color, brand_forbidden_colors, brand_tone, brand_avoid)').eq('id', id).single()
    setBrief(b)
    if (b?.status==='submitted') await supabase.from('briefs').update({ status:'read', read_at: new Date().toISOString() }).eq('id', id)
    const { data: pb } = await supabase.from('producer_briefs').select('*').eq('brief_id', id).maybeSingle()
    if (pb) {
      setForm({ producer_note: pb.producer_note||'', assigned_creator_id: pb.assigned_creator_id||'', assigned_voice_artist_id: pb.assigned_voice_artist_id||'' })
      if (pb.shared_fields) setSharedFields(pb.shared_fields)
    }
    const { data: c } = await supabase.from('creators').select('*, users(name, email)').eq('is_active', true)
    setCreators(c||[])
    const { data: va } = await supabase.from('voice_artists').select('*, users(name)')
    setVoiceArtists(va||[])
    const { data: q } = await supabase.from('brief_questions').select('*').eq('brief_id', id).order('asked_at')
    setQuestions(q||[])
    const { data: s } = await supabase.from('video_submissions').select('*').eq('brief_id', id).order('version', { ascending: false })
    setSubmissions(s||[])
    const { data: settings } = await supabase.from('admin_settings').select('value').eq('key', 'approval_delegated_to_producer').maybeSingle()
    setApprovalDelegated((settings as any)?.value === 'true')
    // Creator active job counts
    const { data: allPb } = await supabase.from('producer_briefs').select('assigned_creator_id, briefs!inner(status)').in('briefs.status', ['in_production','revision'])
    const jobMap: Record<string,number> = {}
    allPb?.forEach((p: any) => { if (p.assigned_creator_id) jobMap[p.assigned_creator_id] = (jobMap[p.assigned_creator_id] || 0) + 1 })
    setCreatorJobs(jobMap)
    // Load inspirations
    const { data: insp } = await supabase.from('brief_inspirations').select('*').eq('brief_id', id).order('created_at', { ascending: false })
    setInspirations(insp || [])
    // Previous briefs from same client
    if (b?.client_id) {
      const { data: prev } = await supabase.from('briefs').select('id, campaign_name, video_type, created_at').eq('client_id', b.client_id).eq('status', 'delivered').neq('id', id).order('created_at', { ascending: false }).limit(3)
      setPrevBriefs(prev || [])
    }
  }

  async function handleVoiceoverUpload() {
    const file = voFileRef.current?.files?.[0]
    if (!file) return
    if (!file.name.match(/\.(mp3|wav|m4a)$/i)) { setMsg('Desteklenen formatlar: mp3, wav, m4a'); return }
    if (file.size > 50 * 1024 * 1024) { setMsg('Maksimum dosya boyutu: 50MB'); return }
    setVoUpload(true)
    const ext = file.name.split('.').pop() || 'mp3'
    const path = `voiceover_${id}.${ext}`
    const { error: upErr } = await supabase.storage.from('voiceovers').upload(path, file, { upsert: true })
    if (upErr) { setMsg('Yükleme hatası: ' + upErr.message); setVoUpload(false); return }
    const { data: urlData } = supabase.storage.from('voiceovers').getPublicUrl(path)
    await supabase.from('briefs').update({ voiceover_file_url: urlData.publicUrl }).eq('id', id)
    setBrief((prev: any) => ({ ...prev, voiceover_file_url: urlData.publicUrl }))
    if (voFileRef.current) voFileRef.current.value = ''
    setMsg('Seslendirme dosyası yüklendi.')
    setVoUpload(false)
  }

  async function handleVoiceoverDelete() {
    if (!brief?.voiceover_file_url) return
    const path = brief.voiceover_file_url.split('/voiceovers/')[1]
    if (path) await supabase.storage.from('voiceovers').remove([decodeURIComponent(path)])
    await supabase.from('briefs').update({ voiceover_file_url: null }).eq('id', id)
    setBrief((prev: any) => ({ ...prev, voiceover_file_url: null }))
    setMsg('Seslendirme dosyası silindi.')
  }

  async function handleAnswerForClient(qId: string) {
    if (!answerText.trim()) return
    await supabase.from('brief_questions').update({ answer: answerText, answered_at: new Date().toISOString() }).eq('id', qId)
    setAnswerEditing(null); setAnswerText(''); loadData()
  }

  async function handleForward(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    const creatorId = form.assigned_creator_id && form.assigned_creator_id.length > 10 ? form.assigned_creator_id : null
    const voiceId = form.assigned_voice_artist_id && form.assigned_voice_artist_id.length > 10 ? form.assigned_voice_artist_id : null
    await supabase.from('producer_briefs').delete().eq('brief_id', id)
    const { error } = await supabase.from('producer_briefs').insert({ brief_id: id, producer_id: user?.id, producer_note: form.producer_note, assigned_creator_id: creatorId, assigned_voice_artist_id: voiceId, shared_fields: sharedFields, forwarded_at: new Date().toISOString() })
    if (error) { setMsg('Hata: '+error.message); setLoading(false); return }
    await supabase.from('briefs').update({ status:'in_production' }).eq('id', id)
    setMsg("Creator'a iletildi.")
    loadData(); setLoading(false)
  }

  async function handleApprove(submissionId: string) {
    setLoading(true); setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('video_submissions').update({ status:'producer_approved' }).eq('id', submissionId)
    await supabase.from('approvals').insert({ video_submission_id: submissionId, approved_by: user?.id, role:'producer' })
    if (approvalDelegated) {
      // Producer has delegation — send directly to customer
      await supabase.from('briefs').update({ status:'approved' }).eq('id', id)
      setMsg('Video onaylandı, müşteriye iletildi.')
    } else {
      // No delegation — keep in_production, admin will approve
      setMsg('Video onaylandı, admin onayına gönderildi.')
    }
    loadData(); setLoading(false)
  }

  async function handleRevision(submissionId: string) {
    const note = revisionNotes[submissionId]
    if (!note?.trim()) { setMsg('Revizyon notu zorunludur.'); return }
    setLoading(true)
    // Delete unpaid earnings for this brief
    const { data: existingEarnings } = await supabase.from('creator_earnings').select('id, paid').eq('brief_id', id)
    if (existingEarnings) {
      const unpaid = existingEarnings.filter(e => !e.paid)
      const paid = existingEarnings.filter(e => e.paid)
      if (unpaid.length > 0) await supabase.from('creator_earnings').delete().in('id', unpaid.map(e => e.id))
      if (paid.length > 0) console.warn(`Brief ${id}: ${paid.length} paid earning(s) found during revision, not deleted.`)
    }
    await supabase.from('video_submissions').update({ status:'revision_requested', producer_notes: note }).eq('id', submissionId)
    await supabase.from('briefs').update({ status:'revision' }).eq('id', id)
    await supabase.from('brief_questions').insert({ brief_id: id, question: `İÇ REVİZYON: ${note}` })
    setMsg("Revizyon creator'a iletildi.")
    loadData(); setLoading(false)
  }

  async function handleClientApprove() {
    setLoading(true)
    await deductClientCredits(id)
    const latestSub = submissions.find(s => s.status === 'producer_approved' || s.status === 'admin_approved') || submissions[0]
    if (latestSub) await recordCreatorEarning(id, latestSub.id)

    // Copy video to delivered-videos bucket and save public_link
    let publicLink = ''
    if (latestSub?.video_url) {
      const srcPath = latestSub.video_url.split('/videos/')[1]
      if (srcPath) {
        const decodedPath = decodeURIComponent(srcPath)
        const { data: fileData, error: dlErr } = await supabase.storage.from('videos').download(decodedPath)
        if (fileData && !dlErr) {
          const destPath = decodedPath
          const { error: upErr } = await supabase.storage.from('delivered-videos').upload(destPath, fileData, { upsert: true })
          if (!upErr) {
            const { data: urlData } = supabase.storage.from('delivered-videos').getPublicUrl(destPath)
            publicLink = urlData.publicUrl
            console.log('[ClientApprove] Video copied, public_link:', publicLink)
          } else {
            publicLink = latestSub.video_url
            console.log('[ClientApprove] Upload to delivered-videos failed:', upErr.message)
          }
        } else {
          publicLink = latestSub.video_url
          console.log('[ClientApprove] Download failed, using original URL:', dlErr?.message)
        }
      }
    }

    await supabase.from('briefs').update({ status:'delivered', public_link: publicLink || null }).eq('id', id)
    setMsg('Müşteri adına onaylandı, kredi kesildi, creator kazancı oluşturuldu.')
    loadData(); setLoading(false)
  }

  async function handleQuestion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!question.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('brief_questions').insert({ brief_id: id, question, asked_by: user?.id })
    await supabase.from('briefs').update({ question_sent_at: new Date().toISOString() }).eq('id', id)
    setQuestion(''); loadData()
  }

  async function generateInspirations() {
    setInspLoading(true)
    // Delete unstarred, keep starred
    await supabase.from('brief_inspirations').delete().eq('brief_id', id).eq('is_starred', false)
    const starred = inspirations.filter(i => i.is_starred)
    const { data: { user } } = await supabase.auth.getUser()
    const res = await fetch('/api/generate-inspirations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: id, user_id: user?.id }) })
    const data = await res.json()
    setInspirations([...starred, ...(data.inspirations || [])])
    setInspLoading(false)
  }

  async function toggleStar(inspId: string, current: boolean) {
    await supabase.from('brief_inspirations').update({ is_starred: !current }).eq('id', inspId)
    setInspirations(prev => prev.map(i => i.id === inspId ? { ...i, is_starred: !current } : i))
  }

  function toggleSharedField(f: string) {
    setSharedFields(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }

  async function handleStatusChange(status: string) {
    await supabase.from('briefs').update({ status }).eq('id', id); loadData()
  }

  async function handleLogout() { await supabase.auth.signOut(); router.push('/login') }

  const clientRevisions = questions.filter(q => q.question.startsWith('REVİZYON:'))
  const unansweredQ = questions.filter(q => !q.question.startsWith('REVİZYON:') && !q.question.startsWith('İÇ REVİZYON:') && !q.answer)
  const visibleQ = questions.filter(q => !q.question.startsWith('REVİZYON:') && !q.question.startsWith('İÇ REVİZYON:'))
  const assigned = creators.find(c => c.id === form.assigned_creator_id)
  const [showAssignForm, setShowAssignForm] = useState(!form.assigned_creator_id)

  const videoRef = useRef<HTMLVideoElement>(null)

  function parseTimecode(text: string): { tc: number|null, clean: string } {
    const match = text.match(/^\[(\d{2}):(\d{2})\.(\d)\]\s*/)
    if (!match) return { tc: null, clean: text }
    const tc = parseInt(match[1])*60 + parseInt(match[2]) + parseInt(match[3])/10
    return { tc, clean: text.replace(match[0], '') }
  }

  function seekTo(seconds: number) {
    if (videoRef.current) { videoRef.current.currentTime = seconds; videoRef.current.play() }
  }

  const durMap: Record<string,string> = {'Bumper / Pre-roll':'6sn','Story / Reels':'15sn','Feed Video':'30sn','Long Form':'60sn'}
  const genderLabel = (g:string)=>g==='male'?' · Erkek':g==='female'?' · Kadın':''

  const inputStyle: React.CSSProperties = { width:'100%', boxSizing:'border-box', background:'#fff', border:'0.5px solid rgba(0,0,0,0.12)', borderRadius:'10px', padding:'9px 13px', fontSize:'14px', color:'#0a0a0a',  outline:'none' }
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance:'none' as any }
  const statusBadge = (s: string) => ({ fontSize:'11px' as const, padding:'3px 10px', borderRadius:'100px', fontWeight:'500' as const,
    background: s==='pending'?'rgba(0,0,0,0.05)':s==='producer_approved'||s==='admin_approved'?'rgba(34,197,94,0.1)':s==='revision_requested'?'rgba(239,68,68,0.1)':'rgba(0,0,0,0.05)',
    color: s==='pending'?'#888':s==='producer_approved'||s==='admin_approved'?'#22c55e':s==='revision_requested'?'#ef4444':'#888' })

  return (
    <div style={{display:'flex',minHeight:'100vh',}}>

      {/* SIDEBAR */}
      <div style={{width:'240px',background:'#0A0A0A',display:'flex',flexDirection:'column',flexShrink:0,height:'100vh',position:'sticky',top:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'18px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'12px'}}>
            <img src="/dinamo_logo.png" alt="Dinamo" style={{height:'28px'}} />
          </div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'3px'}}>Prodüktör</div>
          <div style={{fontSize:'13px',fontWeight:'500',color:'#fff'}}>{userName}</div>
        </div>
        <nav style={{padding:'10px 8px',flex:1}}>
          <div onClick={()=>router.push('/dashboard/producer')} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer'}}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>Briflere dön</span>
          </div>
        </nav>
        <div style={{padding:'10px 8px',borderTop:'0.5px solid rgba(255,255,255,0.07)'}}>
          <button onClick={handleLogout} style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',borderRadius:'7px',cursor:'pointer',width:'100%',background:'none',border:'none'}}>
            <span style={{fontSize:'11px',color:'rgba(255,255,255,0.25)',}}>Çıkış yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f5f4f0',overflow:'hidden'}}>
        {/* HEADER */}
        <div style={{padding:'14px 28px',background:'#fff',borderBottom:'0.5px solid rgba(0,0,0,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div>
            <div style={{fontSize:'16px',fontWeight:'500',color:'#0a0a0a',letterSpacing:'-0.3px'}}>{brief?.campaign_name}</div>
            {brief && <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginTop:'2px'}}>{brief.clients?.company_name} · {brief.video_type} · {brief.format} · {brief.credit_cost} kredi</div>}
          </div>
          {brief && (
            <div style={{display:'flex',gap:'6px'}}>
              {['in_production','revision','approved','delivered'].map(s=>(
                <button key={s} onClick={()=>handleStatusChange(s)}
                  style={{padding:'5px 12px',borderRadius:'100px',border:'0.5px solid',borderColor:brief.status===s?'#111113':'rgba(0,0,0,0.15)',background:brief.status===s?'#111113':'#fff',color:brief.status===s?'#fff':'#555',fontSize:'10px',cursor:'pointer',}}>
                  {statusLabel[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>
          {brief && (
            <>
              {msg && <div style={{padding:'10px 16px',background:msg.startsWith('Hata')||msg.includes('zorunlu')?'#fef2f2':'#e8f7e8',borderRadius:'8px',fontSize:'12px',color:msg.startsWith('Hata')||msg.includes('zorunlu')?'#ef4444':'#22c55e',marginBottom:'16px'}}>{msg}</div>}

              {/* CLIENT REVISION ALERT */}
              {clientRevisions.length > 0 && (
                <div style={{background:'#fff',border:'2px solid #ef4444',borderRadius:'12px',padding:'14px 20px',marginBottom:'16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
                    <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#ef4444'}}></div>
                    <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Müşteri Revizyonu</div>
                  </div>
                  {clientRevisions.map((r,i)=>{
                    const {tc,clean} = parseTimecode(r.question.replace('REVİZYON: ',''))
                    return (
                      <div key={r.id} style={{padding:'8px 12px',background:'#fef2f2',borderRadius:'8px',marginBottom:'4px',fontSize:'13px',color:'#0a0a0a',display:'flex',alignItems:'flex-start',gap:'8px'}}>
                        {tc!==null&&(
                          <button onClick={()=>seekTo(tc)} style={{fontSize:'10px',padding:'2px 8px',borderRadius:'100px',background:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'none',cursor:'pointer',fontFamily:'monospace',fontWeight:'500',flexShrink:0,marginTop:'2px'}}>
                            ▶ {Math.floor(tc/60)}:{String(Math.floor(tc%60)).padStart(2,'0')}
                          </button>
                        )}
                        <span>{clean}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* TWO COLUMN LAYOUT — Left: brief info + inspirations, Right: creator + videos + questions */}
              <div style={{display:'flex',gap:'20px'}}>

                {/* LEFT — BRIEF INFO + INSPIRATIONS */}
                <div style={{flex:'1.2',minWidth:0}}>
                  {/* Brief header */}
                  <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'24px',marginBottom:'12px'}}>
                    <div style={{fontSize:'26px',fontWeight:'600',color:'#0a0a0a',marginBottom:'4px'}}>{brief.campaign_name}</div>
                    <div style={{fontSize:'14px',color:'rgba(255,255,255,0.4)',marginBottom:'16px'}}>{brief.clients?.company_name} · {brief.credit_cost} kredi</div>

                    {/* Info rows with icons */}
                    <div style={{borderTop:'0.5px solid rgba(0,0,0,0.06)'}}>
                      {[
                        {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>, text:`${brief.video_type} · ${durMap[brief.video_type]||''}`},
                        {icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 21V3M16 21V3"/></svg>, text:brief.format},
                        brief.target_audience?{icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0112 0v2"/></svg>, text:brief.target_audience}:null,
                        brief.voiceover_type!=='none'?{icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><path d="M12 19v4M8 23h8"/></svg>, text:`${brief.voiceover_type==='real'?'Gerçek':'AI'} Seslendirme${genderLabel(brief.voiceover_gender||'')}`}:null,
                      ].filter(Boolean).map((row:any,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderBottom:'0.5px solid rgba(0,0,0,0.04)'}}>
                          {row.icon}
                          <span style={{fontSize:'14px',color:'#0a0a0a'}}>{row.text}</span>
                        </div>
                      ))}
                      {brief.platforms&&Array.isArray(brief.platforms)&&brief.platforms.length>0&&(
                        <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 0'}}>
                          {brief.platforms.map((p:string)=>(
                            <span key={p} style={{fontSize:'11px',padding:'3px 10px',borderRadius:'100px',background:'rgba(34,197,94,0.08)',color:'#22c55e',fontWeight:'500'}}>{p}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Brief text */}
                    {brief.message&&(
                      <div style={{marginTop:'20px'}}>
                        <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'6px'}}>Brief</div>
                        <div style={{fontSize:'15px',color:'#0a0a0a',lineHeight:1.8}}>{brief.message}</div>
                      </div>
                    )}
                    {brief.cta&&(
                      <div style={{marginTop:'14px'}}>
                        <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>CTA</div>
                        <div style={{fontSize:'15px',color:'#0a0a0a',lineHeight:1.8}}>{brief.cta}</div>
                      </div>
                    )}
                    {brief.voiceover_text&&(
                      <div style={{marginTop:'14px'}}>
                        <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>Seslendirme Metni</div>
                        <div style={{fontSize:'15px',color:'#0a0a0a',lineHeight:1.8}}>{brief.voiceover_text}</div>
                      </div>
                    )}
                    {brief.voiceover_type==='real'&&(
                      <div style={{marginTop:'14px',padding:'14px',background:'#fafaf8',borderRadius:'10px'}}>
                        <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'8px'}}>{brief.voiceover_gender==='male'?'Erkek':'Kadın'} Seslendirme Dosyası</div>
                        {brief.voiceover_file_url ? (
                          <div>
                            <audio controls src={brief.voiceover_file_url} style={{width:'100%',marginBottom:'8px'}} />
                            <div style={{display:'flex',gap:'8px'}}>
                              <a href={brief.voiceover_file_url} download target="_blank" style={{fontSize:'11px',color:'#22c55e',textDecoration:'none'}}>İndir ↓</a>
                              <button onClick={handleVoiceoverDelete} style={{fontSize:'11px',color:'#ef4444',background:'none',border:'none',cursor:'pointer',}}>Sil</button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <input ref={voFileRef} type="file" accept=".mp3,.wav,.m4a,audio/*" style={{fontSize:'12px',color:'#0a0a0a',marginBottom:'8px'}} />
                            <button onClick={handleVoiceoverUpload} disabled={voUpload}
                              style={{padding:'7px 16px',background:'#111113',color:'#fff',border:'none',borderRadius:'8px',fontSize:'11px',cursor:'pointer',fontWeight:'500'}}>
                              {voUpload?'Yükleniyor...':'Yükle'}
                            </button>
                            <div style={{fontSize:'10px',color:'rgba(255,255,255,0.25)',marginTop:'6px'}}>mp3, wav, m4a — maks 50MB</div>
                          </div>
                        )}
                      </div>
                    )}
                    {brief.notes&&(
                      <div style={{marginTop:'14px'}}>
                        <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>Notlar</div>
                        <div style={{fontSize:'15px',color:'#0a0a0a',lineHeight:1.8}}>{brief.notes}</div>
                      </div>
                    )}
                    <div style={{display:'flex',gap:'8px',marginTop:'14px'}}>
                      {brief.clients?.logo_url&&<a href={brief.clients.logo_url} target="_blank" style={{fontSize:'12px',color:'#22c55e',textDecoration:'none'}}>Logo ↓</a>}
                      {brief.clients?.font_url&&<a href={brief.clients.font_url} target="_blank" style={{fontSize:'12px',color:'#22c55e',textDecoration:'none'}}>Font ↓</a>}
                    </div>
                  </div>

                  {/* Brand guidance */}
                  {(brief.clients?.brand_primary_color || brief.clients?.brand_tone || brief.clients?.brand_avoid) && (
                    <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px 20px',marginBottom:'12px'}}>
                      <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>Marka Yönlendirmesi</div>
                      {(brief.clients?.brand_primary_color || brief.clients?.brand_secondary_color) && (
                        <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'8px'}}>
                          {brief.clients.brand_primary_color && <div style={{width:'20px',height:'20px',borderRadius:'4px',background:brief.clients.brand_primary_color,border:'0.5px solid rgba(0,0,0,0.1)'}} />}
                          {brief.clients.brand_secondary_color && <div style={{width:'20px',height:'20px',borderRadius:'4px',background:brief.clients.brand_secondary_color,border:'0.5px solid rgba(0,0,0,0.1)'}} />}
                          <span style={{fontSize:'10px',color:'#888'}}>Marka renkleri</span>
                        </div>
                      )}
                      {brief.clients?.brand_tone && <div style={{fontSize:'11px',color:'#0a0a0a',marginBottom:'6px'}}><span style={{color:'#888'}}>Ton:</span> {brief.clients.brand_tone}</div>}
                      {brief.clients?.brand_avoid && <div style={{fontSize:'11px',color:'#0a0a0a'}}><span style={{color:'#888'}}>Kaçın:</span> {brief.clients.brand_avoid}</div>}
                    </div>
                  )}

                  {/* Previous briefs */}
                  {prevBriefs.length > 0 && (
                    <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px 20px',marginBottom:'12px'}}>
                      <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>Önceki İşler</div>
                      {prevBriefs.map(pb=>(
                        <div key={pb.id} onClick={()=>router.push(`/dashboard/producer/briefs/${pb.id}`)} style={{padding:'6px 0',borderBottom:'0.5px solid rgba(0,0,0,0.04)',cursor:'pointer'}}>
                          <div style={{fontSize:'13px',color:'#0a0a0a',fontWeight:'500'}}>{pb.campaign_name}</div>
                          <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginTop:'2px'}}>{pb.video_type} · {new Date(pb.created_at).toLocaleDateString('tr-TR')}</div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>

                {/* RIGHT — CREATOR + VIDEOS + QUESTIONS */}
                <div style={{flex:'0.8',minWidth:0}}>
                  <div style={{marginBottom:'12px'}}>
                    <ProductionStudio briefId={id} source="admin" userRole="producer" />
                  </div>
                  {/* CREATOR CARD */}
                  <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px',marginBottom:'12px'}}>
                    {assigned ? (
                      <div>
                        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'8px'}}>
                          <div style={{width:'44px',height:'44px',borderRadius:'50%',background:'#22c55e',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:'500',color:'#fff',flexShrink:0}}>
                            {(assigned.users?.name||'?').split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase()}
                          </div>
                          <div style={{flex:1}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                              <div style={{fontSize:'16px',fontWeight:'500',color:'#0a0a0a'}}>{assigned.users?.name}</div>
                              <span style={{fontSize:'10px',padding:'3px 10px',borderRadius:'100px',background:'rgba(34,197,94,0.1)',color:'#22c55e',fontWeight:'500'}}>Atandı</span>
                            </div>
                            <div style={{marginTop:'4px',display:'flex',flexDirection:'column',gap:'2px'}}>
                              {assigned.users?.email&&<a href={`mailto:${assigned.users.email}`} style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',textDecoration:'none'}}>{assigned.users.email}</a>}
                              {assigned.phone&&<a href={`tel:${assigned.phone}`} style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',textDecoration:'none'}}>{assigned.phone}</a>}
                            </div>
                          </div>
                        </div>
                        <button onClick={()=>setShowAssignForm(!showAssignForm)} style={{fontSize:'12px',color:'#3b82f6',background:'none',border:'none',cursor:'pointer',padding:0}}>
                          {showAssignForm?'Gizle':'Değiştir'}
                        </button>
                      </div>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
                        <div style={{fontSize:'14px',color:'#555'}}>Creator atanmadı</div>
                        <span style={{fontSize:'10px',padding:'3px 10px',borderRadius:'100px',background:'rgba(245,158,11,0.1)',color:'#f59e0b',fontWeight:'500'}}>Atanmadı</span>
                      </div>
                    )}
                    {(showAssignForm||!assigned)&&(
                      <form onSubmit={handleForward} style={{marginTop:'10px'}}>
                        <div style={{marginBottom:'8px'}}>
                          <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>Creator</div>
                          <select value={form.assigned_creator_id} onChange={e=>setForm({...form,assigned_creator_id:e.target.value})} style={{...selectStyle,fontSize:'13px',padding:'9px 10px'}}>
                            <option value="">Seçin</option>
                            {creators.map(c=>{const jobs=creatorJobs[c.id]||0;return <option key={c.id} value={c.id}>{c.users?.name} ({jobs} aktif iş)</option>})}
                          </select>
                        </div>
                        {brief.voiceover_type==='real'&&(
                          <div style={{marginBottom:'8px'}}>
                            <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>Seslendirme</div>
                            <select value={form.assigned_voice_artist_id} onChange={e=>setForm({...form,assigned_voice_artist_id:e.target.value})} style={{...selectStyle,fontSize:'13px',padding:'9px 10px'}}>
                              <option value="">Seçin</option>
                              {voiceArtists.map(va=><option key={va.id} value={va.id}>{va.users?.name}</option>)}
                            </select>
                          </div>
                        )}
                        <div style={{marginBottom:'10px'}}>
                          <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'6px'}}>Creator'a İletilecek Alanlar</div>
                          {[{field:'message',label:'Mesaj'},{field:'cta',label:'CTA'},{field:'target_audience',label:'Hedef Kitle'},{field:'voiceover_text',label:'Seslendirme Metni'},{field:'notes',label:'Notlar'}].filter(f=>brief[f.field]).map(f=>(
                            <label key={f.field} style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'4px',cursor:'pointer',fontSize:'13px',color:'#0a0a0a'}}>
                              <input type="checkbox" checked={sharedFields.includes(f.field)} onChange={()=>toggleSharedField(f.field)} style={{accentColor:'#22c55e'}} />
                              {f.label}
                            </label>
                          ))}
                          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.25)',marginTop:'4px'}}>Format ve prodüktör notu her zaman iletilir.</div>
                        </div>
                        <div style={{marginBottom:'8px'}}>
                          <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>Prodüktör Notu</div>
                          <textarea value={form.producer_note} onChange={e=>setForm({...form,producer_note:e.target.value})} rows={2} style={{...inputStyle,resize:'vertical',padding:'9px 10px'}} />
                        </div>
                        <button type="submit" disabled={loading} style={{width:'100%',padding:'9px',background:'#111113',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontWeight:'500'}}>
                          {loading?'İletiliyor...':assigned?'Güncelle':"Creator'a İlet"}
                        </button>
                      </form>
                    )}
                  </div>

                  {/* VIDEOS */}
                  {submissions.length>0?(
                    submissions.map((s)=>(
                      <div key={s.id} style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',overflow:'hidden',marginBottom:'12px'}}>
                        <div style={{padding:'12px 16px',borderBottom:'0.5px solid rgba(0,0,0,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>V{s.version}</div>
                            <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>{new Date(s.submitted_at).toLocaleDateString('tr-TR',{day:'numeric',month:'short'})}</div>
                          </div>
                          <span style={statusBadge(s.status)}>{s.status==='pending'?'Bekliyor':s.status==='producer_approved'?'Onaylandı':s.status==='revision_requested'?'Revizyon':s.status}</span>
                        </div>
                        <div style={{padding:'12px'}}>
                          <video ref={s.id===submissions[0]?.id?videoRef:undefined} controls style={{width:'100%',borderRadius:'8px',display:'block',maxHeight:'200px'}}>
                            <source src={s.video_url} />
                          </video>
                        </div>
                        {s.status==='pending'&&(
                          <div style={{padding:'0 12px 12px'}}>
                            <button onClick={()=>handleApprove(s.id)} disabled={loading}
                              style={{width:'100%',padding:'10px',background:'#22c55e',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontWeight:'500',marginBottom:'8px'}}>
                              {approvalDelegated?'Onayla & Müşteriye İlet':'Onayla → Admin Onayına Gönder'}
                            </button>
                            <textarea value={revisionNotes[s.id]||''} onChange={e=>setRevisionNotes(prev=>({...prev,[s.id]:e.target.value}))}
                              placeholder="Revizyon notu..." rows={2} style={{...inputStyle,resize:'vertical',marginBottom:'8px'}} />
                            <button onClick={()=>handleRevision(s.id)} disabled={loading}
                              style={{padding:'8px 16px',background:'#fff',color:'#ef4444',border:'0.5px solid #ef4444',borderRadius:'8px',fontSize:'12px',cursor:'pointer',}}>
                              Revizyon İste
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  ):(
                    <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'24px',textAlign:'center',color:'rgba(255,255,255,0.4)',fontSize:'13px',marginBottom:'12px'}}>Henüz video yüklenmedi.</div>
                  )}

                  {/* QUESTIONS */}
                  <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px'}}>
                    <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>Sorular</div>
                    {visibleQ.length===0&&<div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',marginBottom:'10px'}}>Henüz soru yok.</div>}
                    {visibleQ.map(q=>(
                      <div key={q.id} style={{marginBottom:'6px',padding:'8px 10px',background:'#f5f4f0',borderRadius:'8px'}}>
                        <div style={{fontSize:'13px',color:'#0a0a0a',marginBottom:'2px'}}>{q.question}</div>
                        {q.answer ? (
                          <div style={{fontSize:'12px',color:'#22c55e'}}>↳ {q.answer}</div>
                        ) : answerEditing === q.id ? (
                          <div style={{display:'flex',gap:'6px',marginTop:'4px'}}>
                            <input value={answerText} onChange={e=>setAnswerText(e.target.value)} placeholder="Cevabı girin..." style={{flex:1,padding:'6px 10px',border:'0.5px solid rgba(0,0,0,0.12)',borderRadius:'6px',fontSize:'12px',color:'#0a0a0a',outline:'none'}} />
                            <button onClick={()=>handleAnswerForClient(q.id)} style={{padding:'6px 12px',background:'#22c55e',color:'#fff',border:'none',borderRadius:'6px',fontSize:'10px',cursor:'pointer',}}>Kaydet</button>
                            <button onClick={()=>setAnswerEditing(null)} style={{padding:'6px 10px',background:'#f5f4f0',color:'#555',border:'none',borderRadius:'6px',fontSize:'10px',cursor:'pointer',}}>İptal</button>
                          </div>
                        ) : (
                          <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'2px'}}>
                            <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>Cevap bekleniyor</div>
                            <button onClick={()=>{setAnswerEditing(q.id);setAnswerText('')}} style={{fontSize:'10px',color:'#3b82f6',background:'none',border:'none',cursor:'pointer',}}>Cevabı Gir</button>
                          </div>
                        )}
                      </div>
                    ))}
                    <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginTop:'8px',marginBottom:'6px'}}>
                      {['Format tercihiniz?','Logo dosyası var mı?','Renk paleti?','Referans video?','Yayın tarihi?','Hedef platform?'].map(t=>(
                        <button key={t} onClick={()=>setQuestion(t)} type="button"
                          style={{padding:'4px 10px',borderRadius:'100px',border:'0.5px solid rgba(0,0,0,0.1)',background:'#f5f4f0',fontSize:'11px',color:'#555',cursor:'pointer',}}>
                          {t}
                        </button>
                      ))}
                    </div>
                    <form onSubmit={handleQuestion} style={{display:'flex',gap:'6px'}}>
                      <input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Soru sor..." style={{...inputStyle,flex:1,padding:'9px 10px'}} />
                      <button type="submit" style={{padding:'9px 14px',background:'#111113',color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer',}}>Gönder</button>
                    </form>
                  </div>
                </div>
              </div>


              {/* MANUAL CLIENT APPROVE — bottom */}
              {brief.status === 'approved' && (
                <div style={{marginTop:'24px',paddingTop:'20px',borderTop:'0.5px solid rgba(0,0,0,0.08)'}}>
                  <button onClick={()=>setShowClientApproveModal(true)} disabled={loading}
                    style={{padding:'9px 20px',background:'#ef4444',color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontWeight:'500'}}>
                    Müşteri Onayladı (Manuel)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* CLIENT APPROVE CONFIRM MODAL */}
      {showClientApproveModal && (
        <div style={{position:'fixed',inset:0,zIndex:150,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowClientApproveModal(false)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(4px)'}} />
          <div onClick={e=>e.stopPropagation()} style={{position:'relative',background:'#fff',borderRadius:'16px',padding:'32px',width:'100%',maxWidth:'420px',textAlign:'center'}}>
            <div style={{width:'48px',height:'48px',borderRadius:'50%',background:'rgba(239,68,68,0.1)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            </div>
            <div style={{fontSize:'18px',fontWeight:'500',color:'#0a0a0a',marginBottom:'10px'}}>Dikkat</div>
            <div style={{fontSize:'13px',color:'rgba(255,255,255,0.4)',lineHeight:1.7,marginBottom:'24px'}}>Bu butonu yalnızca iş platform dışında ilerledi ve müşteri onay vermeden yayına girdi ya da platform dışından onay bildirdi ise kullanın. Devam etmek istiyor musunuz?</div>
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={()=>setShowClientApproveModal(false)} style={{flex:1,padding:'12px',background:'#f5f4f0',color:'#555',border:'none',borderRadius:'10px',fontSize:'14px',cursor:'pointer',}}>İptal</button>
              <button onClick={()=>{setShowClientApproveModal(false);handleClientApprove()}} disabled={loading}
                style={{flex:1,padding:'12px',background:'#ef4444',color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:'500',cursor:'pointer',}}>
                {loading?'İşleniyor...':'Evet, Onaylandı'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
