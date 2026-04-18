'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'

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
  const [isDraftEdit, setIsDraftEdit] = useState(false)
  const [briefScore, setBriefScore] = useState<any>(null)
  const [scoreLoading, setScoreLoading] = useState(false)
  const [expandLoading, setExpandLoading] = useState(false)
  const [prevMessage, setPrevMessage] = useState<string|null>(null)
  const filesRef = useRef<HTMLInputElement>(null)
  const productImageRef = useRef<HTMLInputElement>(null)
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null)
  const [productUploading, setProductUploading] = useState(false)

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
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name').eq('id', user.id).single()
      setUserName(userData?.name || '')
      const { data: cu } = await supabase.from('client_users').select('*, clients(company_name, credit_balance, ai_video_enabled)').eq('user_id', user.id).single()
      setClientUser(cu)
      setCompanyName((cu as any)?.clients?.company_name || '')
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
          })
          setStep(1)
        }
      })
    }
  }, [searchParams])

  // Fetch brief score when entering step 5
  useEffect(() => {
    if (step !== 5) { setBriefScore(null); return }
    if (scoreLoading) return
    setScoreLoading(true)
    fetch('/api/brief-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief: form })
    }).then(r => r.json()).then(data => {
      if (data.total) setBriefScore(data)
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

  const steps = ['Kampanya & Format','Hedef & CTA','Brief Metni','Seslendirme','Son Kontrol']

  function Sidebar() {
    return (
      <div style={{width:'240px',background:'#0A0A0A',display:'flex',flexDirection:'column',flexShrink:0,height:'100vh',position:'sticky',top:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{height:'28px'}} />
        </div>
        <div style={{margin:'12px 12px',padding:'16px 20px',background:'#111',borderLeft:'3px solid #1DB81D'}}>
          <div style={{fontSize:'18px',fontWeight:'700',color:'#fff',marginBottom:'2px'}}>{companyName || 'Dinamo'}</div>
          <div style={{fontSize:'13px',fontWeight:'400',color:'#888',marginBottom:'12px'}}>{userName}</div>
          <div style={{fontSize:'10px',color:'#AAA',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'8px'}}>KREDİ BAKİYESİ</div>
          <div style={{fontSize:'28px',fontWeight:'700',color:'#fff',letterSpacing:'-1px',marginBottom:'8px'}}>{balance}</div>
          {cost > 0 && (
            <div style={{background:'rgba(34,197,94,0.1)',border:'0.5px solid rgba(34,197,94,0.2)',borderRadius:'8px',padding:'8px 10px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:'10px',color:'rgba(34,197,94,0.7)'}}>Bu brief</span>
                <span style={{fontSize:'14px',fontWeight:'500',color:'#22c55e'}}>{cost} kredi</span>
              </div>
              {form.voiceover_type==='real' && <div style={{fontSize:'9px',color:'rgba(34,197,94,0.5)',marginTop:'2px'}}>+6 gerçek seslendirme</div>}
              {form.languages.length>0 && <div style={{fontSize:'9px',color:'rgba(34,197,94,0.5)',marginTop:'2px'}}>+{form.languages.length*2} dil versiyonu ({form.languages.length} dil)</div>}
            </div>
          )}
        </div>

        <div style={{padding:'10px 8px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
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
                    <div style={{fontSize:'11px',color:isDone?'#888':isCur?'#fff':'#666',fontWeight:isCur?'500':'400'}}>
                      {n===1&&form.campaign_name?form.campaign_name.substring(0,18)+(form.campaign_name.length>18?'…':''):s}
                    </div>
                    {isDone&&n===1&&form.video_type&&<div style={{fontSize:'9px',color:'rgba(255,255,255,0.2)',marginTop:'1px'}}>{form.video_type} · {form.format}</div>}
                  </div>
                </div>
                {n<5&&<div style={{width:'1px',height:'8px',background:'#2A2A2A',marginLeft:'14px'}}></div>}
              </div>
            )
          })}
        </div>

        <div style={{flex:1}}></div>
        <div style={{padding:'10px 8px',borderTop:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div onClick={()=>router.push('/dashboard/client')} style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',borderRadius:'7px',cursor:'pointer'}}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{fontSize:'11px',color:'#aaa',fontFamily:'var(--font-dm-sans),sans-serif'}}>Projelerime dön</span>
          </div>
        </div>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width:'100%',boxSizing:'border-box',background:'#fff',border:'0.5px solid rgba(0,0,0,0.12)',
    borderRadius:'10px',padding:'10px 14px',fontSize:'14px',color:'#0a0a0a',
    fontFamily:'var(--font-dm-sans),sans-serif',outline:'none'
  }
  const pillStyle = (sel:boolean): React.CSSProperties => ({
    padding:'8px 18px',borderRadius:'100px',border:'0.5px solid',
    borderColor:sel?'#111113':'rgba(0,0,0,0.12)',
    background:sel?'#111113':'#fff',
    color:sel?'#fff':'#555',fontSize:'13px',cursor:'pointer',
    fontFamily:'var(--font-dm-sans),sans-serif',display:'inline-block',margin:'3px'
  })

  if (step === 99) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0a0a',fontFamily:"var(--font-dm-sans),'DM Sans',system-ui,sans-serif"}}>
        <div style={{textAlign:'center',maxWidth:'520px',padding:'0 24px'}}>
          <div style={{fontSize:'28px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'32px'}}>
            <img src="/dinamo_logo.png" alt="Dinamo" style={{height:'28px'}} />
          </div>
          <div style={{fontSize:'36px',fontWeight:'300',color:'#fff',letterSpacing:'-1px',marginBottom:'12px'}}>Brief'iniz alındı.</div>
          <div style={{fontSize:'18px',fontWeight:'300',color:'#fff',fontStyle:'italic',marginBottom:'24px'}}>"{form.campaign_name}"</div>
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

          {(clientUser as any)?.clients?.ai_video_enabled && savedBriefId && (
            <div style={{marginTop:'48px',padding:'28px',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'12px',maxWidth:'420px',margin:'48px auto 0'}}>
              <div style={{fontSize:'15px',fontWeight:'600',color:'#fff',marginBottom:'8px',display:'flex',alignItems:'center',gap:'6px'}}>
                <span style={{color:'#1DB81D'}}>&#9889;</span> Full AI Video Stüdyosu <span style={{fontSize:'10px',color:'#888',fontWeight:'400'}}>Beta</span>
              </div>
              <div style={{fontSize:'12px',color:'rgba(255,255,255,0.45)',lineHeight:1.7,marginBottom:'16px'}}>
                Briefinizi beklemeden hemen AI ile test edin. Yapay zeka briefinizden yola çıkarak ~5 dakikada fikir, görsel, ses ve müzik üretir. Sonuçlar deneyseldir, garanti edilmez.
              </div>
              <a href={`/dashboard/client/briefs/${savedBriefId}`}
                style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'12px 24px',background:'#0a0a0a',color:'#fff',border:'1px solid #1DB81D',borderRadius:'2px',fontSize:'13px',fontWeight:'600',textDecoration:'none',fontFamily:'var(--font-dm-sans),sans-serif',transition:'background 0.15s'}}
                onMouseEnter={(e:any)=>(e.currentTarget.style.background='#1DB81D')}
                onMouseLeave={(e:any)=>(e.currentTarget.style.background='#0a0a0a')}>
                <span>&#9889;</span> Full AI Video Üret — Ücretsiz Dene
              </a>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"var(--font-dm-sans),'DM Sans',system-ui,sans-serif"}}>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f5f4f0',overflow:'hidden'}}>
        <div style={{padding:'14px 28px',background:'#fff',borderBottom:'0.5px solid rgba(0,0,0,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div style={{fontSize:'12px',color:'#888'}}>Yeni Brief{step > 0 ? <> / <span style={{color:'#0a0a0a',fontWeight:'500'}}>{steps[step-1]}</span></> : ''}</div>
          {step > 0 && <div style={{fontSize:'11px',color:'#aaa'}}>Adım {step} / 5</div>}
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'32px 40px',maxWidth:'640px'}}>

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
              <div style={{fontSize:'26px',fontWeight:'300',color:'#0a0a0a',letterSpacing:'-0.5px',marginBottom:'8px'}}>Bize anlatın</div>
              <div style={{fontSize:'14px',color:'#888',marginBottom:'24px',lineHeight:'1.6'}}>Ne aklınızdaysa yazın — gerisini biz halledelim.</div>
              <textarea
                value={aiBriefInput}
                onChange={e=>setAiBriefInput(e.target.value)}
                placeholder="Videonuz hakkında aklınızda ne varsa yazın — ürününüz, mesajınız, hedef kitleniz, kullanmak istediğiniz platform..."
                rows={8}
                style={{...inputStyle,resize:'vertical',lineHeight:'1.7',marginBottom:'16px',fontSize:'14px'}} />
              <div style={{display:'flex',gap:'10px'}}>
                <button onClick={()=>setStep(0)} style={{background:'none',border:'0.5px solid rgba(0,0,0,0.15)',borderRadius:'8px',padding:'11px 20px',fontSize:'13px',fontFamily:'var(--font-dm-sans),sans-serif',color:'#555',cursor:'pointer'}}>Geri</button>
                <button onClick={handleAiBrief} disabled={aiBriefLoading||!aiBriefInput.trim()}
                  style={{background:'#22c55e',color:'#fff',border:'none',borderRadius:'8px',padding:'11px 24px',fontSize:'13px',fontFamily:'var(--font-dm-sans),sans-serif',cursor:'pointer',fontWeight:'500',opacity:aiBriefLoading||!aiBriefInput.trim()?0.5:1,display:'flex',alignItems:'center',gap:'8px'}}>
                  {aiBriefLoading?'Brief oluşturuluyor...':'Brief Oluştur'}
                </button>
              </div>
            </div>
          )}

          {/* ADIM 1 */}
          {step===1&&(
            <div>
              <div style={{fontSize:'10px',letterSpacing:'1px',color:'#888',textTransform:'uppercase',marginBottom:'8px'}}>Adım 1 / 5</div>
              <div style={{fontSize:'26px',fontWeight:'300',color:'#0a0a0a',letterSpacing:'-0.5px',marginBottom:'28px'}}>Kampanyanıza bir isim verin</div>
              <div style={{marginBottom:'22px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>Kampanya Adı</div>
                <input style={inputStyle} value={form.campaign_name} onChange={e=>setForm({...form,campaign_name:e.target.value})} placeholder="örn. Yaz Kampanyası 2025..." />
              </div>
              <div style={{marginBottom:'22px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>Video Tipi</div>
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>{VIDEO_TYPES.map(t=>{
                  const sel = form.video_type===t
                  return <span key={t} style={{...pillStyle(sel),display:'inline-flex',flexDirection:'column',alignItems:'center',gap:'2px',padding:'10px 18px'}} onClick={()=>setForm({...form,video_type:t})}>
                    <span>{t}</span>
                    <span style={{fontSize:'10px',color:sel?'rgba(255,255,255,0.7)':'#aaa'}}>{VIDEO_DURATIONS[t]}</span>
                  </span>
                })}</div>
              </div>
              <div style={{marginBottom:'8px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>Format</div>
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
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>Video hangi mecralarda kullanılacak?</div>
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
              <div style={{marginTop:'22px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'4px'}}>Yabancı Dil Versiyonu</div>
                <div style={{fontSize:'11px',color:'#aaa',marginBottom:'10px'}}>Her dil için +2 kredi uygulanır</div>
                <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                  {[
                    {id:'en',label:'İngilizce',flag:'🇬🇧'},
                    {id:'de',label:'Almanca',flag:'🇩🇪'},
                    {id:'fr',label:'Fransızca',flag:'🇫🇷'},
                    {id:'ru',label:'Rusça',flag:'🇷🇺'},
                    {id:'ar',label:'Arapça',flag:'🇸🇦'},
                    {id:'it',label:'İtalyanca',flag:'🇮🇹'},
                    {id:'es',label:'İspanyolca',flag:'🇪🇸'},
                  ].map(lang=>{
                    const sel = form.languages.includes(lang.id)
                    return (
                      <div key={lang.id} onClick={()=>setForm(prev=>({...prev,languages:prev.languages.includes(lang.id)?prev.languages.filter(x=>x!==lang.id):[...prev.languages,lang.id]}))}
                        style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px',borderRadius:'100px',cursor:'pointer',transition:'all 0.15s',
                          border:sel?'1.5px solid #22c55e':'1px solid rgba(0,0,0,0.12)',
                          background:sel?'rgba(34,197,94,0.06)':'#fff',
                          color:sel?'#22c55e':'#888'}}>
                        <span>{lang.flag}</span>
                        <span style={{fontSize:'12px',fontWeight:'500'}}>{lang.label}</span>
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
              <div style={{fontSize:'10px',letterSpacing:'1px',color:'#888',textTransform:'uppercase',marginBottom:'8px'}}>Adım 2 / 5 · {form.campaign_name}</div>
              <div style={{fontSize:'26px',fontWeight:'300',color:'#0a0a0a',letterSpacing:'-0.5px',marginBottom:'28px'}}>Kimi hedefliyorsunuz?</div>
              <div style={{marginBottom:'22px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>Hedef Kitle</div>
                <input style={inputStyle} value={form.target_audience} onChange={e=>setForm({...form,target_audience:e.target.value})} placeholder="örn. 25-40 yaş, online alışveriş yapan..." />
              </div>
              <div style={{marginBottom:'22px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>Call to Action var mı?</div>
                <div>
                  <span style={pillStyle(form.has_cta==='yes')} onClick={()=>setForm({...form,has_cta:'yes'})}>Evet, var</span>
                  <span style={pillStyle(form.has_cta==='no')} onClick={()=>setForm({...form,has_cta:'no',cta:''})}>Hayır, yok</span>
                </div>
              </div>
              {form.has_cta==='yes'&&(
                <div style={{marginBottom:'8px'}}>
                  <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>CTA Metni</div>
                  <input style={inputStyle} value={form.cta} onChange={e=>setForm({...form,cta:e.target.value})} placeholder="örn. Hemen sipariş ver, %30 indirim fırsatını kaçırma..." />
                </div>
              )}
            </div>
          )}

          {/* ADIM 3 */}
          {step===3&&(
            <div>
              <div style={{fontSize:'10px',letterSpacing:'1px',color:'#888',textTransform:'uppercase',marginBottom:'8px'}}>Adım 3 / 5 · {form.campaign_name}</div>
              <div style={{fontSize:'26px',fontWeight:'300',color:'#0a0a0a',letterSpacing:'-0.5px',marginBottom:'8px'}}>Brief'inizi yazın</div>
              <div style={{fontSize:'13px',color:'#888',marginBottom:'24px',lineHeight:'1.6'}}>Ne anlatmak istiyorsunuz? Tonunuzu, mesajınızı, hikayenizi ve önemli detayları buraya yazın. Ne kadar detaylı olursa o kadar iyi.</div>
              <div style={{position:'relative'}}>
                <textarea style={{...inputStyle,resize:'vertical',lineHeight:'1.7',paddingTop:'36px',opacity:expandLoading?0.5:1,transition:'opacity 0.2s'}} rows={10} value={form.message} onChange={e=>{setForm({...form,message:e.target.value});setPrevMessage(null)}} placeholder="Videonun mesajını, tonunu, hikayesini ve önemli detaylarını buraya yazın. Referans video veya reklam varsa linkini de ekleyebilirsiniz..." />
                <div style={{position:'absolute',top:'8px',right:'8px',display:'flex',gap:'5px',zIndex:2}}>
                  {prevMessage !== null && !expandLoading && (
                    <button onClick={handleUndoExpand}
                      style={{display:'flex',alignItems:'center',gap:'4px',padding:'3px 8px',borderRadius:'5px',border:'1px solid rgba(0,0,0,0.12)',background:'#fff',fontSize:'10px',color:'#888',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6.69 3L3 13"/></svg>
                      Geri Al
                    </button>
                  )}
                  <button onClick={handleExpand} disabled={expandLoading || !form.message.trim()}
                    style={{display:'flex',alignItems:'center',gap:'4px',padding:'3px 8px',borderRadius:'5px',border:'none',background:expandLoading||!form.message.trim()?'rgba(0,0,0,0.04)':'#111113',fontSize:'10px',color:expandLoading||!form.message.trim()?'#ccc':'#fff',cursor:expandLoading||!form.message.trim()?'default':'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>
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
              <div style={{fontSize:'10px',letterSpacing:'1px',color:'#888',textTransform:'uppercase',marginBottom:'8px'}}>Adım 4 / 5 · {form.campaign_name}</div>
              <div style={{fontSize:'26px',fontWeight:'300',color:'#0a0a0a',letterSpacing:'-0.5px',marginBottom:'28px'}}>Seslendirme</div>
              <div style={{marginBottom:'22px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>Seslendirme Tipi</div>
                <div>
                  <span style={pillStyle(form.voiceover_type==='none')} onClick={()=>setForm({...form,voiceover_type:'none',voiceover_gender:'',voiceover_text:''})}>Yok</span>
                  <span style={pillStyle(form.voiceover_type==='ai')} onClick={()=>setForm({...form,voiceover_type:'ai',voiceover_gender:'female'})}>AI Seslendirme</span>
                  <span style={pillStyle(form.voiceover_type==='real')} onClick={()=>setForm({...form,voiceover_type:'real',voiceover_gender:'female'})}>Gerçek Seslendirme (+6 kredi)</span>
                </div>
              </div>
              {form.voiceover_type!=='none'&&(
                <div style={{marginBottom:'22px'}}>
                  <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>Seslendirme Cinsiyeti</div>
                  <div>
                    <span style={pillStyle(form.voiceover_gender==='female')} onClick={()=>setForm({...form,voiceover_gender:'female'})}>Kadın Sesi</span>
                    <span style={pillStyle(form.voiceover_gender==='male')} onClick={()=>setForm({...form,voiceover_gender:'male'})}>Erkek Sesi</span>
                  </div>
                </div>
              )}
              {form.voiceover_type!=='none'&&(
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                    <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase'}}>Seslendirme Metni</div>
                    <button onClick={generateVoiceover} disabled={aiLoading} style={{fontSize:'11px',padding:'5px 12px',borderRadius:'6px',border:'0.5px solid rgba(0,0,0,0.15)',background:'#111113',color:'#fff',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>
                      {aiLoading?'Yazıyor...':form.voiceover_text?'Yeniden Yaz':'AI ile Yaz'}
                    </button>
                  </div>
                  <textarea style={{...inputStyle,resize:'vertical',lineHeight:'1.7'}} rows={6} value={form.voiceover_text} onChange={e=>setForm({...form,voiceover_text:e.target.value})} placeholder="Seslendirme metnini yazın veya AI ile oluşturun..." />
                </div>
              )}
              {form.voiceover_type==='none'&&(
                <div style={{padding:'16px',background:'rgba(0,0,0,0.03)',borderRadius:'10px',fontSize:'13px',color:'#888',lineHeight:'1.6'}}>
                  Seslendirme olmadan da videonuz için müzik ve efekt kullanabiliriz.
                </div>
              )}
            </div>
          )}

          {/* ADIM 5 */}
          {step===5&&(()=>{
            const durMap:Record<string,string>={'Bumper / Pre-roll':'6 sn','Story / Reels':'15 sn','Feed Video':'30 sn','Long Form':'60 sn'}
            const dur=durMap[form.video_type]||'—'
            const wordCount=form.message?form.message.trim().split(/\s+/).length:0
            return (
              <div>
                <div style={{fontSize:'10px',letterSpacing:'1px',color:'#888',textTransform:'uppercase',marginBottom:'8px'}}>Adım 5 / 5 · {form.campaign_name}</div>
                <div style={{fontSize:'26px',fontWeight:'300',color:'#0a0a0a',letterSpacing:'-0.5px',marginBottom:'28px'}}>Son notlar</div>

                {/* BRIEF SUMMARY */}
                <div style={{background:'#f0efeb',borderRadius:'16px',padding:'28px',marginBottom:'22px'}}>
                  <div style={{fontSize:'22px',fontWeight:'600',color:'#0a0a0a',marginBottom:'4px'}}>{form.campaign_name}</div>
                  <div style={{fontSize:'13px',color:'#888',marginBottom:'12px'}}>{form.video_type} · {form.format} · {dur}</div>
                  {form.platforms.length>0&&(
                    <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'16px'}}>
                      {form.platforms.map(p=>(
                        <span key={p} style={{fontSize:'10px',padding:'3px 10px',borderRadius:'100px',background:'rgba(34,197,94,0.08)',color:'#22c55e',fontWeight:'500'}}>{p}</span>
                      ))}
                    </div>
                  )}

                  {/* 4 STAT BOXES */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'16px'}}>
                    {[
                      {label:'Süre',value:dur},
                      {label:'Format',value:form.format||'—'},
                      {label:'Brief',value:`${wordCount} kelime`},
                      {label:'Hazırlayan',value:userName.split(' ')[0]||'—'},
                    ].map(s=>(
                      <div key={s.label} style={{background:'#fff',borderRadius:'8px',padding:'12px'}}>
                        <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>{s.label}</div>
                        <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* BRIEF TEXT */}
                  {form.message&&(
                    <div style={{marginTop:'20px'}}>
                      <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'6px'}}>Brief Metni</div>
                      <div style={{fontSize:'14px',color:'#333',lineHeight:1.7}}>{form.message}</div>
                    </div>
                  )}
                  {form.has_cta==='yes'&&form.cta&&(
                    <div style={{marginTop:'14px'}}>
                      <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>CTA</div>
                      <div style={{fontSize:'14px',color:'#333',lineHeight:1.7}}>{form.cta}</div>
                    </div>
                  )}
                  {form.target_audience&&(
                    <div style={{marginTop:'14px'}}>
                      <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>Hedef Kitle</div>
                      <div style={{fontSize:'14px',color:'#333',lineHeight:1.7}}>{form.target_audience}</div>
                    </div>
                  )}
                  {form.voiceover_type!=='none'&&(
                    <div style={{marginTop:'14px'}}>
                      <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>Seslendirme</div>
                      <div style={{fontSize:'14px',color:'#333'}}>{form.voiceover_type==='real'?'Gerçek Seslendirme':'AI Seslendirme'}{form.voiceover_gender?` (${form.voiceover_gender==='male'?'Erkek':'Kadın'})`:''}</div>
                    </div>
                  )}
                  {form.languages.length>0&&(
                    <div style={{marginTop:'14px'}}>
                      <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'6px'}}>Yabancı Dil Versiyonları</div>
                      <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                        {form.languages.map(lid=>{
                          const langMap:Record<string,{label:string,flag:string}>={en:{label:'İngilizce',flag:'🇬🇧'},de:{label:'Almanca',flag:'🇩🇪'},fr:{label:'Fransızca',flag:'🇫🇷'},ru:{label:'Rusça',flag:'🇷🇺'},ar:{label:'Arapça',flag:'🇸🇦'},it:{label:'İtalyanca',flag:'🇮🇹'},es:{label:'İspanyolca',flag:'🇪🇸'}}
                          const l=langMap[lid]
                          return l?<span key={lid} style={{fontSize:'12px',padding:'4px 12px',borderRadius:'100px',background:'rgba(34,197,94,0.08)',color:'#22c55e',fontWeight:'500'}}>{l.flag} {l.label}</span>:null
                        })}
                      </div>
                    </div>
                  )}

                  {/* CREDIT */}
                  <div style={{marginTop:'20px',background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.15)',borderRadius:'10px',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:'13px',color:'#0a0a0a'}}>Toplam Kredi</span>
                    <span style={{fontSize:'18px',fontWeight:'500',color:'#22c55e'}}>{cost} kredi</span>
                  </div>
                </div>

                {/* BRIEF SCORE */}
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px',marginBottom:'22px'}}>
                  <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'14px'}}>Brief Kalite Skoru</div>
                  {scoreLoading ? (
                    <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                      {[1,2,3,4].map(i=>(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:'12px'}}>
                          <div style={{width:'80px',height:'10px',borderRadius:'4px',background:'rgba(0,0,0,0.06)',animation:'pulse 1.5s infinite'}} />
                          <div style={{flex:1,height:'6px',borderRadius:'3px',background:'rgba(0,0,0,0.04)'}} />
                        </div>
                      ))}
                      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
                    </div>
                  ) : briefScore ? (
                    <div>
                      <div style={{display:'flex',alignItems:'baseline',gap:'8px',marginBottom:'16px'}}>
                        <div style={{fontSize:'36px',fontWeight:'300',letterSpacing:'-2px',color:briefScore.total>=80?'#22c55e':briefScore.total>=60?'#f59e0b':'#ef4444'}}>{briefScore.total}</div>
                        <div style={{fontSize:'13px',color:'#aaa'}}>/100</div>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                        {briefScore.criteria?.map((c: any)=>(
                          <div key={c.key}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                              <span style={{fontSize:'12px',color:'#0a0a0a',fontWeight:'500'}}>{c.label}</span>
                              <span style={{fontSize:'12px',color:c.score>=80?'#22c55e':c.score>=60?'#f59e0b':'#ef4444',fontWeight:'500'}}>{c.score}</span>
                            </div>
                            <div style={{width:'100%',height:'4px',background:'rgba(0,0,0,0.06)',borderRadius:'2px',overflow:'hidden'}}>
                              <div style={{width:`${c.score}%`,height:'100%',borderRadius:'2px',background:c.score>=80?'#22c55e':c.score>=60?'#f59e0b':'#ef4444',transition:'width 0.6s ease'}} />
                            </div>
                            {c.tip && <div style={{fontSize:'11px',color:'#999',fontStyle:'italic',marginTop:'4px',lineHeight:'1.4'}}>{c.tip}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{fontSize:'12px',color:'#aaa'}}>Skor hesaplanamadı.</div>
                  )}
                </div>

                {/* NOTES */}
                <div style={{marginBottom:'22px'}}>
                  <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>Uyarılar, Hassasiyetler & Eklemek İstedikleriniz</div>
                  <textarea style={{...inputStyle,resize:'vertical',lineHeight:'1.7'}} rows={4} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Kaçınılması gereken içerik, hassas konular, marka kısıtlamaları veya eklemek istediğiniz herhangi bir bilgi..." />
                </div>

                {/* FILES */}
                <div style={{marginBottom:'22px'}}>
                  <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>Referans Dosyalar</div>
                  <div style={{background:'#f5f4f0',borderRadius:'10px',padding:'16px',display:'flex',alignItems:'center',gap:'12px'}}>
                    <input ref={filesRef} type="file" multiple style={{fontSize:'12px',color:'#0a0a0a',flex:1}} />
                  </div>
                  <div style={{fontSize:'10px',color:'#aaa',marginTop:'6px'}}>Opsiyonel. Logo, referans video, moodboard vb.</div>
                </div>

                {/* PRODUCT IMAGE */}
                <div style={{marginBottom:'22px'}}>
                  <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',marginBottom:productImageUrl?'12px':'0'}}>
                    <input type="checkbox" checked={!!productImageUrl || productUploading} onChange={e=>{if(!e.target.checked){setProductImageUrl(null)}}} style={{accentColor:'#22c55e'}} />
                    <span style={{fontSize:'13px',color:'#0a0a0a'}}>Bu kampanya için ürün görselim var</span>
                  </label>
                  {(productImageUrl || productUploading) ? (
                    productImageUrl ? (
                      <div style={{display:'flex',alignItems:'center',gap:'12px',background:'#f5f4f0',borderRadius:'10px',padding:'12px 16px'}}>
                        <img src={productImageUrl} alt="Ürün" style={{width:'48px',height:'48px',objectFit:'cover',borderRadius:'8px',border:'0.5px solid rgba(0,0,0,0.1)'}} />
                        <div style={{flex:1}}>
                          <div style={{fontSize:'12px',color:'#22c55e',fontWeight:'500'}}>Yüklendi</div>
                          <div style={{fontSize:'10px',color:'#888',marginTop:'2px'}}>AI video ürününüzü kullanarak oluşturulacak</div>
                        </div>
                        <button onClick={()=>setProductImageUrl(null)} style={{fontSize:'11px',color:'#ef4444',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>Kaldır</button>
                      </div>
                    ) : (
                      <div style={{fontSize:'11px',color:'#888',padding:'12px'}}>Yükleniyor...</div>
                    )
                  ) : null}
                  {!productImageUrl && !productUploading && (
                    <div style={{marginTop:'8px',display:'flex',gap:'8px',alignItems:'flex-start'}}>
                      <div style={{flex:1}}>
                        <input placeholder="Görsel URL yapıştır (jpg, png, webp)" onBlur={e=>{const v=e.target.value.trim();if(v&&/\.(jpg|jpeg|png|webp)/i.test(v)){setProductImageUrl(v);e.target.value=''}}}
                          style={{...inputStyle,fontSize:'12px',padding:'9px 12px'}} />
                      </div>
                      <div style={{fontSize:'11px',color:'#aaa',lineHeight:'36px'}}>veya</div>
                      <div>
                        <input ref={productImageRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleProductImageUpload}
                          style={{fontSize:'11px',width:'130px'}} disabled={productUploading} />
                      </div>
                    </div>
                  )}
                  <div style={{fontSize:'10px',color:'#aaa',marginTop:'6px'}}>Ürün görseli yüklerseniz AI video ürününüzü kullanarak oluşturur. JPG, PNG, WebP — max 10MB</div>
                </div>

                {balance < cost && (
                  <div style={{background:'#fef2f2',border:'0.5px solid #fca5a5',borderRadius:'10px',padding:'14px',fontSize:'13px',color:'#dc2626'}}>
                    Yetersiz kredi. Bakiyeniz: {balance} kredi.
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {step >= 1 && (
          <div style={{padding:'16px 40px',background:'#fff',borderTop:'0.5px solid rgba(0,0,0,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
            <button onClick={()=>step>1?setStep(step-1):router.push('/dashboard/client')}
              style={{background:'none',border:'0.5px solid rgba(0,0,0,0.15)',borderRadius:'8px',padding:'9px 20px',fontSize:'13px',fontFamily:'var(--font-dm-sans),sans-serif',color:'#555',cursor:'pointer'}}>
              {step===1?'İptal':'Geri'}
            </button>
            {step<5?(
              <button onClick={()=>setStep(step+1)}
                disabled={
                  (step===1&&(!form.campaign_name||!form.video_type||!form.format))||
                  (step===2&&(!form.target_audience||!form.has_cta))||
                  (step===3&&!form.message)
                }
                style={{background:'#111113',color:'#fff',border:'none',borderRadius:'8px',padding:'9px 24px',fontSize:'13px',fontFamily:'var(--font-dm-sans),sans-serif',cursor:'pointer',fontWeight:'500',opacity:(step===1&&(!form.campaign_name||!form.video_type||!form.format))||(step===2&&(!form.target_audience||!form.has_cta))||(step===3&&!form.message)?0.4:1}}>
                Devam et               </button>
            ):(
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={()=>handleSubmit(true)} disabled={submitting}
                  style={{background:'none',border:'1px solid rgba(0,0,0,0.15)',borderRadius:'8px',padding:'9px 20px',fontSize:'13px',fontFamily:'var(--font-dm-sans),sans-serif',cursor:'pointer',fontWeight:'400',color:'#555'}}>
                  {submitting?'...':'Taslağa Kaydet'}
                </button>
                <button onClick={()=>handleSubmit(false)} disabled={submitting||balance<cost}
                  style={{background:'#22c55e',color:'#fff',border:'none',borderRadius:'8px',padding:'9px 24px',fontSize:'13px',fontFamily:'var(--font-dm-sans),sans-serif',cursor:'pointer',fontWeight:'500',opacity:balance<cost?0.4:1}}>
                  {submitting?'Gönderiliyor...':'Brief Gönder'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
