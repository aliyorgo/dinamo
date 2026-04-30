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
  const [promptText, setPromptText] = useState('')
  const [copiedPrompt, setCopiedPrompt] = useState(false)

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
    if (scenInsp?.[0]?.scenario) setScenarioText(typeof scenInsp[0].scenario === 'string' ? scenInsp[0].scenario : JSON.stringify(scenInsp[0].scenario))
  }

  // ─── Step 1: Ideas ───
  async function generateIdeas() {
    setLoading('ideas')
    const { data: { user } } = await supabase.auth.getUser()
    const res = await fetch('/api/generate-inspirations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, user_id: user?.id, source, count: 3 }) })
    const data = await res.json()
    if (data.inspirations) { showToast(`${data.inspirations.length} fikir üretildi`, 'ok'); loadData() }
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

  function selectIdea(idea: any) {
    setSelectedIdea(idea); setStep(2)
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
    const { data: { user } } = await supabase.auth.getUser()
    const inspId = ideas.find(i => i.scenario)?.id || selectedIdea?.id || ideas[0]?.id
    if (!inspId) { showToast('Önce senaryo kaydedin', 'err'); setLoading(''); return }
    const res = await fetch('/api/generate-prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inspiration_id: inspId, model: 'generic', user_id: user?.id }) })
    const data = await res.json()
    if (data.prompt) { setPromptText(data.prompt); showToast('Prompt üretildi', 'ok') }
    else if (data.prompts?.[0]?.prompt) { setPromptText(data.prompts[0].prompt); showToast('Prompt üretildi', 'ok') }
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
      <button onClick={() => setIsOpen(true)} className="btn btn-outline" style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500' }}>PRODUCTION STUDIO</span>
      </button>

      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onClick={() => setIsOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', background: '#fff', border: '1px solid #0a0a0a', display: 'flex', flexDirection: 'column' }}>

            {/* HEADER */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e4db', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>PRODUCTION STUDIO</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{briefSummary}</div>
              </div>
              <button onClick={() => setIsOpen(false)} style={{ width: '28px', height: '28px', border: '1px solid #e5e4db', background: '#fff', color: '#0a0a0a', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
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
                      <button onClick={generateIdeas} disabled={!!loading} className="btn" style={{ padding: '8px 20px', opacity: loading ? 0.5 : 1 }}>{loading === 'ideas' ? 'Üretiliyor...' : 'AI FİKİR ÜRET'}</button>
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

                    <div className="ideas-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      {ideas.map(idea => (
                        <div key={idea.id} className="studio-card" style={{ border: '1px solid #e5e4db', padding: '14px', background: '#fafaf7', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                          {editingId === idea.id ? (
                            <div>
                              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e4db', fontSize: '12px', marginBottom: '6px', boxSizing: 'border-box' }} />
                              <textarea value={editConcept} onChange={e => setEditConcept(e.target.value)} rows={2} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e4db', fontSize: '11px', marginBottom: '6px', boxSizing: 'border-box', resize: 'vertical' }} />
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={() => saveEditIdea(idea.id)} className="btn" style={{ padding: '4px 10px', fontSize: '10px' }}>Kaydet</button>
                                <button onClick={() => setEditingId(null)} className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '10px' }}>İptal</button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div onClick={() => selectIdea(idea)} style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a', marginBottom: '4px' }}>{idea.title}</div>
                                <div style={{ fontSize: '11px', color: '#6b6b66', lineHeight: 1.5 }}>{idea.concept}</div>
                              </div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={() => selectIdea(idea)} className="btn" style={{ padding: '4px 10px', fontSize: '9px' }}>SEÇ</button>
                                <button onClick={() => { setEditingId(idea.id); setEditTitle(idea.title); setEditConcept(idea.concept || '') }} className="studio-btn" style={{ padding: '4px 8px', border: '1px solid #e5e4db', background: '#fff', fontSize: '9px', cursor: 'pointer', transition: 'background 0.15s' }}>Düzenle</button>
                                <button onClick={() => deleteIdea(idea.id)} className="studio-btn" style={{ padding: '4px 8px', border: '1px solid rgba(239,68,68,0.3)', background: '#fff', fontSize: '9px', color: '#ef4444', cursor: 'pointer', transition: 'background 0.15s' }}>Sil</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {ideas.length === 0 && !addingIdea && <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-tertiary)', fontSize: '12px' }}>Henüz fikir yok. AI ile üretin veya manuel ekleyin.</div>}
                  </>
                )}
              </div>

              {/* ═══ STEP 2 — SENARYO ═══ */}
              <div style={{ border: step === 2 ? '1px solid #0a0a0a' : '1px solid #e5e4db', padding: '20px', marginBottom: '16px', opacity: step >= 2 ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: step === 2 ? '16px' : '0' }}>
                  {step2Done && <span style={{ color: '#22c55e', fontSize: '14px' }}>✓</span>}
                  <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: step === 2 ? '#0a0a0a' : 'var(--color-text-tertiary)' }}>ADIM 2 · SENARYO</span>
                </div>
                {step >= 2 && (
                  <>
                    <textarea value={scenarioText} onChange={e => setScenarioText(e.target.value)} placeholder="Senaryoyu yaz veya AI yazsın..." rows={6}
                      style={{ width: '100%', padding: '12px', border: '1px solid #e5e4db', fontSize: '13px', color: '#0a0a0a', lineHeight: '1.7', resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px' }} />
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={aiWriteScenario} disabled={!!loading} className="btn" style={{ padding: '8px 18px', opacity: loading ? 0.5 : 1 }}>{loading === 'scenario' ? 'Üretiliyor...' : 'AI YAZSIN'}</button>
                      {scenarioText.trim() && <button onClick={aiImproveScenario} disabled={!!loading} className="btn btn-outline" style={{ padding: '8px 18px', opacity: loading ? 0.5 : 1 }}>{loading === 'improve' ? 'Geliştiriliyor...' : 'AI GELİŞTİR'}</button>}
                      <button onClick={async () => { await saveScenario(); if (scenarioText.trim()) setStep(3) }} disabled={!!loading || !scenarioText.trim()} className="btn" style={{ padding: '8px 18px', marginLeft: 'auto', opacity: loading || !scenarioText.trim() ? 0.5 : 1 }}>{loading === 'save-scenario' ? 'Kaydediliyor...' : 'KAYDET'}</button>
                    </div>
                  </>
                )}
              </div>

              {/* ═══ STEP 3 — PROMPT (creator only) ═══ */}
              <div style={{ border: step === 3 ? '1px solid #0a0a0a' : '1px solid #e5e4db', padding: '20px', opacity: step >= 3 ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: step === 3 ? '16px' : '0' }}>
                  {promptText && <span style={{ color: '#22c55e', fontSize: '14px' }}>✓</span>}
                  <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: step === 3 ? '#0a0a0a' : 'var(--color-text-tertiary)' }}>ADIM 3 · PROMPT</span>
                </div>
                {step >= 3 && userRole === 'creator' ? (
                  <>
                    {promptText ? (
                      <div style={{ background: '#0a0a0a', padding: '14px 16px', marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, fontFamily: 'monospace', wordBreak: 'break-all' }}>{promptText}</div>
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={generatePrompt} disabled={!!loading} className="btn" style={{ padding: '8px 18px', opacity: loading ? 0.5 : 1 }}>{loading === 'prompt' ? 'Üretiliyor...' : 'PROMPT YAZ'}</button>
                      {promptText && <button onClick={() => { navigator.clipboard.writeText(promptText); setCopiedPrompt(true); setTimeout(() => setCopiedPrompt(false), 1500) }} className="btn btn-outline" style={{ padding: '8px 18px' }}>{copiedPrompt ? 'KOPYALANDİ ✓' : 'KOPYALA'}</button>}
                    </div>
                  </>
                ) : step >= 3 ? (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>Bu adım creator için ayrılmıştır.</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@media (max-width: 768px) { .ideas-grid { grid-template-columns: 1fr !important; } }`}</style>
    </>
  )
}
