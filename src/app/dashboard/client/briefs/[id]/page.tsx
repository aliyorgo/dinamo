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
import { pauseOtherVideos } from '@/lib/video-playback'
import AIUGCTab from '@/components/AIUGCTab'
import AIAnimationTab from '@/components/AIAnimationTab'
import { downloadFile } from '@/lib/download-helper'
import { useCredits } from '@/lib/credits'
import { useClientContext } from '../../layout'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function formatDuration(start: string | null, end: string | null): string | null {
  if (!start || !end) return null
  const norm = (d: string) => d.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(d) ? d : d + 'Z'
  const seconds = Math.floor((new Date(norm(end)).getTime() - new Date(norm(start)).getTime()) / 1000)
  if (seconds <= 0) return null
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  if (min === 0) return `${sec} sn'de üretildi`
  if (sec === 0) return `${min} dk'da üretildi`
  return `${min} dk ${sec} sn'de üretildi`
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
const FALLBACK_COSTS: Record<string,number> = {'Bumper / Pre-roll':6,'Story / Reels':12,'Feed Video':20,'Long Form':30}
const VIDEO_TYPES = ['Bumper / Pre-roll','Story / Reels','Feed Video','Long Form']

export default function ClientBriefDetailWrapper() {
  return <Suspense><ClientBriefDetail /></Suspense>
}

function ClientBriefDetail() {
  const params = useParams()
  const router = useRouter()
  const { customizationTier } = useClientContext()
  const searchParams = useSearchParams()
  const id = params.id as string
  const { credits: creditSettings, flags: featureFlags } = useCredits()
  const baseCosts: Record<string,number> = creditSettings ? { 'Bumper / Pre-roll': creditSettings.credit_bumper, 'Story / Reels': creditSettings.credit_story, 'Feed Video': creditSettings.credit_feed, 'Long Form': creditSettings.credit_longform } : FALLBACK_COSTS
  const revisionCost = creditSettings?.credit_revision || 4
  const [brief, setBrief] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [answers, setAnswers] = useState<Record<string,string>>({})
  const [videos, setVideos] = useState<any[]>([])
  const [clientUser, setClientUser] = useState<any>(null)
  const [companyName, setCompanyName] = useState('')
  const [legalName, setLegalName] = useState('')
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
  const [expressHQ, setExpressHQ] = useState(false)
  const [expressInfoOpen, setExpressInfoOpen] = useState(false)
  const [cpsInfoOpen, setCpsInfoOpen] = useState(false)
  const [expressSettingsOpen, setExpressSettingsOpen] = useState(false)
  const [expressPanelLastMove, setExpressPanelLastMove] = useState(0)
  const expressPanelRef = useRef<HTMLDivElement>(null)
  const expressPanelBtnsRef = useRef<HTMLDivElement>(null)
  function toggleExpressInfo() { setExpressInfoOpen(p => !p); setExpressSettingsOpen(false) }
  function toggleExpressSettings() { setExpressSettingsOpen(p => !p); setExpressInfoOpen(false) }
  const [expressSettings, setExpressSettings] = useState<{ logo: boolean; cta: boolean; packshot: boolean }>({ logo: true, cta: false, packshot: false })
  const [clientPackshotUrl, setClientPackshotUrl] = useState('')
  const [settingsSaved, setSettingsSaved] = useState(false)
  function toggleExpressSetting(key: 'logo' | 'cta' | 'packshot') {
    setExpressSettings(prev => {
      const next = { ...prev, [key]: !prev[key] }
      if (key === 'packshot' && next.packshot) next.logo = false
      if (key === 'logo' && next.logo) next.packshot = false
      persistExpressSettings(next)
      return next
    })
  }
  async function persistExpressSettings(settings: any) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    await fetch('/api/client/ai-express-settings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ settings }) })
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 1500)
  }
  const [ugcVideosForSummary, setUgcVideosForSummary] = useState<any[]>([])
  const [ugcVideoCount, setUgcVideoCount] = useState(0)
  const [animationVideoCount, setAnimationVideoCount] = useState(0)
  const [animationVideosForSummary, setAnimationVideosForSummary] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'hybrid'|'cps'|'express'|'ugc'|'animation'|'summary'>(searchParams.get('tab') === 'express' ? 'express' : searchParams.get('tab') === 'ugc' ? 'ugc' : searchParams.get('tab') === 'animation' ? 'animation' : searchParams.get('tab') === 'cps' ? 'cps' : searchParams.get('tab') === 'summary' ? 'summary' : 'hybrid')

  // Onboarding: auto-open info modal on first visit per module
  useEffect(() => {
    const map: Record<string, () => void> = {
      express: () => setExpressInfoOpen(true),
      cps: () => setCpsInfoOpen(true),
    }
    const key = `dinamo_seen_intro_${activeTab}`
    if (map[activeTab] && !localStorage.getItem(key)) {
      map[activeTab]()
      localStorage.setItem(key, 'true')
    }
  }, [activeTab])

  // Express panels: outside click + 30s auto-close
  useEffect(() => {
    if (!expressInfoOpen && !expressSettingsOpen) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (expressPanelRef.current?.contains(t) || expressPanelBtnsRef.current?.contains(t)) return
      setExpressInfoOpen(false); setExpressSettingsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [expressInfoOpen, expressSettingsOpen])
  useEffect(() => {
    if (!expressInfoOpen && !expressSettingsOpen) return
    const timer = setTimeout(() => { setExpressInfoOpen(false); setExpressSettingsOpen(false) }, 30000)
    return () => clearTimeout(timer)
  }, [expressInfoOpen, expressSettingsOpen, expressPanelLastMove])

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
  const [voiceoverModalOpen, setVoiceoverModalOpen] = useState(false)
  const [voiceoverText, setVoiceoverText] = useState('')
  const [voiceoverSaving, setVoiceoverSaving] = useState(false)
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

  // Auto-scroll + autoplay for ai_child param (once only)
  const aiChildScrolledRef = useRef(false)
  useEffect(() => {
    if (aiChildScrolledRef.current || !aiChildParam || activeTab !== 'express' || aiChildren.length === 0) return
    const el = document.getElementById(`ai-child-${aiChildParam}`)
    if (el) {
      aiChildScrolledRef.current = true
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
    const { data: cu } = await supabase.from('client_users').select('*, clients(company_name, credit_balance, packshot_url, packshots, ai_express_settings, legal_name)').eq('user_id', user.id).single()
    setClientUser(cu)
    setCompanyName((cu as any)?.clients?.company_name || '')
    setLegalName((cu as any)?.clients?.legal_name || '')
    const { data: b } = await supabase.from('briefs').select('*, clients(ai_video_enabled, ugc_enabled)').eq('id', id).single()
    setBrief(b)
    // Aspect-aware packshot: ONLY check packshots JSONB for this brief's aspect (no legacy fallback in UI)
    const clientPackshots = (cu as any)?.clients?.packshots || {}
    const briefAspect = (b?.format || '9:16').replace(':', 'x')
    const pUrl = clientPackshots[briefAspect] || ''
    setClientPackshotUrl(pUrl)
    if (b?.caption) { setCaptionText(b.caption); setSavedCaption(b.caption) }
    // AI Express settings — client-level (brand settings, not per-brief)
    const storedSettings = (cu as any)?.clients?.ai_express_settings
    if (storedSettings && typeof storedSettings === 'object' && ('logo' in storedSettings || 'cta' in storedSettings || 'packshot' in storedSettings)) {
      setExpressSettings(storedSettings)
    } else {
      const defaults = { logo: !pUrl, cta: false, packshot: !!pUrl }
      setExpressSettings(defaults)
      persistExpressSettings(defaults)
    }
    const { data: q } = await supabase.from('brief_questions').select('*').eq('brief_id', id).order('asked_at')
    setQuestions(q || [])
    const { data: v } = await supabase.from('video_submissions').select('*').eq('brief_id', id).order('version', { ascending: true })
    setVideos(v || [])
    const revCount = (q || []).filter((x:any) => x.question.startsWith('REVİZYON:')).length
    setRevisionCount(revCount)
    // AI clones for this campaign (root_campaign_id based)
    const rootId = b?.root_campaign_id || b?.id
    const { data: aiKids } = await supabase.from('briefs')
      .select('id, campaign_name, status, format, ai_video_status, ai_video_url, ai_video_error, product_image_url, created_at, completed_at, ai_feedbacks, static_images_url, static_image_files, ai_express_viewed_at, ai_express_settings_snapshot, ai_feedback_summary, express_engine')
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
    // UGC videos for summary tab
    const { data: ugcVids } = await supabase.from('ugc_videos')
      .select('id, final_url, created_at, static_images_url, static_image_files, version, status, personas(name, slug)')
      .eq('brief_id', id)
      .eq('status', 'sold')
      .not('final_url', 'is', null)
      .order('created_at', { ascending: true })
    setUgcVideosForSummary(ugcVids || [])
    // Total UGC count for tab label
    const { count: ugcTotal } = await supabase.from('ugc_videos').select('id', { count: 'exact', head: true }).eq('brief_id', id).neq('status', 'failed')
    setUgcVideoCount(ugcTotal || 0)
    // Animation videos for summary
    const { data: animVids } = await supabase.from('animation_videos')
      .select('id, final_url, created_at, version, status, style_slug, animation_styles(label)')
      .eq('brief_id', id).eq('status', 'sold').not('final_url', 'is', null).order('created_at', { ascending: true })
    setAnimationVideosForSummary(animVids || [])
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
      const { data } = await supabase.from('briefs').select('id, status, format, ai_video_status, ai_video_url, ai_video_error, ai_feedback_summary, completed_at').in('id', allIds)
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
    if ((clientUser.allocated_credits || 0) < (creditSettings?.credit_ai_express || 1)) { setAiError('Yetersiz kredi'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const res = await fetch('/api/generate-ai-video/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ briefId: id, userId: user.id }),
    })
    const result = await res.json()
    if (result.error) { setAiError(result.error); return }
    setClientUser({ ...clientUser, allocated_credits: (clientUser.allocated_credits || 0) - (creditSettings?.credit_ai_express || 1) })
    setBrief((prev: any) => ({ ...prev, status: 'delivered' }))
    loadData()
  }

  async function handleAiDiscard() {
    await supabase.from('briefs').update({ status: 'ai_archived' }).eq('id', id)
    router.push('/dashboard/client')
  }

  async function handleStudioGenerate(mode: 'character' | 'product' = 'character') {
    if (!clientUser || !brief || aiGenerating) return
    setAiGenerating(true)
    setShowAiGenerate(false)
    setAiError('')
    try {
      const res = await fetch('/api/ai-express-seedance/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: id, client_user_id: clientUser.id, express_engine: expressHQ ? 'seedance_hq' : 'seedance' }) })
      const data = await res.json()
      if (!res.ok) { setAiError(data.error || 'Üretim başarısız'); setAiGenerating(false); return }
      if (data.child_brief) {
        setAiChildren(prev => [...prev, data.child_brief])
        setSelectedAiIdx(aiChildren.length)
        if (data.credit_charged > 0) setClientUser((prev: any) => ({ ...prev, allocated_credits: (prev.allocated_credits || 0) - data.credit_charged }))
        fetch('/api/generate-ai-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ briefId: data.child_brief.id }) })
        logClientActivity({ actionType: 'brief.submitted', userName, clientName: companyName, clientId: brief.client_id, targetType: 'brief', targetId: data.child_brief.id, targetLabel: data.child_brief.campaign_name, metadata: { type: 'ai_express', mode } })
      }
    } catch (err) { setAiError('Bağlantı hatası') }
    setAiGenerating(false)
  }

  async function handleStudioPurchase(childBrief: any) {
    if (!clientUser || !childBrief?.ai_video_url) return
    if ((clientUser.allocated_credits || 0) < (creditSettings?.credit_ai_express || 1)) { setAiError('Yetersiz kredi'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const res = await fetch('/api/generate-ai-video/purchase', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ briefId: childBrief.id, userId: user.id }),
    })
    const result = await res.json()
    if (result.error) { setAiError(result.error); return }
    setClientUser({ ...clientUser, allocated_credits: (clientUser.allocated_credits || 0) - (creditSettings?.credit_ai_express || 1) })
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
    if (brief) generateCertificatePDF(brief, companyName, legalName)
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
      if (clientUser.allocated_credits < revisionCost) { setMsg(`Yetersiz kredi. Bu revizyon için ${revisionCost} kredi gerekiyor.`); setLoading(false); return }
      await supabase.from('client_users').update({ credit_balance: clientUser.allocated_credits - revisionCost }).eq('id', clientUser.id)
      await supabase.from('credit_transactions').insert({ client_id: brief.client_id, client_user_id: clientUser.id, brief_id: id, amount: -revisionCost, type: 'deduct', description: `${brief.campaign_name} — ${revisionCount+1}. revizyon` })
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
    if (revisionNote.length > 20) fetch('/api/brand-learning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: brief.client_id, sourceType: 'revision', sourceId: id, text: revisionNote }) }).catch(e => console.warn('[brand-learning] extraction failed:', e))
    setRevisionNote('')
    setMsg(revisionCount === 0 ? 'Revizyon talebiniz gönderildi (ücretsiz).' : `Revizyon talebiniz gönderildi (${revisionCost} kredi düşüldü).`)
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
          <span style={{display:'inline-block',padding:'2px 8px',background:'rgba(29,184,29,0.15)',color:'#1db81d',fontSize:'9px',fontWeight:600,letterSpacing:'1px',marginBottom:'6px'}}>{customizationTier === 'corporate' ? 'KURUMSAL' : customizationTier === 'advanced' ? 'ADVANCED' : 'BASIC'}</span>
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
            <span style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:'rgba(255,255,255,0.4)'}}>Marka Ayarları</span>
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
            const hasSummary = aiChildren.length > 0 || cpsChildren.length > 0 || !!brief?.static_images_url || ugcVideosForSummary.length > 0
            const expressVisible = brief?.clients?.ai_video_enabled !== false && featureFlags.aiExpressGlobal
            const ugcVisible = brief?.clients?.ugc_enabled !== false && featureFlags.ugcGlobal
            const animationVisible = featureFlags.animationGlobal
            const tabs = [
              {key:'hybrid' as const, label:'Ana Video'},
              {key:'cps' as const, label:'CPS'},
              ...(expressVisible ? [{key:'express' as const, label:'AI Express'}] : []),
              ...(ugcVisible ? [{key:'ugc' as const, label:'AI Persona'}] : []),
              ...(animationVisible ? [{key:'animation' as const, label:'AI Animation'}] : []),
              ...(hasSummary ? [{key:'summary' as const, label:'Kampanya Özeti'}] : []),
            ]
            return tabs.map((t,ti)=>{
              const isActive = activeTab === t.key
              const isSummary = t.key === 'summary'
              return (
                <button key={t.key} onClick={()=>setActiveTab(t.key)}
                  style={{padding:'12px 24px',border:'none',borderBottom:isActive?(isSummary?'2px solid #f5a623':'2px solid #0a0a0a'):'2px solid transparent',borderRight:ti<tabs.length-1?'1px solid rgba(0,0,0,0.06)':'none',background:isActive?(isSummary?'rgba(245,166,35,0.06)':'#0a0a0a'):'#fff',color:isActive?(isSummary?'#0a0a0a':'#fff'):'#555',fontSize:'14px',fontWeight:isSummary?'400':'600',cursor:'pointer',transition:'all 0.15s'}}
                  onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background='#f5f5f5'}}
                  onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background='#fff'}}>
                  {t.label}
                  {t.key==='express' && <span style={{marginLeft:'4px',fontSize:'9px',padding:'1px 5px',background:'#1DB81D',color:'#fff',fontWeight:'600',verticalAlign:'middle'}}>Beta</span>}
                  {t.key==='ugc' && <span style={{marginLeft:'4px',fontSize:'9px',padding:'1px 5px',background:'#1DB81D',color:'#fff',fontWeight:'600',verticalAlign:'middle'}}>Beta</span>}
                  {t.key==='ugc' && ugcVideoCount > 0 && <span style={{marginLeft:'6px',fontSize:'10px',color:'#3b82f6',fontWeight:'600'}}>{ugcVideoCount}</span>}
                  {t.key==='express' && aiChildren.length > 0 && <span style={{marginLeft:'6px',fontSize:'10px',color:'#1DB81D',fontWeight:'600'}}>{aiChildren.filter(c=>c.ai_video_status!=='failed'&&c.ai_video_status!=='timeout').length}</span>}
                  {t.key==='cps' && cpsChildren.length > 0 && <span style={{marginLeft:'6px',fontSize:'10px',color:'#3b82f6',fontWeight:'600'}}>{cpsChildren.length}</span>}
                  {t.key==='animation' && <span style={{marginLeft:'4px',fontSize:'9px',padding:'1px 5px',background:'#f59e0b',color:'#fff',fontWeight:'600',verticalAlign:'middle'}}>Beta</span>}
                  {t.key==='animation' && animationVideoCount > 0 && <span style={{marginLeft:'6px',fontSize:'10px',color:'#8b5cf6',fontWeight:'600'}}>{animationVideoCount}</span>}
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
                  <div className="dot" style={{width:'24px',height:'24px',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',animation:'successPulse 0.5s ease'}}>✓</div>
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
                    <div className="dot" style={{width:'8px',height:'8px',background:'#22c55e'}}></div>
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
                            <video controls autoPlay onPlay={e=>pauseOtherVideos(e.currentTarget)} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',borderRadius:'12px'}}>
                              <source src={brief.ai_video_url} />
                            </video>
                          </div>
                        </div>
                      </div>
                      <div style={{width:'280px',flexShrink:0,position:'sticky',top:'24px'}}>
                        <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a',marginBottom:'6px'}}>AI Video Hazır</div>
                        <div style={{fontSize:'12px',color:'#888',marginBottom:'20px',lineHeight:1.6}}>Videoyu beğendiyseniz satın alabilirsiniz.</div>
                        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
                          <button onClick={handleAiPurchase} disabled={(clientUser?.allocated_credits||0)<(creditSettings?.credit_ai_express||1)} className="btn btn-accent" style={{padding:'12px 24px'}}>
                            SATIN AL
                          </button>
                          <span style={{fontSize:'13px',color:'#888'}}>{creditSettings?.credit_ai_express||1} kredi</span>
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
                  <div style={{position:'relative',overflow:'hidden',border:'1px solid #d4d2cc',marginBottom:'16px',background:'#ebe9e3',maxWidth:aspect.maxW,margin:briefFormat==='16:9'?'0 0 16px':'0 auto 16px',aspectRatio:briefFormat.replace(':','/')}}>
                    <video src="/videos/dinamo_static_progress.mp4" autoPlay muted loop playsInline style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',zIndex:0}} />
                    <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.35)',zIndex:1}} />
                    <div style={{position:'relative',zIndex:2,width:'100%',height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                      <img src="/dinamo_logo.png" alt="" style={{width:'154px',objectFit:'contain',display:'block',animation:'pulse 1.8s ease-in-out infinite'}} />
                      <div style={{fontSize:'13px',fontWeight:'500',letterSpacing:'0.1em',color:'#fff',marginTop:'2px',animation:'pulse 1.5s ease infinite'}}>ÇALIŞIYOR</div>
                      <div style={{fontSize:'11px',color:'rgba(255,255,255,0.6)',textAlign:'center',lineHeight:1.5,marginTop:'8px'}}>1-2 dakika sürebilir, hazır olunca otomatik görünecek</div>
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
                          onPlay={e=>pauseOtherVideos(e.currentTarget)}
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
                    <button onClick={()=>downloadFile(currentVideo.video_url, buildDownloadName())} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',padding:'10px',background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'10px',fontSize:'13px',color:'#0a0a0a',cursor:'pointer',marginBottom:'10px',transition:'border-color 0.2s',width:'100%'}}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4 8l4 4 4-4" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 13h12" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      Videoyu İndir
                    </button>

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
                              {revisionCount===0?'İlk revizyon ücretsiz':`${revisionCost} kredi`}
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
                            {brief.static_images_url && /\.(png|jpg|jpeg|webp)$/i.test(brief.static_images_url) ? (
                              <button onClick={()=>downloadFile(brief.static_images_url, `${slugify(brief.campaign_name)}_gorsel.png`)}
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
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',marginBottom:'16px',textAlign:'center',maxWidth:aspect.maxW,margin:briefFormat==='16:9'?'0 0 16px':'0 auto 16px',aspectRatio:briefFormat.replace(':','/'),display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                  <div className="dot" style={{width:'48px',height:'48px',background:'#f5f4f0',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'16px'}}>
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
                      <div style={{fontSize:'11px',color:'#888',fontWeight:'500',marginBottom:'4px'}}>{i+1}. revizyon{i===0?' (ücretsiz)':` (${revisionCost} kredi)`}</div>
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
                        <div className="dot" style={{width:'10px',height:'10px',background:s.done?'#22c55e':'rgba(0,0,0,0.08)',border:s.done?'none':'1.5px solid rgba(0,0,0,0.12)',flexShrink:0}}></div>
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

              {/* AI EXPRESS HEADER ROW: [info] ... [kredi] */}
              <div style={{display:'flex',flexWrap:'nowrap',alignItems:'center',marginBottom:'12px',gap:'8px'}}>
                <div ref={expressPanelBtnsRef} style={{display:'contents'}}>
                <button onClick={toggleExpressInfo} title="AI Express Hakkında"
                  onMouseEnter={e=>{e.currentTarget.style.background='#0a0a0a';e.currentTarget.style.color='#fff'}}
                  onMouseLeave={e=>{e.currentTarget.style.background='#f5f4f0';e.currentTarget.style.color='#888'}}
                  style={{display:'inline-flex',alignItems:'center',gap:'4px',padding:'4px 10px',background:'#f5f4f0',border:'none',fontSize:'11px',color:'#888',cursor:'pointer',transition:'all 0.15s',flexShrink:0}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  Bilgi
                </button>
                <button onClick={toggleExpressSettings} title="AI Express Ayarları"
                  onMouseEnter={e=>{e.currentTarget.style.background='#0a0a0a';e.currentTarget.style.color='#fff'}}
                  onMouseLeave={e=>{e.currentTarget.style.background='#f5f4f0';e.currentTarget.style.color='#888'}}
                  style={{display:'inline-flex',alignItems:'center',gap:'4px',padding:'4px 10px',background:'#f5f4f0',border:'none',fontSize:'11px',color:'#888',cursor:'pointer',transition:'all 0.15s',flexShrink:0}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
                  Ayarlar
                </button>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'6px',marginLeft:'8px'}} title="720p daha keskin, üretim biraz daha uzun sürer">
                  <span style={{fontSize:'10px',color:'#888'}}>720p</span>
                  <button onClick={()=>setExpressHQ(!expressHQ)} style={{width:'36px',height:'20px',border:'none',cursor:'pointer',background:expressHQ?'#22c55e':'#ddd',position:'relative',transition:'background 0.2s',flexShrink:0}}>
                    <span className="dot" style={{position:'absolute',top:'2px',left:expressHQ?'18px':'2px',width:'16px',height:'16px',background:'#fff',transition:'left 0.2s'}} />
                  </button>
                </div>
                <div style={{flex:1}} />
                {(() => { const total = aiChildren.length + aiChildren.filter(c => c.status === 'delivered').length * 2; return <div style={{display:'inline-flex',padding:'6px 14px',border:'1px solid #0a0a0a',fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:total > 0 ? '#0a0a0a' : '#9ca3af',flexShrink:0,whiteSpace:'nowrap'}}>{total} KREDİ</div> })()}
              </div>

              <div ref={expressPanelRef} onMouseMove={()=>setExpressPanelLastMove(Date.now())}>
              {/* AI Express Info Collapse */}
              {expressInfoOpen && (
                <div style={{background:'#f9f7f3',border:'1px solid #e5e4db',padding:'20px',marginBottom:'16px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                    <div style={{fontSize:'14px',fontWeight:'600',color:'#0a0a0a'}}>AI Express Hakkında</div>
                    <button onClick={()=>setExpressInfoOpen(false)} style={{width:'24px',height:'24px',border:'none',background:'none',cursor:'pointer',fontSize:'16px',color:'#888',display:'flex',alignItems:'center',justifyContent:'center'}} onMouseEnter={e=>{e.currentTarget.style.color='#0a0a0a'}} onMouseLeave={e=>{e.currentTarget.style.color='#888'}}>×</button>
                  </div>
                  <div style={{fontSize:'13px',color:'#333',lineHeight:1.6}}>
                    <p style={{margin:'0 0 12px'}}>AI Express ile briefinize göre AI ile sahnelenen kısa videolar üretin. Deneysel bir özelliktir — sonuçlar garanti edilmez.</p>
                    <p style={{margin:'0 0 12px'}}>Videolar tamamen brief'inizden yola çıkarak yapay zeka tarafından üretilmektedir. Fikir, görsel, ses ve müzik tamamen AI tarafından oluşturulur. Ekrandaki yazılar sosyal medyada native text olarak eklenmelidir.</p>
                    <p style={{margin:'0 0 12px'}}>Dinamo sadece marka bilgileri ile AI prompt'larına müdahale eder.</p>
                    <p style={{margin:0}}>Şu anda test edebilmeniz için AI Express videoları 10 saniye ile sınırlıdır.</p>
                  </div>
                </div>
              )}

              {/* AI Express Settings Panel */}
              {expressSettingsOpen && (
                <div style={{background:'#f9f7f3',border:'1px solid #e5e4db',padding:'20px',marginBottom:'16px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
                    <div style={{fontSize:'14px',fontWeight:'600',color:'#0a0a0a'}}>AI Express Ayarları{settingsSaved && <span style={{fontSize:'11px',color:'#22c55e',marginLeft:'12px',fontWeight:'500'}}>✓ Kaydedildi</span>}</div>
                    <button onClick={()=>setExpressSettingsOpen(false)} style={{width:'24px',height:'24px',border:'none',background:'none',cursor:'pointer',fontSize:'16px',color:'#888',display:'flex',alignItems:'center',justifyContent:'center'}} onMouseEnter={e=>{e.currentTarget.style.color='#0a0a0a'}} onMouseLeave={e=>{e.currentTarget.style.color='#888'}}>×</button>
                  </div>
                  {/* Logo toggle */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #e5e4db'}}>
                    <div><div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>Logo</div><div style={{fontSize:'11px',color:'#888'}}>Video sonunda marka logosu göster</div></div>
                    <button onClick={()=>toggleExpressSetting('logo')}
                      style={{width:'36px',height:'20px',border:'none',cursor:'pointer',background:expressSettings.logo?'#22c55e':'#ddd',position:'relative',transition:'background 0.2s',flexShrink:0}}>
                      <span className="dot" style={{position:'absolute',top:'2px',left:expressSettings.logo?'18px':'2px',width:'16px',height:'16px',background:'#fff',transition:'left 0.2s'}} />
                    </button>
                  </div>
                  {/* CTA toggle */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #e5e4db'}}>
                    <div><div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>CTA</div><div style={{fontSize:'11px',color:'#888'}}>Video sonunda CTA yazısı göster</div></div>
                    <button onClick={()=>toggleExpressSetting('cta')}
                      style={{width:'36px',height:'20px',border:'none',cursor:'pointer',background:expressSettings.cta?'#22c55e':'#ddd',position:'relative',transition:'background 0.2s',flexShrink:0}}>
                      <span className="dot" style={{position:'absolute',top:'2px',left:expressSettings.cta?'18px':'2px',width:'16px',height:'16px',background:'#fff',transition:'left 0.2s'}} />
                    </button>
                  </div>
                  {/* Packshot toggle — global setting, untouched */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0'}}>
                    <div><div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>Packshot</div><div style={{fontSize:'11px',color:'#888'}}>Video sonuna packshot ekle</div></div>
                    <button onClick={()=>toggleExpressSetting('packshot')}
                      style={{width:'36px',height:'20px',border:'none',cursor:'pointer',background:expressSettings.packshot?'#22c55e':'#ddd',position:'relative',transition:'background 0.2s',flexShrink:0}}>
                      <span className="dot" style={{position:'absolute',top:'2px',left:expressSettings.packshot?'18px':'2px',width:'16px',height:'16px',background:'#fff',transition:'left 0.2s'}} />
                    </button>
                  </div>
                  {/* Aspect-aware packshot info banner */}
                  {expressSettings.packshot && !clientPackshotUrl && (
                    <div style={{fontSize:'11px',color:'#92400e',background:'#fffbeb',border:'1px solid #fde68a',padding:'8px 12px',marginTop:'-4px',marginBottom:'4px',lineHeight:1.5}}>
                      {brief?.format || '9:16'} boyutu için packshot yüklü değil — bu üretimde packshot kullanılmayacak. Yüklemek için iletişime geçin.
                    </div>
                  )}
                </div>
              )}

              </div>

              {/* AI VIDEO STUDIO */}
              {brief && brief.status !== 'cancelled' && brief.status !== 'draft' && (
                <div style={{background:'#fff',border:'1px solid var(--color-border-tertiary)',padding:'20px 24px',marginBottom:'16px'}}>

                  {/* Version list */}
                  {aiChildren.map((child, idx) => {
                    const hasVideo = !!child.ai_video_url
                    const isPurchased = child.status === 'delivered'
                    const isFailed = !isPurchased && (child.ai_video_status === 'failed' || child.ai_video_status === 'timeout')
                    const isProcessing = child.status === 'ai_processing' && !hasVideo && !isFailed
                    return (
                      <div key={child.id} id={`ai-child-${child.id}`} style={{display:'flex',gap:'14px',padding:'14px',marginBottom:'8px',border:'1px solid var(--color-border-tertiary)',background:'#fff',alignItems:'flex-start',transition:'background 0.15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.background='var(--color-background-secondary)'}}
                        onMouseLeave={e=>{e.currentTarget.style.background='#fff'}}>
                        {/* Video player */}
                        <div style={{width:((f)=>f==='16:9'?'360px':f==='1:1'?'300px':f==='4:5'?'240px':'200px')(child.format||briefFormat||'9:16'),aspectRatio:(child.format||'9:16').replace(':','/'),background:'#0a0a0a',flexShrink:0,position:'relative',overflow:'hidden'}}>
                          {hasVideo ? (
                            <>
                              <video key={child.ai_video_url} src={child.ai_video_url} controls preload="metadata"
                                onPlay={e => { pauseOtherVideos(e.currentTarget); markAiChildViewed(child.id) }}
                                style={{width:'100%',height:'100%',objectFit:'contain',backgroundColor:'black'}} />
                              {!isPurchased && <img src="/dinamo_logo.png" alt="" style={{position:'absolute',top:'14px',left:'14px',width:'60px',opacity:0.65,pointerEvents:'none'}} />}
                            </>
                          ) : isProcessing ? (
                            <div style={{width:'100%',height:'100%',position:'relative',overflow:'hidden',background:'#ebe9e3'}}>
                              <video src="/videos/dinamo_static_progress.mp4" autoPlay muted loop playsInline style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',zIndex:0}} />
                              <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.35)',zIndex:1}} />
                              <div style={{position:'relative',zIndex:2,width:'100%',height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                                <img src="/dinamo_logo.png" alt="" style={{width:'115px',objectFit:'contain',display:'block',animation:'pulse 1.8s ease-in-out infinite'}} />
                                <div style={{fontSize:'10px',fontWeight:'500',letterSpacing:'0.1em',color:'#fff',marginTop:'2px',animation:'pulse 1.5s ease infinite'}}>ÇALIŞIYOR</div>
                              </div>
                            </div>
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
                            {isProcessing && <span style={{fontSize:'9px',fontWeight:'500',display:'inline-flex',alignItems:'center',gap:'4px'}}><span className="dot" style={{width:'6px',height:'6px',background:'#4ade80',display:'inline-block',animation:'pulse 1.5s ease infinite'}}></span><span style={{color:'#0a0a0a'}}>Üretiliyor</span> <span style={{color:'#6b6b66'}}>(~5 dakika)</span></span>}
                            {isFailed && <span style={{fontSize:'9px',color:'#ef4444',fontWeight:'500'}}>Başarısız</span>}
                            {child.ai_express_settings_snapshot && (() => { const s = child.ai_express_settings_snapshot; const badges = []; if (s.logo) badges.push('LOGO'); if (s.cta) badges.push('CTA'); if (s.packshot) badges.push('PACKSHOT'); return badges.length > 0 ? <span style={{display:'inline-flex',gap:'4px',marginLeft:'6px'}}>{badges.map((b: string)=><span key={b} style={{fontSize:'9px',padding:'2px 6px',background:'#f5f4f0',color:'#888',letterSpacing:'0.5px',fontWeight:600}}>{b}</span>)}</span> : null })()}
                          </div>
                          <div style={{fontSize:'11px',color:'#888',marginBottom:'10px'}}>{new Date(child.created_at).toLocaleDateString('tr-TR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}{child.completed_at && <><span style={{margin:'0 8px',color:'#ccc'}}>|</span><span style={{color:'#aaa'}}>{formatDuration(child.created_at, child.completed_at)}</span></>}</div>
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
                            </div>
                          )}
                          {hasVideo && !isFailed && (
                            <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                              {isPurchased ? (
                                <>
                                  <button onClick={()=>downloadFile(child.ai_video_url, `dinamo_${slugify(companyName)}_ai-express_v${idx+1}.mp4`)}
                                    style={{fontSize:'11px',color:'#0a0a0a',background:'none',border:'0.5px solid rgba(0,0,0,0.15)',borderRadius:'6px',padding:'5px 12px',display:'inline-flex',alignItems:'center',gap:'4px',cursor:'pointer'}}>
                                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4 8l4 4 4-4" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/><path d="M2 13h12" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                    İndir
                                  </button>
                                  <button onClick={()=>generateCertificatePDF(brief, companyName, legalName)}
                                    style={{fontSize:'11px',color:'#555',background:'none',border:'0.5px solid rgba(0,0,0,0.12)',borderRadius:'6px',padding:'5px 12px',cursor:'pointer',}}>
                                    Telif Belgesi
                                  </button>
                                  {child.static_images_url && /\.(png|jpg|jpeg|webp)$/i.test(child.static_images_url) ? (
                                    <button onClick={()=>downloadFile(child.static_images_url, `gorsel_v${idx+1}.png`)}
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
                                  <button onClick={()=>handleStudioPurchase(child)} disabled={(clientUser?.allocated_credits||0)<(creditSettings?.credit_ai_express||1)} className="btn btn-accent" style={{padding:'6px 16px'}}>
                                    SATIN AL
                                  </button>
                                  <span style={{fontSize:'13px',color:'#888'}}>{creditSettings?.credit_ai_express||1} kredi</span>
                                </>
                              )}
                            </div>
                          )}
                          {/* Feedback summary */}
                          {child.ai_feedback_summary && (
                            <div style={{fontFamily:"'JetBrains Mono','Menlo','Monaco',monospace",fontSize:'11px',color:'#3a3a3a',borderLeft:'2px solid #d4d2cc',paddingLeft:'18px',paddingTop:'8px',paddingBottom:'8px',marginBottom:'8px',marginTop:'8px',lineHeight:'1.6',letterSpacing:'-0.01em'}}>
                              {child.ai_feedback_summary}<span style={{display:'inline-block',marginLeft:'2px',color:'#6b6b66',animation:'blink 1s steps(1) infinite'}}>▊</span>
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
                                      placeholder="Yorum / revizyon yazın, bir sonraki üretiminiz daha iyi olsun."
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
                                      if(val.length>20) fetch('/api/brand-learning',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:brief?.client_id,sourceType:'feedback',sourceId:child.id,text:val})}).catch(e=>console.warn('[brand-learning] extraction failed:',e))
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
                        <div style={{display:'flex',gap:'8px'}}>
                          <button onClick={()=>handleStudioGenerate('character')} disabled={(clientUser?.allocated_credits||0)<1}
                            style={{flex:1,padding:'14px',background:(clientUser?.allocated_credits||0)<1?'#ccc':'#0a0a0a',color:'#fff',border:'none',borderRadius:'2px',fontSize:'13px',fontWeight:'600',cursor:(clientUser?.allocated_credits||0)<1?'default':'pointer',transition:'background 0.15s',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}
                            onMouseEnter={e=>{if((clientUser?.allocated_credits||0)>=1)e.currentTarget.style.background='#1DB81D'}}
                            onMouseLeave={e=>{if((clientUser?.allocated_credits||0)>=1)e.currentTarget.style.background='#0a0a0a'}}>
                            {(() => { const cc = aiChildren.filter(c => c.ai_video_status !== 'failed' && c.ai_video_status !== 'timeout' && c.ai_video_status !== null).length; return cc === 0 ? 'ÜRET (ÜCRETSİZ)' : `Yeni Versiyon Üret (${creditSettings?.credit_ai_express_generate || 1} KREDİ)` })()}
                          </button>
                          <button onClick={()=>{setVoiceoverText(brief?.voiceover_text||'');setVoiceoverModalOpen(true)}}
                            style={{width:'90px',padding:'14px 0',background:'#fff',color:'#3a3a3a',border:'1px solid #d4d2cc',borderRadius:'2px',fontSize:'12px',fontWeight:'500',cursor:'pointer',transition:'background 0.15s'}}
                            onMouseEnter={e=>{e.currentTarget.style.background='#fafaf7'}}
                            onMouseLeave={e=>{e.currentTarget.style.background='#fff'}}>
                            Dış Ses
                          </button>
                        </div>
                        <div style={{fontSize:'13px',color:'#999',textAlign:'center',marginTop:'6px'}}>{aiChildren.filter(c => c.ai_video_status === 'completed' || c.status === 'delivered').length > 0 ? `~5 dakika · ${creditSettings?.credit_ai_express_generate || 1} kredi` : `~5 dakika · İlk deneme ücretsiz · ${creditSettings?.credit_ai_express || 1} kredi satın alma`}</div>
                      </div>
                    )}
                  </div>}
                </div>
              )}

              </>}

              {/* ═══ CPS TAB ═══ */}
              {activeTab === 'cps' && <>
                {/* CPS HEADER ROW: [info] ... [kredi] */}
                <div style={{display:'flex',flexWrap:'nowrap',alignItems:'center',marginBottom:'12px',gap:'8px'}}>
                  <button onClick={()=>setCpsInfoOpen(!cpsInfoOpen)} title="CPS Hakkında"
                    onMouseEnter={e=>{e.currentTarget.style.background='#0a0a0a';e.currentTarget.style.color='#fff'}}
                    onMouseLeave={e=>{e.currentTarget.style.background='#f5f4f0';e.currentTarget.style.color='#888'}}
                    style={{display:'inline-flex',alignItems:'center',gap:'4px',padding:'4px 10px',background:'#f5f4f0',border:'none',fontSize:'11px',color:'#888',cursor:'pointer',transition:'all 0.15s',flexShrink:0}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    Bilgi
                  </button>
                  <div style={{flex:1}} />
                  {(() => { const total = cpsChildren.reduce((s: number, c: any) => s + (c.credit_cost || 0), 0); return <div style={{display:'inline-flex',padding:'6px 14px',border:'1px solid #0a0a0a',fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:total > 0 ? '#0a0a0a' : '#9ca3af',flexShrink:0,whiteSpace:'nowrap'}}>{total} KREDİ</div> })()}
                </div>

                {/* CPS Info Collapse */}
                {cpsInfoOpen && (
                  <div style={{background:'#f9f7f3',border:'1px solid #e5e4db',padding:'20px',marginBottom:'16px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                      <div style={{fontSize:'14px',fontWeight:'600',color:'#0a0a0a'}}>CPS Hakkında</div>
                      <button onClick={()=>setCpsInfoOpen(false)} style={{width:'24px',height:'24px',border:'none',background:'none',cursor:'pointer',fontSize:'16px',color:'#888',display:'flex',alignItems:'center',justifyContent:'center'}} onMouseEnter={e=>{e.currentTarget.style.color='#0a0a0a'}} onMouseLeave={e=>{e.currentTarget.style.color='#888'}}>×</button>
                    </div>
                    <div style={{fontSize:'13px',color:'#333',lineHeight:1.6}}>
                      <p style={{margin:'0 0 12px'}}>Creative Performance System ile aynı brief'ten farklı yaratıcı yönler üretin.</p>
                      <p style={{margin:'0 0 12px'}}>Hook'tan ton'a varyasyonları kontrol edin. Test edin, kazanan içeriği bulun. İsterseniz AI otomatik plan oluşturur, ekip üretir.</p>
                      <p style={{margin:0}}>Yapım süresi ilk varyasyon için 24 saat garantilidir, tamamlanması 48 saat sürebilir.</p>
                    </div>
                  </div>
                )}

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
                                  <video src={childVideo.video_url} controls playsInline preload="metadata" onPlay={e=>pauseOtherVideos(e.currentTarget)} style={{width:'100%',height:'100%',objectFit:'contain',background:'black'}} />
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
                                <button onClick={()=>generateCertificatePDF(brief, companyName, legalName)} className="btn btn-outline" style={{padding:'7px 10px',fontSize:'10px'}}>TELİF</button>
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
                      <video src={currentVideo.video_url} controls playsInline preload="metadata" onPlay={e=>pauseOtherVideos(e.currentTarget)} style={{width:'100%',borderRadius:'8px',objectFit:'contain',background:'black'}} />
                    </div>
                  </div>
                )}

              </>}

              {/* ═══ UGC TAB ═══ */}
              {activeTab === 'ugc' && brief && (
                <AIUGCTab briefId={id} brief={brief} clientUser={clientUser} autoPlayVideoId={searchParams.get('video') || undefined} onVideoCountChange={(count) => setUgcVideoCount(count)} />
              )}

              {activeTab === 'animation' && brief && (
                <AIAnimationTab briefId={id} brief={brief} clientUser={clientUser} onVideoCountChange={(count) => setAnimationVideoCount(count)} />
              )}

              {/* ═══ SUMMARY TAB ═══ */}
              {activeTab === 'summary' && brief && (
                <CampaignSummaryTab brief={brief} companyName={companyName} videos={videos} aiChildren={aiChildren} cpsChildren={cpsChildren} ugcVideos={ugcVideosForSummary} animationVideos={animationVideosForSummary} onRefresh={loadData}
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
            <div className="dot" style={{width:'48px',height:'48px',background:'rgba(34,197,94,0.1)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
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

      {voiceoverModalOpen && (
        <div onClick={()=>setVoiceoverModalOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',backdropFilter:'blur(4px)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#fff',border:'1px solid #0a0a0a',padding:'24px',maxWidth:'480px',width:'90%'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
              <div style={{fontSize:'15px',fontWeight:'500',color:'#0a0a0a'}}>Dış Ses Metni</div>
              {(() => { const wc = voiceoverText.trim().split(/\s+/).filter(Boolean).length; return <span style={{fontSize:'12px',color:wc>15?'#ef4444':wc===15?'#16a34a':wc>=13?'#f59e0b':'#888'}}>{wc} / 15 kelime</span> })()}
            </div>
            <textarea value={voiceoverText} onChange={e=>setVoiceoverText(e.target.value)} rows={4} style={{width:'100%',padding:'12px',border:'1px solid #e5e4db',fontSize:'13px',color:'#0a0a0a',resize:'vertical',boxSizing:'border-box',lineHeight:1.6}} />
            <div style={{fontSize:'11px',color:'#888',fontStyle:'italic',marginTop:'8px',marginBottom:'16px'}}>En fazla 15 kelime. 10 saniyelik videoya sığacak şekilde. Mevcut videolar etkilenmez.</div>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>setVoiceoverModalOpen(false)} className="btn btn-outline" style={{padding:'8px 16px'}}>İPTAL</button>
              <button disabled={voiceoverSaving || voiceoverText.trim().length===0 || voiceoverText===brief?.voiceover_text || voiceoverText.trim().split(/\s+/).filter(Boolean).length>15} onClick={async()=>{
                setVoiceoverSaving(true)
                try {
                  const res = await fetch(`/api/briefs/${id}/voiceover-text`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({voiceover_text:voiceoverText})})
                  if(res.ok){ setBrief((prev:any)=>({...prev,voiceover_text:voiceoverText})); setVoiceoverModalOpen(false) }
                } catch{}
                setVoiceoverSaving(false)
              }} className="btn" style={{padding:'8px 16px'}}>{voiceoverSaving?'KAYDEDİLİYOR...':'KAYDET'}</button>
            </div>
          </div>
        </div>
      )}

      {staticImageModal && (
        <StaticImageGeneratorModal
          briefId={staticImageModal.briefId}
          videoUrl={staticImageModal.videoUrl}
          existingUrl={staticImageModal.existingUrl}
          fileName={`${(brief?.campaign_name || 'brief').replace(/\s+/g, '_').toLowerCase()}_gorsel.png`}
          onClose={() => setStaticImageModal(null)}
          onGenerated={(url) => {
            setAiChildren(prev => prev.map(c => c.id === staticImageModal.briefId ? { ...c, static_images_url: url } : c))
            if (staticImageModal.briefId === id) setBrief((prev: any) => ({ ...prev, static_images_url: url }))
            logClientActivity({ actionType: 'static_images.generated', userName, clientName: companyName, clientId: brief?.client_id, targetType: 'brief', targetId: staticImageModal.briefId, targetLabel: brief?.campaign_name })
          }}
        />
      )}
      {/* AI EXPRESS INFO MODAL */}

      {/* CPS INFO MODAL */}
    </div>
  )
}
