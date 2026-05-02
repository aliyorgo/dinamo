'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import UGCSettingsModal, { UGCSettings, DEFAULT_SETTINGS } from './UGCSettingsModal'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface Props {
  briefId: string
  brief: any
  clientUser: any
}

export default function AIUGCTab({ briefId, brief, clientUser }: Props) {
  const [personas, setPersonas] = useState<any[]>([])
  const [selectedPersona, setSelectedPersona] = useState<number | null>(null)
  const [recommendedPersona, setRecommendedPersona] = useState<number | null>(null)
  const [script, setScript] = useState<any>(null)
  const [scriptLoading, setScriptLoading] = useState(false)
  const [useProduct, setUseProduct] = useState(true)
  const [productAnalysis, setProductAnalysis] = useState<any>(null)
  const [ugcVideo, setUgcVideo] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [msg, setMsg] = useState('')
  const [infoOpen, setInfoOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<UGCSettings>(DEFAULT_SETTINGS)
  const [scriptSnapshot, setScriptSnapshot] = useState<{ persona_id: number; settings: UGCSettings } | null>(null)
  const [brandDefaults, setBrandDefaults] = useState<{ cta?: boolean; music?: boolean } | null>(null)

  useEffect(() => { loadData() }, [briefId])

  async function loadData() {
    // Load personas
    const { data: p } = await supabase.from('personas').select('*').order('id')
    setPersonas(p || [])

    // Load existing UGC video
    if (brief?.ugc_video_id) {
      const { data: v } = await supabase.from('ugc_videos').select('*').eq('id', brief.ugc_video_id).single()
      if (v) setUgcVideo(v)
    }

    // Recommend persona
    const res = await fetch('/api/ugc/recommend-persona', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId }) })
    const data = await res.json()
    if (data.recommended_persona_id) { setRecommendedPersona(data.recommended_persona_id); setSelectedPersona(data.recommended_persona_id) }

    // Load settings
    if (brief?.ugc_settings) setSettings({ ...DEFAULT_SETTINGS, ...brief.ugc_settings })
    if (brief?.client_id) {
      const { data: cl } = await supabase.from('clients').select('ugc_brand_defaults').eq('id', brief.client_id).single()
      if (cl?.ugc_brand_defaults) {
        setBrandDefaults(cl.ugc_brand_defaults)
        // Apply brand defaults if no brief-level override
        if (!brief?.ugc_settings) setSettings(prev => ({ ...prev, cta: cl.ugc_brand_defaults.cta ?? prev.cta, music: cl.ugc_brand_defaults.music ?? prev.music }))
      }
    }

    // Analyze product
    if (brief?.product_image_url) {
      const res2 = await fetch('/api/ugc/analyze-product', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId }) })
      const data2 = await res2.json()
      setProductAnalysis(data2)
      if (data2.suggested_toggle_default !== undefined) setUseProduct(data2.suggested_toggle_default)
    }
  }

  async function generateScript() {
    if (!selectedPersona) return
    setScriptLoading(true)
    const res = await fetch('/api/ugc/generate-script', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, persona_id: selectedPersona, use_product: useProduct && !!brief?.product_image_url, settings }) })
    const data = await res.json()
    if (data.shots) {
      setScript(data)
      setScriptSnapshot({ persona_id: selectedPersona, settings: { ...settings } })
    }
    setScriptLoading(false)
  }

  async function triggerGenerate() {
    if (!script || !selectedPersona) return
    setGenerating(true)
    const res = await fetch('/api/ugc/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, persona_id: selectedPersona, use_product: useProduct && !!brief?.product_image_url, script, settings }) })
    const data = await res.json()
    if (data.ugc_video_id) {
      // Poll
      const poll = setInterval(async () => {
        const { data: v } = await supabase.from('ugc_videos').select('*').eq('id', data.ugc_video_id).single()
        if (v && (v.status === 'ready' || v.status === 'failed')) {
          clearInterval(poll)
          setUgcVideo(v)
          setGenerating(false)
        }
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
  }

  // Snapshot-based stale detection
  const isStale = useMemo(() => {
    if (!script || !scriptSnapshot) return false
    if (scriptSnapshot.persona_id !== selectedPersona) return true
    return JSON.stringify(scriptSnapshot.settings) !== JSON.stringify(settings)
  }, [script, scriptSnapshot, selectedPersona, settings])

  function acceptStaleScript() {
    // Accept current script as-is by updating snapshot to match current state
    if (selectedPersona) setScriptSnapshot({ persona_id: selectedPersona, settings: { ...settings } })
  }

  const hasVideo = ugcVideo?.status === 'ready' || ugcVideo?.status === 'sold'
  const isPurchased = ugcVideo?.status === 'sold'
  const isFailed = ugcVideo?.status === 'failed'
  const isProcessing = generating || ugcVideo?.status === 'queued' || ugcVideo?.status === 'generating'

  return (
    <div>
      {/* HEADER ROW: [info] [gear] ... [kredi] — single line, no wrap */}
      <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', marginBottom: '16px', gap: '8px' }}>
        <button onClick={() => setInfoOpen(true)} title="AI UGC Hakkında" className="dot"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          style={{ width: '24px', height: '24px', minWidth: '24px', border: '1.5px solid #0a0a0a', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', color: '#0a0a0a', transition: 'background 0.15s', flexShrink: 0 }}>i</button>
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

      {/* VIDEO CARD — AI Express pattern (ready/sold/processing/failed) */}
      {(hasVideo || isProcessing || isFailed) && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px 24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            {/* Video preview */}
            <div style={{ width: '200px', aspectRatio: '9/16', background: '#0a0a0a', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
              {hasVideo && ugcVideo.final_url ? (
                <video src={ugcVideo.final_url} controls preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'black' }} />
              ) : isProcessing ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '16px', background: '#0a0a0a' }}>
                  <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b6b66', marginBottom: '12px' }}>TAHMİNİ SÜRE: 3-5 dakika</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', borderStyle: 'solid', borderColor: '#4ade80 transparent transparent transparent' }} />
                    <span style={{ fontSize: '13px', color: '#fff' }}>Üretiliyor</span>
                  </div>
                </div>
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '20px', color: '#555' }}>&#9888;</span>
                  <span style={{ fontSize: '10px', color: '#999', fontWeight: '500' }}>Üretilemedi</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>AI UGC Video</span>
                {isPurchased && <span style={{ fontSize: '9px', color: '#1DB81D', fontWeight: '600' }}>&#10003; Satın Alındı</span>}
                {isProcessing && <span style={{ fontSize: '9px', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span className="dot" style={{ width: '6px', height: '6px', background: '#4ade80', display: 'inline-block', animation: 'pulse 1.5s ease infinite' }} /><span style={{ color: '#0a0a0a' }}>Üretiliyor</span></span>}
                {isFailed && <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: '500' }}>Başarısız</span>}
              </div>
              {ugcVideo?.created_at && <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px' }}>{new Date(ugcVideo.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}

              {isFailed && (
                <button onClick={() => { setUgcVideo(null); setGenerating(false) }} style={{ padding: '5px 12px', background: '#0a0a0a', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}>Tekrar Dene</button>
              )}

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

      {/* PERSONA + SCRIPT + GENERATE — only if no video yet */}
      {!hasVideo && !isProcessing && !isFailed && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px 24px' }}>
          {/* Persona selection */}
          {personas.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>PERSONA SEÇ</div>
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

          {/* Product toggle */}
          {brief?.product_image_url && (
            <div style={{ marginBottom: '16px', padding: '10px 14px', border: '1px solid #e5e4db' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: '#0a0a0a' }}>Ürünü videoya dahil et</span>
                <button onClick={() => setUseProduct(!useProduct)} style={{ width: '36px', height: '20px', border: 'none', cursor: 'pointer', background: useProduct ? '#22c55e' : '#ddd', position: 'relative', transition: 'background 0.2s' }}>
                  <span className="dot" style={{ position: 'absolute', top: '2px', left: useProduct ? '18px' : '2px', width: '16px', height: '16px', background: '#fff', transition: 'left 0.2s' }} />
                </button>
              </div>
              {productAnalysis && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: productAnalysis.product_works_in_video ? '#166534' : '#92400e', padding: '4px 8px', background: productAnalysis.product_works_in_video ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)' }}>
                  {productAnalysis.product_works_in_video ? 'Ürün videoya dahil edilecek' : productAnalysis.warning_message || 'Bu ürün AI\'da iyi çıkmayabilir, kapatmanı öneririz'}
                </div>
              )}
            </div>
          )}

          {/* Script */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>SCRİPT</div>
              <button onClick={generateScript} disabled={scriptLoading || !selectedPersona}
                className={isStale && script ? 'btn' : 'btn btn-outline'}
                style={{ padding: '4px 12px', fontSize: '9px', ...(isStale && script ? { animation: 'ugc-pulse 2s ease-in-out infinite' } : {}) }}>
                {scriptLoading ? 'ÜRETİLİYOR...' : script ? 'YENİDEN ÖNER' : 'SCRİPT ÜRET'}
              </button>
            </div>
            {isStale && script && (
              <div onClick={acceptStaleScript} style={{ fontSize: '10px', color: '#888', marginBottom: '8px', cursor: 'pointer' }}>
                Ayarlar değişti — yeniden önermek için butona bas, veya <span style={{ textDecoration: 'underline' }}>mevcut metni kabul et</span>
              </div>
            )}
            {script?.shots ? (
              <div onClick={isStale ? acceptStaleScript : undefined} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', opacity: isStale ? 0.5 : 1, transition: 'opacity 0.3s', cursor: isStale ? 'pointer' : 'default' }}>
                {script.shots.map((shot: any, i: number) => (
                  <div key={i} style={{ padding: '10px 12px', border: '1px solid #e5e4db', background: '#fafaf7' }}>
                    <div style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>SHOT {shot.shot} · {shot.camera || ['wide', 'close-up', 'medium'][i]}</div>
                    <div style={{ fontSize: '12px', color: '#0a0a0a', lineHeight: 1.5 }}>"{shot.dialogue}"</div>
                    {shot.action && <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>{shot.action}</div>}
                  </div>
                ))}
              </div>
            ) : !scriptLoading && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '12px', border: '1px dashed #e5e4db' }}>Persona seç, ardından script üret.</div>
            )}
          </div>

          {/* Generate button — AI Express pattern */}
          <button onClick={triggerGenerate} disabled={!script || generating} className="btn" style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: '600', opacity: (!script || generating) ? 0.4 : 1 }}>
            AI UGC ÜRET (1 KREDİ)
          </button>
        </div>
      )}

      <style>{`@keyframes ugc-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(10,10,10,0.2)} 50%{box-shadow:0 0 0 4px rgba(10,10,10,0.08)} }`}</style>

      {/* Info Modal */}
      {infoOpen && (
        <div onClick={() => setInfoOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '28px', maxWidth: '500px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '14px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#0a0a0a' }}>AI UGC Hakkında</span>
              <button onClick={() => setInfoOpen(false)} style={{ width: '28px', height: '28px', border: '1px solid #e5e4db', background: '#fff', color: '#0a0a0a', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.7 }}>
              AI UGC ile gerçek influencer görünümlü videolar oluşturun. Beta sürümünde — kalite gelişmeye açık. Persona seçin, script'i inceleyin, üretin. Videolar tamamen yapay zeka tarafından oluşturulur.
            </div>
          </div>
        </div>
      )}

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
