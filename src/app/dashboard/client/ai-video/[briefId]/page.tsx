'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams, useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const CHARACTER_STAGES = [
  { key: 'processing_concept', label: 'Konsept oluşturuluyor', duration: 10 },
  { key: 'processing_video', label: 'Görsel üretiliyor', duration: 210 },
  { key: 'processing_voice', label: 'Ses kaydediliyor', duration: 15 },
  { key: 'processing_music', label: 'Müzik seçiliyor', duration: 5 },
  { key: 'processing_merge', label: 'Birleştiriliyor', duration: 10 },
  { key: 'uploading', label: 'Yükleniyor', duration: 10 },
]
const PRODUCT_STAGES = [
  { key: 'processing_concept', label: 'Konsept oluşturuluyor', duration: 10 },
  { key: 'processing_lifestyle', label: 'Ürün görseli hazırlanıyor', duration: 30 },
  { key: 'processing_video', label: 'Görsel üretiliyor', duration: 210 },
  { key: 'processing_voice', label: 'Ses kaydediliyor', duration: 15 },
  { key: 'processing_music', label: 'Müzik seçiliyor', duration: 5 },
  { key: 'processing_merge', label: 'Birleştiriliyor', duration: 10 },
  { key: 'uploading', label: 'Yükleniyor', duration: 10 },
]

