'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const VIDEO_TYPES = ['Bumper / Pre-roll', 'Story / Reels', 'Feed Video', 'Long Form']
const VIDEO_DURATIONS: Record<string, string> = { 'Bumper / Pre-roll': '6 saniye', 'Story / Reels': '15 saniye', 'Feed Video': '30 saniye', 'Long Form': '60 saniye' }
const FORMATS: { ratio: string; w: number; h: number }[] = [
  { ratio: '9:16', w: 27, h: 48 }, { ratio: '16:9', w: 48, h: 27 }, { ratio: '1:1', w: 36, h: 36 }, { ratio: '4:5', w: 32, h: 40 }, { ratio: '2:3', w: 28, h: 42 }
]
const BASE_COSTS: Record<string, number> = { 'Bumper / Pre-roll': 12, 'Story / Reels': 18, 'Feed Video': 24, 'Long Form': 36 }

export default function MemberNewBriefWrapper() {
  return <Suspense><MemberNewBrief /></Suspense>
}

function MemberNewBrief() {
  const router = useRouter()
  const [step, setStep] = useState(-2) // -2=client select, -1=mode select, 0=AI mode, 1-5=wizard, 6=scenario, 99=done
  const [agency, setAgency] = useState<any>(null)
  const [agencyId, setAgencyId] = useState<string | null>(null)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [clients, setClients] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [expandLoading, setExpandLoading] = useState(false)
  const [prevMessage, setPrevMessage] = useState<string | null>(null)
  const [aiBriefInput, setAiBriefInput] = useState('')
  const [aiBriefLoading, setAiBriefLoading] = useState(false)
  // Scenario step state
  const [scenarioPhase, setScenarioPhase] = useState<'ideas' | 'write' | 'done'>('ideas')
  const [ideas, setIdeas] = useState<any[]>([])
  const [ideasLoading, setIdeasLoading] = useState(false)
  const [selectedIdea, setSelectedIdea] = useState<any>(null)
  const [scenarioMode, setScenarioMode] = useState<'none' | 'ai' | 'manual' | 'paste'>('none')
  const [scenarioText, setScenarioText] = useState('')
  const [scenarioAiLoading, setScenarioAiLoading] = useState(false)
  const filesRef = useRef<HTMLInputElement>(null)
  const scenarioRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    client_name: '',
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
    languages: [] as string[],
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: ud } = await supabase.from('users').select('name, role, agency_id').eq('id', user.id).single()
      if (!ud || ud.role !== 'agency_member' || !ud.agency_id) { router.push('/login'); return }
      setUserName(ud.name)
      setAgencyId(ud.agency_id)
      setMemberId(user.id)
      const [{ data: ag }, { data: cls }] = await Promise.all([
        supabase.from('agencies').select('id, name, logo_url').eq('id', ud.agency_id).single(),
        supabase.from('clients').select('id, company_name').eq('agency_id', ud.agency_id).order('company_name'),
      ])
      setAgency(ag)
      setClients(cls || [])
    }
    load()
  }, [router])

  function calcCreditCost() {
    const base = BASE_COSTS[form.video_type] || 0
    const voiceCost = form.voiceover_type === 'real' ? 6 : 0
    const langCost = (form.languages?.length || 0) * 2
    return base + voiceCost + langCost
  }

  async function handleExpand() {
    if (!form.message.trim() || expandLoading) return
    setExpandLoading(true)
    setPrevMessage(form.message)
    try {
      const res = await fetch('/api/generate-brief', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_input: `Asagidaki brief metnini koru ama genislet.\n\n${form.message}\n\nKampanya: ${form.campaign_name}\nVideo Tipi: ${form.video_type}`, brand_name: form.client_name || agency?.name }),
      })
      const data = await res.json()
      if (data.message) setForm(prev => ({ ...prev, message: data.message }))
    } catch {}
    setExpandLoading(false)
  }

  async function generateVoiceover() {
    if (!form.message && !form.campaign_name) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/generate-voiceover', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_name: form.client_name || agency?.name, campaign_name: form.campaign_name, message: form.message, cta: form.cta, target_audience: form.target_audience, video_type: form.video_type }),
      })
      const data = await res.json()
      if (data.text) setForm(prev => ({ ...prev, voiceover_text: data.text }))
    } catch {}
    setAiLoading(false)
  }

  async function generateAiBrief() {
    if (!aiBriefInput.trim() || aiBriefLoading) return
    setAiBriefLoading(true)
    try {
      // Fetch past briefs for context if client selected
      let context = ''
      if (selectedClientId) {
        const { data: pastBriefs } = await supabase.from('briefs').select('campaign_name, message, target_audience, video_type').eq('client_id', selectedClientId).order('created_at', { ascending: false }).limit(5)
        if (pastBriefs && pastBriefs.length > 0) {
          context = '\n\nBu musterinin onceki briefleri (context olarak kullan, tekrar etme):\n' + pastBriefs.map((b: any) => `- ${b.campaign_name}: ${(b.message || '').substring(0, 200)}`).join('\n')
        }
      }
      const res = await fetch('/api/generate-brief', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_input: aiBriefInput + context, brand_name: form.client_name || agency?.name }),
      })
      const data = await res.json()
      if (data.campaign_name) setForm(prev => ({ ...prev, campaign_name: data.campaign_name }))
      if (data.video_type) setForm(prev => ({ ...prev, video_type: data.video_type }))
      if (data.format) setForm(prev => ({ ...prev, format: data.format }))
      if (data.target_audience) setForm(prev => ({ ...prev, target_audience: data.target_audience }))
      if (data.message) setForm(prev => ({ ...prev, message: data.message }))
      if (data.cta) setForm(prev => ({ ...prev, has_cta: 'yes', cta: data.cta }))
      if (data.platforms) setForm(prev => ({ ...prev, platforms: data.platforms }))
      setStep(1)
    } catch {}
    setAiBriefLoading(false)
  }

  const [ideasError, setIdeasError] = useState('')
  const [scenarioError, setScenarioError] = useState('')

  async function generateIdeas() {
    setIdeasLoading(true)
    setIdeasError('')
    try {
      const res = await fetch('/api/generate-ideas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_name: form.campaign_name,
          brand_name: form.client_name || agency?.name,
          message: form.message,
          target_audience: form.target_audience,
          video_type: form.video_type,
          cta: form.cta,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setIdeasError(data.error)
        setIdeasLoading(false)
        return
      }
      if (data.inspirations && data.inspirations.length > 0) {
        setIdeas(data.inspirations.map((i: any) => ({
          title: i.title || 'Fikir',
          description: i.concept || i.description || '',
          approach: i.approach || '',
        })))
      } else {
        setIdeasError('Fikir uretilemedi, lutfen tekrar deneyin.')
      }
    } catch (err: any) {
      setIdeasError(err.message || 'Baglanti hatasi')
    }
    setIdeasLoading(false)
  }

  async function generateScenarioFromIdea() {
    setScenarioAiLoading(true)
    setScenarioError('')
    try {
      const res = await fetch('/api/generate-scenario-text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_name: form.campaign_name,
          brand_name: form.client_name || agency?.name,
          message: form.message,
          target_audience: form.target_audience,
          video_type: form.video_type,
          format: form.format,
          cta: form.cta,
          idea_title: selectedIdea?.title,
          idea_concept: selectedIdea?.description,
          idea_approach: selectedIdea?.approach,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setScenarioError(data.error)
      } else if (data.scenario) {
        setScenarioText(data.scenario)
      }
    } catch (err: any) {
      setScenarioError(err.message || 'Baglanti hatasi')
    }
    setScenarioAiLoading(false)
  }

  async function handleSubmit(asDraft = false) {
    if (!agencyId || !memberId) return
    setSubmitting(true)
    const creditCost = asDraft ? 0 : calcCreditCost()

    const briefData: any = {
      campaign_name: form.campaign_name,
      client_name: form.client_name || null,
      client_id: selectedClientId || null,
      video_type: form.video_type,
      format: form.format,
      platforms: form.platforms.length > 0 ? form.platforms : null,
      message: form.message,
      cta: form.has_cta === 'yes' ? form.cta : null,
      target_audience: form.target_audience,
      voiceover_type: form.voiceover_type,
      voiceover_gender: form.voiceover_gender || null,
      voiceover_text: form.voiceover_text || null,
      notes: form.notes || null,
      languages: form.languages.length > 0 ? form.languages : [],
      agency_id: agencyId,
      agency_member_id: memberId,
      credit_cost: creditCost,
      status: asDraft ? 'draft' : 'submitted',
    }
    if (scenarioText) briefData.scenario_text = scenarioText

    const { data: newBrief, error } = await supabase.from('briefs').insert(briefData).select('id').single()
    if (error) { setSubmitting(false); alert('Hata: ' + error.message); return }

    // Upload files
    const files = filesRef.current?.files
    if (files && files.length > 0 && newBrief) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const ext = file.name.split('.').pop() || 'bin'
        const path = `agency_${agencyId}/${newBrief.id}/${Date.now()}_${i}.${ext}`
        const { error: upErr } = await supabase.storage.from('brand-assets').upload(path, file)
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
          await supabase.from('brief_files').insert({ brief_id: newBrief.id, file_name: file.name, file_url: urlData.publicUrl, file_type: file.type || null })
        }
      }
    }

    // Upload scenario file
    const sf = scenarioRef.current?.files?.[0]
    if (sf && newBrief) {
      const ext = sf.name.split('.').pop() || 'bin'
      const path = `agency_${agencyId}/${newBrief.id}/scenario_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('brief-files').upload(path, sf)
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('brief-files').getPublicUrl(path)
        await supabase.from('brief_files').insert({ brief_id: newBrief.id, file_name: sf.name, file_url: urlData.publicUrl, file_type: sf.type || null })
      }
    }

    if (asDraft) router.push('/dashboard/agency-member/studio')
    else setStep(99)
  }

  const steps = ['Kampanya & Format', 'Hedef & CTA', 'Brief / Senaryo', 'Seslendirme', 'Son Kontrol', 'Senaryo']

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
    borderRadius: '10px', padding: '10px 14px', fontSize: '14px', color: '#0a0a0a',
     outline: 'none',
  }
  const pillStyle = (sel: boolean): React.CSSProperties => ({
    padding: '8px 18px', borderRadius: '100px', border: '0.5px solid',
    borderColor: sel ? '#111113' : 'rgba(0,0,0,0.12)',
    background: sel ? '#111113' : '#fff',
    color: sel ? '#fff' : '#555', fontSize: '13px', cursor: 'pointer',
     display: 'inline-block', margin: '3px',
  })

  // Success screen
  if (step === 99) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a',  }}>
        <div style={{ textAlign: 'center', maxWidth: '520px', padding: '0 24px' }}>
          <div style={{ fontSize: '36px', fontWeight: '300', color: '#fff', letterSpacing: '-1px', marginBottom: '12px' }}>Is gonderildi.</div>
          <div style={{ fontSize: '18px', fontWeight: '300', color: '#fff', fontStyle: 'italic', marginBottom: '24px' }}>"{form.campaign_name}"</div>
          <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, marginBottom: '36px' }}>Ekibimiz en kisa surede incelemeye baslayacak.</div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <a href="/dashboard/agency-member/studio" style={{ padding: '13px 28px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', fontSize: '14px', textDecoration: 'none',  }}>Islerim</a>
            <a href="/dashboard/agency-member/studio/new" style={{ padding: '13px 28px', borderRadius: '10px', background: '#22c55e', color: '#fff', fontSize: '14px', fontWeight: '500', textDecoration: 'none',  }}>Yeni Is</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh',  }}>

      {/* SIDEBAR */}
      <div style={{ width: '240px', background: '#0A0A0A', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          {agency?.logo_url ? (
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', overflow: 'hidden' }}>
              <img src={agency.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '3px' }} />
            </div>
          ) : (
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '16px', fontWeight: '500', color: '#fff' }}>{agency?.name?.charAt(0)?.toUpperCase() || 'A'}</span>
            </div>
          )}
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>{agency?.name}</div>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff' }}>{userName}</div>
        </div>
        {step > 0 && step <= 6 && (
          <div style={{ padding: '10px 8px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: '9px', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.2)', padding: '0 6px', marginBottom: '6px', textTransform: 'uppercase' }}>Adimlar</div>
            {steps.slice(0, 5).map((s, i) => {
              const n = i + 1
              const isDone = n < step
              const isCur = n === step
              return (
                <div key={s} onClick={() => { if (isDone) setStep(n) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', borderRadius: '7px', cursor: isDone ? 'pointer' : 'default', background: isCur ? 'rgba(255,255,255,0.06)' : 'transparent', marginBottom: '2px' }}>
                  <div style={{ width: '17px', height: '17px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '500', flexShrink: 0, background: isDone ? '#22c55e' : isCur ? '#fff' : 'rgba(255,255,255,0.07)', color: isDone ? '#fff' : isCur ? '#111' : 'rgba(255,255,255,0.25)' }}>
                    {isDone ? <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg> : n}
                  </div>
                  <span style={{ fontSize: '11px', color: isDone ? 'rgba(255,255,255,0.45)' : isCur ? '#fff' : 'rgba(255,255,255,0.3)', fontWeight: isCur ? '500' : '400' }}>{s}</span>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ flex: 1 }}></div>
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div onClick={() => router.push('/dashboard/agency-member/studio')} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 8px', borderRadius: '7px', cursor: 'pointer' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)',  }}><svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{display:'inline',verticalAlign:'middle',marginRight:'4px'}}><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>Islere don</span>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0', overflow: 'hidden' }}>
        {step > 0 && step <= 5 && (
          <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '12px', color: '#888' }}>Yeni Is / <span style={{ color: '#0a0a0a', fontWeight: '500' }}>{steps[step - 1]}</span></div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>Adim {step} / 5</div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: step <= 0 || step === 6 ? '0' : '32px 40px', maxWidth: step <= 0 || step === 6 ? 'none' : '640px' }}>

          {/* STEP -2 — Client Select */}
          {step === -2 && (
            <div style={{ position: 'fixed', inset: 0, left: '220px', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <div style={{ textAlign: 'center', width: '100%', maxWidth: '400px', padding: '0 24px' }}>
                <div style={{ fontSize: '28px', fontWeight: '300', color: '#fff', letterSpacing: '-0.5px', marginBottom: '12px' }}>Musteri Secin</div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '32px' }}>Bu is hangi musteri icin?</div>
                <select value={selectedClientId} onChange={e => {
                  setSelectedClientId(e.target.value)
                  const cl = clients.find(c => c.id === e.target.value)
                  if (cl) setForm(prev => ({ ...prev, client_name: cl.company_name }))
                  else setForm(prev => ({ ...prev, client_name: '' }))
                }}
                  style={{ width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '15px',  outline: 'none', marginBottom: '20px', cursor: 'pointer' }}>
                  <option value="" style={{ background: '#111', color: '#fff' }}>Genel / Musteri Yok</option>
                  {clients.map(c => <option key={c.id} value={c.id} style={{ background: '#111', color: '#fff' }}>{c.company_name}</option>)}
                </select>
                <button onClick={() => setStep(-1)}
                  style={{ width: '100%', padding: '14px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '500', cursor: 'pointer',  }}>
                  Devam Et
                </button>
              </div>
            </div>
          )}

          {/* STEP -1 — Mode Select */}
          {step === -1 && (
            <div style={{ position: 'fixed', inset: 0, left: '220px', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <div style={{ textAlign: 'center', width: '100%', maxWidth: '560px', padding: '0 24px' }}>
                <div style={{ marginBottom: '24px' }}>
                  <span style={{ fontSize: '20px', fontWeight: '500', color: '#fff', letterSpacing: '-0.5px' }}>
                    <img src="/dinamo_logo.png" alt="Dinamo" style={{height:'28px'}} />
                  </span>
                </div>
                {form.client_name && <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>{form.client_name}</div>}
                <div style={{ fontSize: '28px', fontWeight: '300', color: '#fff', letterSpacing: '-0.5px', marginBottom: '32px' }}>Nasil ilerlemek istersiniz?</div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div onClick={() => setStep(1)}
                    style={{ flex: 1, background: '#fff', borderRadius: '16px', padding: '40px', cursor: 'pointer', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s,box-shadow 0.2s', textAlign: 'left' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.2)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none' }}>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: '500', color: '#0a0a0a', marginBottom: '8px' }}>Kendim Yazacagim</div>
                      <div style={{ fontSize: '13px', color: '#888', lineHeight: 1.6 }}>Brief alanlarini adim adim kendiniz doldurun.</div>
                    </div>
                    <div style={{ textAlign: 'right', marginTop: '20px' }}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                  </div>
                  <div onClick={() => setStep(0)}
                    style={{ flex: 1, background: '#0a0a0a', border: '2px solid #1db81d', borderRadius: '16px', padding: '40px', cursor: 'pointer', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s,border-color 0.2s', textAlign: 'left', position: 'relative' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.borderColor = '#22c55e' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = '#1db81d' }}>
                    <div style={{ position: 'absolute', top: '16px', left: '16px', fontSize: '10px', color: '#1db81d', fontWeight: '500', background: 'rgba(29,184,29,0.1)', padding: '3px 10px', borderRadius: '100px', letterSpacing: '0.5px' }}>AI</div>
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '500', color: '#fff', marginBottom: '8px' }}>Anlat, Olusturalim</div>
                      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>Ne yapmak istediginizi anlatin, brief'i sizin icin olusturalim.</div>
                    </div>
                    <div style={{ textAlign: 'right', marginTop: '20px' }}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#1db81d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 0 — AI Mode */}
          {step === 0 && (
            <div style={{ padding: '32px 40px', maxWidth: '640px' }}>
              <div style={{ fontSize: '26px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-0.5px', marginBottom: '8px' }}>Bize anlatin</div>
              <div style={{ fontSize: '14px', color: '#888', marginBottom: '16px', lineHeight: '1.6' }}>Ne aklinzdaysa yazin — gerisini biz halledelim.</div>
              {form.client_name && <div style={{ fontSize: '12px', color: '#22c55e', marginBottom: '12px' }}>Musteri: {form.client_name}</div>}
              <textarea
                value={aiBriefInput}
                onChange={e => setAiBriefInput(e.target.value)}
                placeholder="Videonuz hakkinda aklinizdaki her seyi yazin — urun, mesaj, hedef kitle, platform..."
                rows={8}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.7', marginBottom: '16px', fontSize: '14px' }} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setStep(-1)}
                  style={{ padding: '11px 20px', background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '13px',  color: '#555', cursor: 'pointer' }}>
                  Geri
                </button>
                <button onClick={generateAiBrief} disabled={aiBriefLoading || !aiBriefInput.trim()}
                  style={{ flex: 1, padding: '11px 24px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500',  cursor: aiBriefLoading || !aiBriefInput.trim() ? 'not-allowed' : 'pointer', opacity: aiBriefLoading || !aiBriefInput.trim() ? 0.5 : 1 }}>
                  {aiBriefLoading ? 'Olusturuluyor...' : 'Brief Olustur'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Adim 1 / 5</div>
              <div style={{ fontSize: '26px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-0.5px', marginBottom: '28px' }}>Kampanyaniza bir isim verin</div>
              {selectedClientId && <div style={{ fontSize: '12px', color: '#22c55e', marginBottom: '16px' }}>Musteri: {form.client_name}</div>}
              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Kampanya Adi</div>
                <input style={inputStyle} value={form.campaign_name} onChange={e => setForm({ ...form, campaign_name: e.target.value })} placeholder="orn. Yaz Kampanyasi 2025..." />
              </div>
              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Video Tipi</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {VIDEO_TYPES.map(t => <span key={t} style={{ ...pillStyle(form.video_type === t), display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '10px 18px' }} onClick={() => setForm({ ...form, video_type: t })}><span>{t}</span><span style={{ fontSize: '10px', color: form.video_type === t ? 'rgba(255,255,255,0.7)' : '#aaa' }}>{VIDEO_DURATIONS[t]}</span></span>)}
                </div>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Format</div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {FORMATS.map(f => (
                    <div key={f.ratio} onClick={() => setForm({ ...form, format: f.ratio })}
                      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px 16px', borderRadius: '10px', border: form.format === f.ratio ? '2px solid #22c55e' : '1.5px solid rgba(0,0,0,0.1)', background: form.format === f.ratio ? 'rgba(34,197,94,0.04)' : '#fff', minWidth: '64px' }}>
                      <div style={{ width: `${f.w}px`, height: `${f.h}px`, borderRadius: '4px', border: form.format === f.ratio ? '2px solid #22c55e' : '1.5px solid rgba(0,0,0,0.15)', background: form.format === f.ratio ? 'rgba(34,197,94,0.08)' : '#f5f4f0' }} />
                      <span style={{ fontSize: '12px', fontWeight: '500', color: form.format === f.ratio ? '#22c55e' : '#555' }}>{f.ratio}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Adim 2 / 5</div>
              <div style={{ fontSize: '26px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-0.5px', marginBottom: '28px' }}>Kimi hedefliyorsunuz?</div>
              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Hedef Kitle</div>
                <input style={inputStyle} value={form.target_audience} onChange={e => setForm({ ...form, target_audience: e.target.value })} placeholder="orn. 25-40 yas, online alisveris yapan..." />
              </div>
              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Call to Action var mi?</div>
                <div>
                  <span style={pillStyle(form.has_cta === 'yes')} onClick={() => setForm({ ...form, has_cta: 'yes' })}>Evet, var</span>
                  <span style={pillStyle(form.has_cta === 'no')} onClick={() => setForm({ ...form, has_cta: 'no', cta: '' })}>Hayir, yok</span>
                </div>
              </div>
              {form.has_cta === 'yes' && (
                <div>
                  <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>CTA Metni</div>
                  <input style={inputStyle} value={form.cta} onChange={e => setForm({ ...form, cta: e.target.value })} placeholder="orn. Hemen siparis ver..." />
                </div>
              )}
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Adim 3 / 5</div>
              <div style={{ fontSize: '26px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-0.5px', marginBottom: '8px' }}>Brief / Senaryo</div>
              <div style={{ fontSize: '13px', color: '#888', marginBottom: '24px', lineHeight: '1.6' }}>Hazir senaryonuz varsa direkt buraya yapistirin. Yoksa ne anlatmak istediginizi, tonunuzu, mesajinizi ve onemli detaylari yazin.</div>
              <div style={{ position: 'relative' }}>
                <textarea style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.7', paddingTop: '36px', opacity: expandLoading ? 0.5 : 1 }} rows={10}
                  value={form.message} onChange={e => { setForm({ ...form, message: e.target.value }); setPrevMessage(null) }}
                  placeholder="Hazir senaryonuzu buraya yapistirin ya da videonun mesajini, tonunu ve detaylarini yazin..." />
                <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '5px', zIndex: 2 }}>
                  {prevMessage !== null && !expandLoading && (
                    <button onClick={() => { setForm(prev => ({ ...prev, message: prevMessage! })); setPrevMessage(null) }}
                      style={{ padding: '3px 8px', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', background: '#fff', fontSize: '10px', color: '#888', cursor: 'pointer',  }}>Geri Al</button>
                  )}
                  <button onClick={handleExpand} disabled={expandLoading || !form.message.trim()}
                    style={{ padding: '3px 8px', borderRadius: '5px', border: 'none', background: expandLoading || !form.message.trim() ? 'rgba(0,0,0,0.04)' : '#111113', fontSize: '10px', color: expandLoading || !form.message.trim() ? '#ccc' : '#fff', cursor: expandLoading || !form.message.trim() ? 'default' : 'pointer',  }}>
                    {expandLoading ? '...' : 'Detaylandir'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Adim 4 / 5</div>
              <div style={{ fontSize: '26px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-0.5px', marginBottom: '28px' }}>Seslendirme</div>
              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Seslendirme Tipi</div>
                <div>
                  <span style={pillStyle(form.voiceover_type === 'none')} onClick={() => setForm({ ...form, voiceover_type: 'none', voiceover_gender: '', voiceover_text: '' })}>Yok</span>
                  <span style={pillStyle(form.voiceover_type === 'ai')} onClick={() => setForm({ ...form, voiceover_type: 'ai', voiceover_gender: 'female' })}>AI Seslendirme</span>
                  <span style={pillStyle(form.voiceover_type === 'real')} onClick={() => setForm({ ...form, voiceover_type: 'real', voiceover_gender: 'female' })}>Gercek Seslendirme (+6 kredi)</span>
                </div>
              </div>
              {form.voiceover_type !== 'none' && (
                <>
                  <div style={{ marginBottom: '22px' }}>
                    <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Cinsiyet</div>
                    <div>
                      <span style={pillStyle(form.voiceover_gender === 'female')} onClick={() => setForm({ ...form, voiceover_gender: 'female' })}>Kadin Sesi</span>
                      <span style={pillStyle(form.voiceover_gender === 'male')} onClick={() => setForm({ ...form, voiceover_gender: 'male' })}>Erkek Sesi</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Seslendirme Metni</div>
                      <button onClick={generateVoiceover} disabled={aiLoading} style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '6px', border: '0.5px solid rgba(0,0,0,0.15)', background: '#111113', color: '#fff', cursor: 'pointer',  }}>
                        {aiLoading ? 'Yaziyor...' : form.voiceover_text ? 'Yeniden Yaz' : 'AI ile Yaz'}
                      </button>
                    </div>
                    <textarea style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.7' }} rows={6}
                      value={form.voiceover_text} onChange={e => setForm({ ...form, voiceover_text: e.target.value })}
                      placeholder="Seslendirme metnini yazin veya AI ile olusturun..." />
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 5 — Summary */}
          {step === 5 && (
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Adim 5 / 5</div>
              <div style={{ fontSize: '26px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-0.5px', marginBottom: '28px' }}>Son notlar</div>
              <div style={{ background: '#f0efeb', borderRadius: '16px', padding: '28px', marginBottom: '22px' }}>
                {form.client_name && <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{form.client_name}</div>}
                <div style={{ fontSize: '22px', fontWeight: '600', color: '#0a0a0a', marginBottom: '4px' }}>{form.campaign_name}</div>
                <div style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>{form.video_type} ·{form.format} ·{calcCreditCost()} kredi</div>
                {form.message && <div style={{ marginTop: '14px' }}><div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '6px' }}>Brief Metni</div><div style={{ fontSize: '14px', color: '#333', lineHeight: 1.7 }}>{form.message}</div></div>}
              </div>
              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Ek Notlar</div>
                <textarea style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.7' }} rows={4} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Kacinilmasi gereken icerik, hassas konular..." />
              </div>
              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Referans Dosyalar</div>
                <div style={{ background: '#f5f4f0', borderRadius: '10px', padding: '16px' }}>
                  <input ref={filesRef} type="file" multiple style={{ fontSize: '12px', color: '#0a0a0a', width: '100%' }} />
                </div>
              </div>
              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Senaryo Dosyasi</div>
                <div style={{ background: '#f5f4f0', borderRadius: '10px', padding: '16px' }}>
                  <input ref={scenarioRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ fontSize: '12px', color: '#0a0a0a', width: '100%' }} />
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>Opsiyonel. Hazir senaryo dosyaniz varsa yukleyebilirsiniz.</div>
              </div>
            </div>
          )}

          {/* STEP 6 — Scenario (3 phases) */}
          {step === 6 && (
            <div style={{ padding: '32px 40px', maxWidth: '700px' }}>

              {/* PHASE 1 — Ideas */}
              {scenarioPhase === 'ideas' && (
                <div>
                  <div style={{ fontSize: '26px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-0.5px', marginBottom: '8px' }}>Fikir Olustur</div>
                  <div style={{ fontSize: '13px', color: '#888', marginBottom: '24px', lineHeight: '1.6' }}>Brief iceriginden yaratici konseptler uretelim. Begendiginizi secin, senaryolastirin.</div>

                  {ideas.length === 0 && !ideasLoading && (
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={generateIdeas}
                        style={{ padding: '14px 28px', background: '#111113', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500', cursor: 'pointer',  }}>
                        Fikir Olustur
                      </button>
                      <button onClick={() => { setScenarioPhase('write'); setScenarioMode('none') }}
                        style={{ padding: '14px 28px', background: '#fff', color: '#555', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '10px', fontSize: '14px', cursor: 'pointer',  }}>
                        Fikir Olmadan Devam Et
                      </button>
                      <button onClick={() => handleSubmit(false)} disabled={submitting}
                        style={{ padding: '14px 28px', background: '#f5f4f0', color: '#888', border: 'none', borderRadius: '10px', fontSize: '14px', cursor: 'pointer',  }}>
                        {submitting ? 'Gonderiliyor...' : 'Senaryosuz Gonder'}
                      </button>
                    </div>
                  )}

                  {ideasLoading && (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                      <div style={{ fontSize: '14px', color: '#888' }}>Fikirler olusturuluyor...</div>
                    </div>
                  )}

                  {ideasError && (
                    <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', marginTop: '12px', fontSize: '12px', color: '#b91c1c' }}>
                      {ideasError}
                    </div>
                  )}

                  {ideas.length > 0 && !ideasLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {ideas.map((idea: any, i: number) => (
                        <div key={i} style={{
                          background: '#fff', border: selectedIdea === idea ? '2px solid #22c55e' : '1px solid rgba(0,0,0,0.08)',
                          borderRadius: '14px', padding: '24px', cursor: 'pointer',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                        }}
                          onClick={() => setSelectedIdea(idea)}
                          onMouseEnter={e => { if (selectedIdea !== idea) e.currentTarget.style.borderColor = 'rgba(0,0,0,0.2)' }}
                          onMouseLeave={e => { if (selectedIdea !== idea) e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div style={{ fontSize: '16px', fontWeight: '500', color: '#0a0a0a' }}>{idea.title}</div>
                            {selectedIdea === idea && (
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.7, marginBottom: '8px' }}>{idea.description}</div>
                          {idea.approach && <div style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>{idea.approach}</div>}
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                        <button onClick={() => { setIdeas([]); setSelectedIdea(null) }}
                          style={{ padding: '11px 20px', background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '13px',  color: '#555', cursor: 'pointer' }}>
                          Yeniden Olustur
                        </button>
                        <button onClick={() => { if (selectedIdea) { setScenarioPhase('write'); setScenarioMode('none') } }}
                          disabled={!selectedIdea}
                          style={{ flex: 1, padding: '11px 24px', background: selectedIdea ? '#111113' : '#f5f4f0', color: selectedIdea ? '#fff' : '#aaa', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500',  cursor: selectedIdea ? 'pointer' : 'not-allowed' }}>
                          Bu Fikri Sec ve Senaryolastir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PHASE 2 — Write Scenario */}
              {scenarioPhase === 'write' && scenarioMode === 'none' && (
                <div>
                  <div style={{ fontSize: '26px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-0.5px', marginBottom: '8px' }}>Senaryolastir</div>
                  {selectedIdea && (
                    <div style={{ padding: '12px 16px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '10px', marginBottom: '20px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '500', color: '#166534' }}>{selectedIdea.title}</div>
                      <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>{selectedIdea.description}</div>
                    </div>
                  )}
                  <div style={{ fontSize: '13px', color: '#888', marginBottom: '24px' }}>Senaryoyu nasil olusturmak istersiniz?</div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div onClick={() => { setScenarioMode('ai'); generateScenarioFromIdea() }}
                      style={{ flex: 1, background: '#111113', border: '1.5px solid #22c55e', borderRadius: '14px', padding: '24px', cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#22c55e', fontWeight: '500', marginBottom: '8px' }}>AI</div>
                      <div style={{ fontSize: '15px', fontWeight: '500', color: '#fff', marginBottom: '6px' }}>AI ile Yaz</div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Sahne sahne senaryo uret</div>
                    </div>
                    <div onClick={() => setScenarioMode('manual')}
                      style={{ flex: 1, background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '14px', padding: '24px', cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: '15px', fontWeight: '500', color: '#0a0a0a', marginBottom: '6px', marginTop: '18px' }}>Kendim Yazacagim</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>Bos sayfadan yazin</div>
                    </div>
                    <div onClick={() => setScenarioMode('paste')}
                      style={{ flex: 1, background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '14px', padding: '24px', cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: '15px', fontWeight: '500', color: '#0a0a0a', marginBottom: '6px', marginTop: '18px' }}>Dosya / Yapistir</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>Hazir senaryonuzu yapistin</div>
                    </div>
                  </div>
                </div>
              )}

              {/* PHASE 2 — Writing/Editing */}
              {scenarioPhase === 'write' && scenarioMode !== 'none' && (
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '400', color: '#0a0a0a', marginBottom: '16px' }}>
                    {scenarioMode === 'ai' ? 'AI Senaryosu' : scenarioMode === 'paste' ? 'Senaryo Yapistir' : 'Senaryo Yaz'}
                  </div>
                  {selectedIdea && (
                    <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.06)', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', color: '#166534' }}>
                      Fikir: {selectedIdea.title}
                    </div>
                  )}
                  {scenarioError && (
                    <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', marginBottom: '12px', fontSize: '12px', color: '#b91c1c' }}>
                      {scenarioError}
                    </div>
                  )}
                  <textarea style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.7', opacity: scenarioAiLoading ? 0.5 : 1 }} rows={14}
                    value={scenarioText} onChange={e => setScenarioText(e.target.value)}
                    placeholder={scenarioAiLoading ? 'AI senaryo olusturuyor...' : scenarioMode === 'paste' ? 'Hazir senaryonuzu buraya yapistirin...' : 'Senaryonuzu yazin...'} />
                  {scenarioMode === 'paste' && (
                    <div style={{ marginTop: '10px' }}>
                      <input ref={scenarioRef} type="file" accept=".txt,.doc,.docx"
                        style={{ fontSize: '12px', color: '#888' }} />
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '4px' }}>.txt, .doc, .docx dosya yukleyebilirsiniz</div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <button onClick={() => { setScenarioMode('none'); setScenarioText('') }}
                      style={{ padding: '11px 20px', background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '13px',  color: '#555', cursor: 'pointer' }}>
                      Geri
                    </button>
                    <button onClick={() => handleSubmit(false)} disabled={submitting || scenarioAiLoading || !scenarioText.trim()}
                      style={{ flex: 1, padding: '11px 24px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500',  cursor: submitting || scenarioAiLoading || !scenarioText.trim() ? 'not-allowed' : 'pointer', opacity: submitting || scenarioAiLoading || !scenarioText.trim() ? 0.5 : 1 }}>
                      {submitting ? 'Gonderiliyor...' : 'Senaryolu Gonder'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM NAV */}
        {step >= 1 && step <= 5 && (
          <div style={{ padding: '16px 40px', background: '#fff', borderTop: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => step > 1 ? setStep(step - 1) : setStep(-1)}
              style={{ background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', padding: '9px 20px', fontSize: '13px',  color: '#555', cursor: 'pointer' }}>
              Geri
            </button>
            {step < 5 ? (
              <button onClick={() => setStep(step + 1)}
                disabled={(step === 1 && (!form.campaign_name || !form.video_type || !form.format)) || (step === 2 && (!form.target_audience || !form.has_cta)) || (step === 3 && !form.message)}
                style={{ background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 24px', fontSize: '13px',  cursor: 'pointer', fontWeight: '500', opacity: ((step === 1 && (!form.campaign_name || !form.video_type || !form.format)) || (step === 2 && (!form.target_audience || !form.has_cta)) || (step === 3 && !form.message)) ? 0.4 : 1 }}>
                Devam et
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleSubmit(true)} disabled={submitting}
                  style={{ background: 'none', border: '1px solid rgba(0,0,0,0.15)', borderRadius: '8px', padding: '9px 20px', fontSize: '13px',  cursor: 'pointer', color: '#555' }}>
                  {submitting ? '...' : 'Taslaga Kaydet'}
                </button>
                <button onClick={() => setStep(6)} disabled={submitting}
                  style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 24px', fontSize: '13px',  cursor: 'pointer', fontWeight: '500' }}>
                  Senaryo Adimina Gec
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
