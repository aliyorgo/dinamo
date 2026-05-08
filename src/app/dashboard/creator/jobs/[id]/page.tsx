'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import ProductionStudio from '@/components/ProductionStudio'
import { cleanVoiceName } from '@/lib/voice-utils'
import { downloadFile } from '@/lib/download-helper'
import { useRouter, useParams } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function CreatorJobDetail() {
  const router = useRouter()
  const params = useParams()
  const briefId = params.id as string
  const [brief, setBrief] = useState<any>(null)
  const [producerBrief, setProducerBrief] = useState<any>(null)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [revisions, setRevisions] = useState<any[]>([])
  const [questions, setQuestions] = useState<any[]>([])
  const [userName, setUserName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const [brandFiles, setBrandFiles] = useState<any[]>([])
  const [projectFiles, setProjectFiles] = useState<any[]>([])
  const [adminApproved, setAdminApproved] = useState<any>(null)
  const [studioLocked, setStudioLocked] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  const [creatorSummary, setCreatorSummary] = useState<{summary:string}|null>(null)
  const [brandSummary, setBrandSummary] = useState<string|null>(null)
  const [brandSummaryOpen, setBrandSummaryOpen] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [playerUrl, setPlayerUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [creatorNote, setCreatorNote] = useState('')
  const [sendConfirm, setSendConfirm] = useState<string | null>(null)
  const [voiceStudioOpen, setVoiceStudioOpen] = useState(false)
  const [voiceText, setVoiceText] = useState('')
  const [voices, setVoices] = useState<any[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null)
  const [voiceGenerating, setVoiceGenerating] = useState(false)
  const [voiceConfirm, setVoiceConfirm] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [playingPreview, setPlayingPreview] = useState<string | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => { loadData() }, [briefId])
  useEffect(() => {
    if (!briefId) return
    setSummaryLoading(true)
    Promise.all([
      fetch(`/api/briefs/${briefId}/creator-summary`).then(r => r.json()).then(d => { if (d.summary) setCreatorSummary(d); else if (d.customer_want) setCreatorSummary({ summary: d.customer_want }) }),
      fetch(`/api/briefs/${briefId}/brand-summary`).then(r => r.json()).then(d => { if (d.brand_summary) setBrandSummary(d.brand_summary) }),
    ]).finally(() => setSummaryLoading(false))
  }, [briefId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ud } = await supabase.from('users').select('name').eq('id', user.id).single()
    setUserName(ud?.name || '')
    const { data: b } = await supabase.from('briefs').select('*, clients(company_name, logo_url, font_url, brand_voices, packshots)').eq('id', briefId).single()
    setBrief(b)
    const { data: pb } = await supabase.from('producer_briefs').select('*').eq('brief_id', briefId).maybeSingle()
    setProducerBrief(pb)
    const { data: s } = await supabase.from('video_submissions').select('*').eq('brief_id', briefId).order('submitted_at', { ascending: false })
    setSubmissions(s || [])
    const { data: q } = await supabase.from('brief_questions').select('*').eq('brief_id', briefId).order('asked_at')
    setQuestions(q || [])
    setRevisions((q || []).filter((x: any) => x.question.startsWith('İÇ REVİZYON:') || x.question.startsWith('REVİZYON:')))
    if (b?.client_id) {
      async function signFiles(files: any[]) {
        return Promise.all(files.map(async f => {
          if (f.file_url) { const path = f.file_url.split('/brand-assets/')[1]; if (path) { const { data: signed } = await supabase.storage.from('brand-assets').createSignedUrl(decodeURIComponent(path), 3600); return { ...f, file_url: signed?.signedUrl || f.file_url } } }
          return f
        }))
      }
      const { data: brand } = await supabase.from('brief_files').select('*').eq('client_id', b.client_id).is('brief_id', null)
      const { data: project } = await supabase.from('brief_files').select('*').eq('brief_id', briefId)
      setBrandFiles(await signFiles(brand || []))
      setProjectFiles(await signFiles(project || []))
    }
    const { data: adminInsp } = await supabase.from('brief_inspirations').select('*').eq('brief_id', briefId).eq('source', 'admin').eq('status', 'approved').maybeSingle()
    setAdminApproved(adminInsp)
    setStudioLocked(pb?.studio_locked || false)
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    if (file.size > 200 * 1024 * 1024) { setMsg('Dosya çok büyük (max 200MB)'); return }
    // Check for existing draft
    const existingDraft = submissions.find(s => s.status === 'draft')
    if (existingDraft) { setMsg('Önce mevcut taslağı sil veya gönder.'); return }
    setUploading(true); setUploadProgress(0); setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: cd } = await supabase.from('creators').select('id').eq('user_id', user?.id).maybeSingle()
    if (!cd) { setMsg('Creator kaydı bulunamadı.'); setUploading(false); return }
    const ext = file.name.split('.').pop() || 'mp4'
    const client = (brief?.clients?.company_name || 'client').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const campaign = (brief?.campaign_name || 'video').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const fmt = (brief?.format || '').replace(':', 'x')
    const date = new Date().toISOString().slice(0, 10)
    const storagePath = `${briefId}/dinamo_${client}_${campaign}_${fmt}_${date}.${ext}`
    // Upload to Supabase Storage
    setUploadProgress(30)
    const { error: upErr } = await supabase.storage.from('videos').upload(storagePath, file, { upsert: true })
    setUploadProgress(90)
    if (upErr) { setMsg(upErr.message || 'Yükleme hatası'); setUploading(false); return }
    setUploadProgress(100)
    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(storagePath)
    const version = submissions.filter(s => s.status !== 'draft').length + 1
    await supabase.from('video_submissions').insert({ brief_id: briefId, creator_id: cd.id, video_url: urlData.publicUrl, version, status: 'draft', format: brief?.format || null })
    setMsg('Video taslak olarak yüklendi. Gönder butonuyla admin\'e ilet.')
    if (fileRef.current) fileRef.current.value = ''
    setCreatorNote('')
    loadData(); setUploading(false); setUploadProgress(0)
  }

  async function sendDraft(subId: string) {
    await supabase.from('video_submissions').update({ status: 'pending', producer_notes: creatorNote.trim() || null }).eq('id', subId)
    // Update brief status back to in_production if it was in revision
    if (brief?.status === 'revision') await supabase.from('briefs').update({ status: 'in_production' }).eq('id', briefId)
    setSendConfirm(null); setCreatorNote(''); setMsg('Gönderildi. Admin inceleyecek.')
    loadData()
  }

  async function deleteSubmission(subId: string) {
    const sub = submissions.find(s => s.id === subId)
    if (!sub) return
    const path = sub.video_url?.split('/videos/')[1]
    if (path) await supabase.storage.from('videos').remove([decodeURIComponent(path)])
    await supabase.from('video_submissions').delete().eq('id', subId)
    setDeleteConfirm(null); setMsg('Versiyon silindi.')
    loadData()
  }

  async function handleQuestion(e: React.FormEvent) {
    e.preventDefault()
    if (!newQuestion.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('brief_questions').insert({ brief_id: briefId, question: newQuestion, asked_by: user?.id })
    setNewQuestion(''); loadData()
  }

  // Brand voice lock check
  const brandVoices = brief?.clients?.brand_voices
  const briefGender = brief?.voiceover_gender || 'female'
  const lockedVoice = brandVoices?.[briefGender] || null

  async function loadCreatorVoices(refresh = false) {
    setVoicesLoading(true)
    const gender = brief?.voiceover_gender === 'male' ? 'male' : brief?.voiceover_gender === 'female' ? 'female' : ''
    const q = refresh ? '&refresh=1' : ''
    const res = await fetch(`/api/elevenlabs/voices?gender=${gender}${q}`)
    const data = await res.json()
    setVoices(data.voices || [])
    setVoicesLoading(false)
  }

  async function openVoiceStudio() {
    setVoiceStudioOpen(true)
    if (brief?.voiceover_text && !voiceText) setVoiceText(brief.voiceover_text)
    if (lockedVoice && !selectedVoice) setSelectedVoice(lockedVoice.voice_id)
    if (!lockedVoice && voices.length === 0) loadCreatorVoices()
  }

  async function generateVoiceover() {
    if (!voiceText.trim() || !selectedVoice) return
    setVoiceGenerating(true)
    setVoiceError(null)
    try {
      const res = await fetch(`/api/briefs/${briefId}/generate-voiceover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: voiceText, voice_id: selectedVoice }),
      })
      const data = await res.json()
      if (data.url) {
        setBrief((prev: any) => ({ ...prev, ai_voiceover_url: data.url, ai_voiceover_voice_id: selectedVoice, ai_voiceover_generated_at: data.generated_at }))
        setVoiceGenerating(false)
        setVoiceConfirm(false)
        setMsg('Seslendirme üretildi.')
      } else {
        setVoiceGenerating(false)
        const errMsg = data.error?.includes('500 karakter') ? 'Metin çok uzun, kısalt.' : (data.error || 'Ses üretilemedi.')
        setVoiceError(errMsg)
      }
    } catch {
      setVoiceGenerating(false)
      setVoiceError('Bağlantı hatası, tekrar dene.')
    }
  }

  function playPreview(url: string, voiceId: string) {
    if (playingPreview === voiceId) {
      previewAudioRef.current?.pause()
      setPlayingPreview(null)
      return
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.src = url
      previewAudioRef.current.play()
      setPlayingPreview(voiceId)
      previewAudioRef.current.onended = () => setPlayingPreview(null)
    }
  }

  function parseTimecode(text: string): { tc: number | null, clean: string } {
    const match = text.match(/^\[(\d{2}):(\d{2})\.(\d)\]\s*/)
    if (!match) return { tc: null, clean: text }
    return { tc: parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 10, clean: text.replace(match[0], '') }
  }
  function seekTo(seconds: number) { if (videoRef.current) { videoRef.current.currentTime = seconds; videoRef.current.play() } }

  const internalRevisions = revisions.filter(r => r.question.startsWith('İÇ REVİZYON:'))
  const clientRevisions = revisions.filter(r => r.question.startsWith('REVİZYON:'))
  const visibleQuestions = (questions || []).filter(q => !q.question.startsWith('REVİZYON:') && !q.question.startsWith('İÇ REVİZYON:'))
  const sf: string[] = producerBrief?.shared_fields || ['message', 'cta', 'target_audience', 'voiceover_text', 'notes']
  const durMap: Record<string, string> = { 'Bumper / Pre-roll': '6sn', 'Story / Reels': '15sn', 'Feed Video': '30sn', 'Long Form': '60sn' }
  const hasDraft = submissions.some(s => s.status === 'draft')
  const canUpload = !hasDraft && (submissions.length === 0 || submissions.some(s => s.status === 'revision_requested') || !submissions.some(s => s.status === 'pending' || s.status === 'draft'))
  const lastSub = submissions[0]

  const statusBadge = (status: string) => {
    const m: Record<string, { label: string, border: string }> = {
      submitted: { label: 'ATANDI', border: '#9ca3af' }, read: { label: 'ATANDI', border: '#9ca3af' },
      in_production: { label: 'ÜRETİMDE', border: '#3b82f6' }, revision: { label: 'REVİZYON', border: '#ef4444' },
      approved: { label: 'ONAY BEKLİYOR', border: '#f59e0b' }, delivered: { label: 'TESLİM', border: '#22c55e' },
    }
    const s = m[status] || { label: status, border: '#888' }
    return <span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '3px 8px', border: `1px solid ${s.border}`, color: '#0a0a0a', fontWeight: '500' }}>{s.label}</span>
  }

  if (!brief) return <div style={{ padding: '24px 28px', color: 'var(--color-text-tertiary)' }}>Yükleniyor...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* STICKY HEADER */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid var(--color-border-tertiary)', padding: '14px 28px' }}>
        <span onClick={() => router.push('/dashboard/creator')} style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', cursor: 'pointer', marginBottom: '6px', display: 'inline-block' }}>← İŞLERİME DÖN</span>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>{brief.clients?.company_name} · {brief.brief_type === 'cps_child' ? `CPS YÖN ${brief.mvc_order || ''}` : 'ANA VİDEO'}</div>
            <div style={{ fontSize: '20px', fontWeight: '500', color: '#0a0a0a', letterSpacing: '-0.5px' }}>{brief.campaign_name}</div>
            <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>{brief.format} · {durMap[brief.video_type] || '10sn'} · {brief.credit_cost || 0} kredi</div>
          </div>
          {statusBadge(brief.status)}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: '24px 28px', maxWidth: '960px' }}>
        {msg && <div style={{ padding: '10px 16px', background: msg.includes('Hata') || msg.includes('bulunamadı') ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${msg.includes('Hata') || msg.includes('bulunamadı') ? '#ef4444' : '#22c55e'}`, fontSize: '12px', color: '#0a0a0a', marginBottom: '16px' }}>{msg}</div>}

        {/* CREATIVE STUDIO + DIŞ SES */}
        <div style={{ display: 'grid', gridTemplateColumns: brief?.voiceover_type === 'ai' ? '1fr 1fr' : '1fr', gap: '12px', marginBottom: '16px' }}>
          <ProductionStudio briefId={briefId} source="creator" userRole="creator" />
          {brief?.voiceover_type === 'ai' && (
            <button onClick={openVoiceStudio} className="btn btn-outline" style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500' }}>SES STÜDYOSU</span>
              <span className="dot" style={{ width: '7px', height: '7px', background: brief.ai_voiceover_url ? '#0a0a0a' : 'transparent', border: brief.ai_voiceover_url ? '1px solid #0a0a0a' : '1px solid #c5c5b8', display: 'inline-block' }} title={brief.ai_voiceover_url ? 'Ses mevcut' : 'Ses üretilmedi'} />
            </button>
          )}
        </div>

        {/* ÖZET BÖLÜMÜ */}
        <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {/* BRIEF ÖZETİ */}
          <div style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '18px 22px' }}>
            <div className="label-caps" style={{ marginBottom: '12px' }}>BRIEF ÖZETİ</div>
            {summaryLoading && !creatorSummary ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0' }}><div className="spinner" style={{ width: '12px', height: '12px', border: '2px solid #ddd', borderTopColor: '#0a0a0a' }} /><span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Üretiliyor...</span></div>
            ) : creatorSummary ? (
              <div style={{ fontSize: '14px', color: '#0a0a0a', lineHeight: 1.6 }}>{creatorSummary.summary}</div>
            ) : <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Özet üretilemedi.</div>}
          </div>

          {/* MARKA HAKKINDA */}
          <div style={{ background: '#fff', border: '1px solid #e5e4db', padding: '18px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setBrandSummaryOpen(!brandSummaryOpen)}>
              <div className="label-caps">MARKA HAKKINDA</div>
              <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>{brandSummaryOpen ? 'KAPAT' : 'DETAY'}</span>
            </div>
            {brandSummaryOpen && (
              summaryLoading && !brandSummary ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0' }}><div className="spinner" style={{ width: '12px', height: '12px', border: '2px solid #ddd', borderTopColor: '#0a0a0a' }} /><span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Üretiliyor...</span></div>
              ) : brandSummary ? (
                <div style={{ marginTop: '12px', fontSize: '13px', color: '#0a0a0a', lineHeight: 1.6 }}>{brandSummary}</div>
              ) : <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Marka özeti üretilemedi.</div>
            )}
          </div>
        </div>

        {/* FORMAT/TEKNİK KART */}
        {brief && (
          <div style={{ background: '#fff', border: '1px solid #e5e4db', padding: '14px 18px', marginBottom: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="label-caps" style={{ marginRight: '8px' }}>ÜRETİM BİLGİSİ</div>
            {[
              { k: 'FORMAT', v: brief.format },
              { k: 'SÜRE', v: durMap[brief.video_type] || brief.video_type },
              { k: 'MECRA', v: Array.isArray(brief.platforms) ? brief.platforms.join(', ') : null },
              { k: 'CTA', v: sf.includes('cta') ? brief.cta : null },
            ].filter(m => m.v).map((m, i) => (
              <span key={m.k} style={{ fontSize: '11px', color: '#0a0a0a' }}>
                {i > 0 && <span style={{ color: 'var(--color-text-tertiary)', margin: '0 6px' }}>·</span>}
                <span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>{m.k}: </span>
                <span style={{ fontWeight: '500' }}>{m.v}</span>
              </span>
            ))}
          </div>
        )}

        {/* BRIEF DETAYLARI (default KAPALI) */}
        <div style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '22px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: briefOpen ? '16px' : 0 }} onClick={() => setBriefOpen(!briefOpen)}>
            <div className="label-caps">BRIEF DETAYLARI</div>
            <span style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--color-text-tertiary)' }}>{briefOpen ? 'KAPAT' : 'DETAY'}</span>
          </div>
          {briefOpen && (
            <>
              {brief.message && <div style={{ fontSize: '14px', color: '#0a0a0a', lineHeight: 1.7, marginBottom: '16px' }}>{brief.message}</div>}
              {producerBrief?.producer_note && (
                <div style={{ borderLeft: '3px solid #3b82f6', padding: '10px 14px', background: 'rgba(59,130,246,0.04)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#3b82f6', marginBottom: '4px' }}>PRODÜKTÖR NOTU</div>
                  <div style={{ fontSize: '13px', color: '#0a0a0a', lineHeight: 1.6 }}>{producerBrief.producer_note}</div>
                </div>
              )}
              <div className="brief-meta" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                {[
                  { k: 'HOOK', v: brief.cps_hook || brief.hook },
                  { k: 'HERO', v: brief.cps_hero || brief.hero },
                  { k: 'TON', v: brief.cps_ton || brief.tone },
                  { k: 'HEDEF KİTLE', v: sf.includes('target_audience') ? brief.target_audience : null },
                  { k: 'MECRA', v: Array.isArray(brief.platforms) ? brief.platforms.join(', ') : null },
                  { k: 'CTA', v: sf.includes('cta') ? brief.cta : null },
                  { k: 'FORMAT', v: brief.format },
                  { k: 'SÜRE', v: durMap[brief.video_type] || brief.video_type },
                ].filter(m => m.v).map(m => (
                  <div key={m.k}>
                    <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>{m.k}</div>
                    <div style={{ fontSize: '13px', color: '#0a0a0a' }}>{m.v}</div>
                  </div>
                ))}
              </div>
              {brief.voiceover_text && sf.includes('voiceover_text') && (
                <div style={{ borderLeft: '3px solid #22c55e', padding: '10px 14px', background: 'rgba(34,197,94,0.04)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>SESLENDİRME METNİ · {brief.voiceover_type === 'real' ? 'PROFESYONEL' : 'AI'} · {brief.voiceover_gender === 'male' ? 'ERKEK' : 'KADIN'}</div>
                  <div style={{ fontSize: '13px', color: '#0a0a0a', fontStyle: 'italic', lineHeight: 1.6 }}>{brief.voiceover_text}</div>
                </div>
              )}
              {brief.voiceover_type === 'real' && (
                <div style={{ marginBottom: '16px' }}>
                  {brief.voiceover_file_url ? (
                    <div>
                      <audio controls src={brief.voiceover_file_url} style={{ width: '100%', marginBottom: '6px' }} />
                      <button onClick={() => downloadFile(brief.voiceover_file_url, `${brief.campaign_name || 'voiceover'}_ses.mp3`)} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '10px' }}>SES İNDİR ↓</button>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#f59e0b' }}>Seslendirme dosyası hazırlanıyor...</div>
                  )}
                </div>
              )}
              {brief.notes && sf.includes('notes') && (
                <div>
                  <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>NOTLAR</div>
                  <div style={{ fontSize: '13px', color: '#0a0a0a', lineHeight: 1.5 }}>{brief.notes}</div>
                </div>
              )}
              {brief.format && (
                <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {(() => { const r = brief.format.split(':').map(Number); const scale = 32 / Math.max(r[0] || 1, r[1] || 1); return <div style={{ width: `${(r[0] || 1) * scale}px`, height: `${(r[1] || 1) * scale}px`, border: '2px solid #22c55e', background: 'rgba(34,197,94,0.08)', flexShrink: 0 }} /> })()}
                  <div style={{ fontSize: '12px', color: '#0a0a0a' }}>Bu video <strong>{brief.format}</strong> formatında üretilmeli</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ADMIN APPROVED IDEA / SCENARIO */}
        {(studioLocked || adminApproved) && (
          <div style={{ background: '#fff', border: '1px solid #22c55e', padding: '18px 22px', marginBottom: '16px' }}>
            <div className="label-caps" style={{ color: '#22c55e', marginBottom: '12px' }}>CREATIVE STUDIO'DAN GELENLER</div>
            {adminApproved && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '4px' }}>{adminApproved.title}</div>
                <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.7 }}>{adminApproved.concept}</div>
              </div>
            )}
            {adminApproved?.scenario_status === 'approved' && adminApproved.scenario && (() => {
              let parsed: any = adminApproved.scenario
              if (typeof parsed === 'string') { try { const p = JSON.parse(parsed); parsed = Array.isArray(p) ? p : p?.scenario || parsed } catch { } }
              if (!Array.isArray(parsed)) return <div style={{ fontSize: '13px', color: '#0a0a0a', lineHeight: 1.8 }}>{String(parsed)}</div>
              return (
                <div style={{ borderTop: '1px solid #e5e4db', paddingTop: '12px' }}>
                  <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>SENARYO</div>
                  {parsed.map((sc: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '18px', fontWeight: '300', color: '#ddd', width: '20px', flexShrink: 0 }}>{sc.scene}</div>
                      <div>
                        {sc.duration && <div style={{ fontSize: '10px', color: '#22c55e', fontWeight: '500', marginBottom: '2px' }}>{sc.duration}</div>}
                        <div style={{ fontSize: '13px', color: '#0a0a0a', lineHeight: 1.6 }}>{sc.visual}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* 2) ÜRETİM */}
        <div style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '22px', marginBottom: '16px' }}>
          <div className="label-caps" style={{ marginBottom: '16px' }}>ÜRETİM</div>
          {(internalRevisions.length > 0 || clientRevisions.length > 0) && (
            <div style={{ border: '2px solid #ef4444', padding: '14px 18px', marginBottom: '16px' }}>
              <div className="label-caps" style={{ color: '#ef4444', marginBottom: '10px' }}>REVİZYON TALEPLERİ</div>
              {[...internalRevisions, ...clientRevisions].map(r => {
                const isClient = r.question.startsWith('REVİZYON:')
                const { tc, clean } = parseTimecode(r.question.replace(/^(İÇ )?REVİZYON: /, ''))
                return (
                  <div key={r.id} style={{ padding: '8px 10px', background: 'rgba(239,68,68,0.04)', marginBottom: '4px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: '#ef4444', flexShrink: 0, marginTop: '2px' }}>{isClient ? 'MÜŞTERİ' : 'ADMIN'}</span>
                    {tc !== null && <button onClick={() => seekTo(tc)} style={{ fontSize: '10px', padding: '1px 6px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'none', cursor: 'pointer', fontFamily: 'monospace', flexShrink: 0 }}>▶ {Math.floor(tc / 60)}:{String(Math.floor(tc % 60)).padStart(2, '0')}</button>}
                    <span style={{ fontSize: '12px', color: '#0a0a0a' }}>{clean}</span>
                  </div>
                )
              })}
            </div>
          )}
          {canUpload && !uploading && (
            <div onClick={() => fileRef.current?.click()} style={{ border: '1px dashed #0a0a0a', padding: '32px 24px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px' }}>
              <div style={{ fontSize: '32px', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>+</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Videoyu sürükle veya tıkla</div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>MP4, MOV · max 200MB · yüklendikten sonra gönder butonuyla admin'e ilet</div>
            </div>
          )}
          {hasDraft && !uploading && (
            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '8px', padding: '8px 12px', background: '#fafaf7', border: '1px solid #e5e4db' }}>Önce mevcut taslağı sil veya gönder.</div>
          )}
          <input ref={fileRef} type="file" accept="video/*" onChange={handleUpload} style={{ display: 'none' }} />
          {uploading && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Yükleniyor...</span>
                <span style={{ fontSize: '11px', color: '#0a0a0a', fontVariantNumeric: 'tabular-nums' }}>{uploadProgress}%</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: '#e5e4db' }}>
                <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#0a0a0a', transition: 'width 0.3s' }} />
              </div>
            </div>
          )}
          {submissions.map(s => {
            const isDraft = s.status === 'draft'
            const canDelete = (isDraft || (s.status === 'pending' && s.id === submissions[0]?.id))
            const statusMap: Record<string, string> = { draft: 'submitted', pending: 'approved', admin_approved: 'delivered', producer_approved: 'delivered', revision_requested: 'revision' }
            const draftLabel = isDraft ? 'TASLAK · GÖNDERİLMEDİ' : s.status === 'pending' ? 'GÖNDERİLDİ · ADMİN İNCELİYOR' : null
            return (
              <div key={s.id} style={{ border: isDraft ? '1px solid #0a0a0a' : '1px solid #e5e4db', padding: '14px 18px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '60px', height: '80px', background: '#0a0a0a', flexShrink: 0, overflow: 'hidden' }}>
                    <video ref={s.id === submissions[0]?.id ? videoRef : undefined} src={s.video_url + '#t=0.5'} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>VERSİYON {s.version}</span>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>{new Date(s.submitted_at).toLocaleDateString('tr-TR')}</span>
                    </div>
                    {draftLabel ? <span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '3px 8px', border: `1px solid ${isDraft ? '#888' : '#f5a623'}`, color: isDraft ? '#888' : '#f5a623' }}>{draftLabel}</span> : statusBadge(statusMap[s.status] || 'submitted')}
                    {s.producer_notes && !isDraft && <div style={{ fontSize: '11px', color: s.status === 'revision_requested' ? '#ef4444' : '#888', marginTop: '4px' }}>Not: {s.producer_notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => setPlayerUrl(s.video_url)} className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '9px' }}>OYNAT</button>
                    {canDelete && <button onClick={() => setDeleteConfirm(s.id)} className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '9px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>× SİL</button>}
                  </div>
                </div>
                {/* Draft: note + send */}
                {isDraft && (
                  <div style={{ marginTop: '12px', borderTop: '1px solid #e5e4db', paddingTop: '12px' }}>
                    <textarea value={creatorNote} onChange={e => setCreatorNote(e.target.value)} placeholder="Admin'e not (opsiyonel)..." rows={2}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e4db', fontSize: '12px', color: '#0a0a0a', resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px' }} />
                    <button onClick={() => setSendConfirm(s.id)} className="btn" style={{ width: '100%', padding: '10px' }}>GÖNDER →</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 3) ASSET'LER + Q&A yan yana grid */}
        <div className="bottom-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div style={{ background: '#fff', border: '1px solid #e5e4db', padding: '18px 22px' }}>
            <div className="label-caps" style={{ marginBottom: '12px' }}>ASSET'LER</div>
            {(() => {
              const ps = brief.clients?.packshots || {}
              const packshotAssets = ['9x16','16x9','1x1','4x5','2x3'].filter(k => ps[k]).map(k => ({ name: `Packshot ${k.replace('x',':')}`, url: ps[k], type: 'image' }))
              const allAssets = [
                ...packshotAssets,
                ...(brief.clients?.logo_url ? [{ name: 'Logo', url: brief.clients.logo_url, type: 'image' }] : []),
                ...(brief.clients?.font_url ? [{ name: 'Font', url: brief.clients.font_url, type: 'font' }] : []),
                ...brandFiles.map((f: any) => ({ name: f.file_name, url: f.file_url, type: f.file_type || '' })),
                ...projectFiles.map((f: any) => ({ name: f.file_name, url: f.file_url, type: f.file_type || '' })),
              ]
              return allAssets.length > 0 ? allAssets.map((asset, i) => {
                const ext = asset.name?.split('.').pop()?.toUpperCase() || (asset.type.includes('image') ? 'IMG' : asset.type.includes('font') ? 'TTF' : 'FILE')
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #f0f0ee' }}>
                    <div style={{ width: '28px', height: '28px', background: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '600', letterSpacing: '0.5px', flexShrink: 0 }}>{ext}</div>
                    <div style={{ flex: 1, fontSize: '12px', color: '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
                    <button onClick={() => downloadFile(asset.url, asset.name || asset.url.split('/').pop() || 'file')} className="btn btn-outline" style={{ padding: '3px 10px', fontSize: '9px' }}>İNDİR ↓</button>
                  </div>
                )
              }) : <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>Asset eklenmemiş.</div>
            })()}
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e4db', padding: '18px 22px' }}>
            <div className="label-caps" style={{ marginBottom: '12px' }}>SORULAR & İLETİŞİM</div>
            {visibleQuestions.length === 0 && <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>Henüz soru yok.</div>}
            {visibleQuestions.map(q => (
              <div key={q.id} style={{ padding: '8px 10px', background: 'var(--color-background-secondary)', marginBottom: '4px' }}>
                <div style={{ fontSize: '12px', color: '#0a0a0a' }}>{q.question}</div>
                {q.answer && <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '2px' }}>↳ {q.answer}</div>}
              </div>
            ))}
            <form onSubmit={handleQuestion} style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
              <input value={newQuestion} onChange={e => setNewQuestion(e.target.value)} placeholder="Admin'e soru sor..." style={{ flex: 1, padding: '8px 10px', border: '1px solid #e5e4db', fontSize: '12px', color: '#0a0a0a' }} />
              <button type="submit" className="btn" style={{ padding: '8px 14px', fontSize: '10px' }}>GÖNDER</button>
            </form>
          </div>
        </div>
      </div>

      {/* SEND CONFIRM */}
      {sendConfirm && (
        <div onClick={() => setSendConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '28px', maxWidth: '400px', width: '90%' }}>
            <div style={{ fontSize: '16px', fontWeight: '500', color: '#0a0a0a', marginBottom: '10px' }}>Video Gönder</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>Bu videoyu admin'e göndermek istediğine emin misin?</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setSendConfirm(null)} className="btn btn-outline" style={{ flex: 1, padding: '10px' }}>İPTAL</button>
              <button onClick={() => sendDraft(sendConfirm)} className="btn" style={{ flex: 1, padding: '10px' }}>GÖNDER</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '28px', maxWidth: '400px', width: '90%' }}>
            <div style={{ fontSize: '16px', fontWeight: '500', color: '#0a0a0a', marginBottom: '10px' }}>Versiyonu Sil</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>Bu versiyonu silmek istediğine emin misin? Video dosyası da kaldırılacak.</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-outline" style={{ flex: 1, padding: '10px' }}>İPTAL</button>
              <button onClick={() => deleteSubmission(deleteConfirm)} className="btn" style={{ flex: 1, padding: '10px', background: '#ef4444' }}>SİL</button>
            </div>
          </div>
        </div>
      )}

      {/* VIDEO PLAYER MODAL */}
      {playerUrl && (
        <div onClick={() => setPlayerUrl(null)} onKeyDown={e => { if (e.key === 'Escape') setPlayerUrl(null) }} tabIndex={0} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setPlayerUrl(null)} style={{ position: 'absolute', top: '20px', right: '20px', width: '32px', height: '32px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 201 }}>×</button>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
            <video controls autoPlay playsInline preload="metadata" style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'block' }}><source src={playerUrl} /></video>
          </div>
        </div>
      )}

      {/* VOICE STUDIO MODAL */}
      {voiceStudioOpen && (
        <div onClick={() => setVoiceStudioOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid #0a0a0a', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e4db', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#0a0a0a' }}>SES STÜDYOSU</div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {!lockedVoice && <button onClick={() => loadCreatorVoices(true)} disabled={voicesLoading} title="Ses listesini yenile" style={{ width: '28px', height: '28px', border: '1px solid #e5e4db', background: '#fff', color: '#0a0a0a', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg></button>}
                <button onClick={() => setVoiceStudioOpen(false)} style={{ width: '28px', height: '28px', border: '1px solid #e5e4db', background: '#fff', color: '#0a0a0a', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '28px', overflowY: 'auto', flex: 1 }}>
              {/* Existing voiceover */}
              {brief?.ai_voiceover_url && (
                <div style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.2)', padding: '16px 20px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#22c55e', fontWeight: '500' }}>MEVCUT SES</div>
                    {brief.ai_voiceover_generated_at && <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>{new Date(brief.ai_voiceover_generated_at).toLocaleDateString('tr-TR')}</span>}
                  </div>
                  <audio controls src={brief.ai_voiceover_url} style={{ width: '100%', marginBottom: '8px' }} />
                  <button onClick={() => downloadFile(brief.ai_voiceover_url, `${brief.campaign_name || 'voiceover'}_ai_ses.mp3`)} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '10px' }}>SES İNDİR ↓</button>
                </div>
              )}

              {/* Voiceover text */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>SESLENDİRME METNİ</div>
                <textarea
                  value={voiceText}
                  onChange={e => { if (e.target.value.length <= 500) setVoiceText(e.target.value) }}
                  rows={4}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e4db', fontSize: '13px', color: '#0a0a0a', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' }}
                  placeholder="Seslendirme metnini buraya yaz..."
                />
                <div style={{ fontSize: '10px', color: voiceText.length > 450 ? '#f59e0b' : 'var(--color-text-tertiary)', marginTop: '4px', textAlign: 'right' }}>{voiceText.length} / 500</div>
                {brief?.voiceover_gender && (
                  <div style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>CİNSİYET: {brief.voiceover_gender === 'male' ? 'ERKEK' : 'KADIN'}</div>
                )}
              </div>

              {/* Voice list or locked brand voice */}
              {lockedVoice ? (
                <div style={{ marginBottom: '24px', padding: '16px 20px', background: 'rgba(0,0,0,0.02)', border: '1px solid #e5e4db' }}>
                  <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#0a0a0a', fontWeight: '500', marginBottom: '8px' }}>MARKA SESİ KİLİTLİ</div>
                  <div style={{ fontSize: '13px', color: '#0a0a0a', marginBottom: '4px' }}>{cleanVoiceName(lockedVoice.name)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Bu marka için sabit ses seçilmiştir.</div>
                </div>
              ) : (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '12px' }}>TÜRKÇE SESLER</div>
                {voicesLoading ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>Sesler yükleniyor...</div>
                ) : voices.length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>Türkçe ses bulunamadı.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {voices.map((v: any) => (
                      <div
                        key={v.voice_id}
                        onClick={() => setSelectedVoice(v.voice_id)}
                        style={{
                          padding: '8px 10px', cursor: 'pointer', transition: 'border-color 0.15s',
                          border: selectedVoice === v.voice_id ? '1px solid #0a0a0a' : '1px solid #e5e4db',
                          background: selectedVoice === v.voice_id ? 'rgba(0,0,0,0.02)' : '#fff',
                        }}
                        onMouseEnter={e => { if (selectedVoice !== v.voice_id) e.currentTarget.style.background = '#fafaf7' }}
                        onMouseLeave={e => { if (selectedVoice !== v.voice_id) e.currentTarget.style.background = '#fff' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanVoiceName(v.name)}</span>
                          {v.preview_url && (
                            <button
                              onClick={e => { e.stopPropagation(); playPreview(v.preview_url, v.voice_id) }}
                              className="btn btn-outline"
                              style={{ padding: '2px 6px', fontSize: '8px', flexShrink: 0 }}
                            >
                              {playingPreview === v.voice_id ? '■' : '▶'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}

              {/* Generate button */}
              <button
                onClick={() => { if (brief?.ai_voiceover_url) { setVoiceConfirm(true) } else { setVoiceConfirm(true); generateVoiceover() } }}
                disabled={!voiceText.trim() || !selectedVoice || voiceGenerating}
                className="btn"
                style={{ width: '100%', padding: '12px', fontSize: '12px', opacity: (!voiceText.trim() || !selectedVoice || voiceGenerating) ? 0.4 : 1 }}
              >
                {voiceGenerating ? 'ÜRETİLİYOR...' : 'SESİ ÜRET'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOICE OVERRIDE CONFIRM / GENERATING / ERROR */}
      {voiceConfirm && (
        <div onClick={voiceGenerating ? undefined : () => { setVoiceConfirm(false); setVoiceError(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '28px', maxWidth: '400px', width: '90%' }}>
            {voiceGenerating ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px', borderStyle: 'solid', borderColor: '#e5e4db #e5e4db #e5e4db #0a0a0a', animation: 'voice-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                <div style={{ fontSize: '14px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#0a0a0a', marginBottom: '6px' }}>SES ÜRETİLİYOR...</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Bu işlem 30-60 saniye sürebilir.</div>
              </div>
            ) : voiceError ? (
              <>
                <div style={{ fontSize: '16px', fontWeight: '500', color: '#ef4444', marginBottom: '10px' }}>Hata</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>{voiceError}</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { setVoiceConfirm(false); setVoiceError(null) }} className="btn btn-outline" style={{ flex: 1, padding: '10px' }}>KAPAT</button>
                  <button onClick={() => { setVoiceError(null); generateVoiceover() }} className="btn" style={{ flex: 1, padding: '10px' }}>TEKRAR DENE</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '16px', fontWeight: '500', color: '#0a0a0a', marginBottom: '10px' }}>Yeni Ses Üret</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>Bu ses ile seslendirme üretilecek. Mevcut ses override edilecek. Devam?</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setVoiceConfirm(false)} className="btn btn-outline" style={{ flex: 1, padding: '10px' }}>İPTAL</button>
                  <button onClick={generateVoiceover} className="btn" style={{ flex: 1, padding: '10px' }}>DEVAM</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <audio ref={previewAudioRef} style={{ display: 'none' }} />

      <style>{`@keyframes voice-spin{to{transform:rotate(360deg)}} @media (max-width: 768px) { .brief-meta { grid-template-columns: repeat(2, 1fr) !important; } .bottom-grid { grid-template-columns: 1fr !important; } .summary-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
