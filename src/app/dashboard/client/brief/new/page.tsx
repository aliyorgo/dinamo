'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'
import { logClientActivity } from '@/lib/log-client'
import { cleanVoiceName } from '@/lib/voice-utils'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const VIDEO_TYPES = ['Bumper / Pre-roll','Story / Reels','Feed Video','Long Form']
const VIDEO_DURATIONS: Record<string,string> = {'Bumper / Pre-roll':'6 saniye','Story / Reels':'15 saniye','Feed Video':'30 saniye','Long Form':'60 saniye'}
const FORMATS: {ratio:string,w:number,h:number}[] = [
  {ratio:'9:16',w:27,h:48},{ratio:'16:9',w:48,h:27},{ratio:'1:1',w:36,h:36},{ratio:'4:5',w:32,h:40},{ratio:'2:3',w:28,h:42}
]
const BASE_COSTS: Record<string,number> = {'Bumper / Pre-roll':12,'Story / Reels':18,'Feed Video':24,'Long Form':36}
const REVISION_COST = 4

export default function NewBriefPageWrapper() {
  return <Suspense><NewBriefPage /></Suspense>
}

function NewBriefPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(0)
  const [clientUser, setClientUser] = useState<any>(null)
  const [companyName, setCompanyName] = useState('')
  const [userName, setUserName] = useState('')
  const [settings, setSettings] = useState<Record<string,string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiBriefInput, setAiBriefInput] = useState('')
  const [aiBriefLoading, setAiBriefLoading] = useState(false)
  const [editBriefId, setEditBriefId] = useState<string|null>(null)
  const [savedBriefId, setSavedBriefId] = useState<string|null>(null)
  const [savedIdea, setSavedIdea] = useState<{title:string,description:string}|null>(null)
  const [isDraftEdit, setIsDraftEdit] = useState(false)
  const [briefScore, setBriefScore] = useState<any>(null)
  const [scoreLoading, setScoreLoading] = useState(false)
  const [expandLoading, setExpandLoading] = useState(false)
  const [prevMessage, setPrevMessage] = useState<string|null>(null)
  const filesRef = useRef<HTMLInputElement>(null)
  const productImageRef = useRef<HTMLInputElement>(null)
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null)
  const [productUploading, setProductUploading] = useState(false)
  const [showProductUpload, setShowProductUpload] = useState(false)
  const [refLinkInput, setRefLinkInput] = useState('')
  const [brandFiles, setBrandFiles] = useState<{name:string}[]>([])
  const [brandVoices, setBrandVoices] = useState<any>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewTextSnapshot, setPreviewTextSnapshot] = useState('')
  const [previewCount, setPreviewCount] = useState(0)
  const [previewLimitHit, setPreviewLimitHit] = useState(false)
  const [previewVoiceName, setPreviewVoiceName] = useState('')

  const [form, setForm] = useState({
    campaign_name: '',
    video_type: '',
    format: '',
    platforms: [] as string[],
    target_audience: '',
    has_cta: '',
    cta: '',
    message: '',
    voiceover_type: 'none',
    voiceover_gender: '' as '' | 'male' | 'female',
    voiceover_text: '',
    notes: '',
    extra_topic: '',
    languages: [] as string[],
    reference_links: [] as string[],
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name').eq('id', user.id).single()
      setUserName(userData?.name || '')
      const { data: cu } = await supabase.from('client_users').select('*, clients(company_name, credit_balance, ai_video_enabled, brand_voices)').eq('user_id', user.id).single()
      setClientUser(cu)
      setCompanyName((cu as any)?.clients?.company_name || '')
      setBrandVoices((cu as any)?.clients?.brand_voices || null)
      const { data: s } = await supabase.from('admin_settings').select('*')
      const map: Record<string,string> = {}
      s?.forEach((x:any) => map[x.key] = x.value)
      setSettings(map)
    }
    load()
  }, [router])

  // Handle URL params: AI mode or Edit mode
  useEffect(() => {
    if (searchParams.get('ai') === '1') {
      const prompt = searchParams.get('prompt') || ''
      setAiBriefInput(prompt)
      setStep(-1)
    }
    const editId = searchParams.get('edit')
    const draftId = searchParams.get('draft')
    const loadId = editId || draftId
    if (loadId) {
      setEditBriefId(loadId)
      if (draftId) setIsDraftEdit(true)
      supabase.from('briefs').select('*').eq('id', loadId).single().then(({ data: b }) => {
        if (b) {
          setForm({
            campaign_name: b.campaign_name || '',
            video_type: b.video_type || '',
            format: b.format || '',
            platforms: b.platforms || [],
            target_audience: b.target_audience || '',
            has_cta: b.cta ? 'yes' : 'no',
            cta: b.cta || '',
            message: b.message || '',
            voiceover_type: b.voiceover_type || 'none',
            voiceover_gender: b.voiceover_gender || '',
            voiceover_text: b.voiceover_text || '',
            notes: b.notes || '',
            extra_topic: '',
            languages: b.languages || [],
            reference_links: b.reference_links || [],
          })
          setStep(1)
        }
      })
    }
  }, [searchParams])

  // Fetch brief score when entering step 6
  useEffect(() => {
    if (step !== 6) { setBriefScore(null); return }
    if (scoreLoading) return
    setScoreLoading(true)
    fetch('/api/brief-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief: form })
    }).then(r => r.json()).then(data => {
      if (data.score) setBriefScore(data)
    }).catch(() => {}).finally(() => setScoreLoading(false))
  }, [step])

  async function handleExpand() {
    if (!form.message.trim() || expandLoading) return
    setExpandLoading(true)
    setPrevMessage(form.message)
    try {
      const res = await fetch('/api/generate-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_input: `Aşağıdaki brief metnini koru ama genişlet. Eksik detayları tamamla, hedef kitle, beklenti ve mecra bilgilerini daha net hale getir. Aynı tonda kal, pazarlama yöneticisi sesi. Sadece message alanını dön, diğer alanları olduğu gibi bırak.\n\nMevcut brief metni:\n${form.message}\n\nKampanya: ${form.campaign_name}\nVideo Tipi: ${form.video_type}\nHedef Kitle: ${form.target_audience}\nCTA: ${form.cta || 'Yok'}`,
          brand_name: companyName,
        })
      })
      const data = await res.json()
      if (data.message) setForm(prev => ({ ...prev, message: data.message }))
    } catch {}
    setExpandLoading(false)
  }

  function handleUndoExpand() {
    if (prevMessage !== null) {
      setForm(prev => ({ ...prev, message: prevMessage }))
      setPrevMessage(null)
    }
  }

  async function handleProductImageUpload() {
    const file = productImageRef.current?.files?.[0]
    if (!file || !clientUser) return
    if (file.size > 10 * 1024 * 1024) { alert('Dosya 10MB\'dan küçük olmalı'); return }
    setProductUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const storagePath = `product-images/${clientUser.client_id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('brand-assets').upload(storagePath, file, { upsert: true })
    if (upErr) { alert('Yükleme hatası: ' + upErr.message); setProductUploading(false); return }
    const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(storagePath)
    setProductImageUrl(urlData.publicUrl)
    setProductUploading(false)
  }

  function calcCost() {
    let cost = BASE_COSTS[form.video_type] || 0
    if (form.voiceover_type === 'real') cost += parseInt(settings['credit_voiceover_real'] || '6')
    cost += form.languages.length * 2
    return cost
  }

  async function generateVoiceover() {
    if (!form.message && !form.campaign_name) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/generate-voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: companyName,
          campaign_name: form.campaign_name,
          message: form.message,
          cta: form.cta,
          target_audience: form.target_audience,
          video_type: form.video_type,
        })
      })
      const data = await res.json()
      if (data.text) setForm(prev => ({...prev, voiceover_text: data.text}))
    } catch {}
    setAiLoading(false)
  }

  async function previewVoiceover() {
    const briefId = savedBriefId || editBriefId
    if (!briefId || !form.voiceover_text.trim()) return
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/briefs/${briefId}/preview-voiceover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: form.voiceover_text }),
      })
      if (res.status === 429) { setPreviewLimitHit(true); setPreviewLoading(false); return }
      const data = await res.json()
      if (data.url) {
        setPreviewUrl(data.url)
        setPreviewTextSnapshot(form.voiceover_text)
        setPreviewCount(data.count || 0)
        if (data.voice_name) setPreviewVoiceName(data.voice_name)
      }
    } catch {}
    setPreviewLoading(false)
  }

  const brandVoiceForGender = brandVoices?.[form.voiceover_gender || 'female'] || null
  const previewTextChanged = previewUrl && form.voiceover_text !== previewTextSnapshot

  async function handleAiBrief() {
    if (!aiBriefInput.trim()) return
    setAiBriefLoading(true)
    try {
      const res = await fetch('/api/generate-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_input: aiBriefInput, brand_name: companyName })
      })
      const data = await res.json()
      if (data.error) { setAiBriefLoading(false); return }
      setForm(prev => ({
        ...prev,
        campaign_name: data.campaign_name || prev.campaign_name,
        video_type: VIDEO_TYPES.includes(data.video_type) ? data.video_type : prev.video_type,
        format: data.format || prev.format,
        target_audience: data.target_audience || prev.target_audience,
        has_cta: data.has_cta || prev.has_cta,
        cta: data.cta || prev.cta,
        message: data.message || prev.message,
        voiceover_type: data.voiceover_type || prev.voiceover_type,
        voiceover_gender: data.voiceover_gender || prev.voiceover_gender,
        voiceover_text: data.voiceover_text || prev.voiceover_text,
        notes: data.notes || prev.notes,
      }))
      setStep(1)
    } catch {}
    setAiBriefLoading(false)
  }

  async function handleSubmit(asDraft = false) {
    if (!clientUser) return
    const cost = calcCost()
    if (!asDraft && clientUser.allocated_credits < cost) return
    setSubmitting(true)
    const noteParts = [form.notes, form.extra_topic].filter(Boolean)
    const combinedNotes = noteParts.length > 0 ? noteParts.join('\n\n---\n\n') : null

    const briefData = {
      campaign_name: form.campaign_name,
      video_type: form.video_type,
      format: form.format,
      platforms: form.platforms.length > 0 ? form.platforms : null,
      message: form.message,
      cta: form.has_cta === 'yes' ? form.cta : null,
      target_audience: form.target_audience,
      voiceover_type: form.voiceover_type,
      voiceover_gender: form.voiceover_gender || null,
      voiceover_text: form.voiceover_text || null,
      notes: combinedNotes,
      languages: form.languages.length > 0 ? form.languages : [],
      credit_cost: cost,
      product_image_url: productImageUrl || null,
      ...(form.reference_links.length > 0 ? { reference_links: form.reference_links } : {}),
    }

    let newBrief: any = null
    let error: any = null

    if (editBriefId) {
      const updatePayload = asDraft
        ? { ...briefData, status: 'draft' }
        : isDraftEdit
          ? { ...briefData, status: 'submitted' }
          : briefData
      const res = await supabase.from('briefs').update(updatePayload).eq('id', editBriefId).select('id').single()
      newBrief = res.data; error = res.error
    } else {
      const res = await supabase.from('briefs').insert({
        ...briefData,
        client_id: clientUser.client_id,
        client_user_id: clientUser.id,
        status: asDraft ? 'draft' : 'submitted',
      }).select('id').single()
      newBrief = res.data; error = res.error
      // Set root_campaign_id to self for new briefs
      if (newBrief?.id) await supabase.from('briefs').update({ root_campaign_id: newBrief.id }).eq('id', newBrief.id)
    }
    if (error) { setSubmitting(false); alert('Hata: ' + error.message); return }
    if (newBrief?.id) {
      setSavedBriefId(newBrief.id)
      const { data: savedBrief } = await supabase.from('briefs').select('selected_ai_idea').eq('id', newBrief.id).single()
      if (savedBrief?.selected_ai_idea) setSavedIdea(savedBrief.selected_ai_idea)
    }

    // Log + brand learning
    if (newBrief?.id) {
      logClientActivity({
        actionType: asDraft ? 'brief.edited' : 'brief.created',
        userName, clientName: companyName, clientId: clientUser?.client_id,
        targetType: 'brief', targetId: newBrief.id, targetLabel: form.campaign_name,
        metadata: { brief_type: form.video_type },
      })
      const brandText = [form.message, form.notes, form.target_audience, form.cta].filter(Boolean).join('\n')
      if (brandText.length > 20) {
        fetch('/api/brand-learning', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: clientUser?.client_id, sourceType: 'brief', sourceId: newBrief.id, text: brandText })
        }).catch(() => {})
      }
    }

    // Upload files if any
    const files = filesRef.current?.files
    if (files && files.length > 0 && newBrief) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const ext = file.name.split('.').pop() || 'bin'
        const path = `${clientUser.client_id}/${newBrief.id}/${Date.now()}_${i}.${ext}`
        const { error: upErr } = await supabase.storage.from('brand-assets').upload(path, file)
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
          await supabase.from('brief_files').insert({
            client_id: clientUser.client_id,
            brief_id: newBrief.id,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: file.type || null,
          })
        }
      }
    }

    if (asDraft) {
      router.push('/dashboard/client?saved=draft')
    } else {
      setStep(99)
    }
  }

  const cost = calcCost()
  const balance = clientUser?.allocated_credits || 0

  const steps = ['Kampanya & Format','Hedef & CTA','Brief Metni','Seslendirme','Dosya & Uyarılar','İnceleme & Gönder']

  function Sidebar() {
    return (
      <div style={{width:'240px',background:'#0A0A0A',display:'flex',flexDirection:'column',flexShrink:0,height:'100dvh',overflowY:'auto'}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)',cursor:'pointer'}} onClick={()=>router.push('/dashboard/client')}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{height:'28px'}} />
        </div>
        <div style={{margin:'12px 12px',padding:'16px 20px',background:'#111',borderLeft:'3px solid #1DB81D'}}>
          <div style={{fontSize:'18px',fontWeight:'700',color:'#fff',marginBottom:'2px'}}>{companyName || 'Dinamo'}</div>
          <div style={{fontSize:'13px',fontWeight:'400',color:'#888',marginBottom:'12px'}}>{userName}</div>
          <div style={{fontSize:'10px',color:'#AAA',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'8px'}}>KREDİ BAKİYESİ</div>
          <div style={{fontSize:'28px',fontWeight:'700',color:'#fff',letterSpacing:'-1px',marginBottom:'8px'}}>{balance}</div>
          {cost > 0 && (
            <div style={{border:'1px solid rgba(255,255,255,0.1)',padding:'8px 10px',marginTop:'4px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'rgba(255,255,255,0.4)'}}>Bu brief</span>
                <span style={{fontSize:'14px',fontWeight:'500',color:'#4ade80'}}>{cost} kredi</span>
              </div>
              {form.voiceover_type==='real' && <div style={{fontSize:'9px',color:'rgba(255,255,255,0.25)',marginTop:'2px'}}>+6 gerçek seslendirme</div>}
              {form.languages.length>0 && <div style={{fontSize:'9px',color:'rgba(255,255,255,0.25)',marginTop:'2px'}}>+{form.languages.length*2} dil versiyonu ({form.languages.length} dil)</div>}
            </div>
          )}
        </div>

        <div style={{padding:'10px 8px'}}>
          <div style={{fontSize:'9px',letterSpacing:'1.5px',color:'#AAA',padding:'0 6px',marginBottom:'6px',textTransform:'uppercase'}}>Adımlar</div>
          {steps.map((s,i)=>{
            const n = i+1
            const isDone = n < step
            const isCur = n === step
            return (
              <div key={s}>
                <div onClick={()=>{ if(isDone) setStep(n) }}
                  style={{display:'flex',alignItems:'flex-start',gap:'8px',padding:'5px 6px',borderRadius:'7px',cursor:isDone?'pointer':'default',background:isCur?'rgba(255,255,255,0.06)':'transparent',marginBottom:'1px'}}>
                  <div style={{width:'17px',height:'17px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:'500',flexShrink:0,marginTop:'1px',
                    background:isDone?'#22c55e':isCur?'#1DB81D':'#444',
                    color:isDone?'#fff':isCur?'#fff':'#888'}}>
                    {isDone?'✓':n}
                  </div>
                  <div style={{marginTop:'1px'}}>
                    <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:isDone?'#888':isCur?'#fff':'#666',fontWeight:'500'}}>
                      {n===1&&form.campaign_name?form.campaign_name.substring(0,18)+(form.campaign_name.length>18?'…':''):s}
                    </div>
                    {isDone&&n===1&&form.video_type&&<div style={{fontSize:'9px',color:'rgba(255,255,255,0.2)',marginTop:'1px'}}>{form.video_type} · {form.format}</div>}
                  </div>
                </div>
                {n<5&&<div style={{width:'1px',height:'8px',background:'#2A2A2A',marginLeft:'14px'}}></div>}
              </div>
            )
          })}
          <div onClick={()=>router.push('/dashboard/client')} style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',marginTop:'16px',cursor:'pointer'}}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:'#aaa'}}>Projelerime dön</span>
          </div>
        </div>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width:'100%',boxSizing:'border-box',background:'#fff',border:'1px solid #0a0a0a',
    padding:'10px 12px',fontSize:'13px',color:'#0a0a0a',
    fontFamily:'var(--font-sans),Inter,sans-serif',outline:'none'
  }
  const pillStyle = (sel:boolean): React.CSSProperties => ({
    padding:'5px 11px',border:'1px solid',
    borderColor:sel?'#0a0a0a':'#0a0a0a',
    background:sel?'#0a0a0a':'#fff',
    color:sel?'#fff':'#0a0a0a',fontSize:'11px',letterSpacing:'0.3px',cursor:'pointer',
    fontFamily:'var(--font-sans),Inter,sans-serif',display:'inline-block',marginRight:'-1px'
  })

  // AI Ideas state
  const [ideasOpen, setIdeasOpen] = useState(false)
  const [ideas, setIdeas] = useState<{title:string,description:string}[]>([])
  const [ideasLoading, setIdeasLoading] = useState(false)
  const [ideaConfirm, setIdeaConfirm] = useState<{title:string,description:string}|null>(null)
  const [ideaSaving, setIdeaSaving] = useState(false)

  async function loadIdeas() {
    if (!savedBriefId) return
    setIdeasLoading(true); setIdeasOpen(true)
    const res = await fetch(`/api/briefs/${savedBriefId}/customer-ideas`)
    const data = await res.json()
    setIdeas(data.ideas || [])
    setIdeasLoading(false)
  }

  async function selectIdea(idea: {title:string,description:string} | null) {
    if (!savedBriefId) return
    setIdeaSaving(true)
    if (idea) {
      await supabase.from('briefs').update({ selected_ai_idea: idea }).eq('id', savedBriefId)
    }
    setIdeaConfirm(null); setIdeaSaving(false)
    router.push(`/dashboard/client/briefs/${savedBriefId}`)
  }

  if (step === 99) {
    const aiEnabled = (clientUser as any)?.clients?.ai_video_enabled
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'flex-start',justifyContent:'center',background:'var(--color-background-secondary)',paddingTop:'60px',paddingBottom:'40px',overflowY:'auto'}}>
        <div style={{maxWidth:'780px',padding:'0 24px',width:'100%'}}>
          {/* Hero */}
          <div style={{textAlign:'center',marginBottom:'32px'}}>
            <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'48px',height:'48px',background:'#E1F5EE',marginBottom:'16px'}}>
              <span style={{color:'#085041',fontSize:'20px',fontWeight:'700'}}>✓</span>
            </div>
            <div style={{fontSize:'32px',fontWeight:'500',color:'var(--color-text-primary)',letterSpacing:'-0.02em',marginBottom:'8px'}}>Brief alındı</div>
            <div style={{fontSize:'15px',color:'var(--color-text-secondary)',lineHeight:1.65}}>
              "{form.campaign_name}" ekibimize iletildi. 24-48 saat içinde teslim edilecek.
            </div>
          </div>

          {/* AI Ideas Banner — existing idea or new */}
          {savedBriefId && !ideasOpen && (
            savedIdea ? (
              <div style={{background:'#f5f4f0',border:'1px solid #0a0a0a',padding:'24px 28px',marginBottom:'24px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                  <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:'var(--color-text-tertiary)'}}>MEVCUT YARATICI YÖNÜNÜZ</div>
                  <span style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',padding:'2px 6px',background:'#fff',border:'1px solid #0a0a0a',color:'#0a0a0a'}}>BETA</span>
                </div>
                <div style={{fontSize:'15px',fontWeight:'500',color:'#0a0a0a',marginBottom:'4px'}}>{savedIdea.title}</div>
                <div style={{fontSize:'13px',color:'#6b6b66',lineHeight:1.5,marginBottom:'16px'}}>{savedIdea.description}</div>
                <div style={{display:'flex',gap:'10px'}}>
                  <button onClick={() => setSavedIdea(null)} className="btn" style={{padding:'8px 20px'}}>BU FİKRİ KORU</button>
                  <button onClick={() => { setSavedIdea(null); loadIdeas() }} disabled={ideasLoading} className="btn btn-outline" style={{padding:'8px 20px'}}>{ideasLoading ? 'YÜKLENİYOR...' : 'YENİ FİKİR ÜRET'}</button>
                </div>
              </div>
            ) : (
              <div style={{background:'#f5f4f0',border:'1px solid #0a0a0a',padding:'24px 28px',marginBottom:'24px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'20px',flexWrap:'wrap'}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                    <div style={{fontSize:'16px',fontWeight:'500',color:'#0a0a0a'}}>Kreatife Yön Vermek İster misiniz?</div>
                    <span style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',padding:'2px 6px',background:'#fff',border:'1px solid #0a0a0a',color:'#0a0a0a'}}>BETA</span>
                  </div>
                  <div style={{fontSize:'13px',color:'#6b6b66',lineHeight:1.5}}>AI ile 3 farklı yaratıcı yön keşfedin, beğendiğinizi seçin.</div>
                </div>
                <button onClick={loadIdeas} disabled={ideasLoading} className="btn" style={{padding:'10px 24px',whiteSpace:'nowrap',flexShrink:0}}>
                  {ideasLoading ? 'YÜKLENİYOR...' : 'AI FİKİRLERİ GÖR →'}
                </button>
              </div>
            )
          )}

          {/* AI Ideas Panel */}
          {ideasOpen && (
            <div style={{background:'#f5f4f0',border:'1px solid #0a0a0a',padding:'24px 28px',marginBottom:'24px',position:'relative'}}>
              <button onClick={() => setIdeasOpen(false)} style={{position:'absolute',top:'12px',right:'12px',width:'28px',height:'28px',border:'1px solid #0a0a0a',background:'#fff',color:'#0a0a0a',fontSize:'14px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'16px'}}>
                <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:'#0a0a0a'}}>YARATICI YÖNLER</div>
                <span style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',padding:'2px 6px',background:'#fff',border:'1px solid #0a0a0a',color:'#0a0a0a'}}>BETA</span>
              </div>
              {ideasLoading ? (
                <div style={{textAlign:'center',padding:'32px 0'}}>
                  <div className="spinner" style={{width:'24px',height:'24px',border:'2px solid #ddd',borderTopColor:'#0a0a0a',margin:'0 auto 12px'}} />
                  <div style={{fontSize:'13px',color:'#6b6b66'}}>Fikirler üretiliyor...</div>
                </div>
              ) : (
                <>
                  <div className="ideas-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'12px'}}>
                    {ideas.map((idea, i) => (
                      <div key={i} onClick={() => setIdeaConfirm(idea)}
                        style={{background:'#fff',border:'1px solid #e5e4db',padding:'18px',cursor:'pointer',display:'flex',flexDirection:'column',transition:'border-color 0.15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='#0a0a0a'}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='#e5e4db'}}>
                        <div style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--color-text-tertiary)',marginBottom:'8px'}}>FİKİR {i + 1}</div>
                        <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a',marginBottom:'8px',lineHeight:1.3}}>{idea.title}</div>
                        <div style={{fontSize:'12px',color:'#6b6b66',lineHeight:1.5,flex:1}}>{idea.description}</div>
                        <div style={{fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'#0a0a0a',fontWeight:'500',marginTop:'12px'}}>SEÇ →</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => selectIdea(null)} className="btn btn-outline" style={{width:'100%',padding:'12px',textAlign:'center'}}>
                    EKİBİME GÜVENİYORUM — DEVAM ET →
                  </button>
                </>
              )}
              <style>{`@media (max-width: 768px) { .ideas-grid { grid-template-columns: 1fr !important; } }`}</style>
            </div>
          )}

          {/* Action cards */}
          <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--color-text-tertiary)',marginBottom:'12px',textAlign:'center'}}>VEYA</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'32px'}}>
            {savedBriefId && (
              <a href={`/dashboard/client/briefs/${savedBriefId}?tab=cps`} style={{textDecoration:'none',background:'#fff',border:'1px solid #0a0a0a',padding:'20px 18px',display:'flex',flexDirection:'column',cursor:'pointer',transition:'background 0.15s'}}
                onMouseEnter={e=>{e.currentTarget.style.background='var(--color-background-secondary)'}} onMouseLeave={e=>{e.currentTarget.style.background='#fff'}}>
                <div style={{fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--color-text-tertiary)',marginBottom:'8px'}}>PAKET</div>
                <div style={{fontSize:'15px',fontWeight:'500',color:'var(--color-text-primary)',marginBottom:'6px'}}>CPS Başlat</div>
                <div style={{fontSize:'12px',color:'var(--color-text-secondary)',lineHeight:1.5,flex:1}}>Farklı yaratıcı yönler paketi</div>
              </a>
            )}
            {aiEnabled && savedBriefId && (
              <a href={`/dashboard/client/briefs/${savedBriefId}?tab=express`} style={{textDecoration:'none',background:'#fff',border:'1px solid #0a0a0a',padding:'20px 18px',display:'flex',flexDirection:'column',cursor:'pointer',transition:'background 0.15s'}}
                onMouseEnter={e=>{e.currentTarget.style.background='var(--color-background-secondary)'}} onMouseLeave={e=>{e.currentTarget.style.background='#fff'}}>
                <div style={{fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--color-text-tertiary)',marginBottom:'8px'}}>HIZLI ÜRETİM</div>
                <div style={{fontSize:'15px',fontWeight:'500',color:'var(--color-text-primary)',marginBottom:'6px'}}>AI Express</div>
                <div style={{fontSize:'12px',color:'var(--color-text-secondary)',lineHeight:1.5,flex:1}}>~5 dakikada 3 alternatif AI video</div>
              </a>
            )}
            <a href="/dashboard/client/brief/new" style={{textDecoration:'none',background:'#fff',border:'1px solid #0a0a0a',padding:'20px 18px',display:'flex',flexDirection:'column',cursor:'pointer',transition:'background 0.15s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='var(--color-background-secondary)'}} onMouseLeave={e=>{e.currentTarget.style.background='#fff'}}>
              <div style={{fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--color-text-tertiary)',marginBottom:'8px'}}>YENİ KAMPANYA</div>
              <div style={{fontSize:'15px',fontWeight:'500',color:'var(--color-text-primary)',marginBottom:'6px'}}>Yeni Brief</div>
              <div style={{fontSize:'12px',color:'var(--color-text-secondary)',lineHeight:1.5,flex:1}}>Farklı kampanya için brief oluştur</div>
            </a>
          </div>

          <div style={{textAlign:'center'}}>
            <span onClick={()=>router.push('/dashboard/client')} style={{fontSize:'13px',color:'var(--color-text-primary)',cursor:'pointer',transition:'color 0.15s'}}
              onMouseEnter={e=>{e.currentTarget.style.color='#4ade80'}} onMouseLeave={e=>{e.currentTarget.style.color='var(--color-text-primary)'}}>
              ← Projelerime dön
            </span>
          </div>
        </div>

        {/* Idea Confirm Modal */}
        {ideaConfirm && (
          <div onClick={() => setIdeaConfirm(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(4px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div onClick={e => e.stopPropagation()} style={{background:'#fff',border:'1px solid #0a0a0a',padding:'28px',maxWidth:'440px',width:'90%'}}>
              <div style={{fontSize:'16px',fontWeight:'500',color:'#0a0a0a',marginBottom:'8px'}}>Yaratıcı Yön Seç</div>
              <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a',marginBottom:'6px'}}>{ideaConfirm.title}</div>
              <div style={{fontSize:'13px',color:'var(--color-text-secondary)',lineHeight:1.6,marginBottom:'20px'}}>{ideaConfirm.description}</div>
              <div style={{fontSize:'12px',color:'var(--color-text-tertiary)',marginBottom:'20px'}}>Bu yaratıcı yön brief'inize eklenecek ve ekibimize iletilecek.</div>
              <div style={{display:'flex',gap:'10px'}}>
                <button onClick={() => setIdeaConfirm(null)} className="btn btn-outline" style={{flex:1,padding:'10px'}}>VAZGEÇ</button>
                <button onClick={() => selectIdea(ideaConfirm)} disabled={ideaSaving} className="btn" style={{flex:1,padding:'10px'}}>
                  {ideaSaving ? '...' : 'ONAYLA'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{display:'flex',minHeight:'100dvh',fontFamily:"var(--font-sans),'Inter',system-ui,sans-serif"}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',background:'var(--color-background-secondary)',minWidth:0}}>
        <div style={{padding:'14px 28px',background:'#fff',borderBottom:'1px solid var(--color-border-tertiary)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0,position:'sticky',top:0,zIndex:5}}>
          <div style={{fontSize:'11px',letterSpacing:'1px',textTransform:'uppercase',color:'var(--color-text-secondary)'}}>Yeni Brief{step > 0 ? <> / <span style={{color:'var(--color-text-primary)',fontWeight:'500'}}>{steps[step-1]}</span></> : ''}</div>
          {step > 0 && (
            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
              <div style={{width:'120px',height:'4px',background:'var(--color-background-tertiary)'}}>
                <div style={{width:`${(step/6)*100}%`,height:'100%',background:'#0a0a0a',transition:'width 0.3s ease'}} />
              </div>
              <div style={{fontSize:'11px',letterSpacing:'1px',color:'var(--color-text-tertiary)'}}>{step}/6</div>
            </div>
          )}
        </div>

        <div style={{flex:1,padding:'32px 40px',maxWidth:'640px'}}>

          {/* ADIM 0 — Mod Seçimi */}
          {step===0&&(
            <div style={{position:'fixed',inset:0,left:'240px',background:'#0a0a0a',display:'flex',flexDirection:'column',zIndex:10}}>
              <style>{`@media (max-width: 768px) { .step0-cards { flex-direction: column !important; } }`}</style>
              {/* Back link */}
              <div style={{padding:'24px 36px'}}>
                <span onClick={()=>router.push('/dashboard/client')}
                  onMouseEnter={e=>{e.currentTarget.style.color='#fff'}}
                  onMouseLeave={e=>{e.currentTarget.style.color='#AAA'}}
                  style={{fontSize:'13px',color:'#AAA',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'6px',transition:'color 0.15s ease',background:'none',border:'none',padding:0}}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Projelerim
                </span>
              </div>
              {/* Centered content */}
              <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div style={{textAlign:'center',width:'100%',maxWidth:'560px',padding:'0 24px'}}>
                  <div style={{fontSize:'28px',fontWeight:'300',color:'#fff',letterSpacing:'-0.5px',marginBottom:'32px'}}>Nasıl ilerlemek istersiniz?</div>
                  <div className="step0-cards" style={{display:'flex',gap:'16px'}}>
                    {/* SOL KART */}
                    <div onClick={()=>setStep(1)}
                      style={{flex:1,background:'#fff',padding:'40px',cursor:'pointer',minHeight:'200px',display:'flex',flexDirection:'column',justifyContent:'space-between',transition:'transform 0.2s,box-shadow 0.2s',textAlign:'left'}}
                      onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.02)';e.currentTarget.style.boxShadow='0 8px 32px rgba(0,0,0,0.2)'}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.boxShadow='none'}}>
                      <div>
                        <div style={{fontSize:'20px',fontWeight:'500',color:'#0a0a0a',marginBottom:'8px'}}>Kendim Yazacağım</div>
                        <div style={{fontSize:'13px',color:'#888',lineHeight:1.6}}>Brief alanlarını adım adım kendiniz doldurun.</div>
                      </div>
                      <div style={{textAlign:'right',marginTop:'20px'}}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                    </div>
                    {/* SAĞ KART */}
                    <div onClick={()=>setStep(-1)}
                      style={{flex:1,background:'#0a0a0a',border:'2px solid #1db81d',padding:'40px',cursor:'pointer',minHeight:'200px',display:'flex',flexDirection:'column',justifyContent:'space-between',transition:'transform 0.2s,border-color 0.2s',textAlign:'left',position:'relative'}}
                      onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.02)';e.currentTarget.style.borderColor='#22c55e'}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.borderColor='#1db81d'}}>
                      <div style={{position:'absolute',top:'16px',left:'16px',fontSize:'10px',color:'#1db81d',fontWeight:'500',background:'rgba(29,184,29,0.1)',padding:'3px 10px',letterSpacing:'0.5px'}}>AI</div>
                      <div style={{marginTop:'16px'}}>
                        <div style={{fontSize:'20px',fontWeight:'500',color:'#fff',marginBottom:'8px'}}>Anlat, Oluşturalım</div>
                        <div style={{fontSize:'13px',color:'rgba(255,255,255,0.5)',lineHeight:1.6}}>Ne yapmak istediğinizi anlatın, brief'i sizin için oluşturalım.</div>
                      </div>
                      <div style={{textAlign:'right',marginTop:'20px'}}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#1db81d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                    </div>
                  </div>
                  {/* Bottom return link */}
                  <div style={{marginTop:'32px'}}>
                    <span onClick={()=>router.push('/dashboard/client')}
                      onMouseEnter={e=>{e.currentTarget.style.color='#fff'}}
                      onMouseLeave={e=>{e.currentTarget.style.color='#AAA'}}
                      style={{fontSize:'13px',color:'#AAA',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'6px',transition:'color 0.15s ease'}}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Projelerim
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ADIM -1 — AI Modu */}
          {step===-1&&(
            <div>
              <div style={{fontSize:'22px',fontWeight:'500',letterSpacing:'-0.01em',color:'var(--color-text-primary)',marginBottom:'8px'}}>Bize anlatın</div>
              <div style={{fontSize:'14px',color:'#888',marginBottom:'24px',lineHeight:'1.6'}}>Ne aklınızdaysa yazın — gerisini biz halledelim.</div>
              <textarea
                value={aiBriefInput}
                onChange={e=>setAiBriefInput(e.target.value)}
                placeholder="Videonuz hakkında aklınızda ne varsa yazın — ürününüz, mesajınız, hedef kitleniz, kullanmak istediğiniz platform..."
                rows={8}
                style={{...inputStyle,resize:'vertical',lineHeight:'1.7',marginBottom:'16px',fontSize:'14px'}} />
              <div style={{display:'flex',gap:'10px'}}>
                <button onClick={()=>setStep(0)} className="btn btn-outline">GERİ</button>
                <button onClick={handleAiBrief} disabled={aiBriefLoading||!aiBriefInput.trim()} className="btn">
                  {aiBriefLoading?'OLUŞTURULUYOR...':'BRİEF OLUŞTUR'}
                </button>
              </div>
            </div>
          )}

          {/* ADIM 1 */}
          {step===1&&(
            <div>
              <div className="label-caps" style={{marginBottom:'8px',color:'var(--color-text-secondary)'}}>01 — KAMPANYA ÖZETİ</div>
              <div style={{fontSize:'22px',fontWeight:'500',letterSpacing:'-0.01em',color:'var(--color-text-primary)',marginBottom:'28px'}}>Kampanyanıza bir isim verin</div>
              <div style={{marginBottom:'22px'}}>
                <div style={{fontSize:'11px',color:'var(--color-text-secondary)',letterSpacing:'2px',textTransform:'uppercase',fontWeight:'500',marginBottom:'8px'}}>Kampanya Adı</div>
                <input style={inputStyle} value={form.campaign_name} onChange={e=>setForm({...form,campaign_name:e.target.value})} placeholder="örn. Yaz Kampanyası 2025..." />
              </div>
              <div style={{marginBottom:'22px'}}>
                <div style={{fontSize:'11px',color:'var(--color-text-secondary)',letterSpacing:'2px',textTransform:'uppercase',fontWeight:'500',marginBottom:'8px'}}>Video Tipi</div>
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>{VIDEO_TYPES.map(t=>{
                  const sel = form.video_type===t
                  return <span key={t} style={{...pillStyle(sel),display:'inline-flex',flexDirection:'column',alignItems:'center',gap:'2px',padding:'10px 18px'}} onClick={()=>setForm({...form,video_type:t})}>
                    <span>{t}</span>
                    <span style={{fontSize:'10px',color:sel?'rgba(255,255,255,0.7)':'#aaa'}}>{VIDEO_DURATIONS[t]}</span>
                  </span>
                })}</div>
              </div>
              <div style={{marginBottom:'8px'}}>
                <div style={{fontSize:'11px',color:'var(--color-text-secondary)',letterSpacing:'2px',textTransform:'uppercase',fontWeight:'500',marginBottom:'8px'}}>Format</div>
                <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
                  {FORMATS.map(f=>{
                    const sel = form.format===f.ratio
                    return (
                      <div key={f.ratio} onClick={()=>setForm({...form,format:f.ratio})}
                        style={{cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:'6px',padding:'12px 16px',borderRadius:'10px',border:sel?'2px solid #22c55e':'1.5px solid rgba(0,0,0,0.1)',background:sel?'rgba(34,197,94,0.04)':'#fff',transition:'all 0.15s',minWidth:'64px'}}>
                        <div style={{width:`${f.w}px`,height:`${f.h}px`,borderRadius:'4px',border:sel?'2px solid #22c55e':'1.5px solid rgba(0,0,0,0.15)',background:sel?'rgba(34,197,94,0.08)':'#f5f4f0',transition:'all 0.15s'}} />
                        <span style={{fontSize:'12px',fontWeight:'500',color:sel?'#22c55e':'#555'}}>{f.ratio}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{marginTop:'22px'}}>
                <div style={{fontSize:'11px',color:'var(--color-text-secondary)',letterSpacing:'2px',textTransform:'uppercase',fontWeight:'500',marginBottom:'8px'}}>Video hangi mecralarda kullanılacak?</div>
                <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                  {[
                    {id:'tiktok',label:'TikTok',icon:<span style={{fontWeight:'700',fontSize:'11px'}}>TT</span>},
                    {id:'instagram',label:'Instagram',icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg>},
                    {id:'youtube',label:'YouTube',icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.94 2C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 001.94-2A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><path d="M9.75 15.02l5.75-3.27-5.75-3.27v6.54z" fill="currentColor" stroke="none"/></svg>},
                    {id:'twitter',label:'X',icon:<span style={{fontWeight:'700',fontSize:'13px'}}>𝕏</span>},
                    {id:'other',label:'Diğer',icon:<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>},
                  ].map(p=>{
                    const sel = form.platforms.includes(p.id)
                    return (
                      <div key={p.id} onClick={()=>setForm(prev=>({...prev,platforms:prev.platforms.includes(p.id)?prev.platforms.filter(x=>x!==p.id):[...prev.platforms,p.id]}))}
                        style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px',borderRadius:'100px',cursor:'pointer',transition:'all 0.15s',
                          border:sel?'1.5px solid #22c55e':'1px solid rgba(0,0,0,0.12)',
                          background:sel?'rgba(34,197,94,0.06)':'#fff',
                          color:sel?'#22c55e':'#888'}}>
                        {p.icon}
                        <span style={{fontSize:'12px',fontWeight:'500'}}>{p.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ADIM 2 */}
          {step===2&&(
            <div>
              <div className="label-caps" style={{marginBottom:'8px',color:'var(--color-text-secondary)'}}>02 — HEDEF KİTLE</div>
              <div style={{fontSize:'22px',fontWeight:'500',letterSpacing:'-0.01em',color:'var(--color-text-primary)',marginBottom:'28px'}}>Kimi hedefliyorsunuz?</div>
              <div style={{marginBottom:'22px'}}>
                <div style={{fontSize:'11px',color:'var(--color-text-secondary)',letterSpacing:'2px',textTransform:'uppercase',fontWeight:'500',marginBottom:'8px'}}>Hedef Kitle</div>
                <textarea style={{...inputStyle,resize:'vertical',minHeight:'80px'}} rows={3} maxLength={500} value={form.target_audience} onChange={e=>setForm({...form,target_audience:e.target.value})} placeholder="Yaş, demografi, ilgi alanları, davranışlar — kim için üretiyoruz?" />
              </div>
              <div style={{marginBottom:'22px'}}>
                <div style={{fontSize:'11px',color:'var(--color-text-secondary)',letterSpacing:'2px',textTransform:'uppercase',fontWeight:'500',marginBottom:'8px'}}>Call to Action var mı?</div>
                <div>
                  <span style={pillStyle(form.has_cta==='yes')} onClick={()=>setForm({...form,has_cta:'yes'})}>Evet, var</span>
                  <span style={pillStyle(form.has_cta==='no')} onClick={()=>setForm({...form,has_cta:'no',cta:''})}>Hayır, yok</span>
                </div>
              </div>
              {form.has_cta==='yes'&&(
                <div style={{marginBottom:'8px'}}>
                  <div style={{fontSize:'11px',color:'var(--color-text-secondary)',letterSpacing:'2px',textTransform:'uppercase',fontWeight:'500',marginBottom:'8px'}}>CTA Metni</div>
                  <input style={inputStyle} value={form.cta} onChange={e=>setForm({...form,cta:e.target.value})} placeholder="örn. Hemen sipariş ver, %30 indirim fırsatını kaçırma..." />
                </div>
              )}
            </div>
          )}

          {/* ADIM 3 */}
          {step===3&&(
            <div>
              <div className="label-caps" style={{marginBottom:'8px',color:'var(--color-text-secondary)'}}>03 — BRİEF</div>
              <div style={{fontSize:'22px',fontWeight:'500',letterSpacing:'-0.01em',color:'var(--color-text-primary)',marginBottom:'8px'}}>Brief'inizi yazın</div>
              <div style={{fontSize:'13px',color:'#888',marginBottom:'24px',lineHeight:'1.6'}}>Ne anlatmak istiyorsunuz? Tonunuzu, mesajınızı, hikayenizi ve önemli detayları buraya yazın. Ne kadar detaylı olursa o kadar iyi.</div>
              <div style={{position:'relative'}}>
                <textarea style={{...inputStyle,resize:'vertical',lineHeight:'1.7',paddingTop:'36px',opacity:expandLoading?0.5:1,transition:'opacity 0.2s'}} rows={10} value={form.message} onChange={e=>{setForm({...form,message:e.target.value});setPrevMessage(null)}} placeholder="Videonun mesajını, tonunu, hikayesini ve önemli detaylarını buraya yazın. Referans video veya reklam varsa linkini de ekleyebilirsiniz..." />
                <div style={{position:'absolute',top:'8px',right:'8px',display:'flex',gap:'5px',zIndex:2}}>
                  {prevMessage !== null && !expandLoading && (
                    <button onClick={handleUndoExpand}
                      style={{display:'flex',alignItems:'center',gap:'4px',padding:'3px 8px',borderRadius:'5px',border:'1px solid rgba(0,0,0,0.12)',background:'#fff',fontSize:'10px',color:'#888',cursor:'pointer',fontFamily:'var(--font-sans),Inter,sans-serif'}}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6.69 3L3 13"/></svg>
                      Geri Al
                    </button>
                  )}
                  <button onClick={handleExpand} disabled={expandLoading || !form.message.trim()}
                    style={{display:'flex',alignItems:'center',gap:'4px',padding:'3px 8px',borderRadius:'5px',border:'none',background:expandLoading||!form.message.trim()?'rgba(0,0,0,0.04)':'#111113',fontSize:'10px',color:expandLoading||!form.message.trim()?'#ccc':'#fff',cursor:expandLoading||!form.message.trim()?'default':'pointer',fontFamily:'var(--font-sans),Inter,sans-serif'}}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v5m4.5-2.5L14 8m5 4h-5m2.5 4.5L14 14m-2 7v-5m-4.5 2.5L10 16m-7-4h5m-2.5-4.5L8 10"/></svg>
                    {expandLoading ? '...' : 'Detaylandır'}
                  </button>
                </div>
                {expandLoading && (
                  <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                    <div style={{fontSize:'13px',color:'#888',background:'rgba(255,255,255,0.8)',padding:'6px 16px',borderRadius:'8px'}}>Detaylandırılıyor...</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ADIM 4 */}
          {step===4&&(
            <div>
              <div className="label-caps" style={{marginBottom:'8px',color:'var(--color-text-secondary)'}}>04 — SESLENDİRME</div>
              <div style={{fontSize:'22px',fontWeight:'500',letterSpacing:'-0.01em',color:'var(--color-text-primary)',marginBottom:'28px'}}>Seslendirme</div>
              <div style={{marginBottom:'22px'}}>
                <div style={{fontSize:'11px',color:'var(--color-text-secondary)',letterSpacing:'2px',textTransform:'uppercase',fontWeight:'500',marginBottom:'8px'}}>Seslendirme Tipi</div>
                <div>
                  <span style={pillStyle(form.voiceover_type==='none')} onClick={()=>setForm({...form,voiceover_type:'none',voiceover_gender:'',voiceover_text:''})}>Yok</span>
                  <span style={pillStyle(form.voiceover_type==='ai')} onClick={()=>setForm({...form,voiceover_type:'ai',voiceover_gender:'female'})}>AI Seslendirme</span>
                  <span style={pillStyle(form.voiceover_type==='real')} onClick={()=>setForm({...form,voiceover_type:'real',voiceover_gender:'female'})}>Gerçek Seslendirme (+6 kredi)</span>
                </div>
              </div>
              {form.voiceover_type!=='none'&&(
                <div style={{marginBottom:'22px'}}>
                  <div style={{fontSize:'11px',color:'var(--color-text-secondary)',letterSpacing:'2px',textTransform:'uppercase',fontWeight:'500',marginBottom:'8px'}}>Seslendirme Cinsiyeti</div>
                  <div>
                    <span style={pillStyle(form.voiceover_gender==='female')} onClick={()=>setForm({...form,voiceover_gender:'female'})}>Kadın Sesi</span>
                    <span style={pillStyle(form.voiceover_gender==='male')} onClick={()=>setForm({...form,voiceover_gender:'male'})}>Erkek Sesi</span>
                  </div>
                </div>
              )}
              {form.voiceover_type!=='none'&&(
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                    <div style={{fontSize:'11px',color:'var(--color-text-secondary)',letterSpacing:'2px',textTransform:'uppercase',fontWeight:'500'}}>Seslendirme Metni</div>
                    <button onClick={generateVoiceover} disabled={aiLoading} style={{fontSize:'11px',padding:'5px 12px',borderRadius:'6px',border:'0.5px solid rgba(0,0,0,0.15)',background:'#111113',color:'#fff',cursor:'pointer',fontFamily:'var(--font-sans),Inter,sans-serif'}}>
                      {aiLoading?'Yazıyor...':form.voiceover_text?'Yeniden Yaz':'AI ile Yaz'}
                    </button>
                  </div>
                  <textarea style={{...inputStyle,resize:'vertical',lineHeight:'1.7'}} rows={6} value={form.voiceover_text} onChange={e=>setForm({...form,voiceover_text:e.target.value})} placeholder="Seslendirme metnini yazın veya AI ile oluşturun..." />
                  {/* PREVIEW */}
                  {brandVoiceForGender && form.voiceover_text.trim() && (savedBriefId || editBriefId) && (
                    <div style={{marginTop:'12px'}}>
                      {previewLimitHit ? (
                        <div style={{fontSize:'11px',color:'var(--color-text-tertiary)'}}>Preview hakkınız doldu (10/10)</div>
                      ) : (
                        <button
                          onClick={previewVoiceover}
                          disabled={previewLoading}
                          className="btn btn-outline"
                          style={{
                            padding:'7px 16px',fontSize:'11px',
                            borderColor: previewTextChanged ? '#f59e0b' : undefined,
                            borderWidth: previewTextChanged ? '2px' : undefined,
                          }}
                        >
                          {previewLoading ? (
                            <span style={{display:'flex',alignItems:'center',gap:'8px'}}>
                              <span style={{width:'14px',height:'14px',borderWidth:'2px',borderStyle:'solid',borderColor:'#e5e4db #e5e4db #e5e4db #0a0a0a',borderRadius:'50%',animation:'prev-spin 0.8s linear infinite',display:'inline-block'}} />
                              ÜRETİLİYOR...
                            </span>
                          ) : previewTextChanged ? 'YENİ PREVIEW DİNLE → ▶' : previewUrl ? 'DİNLE ▶' : 'PREVIEW DİNLE → ▶'}
                        </button>
                      )}
                      {previewUrl && !previewLoading && (
                        <div style={{marginTop:'10px'}}>
                          <audio controls src={previewUrl} style={{width:'100%',marginBottom:'6px'}} />
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <span style={{fontSize:'10px',letterSpacing:'1px',textTransform:'uppercase',color:'var(--color-text-tertiary)'}}>Marka sesi: {cleanVoiceName(previewVoiceName)}</span>
                            <span style={{fontSize:'10px',color:'var(--color-text-tertiary)'}}>{previewCount}/10 preview</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {form.voiceover_type==='none'&&(
                <div style={{padding:'16px',background:'rgba(0,0,0,0.03)',borderRadius:'10px',fontSize:'13px',color:'#888',lineHeight:'1.6'}}>
                  Seslendirme olmadan da videonuz için müzik ve efekt kullanabiliriz.
                </div>
              )}
            </div>
          )}

          {/* STEP 5 — UYARILAR & MATERYALLER */}
          {step===5&&(
            <div>
              <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
                <div className="label-caps" style={{color:'var(--color-text-secondary)'}}>05 — UYARILAR & MATERYALLER</div>
                <span style={{fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'#9b9b95'}}>OPSİYONEL</span>
              </div>
              <div style={{fontSize:'22px',fontWeight:'500',letterSpacing:'-0.01em',color:'var(--color-text-primary)',marginBottom:'24px'}}>Son eklemeler</div>

              {/* 1) UYARILAR — EN ÜSTTE */}
              <div style={{background:'#fff',border:'1px solid #0a0a0a',padding:'16px 20px',marginBottom:'16px'}}>
                <div className="label-caps" style={{marginBottom:'8px'}}>UYARILAR & HASSASİYETLER</div>
                <textarea style={{...inputStyle,resize:'vertical',lineHeight:'1.7'}} rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Kaçınılması gereken içerik, hassas konular, marka kısıtlamaları..." />
              </div>

              {/* 2) ÜRÜN GÖRSELİ + MARKA MATERYALLERİ — YAN YANA */}
              <div className="step5-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px',alignItems:'stretch'}}>
                {/* ÜRÜN GÖRSELİ */}
                <div style={{background:'#fff',border:'1px solid #0a0a0a',padding:'16px 20px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                    <div className="label-caps">ÜRÜN GÖRSELİ</div>
                    <span style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',padding:'1px 5px',border:'1px solid #22c55e',color:'#22c55e'}}>BETA</span>
                  </div>
                  <div style={{fontSize:'11px',color:'var(--color-text-tertiary)',lineHeight:'1.4',marginBottom:'10px',minHeight:'32px'}}>AI Express ürün videosu özelliğini denemek için ürün görseli yükleyin.</div>
                  {productImageUrl ? (
                    <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px',border:'1px solid var(--color-border-tertiary)'}}>
                      <img src={productImageUrl} alt="Ürün" style={{width:'40px',height:'40px',objectFit:'cover',border:'1px solid var(--color-border-tertiary)'}} />
                      <div style={{flex:1,fontSize:'12px',color:'#22c55e',fontWeight:'500'}}>Yüklendi</div>
                      <button onClick={()=>setProductImageUrl(null)} style={{fontSize:'11px',color:'#ef4444',background:'none',border:'none',cursor:'pointer'}}>Kaldır</button>
                    </div>
                  ) : (
                    <div onClick={()=>productImageRef.current?.click()} style={{border:'1px dashed #0a0a0a',padding:'18px',textAlign:'center',cursor:'pointer'}}>
                      <div style={{fontSize:'20px',color:'var(--color-text-tertiary)',marginBottom:'4px'}}>+</div>
                      <div style={{fontSize:'11px',color:'var(--color-text-secondary)'}}>Sürükle veya tıkla</div>
                      <div style={{fontSize:'10px',color:'var(--color-text-tertiary)',marginTop:'2px'}}>JPG, PNG · max 10MB</div>
                    </div>
                  )}
                  <input ref={productImageRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleProductImageUpload} style={{display:'none'}} />
                  {productUploading && <div style={{fontSize:'11px',color:'#888',marginTop:'6px'}}>Yükleniyor...</div>}
                </div>

                {/* MARKA MATERYALLERİ */}
                <div style={{background:'#fff',border:'1px solid #0a0a0a',padding:'16px 20px'}}>
                  <div className="label-caps" style={{marginBottom:'6px'}}>MARKA MATERYALLERİ</div>
                  <div style={{fontSize:'11px',color:'var(--color-text-tertiary)',lineHeight:'1.4',marginBottom:'10px',minHeight:'32px'}}>Logo, font, ses, grafik yükleyin.</div>
                  <div onClick={()=>filesRef.current?.click()} style={{border:'1px dashed #0a0a0a',padding:'18px',textAlign:'center',cursor:'pointer'}}>
                    <div style={{fontSize:'20px',color:'var(--color-text-tertiary)',marginBottom:'4px'}}>+</div>
                    <div style={{fontSize:'11px',color:'var(--color-text-secondary)'}}>Sürükle veya tıkla</div>
                    <div style={{fontSize:'10px',color:'var(--color-text-tertiary)',marginTop:'2px'}}>Birden fazla seçilebilir</div>
                  </div>
                  <input ref={filesRef} type="file" multiple onChange={() => { const files = filesRef.current?.files; if (files) setBrandFiles(Array.from(files).map(f => ({name:f.name}))) }} style={{display:'none'}} />
                  {brandFiles.length > 0 && (
                    <div style={{marginTop:'8px',display:'flex',flexDirection:'column',gap:'3px'}}>
                      {brandFiles.map((f,i) => (
                        <div key={i} style={{padding:'4px 8px',background:'var(--color-background-secondary)',fontSize:'11px',color:'#0a0a0a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 3) REFERANS VİDEO LİNKİ — FULL WIDTH */}
              <div style={{background:'#fff',border:'1px solid #0a0a0a',padding:'16px 20px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'6px'}}>
                  <div className="label-caps">REFERANS VİDEO LİNKİ</div>
                  <span style={{fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'#9b9b95'}}>OPSİYONEL</span>
                </div>
                <div style={{fontSize:'11px',color:'var(--color-text-tertiary)',lineHeight:'1.4',marginBottom:'10px'}}>Tarzı yansıtan referans link. YouTube, TikTok, Vimeo, Instagram.</div>
                <div style={{display:'flex',gap:'8px',marginBottom:form.reference_links.length > 0 ? '10px' : '0'}}>
                  <input value={refLinkInput} onChange={e => setRefLinkInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const url = refLinkInput.trim(); if (!url) return; if (!url.startsWith('http://') && !url.startsWith('https://')) { setRefLinkInput(''); return }; if (!form.reference_links.includes(url)) setForm({...form, reference_links: [...form.reference_links, url]}); setRefLinkInput('') } }}
                    placeholder="https://..." style={{flex:1,padding:'8px 12px',border:'1px solid #0a0a0a',fontSize:'13px',color:'#0a0a0a',boxSizing:'border-box'}} />
                  <button type="button" onClick={() => { const url = refLinkInput.trim(); if (!url) return; if (!url.startsWith('http://') && !url.startsWith('https://')) { setRefLinkInput(''); return }; if (!form.reference_links.includes(url)) setForm({...form, reference_links: [...form.reference_links, url]}); setRefLinkInput('') }} className="btn btn-outline" style={{padding:'8px 16px',whiteSpace:'nowrap'}}>EKLE</button>
                </div>
                {form.reference_links.length > 0 && (
                  <div>
                    <div style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--color-text-tertiary)',marginBottom:'4px'}}>EKLENEN LİNKLER</div>
                    <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                      {form.reference_links.map((link, i) => (
                        <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'5px 8px',background:'var(--color-background-secondary)'}}>
                          <a href={link} target="_blank" rel="noopener noreferrer" style={{flex:1,fontSize:'11px',color:'#0a0a0a',textDecoration:'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{link}</a>
                          <button type="button" onClick={() => setForm({...form, reference_links: form.reference_links.filter((_,j) => j !== i)})} style={{fontSize:'13px',color:'#888',background:'none',border:'none',cursor:'pointer',padding:'0 4px',lineHeight:1}}>×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <style>{`@keyframes prev-spin{to{transform:rotate(360deg)}} @media (max-width: 768px) { .step5-grid { grid-template-columns: 1fr !important; } }`}</style>
            </div>
          )}

          {/* STEP 6 — İNCELEME & GÖNDER */}
          {step===6&&(()=>{
            const durMap:Record<string,string>={'Bumper / Pre-roll':'6 sn','Story / Reels':'15 sn','Feed Video':'30 sn','Long Form':'60 sn'}
            const dur=durMap[form.video_type]||'—'
            const wordCount=form.message?form.message.trim().split(/\s+/).length:0
            return (
              <div>
                <div className="label-caps" style={{marginBottom:'8px',color:'var(--color-text-secondary)'}}>06 — İNCELEME & GÖNDER</div>
                <div style={{fontSize:'22px',fontWeight:'500',letterSpacing:'-0.01em',color:'var(--color-text-primary)',marginBottom:'28px'}}>Son kontrol</div>

                {/* BRIEF SUMMARY */}
                <div style={{background:'#f0efeb',padding:'28px',marginBottom:'22px'}}>
                  <div style={{fontSize:'22px',fontWeight:'600',color:'#0a0a0a',marginBottom:'4px'}}>{form.campaign_name}</div>
                  <div style={{fontSize:'13px',color:'#888',marginBottom:'12px'}}>{form.video_type} · {form.format} · {dur}</div>
                  {form.platforms.length>0&&(
                    <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'16px'}}>
                      {form.platforms.map(p=>(<span key={p} style={{fontSize:'10px',padding:'3px 10px',background:'rgba(34,197,94,0.08)',color:'#22c55e',fontWeight:'500'}}>{p}</span>))}
                    </div>
                  )}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'16px'}}>
                    {[{label:'Süre',value:dur},{label:'Format',value:form.format||'—'},{label:'Brief',value:`${wordCount} kelime`},{label:'Hazırlayan',value:userName.split(' ')[0]||'—'}].map(s=>(
                      <div key={s.label} style={{background:'#fff',padding:'12px'}}>
                        <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>{s.label}</div>
                        <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  {form.message&&(<div style={{marginTop:'20px'}}><div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'6px'}}>Brief Metni</div><div style={{fontSize:'14px',color:'#333',lineHeight:1.7}}>{form.message}</div></div>)}
                  {form.has_cta==='yes'&&form.cta&&(<div style={{marginTop:'14px'}}><div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>CTA</div><div style={{fontSize:'14px',color:'#333',lineHeight:1.7}}>{form.cta}</div></div>)}
                  {form.target_audience&&(<div style={{marginTop:'14px'}}><div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>Hedef Kitle</div><div style={{fontSize:'14px',color:'#333',lineHeight:1.7}}>{form.target_audience}</div></div>)}
                  {form.voiceover_type!=='none'&&(<div style={{marginTop:'14px'}}><div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>Seslendirme</div><div style={{fontSize:'14px',color:'#333'}}>{form.voiceover_type==='real'?'Gerçek Seslendirme':'AI Seslendirme'}{form.voiceover_gender?` (${form.voiceover_gender==='male'?'Erkek':'Kadın'})`:''}</div></div>)}
                  {form.languages.length>0&&(<div style={{marginTop:'14px'}}><div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'6px'}}>Yabancı Dil Versiyonları</div><div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>{form.languages.map(lid=>{const langMap:Record<string,{label:string,flag:string}>={en:{label:'İngilizce',flag:'🇬🇧'},de:{label:'Almanca',flag:'🇩🇪'},fr:{label:'Fransızca',flag:'🇫🇷'},ru:{label:'Rusça',flag:'🇷🇺'},ar:{label:'Arapça',flag:'🇸🇦'},it:{label:'İtalyanca',flag:'🇮🇹'},es:{label:'İspanyolca',flag:'🇪🇸'}};const l=langMap[lid];return l?<span key={lid} style={{fontSize:'12px',padding:'4px 12px',background:'rgba(34,197,94,0.08)',color:'#22c55e',fontWeight:'500'}}>{l.flag} {l.label}</span>:null})}</div></div>)}
                  {productImageUrl&&(<div style={{marginTop:'14px'}}><div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>Ürün Görseli</div><div style={{fontSize:'12px',color:'#22c55e'}}>Yüklendi</div></div>)}
                  {brandFiles.length>0&&(<div style={{marginTop:'14px'}}><div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>Marka Materyalleri</div><div style={{fontSize:'12px',color:'#0a0a0a'}}>{brandFiles.length} dosya</div></div>)}
                  {form.reference_links.length>0&&(<div style={{marginTop:'14px'}}><div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>Referans Linkler</div><div style={{display:'flex',flexDirection:'column',gap:'2px'}}>{form.reference_links.map((l,i)=>(<a key={i} href={l} target="_blank" rel="noopener noreferrer" style={{fontSize:'12px',color:'#0a0a0a'}}>{l}</a>))}</div></div>)}
                  <div style={{marginTop:'20px',background:'var(--color-background-secondary)',border:'1px solid #0a0a0a',padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:'14px',color:'var(--color-text-secondary)'}}>Toplam Kredi</span>
                    <span style={{fontSize:'15px',fontWeight:'500',color:'var(--color-text-primary)'}}>{cost} kredi</span>
                  </div>
                </div>

                {/* BRIEF SCORE — compact single line */}
                <div style={{background:'#fff',border:'1px solid #e5e4db',padding:'14px 18px',marginBottom:'22px',display:'flex',alignItems:'center',gap:'12px'}}>
                  {scoreLoading ? (
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}><div className="spinner" style={{width:'12px',height:'12px',border:'2px solid #ddd',borderTopColor:'#0a0a0a'}} /><span style={{fontSize:'12px',color:'var(--color-text-tertiary)'}}>hesaplanıyor...</span></div>
                  ) : briefScore ? (
                    <>
                      <div style={{fontSize:'24px',fontWeight:'500',color:briefScore.score>=80?'#22c55e':briefScore.score>=60?'#f59e0b':'#ef4444',letterSpacing:'-1px',flexShrink:0}}>{briefScore.score}</div>
                      <div style={{fontSize:'11px',letterSpacing:'1.5px',textTransform:'uppercase',fontWeight:'500',color:briefScore.score>=80?'#22c55e':briefScore.score>=60?'#f59e0b':'#ef4444',flexShrink:0}}>{briefScore.label}</div>
                      {briefScore.suggestion && <div style={{fontSize:'12px',color:'#6b6b66',fontStyle:'italic',borderLeft:'1px solid #e5e4db',paddingLeft:'12px'}}>· {briefScore.suggestion}</div>}
                    </>
                  ) : (<span style={{fontSize:'12px',color:'#aaa'}}>Skor hesaplanamadı.</span>)}
                </div>

                {balance < cost && (
                  <div style={{background:'rgba(239,68,68,0.06)',border:'1px solid #ef4444',padding:'14px',fontSize:'13px',color:'#dc2626'}}>Yetersiz kredi. Bakiyeniz: {balance} kredi.</div>
                )}
              </div>
            )
          })()}

          {step >= 1 && (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'48px',paddingBottom:'24px'}}>
              <button onClick={()=>step>1?setStep(step-1):router.push('/dashboard/client')}
                className="btn btn-outline">
                {step===1?'İPTAL':'GERİ'}
              </button>
              {step<6?(
                <button onClick={()=>setStep(step+1)}
                  disabled={
                    (step===1&&(!form.campaign_name||!form.video_type||!form.format))||
                    (step===2&&(!form.target_audience||!form.has_cta))||
                    (step===3&&!form.message)
                  }
                  className="btn"
                  style={{opacity:(step===1&&(!form.campaign_name||!form.video_type||!form.format))||(step===2&&(!form.target_audience||!form.has_cta))||(step===3&&!form.message)?0.4:1}}>
                  DEVAM →</button>
              ):(
                <div style={{display:'flex',gap:'8px'}}>
                  <button onClick={()=>handleSubmit(true)} disabled={submitting} className="btn btn-outline">
                    {submitting?'...':'TASLAK KAYDET'}
                  </button>
                  <button onClick={()=>handleSubmit(false)} disabled={submitting||balance<cost} className="btn btn-accent">
                    {submitting?'GÖNDERİLİYOR...':'BRİEF GÖNDER →'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
