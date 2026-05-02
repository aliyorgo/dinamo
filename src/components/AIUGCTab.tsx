'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import UGCSettingsModal, { UGCSettings, DEFAULT_SETTINGS } from './UGCSettingsModal'
import InfoModal, { InfoParagraph } from './InfoModal'
import { UGC_MAX_CHARS } from '@/lib/ai-ugc-rules'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface Props {
  briefId: string
  brief: any
  clientUser: any
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0 }
  return hash.toString(36)
}

export default function AIUGCTab({ briefId, brief, clientUser }: Props) {
  const [personas, setPersonas] = useState<any[]>([])
  const [personaLoading, setPersonaLoading] = useState(!brief?.ugc_persona_analysis?.recommended_persona_id)
  const [personaError, setPersonaError] = useState(false)
  const [selectedPersona, setSelectedPersona] = useState<number | null>(null)
  const [recommendedPersona, setRecommendedPersona] = useState<number | null>(null)
  // Persona-based scripts: { "1": { shots, max_length, edited, settings_at_generation }, "5": {...} }
  const [ugcScripts, setUgcScripts] = useState<Record<string, any>>({})
  const [scriptText, setScriptText] = useState('')
  const [scriptLoading, setScriptLoading] = useState(false)
  const [useProduct, setUseProduct] = useState(false)
  const [productAnalysis, setProductAnalysis] = useState<any>(null)
  const [ugcVideo, setUgcVideo] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [msg, setMsg] = useState('')
  const [infoOpen, setInfoOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    const key = 'dinamo_seen_intro_ugc'
    if (!localStorage.getItem(key)) { localStorage.setItem(key, 'true'); return true }
    return false
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<UGCSettings>(DEFAULT_SETTINGS)
  const [brandDefaults, setBrandDefaults] = useState<{ cta?: boolean; music?: boolean } | null>(null)

  // Current persona's script
  const currentScript = selectedPersona ? ugcScripts[String(selectedPersona)] : null

  useEffect(() => { loadData() }, [briefId])

  // When persona changes, load that persona's script text (NOT on ugcScripts change — avoids overwrite during edit)
  useEffect(() => {
    if (!selectedPersona) { setScriptText(''); return }
    const s = ugcScripts[String(selectedPersona)]
    if (s?.shots) {
      setScriptText(s.shots.map((sh: any) => sh.dialogue).join(' '))
    } else {
      setScriptText('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersona])

  async function loadData() {
    setPersonaError(false)

    const { data: p } = await supabase.from('personas').select('*').order('id')
    setPersonas(p || [])

    if (brief?.ugc_video_id) {
      const { data: v } = await supabase.from('ugc_videos').select('*').eq('id', brief.ugc_video_id).single()
      if (v) setUgcVideo(v)
    }

    // Fetch fresh brief data
    const { data: freshBrief, error: fetchErr } = await supabase.from('briefs').select('*').eq('id', briefId).single()
    if (fetchErr) console.warn('[AI-UGC] brief fetch error:', fetchErr.message)
    const b = freshBrief || brief

    // Settings
    if (b?.ugc_settings) setSettings({ ...DEFAULT_SETTINGS, ...b.ugc_settings })
    if (b?.client_id) {
      const { data: cl } = await supabase.from('clients').select('ugc_brand_defaults').eq('id', b.client_id).single()
      if (cl?.ugc_brand_defaults) {
        setBrandDefaults(cl.ugc_brand_defaults)
        if (!b?.ugc_settings) setSettings(prev => ({ ...prev, cta: cl.ugc_brand_defaults.cta ?? prev.cta, music: cl.ugc_brand_defaults.music ?? prev.music }))
      }
    }

    // Load persona-based scripts
    const scripts = b?.ugc_scripts || {}
    // Fallback: migrate old ugc_script if ugc_scripts is empty
    if (Object.keys(scripts).length === 0 && b?.ugc_script?.shots) {
      const pid = String(b.ugc_selected_persona_id || '0')
      scripts[pid] = { shots: b.ugc_script.shots, max_length: b.ugc_script_max_length || 0, edited: b.ugc_script_edited || false }
    }
    setUgcScripts(scripts)

    // Persona — cache check
    try {
      const briefHash = simpleHash(JSON.stringify({ m: b?.message, p: b?.product_image_url, c: b?.client_id }))
      const cached = b?.ugc_persona_analysis
      console.log('[PERSONA-CACHE]', { hasCache: !!cached, savedHash: cached?.brief_hash, currentHash: briefHash, match: cached?.brief_hash === briefHash })
      if (cached && cached.brief_hash === briefHash && cached.recommended_persona_id) {
        setRecommendedPersona(cached.recommended_persona_id)
        setSelectedPersona(b?.ugc_selected_persona_id || cached.recommended_persona_id)
        setPersonaLoading(false)
      } else {
        setPersonaLoading(true)
        const res = await fetch('/api/ugc/recommend-persona', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId }) })
        const data = await res.json()
        if (data.recommended_persona_id) {
          setRecommendedPersona(data.recommended_persona_id)
          setSelectedPersona(b?.ugc_selected_persona_id || data.recommended_persona_id)
          await supabase.from('briefs').update({ ugc_persona_analysis: { ...data, brief_hash: briefHash, analyzed_at: new Date().toISOString() } }).eq('id', briefId)
        } else { setPersonaError(true) }
        setPersonaLoading(false)
      }
    } catch { setPersonaError(true); setPersonaLoading(false) }

    // Product analysis
    if (b?.product_image_url) {
      const res2 = await fetch('/api/ugc/analyze-product', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId }) })
      const data2 = await res2.json()
      setProductAnalysis(data2)
      // Claude analysis cached but does NOT override default OFF
    }
  }

  async function generateScript() {
    if (!selectedPersona) return
    setScriptLoading(true)
    const res = await fetch('/api/ugc/generate-script', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, persona_id: selectedPersona, use_product: useProduct && !!brief?.product_image_url, settings }) })
    const data = await res.json()
    if (data.shots) {
      const merged = data.shots.map((s: any) => s.dialogue).join(' ')
      const maxLen = merged.length
      const scriptEntry = { shots: data.shots, max_length: maxLen, edited: false, settings_at_generation: { ...settings }, generated_at: new Date().toISOString() }
      const updated = { ...ugcScripts, [String(selectedPersona)]: scriptEntry }
      setUgcScripts(updated)
      setScriptText(merged)
      // Persist
      await supabase.from('briefs').update({ ugc_scripts: updated, ugc_selected_persona_id: selectedPersona }).eq('id', briefId)
      console.log('[SCRIPT-WRITE]', { persona: selectedPersona, maxLen })
    }
    setScriptLoading(false)
  }

  async function triggerGenerate() {
    if (!currentScript || !selectedPersona) return
    setGenerating(true)
    const res = await fetch('/api/ugc/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, persona_id: selectedPersona, use_product: useProduct && !!brief?.product_image_url, script: currentScript, settings }) })
    const data = await res.json()
    if (data.ugc_video_id) {
      const poll = setInterval(async () => {
        const { data: v } = await supabase.from('ugc_videos').select('*').eq('id', data.ugc_video_id).single()
        if (v && (v.status === 'ready' || v.status === 'failed')) { clearInterval(poll); setUgcVideo(v); setGenerating(false) }
      }, 10000)
    } else { setGenerating(false); setMsg(data.error || 'Üretim başarısız.') }
  }

  async function handlePurchase() {
    if (!ugcVideo) return
    setPurchasing(true)
    const credits = clientUser?.allocated_credits || 0
    if (credits < 1) { setMsg('Yetersiz kredi'); setPurchasing(false); return }
    await supabase.from('client_users').update({ allocated_credits: credits - 1 }).eq('id', clientUser?.id)
    await supabase.from('credit_transactions').insert({ client_id: brief?.client_id, client_user_id: clientUser?.id, brief_id: briefId, amount: -1, type: 'deduct', description: 'AI UGC satın alma' })
    await supabase.from('ugc_videos').update({ status: 'sold', sold_at: new Date().toISOString() }).eq('id', ugcVideo.id)
    setUgcVideo({ ...ugcVideo, status: 'sold' })
    setPurchasing(false)
  }

  function handleSettingsChange(newSettings: UGCSettings) {
    setSettings(newSettings)
    supabase.from('briefs').update({ ugc_settings: newSettings }).eq('id', briefId)
  }

  function handlePersonaChange(id: number) {
    setSelectedPersona(id)
    supabase.from('briefs').update({ ugc_selected_persona_id: id }).eq('id', briefId)
  }

  function handleScriptEdit(val: string) {
    if (val.length > UGC_MAX_CHARS) return
    setScriptText(val)
    // Debounce: save to DB silently (do NOT setState ugcScripts — avoids textarea overwrite)
    clearTimeout((window as any).__ugcSaveTimer)
    ;(window as any).__ugcSaveTimer = setTimeout(() => {
      if (!selectedPersona) return
      const sentences = val.match(/[^.!?]+[.!?]+/g) || [val]
      const third = Math.ceil(sentences.length / 3)
      const parts = [
        sentences.slice(0, third).join('').trim(),
        sentences.slice(third, third * 2).join('').trim(),
        sentences.slice(third * 2).join('').trim(),
      ]
      const updatedShots = (currentScript?.shots || []).map((s: any, i: number) => ({ ...s, dialogue: parts[i] || '' }))
      const updatedEntry = { ...currentScript, shots: updatedShots, edited: true }
      const updatedScripts = { ...ugcScripts, [String(selectedPersona)]: updatedEntry }
      // Silent DB write — do NOT setUgcScripts() to avoid re-render overwrite
      supabase.from('briefs').update({ ugc_scripts: updatedScripts }).eq('id', briefId)
    }, 2000)
  }

  // Save on blur (final split + sync state for next mount)
  function handleScriptBlur() {
    if (!selectedPersona || !scriptText) return
    const sentences = scriptText.match(/[^.!?]+[.!?]+/g) || [scriptText]
    const third = Math.ceil(sentences.length / 3)
    const parts = [
      sentences.slice(0, third).join('').trim(),
      sentences.slice(third, third * 2).join('').trim(),
      sentences.slice(third * 2).join('').trim(),
    ]
    const updatedShots = (currentScript?.shots || []).map((s: any, i: number) => ({ ...s, dialogue: parts[i] || '' }))
    const updatedEntry = { ...currentScript, shots: updatedShots, edited: true }
    const updatedScripts = { ...ugcScripts, [String(selectedPersona)]: updatedEntry }
    setUgcScripts(updatedScripts) // safe to setState on blur — user is done typing
    supabase.from('briefs').update({ ugc_scripts: updatedScripts }).eq('id', briefId)
  }

  const hasVideo = ugcVideo?.status === 'ready' || ugcVideo?.status === 'sold'
  const isPurchased = ugcVideo?.status === 'sold'
  const isFailed = ugcVideo?.status === 'failed'
  const isProcessing = generating || ugcVideo?.status === 'queued' || ugcVideo?.status === 'generating'

  return (
    <div>
      {/* HEADER ROW */}
      <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', marginBottom: '16px', gap: '8px' }}>
        <button onClick={() => setInfoOpen(true)} title="AI UGC Hakkında"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          style={{ width: '28px', height: '28px', minWidth: '28px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s', flexShrink: 0, padding: '4px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
        </button>
        <button onClick={() => setSettingsOpen(true)} title="AI UGC Ayarları"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          style={{ width: '28px', height: '28px', minWidth: '28px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-1.42 3.42 2 2 0 0 1-1.42-.59l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-3.42-1.42 2 2 0 0 1 .59-1.42l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 1.42-3.42 2 2 0 0 1 1.42.59l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10.07 3V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 3.42 1.42 2 2 0 0 1-.59 1.42l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'inline-flex', padding: '6px 14px', border: '1px solid #0a0a0a', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: ugcVideo ? '#0a0a0a' : '#9ca3af', flexShrink: 0, whiteSpace: 'nowrap' }}>{ugcVideo ? (ugcVideo.status === 'sold' ? 2 : 1) : 0} KREDİ</div>
      </div>

      {msg && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid #ef4444', fontSize: '12px', color: '#0a0a0a', marginBottom: '12px' }}>{msg}</div>}

      {/* VIDEO CARD */}
      {(hasVideo || isProcessing || isFailed) && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px 24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <div style={{ width: '200px', aspectRatio: '9/16', background: '#0a0a0a', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
              {hasVideo && ugcVideo.final_url ? (
                <video src={ugcVideo.final_url} controls preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'black' }} />
              ) : isProcessing ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '16px' }}>
                  <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b6b66', marginBottom: '12px' }}>TAHMİNİ SÜRE: 3-5 dakika</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', borderStyle: 'solid', borderColor: '#4ade80 transparent transparent transparent' }} />
                    <span style={{ fontSize: '13px', color: '#fff' }}>Üretiliyor</span>
                  </div>
                </div>
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '20px', color: '#555' }}>&#9888;</span>
                  <span style={{ fontSize: '10px', color: '#999' }}>Üretilemedi</span>
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>AI UGC Video</span>
                {isPurchased && <span style={{ fontSize: '9px', color: '#1DB81D', fontWeight: '600' }}>&#10003; Satın Alındı</span>}
                {isProcessing && <span style={{ fontSize: '9px', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span className="dot" style={{ width: '6px', height: '6px', background: '#4ade80', display: 'inline-block', animation: 'pulse 1.5s ease infinite' }} /><span style={{ color: '#0a0a0a' }}>Üretiliyor</span></span>}
                {isFailed && <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: '500' }}>Başarısız</span>}
              </div>
              {ugcVideo?.created_at && <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px' }}>{new Date(ugcVideo.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
              {isFailed && <button onClick={() => { setUgcVideo(null); setGenerating(false) }} style={{ padding: '5px 12px', background: '#0a0a0a', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>Tekrar Dene</button>}
              {hasVideo && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {isPurchased ? (
                    <a href={ugcVideo.final_url} download target="_blank" style={{ fontSize: '11px', color: '#0a0a0a', textDecoration: 'none', border: '0.5px solid rgba(0,0,0,0.15)', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4 8l4 4 4-4" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/><path d="M2 13h12" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      İndir
                    </a>
                  ) : (
                    <>
                      <button onClick={handlePurchase} disabled={purchasing || (clientUser?.allocated_credits || 0) < 1} className="btn btn-accent" style={{ padding: '6px 16px' }}>SATIN AL</button>
                      <span style={{ fontSize: '13px', color: '#888' }}>1 kredi</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PERSONA + SCRIPT + GENERATE */}
      {!hasVideo && !isProcessing && !isFailed && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px 24px' }}>
          {/* Persona selection */}
          <div style={{ minHeight: '200px', marginBottom: '20px' }}>
            <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>PERSONA SEÇ</div>
            {personaLoading ? (
              <div style={{ minHeight: '170px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <div className="spinner" style={{ width: '32px', height: '32px', borderWidth: '2px', borderStyle: 'solid', borderColor: '#e5e4db #e5e4db #e5e4db #0a0a0a' }} />
                <div style={{ fontSize: '13px', color: '#888' }}>Brief'e uygun persona belirleniyor...</div>
              </div>
            ) : personaError ? (
              <div style={{ minHeight: '170px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <div style={{ fontSize: '13px', color: '#888' }}>Persona belirlenemedi.</div>
                <button onClick={loadData} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '11px' }}>Tekrar Dene</button>
              </div>
            ) : (
              <div style={{ animation: 'ugc-fade-in 0.3s ease' }}>
                {selectedPersona && (() => {
                  const p = personas.find(x => x.id === selectedPersona)
                  if (!p) return null
                  return (
                    <div style={{ padding: '16px 0', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div className="dot" style={{ width: '100px', height: '100px', minWidth: '100px', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', overflow: 'hidden' }}>
                        {p.thumbnail_url ? <img src={p.thumbnail_url} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.name[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '18px', fontWeight: '500', color: '#0a0a0a' }}>{p.name}</span>
                          {recommendedPersona === p.id && <span style={{ fontSize: '9px', letterSpacing: '1px', padding: '2px 7px', background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e', color: '#166534' }}>ÖNERİLEN</span>}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>{p.description} · {p.age_range} · {p.gender === 'female' ? 'Kadın' : 'Erkek'}</div>
                        <div style={{ fontSize: '11px', color: '#888', marginTop: '4px', lineHeight: 1.4 }}>{p.tone_description}</div>
                      </div>
                    </div>
                  )
                })()}
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {personas.map(p => (
                    <div key={p.id} onClick={() => handlePersonaChange(p.id)} style={{ flexShrink: 0, width: '60px', textAlign: 'center', cursor: 'pointer', opacity: selectedPersona === p.id ? 1 : 0.6, transition: 'opacity 0.15s' }}>
                      <div className="dot" style={{ width: '40px', height: '40px', minWidth: '40px', margin: '0 auto 4px', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', border: selectedPersona === p.id ? '2px solid #22c55e' : '1px solid #e5e4db', overflow: 'hidden', transition: 'border-color 0.15s' }}>
                        {p.thumbnail_url ? <img src={p.thumbnail_url} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.name[0]}
                      </div>
                      <div style={{ fontSize: '9px', color: '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Script */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>KONUŞMA METNİ</div>
              {currentScript && (
                <button onClick={generateScript} disabled={scriptLoading} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '9px' }}>
                  {scriptLoading ? 'ÜRETİLİYOR...' : 'YENİDEN ÜRET'}
                </button>
              )}
            </div>
            {currentScript?.shots ? (
              <div>
                <textarea
                  value={scriptText}
                  onChange={e => handleScriptEdit(e.target.value)}
                  onBlur={handleScriptBlur}
                  style={{ width: '100%', minHeight: '180px', fontSize: '14px', color: '#0a0a0a', lineHeight: 1.7, border: '1px solid #e5e4db', padding: '16px', resize: 'none', boxSizing: 'border-box', background: '#fff', fontFamily: 'var(--font-sans, Inter, sans-serif)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>AI yaklaşık 350 karakter üretir. Maksimum 390'a kadar düzenleyebilirsiniz.</span>
                  <span style={{ fontSize: '11px', fontWeight: '500', flexShrink: 0, marginLeft: '12px', color: scriptText.length >= 380 ? '#ef4444' : scriptText.length >= 350 ? '#f59e0b' : 'var(--color-text-tertiary)' }}>{scriptText.length} / {UGC_MAX_CHARS}</span>
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                {scriptLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderStyle: 'solid', borderColor: '#e5e4db #e5e4db #e5e4db #0a0a0a' }} />
                    <span style={{ fontSize: '12px', color: '#888' }}>Üretiliyor...</span>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>Bu persona için henüz konuşma metni üretilmedi.</div>
                    <button onClick={generateScript} disabled={!selectedPersona} className="btn" style={{ padding: '10px 24px' }}>SCRİPT ÜRET</button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Generate video section */}
          {currentScript && (
            <div>
              {/* Product toggle — sade row */}
              {brief?.product_image_url && (
                <div style={{ padding: '12px 0', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" style={{ flexShrink: 0 }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                  <span style={{ flex: 1, fontSize: '14px', color: '#0a0a0a' }}>Ürünü videoya dahil et</span>
                  <button onClick={() => setUseProduct(!useProduct)} style={{ width: '36px', height: '20px', border: 'none', cursor: 'pointer', background: useProduct ? '#22c55e' : '#ddd', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <span className="dot" style={{ position: 'absolute', top: '2px', left: useProduct ? '18px' : '2px', width: '16px', height: '16px', background: '#fff', transition: 'left 0.2s' }} />
                  </button>
                </div>
              )}

              {/* Product warning — reserved height, only visible when ON */}
              {brief?.product_image_url && (
                <div style={{ minHeight: '56px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.6, opacity: useProduct ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: useProduct ? 'auto' : 'none' }}>
                    Ürün yerleştirme AI UGC beta sürümünde sunulmaktadır. Ürünün boyut oranları, farklı açılardan görünümü ve detayları gerçek halinden farklı çıkabilir.
                  </div>
                </div>
              )}

              {/* Generate button */}
              <button onClick={triggerGenerate} disabled={generating} className="btn" style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: '600' }}>
                AI UGC VIDEO ÜRET (1 KREDİ)
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes ugc-fade-in { from{opacity:0} to{opacity:1} }`}</style>

      {/* Info Modal */}
      <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)} title="AI UGC hakkında" badge="BETA">
        <InfoParagraph primary>AI UGC ile gerçek bir influencer/creator izlenimi veren dikey video içerikleri üretin. Deneysel bir özelliktir — sonuçlar garanti edilmez.</InfoParagraph>
        <InfoParagraph>24 saniyelik üç planlı anlatım, brief'inize ve seçtiğiniz personaya göre tamamen yapay zeka tarafından oluşturulur. Karakter, ortam, metin, ses ve dudak senkronu AI tarafından üretilir; ton, konuşma hızı, CTA ve müzik tercihleri ayarlardan özelleştirilebilir.</InfoParagraph>
        <InfoParagraph>AI ile üretilmiş influencer/creator içeriklerinde yapay zeka kullanıldığını belirtmek bazı sektörlerde, ülkelerde veya şirket politikalarında zorunlu olabilir. Bu nedenle ürettiğimiz videolar varsayılan olarak küçük bir "AI ile üretildi" işareti taşır; ayarlardan kapatabilirsiniz.</InfoParagraph>
        <InfoParagraph>Dinamo sadece marka bilgileri ve seçtiğiniz tercihlerle AI prompt'larına müdahale eder. Beta sürümünde özellikle Türkçe seslendirme ve karakter tutarlılığında iyileştirmeler devam etmektedir — geri bildirimleriniz değerlidir.</InfoParagraph>
      </InfoModal>

      {/* Settings Modal */}
      <UGCSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={handleSettingsChange}
        brandDefaults={brandDefaults}
      />
    </div>
  )
}
