'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import ProductionStudio from '@/components/ProductionStudio'
import { useParams, useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

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

interface Submission { id:string; version:number; status:string; video_url:string; submitted_at:string; producer_notes:string|null }

async function recordCreatorEarning(briefId: string, submissionId: string) {
  const { data: pb } = await supabase.from('producer_briefs').select('assigned_creator_id').eq('brief_id', briefId).maybeSingle()
  if (!pb?.assigned_creator_id) return
  const { data: b } = await supabase.from('briefs').select('credit_cost').eq('id', briefId).single()
  if (!b) return
  const existing = await supabase.from('creator_earnings').select('id').eq('brief_id', briefId).maybeSingle()
  if ((existing.data as any)?.id) return
  const { data: rate } = await supabase.from('admin_settings').select('value').eq('key', 'creator_credit_rate').maybeSingle()
  const tlRate = parseFloat((rate as any)?.value || '500')
  await supabase.from('creator_earnings').insert({ brief_id: briefId, creator_id: pb.assigned_creator_id, video_submission_id: submissionId, credits: b.credit_cost, tl_rate: tlRate, tl_amount: b.credit_cost * tlRate, paid: false })
}

async function deductClientCredits(briefId: string) {
  const { data: b } = await supabase.from('briefs').select('credit_cost, client_id, client_user_id, campaign_name').eq('id', briefId).single()
  if (!b?.client_user_id) return
  const { data: cu } = await supabase.from('client_users').select('credit_balance').eq('id', b.client_user_id).single()
  if (!cu) return
  const newBal = Math.max(0, cu.credit_balance - (b.credit_cost||0))
  await supabase.from('client_users').update({ credit_balance: newBal }).eq('id', b.client_user_id)
  await supabase.from('credit_transactions').insert({ client_id: b.client_id, client_user_id: b.client_user_id, brief_id: briefId, amount: -(b.credit_cost||0), type:'deduct', description:`${b.campaign_name} — teslim` })
}

export default function AdminBriefDetail() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [brief, setBrief] = useState<any>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [questions, setQuestions] = useState<any[]>([])
  const [creators, setCreators] = useState<any[]>([])
  const [voiceArtists, setVoiceArtists] = useState<any[]>([])
  const [clientEmail, setClientEmail] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [revisionNotes, setRevisionNotes] = useState<Record<string,string>>({})
  const [forwardForm, setForwardForm] = useState({ producer_note:'', assigned_creator_id:'', assigned_voice_artist_id:'' })
  const [question, setQuestion] = useState('')
  const [userName, setUserName] = useState('')
  const [msg, setMsg] = useState('')
  const [adminNotes, setAdminNotes] = useState<any[]>([])
  const [newNote, setNewNote] = useState('')
  const [answerEditing, setAnswerEditing] = useState<string|null>(null)
  const [answerText, setAnswerText] = useState('')
  const [loading, setLoading] = useState(false)
  const [inspirations, setInspirations] = useState<any[]>([])
  const [inspLoading, setInspLoading] = useState(false)
  const [showClientApproveModal, setShowClientApproveModal] = useState(false)
  const [sharedFields, setSharedFields] = useState<string[]>(['message','cta','target_audience','voiceover_text','notes'])
  const [voUpload, setVoUpload] = useState(false)
  const voFileRef = useRef<HTMLInputElement>(null)
  const [deleteStep, setDeleteStep] = useState(0) // 0=hidden, 1=first confirm, 2=second confirm
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) { const { data: ud } = await supabase.from('users').select('name').eq('id', user.id).single(); setUserName(ud?.name||'') }
    const { data: b } = await supabase.from('briefs').select('*, clients(company_name), client_users(*, users(email, name))').eq('id', id).single()
    setBrief(b); setEditForm(b||{})
    if (b?.client_users?.users?.email) setClientEmail(b.client_users.users.email)
    const { data: s } = await supabase.from('video_submissions').select('*').eq('brief_id', id).order('submitted_at', { ascending: false })
    setSubmissions(s||[])
    const { data: q } = await supabase.from('brief_questions').select('*').eq('brief_id', id).order('asked_at')
    setQuestions(q||[])
    const { data: c } = await supabase.from('creators').select('*, users(name, email)').eq('is_active', true)
    setCreators(c||[])
    const { data: va } = await supabase.from('voice_artists').select('*, users(name)')
    setVoiceArtists(va||[])
    const { data: pb } = await supabase.from('producer_briefs').select('*').eq('brief_id', id).maybeSingle()
    if (pb) {
      setForwardForm({ producer_note: pb.producer_note||'', assigned_creator_id: pb.assigned_creator_id||'', assigned_voice_artist_id: pb.assigned_voice_artist_id||'' })
      if (pb.shared_fields) setSharedFields(pb.shared_fields)
    }
    const { data: notes } = await supabase.from('brief_notes').select('*, users:created_by(name)').eq('brief_id', id).order('created_at', { ascending: false })
    setAdminNotes(notes || [])
    const { data: insp } = await supabase.from('brief_inspirations').select('*').eq('brief_id', id).order('created_at', { ascending: false })
    setInspirations(insp || [])
  }

  async function handleVoiceoverUpload() {
    const file = voFileRef.current?.files?.[0]
    if (!file) return
    const allowed = ['audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/x-m4a','audio/m4a']
    if (!allowed.some(t => file.type.includes(t.split('/')[1])) && !file.name.match(/\.(mp3|wav|m4a)$/i)) { setMsg('Desteklenen formatlar: mp3, wav, m4a'); return }
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

  async function handleAnswerForClient(qId: string) {
    if (!answerText.trim()) return
    await supabase.from('brief_questions').update({ answer: answerText, answered_at: new Date().toISOString() }).eq('id', qId)
    setAnswerEditing(null); setAnswerText(''); loadData()
  }

  async function handleAddNote() {
    if (!newNote.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('brief_notes').insert({ brief_id: id, note: newNote, created_by: user?.id })
    setNewNote('')
    const { data: notes } = await supabase.from('brief_notes').select('*, users:created_by(name)').eq('brief_id', id).order('created_at', { ascending: false })
    setAdminNotes(notes || [])
  }

  function toggleSharedField(f: string) {
    setSharedFields(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }

  async function handleApprove(submissionId: string) {
    setLoading(true); setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('video_submissions').update({ status:'admin_approved' }).eq('id', submissionId)
    await supabase.from('approvals').insert({ video_submission_id: submissionId, approved_by: user?.id, role:'admin' })
    await supabase.from('briefs').update({ status:'approved' }).eq('id', id)
    if (clientEmail && brief) {
      await fetch('/api/notify', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ to: clientEmail, subject: `${brief.campaign_name} — Videonuz Hazır`, html: `<p>Merhaba,</p><p><strong>${brief.campaign_name}</strong> kampanyanız için hazırlanan video onaylandı. Dinamo panelinden inceleyebilirsiniz.</p><p>İyi çalışmalar,<br/>Dinamo</p>` }) }).catch(()=>null)
    }
    setMsg('Video onaylandı, müşteriye iletildi.')
    loadData(); setLoading(false)
  }

  async function handleClientApprove() {
    setLoading(true)
    await deductClientCredits(id)
    const latestSub = submissions.find(s => s.status === 'admin_approved' || s.status === 'producer_approved') || submissions[0]
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
    setMsg('Revizyon talebi gönderildi.')
    loadData(); setLoading(false)
  }

  async function handleForward(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    const creatorId = forwardForm.assigned_creator_id && forwardForm.assigned_creator_id.length > 10 ? forwardForm.assigned_creator_id : null
    const voiceId = forwardForm.assigned_voice_artist_id && forwardForm.assigned_voice_artist_id.length > 10 ? forwardForm.assigned_voice_artist_id : null
    await supabase.from('producer_briefs').delete().eq('brief_id', id)
    const { error } = await supabase.from('producer_briefs').insert({ brief_id: id, producer_id: user?.id, producer_note: forwardForm.producer_note, assigned_creator_id: creatorId, assigned_voice_artist_id: voiceId, shared_fields: sharedFields, forwarded_at: new Date().toISOString() })
    if (error) { setMsg('Hata: '+error.message); setLoading(false); return }
    await supabase.from('briefs').update({ status:'in_production' }).eq('id', id)
    setMsg("Creator'a iletildi.")
    loadData(); setLoading(false)
  }

  async function handleQuestion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!question.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('brief_questions').insert({ brief_id: id, question, asked_by: user?.id })
    await supabase.from('briefs').update({ question_sent_at: new Date().toISOString() }).eq('id', id)
    setQuestion(''); loadData()
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true)
    const { error } = await supabase.from('briefs').update({ campaign_name: editForm.campaign_name, video_type: editForm.video_type, message: editForm.message, cta: editForm.cta, target_audience: editForm.target_audience, notes: editForm.notes, credit_cost: parseInt(editForm.credit_cost) }).eq('id', id)
    if (error) { setMsg('Hata: '+error.message); setLoading(false); return }
    setMsg('Brief güncellendi.'); setEditMode(false); loadData(); setLoading(false)
  }

  async function handleCancel() {
    if (!confirm('Bu briefi iptal etmek istediğinizden emin misiniz?')) return
    await supabase.from('briefs').update({ status:'cancelled' }).eq('id', id)
    if (clientEmail && brief) { await fetch('/api/notify', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ to: clientEmail, subject: `${brief.campaign_name} — İptal`, html: `<p>Merhaba,</p><p><strong>${brief.campaign_name}</strong> briefi iptal edildi.</p><p>İyi çalışmalar,<br/>Dinamo</p>` }) }).catch(()=>null) }
    router.push('/dashboard/admin/briefs')
  }

  async function deleteBrief() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/briefs/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || data.error) {
        setMsg(data.error || 'Silme hatasi')
        setDeleting(false)
        setDeleteStep(0)
        return
      }
      router.push('/dashboard/admin/briefs')
    } catch (err: any) {
      setMsg('Silme hatasi: ' + (err.message || 'Bilinmeyen hata'))
      setDeleting(false)
      setDeleteStep(0)
    }
  }

  async function handleLogout() { await supabase.auth.signOut(); router.push('/login') }

  const videoRef = useRef<HTMLVideoElement>(null)
  function parseTimecode(text: string): { tc: number|null, clean: string } {
    const match = text.match(/^\[(\d{2}):(\d{2})\.(\d)\]\s*/)
    if (!match) return { tc: null, clean: text }
    return { tc: parseInt(match[1])*60 + parseInt(match[2]) + parseInt(match[3])/10, clean: text.replace(match[0], '') }
  }
  function seekTo(seconds: number) { if (videoRef.current) { videoRef.current.currentTime = seconds; videoRef.current.play() } }

  const clientRevisions = questions.filter(q => q.question.startsWith('REVİZYON:'))
  const visibleQ = questions.filter(q => !q.question.startsWith('REVİZYON:') && !q.question.startsWith('İÇ REVİZYON:'))
  const assigned = creators.find(c => c.id === forwardForm.assigned_creator_id)
  const [showAssignForm, setShowAssignForm] = useState(!forwardForm.assigned_creator_id)

  const inputStyle: React.CSSProperties = { width:'100%', boxSizing:'border-box', background:'#fff', border:'0.5px solid rgba(0,0,0,0.12)', borderRadius:'10px', padding:'9px 13px', fontSize:'13px', color:'#0a0a0a', fontFamily:'var(--font-dm-sans),sans-serif', outline:'none' }
  const statusBadge = (s: string) => ({ fontSize:'10px' as const, padding:'3px 10px', borderRadius:'100px', fontWeight:'500' as const,
    background: s==='pending'?'rgba(0,0,0,0.05)':s==='producer_approved'||s==='admin_approved'?'rgba(34,197,94,0.1)':s==='revision_requested'?'rgba(239,68,68,0.1)':'rgba(0,0,0,0.05)',
    color: s==='pending'?'#888':s==='producer_approved'||s==='admin_approved'?'#22c55e':s==='revision_requested'?'#ef4444':'#888' })

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"var(--font-dm-sans),'DM Sans',system-ui,sans-serif"}}>

      {/* SIDEBAR */}
      <div style={{width:'240px',background:'#0A0A0A',display:'flex',flexDirection:'column',flexShrink:0,height:'100vh',position:'sticky',top:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'18px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'12px'}}>
            <img src="/dinamo_logo.png" alt="Dinamo" style={{height:'28px'}} />
          </div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'3px'}}>Admin</div>
          <div style={{fontSize:'13px',fontWeight:'500',color:'#fff'}}>{userName}</div>
        </div>
        <nav style={{padding:'10px 8px',flex:1}}>
          {NAV.map(item=>(
            <div key={item.href} onClick={()=>router.push(item.href)} style={{display:'flex',alignItems:'center',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',marginBottom:'1px'}}>
              <span style={{fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{padding:'10px 8px',borderTop:'0.5px solid rgba(255,255,255,0.07)'}}>
          <button onClick={handleLogout} style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',borderRadius:'7px',cursor:'pointer',width:'100%',background:'none',border:'none'}}>
            <span style={{fontSize:'11px',color:'rgba(255,255,255,0.25)',fontFamily:'var(--font-dm-sans),sans-serif'}}>Çıkış yap</span>
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
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>setEditMode(!editMode)} style={{padding:'6px 14px',border:'0.5px solid rgba(0,0,0,0.15)',borderRadius:'8px',background:'#fff',color:'#555',fontSize:'11px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>{editMode?'İptal':'Düzenle'}</button>
            <button onClick={handleCancel} style={{padding:'6px 14px',border:'0.5px solid #ef4444',borderRadius:'8px',background:'#fff',color:'#ef4444',fontSize:'11px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>İptal Et</button>
          </div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>
          {brief && (
            <>
              {msg && <div style={{padding:'10px 16px',background:msg.startsWith('Hata')||msg.includes('zorunlu')?'#fef2f2':'#e8f7e8',borderRadius:'8px',fontSize:'12px',color:msg.startsWith('Hata')||msg.includes('zorunlu')?'#ef4444':'#22c55e',marginBottom:'16px'}}>{msg}</div>}

              {clientRevisions.length > 0 && (
                <div style={{background:'#fff',border:'2px solid #ef4444',borderRadius:'12px',padding:'14px 20px',marginBottom:'16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
                    <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#ef4444'}}></div>
                    <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Müşteri Revizyonu</div>
                  </div>
                  {clientRevisions.map((r,i)=>{
                    const {tc,clean}=parseTimecode(r.question.replace('REVİZYON: ',''))
                    return (
                      <div key={r.id} style={{padding:'8px 12px',background:'#fef2f2',borderRadius:'8px',marginBottom:'4px',fontSize:'13px',color:'#0a0a0a',display:'flex',alignItems:'flex-start',gap:'8px'}}>
                        {tc!==null&&<button onClick={()=>seekTo(tc)} style={{fontSize:'10px',padding:'2px 8px',borderRadius:'100px',background:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'none',cursor:'pointer',fontFamily:'monospace',fontWeight:'500',flexShrink:0,marginTop:'2px'}}>▶ {Math.floor(tc/60)}:{String(Math.floor(tc%60)).padStart(2,'0')}</button>}
                        <span>{clean}</span>
                      </div>
                    )
                  })}
                </div>
              )}


              {/* Edit mode full form */}
              {editMode && (
                <form onSubmit={handleEdit} style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                  <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a',marginBottom:'16px'}}>Brief Düzenle</div>
                  {[{key:'campaign_name',label:'Kampanya Adı',type:'text'},{key:'video_type',label:'Video Tipi',type:'text'},{key:'message',label:'Mesaj',type:'textarea'},{key:'cta',label:'CTA',type:'text'},{key:'target_audience',label:'Hedef Kitle',type:'text'},{key:'notes',label:'Notlar',type:'textarea'},{key:'credit_cost',label:'Kredi',type:'number'}].map(f=>(
                    <div key={f.key} style={{marginBottom:'14px'}}>
                      <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'6px'}}>{f.label}</div>
                      {f.type==='textarea'?<textarea value={editForm[f.key]||''} onChange={e=>setEditForm({...editForm,[f.key]:e.target.value})} rows={3} style={{...inputStyle,resize:'vertical'}} />:<input type={f.type} value={editForm[f.key]||''} onChange={e=>setEditForm({...editForm,[f.key]:e.target.value})} style={inputStyle} />}
                    </div>
                  ))}
                  <button type="submit" disabled={loading} style={{padding:'9px 20px',background:'#111113',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',fontWeight:'500'}}>{loading?'Kaydediliyor...':'Kaydet'}</button>
                </form>
              )}

              {/* TWO COLUMN LAYOUT */}
              {!editMode && (
                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'20px'}}>
                  {/* LEFT — VIDEOS */}
                  <div>
                    {submissions.length === 0 ? (
                      <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'32px',textAlign:'center',color:'rgba(255,255,255,0.4)',fontSize:'13px'}}>Henüz video yüklenmedi.</div>
                    ) : submissions.map((s) => (
                      <div key={s.id} style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',overflow:'hidden',marginBottom:'12px'}}>
                        <div style={{padding:'12px 16px',borderBottom:'0.5px solid rgba(0,0,0,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>Versiyon {s.version}</div>
                            <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>{new Date(s.submitted_at).toLocaleDateString('tr-TR',{day:'numeric',month:'short'})}</div>
                          </div>
                          <span style={statusBadge(s.status)}>{s.status==='pending'?'Bekliyor':s.status==='producer_approved'?'Prodüktör Onayı':s.status==='admin_approved'?'Onaylandı':s.status==='revision_requested'?'Revizyon':s.status}</span>
                        </div>
                        <div style={{padding:'16px'}}>
                          <div style={{borderRadius:'10px',overflow:'hidden',maxWidth:brief.format==='9:16'?'220px':brief.format==='1:1'?'300px':'100%'}}>
                            <video ref={s.id===submissions[0]?.id?videoRef:undefined} controls style={{width:'100%',borderRadius:'10px',display:'block',maxHeight:'200px'}}>
                              <source src={s.video_url} />
                            </video>
                          </div>
                        </div>
                        {(s.status==='pending'||s.status==='producer_approved')&&(
                          <div style={{padding:'0 16px 16px'}}>
                            <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
                              <button onClick={()=>handleApprove(s.id)} disabled={loading}
                                style={{flex:1,padding:'11px',background:'#22c55e',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',fontWeight:'500'}}>
                                {loading?'İşleniyor...':'Onayla → Müşteriye İlet'}
                              </button>
                              <button onClick={()=>handleApprove(s.id)} disabled={loading}
                                style={{width:'44px',height:'44px',background:'#22c55e',color:'#fff',border:'none',borderRadius:'8px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M14 9V5a3 3 0 00-6 0v1M5 21h14a2 2 0 002-2v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2z"/></svg>
                              </button>
                            </div>
                            <textarea value={revisionNotes[s.id]||''} onChange={e=>setRevisionNotes(prev=>({...prev,[s.id]:e.target.value}))}
                              placeholder="Revizyon notu yazın..." rows={2} style={{...inputStyle,resize:'vertical',marginBottom:'8px',fontSize:'12px'}} />
                            <button onClick={()=>handleRevision(s.id)} disabled={loading}
                              style={{padding:'8px 16px',background:'#fff',color:'#ef4444',border:'0.5px solid #ef4444',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>
                              Revizyon İste
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* RIGHT — SIDEBAR */}
                  <div>
                    {!editMode && (
                      <div style={{marginBottom:'12px'}}>
                        <ProductionStudio briefId={id} source="admin" userRole="admin" />
                      </div>
                    )}
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
                                <span style={{fontSize:'9px',padding:'3px 10px',borderRadius:'100px',background:'rgba(34,197,94,0.1)',color:'#22c55e',fontWeight:'500'}}>Atandı</span>
                              </div>
                              <div style={{marginTop:'4px',display:'flex',flexDirection:'column',gap:'2px'}}>
                                {assigned.users?.email && <a href={`mailto:${assigned.users.email}`} style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textDecoration:'none'}}>{assigned.users.email}</a>}
                                {assigned.phone && <a href={`tel:${assigned.phone}`} style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textDecoration:'none'}}>{assigned.phone}</a>}
                              </div>
                            </div>
                          </div>
                          <button onClick={()=>setShowAssignForm(!showAssignForm)} style={{fontSize:'11px',color:'#3b82f6',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',padding:0}}>
                            {showAssignForm?'Gizle':'Değiştir'}
                          </button>
                        </div>
                      ) : (
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
                          <div style={{fontSize:'13px',color:'#555'}}>Creator atanmadı</div>
                          <span style={{fontSize:'9px',padding:'3px 10px',borderRadius:'100px',background:'rgba(245,158,11,0.1)',color:'#f59e0b',fontWeight:'500'}}>Atanmadı</span>
                        </div>
                      )}
                      {(showAssignForm || !assigned) && (
                        <form onSubmit={handleForward} style={{marginTop:'10px'}}>
                          <div style={{marginBottom:'8px'}}>
                            <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>Creator</div>
                            <select value={forwardForm.assigned_creator_id} onChange={e=>setForwardForm({...forwardForm,assigned_creator_id:e.target.value})} style={{...inputStyle,fontSize:'12px',padding:'8px 10px'}}>
                              <option value="">Seçin</option>
                              {creators.map(c=><option key={c.id} value={c.id}>{c.users?.name}</option>)}
                            </select>
                          </div>
                          {brief.voiceover_type==='real'&&(
                            <div style={{marginBottom:'8px'}}>
                              <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>Seslendirme</div>
                              <select value={forwardForm.assigned_voice_artist_id} onChange={e=>setForwardForm({...forwardForm,assigned_voice_artist_id:e.target.value})} style={{...inputStyle,fontSize:'12px',padding:'8px 10px'}}>
                                <option value="">Seçin</option>
                                {voiceArtists.map(va=><option key={va.id} value={va.id}>{va.users?.name}</option>)}
                              </select>
                            </div>
                          )}
                          <div style={{marginBottom:'10px'}}>
                            <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'6px'}}>Creator'a İletilecek Alanlar</div>
                            {[
                              {field:'message',label:'Mesaj'},
                              {field:'cta',label:'CTA'},
                              {field:'target_audience',label:'Hedef Kitle'},
                              {field:'voiceover_text',label:'Seslendirme Metni'},
                              {field:'notes',label:'Notlar'},
                            ].filter(f => brief[f.field]).map(f=>(
                              <label key={f.field} style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'4px',cursor:'pointer',fontSize:'12px',color:'#0a0a0a'}}>
                                <input type="checkbox" checked={sharedFields.includes(f.field)} onChange={()=>toggleSharedField(f.field)} style={{accentColor:'#22c55e'}} />
                                {f.label}
                              </label>
                            ))}
                            <div style={{fontSize:'10px',color:'rgba(255,255,255,0.25)',marginTop:'4px'}}>Format ve prodüktör notu her zaman iletilir.</div>
                          </div>
                          <div style={{marginBottom:'8px'}}>
                            <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>Not</div>
                            <textarea value={forwardForm.producer_note} onChange={e=>setForwardForm({...forwardForm,producer_note:e.target.value})} rows={2} style={{...inputStyle,resize:'vertical',fontSize:'12px',padding:'8px 10px'}} />
                          </div>
                          <button type="submit" disabled={loading} style={{width:'100%',padding:'8px',background:'#111113',color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',fontWeight:'500'}}>
                            {loading?'İletiliyor...':assigned?'Güncelle':"Creator'a İlet"}
                          </button>
                        </form>
                      )}
                    </div>

                    {/* BRIEF INFO */}
                    <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px',marginBottom:'12px'}}>
                      <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'12px'}}>Brief</div>
                      {[{label:'Müşteri',value:brief.client_users?.users?.name},{label:'Email',value:clientEmail},{label:'Mecralar',value:brief.platforms&&Array.isArray(brief.platforms)&&brief.platforms.length>0?brief.platforms.join(', '):null},{label:'Mesaj',value:brief.message},{label:'CTA',value:brief.cta},{label:'Hedef Kitle',value:brief.target_audience},{label:'Seslendirme',value:brief.voiceover_type==='real'?`Gerçek Seslendirme${brief.voiceover_gender==='male'?' · Erkek':brief.voiceover_gender==='female'?' · Kadın':''}`:brief.voiceover_type==='ai'?`AI Seslendirme${brief.voiceover_gender==='male'?' · Erkek':brief.voiceover_gender==='female'?' · Kadın':''}`:null},{label:'Seslendirme Metni',value:brief.voiceover_text},{label:'Notlar',value:brief.notes}].filter(f=>f.value).map(f=>(
                        <div key={f.label} style={{marginBottom:'10px',paddingBottom:'10px',borderBottom:'0.5px solid rgba(0,0,0,0.06)'}}>
                          <div style={{fontSize:'9px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'3px'}}>{f.label}</div>
                          <div style={{fontSize:'12px',color:'#0a0a0a',lineHeight:'1.5'}}>{f.value}</div>
                        </div>
                      ))}
                      <div style={{display:'flex',gap:'8px',marginTop:'4px'}}>
                        {brief.clients?.logo_url&&<a href={brief.clients.logo_url} target="_blank" style={{fontSize:'11px',color:'#22c55e',textDecoration:'none'}}>Logo ↓</a>}
                        {brief.clients?.font_url&&<a href={brief.clients.font_url} target="_blank" style={{fontSize:'11px',color:'#22c55e',textDecoration:'none'}}>Font ↓</a>}
                      </div>
                    </div>

                    {/* VOICEOVER UPLOAD */}
                    {brief.voiceover_type==='real'&&(
                      <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px',marginBottom:'12px'}}>
                        <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>{brief.voiceover_gender==='male'?'Erkek':'Kadın'} Seslendirme Dosyası</div>
                        {brief.voiceover_file_url ? (
                          <div>
                            <audio controls src={brief.voiceover_file_url} style={{width:'100%',marginBottom:'8px',borderRadius:'8px'}} />
                            <div style={{display:'flex',gap:'6px'}}>
                              <a href={brief.voiceover_file_url} download target="_blank" style={{fontSize:'11px',color:'#22c55e',textDecoration:'none'}}>İndir ↓</a>
                              <button onClick={handleVoiceoverDelete} style={{fontSize:'11px',color:'#ef4444',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>Sil</button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <input ref={voFileRef} type="file" accept=".mp3,.wav,.m4a,audio/*" style={{fontSize:'12px',color:'#0a0a0a',marginBottom:'8px'}} />
                            <button onClick={handleVoiceoverUpload} disabled={voUpload}
                              style={{padding:'7px 16px',background:'#111113',color:'#fff',border:'none',borderRadius:'8px',fontSize:'11px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',fontWeight:'500'}}>
                              {voUpload?'Yükleniyor...':'Yükle'}
                            </button>
                            <div style={{fontSize:'10px',color:'rgba(255,255,255,0.25)',marginTop:'6px'}}>mp3, wav, m4a — maks 50MB</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* QUESTIONS */}
                    <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px'}}>
                      <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>Sorular</div>
                      {visibleQ.length===0&&<div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginBottom:'10px'}}>Henüz soru yok.</div>}
                      {visibleQ.map(q=>(
                        <div key={q.id} style={{marginBottom:'6px',padding:'8px 10px',background:'#f5f4f0',borderRadius:'8px'}}>
                          <div style={{fontSize:'12px',color:'#0a0a0a',marginBottom:'2px'}}>{q.question}</div>
                          {q.answer ? (
                            <div style={{fontSize:'11px',color:'#22c55e'}}>↳ {q.answer}</div>
                          ) : answerEditing === q.id ? (
                            <div style={{display:'flex',gap:'6px',marginTop:'4px'}}>
                              <input value={answerText} onChange={e=>setAnswerText(e.target.value)} placeholder="Cevabı girin..." style={{flex:1,padding:'6px 10px',border:'0.5px solid rgba(0,0,0,0.12)',borderRadius:'6px',fontSize:'11px',color:'#0a0a0a',fontFamily:'var(--font-dm-sans),sans-serif',outline:'none'}} />
                              <button onClick={()=>handleAnswerForClient(q.id)} style={{padding:'6px 10px',background:'#22c55e',color:'#fff',border:'none',borderRadius:'6px',fontSize:'10px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>Kaydet</button>
                              <button onClick={()=>setAnswerEditing(null)} style={{padding:'6px 8px',background:'#f5f4f0',color:'#555',border:'none',borderRadius:'6px',fontSize:'10px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>İptal</button>
                            </div>
                          ) : (
                            <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'2px'}}>
                              <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)'}}>Cevap bekleniyor</div>
                              <button onClick={()=>{setAnswerEditing(q.id);setAnswerText('')}} style={{fontSize:'10px',color:'#3b82f6',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>Cevabı Gir</button>
                            </div>
                          )}
                        </div>
                      ))}
                      <form onSubmit={handleQuestion} style={{display:'flex',gap:'6px',marginTop:'8px'}}>
                        <input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Soru sor..." style={{...inputStyle,flex:1,fontSize:'12px',padding:'8px 10px'}} />
                        <button type="submit" style={{padding:'8px 14px',background:'#111113',color:'#fff',border:'none',borderRadius:'8px',fontSize:'11px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>Gönder</button>
                      </form>
                    </div>
                    {/* ADMIN NOTES */}
                    <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px',marginTop:'12px'}}>
                      <div style={{fontSize:'10px',color:'#f59e0b',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>İç Notlar (sadece admin)</div>
                      {adminNotes.map(n=>(
                        <div key={n.id} style={{marginBottom:'6px',padding:'8px 10px',background:'rgba(245,158,11,0.04)',borderRadius:'8px',border:'0.5px solid rgba(245,158,11,0.1)'}}>
                          <div style={{fontSize:'12px',color:'#0a0a0a'}}>{n.note}</div>
                          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.25)',marginTop:'3px'}}>{n.users?.name} · {new Date(n.created_at).toLocaleDateString('tr-TR')}</div>
                        </div>
                      ))}
                      <div style={{display:'flex',gap:'6px',marginTop:'8px'}}>
                        <input value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="İç not ekle..."
                          onKeyDown={e=>{if(e.key==='Enter') handleAddNote()}}
                          style={{flex:1,padding:'8px 10px',border:'0.5px solid rgba(0,0,0,0.12)',borderRadius:'8px',fontSize:'12px',color:'#0a0a0a',fontFamily:'var(--font-dm-sans),sans-serif',outline:'none'}} />
                        <button onClick={handleAddNote} style={{padding:'8px 12px',background:'#f59e0b',color:'#fff',border:'none',borderRadius:'8px',fontSize:'11px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>Ekle</button>
                      </div>
                    </div>

                  </div>
                </div>
              )}


              {/* MANUAL CLIENT APPROVE — bottom */}
              {(brief.status==='approved'||brief.status==='in_production')&&(
                <div style={{marginTop:'24px',paddingTop:'20px',borderTop:'0.5px solid rgba(0,0,0,0.08)'}}>
                  <button onClick={()=>setShowClientApproveModal(true)} disabled={loading}
                    style={{padding:'9px 20px',background:'#ef4444',color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',fontWeight:'500'}}>
                    Müşteri Onayladı (Manuel)
                  </button>
                </div>
              )}
              {/* DELETE BRIEF */}
              <div style={{marginTop:'32px',paddingTop:'20px',borderTop:'0.5px solid rgba(0,0,0,0.08)'}}>
                <button onClick={()=>setDeleteStep(1)}
                  style={{padding:'9px 20px',background:'#fff',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',fontWeight:'500'}}>
                  Brief'i Sil
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* DELETE CONFIRM — STEP 1 */}
      {deleteStep === 1 && (
        <div style={{position:'fixed',inset:0,zIndex:150,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setDeleteStep(0)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)'}} />
          <div style={{position:'relative',background:'#fff',borderRadius:'16px',padding:'32px',width:'420px',maxWidth:'90vw',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:'16px',fontWeight:'500',color:'#0a0a0a',marginBottom:'12px'}}>Brief'i Sil</div>
            <div style={{fontSize:'13px',color:'#555',lineHeight:1.7,marginBottom:'24px'}}>Bu brief'i silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</div>
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={()=>setDeleteStep(0)} style={{flex:1,padding:'12px',background:'#f5f4f0',color:'#555',border:'none',borderRadius:'10px',fontSize:'14px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>İptal</button>
              <button onClick={()=>setDeleteStep(2)}
                style={{flex:1,padding:'12px',background:'#ef4444',color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:'500',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM — STEP 2 (final) */}
      {deleteStep === 2 && (
        <div style={{position:'fixed',inset:0,zIndex:150,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setDeleteStep(0)}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)'}} />
          <div style={{position:'relative',background:'#fff',borderRadius:'16px',padding:'32px',width:'420px',maxWidth:'90vw',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:'16px',fontWeight:'500',color:'#ef4444',marginBottom:'12px'}}>Son Onay</div>
            <div style={{fontSize:'13px',color:'#555',lineHeight:1.7,marginBottom:'24px'}}>Son kez soruyoruz — brief ve tüm ilişkili dosyalar kalıcı olarak silinecek. Devam etmek istiyor musunuz?</div>
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={()=>setDeleteStep(0)} style={{flex:1,padding:'12px',background:'#f5f4f0',color:'#555',border:'none',borderRadius:'10px',fontSize:'14px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>Vazgeç</button>
              <button onClick={deleteBrief} disabled={deleting}
                style={{flex:1,padding:'12px',background:'#ef4444',color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:'500',cursor:deleting?'not-allowed':'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>
                {deleting ? 'Siliniyor...' : 'Kalıcı Olarak Sil'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <button onClick={()=>setShowClientApproveModal(false)} style={{flex:1,padding:'12px',background:'#f5f4f0',color:'#555',border:'none',borderRadius:'10px',fontSize:'14px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>İptal</button>
              <button onClick={()=>{setShowClientApproveModal(false);handleClientApprove()}} disabled={loading}
                style={{flex:1,padding:'12px',background:'#ef4444',color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:'500',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>
                {loading?'İşleniyor...':'Evet, Onaylandı'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
