'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function ProductionStudio({ briefId, source = 'admin', userRole = 'admin' }: { briefId: string, source?: 'admin' | 'creator', userRole?: 'admin' | 'producer' | 'creator' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState('')
  const [toast, setToast] = useState<{ msg: string, type: 'ok' | 'err' } | null>(null)
  const [briefSummary, setBriefSummary] = useState('')
  const [selectedAiIdea, setSelectedAiIdea] = useState<{ title: string, description: string } | null>(null)

  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [ideas, setIdeas] = useState<any[]>([])
  const [selectedIdea, setSelectedIdea] = useState<any>(null)
  const [addingIdea, setAddingIdea] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newConcept, setNewConcept] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editConcept, setEditConcept] = useState('')
  const [scenarioText, setScenarioText] = useState('')
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [highlightedIdea, setHighlightedIdea] = useState<any>(null)
  const [promptText, setPromptText] = useState('')
  const [promptShots, setPromptShots] = useState<{shot_number:number,duration:string,prompt:string}[]>([])
  const [promptNotes, setPromptNotes] = useState<{brand_guidelines?:string,technical_specs?:string,production_notes?:string}>({})
  const [copiedPrompt, setCopiedPrompt] = useState<string|null>(null)
  const [scenarioSaved, setScenarioSaved] = useState(false)
  const [scenarioEditing, setScenarioEditing] = useState(false)
  const [progress, setProgress] = useState<[boolean, boolean, boolean]>([false, false, false])

  // Load progress on mount (for button indicator)
  useEffect(() => {
    async function checkProgress() {
      const { data: insps } = await supabase.from('brief_inspirations').select('id, scenario, generated_by').eq('brief_id', briefId).limit(5)
      const hasIdea = (insps || []).some(i => !!i.generated_by || !!i.scenario)
      const hasScenario = (insps || []).some(i => !!i.scenario)
      let hasPrompt = false
      if (hasScenario) {
        const inspWithScenario = (insps || []).find(i => !!i.scenario)
        if (inspWithScenario) {
          const { count } = await supabase.from('inspiration_prompts').select('id', { count: 'exact', head: true }).eq('inspiration_id', inspWithScenario.id)
          hasPrompt = (count || 0) > 0
        }
      }
      const { data: b } = await supabase.from('briefs').select('selected_ai_idea').eq('id', briefId).single()
      setProgress([hasIdea || !!b?.selected_ai_idea, hasScenario, hasPrompt])
    }
    checkProgress()
  }, [briefId])

  useEffect(() => { if (isOpen) loadData() }, [isOpen, briefId])

  function showToast(msg: string, type: 'ok' | 'err') { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  async function loadData() {
    const { data: b } = await supabase.from('briefs').select('campaign_name, video_type, format, selected_ai_idea').eq('id', briefId).single()
    if (b) {
      const dur: Record<string, string> = { 'Bumper / Pre-roll': '6s', 'Story / Reels': '15s', 'Feed Video': '30s', 'Long Form': '60s' }
      setBriefSummary(`${b.campaign_name} · ${b.video_type} · ${dur[b.video_type] || ''} · ${b.format || ''}`)
      if (b.selected_ai_idea) { setSelectedAiIdea(b.selected_ai_idea); setStep(2) }
    }
    const { data: insps } = await supabase.from('brief_inspirations').select('*').eq('brief_id', briefId).eq('source', source === 'admin' ? 'admin' : 'creator').order('created_at', { ascending: false })
    setIdeas(insps || [])
    // Load saved scenario
    const { data: scenInsp } = await supabase.from('brief_inspirations').select('scenario').eq('brief_id', briefId).not('scenario', 'is', null).order('created_at', { ascending: false }).limit(1)
    if (scenInsp?.[0]?.scenario) { setScenarioText(typeof scenInsp[0].scenario === 'string' ? scenInsp[0].scenario : JSON.stringify(scenInsp[0].scenario)); setScenarioSaved(true) }
    // Update progress indicators
    const hasIdea = (insps || []).length > 0 || !!b?.selected_ai_idea
    const hasScen = !!(scenInsp?.[0]?.scenario)
    setProgress([hasIdea, hasScen, progress[2]])
  }

  // ─── Step 1: Ideas ───
  const LEVELS = ['minimal', 'orta', 'sinematik'] as const
  const aiIdeas = ideas.filter(i => !!i.generated_by)
  const manualIdeas = ideas.filter(i => !i.generated_by)
  // Build 3 slots from AI ideas, maintaining level order
  const slots: (any | null)[] = LEVELS.map(level => aiIdeas.find(i => i.level === level) || null)
  // Fill remaining nulls with unleveled AI ideas
  const unleveled = aiIdeas.filter(i => !i.level)
  slots.forEach((s, idx) => { if (!s && unleveled.length > 0) slots[idx] = unleveled.shift()! })

  async function generateIdeas() {
    setLoading('ideas')
    // Delete all AI ideas
    if (aiIdeas.length > 0) await supabase.from('brief_inspirations').delete().in('id', aiIdeas.map(i => i.id))
    setIdeas(manualIdeas)
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    const res = await fetch('/api/generate-inspirations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, user_id: user?.id, source, count: 3, target_levels: ['minimal', 'orta', 'sinematik'] }) })
    const data = await res.json()
    if (data.inspirations) { showToast(`${data.inspirations.length} fikir üretildi`, 'ok'); loadData() }
    else showToast('Fikir üretilemedi', 'err')
    setLoading('')
  }

  async function fillSlot(level: string) {
    setLoading(`slot-${level}`)
    const existing = aiIdeas.filter(i => i.id).map(i => ({ title: i.title, concept: i.concept }))
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    const res = await fetch('/api/generate-inspirations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, user_id: user?.id, source, count: 1, existing_ideas: existing, target_levels: [level] }) })
    const data = await res.json()
    if (data.inspirations) { showToast('Fikir üretildi', 'ok'); loadData() }
    else showToast('Fikir üretilemedi', 'err')
    setLoading('')
  }

  async function saveNewIdea() {
    if (!newTitle.trim()) return
    await supabase.from('brief_inspirations').insert({ brief_id: briefId, title: newTitle.trim(), concept: newConcept.trim(), status: 'normal', source })
    setAddingIdea(false); setNewTitle(''); setNewConcept(''); showToast('Fikir eklendi', 'ok'); loadData()
  }
  async function saveEditIdea(id: string) {
    if (!editTitle.trim()) return
    await supabase.from('brief_inspirations').update({ title: editTitle.trim(), concept: editConcept.trim() }).eq('id', id)
    setEditingId(null); showToast('Güncellendi', 'ok'); loadData()
  }
  async function deleteIdea(id: string) {
    await supabase.from('brief_inspirations').delete().eq('id', id)
    showToast('Silindi', 'ok'); loadData()
  }

  function highlightIdea(idea: any) {
    setHighlightedIdea(idea)
  }
  function confirmAndProceed() {
    if (highlightedIdea) { setSelectedIdea(highlightedIdea); setStep(2) }
  }
  function saveIdeaAndClose() {
    if (highlightedIdea) setSelectedIdea(highlightedIdea)
    setIsOpen(false)
  }
  function handleModalClose() {
    if (step === 1 && highlightedIdea && !selectedIdea) { setShowCloseConfirm(true); return }
    setIsOpen(false)
  }

  // ─── Step 2: Scenario ───
  async function aiWriteScenario() {
    setLoading('scenario')
    const inspId = selectedIdea?.id || selectedAiIdea ? null : ideas[0]?.id
    let targetId = inspId
    if (!targetId && selectedAiIdea) {
      const { data: newInsp } = await supabase.from('brief_inspirations').insert({ brief_id: briefId, title: selectedAiIdea.title, concept: selectedAiIdea.description, status: 'normal', source }).select('id').single()
      targetId = newInsp?.id; if (targetId) loadData()
    }
    if (!targetId && selectedIdea) targetId = selectedIdea.id
    if (!targetId) { const { data: newInsp } = await supabase.from('brief_inspirations').insert({ brief_id: briefId, title: 'Senaryo', concept: '', status: 'normal', source }).select('id').single(); targetId = newInsp?.id }
    if (!targetId) { showToast('Fikir bulunamadı', 'err'); setLoading(''); return }
    const res = await fetch('/api/generate-scenario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inspiration_id: targetId }) })
    const data = await res.json()
    if (data.scenario) { setScenarioText(data.scenario); showToast('Senaryo üretildi', 'ok') }
    else showToast('Senaryo üretilemedi', 'err')
    setLoading('')
  }

  async function aiImproveScenario() {
    if (!scenarioText.trim()) return
    setLoading('improve')
    const inspId = selectedIdea?.id || ideas[0]?.id
    if (!inspId) { showToast('Fikir bulunamadı', 'err'); setLoading(''); return }
    // Use generate-scenario with existing text as context
    await supabase.from('brief_inspirations').update({ concept: scenarioText.trim() }).eq('id', inspId)
    const res = await fetch('/api/generate-scenario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inspiration_id: inspId }) })
    const data = await res.json()
    if (data.scenario) { setScenarioText(data.scenario); showToast('Senaryo geliştirildi', 'ok') }
    else showToast('Geliştirilemedi', 'err')
    setLoading('')
  }

  async function saveScenario() {
    if (!scenarioText.trim()) return
    setLoading('save-scenario')
    let inspId = selectedIdea?.id || ideas[0]?.id
    if (!inspId) {
      const { data: newInsp } = await supabase.from('brief_inspirations').insert({ brief_id: briefId, title: selectedAiIdea?.title || 'Senaryo', concept: '', status: 'normal', source }).select('id').single()
      inspId = newInsp?.id; if (inspId) loadData()
    }
    if (inspId) {
      await supabase.from('brief_inspirations').update({ scenario: scenarioText.trim(), scenario_status: 'manual' }).eq('id', inspId)
      showToast('Senaryo kaydedildi', 'ok')
    }
    setLoading('')
  }

  // ─── Step 3: Prompt (creator only) ───
  async function generatePrompt() {
    setLoading('prompt')
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
    const inspId = ideas.find(i => i.scenario)?.id || selectedIdea?.id || ideas[0]?.id
    if (!inspId) { showToast('Önce senaryo kaydedin', 'err'); setLoading(''); return }
    const res = await fetch('/api/generate-prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inspiration_id: inspId, model: 'generic', user_id: user?.id }) })
    const data = await res.json()
    if (data.shots && Array.isArray(data.shots)) {
      setPromptShots(data.shots); setPromptNotes(data.global_notes || {}); setPromptText(''); showToast(`${data.shots.length} shot üretildi`, 'ok')
    } else if (data.prompt) { setPromptText(data.prompt); setPromptShots([]); showToast('Prompt üretildi', 'ok') }
    else showToast('Prompt üretilemedi', 'err')
    setLoading('')
  }

  const ideaTitle = selectedAiIdea ? selectedAiIdea.title : selectedIdea?.title || ''
  const ideaDesc = selectedAiIdea ? selectedAiIdea.description : selectedIdea?.concept || ''
  const step1Done = !!selectedIdea || !!selectedAiIdea
  const step2Done = !!scenarioText.trim()

  return (
    <>
      <style>{`.studio-btn:hover{background:#f5f4f0 !important}.studio-card:hover{border-color:#0a0a0a !important}`}</style>
      <button onClick={() => setIsOpen(true)} className="btn btn-outline" style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500' }}>
          CREATIVE STUDIO
        </span>
        <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {['Fikir', 'Senaryo', 'Prompt'].map((label, i) => (
            <span key={i} title={label} className="dot" style={{ width: '7px', height: '7px', background: progress[i] ? '#0a0a0a' : 'transparent', border: progress[i] ? '1px solid #0a0a0a' : '1px solid #c5c5b8', display: 'inline-block' }} />
          ))}
        </span>
      </button>

      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onClick={handleModalClose}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', background: '#fff', border: '1px solid #0a0a0a', display: 'flex', flexDirection: 'column' }}>

            {/* HEADER */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e4db', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>CREATIVE STUDIO</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{briefSummary}</div>
              </div>
              <button onClick={handleModalClose} style={{ width: '28px', height: '28px', border: '1px solid #e5e4db', background: '#fff', color: '#0a0a0a', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            {/* TOAST */}
            {toast && <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 200, padding: '10px 20px', fontSize: '12px', fontWeight: '500', color: '#fff', background: toast.type === 'ok' ? '#22c55e' : '#ef4444' }}>{toast.msg}</div>}

            {/* BODY */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

              {/* ═══ STEP 1 — FİKİR ═══ */}
              <div style={{ border: step === 1 ? '1px solid #0a0a0a' : '1px solid #e5e4db', padding: '20px', marginBottom: '16px', opacity: step === 1 ? 1 : (step1Done ? 1 : 0.5) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: step === 1 && !selectedAiIdea ? '16px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {step1Done && <span style={{ color: '#22c55e', fontSize: '14px' }}>✓</span>}
                    <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: step === 1 ? '#0a0a0a' : 'var(--color-text-tertiary)' }}>ADIM 1 · FİKİR</span>
                  </div>
                  {step1Done && step !== 1 && <button onClick={() => { setStep(1); setSelectedIdea(null); setSelectedAiIdea(null) }} style={{ fontSize: '10px', color: '#0a0a0a', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>DEĞİŞTİR</button>}
                </div>

                {/* Customer selected idea */}
                {selectedAiIdea && (
                  <div style={{ marginTop: '12px', padding: '12px 16px', background: '#f5f4f0', border: '1px solid #e5e4db' }}>
                    <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>MÜŞTERİ SEÇİMİ</div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '2px' }}>{selectedAiIdea.title}</div>
                    <div style={{ fontSize: '12px', color: '#6b6b66', lineHeight: 1.5 }}>{selectedAiIdea.description}</div>
                  </div>
                )}

                {/* Selected idea (not customer) */}
                {selectedIdea && !selectedAiIdea && step !== 1 && (
                  <div style={{ marginTop: '12px', padding: '12px 16px', background: '#f5f4f0', border: '1px solid #e5e4db' }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '2px' }}>{selectedIdea.title}</div>
                    <div style={{ fontSize: '12px', color: '#6b6b66', lineHeight: 1.5 }}>{selectedIdea.concept}</div>
                  </div>
                )}

                {/* Idea selection UI */}
                {step === 1 && !selectedAiIdea && (
                  <>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                      <button onClick={generateIdeas} disabled={!!loading} className="btn" style={{ padding: '8px 20px', opacity: loading ? 0.5 : 1 }}>{loading === 'ideas' ? 'Üretiliyor...' : ideas.length > 0 ? 'YENİDEN ÜRET' : 'AI FİKİR ÜRET'}</button>
                      <button onClick={() => { setAddingIdea(true); setNewTitle(''); setNewConcept('') }} className="btn btn-outline" style={{ padding: '8px 16px' }}>MANUEL EKLE</button>
                    </div>

                    {addingIdea && (
                      <div style={{ border: '1px solid #0a0a0a', padding: '14px', marginBottom: '12px', background: '#fafaf7' }}>
                        <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Başlık..." style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e4db', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }} />
                        <textarea value={newConcept} onChange={e => setNewConcept(e.target.value)} placeholder="Konsept..." rows={2} style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e4db', fontSize: '12px', marginBottom: '8px', boxSizing: 'border-box', resize: 'vertical' }} />
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={saveNewIdea} disabled={!newTitle.trim()} className="btn" style={{ padding: '5px 12px', fontSize: '11px' }}>Kaydet</button>
                          <button onClick={() => setAddingIdea(false)} className="btn btn-outline" style={{ padding: '5px 12px', fontSize: '11px' }}>İptal</button>
                        </div>
                      </div>
                    )}

                    {/* 3 Slot Grid */}
                    <div className="ideas-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: manualIdeas.length > 0 ? '12px' : '0' }}>
                      {slots.map((idea, idx) => {
                        const level = LEVELS[idx]
                        const isSlotLoading = loading === `slot-${level}`
                        const isAnyLoading = !!loading
                        if (!idea) {
                          // Empty slot
                          return (
                            <div key={`empty-${idx}`} onClick={() => !isAnyLoading && fillSlot(level)}
                              style={{ border: '1px dashed #0a0a0a', padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '120px', cursor: isAnyLoading ? 'default' : 'pointer', opacity: isAnyLoading && !isSlotLoading ? 0.5 : 1, background: '#fff', transition: 'background 0.15s' }}
                              onMouseEnter={e => { if (!isAnyLoading) e.currentTarget.style.background = '#fafaf7' }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}>
                              {isSlotLoading ? (
                                <><div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid #ddd', borderTopColor: '#0a0a0a', marginBottom: '6px' }} /><span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>Üretiliyor...</span></>
                              ) : (
                                <><div style={{ fontSize: '24px', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>+</div><span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>YENİ FİKİR ÜRET</span></>
                              )}
                            </div>
                          )
                        }
                        // Filled slot
                        return (
                          <div key={idea.id} className="studio-card" style={{ border: highlightedIdea?.id === idea.id ? '2px solid #0a0a0a' : '1px solid #e5e4db', padding: highlightedIdea?.id === idea.id ? '13px' : '14px', background: highlightedIdea?.id === idea.id ? '#f5f4f0' : '#fafaf7', transition: 'border-color 0.15s', position: 'relative' }}>
                            {highlightedIdea?.id === idea.id && <span style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '2px 6px', background: '#0a0a0a', color: '#fff', fontWeight: '500' }}>SEÇİLİ</span>}
                            {editingId === idea.id ? (
                              <div>
                                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ width: '100%', padding: '10px 14px', border: '1px solid #0a0a0a', fontSize: '14px', marginBottom: '8px', boxSizing: 'border-box' }} />
                                <textarea value={editConcept} onChange={e => setEditConcept(e.target.value)} rows={6} style={{ width: '100%', padding: '10px 14px', border: '1px solid #0a0a0a', fontSize: '13px', lineHeight: '1.5', minHeight: '130px', marginBottom: '8px', boxSizing: 'border-box', resize: 'vertical' }} />
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button onClick={() => saveEditIdea(idea.id)} className="btn" style={{ padding: '4px 10px', fontSize: '10px' }}>Kaydet</button>
                                  <button onClick={() => setEditingId(null)} className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '10px' }}>İptal</button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div onClick={() => !isAnyLoading && highlightIdea(idea)} style={{ marginBottom: '8px', cursor: isAnyLoading ? 'default' : 'pointer' }}>
                                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a', marginBottom: '4px' }}>{idea.title}</div>
                                  <div style={{ fontSize: '11px', color: '#6b6b66', lineHeight: 1.5 }}>{idea.concept}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button onClick={() => highlightIdea(idea)} disabled={isAnyLoading} className="btn" style={{ padding: '4px 10px', fontSize: '9px', opacity: isAnyLoading ? 0.5 : 1 }}>SEÇ</button>
                                  <button onClick={() => { setEditingId(idea.id); setEditTitle(idea.title); setEditConcept(idea.concept || '') }} disabled={isAnyLoading} className="studio-btn" style={{ padding: '4px 8px', border: '1px solid #e5e4db', background: '#fff', fontSize: '9px', cursor: 'pointer', transition: 'background 0.15s', opacity: isAnyLoading ? 0.5 : 1 }}>Düzenle</button>
                                  <button onClick={() => deleteIdea(idea.id)} disabled={isAnyLoading} className="studio-btn" style={{ padding: '4px 8px', border: '1px solid rgba(239,68,68,0.3)', background: '#fff', fontSize: '9px', color: '#ef4444', cursor: 'pointer', transition: 'background 0.15s', opacity: isAnyLoading ? 0.5 : 1 }}>Sil</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {/* Manual ideas below slots */}
                    {manualIdeas.map(idea => (
                      <div key={idea.id} style={{ border: '1px solid #e5e4db', padding: '14px', background: '#fafaf7', marginBottom: '8px' }}>
                        <div onClick={() => highlightIdea(idea)} style={{ cursor: 'pointer', marginBottom: '6px' }}>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a', marginBottom: '2px' }}>{idea.title}</div>
                          <div style={{ fontSize: '11px', color: '#6b6b66', lineHeight: 1.5 }}>{idea.concept}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => highlightIdea(idea)} className="btn" style={{ padding: '4px 10px', fontSize: '9px' }}>SEÇ</button>
                          <button onClick={() => deleteIdea(idea.id)} className="studio-btn" style={{ padding: '4px 8px', border: '1px solid rgba(239,68,68,0.3)', background: '#fff', fontSize: '9px', color: '#ef4444', cursor: 'pointer' }}>Sil</button>
                        </div>
                      </div>
                    ))}
                    {aiIdeas.length === 0 && manualIdeas.length === 0 && !addingIdea && <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-tertiary)', fontSize: '12px' }}>Henüz fikir yok. AI ile üretin veya manuel ekleyin.</div>}
                  </>
                )}
              </div>

              {/* ═══ STEP 2 — SENARYO ═══ */}
              <div style={{ border: step === 2 ? '1px solid #0a0a0a' : '1px solid #e5e4db', padding: '20px', marginBottom: '16px', opacity: step >= 2 ? 1 : 0.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (step >= 2 && (!scenarioSaved || scenarioEditing)) ? '16px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {scenarioSaved && !scenarioEditing && <span style={{ color: '#22c55e', fontSize: '14px' }}>✓</span>}
                    <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: step === 2 ? '#0a0a0a' : 'var(--color-text-tertiary)' }}>ADIM 2 · SENARYO</span>
                  </div>
                  {scenarioSaved && !scenarioEditing && step >= 2 && <button onClick={() => { setScenarioEditing(true); setStep(2) }} style={{ fontSize: '10px', color: '#0a0a0a', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>DÜZENLE</button>}
                </div>
                {/* Saved read-only view */}
                {step >= 2 && scenarioSaved && !scenarioEditing && (
                  <div style={{ marginTop: '12px', padding: '12px 16px', background: '#f5f4f0', border: '1px solid #e5e4db' }}>
                    <div style={{ fontSize: '13px', color: '#0a0a0a', lineHeight: 1.7 }}>{scenarioText}</div>
                  </div>
                )}
                {/* Edit mode */}
                {step >= 2 && (!scenarioSaved || scenarioEditing) && (
                  <>
                    <textarea value={scenarioText} onChange={e => setScenarioText(e.target.value)} placeholder="Senaryoyu yaz veya AI yazsın..." rows={6}
                      style={{ width: '100%', padding: '12px', border: '1px solid #e5e4db', fontSize: '13px', color: '#0a0a0a', lineHeight: '1.7', resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px' }} />
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={aiWriteScenario} disabled={!!loading} className="btn" style={{ padding: '8px 18px', opacity: loading ? 0.5 : 1 }}>{loading === 'scenario' ? 'Üretiliyor...' : 'AI YAZSIN'}</button>
                      {scenarioText.trim() && <button onClick={aiImproveScenario} disabled={!!loading} className="btn btn-outline" style={{ padding: '8px 18px', opacity: loading ? 0.5 : 1 }}>{loading === 'improve' ? 'Geliştiriliyor...' : 'AI GELİŞTİR'}</button>}
                      <button onClick={async () => { await saveScenario(); if (scenarioText.trim()) { setScenarioSaved(true); setScenarioEditing(false); setStep(3) } }} disabled={!!loading || !scenarioText.trim()} className="btn" style={{ padding: '8px 18px', marginLeft: 'auto', opacity: loading || !scenarioText.trim() ? 0.5 : 1 }}>{loading === 'save-scenario' ? 'Kaydediliyor...' : 'KAYDET'}</button>
                    </div>
                  </>
                )}
              </div>

              {/* ═══ STEP 3 — PROMPT (opsiyonel, creator only) ═══ */}
              <div style={{ border: step === 3 ? '1px solid #e5e4db' : '1px solid #e5e4db', padding: '20px', opacity: step >= 3 ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: step >= 3 ? '8px' : '0' }}>
                  {promptText && <span style={{ color: '#22c55e', fontSize: '14px' }}>✓</span>}
                  <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: 'var(--color-text-tertiary)' }}>ADIM 3 · PROMPT (OPSİYONEL)</span>
                </div>
                {step >= 3 && userRole === 'creator' ? (
                  <>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', lineHeight: 1.5, marginBottom: '12px' }}>AI modeline göndermek için prompt üretebilirsin. İstemiyorsan bu adımı atlayıp çıkabilirsin.</div>

                    {/* Shot cards */}
                    {promptShots.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <button onClick={() => { const all = promptShots.map(s => `Shot ${s.shot_number} (${s.duration}):\n${s.prompt}`).join('\n\n'); navigator.clipboard.writeText(all); setCopiedPrompt('all'); setTimeout(() => setCopiedPrompt(null), 1500) }} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '10px', marginBottom: '10px' }}>{copiedPrompt === 'all' ? 'KOPYALANDİ ✓' : 'TÜM SHOT\'LARI KOPYALA'}</button>
                        {promptShots.map((s, i) => (
                          <div key={i} style={{ border: '1px solid #e5e4db', padding: '14px 18px', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: '#0a0a0a' }}>SHOT {s.shot_number} · {s.duration}</span>
                              <button onClick={() => { navigator.clipboard.writeText(s.prompt); setCopiedPrompt(`s${i}`); setTimeout(() => setCopiedPrompt(null), 1500) }} className="btn btn-outline" style={{ padding: '3px 10px', fontSize: '9px' }}>{copiedPrompt === `s${i}` ? '✓' : 'KOPYALA'}</button>
                            </div>
                            <div style={{ fontSize: '12px', color: '#0a0a0a', lineHeight: 1.6, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{s.prompt}</div>
                          </div>
                        ))}
                        {(promptNotes.brand_guidelines || promptNotes.technical_specs || promptNotes.production_notes) && (
                          <div style={{ border: '1px solid #e5e4db', padding: '14px 18px', background: '#fafaf7' }}>
                            <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>GENEL NOTLAR</div>
                            {promptNotes.brand_guidelines && <div style={{ fontSize: '11px', color: '#0a0a0a', lineHeight: 1.5, marginBottom: '6px' }}><strong>Brand:</strong> {promptNotes.brand_guidelines}</div>}
                            {promptNotes.technical_specs && <div style={{ fontSize: '11px', color: '#0a0a0a', lineHeight: 1.5, marginBottom: '6px' }}><strong>Teknik:</strong> {promptNotes.technical_specs}</div>}
                            {promptNotes.production_notes && <div style={{ fontSize: '11px', color: '#0a0a0a', lineHeight: 1.5 }}><strong>Üretim:</strong> {promptNotes.production_notes}</div>}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Legacy single prompt fallback */}
                    {promptText && promptShots.length === 0 && (
                      <div style={{ background: '#0a0a0a', padding: '14px 16px', marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, fontFamily: 'monospace', wordBreak: 'break-all' }}>{promptText}</div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={generatePrompt} disabled={!!loading} className="btn btn-outline" style={{ padding: '8px 18px', opacity: loading ? 0.5 : 1 }}>{loading === 'prompt' ? 'Üretiliyor...' : promptShots.length > 0 || promptText ? 'YENİDEN ÜRET' : 'PROMPT ÜRET'}</button>
                      {promptText && promptShots.length === 0 && <button onClick={() => { navigator.clipboard.writeText(promptText); setCopiedPrompt('legacy'); setTimeout(() => setCopiedPrompt(null), 1500) }} className="btn btn-outline" style={{ padding: '8px 18px' }}>{copiedPrompt === 'legacy' ? 'KOPYALANDİ ✓' : 'KOPYALA'}</button>}
                      <button onClick={() => setIsOpen(false)} className="btn" style={{ padding: '8px 18px', marginLeft: 'auto' }}>ÇIK / KAYDET</button>
                    </div>
                  </>
                ) : step >= 3 ? (
                  <>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px', marginBottom: '12px' }}>Bu adım creator için ayrılmıştır.</div>
                    <button onClick={() => setIsOpen(false)} className="btn" style={{ padding: '8px 18px' }}>ÇIK / KAYDET</button>
                  </>
                ) : null}
              </div>
            </div>

            {/* STICKY BOTTOM BAR */}
            {step === 1 && highlightedIdea && !selectedAiIdea && (
              <div style={{ padding: '14px 24px', borderTop: '1px solid #e5e4db', background: '#fff', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>ADIM 1/3</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={saveIdeaAndClose} className="btn btn-outline" style={{ padding: '8px 18px' }}>FİKRİ KAYDET VE ÇIK</button>
                  <button onClick={confirmAndProceed} className="btn" style={{ padding: '8px 18px' }}>DEVAM ET → SENARYO</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CLOSE CONFIRM MODAL */}
      {showCloseConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
          <div style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '28px', maxWidth: '400px', width: '90%' }}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '10px' }}>Fikrini kaydetmek istiyor musun?</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>Seçtiğin fikir kaydedilmedi. Kaydetmek ister misin?</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setShowCloseConfirm(false) }} className="btn btn-outline" style={{ flex: 1, padding: '8px' }}>İPTAL</button>
              <button onClick={() => { setShowCloseConfirm(false); setHighlightedIdea(null); setIsOpen(false) }} className="btn btn-outline" style={{ flex: 1, padding: '8px' }}>HAYIR, ATLA</button>
              <button onClick={() => { setShowCloseConfirm(false); saveIdeaAndClose() }} className="btn" style={{ flex: 1, padding: '8px' }}>EVET, KAYDET</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@media (max-width: 768px) { .ideas-grid { grid-template-columns: 1fr !important; } }`}</style>
    </>
  )
}
