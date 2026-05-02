'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { generateCertificatePDF } from '@/lib/generate-certificate'
import StaticImageGeneratorModal from '@/components/StaticImageGeneratorModal'
import CampaignSummaryTab from '@/components/CampaignSummaryTab'
import VideoLoadingBox from '@/components/VideoLoadingBox'
import { logClientActivity } from '@/lib/log-client'
import AIUGCTab from '@/components/AIUGCTab'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('fail')
    const blob = await res.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl; a.download = filename
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    window.URL.revokeObjectURL(blobUrl)
  } catch { window.open(url, '_blank') }
}

function slugify(s: string) {
  const m: Record<string,string> = {'ğ':'g','ü':'u','ş':'s','ı':'i','ö':'o','ç':'c','Ğ':'G','Ü':'U','Ş':'S','İ':'I','Ö':'O','Ç':'C'}
  let r = s; for (const [k,v] of Object.entries(m)) r = r.replace(new RegExp(k,'g'),v)
  return r.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')
}

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

const CHARACTER_STAGES = [
  { key: 'processing_concept', label: 'Konsept oluşturuluyor', duration: 15 },
  { key: 'processing_voice', label: 'Ses kaydediliyor', duration: 20 },
  { key: 'processing_music', label: 'Müzik seçiliyor', duration: 10 },
  { key: 'processing_video', label: 'Görsel üretiliyor', duration: 120 },
  { key: 'processing_merge', label: 'Birleştiriliyor', duration: 30 },
  { key: 'uploading', label: 'Yükleniyor', duration: 60 },
]
const PRODUCT_STAGES = [
  { key: 'processing_concept', label: 'Konsept oluşturuluyor', duration: 15 },
  { key: 'processing_lifestyle', label: 'Ürün görseli hazırlanıyor', duration: 30 },
  { key: 'processing_voice', label: 'Ses kaydediliyor', duration: 20 },
  { key: 'processing_music', label: 'Müzik seçiliyor', duration: 10 },
  { key: 'processing_video', label: 'Görsel üretiliyor', duration: 120 },
  { key: 'processing_merge', label: 'Birleştiriliyor', duration: 30 },
  { key: 'uploading', label: 'Yükleniyor', duration: 60 },
]
const REVISION_COST = 4
const BASE_COSTS: Record<string,number> = {'Bumper / Pre-roll':12,'Story / Reels':18,'Feed Video':24,'Long Form':36}
const VIDEO_TYPES = ['Bumper / Pre-roll','Story / Reels','Feed Video','Long Form']

export default function ClientBriefDetailWrapper() {
  return <Suspense><ClientBriefDetail /></Suspense>
}

