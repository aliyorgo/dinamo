'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import ProductionStudio from '@/components/ProductionStudio'
import { useParams, useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

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

const STATUS_BADGE: Record<string,{label:string,bg:string,border:string}> = {
  submitted: { label: 'YENİ İŞ', bg: 'rgba(156,163,175,0.12)', border: '#9ca3af' },
  read: { label: 'OKUNDU', bg: 'rgba(156,163,175,0.12)', border: '#9ca3af' },
  in_production: { label: 'ÜRETİMDE', bg: 'rgba(245,158,11,0.12)', border: '#f59e0b' },
  revision: { label: 'REVİZYON', bg: 'rgba(239,68,68,0.12)', border: '#ef4444' },
  approved: { label: 'ONAY BEKLİYOR', bg: 'rgba(59,130,246,0.12)', border: '#3b82f6' },
  delivered: { label: 'TAMAMLANDI', bg: 'rgba(34,197,94,0.12)', border: '#22c55e' },
  cancelled: { label: 'İPTAL', bg: 'rgba(0,0,0,0.06)', border: '#888' },
  ai_processing: { label: 'AI ÜRETİYOR', bg: 'rgba(245,158,11,0.12)', border: '#f59e0b' },
  ai_completed: { label: 'AI HAZIR', bg: 'rgba(59,130,246,0.12)', border: '#3b82f6' },
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
  const [deleteStep, setDeleteStep] = useState(0)
  const [deleting, setDeleting] = useState(false)
  // Child briefs
  const [cpsChildren, setCpsChildren] = useState<any[]>([])
  const [aiChildren, setAiChildren] = useState<any[]>([])
  // Collapsible sections
  const [briefOpen, setBriefOpen] = useState(true)
  const [cpsOpen, setCpsOpen] = useState<Record<string,boolean>>({})
  const [aiOpen, setAiOpen] = useState<Record<string,boolean>>({})
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [showReassignConfirm, setShowReassignConfirm] = useState(false)
  // CPS per-child creator forms
  const [cpsCreatorForms, setCpsCreatorForms] = useState<Record<string,{creator_id:string,note:string,open:boolean}>>({})
  const [cpsRevNotes, setCpsRevNotes] = useState<Record<string,Record<string,string>>>({})
  const [cpsProducerBriefs, setCpsProducerBriefs] = useState<Record<string,any>>({})
  const [cpsReassignConfirm, setCpsReassignConfirm] = useState<string|null>(null)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) { const { data: ud } = await supabase.from('users').select('name').eq('id', user.id).single(); setUserName(ud?.name||'') }
    const { data: b } = await supabase.from('briefs').select('*, clients(company_name, logo_url, font_url), client_users(*, users(email, name))').eq('id', id).single()
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
      setShowAssignForm(false)
    } else { setShowAssignForm(true) }
    const { data: notes } = await supabase.from('brief_notes').select('*, users:created_by(name)').eq('brief_id', id).order('created_at', { ascending: false })
    setAdminNotes(notes || [])
    const { data: insp } = await supabase.from('brief_inspirations').select('*').eq('brief_id', id).order('created_at', { ascending: false })
    setInspirations(insp || [])
    // CPS children
    const { data: cps } = await supabase.from('briefs').select('*, video_submissions(id, video_url, status, version, submitted_at)').eq('parent_brief_id', id).eq('brief_type', 'cps_child').order('mvc_order', { ascending: true })
    setCpsChildren(cps || [])
    // CPS producer_briefs
    if (cps && cps.length > 0) {
      const cpsIds = cps.map((c: any) => c.id)
      const { data: cpsPbs } = await supabase.from('producer_briefs').select('brief_id, assigned_creator_id').in('brief_id', cpsIds)
      const pbMap: Record<string, any> = {}
      cpsPbs?.forEach((pb: any) => { pbMap[pb.brief_id] = pb })
      setCpsProducerBriefs(pbMap)
    }
    // AI Express children
    const rootId = b?.root_campaign_id || id
    const { data: ai } = await supabase.from('briefs').select('id, campaign_name, status, ai_video_url, created_at').eq('parent_brief_id', id).in('brief_type', ['express_clone']).order('created_at', { ascending: true })
    // Fallback: also check by campaign name for legacy data
    if (!ai?.length) {
      const { data: ai2 } = await supabase.from('briefs').select('id, campaign_name, status, ai_video_url, created_at').eq('root_campaign_id', rootId).neq('id', id).ilike('campaign_name', '%Full AI%').order('created_at', { ascending: true })
      setAiChildren(ai2 || []); return
    }
    setAiChildren(ai || [])
  }

  // CPS child creator assignment
  async function forwardCpsChild(childId: string) {
    const form = cpsCreatorForms[childId]
    console.log('[CPS] forwardCpsChild called:', childId, 'form:', form)
    if (!form?.creator_id) { console.log('[CPS] No creator_id, aborting'); setMsg('Creator seçilmedi.'); return }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error: delErr } = await supabase.from('producer_briefs').delete().eq('brief_id', childId)
      if (delErr) console.log('[CPS] delete error:', delErr.message)
      const { error: insErr } = await supabase.from('producer_briefs').insert({ brief_id: childId, producer_id: user?.id, assigned_creator_id: form.creator_id, producer_note: form.note || '', shared_fields: sharedFields, forwarded_at: new Date().toISOString() })
      if (insErr) { console.error('[CPS] insert error:', insErr.message); setMsg('Hata: ' + insErr.message); setLoading(false); return }
      const { error: upErr } = await supabase.from('briefs').update({ status: 'in_production' }).eq('id', childId)
      if (upErr) console.log('[CPS] status update error:', upErr.message)
      setMsg('CPS yön iletildi.')
    } catch (err: any) { console.error('[CPS] forwardCpsChild error:', err); setMsg('Hata: ' + err.message) }
    loadData(); setLoading(false)
  }
  async function forwardAllCps(creatorId: string) {
    if (!creatorId) { setMsg('Creator seçilmedi.'); return }
    const unassigned = cpsChildren.filter(c => !cpsProducerBriefs[c.id])
    if (unassigned.length === 0) { setMsg('Tüm yönler zaten atanmış.'); return }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      for (const child of unassigned) {
        const { error: delErr } = await supabase.from('producer_briefs').delete().eq('brief_id', child.id)
        if (delErr) console.log('[CPS] bulk delete error:', delErr.message)
        const { error: insErr } = await supabase.from('producer_briefs').insert({ brief_id: child.id, producer_id: user?.id, assigned_creator_id: creatorId, shared_fields: sharedFields, forwarded_at: new Date().toISOString() })
        if (insErr) { console.error('[CPS] bulk insert error:', insErr.message); setMsg('Hata: ' + insErr.message); setLoading(false); return }
        await supabase.from('briefs').update({ status: 'in_production' }).eq('id', child.id)
      }
      setMsg(`${unassigned.length} CPS yön topluca iletildi.`)
    } catch (err: any) { console.error('[CPS] forwardAllCps error:', err); setMsg('Hata: ' + err.message) }
    loadData(); setLoading(false)
  }
  async function approveCpsSubmission(childId: string, subId: string) {
    setLoading(true); const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('video_submissions').update({ status: 'admin_approved' }).eq('id', subId)
    await supabase.from('approvals').insert({ video_submission_id: subId, approved_by: user?.id, role: 'admin' })
    await supabase.from('briefs').update({ status: 'approved' }).eq('id', childId)
    setMsg('CPS video onaylandı.'); loadData(); setLoading(false)
  }
  async function reviseCpsSubmission(childId: string, subId: string) {
    const note = cpsRevNotes[childId]?.[subId]; if (!note?.trim()) { setMsg('Revizyon notu zorunludur.'); return }; setLoading(true)
    await supabase.from('video_submissions').update({ status: 'revision_requested', producer_notes: note }).eq('id', subId)
    await supabase.from('briefs').update({ status: 'revision' }).eq('id', childId)
    setMsg('CPS revizyon talebi gönderildi.'); loadData(); setLoading(false)
  }

  // All business logic functions preserved
  async function handleVoiceoverUpload() {
    const file = voFileRef.current?.files?.[0]; if (!file) return
    const allowed = ['audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/x-m4a','audio/m4a']
    if (!allowed.some(t => file.type.includes(t.split('/')[1])) && !file.name.match(/\.(mp3|wav|m4a)$/i)) { setMsg('Desteklenen formatlar: mp3, wav, m4a'); return }
    if (file.size > 50 * 1024 * 1024) { setMsg('Maksimum dosya boyutu: 50MB'); return }
    setVoUpload(true)
    const ext = file.name.split('.').pop() || 'mp3'; const path = `voiceover_${id}.${ext}`
    const { error: upErr } = await supabase.storage.from('voiceovers').upload(path, file, { upsert: true })
    if (upErr) { setMsg('Yükleme hatası: ' + upErr.message); setVoUpload(false); return }
    const { data: urlData } = supabase.storage.from('voiceovers').getPublicUrl(path)
    await supabase.from('briefs').update({ voiceover_file_url: urlData.publicUrl }).eq('id', id)
    setBrief((prev: any) => ({ ...prev, voiceover_file_url: urlData.publicUrl }))
    if (voFileRef.current) voFileRef.current.value = ''; setMsg('Seslendirme dosyası yüklendi.'); setVoUpload(false)
  }
  async function handleVoiceoverDelete() {
    if (!brief?.voiceover_file_url) return; const path = brief.voiceover_file_url.split('/voiceovers/')[1]
    if (path) await supabase.storage.from('voiceovers').remove([decodeURIComponent(path)])
    await supabase.from('briefs').update({ voiceover_file_url: null }).eq('id', id)
    setBrief((prev: any) => ({ ...prev, voiceover_file_url: null })); setMsg('Seslendirme dosyası silindi.')
  }
  async function generateInspirations() {
    setInspLoading(true); await supabase.from('brief_inspirations').delete().eq('brief_id', id).eq('is_starred', false)
    const starred = inspirations.filter(i => i.is_starred); const { data: { user } } = await supabase.auth.getUser()
    const res = await fetch('/api/generate-inspirations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: id, user_id: user?.id }) })
    const data = await res.json(); setInspirations([...starred, ...(data.inspirations || [])]); setInspLoading(false)
  }
  async function toggleStar(inspId: string, current: boolean) { await supabase.from('brief_inspirations').update({ is_starred: !current }).eq('id', inspId); setInspirations(prev => prev.map(i => i.id === inspId ? { ...i, is_starred: !current } : i)) }
  async function handleAnswerForClient(qId: string) { if (!answerText.trim()) return; await supabase.from('brief_questions').update({ answer: answerText, answered_at: new Date().toISOString() }).eq('id', qId); setAnswerEditing(null); setAnswerText(''); loadData() }
  async function handleAddNote() { if (!newNote.trim()) return; const { data: { user } } = await supabase.auth.getUser(); await supabase.from('brief_notes').insert({ brief_id: id, note: newNote, created_by: user?.id }); setNewNote(''); const { data: notes } = await supabase.from('brief_notes').select('*, users:created_by(name)').eq('brief_id', id).order('created_at', { ascending: false }); setAdminNotes(notes || []) }
  function toggleSharedField(f: string) { setSharedFields(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]) }
  async function handleApprove(submissionId: string) {
    setLoading(true); setMsg(''); const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('video_submissions').update({ status:'admin_approved' }).eq('id', submissionId)
    await supabase.from('approvals').insert({ video_submission_id: submissionId, approved_by: user?.id, role:'admin' })
    await supabase.from('briefs').update({ status:'approved' }).eq('id', id)
    if (clientEmail && brief) { await fetch('/api/notify', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ to: clientEmail, subject: `${brief.campaign_name} — Videonuz Hazır`, html: `<p>Merhaba,</p><p><strong>${brief.campaign_name}</strong> kampanyanız için hazırlanan video onaylandı. Dinamo panelinden inceleyebilirsiniz.</p><p>İyi çalışmalar,<br/>Dinamo</p>` }) }).catch(()=>null) }
    setMsg('Video onaylandı, müşteriye iletildi.'); loadData(); setLoading(false)
  }
  async function handleClientApprove() {
    setLoading(true); await deductClientCredits(id)
    const latestSub = submissions.find(s => s.status === 'admin_approved' || s.status === 'producer_approved') || submissions[0]
    if (latestSub) await recordCreatorEarning(id, latestSub.id)
    let publicLink = ''
    if (latestSub?.video_url) { const srcPath = latestSub.video_url.split('/videos/')[1]; if (srcPath) { const decodedPath = decodeURIComponent(srcPath); const { data: fileData, error: dlErr } = await supabase.storage.from('videos').download(decodedPath); if (fileData && !dlErr) { const { error: upErr } = await supabase.storage.from('delivered-videos').upload(decodedPath, fileData, { upsert: true }); if (!upErr) { const { data: urlData } = supabase.storage.from('delivered-videos').getPublicUrl(decodedPath); publicLink = urlData.publicUrl } else publicLink = latestSub.video_url } else publicLink = latestSub.video_url } }
    await supabase.from('briefs').update({ status:'delivered', public_link: publicLink || null }).eq('id', id)
    setMsg('Müşteri adına onaylandı, kredi kesildi, creator kazancı oluşturuldu.'); loadData(); setLoading(false)
  }
  async function handleRevision(submissionId: string) {
    const note = revisionNotes[submissionId]; if (!note?.trim()) { setMsg('Revizyon notu zorunludur.'); return }; setLoading(true)
    const { data: existingEarnings } = await supabase.from('creator_earnings').select('id, paid').eq('brief_id', id)
    if (existingEarnings) { const unpaid = existingEarnings.filter(e => !e.paid); if (unpaid.length > 0) await supabase.from('creator_earnings').delete().in('id', unpaid.map(e => e.id)) }
    await supabase.from('video_submissions').update({ status:'revision_requested', producer_notes: note }).eq('id', submissionId)
    await supabase.from('briefs').update({ status:'revision' }).eq('id', id)
    await supabase.from('brief_questions').insert({ brief_id: id, question: `İÇ REVİZYON: ${note}` })
    setMsg('Revizyon talebi gönderildi.'); loadData(); setLoading(false)
  }
  async function handleForward(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setMsg(''); const { data: { user } } = await supabase.auth.getUser()
    const creatorId = forwardForm.assigned_creator_id && forwardForm.assigned_creator_id.length > 10 ? forwardForm.assigned_creator_id : null
    const voiceId = forwardForm.assigned_voice_artist_id && forwardForm.assigned_voice_artist_id.length > 10 ? forwardForm.assigned_voice_artist_id : null
    await supabase.from('producer_briefs').delete().eq('brief_id', id)
    const { error } = await supabase.from('producer_briefs').insert({ brief_id: id, producer_id: user?.id, producer_note: forwardForm.producer_note, assigned_creator_id: creatorId, assigned_voice_artist_id: voiceId, shared_fields: sharedFields, forwarded_at: new Date().toISOString() })
    if (error) { setMsg('Hata: '+error.message); setLoading(false); return }
    await supabase.from('briefs').update({ status:'in_production' }).eq('id', id)
    setMsg("Creator'a iletildi."); loadData(); setLoading(false)
  }
  async function handleQuestion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!question.trim()) return; const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('brief_questions').insert({ brief_id: id, question, asked_by: user?.id })
    await supabase.from('briefs').update({ question_sent_at: new Date().toISOString() }).eq('id', id)
    if (clientEmail && brief) { await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: clientEmail, subject: `${brief.campaign_name} hakkında bir soru var`, html: `<p>Merhaba,</p><p>Prodüktörünüz <strong>${brief.campaign_name}</strong> brief'iniz hakkında soru sordu.</p><p>Dinamo'ya giriş yaparak yanıtlayabilirsiniz.</p><p>İyi çalışmalar,<br/>Dinamo</p>` })}).catch(() => null) }
    setQuestion(''); loadData()
  }
  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true)
    const { error } = await supabase.from('briefs').update({ campaign_name: editForm.campaign_name, video_type: editForm.video_type, message: editForm.message, cta: editForm.cta, target_audience: editForm.target_audience, notes: editForm.notes, credit_cost: parseInt(editForm.credit_cost) }).eq('id', id)
    if (error) { setMsg('Hata: '+error.message); setLoading(false); return }
    setMsg('Brief güncellendi.'); setEditMode(false); loadData(); setLoading(false)
  }
  async function handleCancel() { if (!confirm('Bu briefi iptal etmek istediğinizden emin misiniz?')) return; await supabase.from('briefs').update({ status:'cancelled' }).eq('id', id); router.push('/dashboard/admin/briefs') }
  async function deleteBrief() { setDeleting(true); try { const res = await fetch(`/api/briefs/${id}`, { method: 'DELETE' }); const data = await res.json(); if (!res.ok || data.error) { setMsg(data.error || 'Silme hatası'); setDeleting(false); setDeleteStep(0); return }; router.push('/dashboard/admin/briefs') } catch (err: any) { setMsg('Silme hatası: ' + (err.message || '')); setDeleting(false); setDeleteStep(0) } }

  const videoRef = useRef<HTMLVideoElement>(null)
  function parseTimecode(text: string): { tc: number|null, clean: string } { const match = text.match(/^\[(\d{2}):(\d{2})\.(\d)\]\s*/); if (!match) return { tc: null, clean: text }; return { tc: parseInt(match[1])*60 + parseInt(match[2]) + parseInt(match[3])/10, clean: text.replace(match[0], '') } }
  function seekTo(seconds: number) { if (videoRef.current) { videoRef.current.currentTime = seconds; videoRef.current.play() } }

  const clientRevisions = questions.filter(q => q.question.startsWith('REVİZYON:'))
  const visibleQ = questions.filter(q => !q.question.startsWith('REVİZYON:') && !q.question.startsWith('İÇ REVİZYON:'))
  const assigned = creators.find(c => c.id === forwardForm.assigned_creator_id)
  const hasSubmissions = submissions.length > 0
  // Assignment state: 'none' | 'assigned' | 'locked'
  const assignState = !assigned ? 'none' : hasSubmissions ? 'locked' : 'assigned'
  const sb = STATUS_BADGE[brief?.status] || STATUS_BADGE.submitted

  // Status badge component
  function Badge({ status }: { status: string }) {
    const b = STATUS_BADGE[status] || STATUS_BADGE.submitted
    return <span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', padding: '3px 8px', background: b.bg, border: `1px solid ${b.border}`, color: '#0a0a0a' }}>{b.label}</span>
  }

  // Brief info card (reusable for main + CPS)
  function BriefInfoCard({ b, open, toggle, label }: { b: any, open: boolean, toggle: () => void, label: string }) {
    const meta = [
      { k: 'HOOK', v: b.hook }, { k: 'HERO', v: b.hero }, { k: 'TON', v: b.tone || b.cps_ton },
      { k: 'HEDEF', v: b.target_audience }, { k: 'MECRA', v: Array.isArray(b.platforms) ? b.platforms.join(', ') : null },
      { k: 'CTA', v: b.cta }, { k: 'SÜRE', v: b.video_type }, { k: 'FORMAT', v: b.format },
    ].filter(m => m.v)
    return (
      <div style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '20px 22px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={toggle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="label-caps">{label}</div>
            <Badge status={b.status} />
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', letterSpacing: '1px' }}>{open ? 'KAPAT' : 'DETAY'}</span>
        </div>
        {!open && b.message && <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '10px', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{b.message}</div>}
        {open && (
          <div style={{ marginTop: '16px' }}>
            {b.message && <div style={{ fontSize: '14px', color: '#0a0a0a', lineHeight: '1.7', marginBottom: '16px' }}>{b.message}</div>}
            {meta.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                {meta.map(m => (
                  <div key={m.k}>
                    <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>{m.k}</div>
                    <div style={{ fontSize: '13px', color: '#0a0a0a' }}>{m.v}</div>
                  </div>
                ))}
              </div>
            )}
            {b.voiceover_text && (
              <div style={{ borderLeft: '3px solid #22c55e', padding: '10px 14px', background: 'rgba(34,197,94,0.04)', marginBottom: '16px' }}>
                <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>SESLENDİRME METNİ</div>
                <div style={{ fontSize: '13px', color: '#0a0a0a', fontStyle: 'italic', lineHeight: '1.6' }}>{b.voiceover_text}</div>
              </div>
            )}
            {b.notes && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>NOTLAR</div>
                <div style={{ fontSize: '13px', color: '#0a0a0a', lineHeight: '1.5' }}>{b.notes}</div>
              </div>
            )}
            {(b.clients?.logo_url || b.clients?.font_url) && (
              <div style={{ display: 'flex', gap: '10px' }}>
                {b.clients?.logo_url && <a href={b.clients.logo_url} target="_blank" className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '10px' }}>LOGO ↓</a>}
                {b.clients?.font_url && <a href={b.clients.font_url} target="_blank" className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '10px' }}>FONT ↓</a>}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (!brief) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--color-text-tertiary)' }}>Yükleniyor...</div>

  return (
    <>
      {/* STICKY HEADER */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff', borderBottom: '1px solid var(--color-border-tertiary)', padding: '14px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', maxWidth: '1100px' }}>
          <div>
            <div className="label-caps" style={{ marginBottom: '4px' }}>{brief.clients?.company_name}</div>
            <div style={{ fontSize: '20px', fontWeight: '500', color: 'var(--color-text-primary)', letterSpacing: '-0.5px', marginBottom: '6px' }}>{brief.campaign_name}</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge status={brief.status} />
              <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{brief.video_type} · {brief.format} · {brief.credit_cost} kredi</span>
              {assigned ? <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: '#0a0a0a' }}>· → {assigned.users?.name}</span> : <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#f5a623' }}>· CREATOR ATANMADI</span>}
              {cpsChildren.length > 0 && <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>· {cpsChildren.length} CPS yön</span>}
              {aiChildren.length > 0 && <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>· {aiChildren.length} AI Express</span>}
            </div>
            {(() => {
              const all = [brief, ...cpsChildren, ...aiChildren]
              const newCount = all.filter(b => ['submitted','read'].includes(b.status)).length
              const prodCount = all.filter(b => ['in_production','ai_processing'].includes(b.status)).length
              const doneCount = all.filter(b => ['delivered','ai_completed'].includes(b.status)).length
              const revCount = all.filter(b => b.status === 'revision').length
              const parts = [newCount && `${newCount} yeni`, prodCount && `${prodCount} üretimde`, doneCount && `${doneCount} tamamlandı`, revCount && `${revCount} revizyon`].filter(Boolean)
              return parts.length > 0 ? <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{parts.join(' · ')}</div> : null
            })()}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button onClick={() => setEditMode(!editMode)} className="btn btn-outline" style={{ padding: '8px 16px' }}>{editMode ? 'İPTAL' : 'DÜZENLE'}</button>
            <button onClick={handleCancel} className="btn btn-outline" style={{ padding: '8px 16px', color: '#ef4444', borderColor: '#ef4444' }}>İPTAL ET</button>
            {submissions.some(s => s.status === 'pending' || s.status === 'producer_approved') && (
              <button onClick={() => { const s = submissions.find(s => s.status === 'pending' || s.status === 'producer_approved'); if (s) handleApprove(s.id) }} disabled={loading} className="btn" style={{ padding: '8px 16px' }}>
                {loading ? 'İŞLENİYOR...' : 'ONAYLA & İLET'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ padding: '24px 28px', maxWidth: '1100px' }}>
        {msg && <div style={{ padding: '10px 16px', background: msg.startsWith('Hata') || msg.includes('zorunlu') ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${msg.startsWith('Hata') || msg.includes('zorunlu') ? '#ef4444' : '#22c55e'}`, fontSize: '12px', color: '#0a0a0a', marginBottom: '16px' }}>{msg}</div>}

        {/* CLIENT REVISIONS ALERT */}
        {clientRevisions.length > 0 && (
          <div style={{ background: '#fff', border: '2px solid #ef4444', padding: '14px 20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444' }} />
              <div className="label-caps" style={{ color: '#ef4444' }}>MÜŞTERİ REVİZYONU</div>
            </div>
            {clientRevisions.map(r => {
              const { tc, clean } = parseTimecode(r.question.replace('REVİZYON: ', ''))
              return (
                <div key={r.id} style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.06)', marginBottom: '4px', fontSize: '13px', color: '#0a0a0a', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  {tc !== null && <button onClick={() => seekTo(tc)} style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontWeight: '500', flexShrink: 0, marginTop: '2px' }}>▶ {Math.floor(tc / 60)}:{String(Math.floor(tc % 60)).padStart(2, '0')}</button>}
                  <span>{clean}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* EDIT FORM */}
        {editMode && (
          <form onSubmit={handleEdit} style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '20px 22px', marginBottom: '16px' }}>
            <div className="label-caps" style={{ marginBottom: '16px' }}>BRIEF DÜZENLE</div>
            {[{ key: 'campaign_name', label: 'Kampanya Adı', type: 'text' }, { key: 'video_type', label: 'Video Tipi', type: 'text' }, { key: 'message', label: 'Mesaj', type: 'textarea' }, { key: 'cta', label: 'CTA', type: 'text' }, { key: 'target_audience', label: 'Hedef Kitle', type: 'text' }, { key: 'notes', label: 'Notlar', type: 'textarea' }, { key: 'credit_cost', label: 'Kredi', type: 'number' }].map(f => (
              <div key={f.key} style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>{f.label}</div>
                {f.type === 'textarea' ? <textarea value={editForm[f.key] || ''} onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })} rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border-tertiary)', fontSize: '13px', color: '#0a0a0a', resize: 'vertical', boxSizing: 'border-box' }} /> : <input type={f.type} value={editForm[f.key] || ''} onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border-tertiary)', fontSize: '13px', color: '#0a0a0a', boxSizing: 'border-box' }} />}
              </div>
            ))}
            <button type="submit" disabled={loading} className="btn" style={{ padding: '9px 20px' }}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</button>
          </form>
        )}

        {!editMode && (
          <>
            {/* 1) ANA VIDEO BRIEF */}
            {/* MÜŞTERİ SEÇİMİ */}
            {brief.selected_ai_idea && (
              <div style={{ background: 'linear-gradient(135deg, #f5f0ff 0%, #faf6ff 100%)', border: '1px solid #c4b5fd', padding: '16px 20px', marginBottom: '16px' }}>
                <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6d28d9', fontWeight: '500', marginBottom: '6px' }}>MÜŞTERİ SEÇİMİ — YARATICI YÖN</div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '4px' }}>{brief.selected_ai_idea.title}</div>
                <div style={{ fontSize: '12px', color: '#6b6b66', lineHeight: 1.5 }}>{brief.selected_ai_idea.description}</div>
              </div>
            )}

            <BriefInfoCard b={brief} open={briefOpen} toggle={() => setBriefOpen(!briefOpen)} label="ANA VİDEO BRIEF" />

            {/* 2) CPS BRIEF'LERİ */}
            {cpsChildren.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div className="label-caps">CPS BRIEF'LERİ · {cpsChildren.length} YÖN</div>
                  {(() => {
                    const unassigned = cpsChildren.filter(c => !cpsProducerBriefs[c.id])
                    return unassigned.length > 0 ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select id="cps-bulk-creator" style={{ padding: '6px 10px', border: '1px solid var(--color-border-tertiary)', fontSize: '11px' }}>
                          <option value="">Creator seç...</option>
                          {creators.map(c => <option key={c.id} value={c.id}>{c.users?.name}</option>)}
                        </select>
                        <button onClick={() => { const sel = (document.getElementById('cps-bulk-creator') as HTMLSelectElement)?.value; if (sel) forwardAllCps(sel) }} disabled={loading} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '10px' }}>ATANMAMIŞLARA İLET ({unassigned.length})</button>
                      </div>
                    ) : null
                  })()}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cpsChildren.length, 3)}, 1fr)`, gap: '12px' }}>
                  {cpsChildren.map(child => {
                    const isOpen = !!cpsOpen[child.id]
                    const childSubs = child.video_submissions || []
                    const cf = cpsCreatorForms[child.id] || { creator_id: '', note: '', open: false }
                    return (
                      <div key={child.id} style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '16px 18px' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isOpen ? '12px' : 0 }} onClick={() => setCpsOpen(prev => ({ ...prev, [child.id]: !prev[child.id] }))}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '500' }}>{child.cps_hook || `YÖN ${child.mvc_order || ''}`}</span>
                            <Badge status={child.status} />
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>{isOpen ? 'KAPAT' : 'DETAY'}</span>
                        </div>
                        {isOpen && (
                          <>
                            {/* Brief detail */}
                            {child.message && <div style={{ fontSize: '12px', color: '#0a0a0a', lineHeight: '1.5', marginBottom: '10px' }}>{child.message}</div>}
                            {child.cps_ton && <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>Ton: {child.cps_ton}</div>}
                            {/* Creator assign — state machine */}
                            {(() => {
                              const cpsPb = cpsProducerBriefs[child.id]
                              const cpsAssigned = cpsPb ? creators.find(c => c.id === cpsPb.assigned_creator_id) : null
                              const cpsHasSubs = childSubs.length > 0
                              const cpsState = !cpsAssigned ? 'none' : cpsHasSubs ? 'locked' : 'assigned'
                              return (
                                <div style={{ borderTop: '1px solid var(--color-border-tertiary)', paddingTop: '10px', marginBottom: '10px' }}>
                                  {cpsState === 'locked' && cpsAssigned && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '11px', fontWeight: '500', color: '#0a0a0a' }}>→ {cpsAssigned.users?.name}</span>
                                      <span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '2px 6px', border: '1px solid #e5e4db', color: '#888' }}>TAMAMLANDI</span>
                                    </div>
                                  )}
                                  {cpsState === 'assigned' && cpsAssigned && (
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={{ fontSize: '11px', fontWeight: '500', color: '#0a0a0a' }}>→ {cpsAssigned.users?.name}</span>
                                          <span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '2px 6px', border: '1px solid #22c55e', background: 'rgba(34,197,94,0.08)', color: '#0a0a0a' }}>ATANDI</span>
                                        </div>
                                      </div>
                                      <button onClick={() => setCpsReassignConfirm(child.id)} className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '9px', width: '100%' }}>ATAMAYI DEĞİŞTİR</button>
                                    </div>
                                  )}
                                  {(cpsState === 'none' || cf.open) && (
                                    <div>
                                      <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>CREATOR ATA</div>
                                      <div style={{ display: 'flex', gap: '6px' }}>
                                        <select value={cf.creator_id} onChange={e => setCpsCreatorForms(prev => ({ ...prev, [child.id]: { ...cf, creator_id: e.target.value, open: true } }))} style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--color-border-tertiary)', fontSize: '11px' }}>
                                          <option value="">Seçin</option>
                                          {creators.map(c => <option key={c.id} value={c.id}>{c.users?.name}</option>)}
                                        </select>
                                        <button onClick={() => forwardCpsChild(child.id)} disabled={loading || !cf.creator_id} className="btn" style={{ padding: '5px 10px', fontSize: '10px' }}>İLET</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                            {/* Video submissions */}
                            {childSubs.length > 0 && childSubs.map((sub: any) => (
                              <div key={sub.id} style={{ borderTop: '1px solid var(--color-border-tertiary)', paddingTop: '10px', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: '500' }}>V{sub.version}</span>
                                  <Badge status={sub.status === 'pending' ? 'submitted' : sub.status === 'admin_approved' ? 'delivered' : sub.status === 'revision_requested' ? 'revision' : 'submitted'} />
                                </div>
                                <video controls style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', background: '#000', display: 'block', marginBottom: '6px' }}><source src={sub.video_url} /></video>
                                {(sub.status === 'pending' || sub.status === 'producer_approved') && (
                                  <div>
                                    <button onClick={() => approveCpsSubmission(child.id, sub.id)} disabled={loading} className="btn" style={{ padding: '4px 10px', fontSize: '10px', width: '100%', marginBottom: '4px' }}>ONAYLA</button>
                                    <textarea value={cpsRevNotes[child.id]?.[sub.id] || ''} onChange={e => setCpsRevNotes(prev => ({ ...prev, [child.id]: { ...(prev[child.id] || {}), [sub.id]: e.target.value } }))} placeholder="Revizyon notu..." rows={1} style={{ width: '100%', padding: '4px 8px', border: '1px solid var(--color-border-tertiary)', fontSize: '10px', resize: 'vertical', boxSizing: 'border-box', marginBottom: '4px' }} />
                                    <button onClick={() => reviseCpsSubmission(child.id, sub.id)} disabled={loading} className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '10px', color: '#ef4444', borderColor: '#ef4444' }}>REVİZYON</button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 3) AI EXPRESS */}
            {aiChildren.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div className="label-caps" style={{ marginBottom: '12px' }}>AI EXPRESS · {aiChildren.length} VERSİYON</div>
                {aiChildren.map((child, i) => (
                  <div key={child.id} style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '14px 18px', marginBottom: '8px', cursor: 'pointer' }} onClick={() => setAiOpen(prev => ({ ...prev, [child.id]: !prev[child.id] }))}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>Versiyon {i + 1}</span>
                        <Badge status={child.status} />
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{aiOpen[child.id] ? 'KAPAT' : 'DETAY'}</span>
                    </div>
                    {aiOpen[child.id] && child.ai_video_url && (
                      <div style={{ marginTop: '12px' }}>
                        <video controls style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', background: '#000', display: 'block' }}><source src={child.ai_video_url} /></video>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 4) ÜRETİM & ONAY */}
            <div style={{ marginBottom: '16px' }}>
              <div className="label-caps" style={{ marginBottom: '12px' }}>ÜRETİM & ONAY</div>

              {/* Creator Assignment — State Machine */}
              <div style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '16px 18px', marginBottom: '12px' }}>
                {assignState === 'locked' && assigned && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', background: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '500', color: '#fff', flexShrink: 0 }}>{(assigned.users?.name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>{assigned.users?.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{assigned.users?.email}</div>
                    </div>
                    <span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '3px 8px', border: '1px solid #e5e4db', color: '#888' }}>TAMAMLANDI</span>
                  </div>
                )}
                {assignState === 'assigned' && assigned && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '500', color: '#fff', flexShrink: 0 }}>{(assigned.users?.name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>{assigned.users?.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{assigned.users?.email}{assigned.phone ? ` · ${assigned.phone}` : ''}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '3px 8px', border: '1px solid #22c55e', background: 'rgba(34,197,94,0.08)', color: '#0a0a0a' }}>ATANDI</span>
                    </div>
                    <button onClick={() => setShowReassignConfirm(true)} className="btn btn-outline" style={{ marginTop: '10px', padding: '6px 14px', fontSize: '10px', width: '100%' }}>ATAMAYI DEĞİŞTİR</button>
                  </>
                )}
                {assignState === 'none' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Creator atanmadı</span>
                    <span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '3px 8px', border: '1px solid #f5a623', color: '#f5a623' }}>ATANMADI</span>
                  </div>
                )}
                {(showAssignForm || assignState === 'none') && (
                  <form onSubmit={handleForward} style={{ marginTop: '12px', borderTop: '1px solid var(--color-border-tertiary)', paddingTop: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: brief.voiceover_type === 'real' ? '1fr 1fr' : '1fr', gap: '8px', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>CREATOR</div>
                        <select value={forwardForm.assigned_creator_id} onChange={e => setForwardForm({ ...forwardForm, assigned_creator_id: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border-tertiary)', fontSize: '12px', color: '#0a0a0a', boxSizing: 'border-box' }}>
                          <option value="">Seçin</option>
                          {creators.map(c => <option key={c.id} value={c.id}>{c.users?.name}</option>)}
                        </select>
                      </div>
                      {brief.voiceover_type === 'real' && (
                        <div>
                          <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>SESLENDİRME</div>
                          <select value={forwardForm.assigned_voice_artist_id} onChange={e => setForwardForm({ ...forwardForm, assigned_voice_artist_id: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border-tertiary)', fontSize: '12px', color: '#0a0a0a', boxSizing: 'border-box' }}>
                            <option value="">Seçin</option>
                            {voiceArtists.map(va => <option key={va.id} value={va.id}>{va.users?.name}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>İLETİLECEK ALANLAR</div>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {[{ field: 'message', label: 'Mesaj' }, { field: 'cta', label: 'CTA' }, { field: 'target_audience', label: 'Hedef Kitle' }, { field: 'voiceover_text', label: 'Seslendirme' }, { field: 'notes', label: 'Notlar' }].filter(f => brief[f.field]).map(f => (
                          <label key={f.field} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px', color: '#0a0a0a' }}>
                            <input type="checkbox" checked={sharedFields.includes(f.field)} onChange={() => toggleSharedField(f.field)} style={{ accentColor: '#0a0a0a' }} /> {f.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <textarea value={forwardForm.producer_note} onChange={e => setForwardForm({ ...forwardForm, producer_note: e.target.value })} rows={2} placeholder="Prodüktör notu..." style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border-tertiary)', fontSize: '12px', color: '#0a0a0a', resize: 'vertical', boxSizing: 'border-box', marginBottom: '8px' }} />
                    <button type="submit" disabled={loading} className="btn" style={{ padding: '8px 16px' }}>{loading ? 'İletiliyor...' : assigned ? 'Güncelle' : "CREATOR'A İLET"}</button>
                  </form>
                )}
              </div>

              {/* Voiceover Upload */}
              {brief.voiceover_type === 'real' && (
                <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '14px 18px', marginBottom: '12px' }}>
                  <div className="label-caps" style={{ marginBottom: '8px' }}>{brief.voiceover_gender === 'male' ? 'ERKEK' : 'KADIN'} SESLENDİRME DOSYASI</div>
                  {brief.voiceover_file_url ? (
                    <div>
                      <audio controls src={brief.voiceover_file_url} style={{ width: '100%', marginBottom: '8px' }} />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a href={brief.voiceover_file_url} download target="_blank" className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '10px', textDecoration: 'none' }}>İNDİR ↓</a>
                        <button onClick={handleVoiceoverDelete} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '10px', color: '#ef4444', borderColor: '#ef4444' }}>SİL</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <input ref={voFileRef} type="file" accept=".mp3,.wav,.m4a,audio/*" style={{ fontSize: '12px', color: '#0a0a0a', marginBottom: '8px' }} />
                      <button onClick={handleVoiceoverUpload} disabled={voUpload} className="btn" style={{ padding: '7px 16px' }}>{voUpload ? 'Yükleniyor...' : 'YÜKLE'}</button>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '6px' }}>mp3, wav, m4a — maks 50MB</div>
                    </div>
                  )}
                </div>
              )}

              {/* Video Submissions */}
              {submissions.length === 0 ? (
                <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '32px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '13px' }}>Henüz video yüklenmedi.</div>
              ) : submissions.map(s => (
                <div key={s.id} style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', marginBottom: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--color-border-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>Versiyon {s.version}</span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{new Date(s.submitted_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <Badge status={s.status === 'pending' ? 'submitted' : s.status === 'producer_approved' || s.status === 'admin_approved' ? 'delivered' : s.status === 'revision_requested' ? 'revision' : 'submitted'} />
                  </div>
                  <div style={{ padding: '16px 18px' }}>
                    <video ref={s.id === submissions[0]?.id ? videoRef : undefined} controls style={{ width: '100%', maxHeight: '500px', objectFit: 'contain', background: '#000', display: 'block' }}><source src={s.video_url} /></video>
                  </div>
                  {(s.status === 'pending' || s.status === 'producer_approved') && (
                    <div style={{ padding: '0 18px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                        <button onClick={() => handleApprove(s.id)} disabled={loading} className="btn" style={{ flex: 1, padding: '10px' }}>{loading ? 'İşleniyor...' : 'ONAYLA → MÜŞTERİYE İLET'}</button>
                      </div>
                      <textarea value={revisionNotes[s.id] || ''} onChange={e => setRevisionNotes(prev => ({ ...prev, [s.id]: e.target.value }))} placeholder="Revizyon notu yazın..." rows={2} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border-tertiary)', fontSize: '12px', color: '#0a0a0a', resize: 'vertical', boxSizing: 'border-box', marginBottom: '8px' }} />
                      <button onClick={() => handleRevision(s.id)} disabled={loading} className="btn btn-outline" style={{ padding: '8px 16px', color: '#ef4444', borderColor: '#ef4444' }}>REVİZYON İSTE</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 5) Q&A */}
            <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '16px 18px', marginBottom: '16px' }}>
              <div className="label-caps" style={{ marginBottom: '10px' }}>SORULAR & CEVAPLAR</div>
              {visibleQ.length === 0 && <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>Henüz soru yok.</div>}
              {visibleQ.map(q => (
                <div key={q.id} style={{ marginBottom: '6px', padding: '8px 10px', background: 'var(--color-background-secondary)' }}>
                  <div style={{ fontSize: '12px', color: '#0a0a0a', marginBottom: '2px' }}>{q.question}</div>
                  {q.answer ? (
                    <div style={{ fontSize: '11px', color: '#22c55e' }}>↳ {q.answer}</div>
                  ) : answerEditing === q.id ? (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <input value={answerText} onChange={e => setAnswerText(e.target.value)} placeholder="Cevabı girin..." style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--color-border-tertiary)', fontSize: '11px', color: '#0a0a0a' }} />
                      <button onClick={() => handleAnswerForClient(q.id)} className="btn" style={{ padding: '5px 10px', fontSize: '10px' }}>Kaydet</button>
                      <button onClick={() => setAnswerEditing(null)} className="btn btn-ghost" style={{ padding: '5px 8px', fontSize: '10px' }}>İptal</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>Cevap bekleniyor</div>
                      <button onClick={() => { setAnswerEditing(q.id); setAnswerText('') }} style={{ fontSize: '10px', color: '#0a0a0a', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Cevabı Gir</button>
                    </div>
                  )}
                </div>
              ))}
              <form onSubmit={handleQuestion} style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Soru sor..." style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--color-border-tertiary)', fontSize: '12px', color: '#0a0a0a' }} />
                <button type="submit" className="btn" style={{ padding: '8px 14px' }}>GÖNDER</button>
              </form>
            </div>

            {/* 6) ADMIN NOTLARI */}
            <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '16px 18px', marginBottom: '16px' }}>
              <div className="label-caps" style={{ color: '#f59e0b', marginBottom: '10px' }}>İÇ NOTLAR (SADECE ADMİN)</div>
              {adminNotes.map(n => (
                <div key={n.id} style={{ marginBottom: '6px', padding: '8px 10px', background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <div style={{ fontSize: '12px', color: '#0a0a0a' }}>{n.note}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '3px' }}>{n.users?.name} · {new Date(n.created_at).toLocaleDateString('tr-TR')}</div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="İç not ekle..." onKeyDown={e => { if (e.key === 'Enter') handleAddNote() }}
                  style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--color-border-tertiary)', fontSize: '12px', color: '#0a0a0a' }} />
                <button onClick={handleAddNote} className="btn" style={{ padding: '8px 14px', background: '#f59e0b' }}>EKLE</button>
              </div>
            </div>

            {/* BOTTOM ACTIONS */}
            {(brief.status === 'approved' || brief.status === 'in_production') && (
              <div style={{ paddingTop: '16px', borderTop: '1px solid var(--color-border-tertiary)', marginBottom: '16px' }}>
                <button onClick={() => setShowClientApproveModal(true)} disabled={loading} className="btn" style={{ padding: '9px 20px', background: '#ef4444' }}>MÜŞTERİ ONAYLADI (MANUEL)</button>
              </div>
            )}
            <div style={{ paddingTop: '16px', borderTop: '1px solid var(--color-border-tertiary)' }}>
              <button onClick={() => setDeleteStep(1)} className="btn btn-outline" style={{ padding: '9px 20px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>BRIEF'İ SİL</button>
            </div>
          </>
        )}
      </div>

      {/* DELETE CONFIRM MODALS */}
      {deleteStep >= 1 && (
        <div onClick={() => setDeleteStep(0)} style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '28px', width: '420px', maxWidth: '90vw' }}>
            <div style={{ fontSize: '16px', fontWeight: '500', color: deleteStep === 2 ? '#ef4444' : '#0a0a0a', marginBottom: '12px' }}>{deleteStep === 2 ? 'Son Onay' : "Brief'i Sil"}</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: '24px' }}>{deleteStep === 2 ? 'Brief ve tüm ilişkili dosyalar kalıcı olarak silinecek.' : 'Bu briefi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.'}</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteStep(0)} className="btn btn-outline" style={{ flex: 1, padding: '10px' }}>İptal</button>
              <button onClick={deleteStep === 2 ? deleteBrief : () => setDeleteStep(2)} disabled={deleting} className="btn" style={{ flex: 1, padding: '10px', background: '#ef4444' }}>{deleting ? 'Siliniyor...' : deleteStep === 2 ? 'Kalıcı Olarak Sil' : 'Evet, Sil'}</button>
            </div>
          </div>
        </div>
      )}

      {/* REASSIGN CONFIRM MODAL */}
      {showReassignConfirm && (
        <div onClick={() => setShowReassignConfirm(false)} style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '28px', width: '420px', maxWidth: '90vw' }}>
            <div style={{ fontSize: '16px', fontWeight: '500', color: '#0a0a0a', marginBottom: '10px' }}>Creator Değiştir</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: '24px' }}>Creator değişikliği eski atamayı iptal eder. Yeni creator seçmek istediğinden emin misin?</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowReassignConfirm(false)} className="btn btn-outline" style={{ flex: 1, padding: '10px' }}>VAZGEÇ</button>
              <button onClick={() => { setShowReassignConfirm(false); setShowAssignForm(true); setForwardForm({ producer_note: '', assigned_creator_id: '', assigned_voice_artist_id: '' }) }} className="btn" style={{ flex: 1, padding: '10px' }}>EVET, DEĞİŞTİR</button>
            </div>
          </div>
        </div>
      )}

      {/* CPS REASSIGN CONFIRM MODAL */}
      {cpsReassignConfirm && (
        <div onClick={() => setCpsReassignConfirm(null)} style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '28px', width: '420px', maxWidth: '90vw' }}>
            <div style={{ fontSize: '16px', fontWeight: '500', color: '#0a0a0a', marginBottom: '10px' }}>CPS Yön Creator Değiştir</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: '24px' }}>Bu yönün creator ataması değiştirilecek. Devam etmek istiyor musun?</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setCpsReassignConfirm(null)} className="btn btn-outline" style={{ flex: 1, padding: '10px' }}>VAZGEÇ</button>
              <button onClick={() => { setCpsCreatorForms(prev => ({ ...prev, [cpsReassignConfirm]: { creator_id: '', note: '', open: true } })); setCpsReassignConfirm(null) }} className="btn" style={{ flex: 1, padding: '10px' }}>EVET, DEĞİŞTİR</button>
            </div>
          </div>
        </div>
      )}

      {/* CLIENT APPROVE MODAL */}
      {showClientApproveModal && (
        <div onClick={() => setShowClientApproveModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '28px', width: '420px', maxWidth: '90vw', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: '500', color: '#0a0a0a', marginBottom: '10px' }}>Dikkat</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: '24px' }}>Bu butonu yalnızca iş platform dışında ilerledi ve müşteri onay vermeden yayına girdi ya da platform dışından onay bildirdi ise kullanın.</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowClientApproveModal(false)} className="btn btn-outline" style={{ flex: 1, padding: '10px' }}>İptal</button>
              <button onClick={() => { setShowClientApproveModal(false); handleClientApprove() }} disabled={loading} className="btn" style={{ flex: 1, padding: '10px', background: '#ef4444' }}>{loading ? 'İşleniyor...' : 'Evet, Onaylandı'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
