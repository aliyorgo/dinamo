'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import ProductionStudio from '@/components/ProductionStudio'
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
  const [uploadProgress, setUploadProgress] = useState(0)
  const [msg, setMsg] = useState('')
  const [brandFiles, setBrandFiles] = useState<any[]>([])
  const [projectFiles, setProjectFiles] = useState<any[]>([])
  const [adminApproved, setAdminApproved] = useState<any>(null)
  const [studioLocked, setStudioLocked] = useState(false)
  const [briefOpen, setBriefOpen] = useState(true)
  const [newQuestion, setNewQuestion] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [playerUrl, setPlayerUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => { loadData() }, [briefId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ud } = await supabase.from('users').select('name').eq('id', user.id).single()
    setUserName(ud?.name || '')
    const { data: b } = await supabase.from('briefs').select('*, clients(company_name, logo_url, font_url)').eq('id', briefId).single()
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
    setUploading(true); setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: cd } = await supabase.from('creators').select('id').eq('user_id', user?.id).maybeSingle()
    if (!cd) { setMsg('Creator kaydı bulunamadı.'); setUploading(false); return }
    const ext = file.name.split('.').pop() || 'mp4'
    const client = (brief?.clients?.company_name || 'client').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const campaign = (brief?.campaign_name || 'video').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const fmt = (brief?.format || '').replace(':', 'x')
    const date = new Date().toISOString().slice(0, 10)
    const storagePath = `${briefId}/dinamo_${client}_${campaign}_${fmt}_${date}.${ext}`
    const { error: upErr } = await supabase.storage.from('videos').upload(storagePath, file)
    if (upErr) { setMsg(upErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(storagePath)
    const version = submissions.length + 1
    await supabase.from('video_submissions').insert({ brief_id: briefId, creator_id: cd.id, video_url: urlData.publicUrl, version, status: 'pending', format: brief?.format || null })
    setMsg('Video yüklendi.')
    if (fileRef.current) fileRef.current.value = ''
    loadData(); setUploading(false)
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
  const canUpload = submissions.length === 0 || submissions.some(s => s.status === 'revision_requested') || !submissions.some(s => s.status === 'pending')
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

        {/* CREATIVE STUDIO */}
        <div style={{ marginBottom: '16px' }}>
          <ProductionStudio briefId={briefId} source="creator" userRole="creator" />
        </div>

        {/* 1) BRIEF DETAYLARI */}
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
                  <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>SESLENDİRME METNİ · {brief.voiceover_type === 'real' ? 'GERÇEK' : 'AI'} · {brief.voiceover_gender === 'male' ? 'ERKEK' : 'KADIN'}</div>
                  <div style={{ fontSize: '13px', color: '#0a0a0a', fontStyle: 'italic', lineHeight: 1.6 }}>{brief.voiceover_text}</div>
                </div>
              )}
              {brief.voiceover_type === 'real' && (
                <div style={{ marginBottom: '16px' }}>
                  {brief.voiceover_file_url ? (
                    <div>
                      <audio controls src={brief.voiceover_file_url} style={{ width: '100%', marginBottom: '6px' }} />
                      <a href={brief.voiceover_file_url} download target="_blank" className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '10px', textDecoration: 'none' }}>SES İNDİR ↓</a>
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
          {canUpload && (
            <div onClick={() => fileRef.current?.click()} style={{ border: '1px dashed #0a0a0a', padding: '32px 24px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px' }}>
              <div style={{ fontSize: '32px', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>+</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Videoyu sürükle veya tıkla</div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>MP4, MOV · max 200MB</div>
            </div>
          )}
          <input ref={fileRef} type="file" accept="video/*" onChange={handleUpload} style={{ display: 'none' }} />
          {uploading && <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginBottom: '12px' }}>Yükleniyor...</div>}
          {submissions.map(s => {
            const canDelete = s.status === 'pending' && s.id === submissions[0]?.id
            return (
              <div key={s.id} style={{ border: '1px solid #e5e4db', padding: '14px 18px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '60px', height: '80px', background: '#0a0a0a', flexShrink: 0, overflow: 'hidden' }}>
                  <video ref={s.id === submissions[0]?.id ? videoRef : undefined} src={s.video_url + '#t=0.5'} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>VERSİYON {s.version}</span>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>{new Date(s.submitted_at).toLocaleDateString('tr-TR')}</span>
                  </div>
                  {statusBadge(s.status === 'pending' ? 'submitted' : s.status === 'admin_approved' || s.status === 'producer_approved' ? 'delivered' : s.status === 'revision_requested' ? 'revision' : 'submitted')}
                  {s.producer_notes && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>Not: {s.producer_notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button onClick={() => setPlayerUrl(s.video_url)} className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '9px' }}>OYNAT</button>
                  {canDelete && <button onClick={() => setDeleteConfirm(s.id)} className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '9px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>× SİL</button>}
                </div>
              </div>
            )
          })}
        </div>

        {/* 3) ASSET'LER + Q&A yan yana grid */}
        <div className="bottom-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div style={{ background: '#fff', border: '1px solid #e5e4db', padding: '18px 22px' }}>
            <div className="label-caps" style={{ marginBottom: '12px' }}>ASSET'LER</div>
            {(() => {
              const allAssets = [
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
                    <a href={asset.url} target="_blank" download className="btn btn-outline" style={{ padding: '3px 10px', fontSize: '9px', textDecoration: 'none' }}>İNDİR ↓</a>
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

      <style>{`@media (max-width: 768px) { .brief-meta { grid-template-columns: repeat(2, 1fr) !important; } .bottom-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