function ClientBriefDetail() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
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
  // CPS approval/revision
  const [cpsRevNotes, setCpsRevNotes] = useState<Record<string,string>>({})
  const [cpsRevOpen, setCpsRevOpen] = useState<Record<string,boolean>>({})
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
  const [captionText, setCaptionText] = useState('')
  const [savedCaption, setSavedCaption] = useState('')
  const [captionLoading, setCaptionLoading] = useState(false)
  const [captionToast, setCaptionToast] = useState('')
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
  const captionRef = useRef<HTMLTextAreaElement>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [aiStageElapsed, setAiStageElapsed] = useState(0)
  const aiStageStartRef = useRef(Date.now())
  const [aiError, setAiError] = useState('')
  // AI Studio
  const [aiChildren, setAiChildren] = useState<any[]>([])
  const [selectedAiIdx, setSelectedAiIdx] = useState<number>(0)
  const [showAiGenerate, setShowAiGenerate] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [expressInfoOpen, setExpressInfoOpen] = useState(false)
  const [cpsInfoOpen, setCpsInfoOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'hybrid'|'cps'|'express'|'ugc'|'summary'>(searchParams.get('tab') === 'express' ? 'express' : searchParams.get('tab') === 'ugc' ? 'ugc' : searchParams.get('tab') === 'cps' ? 'cps' : searchParams.get('tab') === 'summary' ? 'summary' : 'hybrid')
  const aiChildParam = searchParams.get('ai_child')
  const [briefExpanded, setBriefExpanded] = useState(false)
  const [autoGenerateTriggered, setAutoGenerateTriggered] = useState(false)
  const [cpsChildren, setCpsChildren] = useState<any[]>([])
  const [cpsPackage, setCpsPackage] = useState<number>(0)
  const [cpsVariations, setCpsVariations] = useState<any[]>([])
  const [cpsGenerating, setCpsGenerating] = useState(false)
  const [cpsConfirmModal, setCpsConfirmModal] = useState(false)
  const [timerStageMap, setTimerStageMap] = useState<Record<string, number>>({})
  const [editingFeedback, setEditingFeedback] = useState<Record<string, boolean>>({})
  const [staticImageModal, setStaticImageModal] = useState<{ briefId: string; videoUrl: string; existingUrl?: string } | null>(null)
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({})

  useEffect(() => { loadData() }, [id])

  // Mark individual AI Express child as viewed
  async function markAiChildViewed(childId: string) {
    const child = aiChildren.find(c => c.id === childId)
    if (!child || child.ai_express_viewed_at) return
    const { error } = await supabase.from('briefs').update({ ai_express_viewed_at: new Date().toISOString() }).eq('id', childId)
    if (error) { console.error('[AI-viewed] update error:', error.message); return }
    setAiChildren(prev => prev.map(c => c.id === childId ? { ...c, ai_express_viewed_at: new Date().toISOString() } : c))
  }

  // Auto-scroll + autoplay for ai_child param
  useEffect(() => {
    if (!aiChildParam || activeTab !== 'express' || aiChildren.length === 0) return
    const el = document.getElementById(`ai-child-${aiChildParam}`)
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const video = el.querySelector('video') as HTMLVideoElement
        if (video) video.play().catch(() => {})
      }, 300)
    }
  }, [aiChildParam, activeTab, aiChildren.length])

  // Refetch on summary tab activation + window focus
  useEffect(() => { if (activeTab === 'summary') loadData() }, [activeTab])
  useEffect(() => {
    const onFocus = () => { if (activeTab === 'summary') loadData() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [activeTab])

  // Auto-generate AI Express from URL param
  useEffect(() => {
    if (autoGenerateTriggered) return
    if (searchParams.get('autoGenerate') !== '1') return
    if (!brief || !clientUser || aiChildren.length > 0 || aiGenerating) return
    if (brief.clients?.ai_video_enabled === false) return
    setAutoGenerateTriggered(true)
    handleStudioGenerate('character')
  }, [brief, clientUser, aiChildren.length])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: userData } = await supabase.from('users').select('name').eq('id', user.id).single()
    setUserName(userData?.name || '')
    const { data: cu } = await supabase.from('client_users').select('*, clients(company_name, credit_balance)').eq('user_id', user.id).single()
    setClientUser(cu)
    setCompanyName((cu as any)?.clients?.company_name || '')
    const { data: b } = await supabase.from('briefs').select('*, clients(ai_video_enabled)').eq('id', id).single()
    setBrief(b)
    if (b?.caption) { setCaptionText(b.caption); setSavedCaption(b.caption) }
    const { data: q } = await supabase.from('brief_questions').select('*').eq('brief_id', id).order('asked_at')
    setQuestions(q || [])
    const { data: v } = await supabase.from('video_submissions').select('*').eq('brief_id', id).order('version', { ascending: true })
    setVideos(v || [])
    const revCount = (q || []).filter((x:any) => x.question.startsWith('REVİZYON:')).length
    setRevisionCount(revCount)
    // AI clones for this campaign (root_campaign_id based)
    const rootId = b?.root_campaign_id || b?.id
    const { data: aiKids } = await supabase.from('briefs')
      .select('id, campaign_name, status, ai_video_status, ai_video_url, ai_video_error, product_image_url, created_at, ai_feedbacks, static_images_url, static_image_files, ai_express_viewed_at')
      .eq('root_campaign_id', rootId)
      .like('campaign_name', '%Full AI%')
      .order('created_at', { ascending: true })
    setAiChildren(aiKids || [])
    // CPS children
    const { data: cpsKids } = await supabase.from('briefs')
      .select('*, video_submissions(id, video_url, status, version, submitted_at)')
      .eq('parent_brief_id', id)
      .eq('brief_type', 'cps_child')
      .order('mvc_order', { ascending: true })
    setCpsChildren(cpsKids || [])
  }

  // AI video polling — runs when brief is ai_processing and video not yet ready
  useEffect(() => {
    if (brief?.status !== 'ai_processing') return
    if (brief?.ai_video_status === 'completed' || brief?.ai_video_status === 'failed') return
    const poll = setInterval(async () => {
      try {
        const { data: b, error: err } = await supabase.from('briefs').select('ai_video_status, ai_video_url, ai_video_error, status').eq('id', id).maybeSingle()
        if (err || !b) return
        if (b.ai_video_status !== brief.ai_video_status || b.status !== brief.status) {
          setBrief((prev: any) => ({ ...prev, ...b }))
        }
      } catch {}
    }, 3000)
    return () => clearInterval(poll)
  }, [brief?.status, brief?.ai_video_status])

  // AI stage elapsed timer
  useEffect(() => {
    if (brief?.ai_video_status?.startsWith('processing_')) {
      aiStageStartRef.current = Date.now()
      setAiStageElapsed(0)
    }
  }, [brief?.ai_video_status])
  useEffect(() => {
    if (!brief?.ai_video_status?.startsWith('processing_')) return
    const t = setInterval(() => setAiStageElapsed(Math.floor((Date.now() - aiStageStartRef.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [brief?.ai_video_status])


  // Poll AI children for status updates
  useEffect(() => {
    const hasProcessing = aiChildren.some(c => c.status === 'ai_processing' && !c.ai_video_url)
    if (!hasProcessing || aiChildren.length === 0) return
    const allIds = aiChildren.map(c => c.id)
    const poll = setInterval(async () => {
      const { data } = await supabase.from('briefs').select('id, status, ai_video_status, ai_video_url, ai_video_error').in('id', allIds)
      if (!data) return
      setAiChildren(prev => {
        let changed = false
        const next = prev.map(c => {
          const u = data.find((d: any) => d.id === c.id)
          if (u && (u.status !== c.status || u.ai_video_status !== c.ai_video_status || u.ai_video_url !== c.ai_video_url)) {
            changed = true
            return { ...c, ...u }
          }
          return c
        })
        return changed ? next : prev
      })
    }, 3000)
    return () => clearInterval(poll)
  }, [aiChildren.some(c => c.status === 'ai_processing' && !c.ai_video_url)])

  // Timer-based auto-advance for processing children — setTimeout chain
  useEffect(() => {
    const processing = aiChildren.filter(c => c.status === 'ai_processing' && !c.ai_video_url)
    if (processing.length === 0) return
    // Initialize new processing children at stage 0
    setTimerStageMap(prev => {
      const next = { ...prev }
      let changed = false
      processing.forEach(c => { if (!(c.id in next)) { next[c.id] = 0; changed = true } })
      return changed ? next : prev
    })
    // Set up cumulative timeout chains per child
    const allTimers: ReturnType<typeof setTimeout>[] = []
    processing.forEach(c => {
      const stg = c.product_image_url ? PRODUCT_STAGES : CHARACTER_STAGES
      let cumulative = 0
      stg.forEach((s, si) => {
        if (si === 0) return // already at 0
        cumulative += stg[si - 1].duration * 1000
        const t = setTimeout(() => {
          setTimerStageMap(prev => ({ ...prev, [c.id]: si }))
        }, cumulative)
        allTimers.push(t)
      })
    })
    return () => allTimers.forEach(clearTimeout)
  }, [aiChildren.filter(c => c.status === 'ai_processing' && !c.ai_video_url).map(c => c.id).join(',')])

  async function handleAiPurchase() {
    if (!clientUser || !brief?.ai_video_url) return
    if ((clientUser.allocated_credits || 0) < 2) { setAiError('Yetersiz kredi'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const res = await fetch('/api/generate-ai-video/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ briefId: id, userId: user.id }),
    })
    const result = await res.json()
    if (result.error) { setAiError(result.error); return }
    setClientUser({ ...clientUser, allocated_credits: (clientUser.allocated_credits || 0) - 2 })
    setBrief((prev: any) => ({ ...prev, status: 'delivered' }))
    loadData()
  }

  async function handleAiDiscard() {
    await supabase.from('briefs').update({ status: 'ai_archived' }).eq('id', id)
    router.push('/dashboard/client')
  }

  async function handleStudioGenerate(mode: 'character' | 'product' = 'character') {
    if (!clientUser || !brief || aiGenerating) return
    if ((clientUser.allocated_credits || 0) < 1) { setAiError('Yetersiz kredi'); return }
    setAiGenerating(true)
    setShowAiGenerate(false)
    const newCredits = (clientUser.allocated_credits || 0) - 1
    await supabase.from('client_users').update({ allocated_credits: newCredits }).eq('id', clientUser.id)
    setClientUser({ ...clientUser, allocated_credits: newCredits })
    const baseName = brief.campaign_name?.replace(/\s*—\s*Full AI #\d+$/, '').replace(/\s*—\s*\d+$/, '') || brief.campaign_name
    const rootId = brief.root_campaign_id || id
    const { count } = await supabase.from('briefs').select('id', { count: 'exact', head: true }).eq('root_campaign_id', rootId).like('campaign_name', '%Full AI%')
    const aiNum = (count || 0) + 1
    const ideaContext = brief.selected_ai_idea ? `MÜŞTERİ SEÇİMİ — YARATICI YÖN:\nBaşlık: ${brief.selected_ai_idea.title}\nAçıklama: ${brief.selected_ai_idea.description}\nVideoyu bu yöne sadık üret.\n\n` : ''
    const { data: newBrief } = await supabase.from('briefs').insert({
      campaign_name: `${baseName} — Full AI #${aiNum}`,
      parent_brief_id: id,
      video_type: brief.video_type, format: brief.format, platforms: brief.platforms,
      message: ideaContext + (brief.message || ''), cta: brief.cta, target_audience: brief.target_audience,
      voiceover_type: brief.voiceover_type, voiceover_gender: brief.voiceover_gender,
      voiceover_text: brief.voiceover_text, notes: brief.notes, languages: brief.languages,
      product_image_url: mode === 'product' ? (brief.product_image_url || null) : null,
      pipeline_type: mode,
      brief_type: 'express_clone',
      credit_cost: 1, client_id: brief.client_id, client_user_id: brief.client_user_id,
      root_campaign_id: brief.root_campaign_id || id,
      status: 'ai_processing', ai_video_status: 'processing_concept',
    }).select('id, campaign_name, status, ai_video_status, ai_video_url, created_at, product_image_url').single()
    if (newBrief) {
      setAiChildren(prev => [...prev, newBrief])
      setSelectedAiIdx(aiChildren.length)
    }
    fetch('/api/generate-ai-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ briefId: newBrief?.id }) })
    logClientActivity({ actionType: 'brief.submitted', userName, clientName: companyName, clientId: brief.client_id, targetType: 'brief', targetId: newBrief?.id, targetLabel: newBrief?.campaign_name, metadata: { type: 'ai_express', mode } })
    setAiGenerating(false)
  }

  async function handleStudioPurchase(childBrief: any) {
    if (!clientUser || !childBrief?.ai_video_url) return
    if ((clientUser.allocated_credits || 0) < 2) { setAiError('Yetersiz kredi'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const res = await fetch('/api/generate-ai-video/purchase', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ briefId: childBrief.id, userId: user.id }),
    })
    const result = await res.json()
    if (result.error) { setAiError(result.error); return }
    setClientUser({ ...clientUser, allocated_credits: (clientUser.allocated_credits || 0) - 2 })
    setAiChildren(prev => prev.map(c => c.id === childBrief.id ? { ...c, status: 'delivered' } : c))
    loadData()
  }

  async function generateCaption() {
    if (!brief || captionLoading) return
    setCaptionLoading(true)
    try {
      const res = await fetch('/api/generate-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_name: brief.campaign_name, message: brief.message, cta: brief.cta, target_audience: brief.target_audience, brand_name: companyName, clientId: brief.client_id })
      })
      const data = await res.json()
      if (data.caption) setCaptionText(data.caption)
    } catch {}
    setCaptionLoading(false)
  }

  async function handleCaptionAction() {
    if (!captionText.trim()) return
    const isDirty = captionText !== savedCaption
    if (isDirty) {
      await supabase.from('briefs').update({ caption: captionText }).eq('id', id)
      setSavedCaption(captionText)
      navigator.clipboard.writeText(captionText)
      setCaptionToast('Kaydedildi ve kopyalandı')
    } else {
      navigator.clipboard.writeText(captionText)
      setCaptionToast('Kopyalandı')
    }
    setTimeout(() => setCaptionToast(''), 3000)
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
    const baseName = brief.campaign_name.replace(/\s*—\s*\d+$/, '').replace(/\s*—\s*Full AI #\d+$/, '')
    const rootId = brief.root_campaign_id || id
    const { count } = await supabase.from('briefs').select('id', { count: 'exact', head: true }).eq('root_campaign_id', rootId).not('campaign_name', 'like', '%Full AI%')
    const copyNum = (count || 0) + 1
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
      root_campaign_id: brief.root_campaign_id || id,
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
    logClientActivity({ actionType: 'video.revision_requested', userName, clientName: companyName, clientId: brief.client_id, targetType: 'brief', targetId: id, targetLabel: brief.campaign_name, metadata: { feedback: revisionNote.substring(0, 80) } })
    if (revisionNote.length > 20) fetch('/api/brand-learning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: brief.client_id, sourceType: 'revision', sourceId: id, text: revisionNote }) }).catch(() => {})
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
    logClientActivity({ actionType: 'video.approved', userName, clientName: companyName, clientId: brief.client_id, targetType: 'brief', targetId: id, targetLabel: brief.campaign_name })
    setShowApproveModal(false)
    setApproveSuccess(true)
    setTimeout(() => setApproveSuccess(false), 3000)
    loadData()
    setLoading(false)
  }

  async function handleCpsApprove(child: any) {
    if (!clientUser) return; setLoading(true)
    const cost = child.credit_cost || 0
    if (cost > 0) {
      const newBalance = Math.max(0, clientUser.allocated_credits - cost)
      await supabase.from('client_users').update({ credit_balance: newBalance }).eq('id', clientUser.id)
      await supabase.from('credit_transactions').insert({ client_id: brief.client_id, client_user_id: clientUser.id, brief_id: child.id, amount: -cost, type: 'deduct', description: `${child.campaign_name} — müşteri onayı` })
      setClientUser({ ...clientUser, allocated_credits: newBalance })
    }
    const { data: pb } = await supabase.from('producer_briefs').select('assigned_creator_id').eq('brief_id', child.id).maybeSingle()
    if (pb?.assigned_creator_id) {
      const { data: rate } = await supabase.from('admin_settings').select('value').eq('key', 'creator_credit_rate').maybeSingle()
      const tlRate = parseFloat((rate as any)?.value || '500')
      await supabase.from('creator_earnings').insert({ brief_id: child.id, creator_id: pb.assigned_creator_id, credits: cost, tl_rate: tlRate, tl_amount: cost * tlRate, paid: false })
    }
    await supabase.from('briefs').update({ status: 'delivered' }).eq('id', child.id)
    logClientActivity({ actionType: 'video.approved', userName, clientName: companyName, clientId: brief.client_id, targetType: 'brief', targetId: child.id, targetLabel: child.campaign_name })
    setMsg(`${child.cps_hook || 'CPS yön'} onaylandı.`)
    loadData(); setLoading(false)
  }

  async function handleCpsRevision(child: any) {
    const note = cpsRevNotes[child.id]
    if (!note?.trim()) { setMsg('Revizyon notunuzu yazın.'); return }
    setLoading(true)
    const latestSub = child.video_submissions?.[0]
    if (latestSub) await supabase.from('video_submissions').update({ status: 'revision_requested' }).eq('id', latestSub.id)
    await supabase.from('briefs').update({ status: 'revision' }).eq('id', child.id)
    await supabase.from('brief_questions').insert({ brief_id: child.id, question: `REVİZYON: ${note}` })
    logClientActivity({ actionType: 'video.revision_requested', userName, clientName: companyName, clientId: brief.client_id, targetType: 'brief', targetId: child.id, targetLabel: child.campaign_name })
    setCpsRevNotes(prev => ({ ...prev, [child.id]: '' }))
    setCpsRevOpen(prev => ({ ...prev, [child.id]: false }))
    setMsg(`${child.cps_hook || 'CPS yön'} revizyon istendi.`)
    loadData(); setLoading(false)
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
    logClientActivity({ actionType: 'public_link.created', userName, clientName: companyName, clientId: brief.client_id, targetType: 'brief', targetId: id, targetLabel: brief.campaign_name })
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

  const inputStyle: React.CSSProperties = { width:'100%', boxSizing:'border-box', background:'#fff', border:'0.5px solid rgba(0,0,0,0.12)', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#0a0a0a',  outline:'none' }

  if (reorderSuccess) {
    const baseName = brief?.campaign_name?.replace(/\s*—\s*\d+$/, '') || ''
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0a0a',}}>
        <div style={{textAlign:'center',maxWidth:'520px',padding:'0 24px'}}>
          <div style={{fontSize:'28px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'32px'}}>
            <img src="/dinamo_logo.png" alt="Dinamo" style={{height:'28px'}} />
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
            <a href="/dashboard/client" style={{padding:'13px 28px',borderRadius:'10px',border:'1px solid rgba(255,255,255,0.15)',background:'transparent',color:'#fff',fontSize:'14px',fontWeight:'400',textDecoration:'none',}}>Tüm Projelerim</a>
            <a href="/dashboard/client/brief/new" style={{padding:'13px 28px',borderRadius:'10px',background:'#22c55e',color:'#fff',fontSize:'14px',fontWeight:'500',textDecoration:'none',}}>Yeni Brief</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');
        @keyframes successPulse { 0% { transform: scale(0.8); opacity: 0; } 50% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* SIDEBAR */}
      <div style={{width:'240px',background:'#0A0A0A',display:'flex',flexDirection:'column',flexShrink:0,height:'100dvh',overflowY:'auto',position:'sticky',top:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)',cursor:'pointer'}} onClick={()=>router.push('/dashboard/client')}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{height:'28px'}} />
        </div>
        <div style={{margin:'12px 12px',padding:'16px 20px',background:'rgba(29,184,29,0.06)',borderLeft:'3px solid #1DB81D'}}>
          <div style={{fontSize:'18px',fontWeight:'700',color:'#fff',marginBottom:'2px'}}>{companyName || 'Dinamo'}</div>
          <div style={{fontSize:'13px',fontWeight:'400',color:'#888',marginBottom:'12px'}}>{userName}</div>
          <div style={{fontSize:'10px',color:'#AAA',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'8px'}}>KREDİ BAKİYESİ</div>
          <div style={{fontSize:'28px',fontWeight:'700',color:'#1DB81D',letterSpacing:'-1px'}}>{clientUser?.allocated_credits||0}</div>
        </div>
        <nav style={{padding:'10px 8px'}}>
          <div onClick={()=>router.push('/dashboard/client')} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',marginBottom:'1px'}}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:'rgba(255,255,255,0.4)'}}>Projelerime dön</span>
          </div>
          <div onClick={()=>router.push('/dashboard/client/brief/new')} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',marginBottom:'1px'}}>
            <span style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:'rgba(255,255,255,0.4)'}}>Yeni Brief</span>
          </div>
          <div onClick={()=>router.push('/dashboard/client/brand-identity')} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',marginBottom:'1px'}}>
            <span style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:'rgba(255,255,255,0.4)'}}>Marka Kimliği</span>
          </div>
          <div onClick={()=>router.push('/dashboard/client/certificates')} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',marginBottom:'1px'}}>
            <span style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:'rgba(255,255,255,0.4)'}}>Telif Belgeleri</span>
          </div>
          <div onClick={()=>router.push('/dashboard/client/guarantee')} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer'}}>
            <span style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:'rgba(255,255,255,0.4)'}}>İçerik Güvencesi</span>
          </div>
          <button onClick={handleLogout}
            onMouseEnter={e=>{(e.currentTarget.firstChild as HTMLElement).style.color='#FF4444'}}
            onMouseLeave={e=>{(e.currentTarget.firstChild as HTMLElement).style.color='#aaa'}}
            style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',marginTop:'16px',cursor:'pointer',width:'100%',background:'none',border:'none'}}>
            <span style={{fontSize:'11px',color:'#aaa',transition:'color 0.15s'}}>Çıkış yap</span>
          </button>
          <img src='/powered_by_dcc.png' alt='Powered by DCC' style={{height:'20px',width:'auto',opacity:0.6,display:'block',margin:'8px 8px',cursor:'pointer'}} onClick={()=>window.open('https://dirtycheapcreative.com','_blank')} />
        </nav>
      </div>

      {/* MAIN */}
      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f5f4f0'}}>
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

        {/* TABS */}
        <div style={{display:'flex',gap:0,background:'#fff',paddingLeft:'28px',borderBottom:'1px solid rgba(0,0,0,0.08)'}}>
          {(() => {
            const hasSummary = aiChildren.length > 0 || cpsChildren.length > 0 || !!brief?.static_images_url
            const tabs = [
              {key:'hybrid' as const, label:'Ana Video'},
              {key:'cps' as const, label:'CPS'},
              {key:'express' as const, label:'AI Express'},
              {key:'ugc' as const, label:'AI UGC'},
              ...(hasSummary ? [{key:'summary' as const, label:'Kampanya Özeti'}] : []),
            ]
            return tabs.map((t,ti)=>{
              const isActive = activeTab === t.key
              const isSummary = t.key === 'summary'
              return (
                <button key={t.key} onClick={()=>setActiveTab(t.key)}
                  style={{padding:'12px 24px',border:'none',borderBottom:isActive?(isSummary?'2px solid #f5a623':'2px solid #0a0a0a'):'2px solid transparent',borderRight:ti<tabs.length-1?'1px solid rgba(0,0,0,0.06)':'none',background:isActive?(isSummary?'rgba(245,166,35,0.06)':'#0a0a0a'):'#fff',color:isActive?(isSummary?'#0a0a0a':'#fff'):'#555',fontSize:'14px',fontWeight:'600',cursor:'pointer',transition:'all 0.15s'}}
                  onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background='#f5f5f5'}}
                  onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background='#fff'}}>
                  {t.label}
                  {t.key==='express' && <span style={{marginLeft:'4px',fontSize:'9px',padding:'1px 5px',background:'#1DB81D',color:'#fff',fontWeight:'600',verticalAlign:'middle'}}>Beta</span>}
                  {t.key==='ugc' && <span style={{marginLeft:'4px',fontSize:'9px',padding:'1px 5px',background:'#1DB81D',color:'#fff',fontWeight:'600',verticalAlign:'middle'}}>Beta</span>}
                  {t.key==='ugc' && brief?.ugc_video_id && <span style={{marginLeft:'6px',fontSize:'10px',color:'#1DB81D',fontWeight:'600'}}>1</span>}
                  {t.key==='express' && aiChildren.length > 0 && <span style={{marginLeft:'6px',fontSize:'10px',color:'#1DB81D',fontWeight:'600'}}>{aiChildren.filter(c=>c.ai_video_url).length}</span>}
                  {t.key==='cps' && cpsChildren.length > 0 && <span style={{marginLeft:'6px',fontSize:'10px',color:'#3b82f6',fontWeight:'600'}}>{cpsChildren.length}</span>}
                </button>
              )
            })
          })()}
        </div>

        <div style={{flex:1,padding:'24px 28px'}}>
          {!brief ? <div style={{color:'#888',fontSize:'14px'}}>Yükleniyor...</div> : (
            <>
              {/* SUCCESS TOAST */}
              {approveSuccess && (
                <div style={{position:'fixed',top:'24px',left:'50%',transform:'translateX(-50%)',zIndex:200,background:'#22c55e',color:'#fff',padding:'14px 28px',borderRadius:'12px',fontSize:'14px',fontWeight:'500',boxShadow:'0 8px 32px rgba(34,197,94,0.3)',animation:'slideUp 0.4s ease',display:'flex',alignItems:'center',gap:'10px'}}>
                  <div style={{width:'24px',height:'24px',borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',animation:'successPulse 0.5s ease'}}>✓</div>
                  Onaylandı! Teşekkürler.
                </div>
              )}

              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

              {/* ═══ HYBRID TAB ═══ */}
              {activeTab === 'hybrid' && <>

              {/* CREDIT BOX */}
              {(brief.credit_cost || 0) > 0 && (
                <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'12px'}}>
                  <div style={{display:'inline-flex',padding:'6px 14px',border:'1px solid #0a0a0a',fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:'#0a0a0a'}}>{brief.credit_cost} KREDİ</div>
                </div>
              )}

              {/* DRAFT BANNER */}
              {brief.status === 'draft' && (
                <div style={{background:'#fffbeb',border:'1.5px dashed #f59e0b',borderRadius:'12px',padding:'14px 18px',marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>Bu brief henüz gönderilmedi.</div>
                    <div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>Taslak olarak kaydedildi. Düzenleyip gönderebilirsiniz.</div>
                  </div>
                  <button onClick={()=>router.push(`/dashboard/client/brief/new?draft=${id}`)} style={{padding:'8px 18px',background:'#f59e0b',color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontWeight:'500',whiteSpace:'nowrap'}}>Düzenle ve Gönder</button>
                </div>
              )}

              {/* EDIT — within 15 min and still submitted */}
              {['submitted','read'].includes(brief.status) && (Date.now() - new Date(brief.created_at).getTime()) < 30*60*1000 && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'14px 18px',marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:'13px',color:'#555'}}>Brief'inizi gönderdikten sonra yarım saat boyunca düzenleyebilirsiniz.</div>
                  <button onClick={()=>router.push(`/dashboard/client/brief/new?edit=${id}`)} className="btn">Brief'i Düzenle</button>
                </div>
              )}

              {/* CANCELLED */}
              {brief.status==='cancelled' && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:'13px',color:'#888'}}>Bu brief admin tarafından iptal edildi.</div>
                  <button onClick={handleDelete} className="btn" style={{background:'#ef4444'}}>Sil</button>
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
                        <button onClick={()=>handleAnswer(q.id)} className="btn" style={{padding:"8px 16px",whiteSpace:"nowrap"}}>Yanıtla</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* AI VIDEO PROCESSING / COMPLETED / FAILED */}
              {(brief.status === 'ai_processing' || brief.status === 'ai_completed') && (() => {
                const stages = brief.product_image_url ? PRODUCT_STAGES : CHARACTER_STAGES
                const stageKeys = stages.map(s => s.key)
                const curIdx = stageKeys.indexOf(brief.ai_video_status || '')
                const curDur = curIdx >= 0 ? stages[curIdx].duration : 0
                const curRem = Math.max(0, curDur - aiStageElapsed)
                const futureTime = stages.slice(curIdx + 1).reduce((s, x) => s + x.duration, 0)
                const totalRem = curRem + futureTime
                const barPct = curDur > 0 ? Math.min(100, (aiStageElapsed / curDur) * 100) : 0
                const fmtCd = (s: number) => { const m = Math.floor(s/60); const r = s%60; return m > 0 ? `${m}:${String(r).padStart(2,'0')}` : `${r} sn` }
                const fmtRem = (s: number) => s >= 60 ? `~${Math.ceil(s/60)} dk kaldı` : `~${s} sn kaldı`

                // COMPLETED
                if (brief.ai_video_status === 'completed' && brief.ai_video_url) {
                  return (
                    <div style={{display:'flex',gap:'20px',marginBottom:'16px',alignItems:'flex-start'}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{borderRadius:'12px',overflow:'hidden',position:'relative',maxWidth:aspect.maxW,margin:briefFormat==='16:9'?'0':'0 auto'}}>
                          <div style={{paddingTop:aspect.padding,position:'relative'}}>
                            <video controls autoPlay style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',borderRadius:'12px'}}>
                              <source src={brief.ai_video_url} />
                            </video>
                          </div>
                        </div>
                      </div>
                      <div style={{width:'280px',flexShrink:0,position:'sticky',top:'24px'}}>
                        <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a',marginBottom:'6px'}}>AI Video Hazır</div>
                        <div style={{fontSize:'12px',color:'#888',marginBottom:'20px',lineHeight:1.6}}>Videoyu beğendiyseniz satın alabilirsiniz.</div>
                        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
                          <button onClick={handleAiPurchase} disabled={(clientUser?.allocated_credits||0)<2} className="btn btn-accent" style={{padding:'12px 24px'}}>
                            SATIN AL
                          </button>
                          <span style={{fontSize:'13px',color:'#888'}}>2 kredi</span>
                        </div>
                        <button onClick={handleAiDiscard}
                          style={{width:'100%',padding:'10px',background:'#fff',color:'#555',border:'0.5px solid rgba(0,0,0,0.15)',borderRadius:'10px',fontSize:'12px',cursor:'pointer',}}>
                          Vazgeç
                        </button>
                        {aiError && <div style={{fontSize:'12px',color:'#ef4444',marginTop:'8px'}}>{aiError}</div>}
                      </div>
                    </div>
                  )
                }

                // FAILED
                if (brief.ai_video_status === 'failed') {
                  return (
                    <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'24px',marginBottom:'16px'}}>
                      <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a',marginBottom:'8px'}}>Video oluşturulamadı</div>
                      <div style={{fontSize:'13px',color:'#ef4444',marginBottom:'16px'}}>{brief.ai_video_error || 'Bilinmeyen hata'}</div>
                      <button onClick={async ()=>{
                        await supabase.from('briefs').update({ ai_video_status:'processing_concept', status:'ai_processing', ai_video_url:null, ai_video_error:null }).eq('id',id)
                        setBrief((prev:any)=>({...prev, ai_video_status:'processing_concept', status:'ai_processing', ai_video_url:null, ai_video_error:null}))
                        fetch('/api/generate-ai-video',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({briefId:id})})
                      }}
                        style={{padding:'10px 20px',background:'#222',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',}}>
                        Tekrar Dene
                      </button>
                    </div>
                  )
                }

                // PROCESSING
                return (
                  <div style={{background:'#0a0a0a',borderRadius:'12px',padding:'24px 28px',marginBottom:'16px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
                      <div style={{fontSize:'15px',fontWeight:'500',color:'#fff'}}>Video oluşturuluyor...</div>
                      {totalRem > 0 && <div style={{fontSize:'13px',color:'#1DB81D',fontFamily:'monospace',fontWeight:'500'}}>Tahmini: {fmtCd(totalRem)} kaldı</div>}
                    </div>
                    {stages.map((s, i) => {
                      const isDone = curIdx > i
                      const isCurrent = curIdx === i
                      return (
                        <div key={s.key} style={{marginBottom:isCurrent?'16px':'10px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                            <div style={{width:'18px',height:'18px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                              {isDone ? <span style={{color:'#1DB81D',fontSize:'14px'}}>&#10003;</span>
                                : isCurrent ? <div style={{width:'10px',height:'10px',border:'2px solid #1DB81D',borderTop:'2px solid transparent',animation:'spin 1s linear infinite'}} className="spinner"></div>
                                : <div style={{width:'6px',height:'6px',background:'#444',borderRadius:'50%'}}></div>}
                            </div>
                            <span style={{fontSize:'13px',color:isDone?'#1DB81D':isCurrent?'#fff':'#555',flex:1}}>{s.label}{isDone?' ✓':''}</span>
                            {isCurrent && curRem > 0 && <span style={{fontSize:'11px',color:'#888'}}>{fmtRem(curRem)}</span>}
                            {!isDone && !isCurrent && <span style={{fontSize:'10px',color:'#444'}}>~{s.duration >= 60 ? `${Math.floor(s.duration/60)} dk` : `${s.duration} sn`}</span>}
                          </div>
                          {isCurrent && (
                            <div style={{marginTop:'6px',marginLeft:'28px',height:'3px',background:'#222',borderRadius:'2px',overflow:'hidden'}}>
                              <div style={{height:'100%',background:'#1DB81D',borderRadius:'2px',transition:'width 1s linear',width:`${barPct}%`}}></div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <div style={{marginTop:'16px',fontSize:'11px',color:'#555',display:'flex',alignItems:'center',gap:'6px',lineHeight:'1.5'}}>
                      <span style={{color:'#1DB81D',flexShrink:0}}>&#9889;</span> Sayfayı kapatabilirsiniz, video arka planda oluşturulmaya devam eder.
                    </div>
                  </div>
                )
              })()}

              {/* VIDEO PLAYER + ACTION PANEL */}
              {currentVideo && (brief.status==='approved'||brief.status==='delivered') && (
                <div style={{display:'flex',gap:'20px',marginBottom:'16px',alignItems:'flex-start'}}>
                  {/* VIDEO */}
                  <div style={{flex:1,minWidth:0}}>
                      <div style={{borderRadius:'12px',overflow:'hidden',position:'relative',maxWidth:aspect.maxW,margin:briefFormat==='16:9'?'0':'0 auto'}}>
                        <video ref={videoRef} key={currentVideo.id} controls
                          onTimeUpdate={()=>{if(videoRef.current) setCurrentTime(videoRef.current.currentTime)}}
                          style={{width:'100%',height:'auto',display:'block',borderRadius:'12px'}}>
                          <source src={currentVideo.video_url} />
                        </video>
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
                              style={{padding:'6px 14px',borderRadius:'100px',fontSize:'12px',fontWeight:'500',cursor:'pointer',transition:'all 0.2s',border:isActive?'1.5px solid #22c55e':'1px solid rgba(0,0,0,0.1)',background:isActive?'#22c55e':'#fff',color:isActive?'#fff':'#555'}}>
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
                        <button onClick={()=>setShowApproveModal(true)} disabled={loading} className="btn btn-accent" style={{width:'100%',padding:'14px',marginBottom:'10px'}}>
                          ONAYLA VE TESLİM AL
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
                            <button type="submit" disabled={loading} style={{width:'100%',padding:'9px',background:'#fff',color:'#0a0a0a',border:'0.5px solid rgba(0,0,0,0.15)',borderRadius:'8px',fontSize:'12px',cursor:'pointer',}}>
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
                          style={{width:'100%',padding:'10px',background:'#fff',border:'0.5px solid rgba(0,0,0,0.12)',borderRadius:'10px',fontSize:'12px',color:'#0a0a0a',cursor:'pointer',fontWeight:'500',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',transition:'border-color 0.2s',marginBottom:'10px'}}>
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
                                  style={{fontSize:'10px',padding:'4px 10px',borderRadius:'6px',border:'0.5px solid rgba(0,0,0,0.12)',background:'#fff',color:linkCopied?'#22c55e':'#555',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
                                  {linkCopied ? 'Kopyalandı ✓' : 'Kopyala'}
                                </button>
                              </div>
                            </>
                          ) : (
                            <button onClick={generatePublicLink} disabled={generatingLink}
                              style={{width:'100%',padding:'10px',background:'#fff',border:'0.5px solid rgba(0,0,0,0.12)',borderRadius:'8px',fontSize:'12px',color:'#0a0a0a',cursor:'pointer',fontWeight:'500',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                              {generatingLink ? 'Oluşturuluyor...' : 'Public Link Oluştur'}
                            </button>
                          )}
                          <div style={{fontSize:'10px',color:'#aaa',marginTop:'6px',lineHeight:'1.5'}}>
                            Bu linke sahip herkes videonuzu izleyebilir. Linki yalnızca güvendiğiniz kişilerle paylaşın.
                          </div>
                        </div>

                        {/* STATIC IMAGES */}
                        <div style={{background:'#f5f4f0',border:'0.5px solid rgba(0,0,0,0.08)',borderRadius:'10px',padding:'14px 16px',position:'relative'}}>
                          <span style={{position:'absolute',top:'10px',left:'12px',fontSize:'8px',fontWeight:'600',color:'#888',background:'rgba(0,0,0,0.05)',padding:'2px 7px',borderRadius:'3px',letterSpacing:'0.5px'}}>BETA</span>
                          <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginTop:'20px'}}>
                            {brief.static_images_url ? (
                              <button onClick={()=>downloadFile(brief.static_images_url, `${slugify(brief.campaign_name)}_gorseller.zip`)}
                                style={{padding:'8px 16px',border:'1px solid #0a0a0a',background:'transparent',fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:'#0a0a0a',cursor:'pointer'}}>
                                GÖRSEL İNDİR ↓
                              </button>
                            ) : (
                              <button onClick={()=>setStaticImageModal({ briefId: id, videoUrl: currentVideo?.video_url || brief.ai_video_url })}
                                style={{width:'100%',padding:'10px',background:'#fff',border:'1px solid #0a0a0a',fontSize:'12px',color:'#0a0a0a',cursor:'pointer',fontWeight:'500',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                                Görsel Oluştur
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                  </div>
                </div>
              )}


              {/* SOSYAL MEDYA BAŞLIKLARI */}
              {brief.status === 'delivered' && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                  <div style={{fontSize:'11px',letterSpacing:'2px',textTransform:'uppercase',fontWeight:'500',color:'var(--color-text-secondary)',marginBottom:'12px'}}>SOSYAL MEDYA CAPTION'I</div>
                  {!captionText && !captionLoading ? (
                    <button onClick={generateCaption} className="btn" style={{padding:'10px 20px'}}>
                      CAPTION ÜRET
                    </button>
                  ) : (
                    <>
                      <textarea ref={captionRef} value={captionText} onChange={e => { if (e.target.value.length <= 2200) setCaptionText(e.target.value) }}
                        maxLength={2200} rows={4} disabled={captionLoading}
                        style={{width:'100%',padding:'12px',border:'1px solid #0a0a0a',fontSize:'14px',color:'#0a0a0a',lineHeight:'1.6',resize:'vertical',boxSizing:'border-box',opacity:captionLoading?0.5:1}}
                        placeholder={captionLoading ? 'Üretiliyor...' : 'Caption yazın...'} />
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'8px'}}>
                        <div style={{fontSize:'11px',letterSpacing:'1px',color:'var(--color-text-tertiary)'}}>{captionText.length} / 2200</div>
                        <div style={{display:'flex',gap:'8px'}}>
                          <button onClick={() => setShowRegenerateConfirm(true)} className="btn btn-outline" style={{padding:'6px 14px'}} disabled={captionLoading}>
                            YENİDEN ÜRET
                          </button>
                          <button onClick={handleCaptionAction} className="btn" style={{padding:'6px 14px'}} disabled={!captionText.trim()}>
                            {captionToast ? (captionToast + ' ✓') : (captionText !== savedCaption ? 'KAYDET VE KOPYALA' : 'KOPYALA')}
                          </button>
                        </div>
                      </div>
                    </>
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



              {/* SELECTED AI IDEA — above brief details */}
              {brief.selected_ai_idea && (
                <div style={{background:'#f5f4f0',border:'1px solid #0a0a0a',padding:'16px 20px',marginBottom:'16px'}}>
                  <div style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:'var(--color-text-tertiary)',marginBottom:'6px'}}>SEÇTİĞİNİZ YARATICI YÖN</div>
                  <div style={{fontSize:'15px',fontWeight:'500',color:'#0a0a0a',marginBottom:'4px'}}>{brief.selected_ai_idea.title}</div>
                  <div style={{fontSize:'13px',color:'#6b6b66',lineHeight:1.5}}>{brief.selected_ai_idea.description}</div>
                </div>
              )}

              {/* BRIEF DETAILS — COLLAPSIBLE */}
              <div style={{background:'#fff',border:'1px solid #0a0a0a',padding:'18px 20px',marginBottom:'16px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'16px'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'11px',letterSpacing:'2px',textTransform:'uppercase',fontWeight:'500',color:'var(--color-text-secondary)',marginBottom:'8px'}}>BRİEF DETAYLARI</div>
                    {!briefExpanded && (
                      <>
                        <div style={{fontSize:'14px',color:'var(--color-text-primary)',lineHeight:1.65,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as any,marginBottom:'8px'}}>{brief.message}</div>
                        <div style={{fontSize:'12px',color:'var(--color-text-secondary)'}}>
                          {[brief.target_audience, brief.video_type, Array.isArray(brief.format)?brief.format.join(', '):brief.format, brief.cta].filter(Boolean).join(' · ')}
                        </div>
                      </>
                    )}
                  </div>
                  <button onClick={()=>setBriefExpanded(!briefExpanded)}
                    style={{flexShrink:0,padding:'6px 12px',fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',cursor:'pointer',border:'1px solid #0a0a0a',background:briefExpanded?'#0a0a0a':'transparent',color:briefExpanded?'#fff':'#0a0a0a',transition:'all 0.15s'}}>
                    {briefExpanded ? 'KAPAT ▴' : 'DETAY ▾'}
                  </button>
                </div>

                {briefExpanded && (
                  <div style={{marginTop:'16px',transition:'all 0.2s ease'}}>
                    {/* Full message */}
                    <div style={{fontSize:'14px',color:'var(--color-text-primary)',lineHeight:1.65,marginBottom:'16px'}}>{brief.message}</div>

                    {/* Metadata grid */}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'12px',borderTop:'1px solid var(--color-border-tertiary)',paddingTop:'14px'}}>
                      {[
                        {label:'HEDEF',value:brief.target_audience},
                        {label:'TİP',value:brief.video_type},
                        {label:'FORMAT',value:Array.isArray(brief.format)?brief.format.join(', '):brief.format},
                        {label:'CTA',value:brief.cta},
                      ].filter(m=>m.value).map(m=>(
                        <div key={m.label}>
                          <div style={{fontSize:'10px',letterSpacing:'2px',color:'var(--color-text-tertiary)',fontWeight:'500',marginBottom:'4px'}}>{m.label}</div>
                          <div style={{fontSize:'13px',color:'var(--color-text-primary)'}}>{m.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Voiceover */}
                    {brief.voiceover_text && (
                      <div style={{borderTop:'1px solid var(--color-border-tertiary)',paddingTop:'14px',marginTop:'14px'}}>
                        <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--color-text-secondary)',fontWeight:'500',marginBottom:'8px'}}>SESLENDİRME METNİ</div>
                        <div style={{borderLeft:'3px solid #4ade80',paddingLeft:'14px',fontSize:'14px',fontStyle:'italic',color:'var(--color-text-primary)',lineHeight:1.65}}>{brief.voiceover_text}</div>
                      </div>
                    )}

                    {/* Notes */}
                    {brief.notes && (
                      <div style={{borderTop:'1px solid var(--color-border-tertiary)',paddingTop:'14px',marginTop:'14px'}}>
                        <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--color-text-secondary)',fontWeight:'500',marginBottom:'8px'}}>NOTLAR</div>
                        <div style={{fontSize:'14px',color:'var(--color-text-primary)',lineHeight:1.65}}>{brief.notes}</div>
                      </div>
                    )}

                  </div>
                )}
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

              </>}

              {/* ═══ AI EXPRESS TAB ═══ */}
              {activeTab === 'express' && <>

              {/* AI EXPRESS CREDIT BOX */}
              {aiChildren.length > 0 && (() => {
                const total = aiChildren.length + aiChildren.filter(c => c.status === 'delivered').length * 2
                return total > 0 ? (
                  <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'12px'}}>
                    <div style={{display:'inline-flex',padding:'6px 14px',border:'1px solid #0a0a0a',fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:'#0a0a0a'}}>{total} KREDİ</div>
                  </div>
                ) : null
              })()}

              {/* AI EXPRESS INFO ICON */}
              <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'12px'}}>
                <button onClick={()=>setExpressInfoOpen(true)} title="AI Express Hakkında" style={{width:'28px',height:'28px',border:'1px solid #e5e4db',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:'600',color:'#888'}}>i</button>
              </div>

              {/* AI VIDEO STUDIO */}
              {brief && brief.status !== 'cancelled' && brief.status !== 'draft' && (
                <div style={{background:'#fff',border:'1px solid var(--color-border-tertiary)',padding:'20px 24px',marginBottom:'16px'}}>

                  {/* Version list */}
                  {aiChildren.map((child, idx) => {
                    const hasVideo = !!child.ai_video_url
                    const isPurchased = child.status === 'delivered'
                    const isFailed = !hasVideo && (child.ai_video_status === 'failed' || child.ai_video_status === 'timeout')
                    const isProcessing = child.status === 'ai_processing' && !hasVideo && !isFailed
                    return (
                      <div key={child.id} id={`ai-child-${child.id}`} style={{display:'flex',gap:'14px',padding:'14px',marginBottom:'8px',border:'1px solid var(--color-border-tertiary)',background:'#fff',alignItems:'flex-start',transition:'background 0.15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.background='var(--color-background-secondary)'}}
                        onMouseLeave={e=>{e.currentTarget.style.background='#fff'}}>
                        {/* Video player */}
                        <div style={{width:'200px',aspectRatio:(child.format||'9:16').replace(':','/'),background:'#0a0a0a',flexShrink:0,position:'relative',overflow:'hidden'}}>
                          {hasVideo ? (
                            <>
                              <video key={child.ai_video_url} src={child.ai_video_url} controls preload="metadata"
                                onPlay={() => markAiChildViewed(child.id)}
                                style={{width:'100%',height:'100%',objectFit:'contain',backgroundColor:'black'}} />
                              {!isPurchased && <img src="/dinamo_logo.png" alt="" style={{position:'absolute',bottom:'30%',left:'50%',transform:'translateX(-50%)',width:'80px',opacity:0.35,pointerEvents:'none'}} />}
                            </>
                          ) : isProcessing ? (
                            (() => {
                              const stg = child.product_image_url ? PRODUCT_STAGES : CHARACTER_STAGES
                              const sKeys = stg.map(x=>x.key)
                              const realIdx = sKeys.indexOf(child.ai_video_status || '')
                              const timerIdx = timerStageMap[child.id] || 0
                              const curSi = Math.max(realIdx, timerIdx, 0)
                              const activeStage = stg[curSi] || stg[0]
                              const dur = activeStage?.duration || 0
                              const durLabel = dur >= 60 ? `~${Math.ceil(dur/60)} dakika` : `~${dur} saniye`
                              return (
                                <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',padding:'16px',background:'#0a0a0a'}}>
                                  {/* Duration label */}
                                  <div style={{fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'#6b6b66',marginBottom:'12px'}}>TAHMİNİ SÜRE: {durLabel.replace('~','')}</div>
                                  {/* Stage list */}
                                  {stg.map((s,si) => {
                                    const done = curSi > si
                                    const active = curSi === si
                                    return (
                                      <div key={s.key} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                                        <div style={{width:'14px',height:'14px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                          {done ? <span style={{color:'#4ade80',fontSize:'10px'}}>&#10003;</span>
                                            : active ? <div style={{width:'14px',height:'14px',border:'2px solid #4ade80',borderTop:'2px solid transparent',animation:'spin 1s linear infinite'}} className="spinner"></div>
                                            : <div style={{width:'4px',height:'4px',background:'#555'}}></div>}
                                        </div>
                                        <span style={{fontSize:'13px',lineHeight:'1.8',color:done?'#4ade80':active?'#fff':'#6b6b66',fontWeight:active?'500':'400',transition:'all 0.3s'}}>{s.label}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })()
                          ) : (
                            <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'6px'}}>
                              <span style={{fontSize:'20px',color:'#555'}}>&#9888;</span>
                              <span style={{fontSize:'10px',color:'#999',fontWeight:'500'}}>Üretilemedi</span>
                              <span style={{fontSize:'8px',color:'#555'}}>Geçici sistem hatası</span>
                            </div>
                          )}
                        </div>
                        {/* Info */}
                        <div style={{flex:1,minWidth:0,paddingTop:'4px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'4px'}}>
                            <span style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>V{idx+1}</span>
                            {isPurchased && <span style={{fontSize:'9px',color:'#1DB81D',fontWeight:'600'}}>&#10003; Satın Alındı</span>}
                            {isProcessing && <span style={{fontSize:'9px',fontWeight:'500',display:'inline-flex',alignItems:'center',gap:'4px'}}><span style={{width:'6px',height:'6px',background:'#4ade80',display:'inline-block',animation:'pulse 1.5s ease infinite'}}></span><span style={{color:'#0a0a0a'}}>Üretiliyor</span> <span style={{color:'#6b6b66'}}>(~5 dakika)</span></span>}
                            {isFailed && <span style={{fontSize:'9px',color:'#ef4444',fontWeight:'500'}}>Başarısız</span>}
                          </div>
                          <div style={{fontSize:'11px',color:'#888',marginBottom:'10px'}}>{new Date(child.created_at).toLocaleDateString('tr-TR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                          {isFailed && (
                            <div style={{display:'flex',gap:'6px',marginBottom:'10px'}}>
                              <button onClick={async ()=>{
                                await supabase.from('briefs').update({ ai_video_status:'processing_concept', ai_video_error:null, status:'ai_processing' }).eq('id',child.id)
                                setAiChildren(prev=>prev.map(c=>c.id===child.id?{...c,ai_video_status:'processing_concept',status:'ai_processing'}:c))
                                fetch('/api/generate-ai-video',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({briefId:child.id,pipelineType:child.product_image_url?'product':'character'})})
                              }}
                                style={{padding:'5px 12px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'4px',fontSize:'11px',fontWeight:'500',cursor:'pointer',}}>
                                Tekrar Dene
                              </button>
                              <button onClick={async ()=>{
                                await supabase.from('briefs').delete().eq('id',child.id)
                                setAiChildren(prev=>prev.filter(c=>c.id!==child.id))
                              }}
                                style={{padding:'5px 12px',background:'none',color:'#ef4444',border:'0.5px solid #ef4444',borderRadius:'4px',fontSize:'11px',fontWeight:'500',cursor:'pointer',}}>
                                Sil
                              </button>
                            </div>
                          )}
                          {hasVideo && (
                            <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                              {isPurchased ? (
                                <>
                                  <a href={child.ai_video_url} download target="_blank"
                                    style={{fontSize:'11px',color:'#0a0a0a',textDecoration:'none',border:'0.5px solid rgba(0,0,0,0.15)',borderRadius:'6px',padding:'5px 12px',display:'inline-flex',alignItems:'center',gap:'4px',}}>
                                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4 8l4 4 4-4" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/><path d="M2 13h12" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                    İndir
                                  </a>
                                  <button onClick={()=>generateCertificatePDF(brief, companyName)}
                                    style={{fontSize:'11px',color:'#555',background:'none',border:'0.5px solid rgba(0,0,0,0.12)',borderRadius:'6px',padding:'5px 12px',cursor:'pointer',}}>
                                    Telif Belgesi
                                  </button>
                                  {child.static_images_url ? (
                                    <button onClick={()=>downloadFile(child.static_images_url, `gorseller_v${idx+1}.zip`)}
                                      style={{fontSize:'11px',color:'#0a0a0a',background:'none',border:'1px solid #0a0a0a',padding:'5px 12px',cursor:'pointer',letterSpacing:'1px',textTransform:'uppercase'}}>
                                      GÖRSEL İNDİR ↓
                                    </button>
                                  ) : (
                                    <button onClick={()=>setStaticImageModal({ briefId: child.id, videoUrl: child.ai_video_url })}
                                      style={{fontSize:'11px',color:'#0a0a0a',background:'none',border:'1px solid #0a0a0a',padding:'5px 12px',cursor:'pointer'}}>
                                      Görsel Oluştur
                                    </button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button onClick={()=>handleStudioPurchase(child)} disabled={(clientUser?.allocated_credits||0)<2} className="btn btn-accent" style={{padding:'6px 16px'}}>
                                    SATIN AL
                                  </button>
                                  <span style={{fontSize:'13px',color:'#888'}}>2 kredi</span>
                                </>
                              )}
                            </div>
                          )}
                          {/* Feedback */}
                          {hasVideo && (() => {
                            const feedbacks: any[] = Array.isArray(child.ai_feedbacks) ? child.ai_feedbacks : []
                            const lastFb = feedbacks.length > 0 ? feedbacks[feedbacks.length - 1] : null
                            const isEditing = editingFeedback[child.id] || !lastFb
                            const currentText = feedbackText[child.id] ?? ''
                            return (
                              <div style={{marginTop:'10px'}}>
                                {!isEditing && lastFb ? (
                                  <div style={{fontSize:'11px',color:'#555',padding:'8px 10px',background:'#f5f4f0',borderRadius:'6px',lineHeight:1.5}}>
                                    <span style={{color:'#0a0a0a'}}>{lastFb.feedback}</span>
                                    <span onClick={()=>{setEditingFeedback(p=>({...p,[child.id]:true}));setFeedbackText(p=>({...p,[child.id]:lastFb.feedback}))}} style={{marginLeft:'8px',fontSize:'10px',color:'#3b82f6',cursor:'pointer'}}>Düzenle</span>
                                  </div>
                                ) : (
                                  <div style={{display:'flex',gap:'6px',alignItems:'flex-end'}}>
                                    <textarea
                                      value={currentText}
                                      onChange={e=>setFeedbackText(p=>({...p,[child.id]:e.target.value}))}
                                      placeholder="AI Express videolar şimdilik harika olmayabilir ama gelişebilir. Yorum bırakın ya da dış sesi revize edin, daha iyisini üretin — bir sonraki üretimde dikkate alınır."
                                      rows={3}
                                      style={{flex:1,padding:'12px 14px',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'6px',fontSize:'11px',color:'#0a0a0a',resize:'vertical',boxSizing:'border-box'}}
                                    />
                                    <button onClick={async()=>{
                                      const val = currentText.trim()
                                      if(!val) return
                                      const newEntry = {video_version:`V${idx+1}`,feedback:val,created_at:new Date().toISOString()}
                                      const existing: any[] = Array.isArray(child.ai_feedbacks) ? child.ai_feedbacks : []
                                      const updated = [...existing, newEntry]
                                      await supabase.from('briefs').update({ai_feedbacks:updated}).eq('id',child.id)
                                      setAiChildren(prev=>prev.map(c=>c.id===child.id?{...c,ai_feedbacks:updated}:c))
                                      if(val.length>20) fetch('/api/brand-learning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:brief?.client_id,sourceType:'feedback',sourceId:child.id,text:val})}).catch(()=>{})
                                      setEditingFeedback(p=>({...p,[child.id]:false}))
                                      setFeedbackText(p=>({...p,[child.id]:''}))
                                    }}
                                      style={{padding:'8px 14px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'6px',fontSize:'11px',fontWeight:'500',cursor:'pointer',whiteSpace:'nowrap',height:'36px'}}>
                                      Kaydet
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    )
                  })}

                  {/* Generate button — only if AI video enabled */}
                  {brief.clients?.ai_video_enabled !== false && <div style={{marginTop:aiChildren.length>0?'16px':'0'}}>
                    {aiGenerating ? (
                      <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'14px 0'}}>
                        <div style={{width:'16px',height:'16px',border:'2px solid #1DB81D',borderTop:'2px solid transparent',animation:'spin 1s linear infinite'}} className="spinner"></div>
                        <span style={{fontSize:'12px',color:'#888'}}>Üretim başlatılıyor...</span>
                      </div>
                    ) : brief.product_image_url && showAiGenerate ? (
                      <div style={{display:'flex',gap:'8px'}}>
                        <button onClick={()=>handleStudioGenerate('product')}
                          style={{flex:1,padding:'12px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'2px',fontSize:'12px',fontWeight:'600',cursor:'pointer',transition:'background 0.15s'}}
                          onMouseEnter={e=>(e.currentTarget.style.background='#1DB81D')}
                          onMouseLeave={e=>(e.currentTarget.style.background='#0a0a0a')}>
                          Ürün Odaklı
                        </button>
                        <button onClick={()=>handleStudioGenerate('character')}
                          style={{flex:1,padding:'12px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'2px',fontSize:'12px',fontWeight:'600',cursor:'pointer',transition:'background 0.15s'}}
                          onMouseEnter={e=>(e.currentTarget.style.background='#1DB81D')}
                          onMouseLeave={e=>(e.currentTarget.style.background='#0a0a0a')}>
                          Karakter Odaklı
                        </button>
                      </div>
                    ) : (
                      <div>
                        <button onClick={()=>brief.product_image_url?setShowAiGenerate(true):handleStudioGenerate('character')} disabled={(clientUser?.allocated_credits||0)<1}
                          style={{width:'100%',padding:'14px',background:(clientUser?.allocated_credits||0)<1?'#ccc':'#0a0a0a',color:'#fff',border:'none',borderRadius:'2px',fontSize:'13px',fontWeight:'600',cursor:(clientUser?.allocated_credits||0)<1?'default':'pointer',transition:'background 0.15s',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}
                          onMouseEnter={e=>{if((clientUser?.allocated_credits||0)>=1)e.currentTarget.style.background='#1DB81D'}}
                          onMouseLeave={e=>{if((clientUser?.allocated_credits||0)>=1)e.currentTarget.style.background='#0a0a0a'}}>
                          {aiChildren.length > 0 ? 'Yeni Versiyon Üret' : 'Full AI Video Üret'}
                        </button>
                        <div style={{fontSize:'13px',color:'#999',textAlign:'center',marginTop:'6px'}}>{aiChildren.length > 0 ? '~5 dakika · 1 kredi' : '~5 dakika · İlk deneme ücretsiz · 2 kredi satın alma'}</div>
                      </div>
                    )}
                  </div>}
                </div>
              )}

              </>}

              {/* ═══ CPS TAB ═══ */}
              {activeTab === 'cps' && <>
                {/* CPS CREDIT BOX */}
                {cpsChildren.length > 0 && (() => {
                  const total = cpsChildren.reduce((s: number, c: any) => s + (c.credit_cost || 0), 0)
                  return total > 0 ? (
                    <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'12px'}}>
                      <div style={{display:'inline-flex',padding:'6px 14px',border:'1px solid #0a0a0a',fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:'#0a0a0a'}}>{total} KREDİ</div>
                    </div>
                  ) : null
                })()}
                {/* CPS INFO ICON */}
                <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'12px'}}>
                  <button onClick={()=>setCpsInfoOpen(true)} title="CPS Hakkında" style={{width:'28px',height:'28px',border:'1px solid #e5e4db',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:'600',color:'#888'}}>i</button>
                </div>

                {/* Package selection — show if no CPS children yet */}
                {cpsChildren.length === 0 && cpsPackage === 0 && (
                  <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                    <div style={{fontSize:'14px',fontWeight:'600',color:'#0a0a0a',marginBottom:'16px'}}>Paket Seçin</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px'}}>
                      {[
                        {size:3,label:'3 Varyasyon',rec:false},
                        {size:6,label:'6 Varyasyon',rec:true},
                        {size:9,label:'9 Varyasyon',rec:false},
                      ].map(p=>{
                        const perDir = Math.ceil((brief.credit_cost || 18) / 3)
                        const cost = perDir * p.size
                        return (
                          <div key={p.size} onClick={()=>{setCpsPackage(p.size);setCpsVariations(Array.from({length:p.size},(_,i)=>({hook:'',hero:'',ton:'',tempo:'',cta:'',note:''})))}}
                            style={{padding:'20px',border:'1px solid rgba(0,0,0,0.1)',borderRadius:'8px',cursor:'pointer',textAlign:'center',transition:'all 0.15s',position:'relative'}}
                            onMouseEnter={e=>(e.currentTarget.style.borderColor='#1DB81D')}
                            onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.1)')}>
                            {p.rec && <div style={{position:'absolute',top:'-8px',left:'50%',transform:'translateX(-50%)',fontSize:'9px',padding:'2px 8px',background:'#1DB81D',color:'#fff',borderRadius:'4px',fontWeight:'600'}}>Önerilen</div>}
                            <div style={{fontSize:'18px',fontWeight:'600',color:'#0a0a0a',marginBottom:'4px'}}>{p.label}</div>
                            <div style={{fontSize:'12px',color:'#888'}}>{cost} kredi</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* CPS Configuration */}
                {cpsPackage > 0 && cpsChildren.length === 0 && (
                  <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                        <div style={{fontSize:'14px',fontWeight:'600',color:'#0a0a0a'}}>{cpsPackage} Varyasyon Planı</div>
                        <button onClick={()=>{setCpsPackage(0);setCpsVariations([])}} style={{fontSize:'11px',color:'#888',background:'none',border:'none',cursor:'pointer',textDecoration:'underline',}}>Paketi Değiştir</button>
                      </div>
                      <button onClick={async()=>{
                        setCpsGenerating(true)
                        try{
                          const res = await fetch('/api/cps-generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({briefId:id,packageSize:cpsPackage})})
                          const data = await res.json()
                          if(data.variations) setCpsVariations(data.variations.slice(0,cpsPackage))
                        }catch{}
                        setCpsGenerating(false)
                      }} disabled={cpsGenerating}
                        style={{padding:'9px 18px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'2px',fontSize:'12px',fontWeight:'600',cursor:'pointer',}}>
                        {cpsGenerating ? 'AI düşünüyor...' : 'VARYASYON PLANINI AI OLUŞTUR'}
                      </button>
                    </div>

                    {cpsVariations.map((v: any, vi: number) => (
                      <div key={vi} style={{padding:'14px',border:'0.5px solid rgba(0,0,0,0.08)',borderRadius:'8px',marginBottom:'8px',background:v.hook?'rgba(29,184,29,0.02)':'#fff'}}>
                        <div style={{fontSize:'12px',fontWeight:'600',color:'#0a0a0a',marginBottom:'10px'}}>Varyasyon {vi+1}</div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'8px'}}>
                          {[
                            {key:'hook',label:'Hook',opts:['Direkt ürün','Problem-ihtiyaç','Hikaye','Dikkat çekici açılış','Faydadan başla']},
                            {key:'hero',label:'Hero',opts:['Erkek','Kadın','Yok']},
                            {key:'ton',label:'Ton',opts:['Enerjik','Kurumsal','Duygusal','Eğlenceli','Premium']},
                          ].map(f=>(
                            <div key={f.key}>
                              <div style={{fontSize:'9px',color:'#888',marginBottom:'3px'}}>{f.label}</div>
                              <select value={(v as any)[f.key]||''} onChange={e=>{const u=[...cpsVariations];u[vi]={...u[vi],[f.key]:e.target.value};setCpsVariations(u)}}
                                style={{width:'100%',padding:'6px 8px',border:'0.5px solid rgba(0,0,0,0.12)',borderRadius:'4px',fontSize:'11px',color:'#0a0a0a',}}>
                                <option value="">Seç</option>
                                {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                        <div style={{marginTop:'8px'}}>
                          <div style={{fontSize:'9px',color:'#888',marginBottom:'3px'}}>Not (opsiyonel)</div>
                          <input value={v.note||''} onChange={e=>{const u=[...cpsVariations];u[vi]={...u[vi],note:e.target.value};setCpsVariations(u)}} maxLength={150} placeholder="Ek yön veya açıklama..."
                            style={{width:'100%',padding:'6px 8px',border:'0.5px solid rgba(0,0,0,0.12)',borderRadius:'4px',fontSize:'11px',color:'#0a0a0a',boxSizing:'border-box'}} />
                        </div>
                      </div>
                    ))}

                    {/* Launch */}
                    <div style={{display:'flex',alignItems:'center',gap:'12px',marginTop:'16px'}}>
                      <div style={{flex:1}}></div>
                      <button onClick={()=>setCpsConfirmModal(true)} disabled={cpsVariations.filter(v=>v.hook&&v.ton).length===0}
                        style={{padding:'12px 24px',background:cpsVariations.filter(v=>v.hook&&v.ton).length===0?'#ccc':'#0a0a0a',color:'#fff',border:'none',borderRadius:'2px',fontSize:'13px',fontWeight:'600',cursor:'pointer',}}>
                        CPS Başlat
                      </button>
                    </div>
                  </div>
                )}

                {/* CPS children — 3 column grid */}
                {cpsChildren.length > 0 && (
                  <div style={{marginBottom:'16px'}}>
                    <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:'var(--color-text-primary)',marginBottom:'14px'}}>CPS VARYASYONLARI · {cpsChildren.length} YÖN</div>
                    <div className="cps-grid" style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(cpsChildren.length, 3)}, 1fr)`,gap:'14px'}}>
                      {cpsChildren.map((child: any, idx: number) => {
                        const childVideo = child.video_submissions?.[0]
                        const hasVideo = !!childVideo?.video_url
                        const needsApproval = (child.status === 'approved' || (childVideo?.status === 'admin_approved' || childVideo?.status === 'producer_approved')) && child.status !== 'delivered'
                        const sb = statusColor[child.status] || '#888'
                        return (
                          <div key={child.id} style={{background:'#fff',border:'1px solid #0a0a0a',padding:'16px 18px',display:'flex',flexDirection:'column'}}>
                            {/* Header — fixed height for alignment */}
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'12px',minHeight:'40px'}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:'var(--color-text-secondary)',lineHeight:'1.3',minHeight:'28px'}}>YÖN {child.mvc_order || idx + 1}{child.cps_hook ? ` · ${child.cps_hook}` : ''}</div>
                                {child.cps_ton && <div style={{fontSize:'10px',color:'var(--color-text-tertiary)',marginTop:'2px'}}>{child.cps_ton}</div>}
                              </div>
                              <span style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',padding:'3px 8px',background:`${sb}12`,border:`1px solid ${sb}`,color:'#0a0a0a',flexShrink:0}}>{statusLabel[child.status] || child.status}</span>
                            </div>

                            {/* Video */}
                            <div style={{marginBottom:'12px'}}>
                              {hasVideo ? (
                                <div style={{aspectRatio:(child.format||briefFormat).replace(':','/'),overflow:'hidden',background:'#0a0a0a'}}>
                                  <video src={childVideo.video_url} controls playsInline preload="metadata" style={{width:'100%',height:'100%',objectFit:'contain',background:'black'}} />
                                </div>
                              ) : (
                                <VideoLoadingBox aspect={child.format||briefFormat} size="small" label={statusLabel[child.status]||child.status} sublabel="" />
                              )}
                            </div>

                            {/* Actions */}
                            {hasVideo && needsApproval && (
                              <div style={{display:'flex',gap:'6px',marginBottom:'8px'}}>
                                <button onClick={()=>handleCpsApprove(child)} disabled={loading} className="btn btn-accent" style={{flex:1,padding:'8px',fontSize:'11px'}}>
                                  {loading ? '...' : 'ONAYLA'}
                                </button>
                                <button onClick={()=>setCpsRevOpen(prev=>({...prev,[child.id]:!prev[child.id]}))} className="btn btn-outline" style={{flex:1,padding:'8px',fontSize:'11px'}}>
                                  REVİZYON İSTE
                                </button>
                              </div>
                            )}
                            {cpsRevOpen[child.id] && (
                              <div style={{marginBottom:'8px'}}>
                                <textarea value={cpsRevNotes[child.id]||''} onChange={e=>setCpsRevNotes(prev=>({...prev,[child.id]:e.target.value}))}
                                  placeholder="Revizyon notunuzu yazın..." rows={2}
                                  style={{width:'100%',padding:'8px 10px',border:'1px solid #0a0a0a',fontSize:'12px',color:'#0a0a0a',resize:'vertical',boxSizing:'border-box',marginBottom:'6px'}} />
                                <button onClick={()=>handleCpsRevision(child)} disabled={loading} className="btn" style={{width:'100%',padding:'7px',fontSize:'11px'}}>
                                  {loading ? '...' : 'GÖNDER'}
                                </button>
                              </div>
                            )}
                            {hasVideo && child.status === 'delivered' && (
                              <div style={{display:'flex',gap:'6px',marginTop:'auto'}}>
                                <button onClick={()=>downloadFile(childVideo.video_url, `${child.campaign_name}.mp4`)} className="btn btn-outline" style={{flex:1,padding:'7px',fontSize:'10px'}}>İNDİR ↓</button>
                                <button onClick={()=>generateCertificatePDF(brief, companyName)} className="btn btn-outline" style={{padding:'7px 10px',fontSize:'10px'}}>TELİF</button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <style>{`@media (max-width: 768px) { .cps-grid { grid-template-columns: 1fr !important; } }`}</style>
                  </div>
                )}

                {/* Reference video */}
                {currentVideo && (
                  <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
                    <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>Referans — Ana Video</div>
                    <div style={{maxWidth:'200px'}}>
                      <video src={currentVideo.video_url} controls playsInline preload="metadata" style={{width:'100%',borderRadius:'8px',objectFit:'contain',background:'black'}} />
                    </div>
                  </div>
                )}

              </>}

              {/* ═══ UGC TAB ═══ */}
              {activeTab === 'ugc' && brief && (
                <AIUGCTab briefId={id} brief={brief} clientUser={clientUser} />
              )}

              {/* ═══ SUMMARY TAB ═══ */}
              {activeTab === 'summary' && brief && (
                <CampaignSummaryTab brief={brief} companyName={companyName} videos={videos} aiChildren={aiChildren} cpsChildren={cpsChildren} onRefresh={loadData}
                  captionText={captionText} setCaptionText={setCaptionText} savedCaption={savedCaption} captionLoading={captionLoading} captionToast={captionToast}
                  onGenerateCaption={generateCaption} onCaptionAction={handleCaptionAction} onRegenerateConfirm={() => setShowRegenerateConfirm(true)} />
              )}

            </>
          )}
        </div>
      </div>

      {/* CPS CONFIRM MODAL */}
      {cpsConfirmModal && brief && (() => {
        const filled = cpsVariations.filter(v=>v.hook&&v.ton)
        const perDirection = Math.ceil((brief.credit_cost || 18) / 3)
        const totalCost = perDirection * cpsPackage
        return (
          <div style={{position:'fixed',inset:0,zIndex:150,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setCpsConfirmModal(false)}>
            <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)'}} />
            <div onClick={e=>e.stopPropagation()} style={{position:'relative',background:'#fff',borderRadius:'4px',padding:'32px',width:'100%',maxWidth:'400px'}}>
              <div style={{fontSize:'18px',fontWeight:'600',color:'#0a0a0a',marginBottom:'16px'}}>CPS Başlatılıyor</div>
              <div style={{fontSize:'15px',color:'#0a0a0a',marginBottom:'6px'}}>{cpsPackage} Varyasyon Paketi</div>
              <div style={{fontSize:'24px',fontWeight:'300',color:'#0a0a0a',letterSpacing:'-0.5px',marginBottom:'12px'}}>Toplam: {totalCost} kredi</div>
              <div style={{fontSize:'12px',color:'#888',lineHeight:1.6,marginBottom:'24px'}}>Onaylandıktan sonra {filled.length} child brief oluşturulur ve ekip üretime başlar.</div>
              {(clientUser?.allocated_credits||0) < totalCost && (
                <div style={{fontSize:'12px',color:'#ef4444',marginBottom:'16px'}}>Yetersiz kredi. Bakiyeniz: {clientUser?.allocated_credits||0}</div>
              )}
              <div style={{display:'flex',gap:'10px'}}>
                <button onClick={()=>setCpsConfirmModal(false)}
                  style={{flex:1,padding:'12px',background:'#fff',color:'#555',border:'1px solid rgba(0,0,0,0.15)',borderRadius:'4px',fontSize:'13px',cursor:'pointer',}}>
                  İptal
                </button>
                <button disabled={(clientUser?.allocated_credits||0)<totalCost} onClick={async()=>{
                  if(!clientUser||!brief) return
                  setCpsConfirmModal(false)
                  await supabase.from('client_users').update({allocated_credits:(clientUser.allocated_credits||0)-totalCost}).eq('id',clientUser.id)
                  setClientUser({...clientUser,allocated_credits:(clientUser.allocated_credits||0)-totalCost})
                  for(let i=0;i<filled.length;i++){
                    const v=filled[i]
                    await supabase.from('briefs').insert({
                      campaign_name:`${brief.campaign_name} — CPS V${i+1}`,
                      parent_brief_id:id, root_campaign_id:brief.root_campaign_id||id,
                      brief_type:'cps_child', mvc_order:i+1,
                      video_type:brief.video_type, format:brief.format, message:brief.message,
                      cta:brief.cta, target_audience:brief.target_audience,
                      voiceover_type:brief.voiceover_type, voiceover_gender:brief.voiceover_gender,
                      voiceover_text:brief.voiceover_text,
                      cps_hook:v.hook, cps_hero:v.hero, cps_ton:v.ton, cps_tempo:v.tempo, cps_cta:v.cta, cps_note:v.note,
                      cps_package:cpsPackage,
                      client_id:brief.client_id, client_user_id:brief.client_user_id,
                      status:'submitted', credit_cost:Math.ceil(totalCost/filled.length),
                    })
                  }
                  logClientActivity({ actionType: 'cps.package_selected', userName, clientName: companyName, clientId: brief.client_id, targetType: 'brief', targetId: id, targetLabel: brief.campaign_name, metadata: { package: cpsPackage, variations: filled.length } })
                  setCpsPackage(0);setCpsVariations([])
                  loadData()
                }}
                  className="btn btn-accent" style={{flex:2,padding:'12px'}}>
                  ONAYLA VE BAŞLAT
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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
              <button onClick={()=>setShowApproveModal(false)} style={{flex:1,padding:'12px',background:'#f5f4f0',color:'#555',border:'none',borderRadius:'10px',fontSize:'14px',cursor:'pointer',}}>Vazgeç</button>
              <button onClick={handleApprove} disabled={loading} style={{flex:1,padding:'12px',background:'#22c55e',color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:'500',cursor:'pointer',}}>
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
                            cursor:isDisabled?'not-allowed':'pointer',
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
                <button onClick={()=>setShowReorderModal(false)} style={{flex:1,padding:'12px',background:'#f5f4f0',color:'#555',border:'none',borderRadius:'10px',fontSize:'14px',cursor:'pointer',}}>Vazgeç</button>
                <button onClick={handleReorder} disabled={reordering || !canAfford}
                  style={{flex:1,padding:'12px',background:'#111113',color:'#fff',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:'500',cursor:'pointer',opacity:canAfford?1:0.4}}>
                  {reordering ? 'Oluşturuluyor...' : 'Onaylıyorum'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* REGENERATE CONFIRM MODAL */}
      {showRegenerateConfirm && (
        <div onClick={() => setShowRegenerateConfirm(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',backdropFilter:'blur(4px)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div onClick={e => e.stopPropagation()} style={{background:'#fff',border:'1px solid #0a0a0a',padding:'24px',maxWidth:'400px',width:'90%'}}>
            <div style={{fontSize:'15px',fontWeight:'500',color:'#0a0a0a',marginBottom:'8px'}}>Caption yeniden üretilsin mi?</div>
            <div style={{fontSize:'13px',color:'#888',marginBottom:'20px',lineHeight:'1.5'}}>Mevcut caption silinecek ve AI tarafından yeni bir caption üretilecek.</div>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={() => setShowRegenerateConfirm(false)} className="btn btn-outline" style={{padding:'8px 16px'}}>VAZGEÇ</button>
              <button onClick={() => { setShowRegenerateConfirm(false); generateCaption() }} className="btn" style={{padding:'8px 16px'}}>YENİDEN ÜRET</button>
            </div>
          </div>
        </div>
      )}

      {staticImageModal && (
        <StaticImageGeneratorModal
          briefId={staticImageModal.briefId}
          videoUrl={staticImageModal.videoUrl}
          existingUrl={staticImageModal.existingUrl}
          onClose={() => setStaticImageModal(null)}
          onGenerated={(url) => {
            setAiChildren(prev => prev.map(c => c.id === staticImageModal.briefId ? { ...c, static_images_url: url } : c))
            if (staticImageModal.briefId === id) setBrief((prev: any) => ({ ...prev, static_images_url: url }))
            logClientActivity({ actionType: 'static_images.generated', userName, clientName: companyName, clientId: brief?.client_id, targetType: 'brief', targetId: staticImageModal.briefId, targetLabel: brief?.campaign_name })
          }}
        />
      )}
      {/* AI EXPRESS INFO MODAL */}
      {expressInfoOpen && (
        <div onClick={()=>setExpressInfoOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#fff',border:'1px solid #0a0a0a',padding:'28px',maxWidth:'500px',width:'90%'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
              <span style={{fontSize:'14px',fontWeight:'500',letterSpacing:'1.5px',textTransform:'uppercase',color:'#0a0a0a'}}>AI Express Hakkında</span>
              <button onClick={()=>setExpressInfoOpen(false)} style={{width:'28px',height:'28px',border:'1px solid #e5e4db',background:'#fff',color:'#0a0a0a',fontSize:'14px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            <div style={{fontSize:'13px',color:'#555',lineHeight:1.7}}>AI Express ile yayına çıkmadan önce fikir geliştirin ve test edin. Deneysel bir özelliktir — sonuçlar garanti edilmez. Videolar tamamen brief'inizden yola çıkarak yapay zeka tarafından üretilmektedir. Fikir, görsel, ses ve müzik tamamen AI tarafından oluşturulur. Ekrandaki yazılar sosyal medyada native text olarak eklenmelidir. Dinamo sadece marka bilgileri ile AI prompt'larına müdahale eder.</div>
          </div>
        </div>
      )}

      {/* CPS INFO MODAL */}
      {cpsInfoOpen && (
        <div onClick={()=>setCpsInfoOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#fff',border:'1px solid #0a0a0a',padding:'28px',maxWidth:'500px',width:'90%'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
              <span style={{fontSize:'14px',fontWeight:'500',letterSpacing:'1.5px',textTransform:'uppercase',color:'#0a0a0a'}}>CPS Hakkında</span>
              <button onClick={()=>setCpsInfoOpen(false)} style={{width:'28px',height:'28px',border:'1px solid #e5e4db',background:'#fff',color:'#0a0a0a',fontSize:'14px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            <div style={{fontSize:'13px',color:'#555',lineHeight:1.7}}>Creative Performance System ile aynı brief'ten farklı yaratıcı yönler üretin. Hook'tan ton'a varyasyonları kontrol edin. Test edin, kazanan içeriği bulun. İsterseniz AI otomatik plan oluşturur, ekip üretir. Yapım süresi ilk varyasyon için 24 saat garantilidir, tamamlanması 48 saat sürebilir.</div>
          </div>
        </div>
      )}
    </div>
  )
}
