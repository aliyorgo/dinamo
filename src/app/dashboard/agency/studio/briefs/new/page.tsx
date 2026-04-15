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

export default function AgencyNewBriefWrapper() {
  return <Suspense><AgencyNewBrief /></Suspense>
}

function AgencyNewBrief() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [agency, setAgency] = useState<any>(null)
  const [agencyId, setAgencyId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [expandLoading, setExpandLoading] = useState(false)
  const [prevMessage, setPrevMessage] = useState<string | null>(null)
  const [aiBriefInput, setAiBriefInput] = useState('')
  const [aiBriefLoading, setAiBriefLoading] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
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
      if (!ud || ud.role !== 'agency' || !ud.agency_id) { router.push('/login'); return }
      setUserName(ud.name)
      setAgencyId(ud.agency_id)
      const [{ data: ag }, { data: cls }] = await Promise.all([
        supabase.from('agencies').select('id, name, logo_url').eq('id', ud.agency_id).single(),
        supabase.from('clients').select('id, company_name').eq('agency_id', ud.agency_id).order('company_name'),
      ])
      setAgency(ag)
      setClients(cls || [])
    }
    load()
  }, [router])

  function handleClientSelect(clientId: string) {
    setSelectedClientId(clientId)
    const cl = clients.find(c => c.id === clientId)
    setForm(prev => ({ ...prev, client_name: cl ? cl.company_name : '' }))
  }

  async function handleExpand() {
    if (!form.message.trim() || expandLoading) return
    setExpandLoading(true)
    setPrevMessage(form.message)
    try {
      const res = await fetch('/api/generate-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_input: `Aşağıdaki brief metnini koru ama genişlet. Eksik detayları tamamla, hedef kitle, beklenti ve mecra bilgilerini daha net hale getir. Aynı tonda kal, pazarlama yöneticisi sesi. Sadece message alanını dön.\n\nMevcut brief:\n${form.message}\n\nKampanya: ${form.campaign_name}\nVideo Tipi: ${form.video_type}`,
          brand_name: form.client_name || agency?.name,
        })
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: form.client_name || agency?.name,
          campaign_name: form.campaign_name,
          message: form.message,
          cta: form.cta,
          target_audience: form.target_audience,
          video_type: form.video_type,
        })
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
      let context = ''
      if (selectedClientId) {
        const { data: pastBriefs } = await supabase.from('briefs').select('campaign_name, message, target_audience, video_type').eq('client_id', selectedClientId).order('created_at', { ascending: false }).limit(5)
        if (pastBriefs && pastBriefs.length > 0) {
          context = '\n\nBu musterinin onceki briefleri (context):\n' + pastBriefs.map((b: any) => `- ${b.campaign_name}: ${(b.message || '').substring(0, 200)}`).join('\n')
        }
      }
      const res = await fetch('/api/generate-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  function calcCreditCost() {
    const base = BASE_COSTS[form.video_type] || 0
    const voiceCost = form.voiceover_type === 'real' ? 6 : 0
    const langCost = (form.languages?.length || 0) * 2
    return base + voiceCost + langCost
  }

  async function handleSubmit(asDraft = false) {
    if (!agencyId) return
    setSubmitting(true)

    const creditCost = asDraft ? 0 : calcCreditCost()

    // Check agency credit balance before submitting
    if (!asDraft && creditCost > 0) {
      const { data: ag } = await supabase.from('agencies').select('demo_credits').eq('id', agencyId).single()
      const available = ag?.demo_credits || 0
      if (available < creditCost) {
        alert(`Yetersiz kredi. Gerekli: ${creditCost}, Mevcut: ${available}`)
        setSubmitting(false)
        return
      }
    }

    const briefData = {
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
      credit_cost: creditCost,
      status: asDraft ? 'draft' : 'submitted',
    }

    const { data: newBrief, error } = await supabase.from('briefs').insert(briefData).select('id').single()
    if (error) { setSubmitting(false); alert('Hata: ' + error.message); return }

    // Deduct from agency demo_credits
    if (!asDraft && creditCost > 0) {
      const { data: ag } = await supabase.from('agencies').select('demo_credits').eq('id', agencyId).single()
      const newBalance = Math.max(0, (ag?.demo_credits || 0) - creditCost)
      await supabase.from('agencies').update({ demo_credits: newBalance }).eq('id', agencyId)
    }

    // Upload files if any
    const files = filesRef.current?.files
    if (files && files.length > 0 && newBrief) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const ext = file.name.split('.').pop() || 'bin'
        const path = `agency_${agencyId}/${newBrief.id}/${Date.now()}_${i}.${ext}`
        const { error: upErr } = await supabase.storage.from('brand-assets').upload(path, file)
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
          await supabase.from('brief_files').insert({
            brief_id: newBrief.id,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: file.type || null,
          })
        }
      }
    }

    // Upload scenario file if any
    const scenarioFile = scenarioRef.current?.files?.[0]
    if (scenarioFile && newBrief) {
      const ext = scenarioFile.name.split('.').pop() || 'bin'
      const path = `agency_${agencyId}/${newBrief.id}/scenario_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('brief-files').upload(path, scenarioFile)
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('brief-files').getPublicUrl(path)
        await supabase.from('brief_files').insert({
          brief_id: newBrief.id,
          file_name: scenarioFile.name,
          file_url: urlData.publicUrl,
          file_type: scenarioFile.type || null,
        })
      }
    }

    if (asDraft) {
      router.push('/dashboard/agency/studio/briefs')
    } else {
      setStep(99)
    }
  }

  const steps = ['Kampanya & Format', 'Hedef & CTA', 'Brief Metni', 'Seslendirme', 'Son Kontrol']

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
    borderRadius: '10px', padding: '10px 14px', fontSize: '14px', color: '#0a0a0a',
    fontFamily: 'var(--font-dm-sans),sans-serif', outline: 'none',
  }
  const pillStyle = (sel: boolean): React.CSSProperties => ({
    padding: '8px 18px', borderRadius: '100px', border: '0.5px solid',
    borderColor: sel ? '#111113' : 'rgba(0,0,0,0.12)',
    background: sel ? '#111113' : '#fff',
    color: sel ? '#fff' : '#555', fontSize: '13px', cursor: 'pointer',
    fontFamily: 'var(--font-dm-sans),sans-serif', display: 'inline-block', margin: '3px',
  })

  function Sidebar() {
    return (
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

        <div style={{ padding: '10px 8px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: '9px', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.2)', padding: '0 6px', marginBottom: '6px', textTransform: 'uppercase' }}>Adımlar</div>
          {steps.map((s, i) => {
            const n = i + 1
            const isDone = n < step
            const isCur = n === step
            return (
              <div key={s}>
                <div onClick={() => { if (isDone) setStep(n) }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '5px 6px', borderRadius: '7px', cursor: isDone ? 'pointer' : 'default', background: isCur ? 'rgba(255,255,255,0.06)' : 'transparent', marginBottom: '1px' }}>
                  <div style={{ width: '17px', height: '17px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '500', flexShrink: 0, marginTop: '1px', background: isDone ? '#22c55e' : isCur ? '#fff' : 'rgba(255,255,255,0.07)', color: isDone ? '#fff' : isCur ? '#111' : 'rgba(255,255,255,0.25)' }}>
                    {isDone ? '✓' : n}
                  </div>
                  <div style={{ marginTop: '1px' }}>
                    <div style={{ fontSize: '11px', color: isDone ? 'rgba(255,255,255,0.45)' : isCur ? '#fff' : 'rgba(255,255,255,0.3)', fontWeight: isCur ? '500' : '400' }}>
                      {n === 1 && form.campaign_name ? form.campaign_name.substring(0, 18) + (form.campaign_name.length > 18 ? '…' : '') : s}
                    </div>
                  </div>
                </div>
                {n < 5 && <div style={{ width: '1px', height: '8px', background: 'rgba(255,255,255,0.07)', marginLeft: '14px' }}></div>}
              </div>
            )
          })}
        </div>

        <div style={{ flex: 1 }}></div>
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div onClick={() => router.push('/dashboard/agency/studio/briefs')} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 8px', borderRadius: '7px', cursor: 'pointer' }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-dm-sans),sans-serif' }}>Briflere dön</span>
          </div>
        </div>
      </div>
    )
  }

  if (step === 99) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', fontFamily: "var(--font-dm-sans),'DM Sans',system-ui,sans-serif" }}>
        <div style={{ textAlign: 'center', maxWidth: '520px', padding: '0 24px' }}>
          <div style={{ fontSize: '36px', fontWeight: '300', color: '#fff', letterSpacing: '-1px', marginBottom: '12px' }}>Brief gönderildi.</div>
          <div style={{ fontSize: '18px', fontWeight: '300', color: '#fff', fontStyle: 'italic', marginBottom: '24px' }}>
            "{form.client_name ? `${form.client_name} — ` : ''}{form.campaign_name}"
          </div>
          <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, marginBottom: '36px' }}>
            Ekibimiz en kısa sürede incelemeye başlayacak.
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <a href="/dashboard/agency/studio/briefs" style={{ padding: '13px 28px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', fontSize: '14px', fontWeight: '400', textDecoration: 'none', fontFamily: 'var(--font-dm-sans),sans-serif' }}>Tüm Briefler</a>
            <a href="/dashboard/agency/studio/briefs/new" style={{ padding: '13px 28px', borderRadius: '10px', background: '#22c55e', color: '#fff', fontSize: '14px', fontWeight: '500', textDecoration: 'none', fontFamily: 'var(--font-dm-sans),sans-serif' }}>Yeni Brief</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "var(--font-dm-sans),'DM Sans',system-ui,sans-serif" }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0', overflow: 'hidden' }}>
        {step > 0 && (
          <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '12px', color: '#888' }}>Yeni Brief / <span style={{ color: '#0a0a0a', fontWeight: '500' }}>{steps[step - 1]}</span></div>
            <div style={{ fontSize: '11px', color: '#aaa' }}>Adim {step} / 5</div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: step <= 0 ? '0' : '32px 40px', maxWidth: step <= 0 ? 'none' : '640px' }}>

          {/* ADIM 0 — Mod Secimi */}
          {step === 0 && (
            <div style={{ position: 'fixed', inset: 0, left: '220px', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <div style={{ textAlign: 'center', width: '100%', maxWidth: '560px', padding: '0 24px' }}>
                <div style={{ marginBottom: '24px' }}>
                  <span style={{ fontSize: '20px', fontWeight: '500', color: '#fff', letterSpacing: '-0.5px' }}>
                    dinam<span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', border: '2.5px solid #22c55e', position: 'relative', top: '2px', marginLeft: '1px' }}></span>
                  </span>
                </div>
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
                    <div style={{ textAlign: 'right', marginTop: '20px', fontSize: '18px', color: '#ccc' }}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                  </div>
                  <div onClick={() => setStep(-1)}
                    style={{ flex: 1, background: '#0a0a0a', border: '2px solid #1db81d', borderRadius: '16px', padding: '40px', cursor: 'pointer', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s,border-color 0.2s', textAlign: 'left', position: 'relative' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.borderColor = '#22c55e' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = '#1db81d' }}>
                    <div style={{ position: 'absolute', top: '16px', left: '16px', fontSize: '10px', color: '#1db81d', fontWeight: '500', background: 'rgba(29,184,29,0.1)', padding: '3px 10px', borderRadius: '100px', letterSpacing: '0.5px' }}>AI</div>
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '500', color: '#fff', marginBottom: '8px' }}>Anlat, Olusturalim</div>
                      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>Ne yapmak istediginizi anlatin, brief'i sizin icin olusturalim.</div>
                    </div>
                    <div style={{ textAlign: 'right', marginTop: '20px', fontSize: '18px', color: '#1db81d' }}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ADIM -1 — AI Modu */}
          {step === -1 && (
            <div style={{ padding: '32px 40px', maxWidth: '640px' }}>
              <div style={{ fontSize: '26px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-0.5px', marginBottom: '8px' }}>Bize anlatin</div>
              <div style={{ fontSize: '14px', color: '#888', marginBottom: '16px', lineHeight: '1.6' }}>Ne aklinızdaysa yazin — gerisini biz halledelim.</div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Musteri</div>
                <select value={selectedClientId} onChange={e => handleClientSelect(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Genel / Musteri Yok</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <textarea
                value={aiBriefInput}
                onChange={e => setAiBriefInput(e.target.value)}
                placeholder="Videonuz hakkinda aklınızda ne varsa yazin — urun, mesaj, hedef kitle, platform..."
                rows={8}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.7', marginBottom: '16px', fontSize: '14px' }} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setStep(0)}
                  style={{ padding: '11px 20px', background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '13px', fontFamily: 'var(--font-dm-sans),sans-serif', color: '#555', cursor: 'pointer' }}>
                  Geri
                </button>
                <button onClick={generateAiBrief} disabled={aiBriefLoading || !aiBriefInput.trim()}
                  style={{ flex: 1, padding: '11px 24px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', fontFamily: 'var(--font-dm-sans),sans-serif', cursor: aiBriefLoading || !aiBriefInput.trim() ? 'not-allowed' : 'pointer', opacity: aiBriefLoading || !aiBriefInput.trim() ? 0.5 : 1 }}>
                  {aiBriefLoading ? 'Olusturuluyor...' : 'Brief Olustur'}
                </button>
              </div>
            </div>
          )}

          {/* ADIM 1 */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Adım 1 / 5</div>
              <div style={{ fontSize: '26px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-0.5px', marginBottom: '28px' }}>Kampanyanıza bir isim verin</div>

              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Musteri</div>
                <select value={selectedClientId} onChange={e => handleClientSelect(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Genel / Musteri Yok</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Kampanya Adi</div>
                <input style={inputStyle} value={form.campaign_name} onChange={e => setForm({ ...form, campaign_name: e.target.value })} placeholder="örn. Yaz Kampanyası 2025..." />
              </div>

              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Video Tipi</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {VIDEO_TYPES.map(t => {
                    const sel = form.video_type === t
                    return <span key={t} style={{ ...pillStyle(sel), display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '10px 18px' }} onClick={() => setForm({ ...form, video_type: t })}>
                      <span>{t}</span>
                      <span style={{ fontSize: '10px', color: sel ? 'rgba(255,255,255,0.7)' : '#aaa' }}>{VIDEO_DURATIONS[t]}</span>
                    </span>
                  })}
                </div>
              </div>

              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Format</div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {FORMATS.map(f => {
                    const sel = form.format === f.ratio
                    return (
                      <div key={f.ratio} onClick={() => setForm({ ...form, format: f.ratio })}
                        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px 16px', borderRadius: '10px', border: sel ? '2px solid #22c55e' : '1.5px solid rgba(0,0,0,0.1)', background: sel ? 'rgba(34,197,94,0.04)' : '#fff', minWidth: '64px' }}>
                        <div style={{ width: `${f.w}px`, height: `${f.h}px`, borderRadius: '4px', border: sel ? '2px solid #22c55e' : '1.5px solid rgba(0,0,0,0.15)', background: sel ? 'rgba(34,197,94,0.08)' : '#f5f4f0' }} />
                        <span style={{ fontSize: '12px', fontWeight: '500', color: sel ? '#22c55e' : '#555' }}>{f.ratio}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ marginTop: '22px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Mecralar</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'tiktok', label: 'TikTok' }, { id: 'instagram', label: 'Instagram' },
                    { id: 'youtube', label: 'YouTube' }, { id: 'twitter', label: 'X' }, { id: 'other', label: 'Diğer' },
                  ].map(p => {
                    const sel = form.platforms.includes(p.id)
                    return (
                      <div key={p.id} onClick={() => setForm(prev => ({ ...prev, platforms: prev.platforms.includes(p.id) ? prev.platforms.filter(x => x !== p.id) : [...prev.platforms, p.id] }))}
                        style={{ padding: '8px 16px', borderRadius: '100px', cursor: 'pointer', border: sel ? '1.5px solid #22c55e' : '1px solid rgba(0,0,0,0.12)', background: sel ? 'rgba(34,197,94,0.06)' : '#fff', color: sel ? '#22c55e' : '#888', fontSize: '12px', fontWeight: '500' }}>
                        {p.label}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ marginTop: '22px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>Yabancı Dil Versiyonu</div>
                <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '10px' }}>Her dil için +2 kredi uygulanır</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'en', label: 'İngilizce', flag: '🇬🇧' }, { id: 'de', label: 'Almanca', flag: '🇩🇪' },
                    { id: 'fr', label: 'Fransızca', flag: '🇫🇷' }, { id: 'ru', label: 'Rusça', flag: '🇷🇺' },
                    { id: 'ar', label: 'Arapça', flag: '🇸🇦' }, { id: 'it', label: 'İtalyanca', flag: '🇮🇹' },
                    { id: 'es', label: 'İspanyolca', flag: '🇪🇸' },
                  ].map(lang => {
                    const sel = form.languages.includes(lang.id)
                    return (
                      <div key={lang.id} onClick={() => setForm(prev => ({ ...prev, languages: prev.languages.includes(lang.id) ? prev.languages.filter(x => x !== lang.id) : [...prev.languages, lang.id] }))}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '100px', cursor: 'pointer', border: sel ? '1.5px solid #22c55e' : '1px solid rgba(0,0,0,0.12)', background: sel ? 'rgba(34,197,94,0.06)' : '#fff', color: sel ? '#22c55e' : '#888' }}>
                        <span>{lang.flag}</span>
                        <span style={{ fontSize: '12px', fontWeight: '500' }}>{lang.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ADIM 2 */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Adım 2 / 5 · {form.campaign_name}</div>
              <div style={{ fontSize: '26px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-0.5px', marginBottom: '28px' }}>Kimi hedefliyorsunuz?</div>
              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Hedef Kitle</div>
                <input style={inputStyle} value={form.target_audience} onChange={e => setForm({ ...form, target_audience: e.target.value })} placeholder="örn. 25-40 yaş, online alışveriş yapan..." />
              </div>
              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Call to Action var mı?</div>
                <div>
                  <span style={pillStyle(form.has_cta === 'yes')} onClick={() => setForm({ ...form, has_cta: 'yes' })}>Evet, var</span>
                  <span style={pillStyle(form.has_cta === 'no')} onClick={() => setForm({ ...form, has_cta: 'no', cta: '' })}>Hayır, yok</span>
                </div>
              </div>
              {form.has_cta === 'yes' && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>CTA Metni</div>
                  <input style={inputStyle} value={form.cta} onChange={e => setForm({ ...form, cta: e.target.value })} placeholder="örn. Hemen sipariş ver, %30 indirim fırsatını kaçırma..." />
                </div>
              )}
            </div>
          )}

          {/* ADIM 3 */}
          {step === 3 && (
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Adım 3 / 5 · {form.campaign_name}</div>
              <div style={{ fontSize: '26px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-0.5px', marginBottom: '8px' }}>Brief / Senaryo</div>
              <div style={{ fontSize: '13px', color: '#888', marginBottom: '24px', lineHeight: '1.6' }}>Hazir senaryonuz varsa direkt buraya yapistirin. Yoksa ne anlatmak istediginizi, tonunuzu, mesajinizi ve onemli detaylari yazin.</div>
              <div style={{ position: 'relative' }}>
                <textarea style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.7', paddingTop: '36px', opacity: expandLoading ? 0.5 : 1 }} rows={10}
                  value={form.message} onChange={e => { setForm({ ...form, message: e.target.value }); setPrevMessage(null) }}
                  placeholder="Hazir senaryonuzu buraya yapistirin ya da videonun mesajini, tonunu ve detaylarini yazin..." />
                <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '5px', zIndex: 2 }}>
                  {prevMessage !== null && !expandLoading && (
                    <button onClick={() => { setForm(prev => ({ ...prev, message: prevMessage! })); setPrevMessage(null) }}
                      style={{ padding: '3px 8px', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', background: '#fff', fontSize: '10px', color: '#888', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                      Geri Al
                    </button>
                  )}
                  <button onClick={handleExpand} disabled={expandLoading || !form.message.trim()}
                    style={{ padding: '3px 8px', borderRadius: '5px', border: 'none', background: expandLoading || !form.message.trim() ? 'rgba(0,0,0,0.04)' : '#111113', fontSize: '10px', color: expandLoading || !form.message.trim() ? '#ccc' : '#fff', cursor: expandLoading || !form.message.trim() ? 'default' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                    {expandLoading ? '...' : 'Detaylandır'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ADIM 4 */}
          {step === 4 && (
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Adım 4 / 5 · {form.campaign_name}</div>
              <div style={{ fontSize: '26px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-0.5px', marginBottom: '28px' }}>Seslendirme</div>
              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Seslendirme Tipi</div>
                <div>
                  <span style={pillStyle(form.voiceover_type === 'none')} onClick={() => setForm({ ...form, voiceover_type: 'none', voiceover_gender: '', voiceover_text: '' })}>Yok</span>
                  <span style={pillStyle(form.voiceover_type === 'ai')} onClick={() => setForm({ ...form, voiceover_type: 'ai', voiceover_gender: 'female' })}>AI Seslendirme</span>
                  <span style={pillStyle(form.voiceover_type === 'real')} onClick={() => setForm({ ...form, voiceover_type: 'real', voiceover_gender: 'female' })}>Gerçek Seslendirme (+6 kredi)</span>
                </div>
              </div>
              {form.voiceover_type !== 'none' && (
                <div style={{ marginBottom: '22px' }}>
                  <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Seslendirme Cinsiyeti</div>
                  <div>
                    <span style={pillStyle(form.voiceover_gender === 'female')} onClick={() => setForm({ ...form, voiceover_gender: 'female' })}>Kadın Sesi</span>
                    <span style={pillStyle(form.voiceover_gender === 'male')} onClick={() => setForm({ ...form, voiceover_gender: 'male' })}>Erkek Sesi</span>
                  </div>
                </div>
              )}
              {form.voiceover_type !== 'none' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Seslendirme Metni</div>
                    <button onClick={generateVoiceover} disabled={aiLoading} style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '6px', border: '0.5px solid rgba(0,0,0,0.15)', background: '#111113', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                      {aiLoading ? 'Yazıyor...' : form.voiceover_text ? 'Yeniden Yaz' : 'AI ile Yaz'}
                    </button>
                  </div>
                  <textarea style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.7' }} rows={6}
                    value={form.voiceover_text} onChange={e => setForm({ ...form, voiceover_text: e.target.value })}
                    placeholder="Seslendirme metnini yazın veya AI ile oluşturun..." />
                </div>
              )}
            </div>
          )}

          {/* ADIM 5 */}
          {step === 5 && (() => {
            const durMap: Record<string, string> = { 'Bumper / Pre-roll': '6 sn', 'Story / Reels': '15 sn', 'Feed Video': '30 sn', 'Long Form': '60 sn' }
            const dur = durMap[form.video_type] || '—'
            const totalCost = calcCreditCost()
            return (
              <div>
                <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Adım 5 / 5 · {form.campaign_name}</div>
                <div style={{ fontSize: '26px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-0.5px', marginBottom: '28px' }}>Son notlar</div>

                <div style={{ background: '#f0efeb', borderRadius: '16px', padding: '28px', marginBottom: '22px' }}>
                  {form.client_name && (
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{form.client_name}</div>
                  )}
                  <div style={{ fontSize: '22px', fontWeight: '600', color: '#0a0a0a', marginBottom: '4px' }}>{form.campaign_name}</div>
                  <div style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>{form.video_type} · {form.format} · {dur}</div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                    {[
                      { label: 'Süre', value: dur },
                      { label: 'Format', value: form.format || '—' },
                      { label: 'Kredi', value: `${totalCost} kredi` },
                      { label: 'Hazırlayan', value: userName.split(' ')[0] || '—' },
                    ].map(s => (
                      <div key={s.label} style={{ background: '#fff', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '4px' }}>{s.label}</div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {form.message && (
                    <div style={{ marginTop: '20px' }}>
                      <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '6px' }}>Brief Metni</div>
                      <div style={{ fontSize: '14px', color: '#333', lineHeight: 1.7 }}>{form.message}</div>
                    </div>
                  )}
                  {form.has_cta === 'yes' && form.cta && (
                    <div style={{ marginTop: '14px' }}>
                      <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '4px' }}>CTA</div>
                      <div style={{ fontSize: '14px', color: '#333' }}>{form.cta}</div>
                    </div>
                  )}
                  {form.target_audience && (
                    <div style={{ marginTop: '14px' }}>
                      <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '4px' }}>Hedef Kitle</div>
                      <div style={{ fontSize: '14px', color: '#333' }}>{form.target_audience}</div>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '22px' }}>
                  <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Ek Notlar</div>
                  <textarea style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.7' }} rows={4}
                    value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Kaçınılması gereken içerik, hassas konular, marka kısıtlamaları..." />
                </div>

                <div style={{ marginBottom: '22px' }}>
                  <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Referans Dosyalar</div>
                  <div style={{ background: '#f5f4f0', borderRadius: '10px', padding: '16px' }}>
                    <input ref={filesRef} type="file" multiple style={{ fontSize: '12px', color: '#0a0a0a', width: '100%' }} />
                  </div>
                  <div style={{ fontSize: '10px', color: '#aaa', marginTop: '6px' }}>Opsiyonel. Logo, referans video, moodboard vb.</div>
                </div>

                <div style={{ marginBottom: '22px' }}>
                  <div style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Senaryo Dosyasi Yukle</div>
                  <div style={{ background: '#f5f4f0', borderRadius: '10px', padding: '16px' }}>
                    <input ref={scenarioRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ fontSize: '12px', color: '#0a0a0a', width: '100%' }} />
                  </div>
                  <div style={{ fontSize: '10px', color: '#aaa', marginTop: '6px' }}>Opsiyonel. Hazir senaryo dosyaniz varsa buraya yukleyebilirsiniz.</div>
                </div>
              </div>
            )
          })()}
        </div>

        {step > 0 && <div style={{ padding: '16px 40px', background: '#fff', borderTop: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <button onClick={() => step > 1 ? setStep(step - 1) : setStep(0)}
            style={{ background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontFamily: 'var(--font-dm-sans),sans-serif', color: '#555', cursor: 'pointer' }}>
            {step === 1 ? 'Geri' : 'Geri'}
          </button>
          {step < 5 ? (
            <button onClick={() => setStep(step + 1)}
              disabled={
                (step === 1 && (!form.campaign_name || !form.video_type || !form.format)) ||
                (step === 2 && (!form.target_audience || !form.has_cta)) ||
                (step === 3 && !form.message)
              }
              style={{ background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 24px', fontSize: '13px', fontFamily: 'var(--font-dm-sans),sans-serif', cursor: 'pointer', fontWeight: '500', opacity: ((step === 1 && (!form.campaign_name || !form.video_type || !form.format)) || (step === 2 && (!form.target_audience || !form.has_cta)) || (step === 3 && !form.message)) ? 0.4 : 1 }}>
              Devam et
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => handleSubmit(true)} disabled={submitting}
                style={{ background: 'none', border: '1px solid rgba(0,0,0,0.15)', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontFamily: 'var(--font-dm-sans),sans-serif', cursor: 'pointer', color: '#555' }}>
                {submitting ? '...' : 'Taslağa Kaydet'}
              </button>
              <button onClick={() => handleSubmit(false)} disabled={submitting}
                style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 24px', fontSize: '13px', fontFamily: 'var(--font-dm-sans),sans-serif', cursor: 'pointer', fontWeight: '500' }}>
                {submitting ? 'Gönderiliyor...' : 'Brief Gönder'}
              </button>
            </div>
          )}
        </div>}
      </div>
    </div>
  )
}
