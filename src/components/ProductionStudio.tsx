'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const MODELS = ['kling','runway','midjourney','veo','luma','nano-banana']

export default function ProductionStudio({ briefId, source = 'admin', userRole = 'admin' }: { briefId: string, source?: 'admin'|'creator', userRole?: 'admin'|'producer'|'creator' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState('')
  const [toast, setToast] = useState<{msg:string,type:'ok'|'err'}|null>(null)

  // Brief summary
  const [briefSummary, setBriefSummary] = useState('')

  // Producer/Admin state
  const [ideaTitle, setIdeaTitle] = useState('')
  const [ideaConcept, setIdeaConcept] = useState('')

  // Creator state
  const [creatorTab, setCreatorTab] = useState<'ideas'|'scenario'>('ideas')
  const [ideas, setIdeas] = useState<any[]>([])
  const [addingIdea, setAddingIdea] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newConcept, setNewConcept] = useState('')
  const [editingId, setEditingId] = useState<string|null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editConcept, setEditConcept] = useState('')
  const [scenarioMode, setScenarioMode] = useState<'ai'|'manual'>('ai')
  const [scenarioText, setScenarioText] = useState('')
  const [selectedModel, setSelectedModel] = useState('kling')
  const [prompts, setPrompts] = useState<any[]>([])
  const [copiedId, setCopiedId] = useState<string|null>(null)
  const [producerIdea, setProducerIdea] = useState<{title:string,concept:string}|null>(null)

  useEffect(() => { if (isOpen) loadData() }, [isOpen, briefId])

  function showToast(msg: string, type: 'ok'|'err') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function loadData() {
    const { data: b } = await supabase.from('briefs').select('campaign_name, video_type, format').eq('id', briefId).single()
    if (b) {
      const dur: Record<string,string> = {'Bumper / Pre-roll':'6s','Story / Reels':'15s','Feed Video':'30s','Long Form':'60s'}
      setBriefSummary(`${b.campaign_name} · ${b.video_type} · ${dur[b.video_type]||''} · ${b.format||''}`)
    }

    const { data: pb } = await supabase.from('producer_briefs').select('producer_idea, producer_idea_sent').eq('brief_id', briefId).maybeSingle()

    if (userRole === 'producer' || userRole === 'admin') {
      if (pb?.producer_idea) {
        try {
          const parsed = JSON.parse(pb.producer_idea)
          setIdeaTitle(parsed.title || '')
          setIdeaConcept(parsed.concept || '')
        } catch { setIdeaTitle(''); setIdeaConcept(pb.producer_idea) }
      }
    }

    if (userRole === 'creator') {
      if (pb?.producer_idea_sent && pb?.producer_idea) {
        try { setProducerIdea(JSON.parse(pb.producer_idea)) } catch { setProducerIdea({ title: '', concept: pb.producer_idea }) }
      }
      const { data: insps } = await supabase.from('brief_inspirations').select('*').eq('brief_id', briefId).eq('source', 'creator').order('created_at', { ascending: false })
      setIdeas(insps || [])
      // Load scenario
      const { data: scenInsp } = await supabase.from('brief_inspirations').select('scenario').eq('brief_id', briefId).eq('source', 'creator').not('scenario', 'is', null).order('created_at', { ascending: false }).limit(1)
      if (scenInsp?.[0]?.scenario) setScenarioText(typeof scenInsp[0].scenario === 'string' ? scenInsp[0].scenario : JSON.stringify(scenInsp[0].scenario))
    }
  }

  // ─── Producer/Admin: AI generate ───
  async function producerGenerate() {
    setLoading('producer-ai')
    const { data: { user } } = await supabase.auth.getUser()
    const res = await fetch('/api/generate-inspirations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, user_id: user?.id, source, count: 1 }) })
    const data = await res.json()
    if (data.inspirations?.[0]) {
      setIdeaTitle(data.inspirations[0].title || '')
      setIdeaConcept(data.inspirations[0].concept || '')
      showToast('AI fikir üretildi', 'ok')
    } else showToast('Fikir üretilemedi', 'err')
    setLoading('')
  }

  async function sendToCreator() {
    if (!ideaTitle.trim() && !ideaConcept.trim()) return
    setLoading('send')
    const idea = JSON.stringify({ title: ideaTitle.trim(), concept: ideaConcept.trim() })
    await supabase.from('producer_briefs').update({ producer_idea: idea, producer_idea_sent: true, producer_idea_sent_at: new Date().toISOString() }).eq('brief_id', briefId)
    showToast('Fikir iletildi', 'ok')
    setLoading('')
    setTimeout(() => setIsOpen(false), 800)
  }

  // ─── Creator: ideas ───
  async function creatorGenerate() {
    setLoading('creator-ai')
    const { data: { user } } = await supabase.auth.getUser()
    const res = await fetch('/api/generate-inspirations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, user_id: user?.id, source: 'creator', count: 3 }) })
    const data = await res.json()
    if (data.inspirations) { showToast(`${data.inspirations.length} fikir üretildi`, 'ok'); loadData() }
    else showToast('Fikir üretilemedi', 'err')
    setLoading('')
  }

  async function saveNewIdea() {
    if (!newTitle.trim()) return
    setLoading('new-idea')
    await supabase.from('brief_inspirations').insert({ brief_id: briefId, title: newTitle.trim(), concept: newConcept.trim(), status: 'normal', source: 'creator' })
    setAddingIdea(false); setNewTitle(''); setNewConcept('')
    showToast('Fikir eklendi', 'ok'); loadData()
    setLoading('')
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

  // ─── Creator: scenario ───
  async function generateScenario() {
    setLoading('scenario')
    // Find first idea to use as context, or create a placeholder inspiration
    let inspId = ideas[0]?.id
    if (!inspId) {
      const { data: newInsp } = await supabase.from('brief_inspirations').insert({ brief_id: briefId, title: 'Senaryo', concept: '', status: 'normal', source: 'creator' }).select('id').single()
      inspId = newInsp?.id
    }
    if (!inspId) { showToast('Fikir bulunamadı', 'err'); setLoading(''); return }
    const res = await fetch('/api/generate-scenario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inspiration_id: inspId }) })
    const data = await res.json()
    if (data.scenario) { setScenarioText(data.scenario); showToast('Senaryo üretildi', 'ok') }
    else showToast('Senaryo üretilemedi', 'err')
    setLoading('')
  }

  async function saveScenario() {
    if (!scenarioText.trim()) return
    setLoading('save-scenario')
    // Save to the first idea, or create one
    let inspId = ideas[0]?.id
    if (!inspId) {
      const { data: newInsp } = await supabase.from('brief_inspirations').insert({ brief_id: briefId, title: 'Senaryo', concept: '', status: 'normal', source: 'creator' }).select('id').single()
      inspId = newInsp?.id
      if (inspId) loadData()
    }
    if (inspId) {
      await supabase.from('brief_inspirations').update({ scenario: scenarioText.trim(), scenario_status: 'manual' }).eq('id', inspId)
      showToast('Senaryo kaydedildi', 'ok')
    }
    setLoading('')
  }

  // ─── Creator: prompts ───
  async function generatePrompts() {
    setLoading(`prompt-${selectedModel}`)
    const { data: { user } } = await supabase.auth.getUser()
    // Need an inspiration with scenario
    let inspId = ideas.find(i => i.scenario)?.id || ideas[0]?.id
    if (!inspId) { showToast('Önce senaryo kaydedin', 'err'); setLoading(''); return }
    const res = await fetch('/api/generate-prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inspiration_id: inspId, model: selectedModel, user_id: user?.id }) })
    const data = await res.json()
    if (data.prompts) { setPrompts(data.prompts); showToast(`${selectedModel} promptları üretildi`, 'ok') }
    else showToast(data.error || 'Prompt üretilemedi', 'err')
    setLoading('')
  }

  async function loadPrompts() {
    const inspId = ideas.find(i => i.scenario)?.id || ideas[0]?.id
    if (!inspId) return
    const { data } = await supabase.from('inspiration_prompts').select('*').eq('inspiration_id', inspId).eq('model', selectedModel).order('scene')
    setPrompts(data || [])
  }
  useEffect(() => { if (isOpen && userRole === 'creator' && creatorTab === 'scenario') loadPrompts() }, [selectedModel, isOpen, ideas])

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px', borderRadius: '100px', fontSize: '11px', fontWeight: '500',
    cursor: 'pointer', fontFamily: 'Inter,sans-serif', border: 'none',
    background: active ? '#111113' : 'rgba(0,0,0,0.04)', color: active ? '#fff' : '#888',
  })

  const btnPrimary: React.CSSProperties = { padding: '10px 24px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter,sans-serif', fontWeight: '500' }
  const btnSecondary: React.CSSProperties = { padding: '10px 24px', background: '#fff', color: '#0a0a0a', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter,sans-serif', fontWeight: '500' }
  const inputStyle: React.CSSProperties = { width: '100%', fontSize: '14px', fontWeight: '500', color: '#0a0a0a', border: '0.5px solid #e0e0e0', borderRadius: '8px', padding: '8px 12px', fontFamily: 'Inter,sans-serif', outline: 'none' }
  const textareaStyle: React.CSSProperties = { width: '100%', fontSize: '13px', color: '#0a0a0a', lineHeight: '1.7', border: '0.5px solid #e0e0e0', borderRadius: '8px', padding: '10px 12px', fontFamily: 'Inter,sans-serif', outline: 'none', resize: 'vertical' }

  return (
    <>
      <style>{`@keyframes studioPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}.studio-ta::placeholder{color:#aaa}`}</style>
      <button onClick={() => setIsOpen(true)}
        onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(29,184,29,0.8)';e.currentTarget.style.background='rgba(29,184,29,0.06)'}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(29,184,29,0.4)';e.currentTarget.style.background='#111113'}}
        style={{ width: '100%', height: '48px', background: '#111113', border: '1px solid rgba(29,184,29,0.4)', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', transition: 'all 0.15s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1db81d', animation: 'studioPulse 2s ease-in-out infinite' }} />
          <span style={{ fontSize: '13px', fontWeight: '500', color: '#fff' }}>Prodüksiyon Stüdyosu</span>
        </div>
        <span style={{ fontSize: '14px', color: '#1db81d' }}>&rarr;</span>
      </button>

      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }} onClick={() => setIsOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: userRole === 'creator' ? '1060px' : '640px', height: '90vh', background: '#111113', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* TOPBAR */}
            <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '16px', fontWeight: '500', color: '#fff', letterSpacing: '-0.5px' }}>
                  dinam<span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', border: '2px solid #22c55e', position: 'relative', top: '1px' }}></span>
                </span>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>Prodüksiyon Stüdyosu</span>
              </div>
              <button onClick={() => setIsOpen(false)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '16px' }}>✕</button>
            </div>

            {/* TOAST */}
            {toast && (
              <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 200, padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '500', color: '#fff', background: toast.type === 'ok' ? '#22c55e' : '#ef4444', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                {toast.msg}
              </div>
            )}

            {/* ═══════════ PRODUCER / ADMIN BODY ═══════════ */}
            {(userRole === 'producer' || userRole === 'admin') && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#fff', borderRadius: '0 0 16px 16px' }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '20px' }}>{briefSummary}</div>

                <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '14px' }}>Fikir</div>

                <input value={ideaTitle} onChange={e => setIdeaTitle(e.target.value)} placeholder="Başlık..."
                  style={{ ...inputStyle, marginBottom: '10px' }} />
                <textarea className="studio-ta" value={ideaConcept} onChange={e => setIdeaConcept(e.target.value)} placeholder="Konsepti anlat..." rows={6}
                  style={{ ...textareaStyle, minHeight: '140px', marginBottom: '14px' }} />

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button onClick={producerGenerate} disabled={!!loading} style={{ ...btnSecondary, opacity: loading ? 0.5 : 1 }}>
                    {loading === 'producer-ai' ? 'Üretiliyor...' : 'AI Üret'}
                  </button>
                  <div style={{ flex: 1 }} />
                  <button onClick={sendToCreator} disabled={!!loading || (!ideaTitle.trim() && !ideaConcept.trim())}
                    style={{ padding: '10px 28px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter,sans-serif', fontWeight: '500', opacity: loading || (!ideaTitle.trim() && !ideaConcept.trim()) ? 0.5 : 1 }}>
                    {loading === 'send' ? 'Gönderiliyor...' : "Creator'a Gönder"}
                  </button>
                </div>
              </div>
            )}

            {/* ═══════════ CREATOR BODY ═══════════ */}
            {userRole === 'creator' && (
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden', borderRadius: '0 0 16px 16px' }}>

                {/* LEFT PANEL */}
                <div style={{ width: '240px', background: '#f5f4f0', borderRight: '0.5px solid rgba(0,0,0,0.08)', overflowY: 'auto', padding: '20px', flexShrink: 0 }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>{briefSummary}</div>

                  {producerIdea && (
                    <div style={{ border: '1.5px solid rgba(34,197,94,0.4)', borderRadius: '10px', padding: '12px', background: 'rgba(34,197,94,0.03)' }}>
                      <div style={{ fontSize: '10px', color: '#22c55e', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '8px' }}>Prodüktörden</div>
                      {producerIdea.title && <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a', marginBottom: '4px' }}>{producerIdea.title}</div>}
                      <div style={{ fontSize: '12px', color: '#555', lineHeight: 1.6 }}>{producerIdea.concept}</div>
                    </div>
                  )}
                </div>

                {/* RIGHT PANEL */}
                <div style={{ flex: 1, background: '#fff', overflowY: 'auto', padding: '20px' }}>

                  {/* TABS */}
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
                    <button onClick={() => setCreatorTab('ideas')} style={pillStyle(creatorTab === 'ideas')}>Fikirler</button>
                    <button onClick={() => setCreatorTab('scenario')} style={pillStyle(creatorTab === 'scenario')}>Senaryo</button>
                  </div>

                  {/* ── IDEAS TAB ── */}
                  {creatorTab === 'ideas' && (
                    <div>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <button onClick={creatorGenerate} disabled={!!loading} style={{ ...btnPrimary, opacity: loading ? 0.5 : 1 }}>
                          {loading === 'creator-ai' ? 'Üretiliyor...' : 'AI Üret'}
                        </button>
                        <button onClick={() => { setAddingIdea(true); setNewTitle(''); setNewConcept('') }} disabled={addingIdea} style={{ ...btnSecondary, opacity: addingIdea ? 0.5 : 1 }}>
                          Manuel Ekle
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px' }}>
                        {addingIdea && (
                          <div style={{ border: '1.5px solid #3b82f6', borderRadius: '10px', padding: '14px', background: '#fafaf8' }}>
                            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Fikir başlığı..." style={{ ...inputStyle, fontSize: '13px', marginBottom: '8px' }} />
                            <textarea className="studio-ta" value={newConcept} onChange={e => setNewConcept(e.target.value)} placeholder="Konsepti anlat..." rows={3} style={{ ...textareaStyle, fontSize: '12px', marginBottom: '8px' }} />
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={saveNewIdea} disabled={!!loading || !newTitle.trim()} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: '#111113', fontSize: '11px', color: '#fff', cursor: 'pointer', fontFamily: 'Inter,sans-serif', fontWeight: '500', opacity: loading || !newTitle.trim() ? 0.5 : 1 }}>
                                {loading === 'new-idea' ? '...' : 'Kaydet'}
                              </button>
                              <button onClick={() => setAddingIdea(false)} style={{ padding: '5px 12px', borderRadius: '6px', border: '0.5px solid rgba(0,0,0,0.1)', background: '#fff', fontSize: '11px', color: '#888', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>İptal</button>
                            </div>
                          </div>
                        )}

                        {ideas.map(idea => (
                          <div key={idea.id} style={{ border: editingId === idea.id ? '1.5px solid #3b82f6' : '0.5px solid rgba(0,0,0,0.08)', borderRadius: '10px', padding: '14px', background: '#fafaf8' }}>
                            {editingId === idea.id ? (
                              <div>
                                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ ...inputStyle, fontSize: '13px', marginBottom: '8px' }} />
                                <textarea className="studio-ta" value={editConcept} onChange={e => setEditConcept(e.target.value)} rows={3} style={{ ...textareaStyle, fontSize: '12px', marginBottom: '8px' }} />
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button onClick={() => saveEditIdea(idea.id)} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: '#111113', fontSize: '11px', color: '#fff', cursor: 'pointer', fontFamily: 'Inter,sans-serif', fontWeight: '500' }}>Kaydet</button>
                                  <button onClick={() => setEditingId(null)} style={{ padding: '5px 12px', borderRadius: '6px', border: '0.5px solid rgba(0,0,0,0.1)', background: '#fff', fontSize: '11px', color: '#888', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>İptal</button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '4px' }}>{idea.title}</div>
                                <div style={{ fontSize: '12px', color: '#555', lineHeight: 1.6, marginBottom: '10px' }}>{idea.concept}</div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button onClick={() => { setEditingId(idea.id); setEditTitle(idea.title); setEditConcept(idea.concept || '') }}
                                    style={{ padding: '4px 10px', borderRadius: '6px', border: '0.5px solid rgba(0,0,0,0.1)', background: '#fff', fontSize: '10px', color: '#555', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Düzenle</button>
                                  <button onClick={() => deleteIdea(idea.id)}
                                    style={{ padding: '4px 10px', borderRadius: '6px', border: '0.5px solid rgba(239,68,68,0.2)', background: '#fff', fontSize: '10px', color: '#ef4444', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Sil</button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {ideas.length === 0 && !addingIdea && (
                        <div style={{ textAlign: 'center', padding: '32px 0', color: '#aaa', fontSize: '13px' }}>Henüz fikir yok. AI ile üretin veya manuel ekleyin.</div>
                      )}
                    </div>
                  )}

                  {/* ── SCENARIO TAB ── */}
                  {creatorTab === 'scenario' && (
                    <div>
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
                        <button onClick={() => setScenarioMode('ai')} style={pillStyle(scenarioMode === 'ai')}>AI Üret</button>
                        <button onClick={() => setScenarioMode('manual')} style={pillStyle(scenarioMode === 'manual')}>Manuel Yaz</button>
                      </div>

                      {scenarioMode === 'ai' && (
                        <div>
                          <button onClick={generateScenario} disabled={!!loading} style={{ ...btnPrimary, marginBottom: '14px', opacity: loading ? 0.5 : 1 }}>
                            {loading === 'scenario' ? 'Üretiliyor...' : 'Senaryo Üret'}
                          </button>
                          {scenarioText && (
                            <div>
                              <textarea className="studio-ta" value={scenarioText} onChange={e => setScenarioText(e.target.value)} rows={12}
                                style={{ ...textareaStyle, minHeight: '200px', background: '#fff', marginBottom: '10px' }} />
                              <button onClick={saveScenario} disabled={!!loading || !scenarioText.trim()} style={{ ...btnPrimary, opacity: loading || !scenarioText.trim() ? 0.5 : 1 }}>
                                {loading === 'save-scenario' ? 'Kaydediliyor...' : 'Kaydet'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {scenarioMode === 'manual' && (
                        <div>
                          <textarea className="studio-ta" value={scenarioText} onChange={e => setScenarioText(e.target.value)} placeholder="Sahne sahne senaryo yaz..." rows={12}
                            style={{ ...textareaStyle, minHeight: '220px', background: '#fff', marginBottom: '10px' }} />
                          <button onClick={saveScenario} disabled={!!loading || !scenarioText.trim()} style={{ ...btnPrimary, opacity: loading || !scenarioText.trim() ? 0.5 : 1 }}>
                            {loading === 'save-scenario' ? 'Kaydediliyor...' : 'Kaydet'}
                          </button>
                        </div>
                      )}

                      {/* PROMPTS SECTION */}
                      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a', marginBottom: '12px' }}>Promptlar</div>

                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                          {MODELS.map(m => (
                            <button key={m} onClick={() => setSelectedModel(m)}
                              style={{ padding: '6px 14px', borderRadius: '100px', fontSize: '11px', fontWeight: '500', cursor: 'pointer', fontFamily: 'Inter,sans-serif', border: selectedModel === m ? '1.5px solid #3b82f6' : '1px solid rgba(0,0,0,0.1)', background: selectedModel === m ? 'rgba(59,130,246,0.06)' : '#fff', color: selectedModel === m ? '#3b82f6' : '#555', textTransform: 'capitalize' }}>
                              {m === 'nano-banana' ? 'Nano Banana' : m}
                            </button>
                          ))}
                        </div>

                        <button onClick={generatePrompts} disabled={!!loading} style={{ ...btnPrimary, marginBottom: '14px', opacity: loading ? 0.5 : 1 }}>
                          {loading === `prompt-${selectedModel}` ? 'Üretiliyor...' : `${selectedModel === 'nano-banana' ? 'Nano Banana' : selectedModel} prompt üret`}
                        </button>

                        {prompts.length > 0 && prompts.map((p, i) => (
                          <div key={p.id || i} style={{ marginBottom: '10px', padding: '12px', background: '#0a0a0a', borderRadius: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: '500' }}>Sahne {p.scene}</span>
                              <button onClick={() => copyText(p.prompt, `${p.id || i}`)}
                                style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '6px', border: '0.5px solid rgba(255,255,255,0.15)', background: 'transparent', color: copiedId === `${p.id || i}` ? '#22c55e' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                                {copiedId === `${p.id || i}` ? 'Kopyalandı' : 'Kopyala'}
                              </button>
                            </div>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, fontFamily: 'monospace', wordBreak: 'break-all' }}>{p.prompt}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
