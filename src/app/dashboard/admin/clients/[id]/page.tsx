'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'
import CountUp from 'react-countup'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)


const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  demo: { label: 'Demo', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  pending: { label: 'Beklemede', bg: 'rgba(156,163,175,0.1)', color: '#6b7280' },
  active: { label: 'Aktif', bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
  lost: { label: 'Kaybedildi', bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
}

function VoiceAssignment({ clientId }: { clientId: string }) {
  const [data, setData] = useState<{ voices: any[]; visibleCount: number; maleCount: number; femaleCount: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterGender, setFilterGender] = useState('')
  const [addModal, setAddModal] = useState(false)
  const [newVoice, setNewVoice] = useState({ voice_id: '', voice_name: '', gender: 'male' })
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  async function load() {
    const res = await fetch(`/api/admin/clients/${clientId}/voices`)
    setData(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [clientId])

  async function toggleExclude(voiceId: string, excluded: boolean) {
    if (excluded) {
      await fetch(`/api/admin/clients/${clientId}/voices`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voice_id: voiceId, relationship_type: 'excluded' }) })
    } else {
      await fetch(`/api/admin/clients/${clientId}/voices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voice_id: voiceId, relationship_type: 'excluded' }) })
    }
    load()
  }

  async function removeExclusive(voiceId: string) {
    await fetch(`/api/admin/clients/${clientId}/voices`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voice_id: voiceId, relationship_type: 'exclusive' }) })
    load()
  }

  async function addExclusive() {
    if (!newVoice.voice_id) return
    await fetch(`/api/admin/clients/${clientId}/voices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newVoice, relationship_type: 'exclusive' }) })
    setNewVoice({ voice_id: '', voice_name: '', gender: 'male' })
    setAddModal(false)
    load()
  }

  function playPreview(url: string, id: string) {
    if (playingId === id) { audioRef.current?.pause(); setPlayingId(null); return }
    if (audioRef.current) audioRef.current.pause()
    const a = new Audio(url)
    audioRef.current = a
    setPlayingId(id)
    a.onended = () => setPlayingId(null)
    a.play()
  }

  if (loading) return <div style={{ padding: '20px', color: '#888', fontSize: '12px' }}>Ses bilgileri yükleniyor...</div>
  if (!data) return null

  const myVoices = data.voices.filter(v => v.source === 'my_voices')
  const exclusiveVoices = data.voices.filter(v => v.relationship === 'exclusive')
  const filtered = filterGender ? myVoices.filter(v => v.gender === filterGender) : myVoices

  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px', marginBottom: '16px' }}>
      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '12px' }}>AI DUBLAJ SANATÇILARI</div>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
        Toplam erişilebilir: <strong style={{ color: '#0a0a0a' }}>{data.visibleCount}</strong> ses ({data.femaleCount} kadın · {data.maleCount} erkek)
      </div>

      {/* My Voices */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', fontWeight: '500' }}>MY VOICES (HAVUZ)</div>
          <select value={filterGender} onChange={e => setFilterGender(e.target.value)} style={{ padding: '3px 8px', fontSize: '11px', border: '1px solid #e5e4db' }}>
            <option value="">Tümü</option>
            <option value="female">Kadın</option>
            <option value="male">Erkek</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {filtered.map(v => (
            <div key={v.voice_id} onClick={() => toggleExclude(v.voice_id, v.relationship === 'excluded')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', border: '1px solid #e5e4db', cursor: 'pointer', opacity: v.relationship === 'excluded' ? 0.4 : 1, transition: 'opacity 0.15s', fontSize: '12px' }}>
              <span style={{ fontSize: '9px', padding: '1px 4px', background: v.gender === 'female' ? '#fce7f3' : '#dbeafe', color: v.gender === 'female' ? '#be185d' : '#1d4ed8' }}>{v.gender === 'female' ? 'K' : 'E'}</span>
              <span style={{ color: '#0a0a0a', textDecoration: v.relationship === 'excluded' ? 'line-through' : 'none', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
              {v.preview_url && <button onClick={e => { e.stopPropagation(); playPreview(v.preview_url, v.voice_id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: playingId === v.voice_id ? '#ef4444' : '#888' }}>{playingId === v.voice_id ? '■' : '▶'}</button>}
              <span style={{ fontSize: '9px', color: v.relationship === 'excluded' ? '#ef4444' : '#22c55e' }}>{v.relationship === 'excluded' ? '✗' : '✓'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Exclusive */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', marginBottom: '8px', fontWeight: '500' }}>MÜŞTERİYE ÖZEL SESLER</div>
        {exclusiveVoices.length === 0 && <div style={{ fontSize: '12px', color: '#aaa' }}>Henüz özel ses atanmamış</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {exclusiveVoices.map(v => (
            <div key={v.voice_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', border: '1px solid #a855f7', background: 'rgba(168,85,247,0.05)', fontSize: '12px' }}>
              <span style={{ fontSize: '9px', padding: '1px 4px', background: v.gender === 'female' ? '#fce7f3' : '#dbeafe', color: v.gender === 'female' ? '#be185d' : '#1d4ed8' }}>{v.gender === 'female' ? 'K' : 'E'}</span>
              <span style={{ color: '#0a0a0a' }}>{v.name}</span>
              <button onClick={() => removeExclusive(v.voice_id)} style={{ fontSize: '9px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>✗</button>
            </div>
          ))}
        </div>
        <button onClick={() => setAddModal(true)} style={{ fontSize: '11px', padding: '4px 10px', border: '1px dashed #ccc', background: '#fff', cursor: 'pointer', color: '#888' }}>+ ÖZEL SES EKLE</button>
      </div>

      {/* Summary */}
      <div style={{ fontSize: '11px', color: '#888', borderTop: '1px solid #e5e4db', paddingTop: '10px' }}>
        {data.visibleCount} ses görüyor: {myVoices.filter(v => v.relationship !== 'excluded').length} My Voices + {exclusiveVoices.length} exclusive{myVoices.filter(v => v.relationship === 'excluded').length > 0 ? ` - ${myVoices.filter(v => v.relationship === 'excluded').length} hariç tutulan` : ''}
      </div>

      {/* Add Exclusive Modal */}
      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setAddModal(false)}>
          <div style={{ background: '#fff', padding: '24px', maxWidth: '500px', width: '90%', border: '1px solid #0a0a0a' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '12px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', marginBottom: '16px' }}>ÖZEL SES EKLE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <div><div style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', marginBottom: '4px' }}>VOICE ID *</div><input value={newVoice.voice_id} onChange={e => setNewVoice(v => ({ ...v, voice_id: e.target.value }))} placeholder="ElevenLabs Voice ID" style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #e5e4db', boxSizing: 'border-box' }} /></div>
              <div><div style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', marginBottom: '4px' }}>SES ADI</div><input value={newVoice.voice_name} onChange={e => setNewVoice(v => ({ ...v, voice_name: e.target.value }))} placeholder="Ses adı" style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #e5e4db', boxSizing: 'border-box' }} /></div>
              <div><div style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', marginBottom: '4px' }}>CİNSİYET</div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><input type="radio" checked={newVoice.gender === 'male'} onChange={() => setNewVoice(v => ({ ...v, gender: 'male' }))} /> Erkek</label>
                  <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><input type="radio" checked={newVoice.gender === 'female'} onChange={() => setNewVoice(v => ({ ...v, gender: 'female' }))} /> Kadın</label>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setAddModal(false)} style={{ padding: '8px 16px', border: '1px solid #e5e4db', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>İPTAL</button>
              <button onClick={addExclusive} disabled={!newVoice.voice_id} style={{ padding: '8px 16px', background: newVoice.voice_id ? '#0a0a0a' : '#ccc', color: '#fff', border: 'none', fontSize: '12px', cursor: newVoice.voice_id ? 'pointer' : 'default' }}>EKLE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PersonaAssignment({ clientId }: { clientId: string }) {
  const [data, setData] = useState<{ personas: any[]; visibleCount: number } | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await fetch(`/api/admin/clients/${clientId}/personas`)
    const d = await res.json()
    setData(d)
    setLoading(false)
  }
  useEffect(() => { load() }, [clientId])

  async function toggleExclude(personaId: number, currentlyExcluded: boolean) {
    if (currentlyExcluded) {
      await fetch(`/api/admin/clients/${clientId}/personas`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ persona_id: personaId, relationship_type: 'excluded' }) })
    } else {
      await fetch(`/api/admin/clients/${clientId}/personas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ persona_id: personaId, relationship_type: 'excluded' }) })
    }
    load()
  }

  async function removeExclusive(personaId: number) {
    await fetch(`/api/admin/clients/${clientId}/personas`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ persona_id: personaId, relationship_type: 'exclusive' }) })
    load()
  }

  async function addExclusive(personaId: number) {
    await fetch(`/api/admin/clients/${clientId}/personas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ persona_id: personaId, relationship_type: 'exclusive' }) })
    load()
  }

  if (loading) return <div style={{ padding: '20px', color: '#888', fontSize: '12px' }}>Persona bilgileri yükleniyor...</div>
  if (!data) return null

  const globalPersonas = data.personas.filter(p => p.is_global)
  const exclusivePersonas = data.personas.filter(p => p.relationship === 'exclusive')
  const availableExclusive = data.personas.filter(p => !p.is_global && p.relationship !== 'exclusive')

  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px', marginBottom: '16px' }}>
      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '12px' }}>PERSONALAR</div>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
        Toplam erişilebilir: <strong style={{ color: '#0a0a0a' }}>{data.visibleCount}</strong> persona
        {data.visibleCount > 16 && <span style={{ color: '#f59e0b', marginLeft: '8px' }}>16&apos;dan fazla — müşteri panelinde scroll olacak</span>}
      </div>

      {/* Global */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', marginBottom: '8px', fontWeight: '500' }}>GLOBAL PERSONALAR</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {globalPersonas.map(p => (
            <div key={p.id} onClick={() => toggleExclude(p.id, p.relationship === 'excluded')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', border: '1px solid #e5e4db', cursor: 'pointer', opacity: p.relationship === 'excluded' ? 0.4 : 1, transition: 'opacity 0.15s' }}>
              {p.thumbnail_url && <img src={p.thumbnail_url} className="dot" style={{ width: '24px', height: '24px', objectFit: 'cover' }} />}
              <span style={{ fontSize: '12px', color: '#0a0a0a', textDecoration: p.relationship === 'excluded' ? 'line-through' : 'none' }}>{p.name}</span>
              <span style={{ fontSize: '9px', color: p.relationship === 'excluded' ? '#ef4444' : '#22c55e' }}>{p.relationship === 'excluded' ? '✗' : '✓'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Exclusive */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', marginBottom: '8px', fontWeight: '500' }}>MÜŞTERİYE ÖZEL PERSONALAR</div>
        {exclusivePersonas.length === 0 && <div style={{ fontSize: '12px', color: '#aaa' }}>Henüz özel persona atanmamış</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {exclusivePersonas.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', border: '1px solid #a855f7', background: 'rgba(168,85,247,0.05)' }}>
              {p.thumbnail_url && <img src={p.thumbnail_url} className="dot" style={{ width: '24px', height: '24px', objectFit: 'cover' }} />}
              <span style={{ fontSize: '12px', color: '#0a0a0a' }}>{p.name}</span>
              <button onClick={() => removeExclusive(p.id)} style={{ fontSize: '9px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>✗</button>
            </div>
          ))}
        </div>
        {availableExclusive.length > 0 && (
          <div>
            <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px' }}>Havuzdan ekle:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {availableExclusive.map(p => (
                <button key={p.id} onClick={() => addExclusive(p.id)} style={{ fontSize: '11px', padding: '4px 8px', border: '1px dashed #ccc', background: '#fff', cursor: 'pointer', color: '#888' }}>+ {p.name}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div style={{ fontSize: '11px', color: '#888', borderTop: '1px solid #e5e4db', paddingTop: '10px' }}>
        {data.visibleCount} persona görüyor: {globalPersonas.filter(p => p.relationship !== 'excluded').length} global + {exclusivePersonas.length} exclusive{globalPersonas.filter(p => p.relationship === 'excluded').length > 0 ? ` - ${globalPersonas.filter(p => p.relationship === 'excluded').length} hariç tutulan` : ''}
      </div>
    </div>
  )
}

export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = params.id as string

  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<any>(null)
  const [agency, setAgency] = useState<any>(null)
  const [briefs, setBriefs] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])

  const [msg, setMsg] = useState('')
  const [msgColor, setMsgColor] = useState('#22c55e')

  // Logo
  const logoRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // Edit modal
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ company_name: '', contact_email: '', status: '', legal_name: '' })
  const [saving, setSaving] = useState(false)

  // Delete modal
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Credit load modal
  const [creditModal, setCreditModal] = useState(false)
  const [creditAmount, setCreditAmount] = useState('')
  const [loadingCredit, setLoadingCredit] = useState(false)

  // Credit sale modal
  const [saleModal, setSaleModal] = useState(false)
  const [packages, setPackages] = useState<any[]>([])
  const [saleForm, setSaleForm] = useState({ package_id: '', credits: '', amount: '', payment_method: 'havale', invoice_number: '', note: '' })
  const [savingSale, setSavingSale] = useState(false)
  const [sales, setSales] = useState<any[]>([])

  // Client users
  const [clientUsers, setClientUsers] = useState<any[]>([])
  const [creditAllocModal, setCreditAllocModal] = useState<any>(null) // { user, direction: 'give' | 'take' }
  const [allocAmount, setAllocAmount] = useState('')
  const [allocSaving, setAllocSaving] = useState(false)

  async function refreshClientUsers() {
    const { data: cu } = await supabase.from('client_users').select('*, users(name, email, role)').eq('client_id', clientId)
    setClientUsers(cu || [])
    return cu || []
  }

  async function openAllocModal(cu: any, direction: 'give' | 'take') {
    const fresh = await refreshClientUsers()
    const freshUser = fresh.find((u: any) => u.id === cu.id)
    if (freshUser) {
      setCreditAllocModal({ user: freshUser, direction })
      setAllocAmount('')
    }
  }

  // AI notes
  const [aiNotes, setAiNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  // Brand
  const [brand, setBrand] = useState({ primary_color:'', secondary_color:'', forbidden_colors:'', tone:'', avoid:'', notes:'' })
  const [savingBrand, setSavingBrand] = useState(false)
  const [brandLogoUrl, setBrandLogoUrl] = useState('')
  const [brandFontUrl, setBrandFontUrl] = useState('')
  const [packshotUrl, setPackshotUrl] = useState('')
  const [packshotUploading, setPackshotUploading] = useState(false)
  const packshotRef = useRef<HTMLInputElement>(null)
  const [brandLogoPosition, setBrandLogoPosition] = useState('bottom')
  const [logoUploading, setLogoUploading] = useState(false)
  const [fontUploading, setFontUploading] = useState(false)
  const brandLogoRef = useRef<HTMLInputElement>(null)
  const brandFontRef = useRef<HTMLInputElement>(null)

  // Brand learning
  const [learningCandidates, setLearningCandidates] = useState<any[]>([])
  const [brandRules, setBrandRules] = useState<any[]>([])
  const [seedImporting, setSeedImporting] = useState(false)
  const [newRule, setNewRule] = useState({ text: '', condition: '', type: 'rule' })
  const [rulesTab, setRulesTab] = useState<'pending'|'active'|'add'>('pending')
  const [aiNotesInput, setAiNotesInput] = useState('')
  const [inlineCredit, setInlineCredit] = useState<string|null>(null)

  // AI Mode override
  const [globalAiMode, setGlobalAiMode] = useState<'fast'|'quality'>('fast')
  const [clientFastMode, setClientFastMode] = useState(false)
  const [savingAiMode, setSavingAiMode] = useState(false)

  // Brand research
  const [researchModal, setResearchModal] = useState(false)
  const [researchStep, setResearchStep] = useState<'searching'|'sources'|'processing'|'done'>('searching')
  const [researchSources, setResearchSources] = useState<{url:string,type:string,title:string,checked:boolean}[]>([])
  const [researchResult, setResearchResult] = useState(0)

  function showMsg(text: string, isError = false) {
    setMsg(text)
    setMsgColor(isError ? '#ef4444' : '#22c55e')
    setTimeout(() => setMsg(''), 3000)
  }

  useEffect(() => { load() }, [clientId])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: ud } = await supabase.from('users').select('name, role').eq('id', user.id).single()
    if (!ud || ud.role !== 'admin') { router.push('/login'); return }
    setUserName(ud.name)

    const [{ data: cl }, { data: br }, { data: tx }, { data: sl }, { data: pkgs }, { data: cu }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('briefs').select('id, campaign_name, status, credit_cost, created_at').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('credit_transactions').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('credit_sales').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('credit_packages').select('*').order('credits'),
      supabase.from('client_users').select('*, users(name, email, role)').eq('client_id', clientId),
    ])

    if (!cl) { router.push('/dashboard/admin/clients'); return }
    setClient(cl)
    setClientFastMode(cl.use_fast_mode || false)
    // Fetch global AI quality mode via server-side endpoint (RLS bypass)
    const modeRes = await fetch('/api/admin/ai-quality-mode')
    const modeData = await modeRes.json()
    setGlobalAiMode(modeData.mode === 'quality' ? 'quality' : 'fast')
    setAiNotes(cl.ai_notes || '')
    setBrand({ primary_color: cl.brand_primary_color||'', secondary_color: cl.brand_secondary_color||'', forbidden_colors: cl.brand_forbidden_colors||'', tone: cl.brand_tone||'', avoid: cl.brand_avoid||'', notes: cl.brand_notes||'' })
    setBrandLogoUrl(cl.brand_logo_url || '')
    setBrandFontUrl(cl.brand_font_url || '')
    setPackshotUrl(cl.packshot_url || '')
    setBrandLogoPosition(cl.brand_logo_position || 'bottom')
    setBriefs(br || [])
    setTransactions(tx || [])
    setSales(sl || [])
    setPackages(pkgs || [])
    setClientUsers(cu || [])

    if (cl.agency_id) {
      const { data: ag } = await supabase.from('agencies').select('id, name, logo_url, commission_rate, total_earnings').eq('id', cl.agency_id).single()
      setAgency(ag)
    }

    // Brand learning
    const { data: blc, error: blcErr } = await supabase.from('brand_learning_candidates').select('*').eq('client_id', clientId).eq('status', 'pending').order('created_at', { ascending: false })
    if (blcErr) console.error('[admin] brand_learning_candidates error:', blcErr.message)
    console.log('[admin] Learning candidates loaded:', blc?.length || 0)
    setLearningCandidates(blc || [])
    const { data: br2 } = await supabase.from('brand_rules').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setBrandRules(br2 || [])

    setLoading(false)
  }

  // -- Status change --
  async function changeStatus(newStatus: string) {
    const { error } = await supabase.from('clients').update({ status: newStatus }).eq('id', clientId)
    if (error) { showMsg(error.message, true); return }
    setClient((prev: any) => ({ ...prev, status: newStatus }))
    showMsg('Durum guncellendi.')
  }

  // -- Logo --
  async function handleLogoUpload() {
    const file = logoRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `client_${clientId}_logo.${ext}`
    const { error: upErr } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true })
    if (upErr) { showMsg(upErr.message, true); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
    const logoUrl = urlData.publicUrl
    await supabase.from('clients').update({ logo_url: logoUrl }).eq('id', clientId)
    setClient((prev: any) => ({ ...prev, logo_url: logoUrl + '?t=' + Date.now() }))
    if (logoRef.current) logoRef.current.value = ''
    showMsg('Logo guncellendi.')
    setUploading(false)
  }

  async function removeLogo() {
    await supabase.from('clients').update({ logo_url: null }).eq('id', clientId)
    setClient((prev: any) => ({ ...prev, logo_url: null }))
    showMsg('Logo kaldirildi.')
  }

  // -- Edit --
  function openEditModal() {
    setEditForm({
      company_name: client?.company_name || '',
      contact_email: client?.contact_email || '',
      status: client?.status || 'pending',
      legal_name: client?.legal_name || '',
    })
    setEditModal(true)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('clients').update({
      company_name: editForm.company_name,
      contact_email: editForm.contact_email || null,
      status: editForm.status,
      legal_name: editForm.legal_name || null,
    }).eq('id', clientId)
    if (error) { showMsg(error.message, true); setSaving(false); return }
    setClient((prev: any) => ({ ...prev, ...editForm }))
    setEditModal(false)
    setSaving(false)
    showMsg('Musteri guncellendi.')
  }

  // -- Delete --
  async function confirmDelete() {
    setDeleting(true)
    const { error } = await supabase.from('clients').delete().eq('id', clientId)
    if (error) { showMsg(error.message, true); setDeleting(false); return }
    router.push('/dashboard/admin/clients')
  }

  // -- Credit load --
  async function loadCredit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseInt(creditAmount)
    if (!amount || amount <= 0) return
    setLoadingCredit(true)

    const newBalance = Number(client.credit_balance || 0) + amount
    const { error } = await supabase.from('clients').update({ credit_balance: newBalance }).eq('id', clientId)
    if (error) { showMsg(error.message, true); setLoadingCredit(false); return }

    await supabase.from('credit_transactions').insert({
      client_id: clientId,
      amount,
      type: 'top_up',
      description: 'Admin kredi yuklemesi',
    })

    setClient((prev: any) => ({ ...prev, credit_balance: newBalance }))
    setTransactions(prev => [{ id: Date.now(), amount, type: 'top_up', description: 'Admin kredi yuklemesi', created_at: new Date().toISOString() }, ...prev])
    setCreditModal(false)
    setCreditAmount('')
    setLoadingCredit(false)
    showMsg(`${amount} kredi yuklendi.`)
  }

  // -- Credit Sale --
  function openSaleModal() {
    setSaleForm({ package_id: '', credits: '', amount: '', payment_method: 'havale', invoice_number: '', note: '' })
    setSaleModal(true)
  }

  function onPackageSelect(pkgId: string) {
    const pkg = packages.find((p: any) => p.id === pkgId)
    if (pkg) {
      setSaleForm(prev => ({ ...prev, package_id: pkgId, credits: String(pkg.credits), amount: String(pkg.price_tl || 0) }))
    } else {
      setSaleForm(prev => ({ ...prev, package_id: '', credits: '', amount: '' }))
    }
  }

  async function saveSale(e: React.FormEvent) {
    e.preventDefault()
    const credits = parseInt(saleForm.credits)
    const amount = parseFloat(saleForm.amount)
    if (!credits || credits <= 0 || !amount) return
    setSavingSale(true)

    const pricePerCredit = amount / credits
    const platformFeeRate = 0.40
    const platformFee = amount * platformFeeRate
    const netAmount = amount * (1 - platformFeeRate)
    const { error } = await supabase.from('credit_sales').insert({
      client_id: clientId,
      agency_id: client?.agency_id || null,
      package_id: saleForm.package_id || null,
      credits,
      price_per_credit: pricePerCredit,
      total_amount: amount,
      platform_fee_rate: platformFeeRate,
      platform_fee: platformFee,
      net_amount: netAmount,
      note: saleForm.note || null,
      invoice_number: saleForm.invoice_number || null,
      payment_method: saleForm.payment_method,
    })

    if (error) { showMsg(error.message, true); setSavingSale(false); return }

    // Update client credit balance
    const newBalance = Number(client.credit_balance || 0) + credits
    await supabase.from('clients').update({ credit_balance: newBalance }).eq('id', clientId)
    setClient((prev: any) => ({ ...prev, credit_balance: newBalance }))

    // Log transaction
    await supabase.from('credit_transactions').insert({
      client_id: clientId,
      amount: credits,
      type: 'top_up',
      description: `Kredi satisi — ${credits} kredi, ${amount.toLocaleString('tr-TR')} TL`,
    })

    // If agency client, add commission to agency earnings
    if (client?.agency_id && agency) {
      const commissionRate = Number(agency.commission_rate || 0)
      const commission = amount * commissionRate
      if (commission > 0) {
        const newEarnings = Number(agency.total_earnings || 0) + commission
        await supabase.from('agencies').update({ total_earnings: newEarnings }).eq('id', client.agency_id)
        setAgency((prev: any) => ({ ...prev, total_earnings: newEarnings }))
      }
    }

    setSaleModal(false)
    setSavingSale(false)
    showMsg(`${credits} kredi satisi kaydedildi.`)

    // Refresh sales list
    const { data: freshSales } = await supabase.from('credit_sales').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setSales(freshSales || [])
    const { data: freshTx } = await supabase.from('credit_transactions').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setTransactions(freshTx || [])
  }

  // -- Credit Allocation --
  async function allocateCredit(e: React.FormEvent) {
    e.preventDefault()
    if (!creditAllocModal) return
    const amount = parseInt(allocAmount)
    if (!amount || amount <= 0) return
    setAllocSaving(true)

    const cu = creditAllocModal.user
    const isGive = creditAllocModal.direction === 'give'
    const pool = Number(client?.credit_balance || 0)
    const current = Number(cu.allocated_credits || 0)

    if (isGive) {
      if (amount > pool) { showMsg('Havuzda yeterli kredi yok.', true); setAllocSaving(false); return }
      await supabase.from('client_users').update({ allocated_credits: current + amount }).eq('id', cu.id)
      await supabase.from('clients').update({ credit_balance: pool - amount }).eq('id', clientId)
      setClient((prev: any) => ({ ...prev, credit_balance: pool - amount }))
      setClientUsers(prev => prev.map(u => u.id === cu.id ? { ...u, allocated_credits: current + amount } : u))
      showMsg(`${amount} kredi atandi.`)
    } else {
      const takeAmount = Math.min(amount, current)
      if (takeAmount <= 0) { showMsg('Geri alinacak kredi yok.', true); setAllocSaving(false); return }
      await supabase.from('client_users').update({ allocated_credits: current - takeAmount }).eq('id', cu.id)
      await supabase.from('clients').update({ credit_balance: pool + takeAmount }).eq('id', clientId)
      setClient((prev: any) => ({ ...prev, credit_balance: pool + takeAmount }))
      setClientUsers(prev => prev.map(u => u.id === cu.id ? { ...u, allocated_credits: current - takeAmount } : u))
      showMsg(`${takeAmount} kredi geri alindi.`)
    }

    setCreditAllocModal(null)
    setAllocAmount('')
    setAllocSaving(false)
  }

  const totalAllocated = clientUsers.reduce((sum, cu) => sum + Number(cu.allocated_credits || 0), 0)

  // -- AI Notes --
  async function saveAiNotes() {
    setSavingNotes(true)
    await supabase.from('clients').update({ ai_notes: aiNotes || null }).eq('id', clientId)
    setSavingNotes(false)
    showMsg('AI notlari kaydedildi.')
  }

  async function saveBrand() {
    setSavingBrand(true)
    await supabase.from('clients').update({
      brand_primary_color: brand.primary_color || null,
      brand_secondary_color: brand.secondary_color || null,
      brand_logo_position: brandLogoPosition,
    }).eq('id', clientId)
    setSavingBrand(false)
    showMsg('Marka bilgileri kaydedildi.')
  }


  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '0.5px solid rgba(0,0,0,0.15)',
    borderRadius: '8px', fontSize: '13px', color: '#0a0a0a',
     outline: 'none', boxSizing: 'border-box', background: '#fff',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  }

  const BRIEF_STATUS: Record<string, { label: string; color: string }> = {
    draft: { label: 'Taslak', color: '#6b7280' },
    submitted: { label: 'Gonderildi', color: '#3b82f6' },
    in_production: { label: 'Uretimde', color: '#f59e0b' },
    delivered: { label: 'Teslim', color: '#22c55e' },
    completed: { label: 'Tamamlandi', color: '#22c55e' },
    cancelled: { label: 'Iptal', color: '#ef4444' },
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0',  }}>
        <div style={{ color: '#888', fontSize: '14px' }}>Yukleniyor...</div>
      </div>
    )
  }

  const st = STATUS_MAP[client?.status] || STATUS_MAP.pending

  return (
    <>
        {/* HEADER */}
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '1px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button onClick={() => router.push('/dashboard/admin/clients')} className="btn-ghost"
            style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '4px 8px' }}>
            ← MÜŞTERİLER
          </button>
          <span style={{ color: 'var(--color-border-tertiary)' }}>/</span>
          {client?.logo_url && (
            <div style={{ width: '24px', height: '24px', overflow: 'hidden', background: '#fff', border: '1px solid var(--color-border-tertiary)', flexShrink: 0 }}>
              <img src={client.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '2px' }} />
            </div>
          )}
          <div style={{ fontSize: '18px', fontWeight: '500', color: 'var(--color-text-primary)' }}>{client?.company_name}</div>
          <span style={{ fontSize: '10px', padding: '3px 8px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', background: st.bg, color: st.color }}>{st.label}</span>
          {msg && <div style={{ marginLeft: 'auto', fontSize: '12px', color: msgColor }}>{msg}</div>}
        </div>

        {/* HERO METRICS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)' }}>
          {[
            { label: 'AKTİF KURAL', value: brandRules.length },
            { label: 'ONAY BEKLEYEN', value: learningCandidates.length },
            { label: 'BRIEF', value: briefs.length },
            { label: 'KREDİ BAKİYE', value: client?.credit_balance || 0 },
          ].map(m => (
            <div key={m.label} style={{ padding: '16px 20px', borderRight: '1px solid var(--color-border-tertiary)' }}>
              <div style={{ fontSize: '10px', letterSpacing: '2px', fontWeight: '500', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>{m.label}</div>
              <div style={{ fontSize: '28px', fontWeight: '500', color: 'var(--color-text-primary)', letterSpacing: '-1px' }}>
                <CountUp end={m.value} duration={1.2} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>

            {/* LEFT COLUMN — compact info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* LOGO */}
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '14px' }}>Logo</div>
                <div style={{ width: '100%', height: '120px', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: '10px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf8', overflow: 'hidden' }}>
                  {client?.logo_url ? (
                    <img src={client.logo_url} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '12px' }} />
                  ) : (
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#111113', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '22px', fontWeight: '500', color: '#fff' }}>{client?.company_name?.charAt(0)?.toUpperCase() || 'C'}</span>
                    </div>
                  )}
                </div>
                <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => logoRef.current?.click()} disabled={uploading}
                    style={{ flex: 1, padding: '7px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: uploading ? 'not-allowed' : 'pointer',  }}>
                    {uploading ? 'Yukleniyor...' : 'Logo Yukle'}
                  </button>
                  {client?.logo_url && (
                    <button onClick={removeLogo}
                      style={{ padding: '7px 12px', background: '#fff', color: '#888', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',  }}>
                      Kaldir
                    </button>
                  )}
                </div>
              </div>

              {/* INFO */}
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '12px' }}>Bilgiler</div>
                {[
                  { label: 'Durum', value: st.label, color: st.color },
                  { label: 'E-posta', value: client?.contact_email || '\u2014' },
                  { label: 'Havuz Kredisi', value: `${client?.credit_balance || 0}`, color: '#22c55e', editable: true },
                  { label: 'Atanmis Kredi', value: `${totalAllocated}` },
                  { label: 'Toplam Kredi', value: `${(client?.credit_balance || 0) + totalAllocated}`, color: '#0a0a0a' },
                  { label: 'Ajans', value: agency ? agency.name : 'Direkt musteri' },
                  { label: 'Briefler', value: `${briefs.length}` },
                  { label: 'Olusturulma', value: client?.created_at ? new Date(client.created_at).toLocaleDateString('tr-TR') : '\u2014' },
                ].map((row: any) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>{row.label}</span>
                    {row.editable ? (
                      inlineCredit !== null ? (
                        <form onSubmit={async (e) => {
                          e.preventDefault()
                          const val = parseInt(inlineCredit)
                          if (isNaN(val) || val < 0) { setInlineCredit(null); return }
                          const diff = val - (client?.credit_balance || 0)
                          await supabase.from('clients').update({ credit_balance: val }).eq('id', clientId)
                          if (diff !== 0) {
                            await supabase.from('credit_transactions').insert({ client_id: clientId, amount: diff, type: diff > 0 ? 'top_up' : 'deduct', description: `Admin inline düzenleme (${diff > 0 ? '+' : ''}${diff})` })
                            setTransactions(prev => [{ id: Date.now(), amount: diff, type: diff > 0 ? 'top_up' : 'deduct', description: `Admin inline düzenleme`, created_at: new Date().toISOString() }, ...prev])
                          }
                          setClient((prev: any) => ({ ...prev, credit_balance: val }))
                          setInlineCredit(null)
                          showMsg(diff > 0 ? `${diff} kredi eklendi.` : diff < 0 ? `${Math.abs(diff)} kredi düşüldü.` : 'Değişiklik yok.')
                        }} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input type="number" value={inlineCredit} onChange={e => setInlineCredit(e.target.value)} autoFocus onBlur={() => setTimeout(() => setInlineCredit(null), 200)}
                            style={{ width: '70px', padding: '2px 6px', border: '1px solid #0a0a0a', fontSize: '12px', fontWeight: '500', textAlign: 'right' }} />
                        </form>
                      ) : (
                        <span onClick={() => setInlineCredit(String(client?.credit_balance || 0))} style={{ fontSize: '12px', fontWeight: '500', color: row.color || '#0a0a0a', cursor: 'pointer', borderBottom: '1px dashed #ccc' }}>{row.value}</span>
                      )
                    ) : (
                      <span style={{ fontSize: '12px', fontWeight: '500', color: row.color || '#0a0a0a' }}>{row.value}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* STATUS CHANGE */}
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '12px' }}>Durum Degistir</div>
                <select value={client?.status || 'pending'} onChange={e => changeStatus(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  {Object.entries(STATUS_MAP).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>

              {/* ACTIONS */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={openSaleModal} className="btn btn-accent" style={{ flex: 1, padding: '10px' }}>
                  KREDİ SATIŞI
                </button>
                <button onClick={() => { setCreditModal(true); setCreditAmount('') }} className="btn" style={{ flex: 1, padding: '10px' }}>
                  KREDİ YÜKLE
                </button>
                <button onClick={openEditModal} className="btn btn-outline" style={{ flex: 1, padding: '10px' }}>
                  DÜZENLE
                </button>
                <button onClick={() => setDeleteModal(true)}
                  style={{ padding: '10px 14px', background: '#fff', color: '#ef4444', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer',  }}>
                  Sil
                </button>
              </div>

              {/* AI NOTES */}
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '10px' }}>
                  AI Notlari <span style={{ fontWeight: '400', color: '#bbb', textTransform: 'none' }}>\u2014 fikir/senaryo uretiminde kullanilir</span>
                </div>
                <textarea value={aiNotes} onChange={e => setAiNotes(e.target.value)}
                  placeholder="Musterinin tercihleri, tarzi, hassasiyetleri..."
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border-tertiary)', borderRadius: '8px', fontSize: '12px', color: '#0a0a0a', resize: 'vertical',  outline: 'none', boxSizing: 'border-box' }} />
                <button onClick={saveAiNotes} disabled={savingNotes}
                  style={{ marginTop: '8px', padding: '7px 16px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '500', cursor: savingNotes ? 'not-allowed' : 'pointer',  }}>
                  {savingNotes ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>

              {/* CUSTOMIZATION TIER */}
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '10px' }}>Customization Tier</div>
                <select value={client?.customization_tier || 'basic'} onChange={async (e) => {
                  const val = e.target.value
                  await supabase.from('clients').update({ customization_tier: val }).eq('id', clientId)
                  setClient((prev: any) => ({ ...prev, customization_tier: val }))
                  showMsg('Tier güncellendi')
                }} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border-tertiary)', fontSize: '13px', color: '#0a0a0a' }}>
                  <option value="basic">Basic</option>
                  <option value="advanced">Advanced</option>
                  <option value="corporate">Kurumsal</option>
                </select>
              </div>

              {/* DİNAMO AI MODU */}
              {globalAiMode === 'quality' && (
                <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '14px' }}>
                    Dinamo AI Modu
                  </div>
                  <div style={{ display: 'flex', gap: '0', marginBottom: '10px' }}>
                    {([['false', 'KALİTE'], ['true', 'HIZ']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => setClientFastMode(val === 'true')}
                        style={{ padding: '8px 20px', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer', border: '1px solid #0a0a0a', background: (clientFastMode ? 'true' : 'false') === val ? '#0a0a0a' : '#fff', color: (clientFastMode ? 'true' : 'false') === val ? '#fff' : '#0a0a0a', marginRight: val === 'false' ? '-1px' : '0', transition: 'all 0.15s' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px' }}>
                    {clientFastMode ? 'Platformdaki AI özelliklerinin hızı artar, kalite biraz düşer. Vaktiniz çok azsa hızlı işler için bu moda geçin.' : 'Platformdaki AI özelliklerinin kalitesi artar, bekleme süreleri biraz artar. Bu modda kullanmanızı öneriyoruz.'}
                  </div>
                  <button onClick={async () => {
                    setSavingAiMode(true)
                    await fetch(`/api/admin/clients/${clientId}/ai-mode`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ use_fast_mode: clientFastMode }) })
                    setSavingAiMode(false)
                    showMsg('AI seçimi güncellendi')
                  }} disabled={savingAiMode}
                    style={{ padding: '7px 16px', background: '#111113', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '500', cursor: savingAiMode ? 'not-allowed' : 'pointer' }}>
                    {savingAiMode ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              )}

              {/* BRAND ASSETS */}
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '14px' }}>
                  Marka Varlıkları
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '10px 12px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>AI Express</div>
                    <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{client?.ai_video_enabled ? 'Müşteri AI video üretebilir' : 'Devre dışı'}</div>
                  </div>
                  <button onClick={async () => {
                    const newVal = !client?.ai_video_enabled
                    await supabase.from('clients').update({ ai_video_enabled: newVal }).eq('id', clientId)
                    setClient((prev: any) => ({ ...prev, ai_video_enabled: newVal }))
                    showMsg(newVal ? 'AI Video açıldı' : 'AI Video kapatıldı')
                  }}
                    style={{ width: '44px', height: '24px', borderRadius: '100px', border: 'none', cursor: 'pointer', background: client?.ai_video_enabled ? '#1db81d' : '#ddd', position: 'relative', transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', top: '3px', left: client?.ai_video_enabled ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }}></span>
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '10px 12px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>AI Persona</div>
                    <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{client?.ugc_enabled ? 'Müşteri UGC üretebilir' : 'Devre dışı'}</div>
                  </div>
                  <button onClick={async () => {
                    const newVal = !client?.ugc_enabled
                    await supabase.from('clients').update({ ugc_enabled: newVal }).eq('id', clientId)
                    setClient((prev: any) => ({ ...prev, ugc_enabled: newVal }))
                    showMsg(newVal ? 'UGC açıldı' : 'UGC kapatıldı')
                  }}
                    style={{ width: '44px', height: '24px', borderRadius: '100px', border: 'none', cursor: 'pointer', background: client?.ugc_enabled ? '#1db81d' : '#ddd', position: 'relative', transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', top: '3px', left: client?.ugc_enabled ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }}></span>
                  </button>
                </div>
                {/* Brand Logo */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Marka Logosu (Transparan PNG)</div>
                  {brandLogoUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '80px', height: '40px', background: '#fff', border: '1px solid var(--color-border-tertiary)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                        <img src={brandLogoUrl} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      </div>
                      <button onClick={async () => { await supabase.from('clients').update({ brand_logo_url: null }).eq('id', clientId); setBrandLogoUrl(''); showMsg('Logo kaldırıldı.') }}
                        style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer',  }}>Kaldır</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input ref={brandLogoRef} type="file" accept=".png" onChange={async () => {
                        const file = brandLogoRef.current?.files?.[0]
                        if (!file) return
                        if (file.size > 2 * 1024 * 1024) { alert('Max 2MB'); return }
                        setLogoUploading(true)
                        const path = `brand-logos/${clientId}_${Date.now()}.png`
                        const { error: upErr } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true })
                        if (upErr) { showMsg(upErr.message, true); setLogoUploading(false); return }
                        const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
                        await supabase.from('clients').update({ brand_logo_url: urlData.publicUrl }).eq('id', clientId)
                        setBrandLogoUrl(urlData.publicUrl)
                        setLogoUploading(false)
                        showMsg('Logo yüklendi.')
                      }} style={{ fontSize: '11px' }} disabled={logoUploading} />
                      {logoUploading && <span style={{ fontSize: '11px', color: '#888' }}>Yükleniyor...</span>}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="color" value={brand.primary_color || '#000000'} onChange={e => setBrand({ ...brand, primary_color: e.target.value })}
                      style={{ width: '32px', height: '32px', border: '1px solid #0a0a0a', cursor: 'pointer', padding: 0 }} />
                    <span style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '500', color: 'var(--color-text-secondary)' }}>PRIMARY</span>
                    <input value={brand.primary_color} onChange={e => setBrand({ ...brand, primary_color: e.target.value })} placeholder="#000000"
                      style={{ width: '80px', padding: '4px 8px', border: '1px solid var(--color-border-tertiary)', fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="color" value={brand.secondary_color || '#000000'} onChange={e => setBrand({ ...brand, secondary_color: e.target.value })}
                      style={{ width: '32px', height: '32px', border: '1px solid #0a0a0a', cursor: 'pointer', padding: 0 }} />
                    <span style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '500', color: 'var(--color-text-secondary)' }}>SECONDARY</span>
                    <input value={brand.secondary_color} onChange={e => setBrand({ ...brand, secondary_color: e.target.value })} placeholder="#000000"
                      style={{ width: '80px', padding: '4px 8px', border: '1px solid var(--color-border-tertiary)', fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }} />
                  </div>
                </div>
                {/* Logo pozisyonu */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Logo Pozisyonu (Statik Görsel Yan Panel)</div>
                  <select value={brandLogoPosition} onChange={e => setBrandLogoPosition(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--color-border-tertiary)', borderRadius: '8px', fontSize: '12px', color: '#0a0a0a',  }}>
                    <option value="top">Üst</option>
                    <option value="middle">Orta</option>
                    <option value="bottom">Alt</option>
                  </select>
                </div>

                {/* Marka fontu */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Marka Fontu (TTF/OTF)</div>
                  {brandFontUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f5f4f0', borderRadius: '8px', padding: '10px 14px' }}>
                      <span style={{ fontSize: '12px', color: '#0a0a0a', flex: 1 }}>Font yüklendi</span>
                      <button onClick={async () => { await supabase.from('clients').update({ brand_font_url: null }).eq('id', clientId); setBrandFontUrl(''); showMsg('Font kaldırıldı.') }}
                        style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer',  }}>Kaldır</button>
                    </div>
                  ) : (
                    <div>
                      <input ref={brandFontRef} type="file" accept=".ttf,.otf" onChange={async () => {
                        const file = brandFontRef.current?.files?.[0]
                        if (!file) return
                        if (file.size > 5 * 1024 * 1024) { showMsg('Font 5MB\'dan küçük olmalı', true); return }
                        setFontUploading(true)
                        const ext = file.name.split('.').pop()?.toLowerCase() || 'ttf'
                        const storagePath = `brand-fonts/${clientId}_${Date.now()}.${ext}`
                        const { error: upErr } = await supabase.storage.from('brand-assets').upload(storagePath, file, { upsert: true })
                        if (upErr) { showMsg('Yükleme hatası: ' + upErr.message, true); setFontUploading(false); return }
                        const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(storagePath)
                        await supabase.from('clients').update({ brand_font_url: urlData.publicUrl }).eq('id', clientId)
                        setBrandFontUrl(urlData.publicUrl)
                        setFontUploading(false)
                        showMsg('Font yüklendi.')
                      }} style={{ fontSize: '11px' }} disabled={fontUploading} />
                      {fontUploading && <span style={{ fontSize: '11px', color: '#888', marginLeft: '8px' }}>Yükleniyor...</span>}
                    </div>
                  )}
                </div>

                {/* Packshot */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Packshot Video (MP4/MOV)</div>
                  {packshotUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f5f4f0', padding: '10px 14px' }}>
                      <video src={packshotUrl} muted playsInline preload="metadata" style={{ width: '60px', height: '36px', objectFit: 'cover', background: '#0a0a0a' }} />
                      <span style={{ fontSize: '12px', color: '#0a0a0a', flex: 1 }}>Packshot yüklendi</span>
                      <button onClick={async () => { await supabase.from('clients').update({ packshot_url: null }).eq('id', clientId); setPackshotUrl(''); showMsg('Packshot kaldırıldı.') }}
                        style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Kaldır</button>
                    </div>
                  ) : (
                    <div>
                      <input ref={packshotRef} type="file" accept=".mp4,.mov,.webm" onChange={async () => {
                        const file = packshotRef.current?.files?.[0]
                        if (!file) return
                        if (file.size > 50 * 1024 * 1024) { showMsg('Packshot 50MB\'dan küçük olmalı', true); return }
                        setPackshotUploading(true)
                        const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4'
                        const storagePath = `brand-packshots/${clientId}_${Date.now()}.${ext}`
                        const { error: upErr } = await supabase.storage.from('brand-assets').upload(storagePath, file, { upsert: true })
                        if (upErr) { showMsg('Yükleme hatası: ' + upErr.message, true); setPackshotUploading(false); return }
                        const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(storagePath)
                        await supabase.from('clients').update({ packshot_url: urlData.publicUrl }).eq('id', clientId)
                        setPackshotUrl(urlData.publicUrl)
                        setPackshotUploading(false)
                        showMsg('Packshot yüklendi.')
                      }} style={{ fontSize: '11px' }} disabled={packshotUploading} />
                      {packshotUploading && <span style={{ fontSize: '11px', color: '#888', marginLeft: '8px' }}>Yükleniyor...</span>}
                    </div>
                  )}
                </div>

                <button onClick={saveBrand} disabled={savingBrand}
                  className="btn" style={{padding:'7px 16px',cursor:savingBrand?'not-allowed':'pointer'}}>
                  {savingBrand ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>

            </div>

            {/* RIGHT COLUMN — wide content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* PERSONA ATAMA */}
            <PersonaAssignment clientId={clientId} />

            {/* SES ATAMA */}
            <VoiceAssignment clientId={clientId} />

            {/* AI NOTES + RULES SYSTEM */}
            <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '20px' }}>
              {/* AI Notes Bucket */}
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500', marginBottom: '8px' }}>AI Notları Kovası</div>
              <textarea value={aiNotesInput} onChange={e => setAiNotesInput(e.target.value)} rows={4} placeholder="Marka hakkında bilgi, wiki, analiz, sektör notu, serbest metin yapıştırın..."
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border-tertiary)', borderRadius: '8px', fontSize: '12px', color: '#0a0a0a', resize: 'vertical',  boxSizing: 'border-box', marginBottom: '8px' }} />
              <button disabled={seedImporting || aiNotesInput.trim().length < 20} onClick={async () => {
                  setSeedImporting(true)
                  const seedText = aiNotesInput.trim()
                  if (seedText.length > 20) {
                    const resp = await fetch('/api/brand-learning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, clientName: client?.company_name, sourceType: 'admin_notes', sourceId: clientId, text: seedText }) })
                    if (!resp.ok) { setSeedImporting(false); showMsg('Çıkarım üretilemedi. Tekrar deneyin.', true); return }
                    const respData = await resp.json()
                    console.log('[admin] Seed import response:', respData)
                    const { data, error: refetchErr } = await supabase.from('brand_learning_candidates').select('*').eq('client_id', clientId).eq('status', 'pending').order('created_at', { ascending: false })
                    if (refetchErr) console.error('[admin] Refetch error:', refetchErr.message)
                    setLearningCandidates(data || [])
                    setSeedImporting(false)
                    setAiNotesInput('')
                    setRulesTab('pending')
                    showMsg('Kurallar çıkarıldı.')
                  } else { setSeedImporting(false); showMsg('Metin yetersiz (20+ karakter gerekli).', true) }
                }}
                  style={{ padding: '7px 16px', background: seedImporting || aiNotesInput.trim().length < 20 ? '#ccc' : '#111113', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '500', cursor: 'pointer',  }}>
                  {seedImporting ? 'Çıkarılıyor...' : 'Kural Çıkar'}
                </button>
                <button onClick={async () => {
                  setResearchModal(true)
                  setResearchStep('searching')
                  setResearchSources([])
                  try {
                    const res = await fetch('/api/admin/brand-research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandName: client?.company_name || '' }) })
                    const data = await res.json()
                    setResearchSources((data.sources || []).map((s: any) => ({ ...s, checked: false })))
                    setResearchStep('sources')
                  } catch { setResearchStep('sources') }
                }}
                  style={{ padding: '7px 16px', background: '#fff', color: '#111113', border: '1px solid #111113', borderRadius: '6px', fontSize: '11px', fontWeight: '500', cursor: 'pointer', marginLeft: '8px' }}>
                  Araştır
                </button>

              {/* 3-TAB RULES */}
              <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--color-border-tertiary)', marginTop: '20px', marginBottom: '14px' }}>
                {([['pending', `Onay Bekleyen (${learningCandidates.length})`], ['active', `Aktif (${brandRules.length})`], ['add', 'Manuel Ekle']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setRulesTab(key as any)}
                    style={{ padding: '8px 14px', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase' as const, fontWeight: '500', color: rulesTab === key ? '#0a0a0a' : 'var(--color-text-tertiary)', background: 'none', border: 'none', borderBottom: rulesTab === key ? '2px solid #0a0a0a' : '2px solid transparent', cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>

              {rulesTab === 'pending' && (
                learningCandidates.length === 0 ? <div style={{ fontSize: '12px', color: '#aaa', textAlign: 'center', padding: '16px 0' }}>Onay bekleyen kural yok</div> :
                learningCandidates.map((c: any) => {
                  const typeColors: Record<string,{bg:string,fg:string,label:string,border:string}> = { rule:{bg:'#E1F5EE',fg:'#085041',label:'Kural',border:'#1D9E75'}, restriction:{bg:'#FCEBEB',fg:'#791F1F',label:'Yasak',border:'#D85A30'}, insight:{bg:'#EEEDFE',fg:'#3C3489',label:'İçgörü',border:'#7F77DD'} }
                  const tc = typeColors[c.type] || typeColors.rule
                  return (
                    <div key={c.id} style={{ padding: '10px 0 10px 14px', borderTop: '1px solid var(--color-border-tertiary)', borderLeft: `3px solid ${tc.border}`, display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '4px' }}>{c.rule_text}</div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '10px', padding: '3px 8px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', background: tc.bg, color: tc.fg }}>{tc.label}</span>
                          <span style={{ fontSize: '9px', color: '#aaa' }}>{['brief','revision','feedback'].includes(c.source_type) ? 'Müşteriden' : 'Notlardan'}</span>
                        </div>
                        {c.rule_condition && <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', marginTop: '2px' }}>{c.rule_condition}</div>}
                      </div>
                      <button onClick={async () => {
                        const { error: upErr } = await supabase.from('brand_learning_candidates').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', c.id)
                        if (upErr) { console.error('[approve] candidate update error:', upErr.message); showMsg('Hata: ' + upErr.message, true); return }
                        const { error: insErr } = await supabase.from('brand_rules').insert({ client_id: clientId, rule_text: c.rule_text, rule_condition: c.rule_condition || null, type: c.type || 'rule', rule_type: c.rule_type || 'positive', source_candidate_id: c.id, source_type: c.source_type || 'learned', manually_added: false })
                        if (insErr) { console.error('[approve] brand_rules insert error:', insErr.message); showMsg('Hata: ' + insErr.message, true); return }
                        setLearningCandidates(prev => prev.filter(x => x.id !== c.id))
                        const { data: r } = await supabase.from('brand_rules').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
                        setBrandRules(r || [])
                        showMsg('Kural onaylandı.')
                      }} style={{ fontSize: '11px', color: '#22c55e', background: 'none', border: '0.5px solid rgba(34,197,94,0.3)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',  }}>✓</button>
                      <button onClick={async () => {
                        await supabase.from('brand_learning_candidates').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', c.id)
                        setLearningCandidates(prev => prev.filter(x => x.id !== c.id))
                        showMsg('Reddedildi.')
                      }} style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',  }}>✗</button>
                    </div>
                  )
                })
              )}

              {rulesTab === 'active' && (
                brandRules.length === 0 ? <div style={{ fontSize: '12px', color: '#aaa', textAlign: 'center', padding: '16px 0' }}>Henüz aktif kural yok</div> :
                brandRules.map((r: any) => {
                  const typeColors: Record<string,{bg:string,fg:string,label:string,border:string}> = { rule:{bg:'#E1F5EE',fg:'#085041',label:'Kural',border:'#1D9E75'}, restriction:{bg:'#FCEBEB',fg:'#791F1F',label:'Yasak',border:'#D85A30'}, insight:{bg:'#EEEDFE',fg:'#3C3489',label:'İçgörü',border:'#7F77DD'} }
                  const tc = typeColors[r.type] || typeColors.rule
                  const srcLabel = r.manually_added ? 'Manuel' : r.source_type === 'migrated' ? 'Migrate' : ['brief','revision','feedback'].includes(r.source_type) ? 'Müşteriden' : 'Notlardan'
                  return (
                    <div key={r.id} style={{ padding: '8px 0 8px 14px', borderTop: '1px solid var(--color-border-tertiary)', borderLeft: `3px solid ${tc.border}`, display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '3px' }}>{r.rule_text}</div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '10px', padding: '3px 8px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', background: tc.bg, color: tc.fg }}>{tc.label}</span>
                          {r.rule_condition && <span style={{ fontSize: '9px', color: '#888', fontStyle: 'italic' }}>{r.rule_condition}</span>}
                          <span style={{ fontSize: '9px', color: '#aaa' }}>{srcLabel}</span>
                        </div>
                      </div>
                      <button onClick={async () => {
                        await supabase.from('brand_rules').delete().eq('id', r.id)
                        setBrandRules(prev => prev.filter(x => x.id !== r.id))
                        showMsg('Kural silindi.')
                      }} style={{ fontSize: '10px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer',  }}>Sil</button>
                    </div>
                  )
                })
              )}

              {rulesTab === 'add' && (
                <div style={{ padding: '8px 0' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Tip</div>
                    <select value={newRule.type} onChange={e => setNewRule({ ...newRule, type: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--color-border-tertiary)', borderRadius: '6px', fontSize: '12px',  }}>
                      <option value="rule">Kural (pozitif talimat)</option>
                      <option value="restriction">Yasak</option>
                      <option value="insight">İçgörü (yaratıcı yönlendirme)</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Metin *</div>
                    <input value={newRule.text} onChange={e => setNewRule({ ...newRule, text: e.target.value })} placeholder="Erkek model kullanılmasın"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--color-border-tertiary)', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>Koşul (opsiyonel)</div>
                    <input value={newRule.condition} onChange={e => setNewRule({ ...newRule, condition: e.target.value })} placeholder="Eğer ürün bikini/mayo ise"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--color-border-tertiary)', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' }} />
                  </div>
                  <button disabled={!newRule.text} onClick={async () => {
                    await supabase.from('brand_rules').insert({ client_id: clientId, rule_text: newRule.text, rule_condition: newRule.condition || null, type: newRule.type, rule_type: newRule.type === 'restriction' ? 'negative' : 'positive', manually_added: true, source_type: 'manual' })
                    const { data: r } = await supabase.from('brand_rules').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
                    setBrandRules(r || [])
                    setNewRule({ text: '', condition: '', type: 'rule' })
                    setRulesTab('active')
                    showMsg('Kural eklendi.')
                  }} style={{ padding: '7px 16px', background: !newRule.text ? '#ccc' : '#111113', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '500', cursor: 'pointer',  }}>
                    Kaydet
                  </button>
                </div>
              )}
            </div>

            </div>
          </div>

          {/* BOTTOM — left column continued */}
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', marginTop: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* CLIENT USERS */}
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>Kullanıcılar ({clientUsers.length})</span>
                  <span style={{ fontSize: '11px', color: '#888' }}>Havuz: {client?.credit_balance || 0} kr</span>
                </div>
                {clientUsers.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#aaa', fontSize: '12px' }}>Atanmış kullanıcı yok.</div>
                ) : clientUsers.map((cu: any) => (
                  <div key={cu.id} style={{ padding: '10px 16px', borderTop: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>{cu.users?.name || '—'}</div>
                      <div style={{ fontSize: '10px', color: '#888', marginTop: '1px' }}>{cu.users?.email || '—'}</div>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{cu.allocated_credits || 0}</div>
                    <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                      <button onClick={() => openAllocModal(cu, 'give')} style={{ padding: '3px 8px', fontSize: '9px', fontWeight: '500', border: '1px solid #22c55e', background: 'rgba(34,197,94,0.1)', color: '#22c55e', cursor: 'pointer' }}>+</button>
                      <button onClick={() => openAllocModal(cu, 'take')} disabled={!cu.allocated_credits} style={{ padding: '3px 8px', fontSize: '9px', fontWeight: '500', border: '1px solid rgba(0,0,0,0.15)', background: '#fff', color: cu.allocated_credits ? '#888' : '#ddd', cursor: cu.allocated_credits ? 'pointer' : 'not-allowed' }}>−</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* BRIEFS LINK */}
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>Briefler ({briefs.length})</span>
                <a href={`/dashboard/admin/briefs?client_id=${clientId}`} style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', textDecoration: 'none' }}>GÖR →</a>
              </div>

            </div>

            {/* RIGHT: Credit history */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* CREDIT SALES */}
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-tertiary)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
                  Kredi Satışları ({sales.length})
                </div>
                {sales.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#aaa', fontSize: '12px' }}>Kredi satışı yok.</div>
                ) : sales.map((sale: any) => (
                  <div key={sale.id} style={{ padding: '10px 16px', borderTop: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: '#0a0a0a', fontWeight: '500' }}>{sale.credits} kredi</div>
                      <div style={{ fontSize: '10px', color: '#888', marginTop: '1px' }}>
                        {sale.created_at && new Date(sale.created_at).toLocaleDateString('tr-TR')}
                        {sale.payment_method && <span style={{ marginLeft: '6px' }}>{sale.payment_method === 'havale' ? 'Havale' : sale.payment_method === 'kredi_karti' ? 'Kart' : sale.payment_method}</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>{Number(sale.total_amount || 0).toLocaleString('tr-TR')} TL</div>
                  </div>
                ))}
              </div>

              {/* CREDIT TRANSACTIONS */}
              <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-tertiary)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
                  Kredi Geçmişi ({transactions.length})
                </div>
                {transactions.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#aaa', fontSize: '12px' }}>Kredi işlemi yok.</div>
                ) : transactions.slice(0, 20).map(tx => {
                  const isPositive = Number(tx.amount) > 0
                  return (
                    <div key={tx.id} style={{ padding: '8px 16px', borderTop: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '11px', color: '#0a0a0a' }}>{tx.description || tx.type}</div>
                        <div style={{ fontSize: '10px', color: '#aaa', marginTop: '1px' }}>
                          {tx.created_at && new Date(tx.created_at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <span style={{ fontSize: '9px', padding: '2px 6px', fontWeight: '500', background: tx.type === 'top_up' ? 'rgba(34,197,94,0.1)' : 'rgba(156,163,175,0.1)', color: tx.type === 'top_up' ? '#22c55e' : '#6b7280' }}>
                        {tx.type === 'demo' ? 'Demo' : tx.type === 'top_up' ? 'Yükleme' : tx.type === 'deduct' ? 'Harcama' : tx.type === 'refund' ? 'İade' : tx.type}
                      </span>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: isPositive ? '#22c55e' : '#ef4444', minWidth: '40px', textAlign: 'right' }}>
                        {isPositive ? '+' : ''}{tx.amount}
                      </div>
                    </div>
                  )
                })}
                {transactions.length > 20 && <div style={{ padding: '8px 16px', fontSize: '10px', color: '#888', textAlign: 'center' }}>... ve {transactions.length - 20} işlem daha</div>}
              </div>

            </div>
          </div>
        </div>

      {/* CREDIT ALLOCATION MODAL */}
      {creditAllocModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setCreditAllocModal(null)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '6px' }}>
              {creditAllocModal.direction === 'give' ? 'Kredi Ver' : 'Kredi Geri Al'}
            </div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '20px' }}>
              {creditAllocModal.user.users?.name || '\u2014'}
              {creditAllocModal.direction === 'give'
                ? ` \u00b7 Havuz: ${client?.credit_balance || 0} kr`
                : ` \u00b7 Mevcut: ${creditAllocModal.user.allocated_credits || 0} kr`
              }
            </div>
            <form onSubmit={allocateCredit}>
              <label style={labelStyle}>
                {creditAllocModal.direction === 'give' ? 'Verilecek Kredi' : 'Geri Alinacak Kredi'}
              </label>
              <input required type="number" min="1"
                max={creditAllocModal.direction === 'give' ? (client?.credit_balance || 0) : (creditAllocModal.user.allocated_credits || 0)}
                value={allocAmount} onChange={e => setAllocAmount(e.target.value)}
                style={{ ...inputStyle, marginBottom: '16px', fontSize: '18px', fontWeight: '300', letterSpacing: '-0.5px' }}
                placeholder="0" autoFocus />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setCreditAllocModal(null)}
                  style={{ flex: 1, padding: '10px', background: '#fff', color: '#888', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',  }}>
                  Iptal
                </button>
                <button type="submit" disabled={allocSaving}
                  style={{ flex: 2, padding: '10px', background: creditAllocModal.direction === 'give' ? '#22c55e' : '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: allocSaving ? 'not-allowed' : 'pointer',  }}>
                  {allocSaving ? 'Isleniyor...' : creditAllocModal.direction === 'give' ? 'Kredi Ver' : 'Geri Al'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SALE MODAL */}
      {saleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setSaleModal(false)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '6px' }}>Kredi Satisi Ekle</div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '20px' }}>{client?.company_name}</div>
            <form onSubmit={saveSale}>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Paket Sec (veya manuel gir)</label>
                <select value={saleForm.package_id} onChange={e => onPackageSelect(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Manuel giris</option>
                  {packages.map((p: any) => <option key={p.id} value={p.id}>{p.name} — {p.credits} kredi — {Number(p.price_tl).toLocaleString('tr-TR')} TL</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={labelStyle}>Kredi Miktari *</label>
                  <input required type="number" min="1" value={saleForm.credits} onChange={e => setSaleForm({ ...saleForm, credits: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Odenen Tutar (TL) *</label>
                  <input required type="number" min="0" step="0.01" value={saleForm.amount} onChange={e => setSaleForm({ ...saleForm, amount: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Odeme Yontemi</label>
                <select value={saleForm.payment_method} onChange={e => setSaleForm({ ...saleForm, payment_method: e.target.value })}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="havale">Havale/EFT</option>
                  <option value="kredi_karti">Kredi Karti</option>
                  <option value="nakit">Nakit</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                <div>
                  <label style={labelStyle}>Fatura No</label>
                  <input value={saleForm.invoice_number} onChange={e => setSaleForm({ ...saleForm, invoice_number: e.target.value })} style={inputStyle} placeholder="Opsiyonel" />
                </div>
                <div>
                  <label style={labelStyle}>Not</label>
                  <input value={saleForm.note} onChange={e => setSaleForm({ ...saleForm, note: e.target.value })} style={inputStyle} placeholder="Opsiyonel" />
                </div>
              </div>
              {client?.agency_id && agency && (
                <div style={{ padding: '8px 12px', background: 'rgba(34,197,94,0.06)', borderRadius: '8px', fontSize: '11px', color: '#166534', marginBottom: '14px' }}>
                  Ajans komisyonu: %{(Number(agency.commission_rate || 0) * 100).toFixed(0)} — {saleForm.amount ? (Number(saleForm.amount) * Number(agency.commission_rate || 0)).toLocaleString('tr-TR') + ' TL' : '—'}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setSaleModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#fff', color: '#888', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',  }}>
                  Iptal
                </button>
                <button type="submit" disabled={savingSale}
                  style={{ flex: 2, padding: '10px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: savingSale ? 'not-allowed' : 'pointer',  }}>
                  {savingSale ? 'Kaydediliyor...' : 'Satisi Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setEditModal(false)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '18px' }}>Musteriyi Duzenle</div>
            <form onSubmit={saveEdit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Sirket Adi *</label>
                <input required value={editForm.company_name} onChange={e => setEditForm({ ...editForm, company_name: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Ticari Ünvan</label>
                <input value={editForm.legal_name} onChange={e => setEditForm({ ...editForm, legal_name: e.target.value })} style={inputStyle} placeholder="Örn: DCC Film Yapım San. ve Tic. Ltd. Şti." />
                <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>Telif belgelerinde kullanılır.</div>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Iletisim E-posta</label>
                <input type="email" value={editForm.contact_email} onChange={e => setEditForm({ ...editForm, contact_email: e.target.value })} style={inputStyle} placeholder="ornek@sirket.com" />
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Durum</label>
                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  {Object.entries(STATUS_MAP).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditModal(false)}
                  style={{ padding: '8px 16px', background: '#f5f4f0', border: '1px solid var(--color-border-tertiary)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',  color: 'rgba(255,255,255,0.4)' }}>
                  Iptal
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: '8px 16px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer',  }}>
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setDeleteModal(false)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '12px' }}>Musteriyi Sil</div>
            <div style={{ fontSize: '13px', color: '#444', marginBottom: briefs.length > 0 ? '10px' : '20px', lineHeight: '1.5' }}>
              <strong>{client?.company_name}</strong> musterisini silmek istediginizden emin misiniz?
            </div>
            {briefs.length > 0 && (
              <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '0.5px solid rgba(245,158,11,0.25)', borderRadius: '8px', marginBottom: '20px', fontSize: '12px', color: '#b45309', lineHeight: '1.5' }}>
                Bu musteriye ait {briefs.length} brief var. Yine de silmek istiyor musunuz?
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteModal(false)}
                style={{ padding: '8px 16px', background: '#f5f4f0', border: '1px solid var(--color-border-tertiary)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',  color: 'rgba(255,255,255,0.4)' }}>
                Iptal
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: deleting ? 'not-allowed' : 'pointer',  }}>
                {deleting ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREDIT LOAD MODAL */}
      {creditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setCreditModal(false)}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '6px' }}>Kredi Yukle</div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '20px' }}>
              {client?.company_name} \u00b7 Mevcut: {client?.credit_balance || 0} kredi
            </div>
            <form onSubmit={loadCredit}>
              <label style={labelStyle}>Yuklenecek Kredi</label>
              <input required type="number" min="1" value={creditAmount} onChange={e => setCreditAmount(e.target.value)}
                style={{ ...inputStyle, marginBottom: '16px', fontSize: '18px', fontWeight: '300', letterSpacing: '-0.5px' }}
                placeholder="0" autoFocus />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setCreditModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#fff', color: '#888', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',  }}>
                  Iptal
                </button>
                <button type="submit" disabled={loadingCredit}
                  style={{ flex: 2, padding: '10px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: loadingCredit ? 'not-allowed' : 'pointer',  }}>
                  {loadingCredit ? 'Yukleniyor...' : 'Kredi Yukle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* RESEARCH MODAL */}
      {researchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { if (researchStep !== 'searching' && researchStep !== 'processing') setResearchModal(false) }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '28px', maxWidth: '520px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>

            {researchStep === 'searching' && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div className="spinner" style={{ width: '28px', height: '28px', border: '2px solid #ddd', borderTopColor: '#0a0a0a', margin: '0 auto 16px' }} />
                <div style={{ fontSize: '13px', color: '#0a0a0a', fontWeight: '500' }}>Kaynaklar aranıyor...</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{client?.company_name}</div>
              </div>
            )}

            {researchStep === 'sources' && (
              <>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '4px' }}>Bulunan Kaynaklar</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#888' }}>Kullanmak istediklerini seç</div>
                  {researchSources.length > 0 && (
                    <button onClick={() => { const allChecked = researchSources.every(s => s.checked); setResearchSources(prev => prev.map(s => ({ ...s, checked: !allChecked }))) }}
                      style={{ fontSize: '10px', color: '#0a0a0a', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      {researchSources.every(s => s.checked) ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                    </button>
                  )}
                </div>
                {researchSources.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#888', textAlign: 'center', padding: '20px 0' }}>Kaynak bulunamadı</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                    {researchSources.map((s, i) => (
                      <label key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', border: '1px solid var(--color-border-tertiary)', cursor: 'pointer', background: s.checked ? '#fafaf7' : '#fff' }}>
                        <input type="checkbox" checked={s.checked} onChange={() => setResearchSources(prev => prev.map((p, j) => j === i ? { ...p, checked: !p.checked } : p))}
                          style={{ marginTop: '2px', accentColor: '#0a0a0a' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '2px' }}>
                            <span style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: '600', padding: '2px 6px', background: '#f0f0ed', color: '#555' }}>{s.type}</span>
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a', marginBottom: '2px' }}>{s.title || s.url}</div>
                          <div style={{ fontSize: '10px', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.url}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setResearchModal(false)} style={{ padding: '8px 16px', background: '#fff', color: '#0a0a0a', border: '1px solid #0a0a0a', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>VAZGEÇ</button>
                  <button disabled={!researchSources.some(s => s.checked)} onClick={async () => {
                    setResearchStep('processing')
                    const selectedUrls = researchSources.filter(s => s.checked).map(s => s.url)
                    try {
                      const res = await fetch('/api/admin/brand-research', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, urls: selectedUrls }) })
                      const data = await res.json()
                      // Refetch candidates
                      const { data: cands } = await supabase.from('brand_learning_candidates').select('*').eq('client_id', clientId).eq('status', 'pending').order('created_at', { ascending: false })
                      setLearningCandidates(cands || [])
                      setResearchResult(data.inserted || 0)
                      setResearchStep('done')
                    } catch { setResearchStep('done') }
                  }}
                    style={{ padding: '8px 16px', background: researchSources.some(s => s.checked) ? '#0a0a0a' : '#ccc', color: '#fff', border: '1px solid #0a0a0a', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
                    DEVAM
                  </button>
                </div>
              </>
            )}

            {researchStep === 'processing' && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div className="spinner" style={{ width: '28px', height: '28px', border: '2px solid #ddd', borderTopColor: '#0a0a0a', margin: '0 auto 16px' }} />
                <div style={{ fontSize: '13px', color: '#0a0a0a', fontWeight: '500' }}>İçerikler işleniyor...</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{researchSources.filter(s => s.checked).length} kaynak parse ediliyor</div>
              </div>
            )}

            {researchStep === 'done' && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ width: '40px', height: '40px', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '18px' }}>✓</div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '6px' }}>{researchResult} kural çıkarıldı</div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '20px' }}>Onay Bekleyen sekmesinden inceleyebilirsin</div>
                <button onClick={() => { setResearchModal(false); setRulesTab('pending') }}
                  style={{ padding: '8px 20px', background: '#0a0a0a', color: '#fff', border: '1px solid #0a0a0a', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
                  TAMAM
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