export default function AiVideoPage() {
  const params = useParams()
  const router = useRouter()
  const briefId = params.briefId as string

  const [brief, setBrief] = useState<any>(null)
  const [clientUser, setClientUser] = useState<any>(null)
  const [companyName, setCompanyName] = useState('')
  const [userName, setUserName] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  // AI polling state
  const [aiStatus, setAiStatus] = useState('')
  const [aiVideoUrl, setAiVideoUrl] = useState('')
  const [aiError, setAiError] = useState('')
  const [stageElapsed, setStageElapsed] = useState(0)
  const stageStartRef = useRef(Date.now())
  // Track which cloned brief we're watching
  const [cloneBriefId, setCloneBriefId] = useState<string | null>(null)

  useEffect(() => { loadData() }, [briefId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: userData } = await supabase.from('users').select('name').eq('id', user.id).single()
    setUserName(userData?.name || '')
    const { data: cu } = await supabase.from('client_users').select('*, clients(company_name)').eq('user_id', user.id).single()
    setClientUser(cu)
    setCompanyName((cu as any)?.clients?.company_name || '')
    const { data: b } = await supabase.from('briefs').select('*').eq('id', briefId).single()
    console.log('[ai-video] product_image_url:', b?.product_image_url)
    setBrief(b)

    // No product image → auto-start character pipeline, skip selection screen
    if (b && !b.product_image_url && cu) {
      autoStartRef.current = true
    }
  }

  const autoStartRef = useRef(false)
  useEffect(() => {
    if (autoStartRef.current && brief && clientUser && !generating) {
      autoStartRef.current = false
      handleGenerate('character')
    }
  }, [brief, clientUser])

  // Polling for AI status
  useEffect(() => {
    if (!cloneBriefId || !generating) return
    const poll = setInterval(async () => {
      try {
        const { data: b, error: err } = await supabase.from('briefs').select('ai_video_status, ai_video_url, ai_video_error').eq('id', cloneBriefId).maybeSingle()
        if (err) { console.error('[ai-poll] error:', err.message); return }
        if (!b) return
        if (b.ai_video_status && b.ai_video_status !== aiStatus) {
          setAiStatus(b.ai_video_status)
        }
        if (b.ai_video_status === 'completed' && b.ai_video_url) {
          clearInterval(poll)
          setAiVideoUrl(b.ai_video_url)
          setGenerating(false)
        } else if (b.ai_video_status === 'failed') {
          clearInterval(poll)
          setAiError(b.ai_video_error || 'Video oluşturulamadı')
          setGenerating(false)
        }
      } catch (e: any) {
        console.error('[ai-poll] catch:', e.message)
      }
    }, 3000)
    return () => clearInterval(poll)
  }, [cloneBriefId, generating])

  // Stage elapsed timer
  useEffect(() => {
    if (aiStatus) { stageStartRef.current = Date.now(); setStageElapsed(0) }
  }, [aiStatus])
  useEffect(() => {
    if (!aiStatus.startsWith('processing')) return
    const t = setInterval(() => setStageElapsed(Math.floor((Date.now() - stageStartRef.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [aiStatus])

  async function handleGenerate(mode: 'product' | 'character' = 'character') {
    if (!clientUser || !brief || generating) return
    const bal = clientUser.allocated_credits || 0
    if (bal < 1) { setError('Yetersiz kredi'); return }

    setGenerating(true)
    setError('')
    setAiError('')
    setAiVideoUrl('')

    // Deduct 1 credit
    const newCredits = bal - 1
    await supabase.from('client_users').update({ allocated_credits: newCredits }).eq('id', clientUser.id)
    setClientUser({ ...clientUser, allocated_credits: newCredits })

    // Count existing AI clones for numbering
    const baseName = brief.campaign_name?.replace(/\s*—\s*Full AI #\d+$/, '').replace(/\s*—\s*\d+$/, '') || brief.campaign_name
    const rootId = brief.root_campaign_id || briefId
    const { count } = await supabase.from('briefs').select('id', { count: 'exact', head: true })
      .eq('root_campaign_id', rootId).like('campaign_name', '%Full AI%')
    const aiNum = (count || 0) + 1

    // Clone brief
    const { data: newBrief, error: cloneErr } = await supabase.from('briefs').insert({
      campaign_name: `${baseName} — Full AI #${aiNum}`,
      parent_brief_id: briefId,
      video_type: brief.video_type,
      format: brief.format,
      platforms: brief.platforms,
      message: brief.message,
      cta: brief.cta,
      target_audience: brief.target_audience,
      voiceover_type: brief.voiceover_type,
      voiceover_gender: brief.voiceover_gender,
      voiceover_text: brief.voiceover_text,
      notes: brief.notes,
      languages: brief.languages,
      product_image_url: mode === 'product' ? (brief.product_image_url || null) : null,
      pipeline_type: mode,
      credit_cost: 1,
      client_id: brief.client_id,
      client_user_id: brief.client_user_id,
      root_campaign_id: brief.root_campaign_id || briefId,
      status: 'ai_processing',
      ai_video_status: 'processing_concept',
    }).select('id').single()

    if (cloneErr || !newBrief) {
      setError(cloneErr?.message || 'Brief oluşturulamadı')
      setGenerating(false)
      return
    }

    setCloneBriefId(newBrief.id)
    setAiStatus('processing_concept')

    // Fire and forget — start pipeline
    fetch('/api/generate-ai-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ briefId: newBrief.id }),
    })

    // Redirect to brief detail — polling continues there
    router.push(`/dashboard/client/briefs/${newBrief.id}`)
  }

  async function handlePurchase() {
    if (!clientUser || !cloneBriefId || !aiVideoUrl) return
    if ((clientUser.allocated_credits || 0) < 2) { setAiError('Yetersiz kredi'); return }
    const newCredits = (clientUser.allocated_credits || 0) - 2
    await supabase.from('client_users').update({ allocated_credits: newCredits }).eq('id', clientUser.id)
    setClientUser({ ...clientUser, allocated_credits: newCredits })
    await supabase.from('briefs').update({ status: 'delivered' }).eq('id', cloneBriefId)
    await supabase.from('video_submissions').insert({
      brief_id: cloneBriefId,
      video_url: aiVideoUrl,
      status: 'approved',
      is_ai_generated: true,
      version: 1,
      submitted_at: new Date().toISOString(),
    })
    router.push(`/dashboard/client/briefs/${cloneBriefId}`)
  }

  async function handleDiscard() {
    if (cloneBriefId) {
      await supabase.from('briefs').update({ status: 'ai_archived' }).eq('id', cloneBriefId)
    }
    setAiVideoUrl('')
    setAiStatus('')
    setCloneBriefId(null)
    setGenerating(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const balance = clientUser?.allocated_credits || 0

  // Progress calculations
  const stages = brief?.product_image_url ? PRODUCT_STAGES : CHARACTER_STAGES
  const stageKeys = stages.map(s => s.key)
  const curIdx = stageKeys.indexOf(aiStatus)
  const curDur = curIdx >= 0 ? stages[curIdx].duration : 0
  const curRem = Math.max(0, curDur - stageElapsed)
  const futureTime = stages.slice(curIdx + 1).reduce((s, x) => s + x.duration, 0)
  const totalRem = curRem + futureTime
  const barPct = curDur > 0 ? Math.min(100, (stageElapsed / curDur) * 100) : 0
  const fmtCd = (s: number) => { const m = Math.floor(s / 60); const r = s % 60; return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r} sn` }
  const fmtRem = (s: number) => s >= 60 ? `~${Math.ceil(s / 60)} dk kaldı` : `~${s} sn kaldı`

  const formatLabel = Array.isArray(brief?.format) ? brief.format.join(', ') : brief?.format || ''
  const durationMap: Record<string,string> = { 'Bumper / Pre-roll':'6 sn', 'Story / Reels':'15 sn', 'Feed Video':'30 sn', 'Long Form':'60 sn' }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"var(--font-dm-sans),'DM Sans',system-ui,sans-serif"}}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* SIDEBAR */}
      <div style={{width:'240px',background:'#0A0A0A',display:'flex',flexDirection:'column',flexShrink:0,height:'100dvh',overflowY:'auto'}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)',cursor:'pointer'}} onClick={()=>router.push('/dashboard/client')}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{height:'28px'}} />
        </div>
        <div style={{margin:'12px 12px',padding:'16px 20px',background:'rgba(29,184,29,0.06)',borderLeft:'3px solid #1DB81D'}}>
          <div style={{fontSize:'18px',fontWeight:'700',color:'#fff',marginBottom:'2px'}}>{companyName || 'Dinamo'}</div>
          <div style={{fontSize:'13px',fontWeight:'400',color:'#888',marginBottom:'12px'}}>{userName}</div>
          <div style={{fontSize:'10px',color:'#AAA',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'8px'}}>KREDİ BAKİYESİ</div>
          <div style={{fontSize:'28px',fontWeight:'700',color:'#1DB81D',letterSpacing:'-1px'}}>{balance}</div>
        </div>
        <nav style={{padding:'10px 8px'}}>
          <div onClick={()=>router.push('/dashboard/client')} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',marginBottom:'1px'}}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>Projelerime dön</span>
          </div>
          <div onClick={()=>router.push(`/dashboard/client/briefs/${briefId}`)} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer'}}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>Brief'e dön</span>
          </div>
          <button onClick={handleLogout}
            onMouseEnter={e=>{(e.currentTarget.firstChild as HTMLElement).style.color='#FF4444'}}
            onMouseLeave={e=>{(e.currentTarget.firstChild as HTMLElement).style.color='#aaa'}}
            style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',marginTop:'16px',cursor:'pointer',width:'100%',background:'none',border:'none'}}>
            <span style={{fontSize:'11px',color:'#aaa',fontFamily:'var(--font-dm-sans),sans-serif',transition:'color 0.15s'}}>Çıkış yap</span>
          </button>
          <img src='/powered_by_dcc.png' alt='Powered by DCC' style={{height:'20px',width:'auto',opacity:0.6,display:'block',margin:'8px 8px',cursor:'pointer'}} onClick={()=>window.open('https://dirtycheapcreative.com','_blank')} />
        </nav>
      </div>

      {/* MAIN */}
      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f5f4f0',overflow:'hidden'}}>
        {/* HEADER */}
        <div style={{padding:'14px 28px',background:'#fff',borderBottom:'0.5px solid rgba(0,0,0,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <span style={{color:'#1DB81D',fontSize:'16px'}}>&#9889;</span>
            <div>
              <div style={{fontSize:'18px',fontWeight:'500',color:'#0a0a0a',letterSpacing:'-0.3px'}}>Full AI Video</div>
              {brief && <div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>{brief.campaign_name}</div>}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <span style={{fontSize:'11px',padding:'3px 10px',background:'#fef3c7',color:'#92400e',fontWeight:'600',letterSpacing:'0.05em',textTransform:'uppercase',borderRadius:'100px'}}>Deneysel</span>
            <span style={{fontSize:'12px',color:'#888'}}>{balance} kredi</span>
          </div>
        </div>

        {/* CONTENT — two columns */}
        <div style={{flex:1,overflow:'auto',padding:'24px 28px'}}>
          <div style={{display:'flex',gap:'24px',alignItems:'flex-start'}}>

            {/* LEFT — brief summary */}
            <div style={{width:'280px',flexShrink:0}}>
              <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px'}}>
                <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'14px'}}>Brief Özeti</div>
                {[
                  { label: 'Kampanya', value: brief?.campaign_name },
                  { label: 'Format', value: `${brief?.video_type || ''} · ${formatLabel}` },
                  { label: 'Süre', value: durationMap[brief?.video_type] || '' },
                  { label: 'Dış Ses', value: brief?.voiceover_type === 'ai' ? `AI (${brief?.voiceover_gender === 'male' ? 'Erkek' : 'Kadın'})` : brief?.voiceover_type === 'real' ? 'Gerçek Seslendirme' : brief?.voiceover_type === 'none' ? 'Yok' : brief?.voiceover_type || '' },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} style={{marginBottom:'12px',paddingBottom:'12px',borderBottom:'0.5px solid rgba(0,0,0,0.06)'}}>
                    <div style={{fontSize:'9px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'3px'}}>{f.label}</div>
                    <div style={{fontSize:'12px',color:'#0a0a0a',lineHeight:'1.5'}}>{f.value}</div>
                  </div>
                ))}
                {brief?.product_image_url && (
                  <div style={{marginBottom:'12px',paddingBottom:'12px',borderBottom:'0.5px solid rgba(0,0,0,0.06)'}}>
                    <div style={{fontSize:'9px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'6px'}}>Ürün Fotoğrafı</div>
                    <img src={brief.product_image_url} alt="Ürün" style={{width:'100%',maxHeight:'120px',objectFit:'contain',borderRadius:'8px',background:'#f5f4f0'}} />
                    <div style={{fontSize:'10px',color:'#1DB81D',marginTop:'4px',fontWeight:'500'}}>Ürün videosu oluşturulacak</div>
                  </div>
                )}
                <div style={{fontSize:'11px',color:'#888',lineHeight:'1.6',marginTop:'8px'}}>
                  <strong style={{color:'#0a0a0a'}}>1 Kredi</strong> — Üret & Önizle<br/>
                  <strong style={{color:'#0a0a0a'}}>2 Kredi</strong> — Satın Al & Kullan
                </div>
              </div>
            </div>

            {/* RIGHT — video area */}
            <div style={{flex:1,minWidth:0}}>

              {/* STATE A: Not yet generated */}
              {/* SELECTION — only when product_image_url exists */}
              {!generating && !aiVideoUrl && !aiError && brief?.product_image_url && (
                <div style={{display:'flex',gap:'16px'}}>
                  {/* Product card */}
                  <div onClick={()=>handleGenerate('product')}
                    style={{flex:1,background:'#0a0a0a',borderRadius:'12px',padding:'28px 24px',cursor:balance<1?'default':'pointer',transition:'border-color 0.2s',border:'1.5px solid #222',display:'flex',flexDirection:'column',alignItems:'center',gap:'16px'}}
                    onMouseEnter={e=>{if(balance>=1)e.currentTarget.style.borderColor='#1DB81D'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='#222'}}>
                    <img src={brief.product_image_url} alt="Ürün" style={{width:'80px',height:'80px',objectFit:'contain',borderRadius:'8px',background:'#111'}} />
                    <div style={{fontSize:'15px',fontWeight:'500',color:'#fff',textAlign:'center'}}>Ürün Odaklı Video</div>
                    <div style={{fontSize:'11px',color:'#555',textAlign:'center',lineHeight:1.7}}>
                      Ürününüz modern bir ortamda gösterilir.<br/>Lifestyle setting, sinematik.
                    </div>
                    <div style={{padding:'10px 24px',background:balance<1?'#333':'#1DB81D',color:balance<1?'#666':'#0A0A0A',borderRadius:'8px',fontSize:'13px',fontWeight:'600',fontFamily:'var(--font-dm-sans),sans-serif'}}>
                      1 Kredi — Dene
                    </div>
                  </div>
                  {/* Character card */}
                  <div onClick={()=>handleGenerate('character')}
                    style={{flex:1,background:'#0a0a0a',borderRadius:'12px',padding:'28px 24px',cursor:balance<1?'default':'pointer',transition:'border-color 0.2s',border:'1.5px solid #222',display:'flex',flexDirection:'column',alignItems:'center',gap:'16px'}}
                    onMouseEnter={e=>{if(balance>=1)e.currentTarget.style.borderColor='#1DB81D'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='#222'}}>
                    <div style={{width:'80px',height:'80px',borderRadius:'8px',background:'#111',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'32px',opacity:0.4}}>&#9889;</div>
                    <div style={{fontSize:'15px',fontWeight:'500',color:'#fff',textAlign:'center'}}>Karakter Odaklı Video</div>
                    <div style={{fontSize:'11px',color:'#555',textAlign:'center',lineHeight:1.7}}>
                      Marka mesajınızı anlatan insan hikayesi.<br/>Duygu, atmosfer, Türk karakterler.
                    </div>
                    <div style={{padding:'10px 24px',background:balance<1?'#333':'#1DB81D',color:balance<1?'#666':'#0A0A0A',borderRadius:'8px',fontSize:'13px',fontWeight:'600',fontFamily:'var(--font-dm-sans),sans-serif'}}>
                      1 Kredi — Dene
                    </div>
                  </div>
                </div>
              )}
              {error && !generating && !aiVideoUrl && <div style={{fontSize:'12px',color:'#ef4444',marginTop:'10px'}}>{error}</div>}

              {/* STATE B: Processing */}
              {generating && !aiVideoUrl && !aiError && (
                <div style={{background:'#0a0a0a',borderRadius:'12px',overflow:'hidden'}}>
                  <div style={{aspectRatio:'9/16',maxHeight:'580px',display:'flex',flexDirection:'column',justifyContent:'center',padding:'40px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'28px'}}>
                      <div style={{fontSize:'16px',fontWeight:'500',color:'#fff'}}>Video oluşturuluyor...</div>
                      {totalRem > 0 && <div style={{fontSize:'13px',color:'#1DB81D',fontFamily:'monospace',fontWeight:'500'}}>{fmtCd(totalRem)}</div>}
                    </div>
                    {stages.map((s, i) => {
                      const isDone = curIdx > i
                      const isCurrent = curIdx === i
                      return (
                        <div key={s.key} style={{marginBottom:isCurrent?'18px':'10px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                            <div style={{width:'18px',height:'18px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                              {isDone ? <span style={{color:'#1DB81D',fontSize:'14px'}}>&#10003;</span>
                                : isCurrent ? <div style={{width:'10px',height:'10px',border:'2px solid #1DB81D',borderTop:'2px solid transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}}></div>
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
                    <div style={{marginTop:'24px',fontSize:'11px',color:'#555',display:'flex',alignItems:'center',gap:'6px',lineHeight:'1.5'}}>
                      <span style={{color:'#1DB81D',flexShrink:0}}>&#9889;</span> Sayfayı kapatabilirsiniz, video arka planda oluşturulmaya devam eder.
                    </div>
                  </div>
                </div>
              )}

              {/* STATE C: Completed — video preview */}
              {aiVideoUrl && (
                <div>
                  <div style={{borderRadius:'12px',overflow:'hidden',background:'#0a0a0a',marginBottom:'16px'}}>
                    <video controls autoPlay style={{width:'100%',maxHeight:'580px',display:'block'}}>
                      <source src={aiVideoUrl} />
                    </video>
                  </div>
                  <div style={{display:'flex',gap:'10px'}}>
                    <button onClick={handlePurchase} disabled={(clientUser?.allocated_credits||0)<2}
                      style={{flex:1,padding:'14px',background:(clientUser?.allocated_credits||0)<2?'#ccc':'#1DB81D',color:'#0A0A0A',border:'none',borderRadius:'10px',fontSize:'14px',fontWeight:'600',cursor:(clientUser?.allocated_credits||0)<2?'default':'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>
                      2 Kredi ile Al
                    </button>
                    <button onClick={handleDiscard}
                      style={{padding:'14px 24px',background:'#fff',color:'#555',border:'0.5px solid rgba(0,0,0,0.15)',borderRadius:'10px',fontSize:'13px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>
                      Vazgeç
                    </button>
                  </div>
                  {aiError && <div style={{fontSize:'12px',color:'#ef4444',marginTop:'10px'}}>{aiError}</div>}
                </div>
              )}

              {/* STATE D: Failed */}
              {aiError && !aiVideoUrl && !generating && (
                <div style={{background:'#0a0a0a',borderRadius:'12px',overflow:'hidden'}}>
                  <div style={{aspectRatio:'9/16',maxHeight:'580px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'16px',padding:'40px'}}>
                    <div style={{fontSize:'14px',fontWeight:'500',color:'#fff'}}>Video oluşturulamadı</div>
                    <div style={{fontSize:'12px',color:'#ef4444',textAlign:'center',maxWidth:'280px',lineHeight:1.6}}>{aiError}</div>
                    <button onClick={()=>handleGenerate('character')} disabled={balance < 1}
                      style={{padding:'12px 24px',background:'#222',color:'#fff',border:'1px solid #333',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',marginTop:'8px'}}>
                      1 Kredi ile Tekrar Dene
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
