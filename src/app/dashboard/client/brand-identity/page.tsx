'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function BrandIdentityPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [credits, setCredits] = useState(0)
  const [clientId, setClientId] = useState('')
  const [files, setFiles] = useState<any[]>([])
  const [briefs, setBriefs] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedBriefId, setSelectedBriefId] = useState('')
  const [fileLabel, setFileLabel] = useState('')
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Voice artist state
  const [brandVoices, setBrandVoices] = useState<any>(null)
  const [voiceModalOpen, setVoiceModalOpen] = useState(false)
  const [voiceTab, setVoiceTab] = useState<'male' | 'female'>('male')
  const [voices, setVoices] = useState<{ male: any[]; female: any[] }>({ male: [], female: [] })
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [selectedMaleVoice, setSelectedMaleVoice] = useState<{ voice_id: string; name: string } | null>(null)
  const [selectedFemaleVoice, setSelectedFemaleVoice] = useState<{ voice_id: string; name: string } | null>(null)
  const [playingPreview, setPlayingPreview] = useState<string | null>(null)
  const [voiceSaving, setVoiceSaving] = useState(false)
  const previewAudioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name').eq('id', user.id).single()
      setUserName(userData?.name || '')
      const { data: cu } = await supabase.from('client_users').select('allocated_credits, client_id, clients(company_name, brand_voices)').eq('user_id', user.id).single()
      if (cu) {
        setCredits(cu.allocated_credits)
        setClientId(cu.client_id)
        setCompanyName((cu as any).clients?.company_name || '')
        setBrandVoices((cu as any).clients?.brand_voices || null)
        // Init selected voices from saved
        const bv = (cu as any).clients?.brand_voices
        if (bv?.male) setSelectedMaleVoice(bv.male)
        if (bv?.female) setSelectedFemaleVoice(bv.female)
        const { data: f } = await supabase.from('brief_files').select('*').eq('client_id', cu.client_id).order('created_at', { ascending: false })
        setFiles(f || [])
        const { data: b } = await supabase.from('briefs').select('id, campaign_name').eq('client_id', cu.client_id).neq('status', 'cancelled').order('created_at', { ascending: false })
        setBriefs(b || [])
      }
    }
    load()
  }, [router])

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file || !clientId) return
    setUploading(true); setMsg('')
    const ext = file.name.split('.').pop()
    const path = `brand/${clientId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('brand-assets').upload(path, file)
    if (upErr) { setMsg(upErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
    const { error: insErr } = await supabase.from('brief_files').insert({
      client_id: clientId,
      brief_id: selectedBriefId || null,
      file_url: urlData.publicUrl,
      file_name: fileLabel || file.name,
      file_type: file.type,
    })
    if (insErr) { setMsg('Kayıt hatası: ' + insErr.message); setUploading(false); return }
    setMsg('Dosya yüklendi.')
    setShowUploadModal(false); setSelectedBriefId(''); setFileLabel('')
    if (fileRef.current) fileRef.current.value = ''
    const { data: f } = await supabase.from('brief_files').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setFiles(f || [])
    setUploading(false)
  }

  async function openVoiceModal() {
    setVoiceModalOpen(true)
    if (voices.male.length === 0 && voices.female.length === 0) {
      setVoicesLoading(true)
      const [maleRes, femaleRes] = await Promise.all([
        fetch('/api/elevenlabs/voices?gender=male').then(r => r.json()),
        fetch('/api/elevenlabs/voices?gender=female').then(r => r.json()),
      ])
      setVoices({ male: maleRes.voices || [], female: femaleRes.voices || [] })
      setVoicesLoading(false)
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

  async function saveVoices() {
    if (!clientId) return
    setVoiceSaving(true)
    const payload: any = {}
    if (selectedMaleVoice) payload.male = selectedMaleVoice
    if (selectedFemaleVoice) payload.female = selectedFemaleVoice
    await supabase.from('clients').update({ brand_voices: Object.keys(payload).length > 0 ? payload : null }).eq('id', clientId)
    setBrandVoices(Object.keys(payload).length > 0 ? payload : null)
    setVoiceSaving(false)
    setVoiceModalOpen(false)
  }

  function FileThumb({ type, url }: { type: string; url: string }) {
    if (type?.includes('image')) return <img src={url} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f5f5f5', padding: '6px' }} />
    if (type?.includes('video')) return <div style={{ width: '100%', height: '100%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '24px', color: 'rgba(255,255,255,0.5)' }}>▶</span></div>
    if (type?.includes('pdf')) return <div style={{ width: '100%', height: '100%', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '14px', fontWeight: '600', color: '#888', letterSpacing: '0.5px' }}>PDF</span></div>
    return <div style={{ width: '100%', height: '100%', background: '#f5f4f0' }} />
  }

  function cleanVoiceName(name: string) {
    return name.split(/\s*[-•·]\s*/)[0].trim()
  }

  const currentVoices = voiceTab === 'male' ? voices.male : voices.female
  const selectedForTab = voiceTab === 'male' ? selectedMaleVoice : selectedFemaleVoice
  const setSelectedForTab = voiceTab === 'male'
    ? (v: { voice_id: string; name: string } | null) => setSelectedMaleVoice(v)
    : (v: { voice_id: string; name: string } | null) => setSelectedFemaleVoice(v)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div style={{ width: '240px', background: '#0A0A0A', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100dvh', overflowY: 'auto' }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', cursor: 'pointer' }} onClick={() => router.push('/dashboard/client')}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{ height: '28px' }} />
        </div>
        <div style={{ margin: '12px 12px', padding: '16px 20px', background: 'rgba(29,184,29,0.06)', borderLeft: '3px solid #1DB81D' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '2px' }}>{companyName || 'Dinamo'}</div>
          <div style={{ fontSize: '13px', fontWeight: '400', color: '#888', marginBottom: '12px' }}>{userName}</div>
          <div style={{ fontSize: '10px', color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>KREDİ BAKİYESİ</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1DB81D', letterSpacing: '-1px' }}>{credits}</div>
        </div>
        <nav style={{ padding: '10px 8px' }}>
          {[
            { label: 'Projelerim', href: '/dashboard/client', active: false },
            { label: 'Yeni Brief', href: '/dashboard/client/brief/new', active: false },
            { label: 'Marka Kimliği', href: '/dashboard/client/brand-identity', active: true },
            { label: 'Raporlar', href: '/dashboard/client/reports', active: false },
            { label: 'Telif Belgeleri', href: '/dashboard/client/certificates', active: false },
            { label: 'İçerik Güvencesi', href: '/dashboard/client/guarantee', active: false },
          ].map(item => (
            <div key={item.href} onClick={() => router.push(item.href)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: item.active ? 'rgba(255,255,255,0.08)' : 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: item.active ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: '500' }}>{item.label}</span>
            </div>
          ))}
          <button onClick={handleLogout}
            onMouseEnter={e => { (e.currentTarget.firstChild as HTMLElement).style.color = '#FF4444' }}
            onMouseLeave={e => { (e.currentTarget.firstChild as HTMLElement).style.color = '#aaa' }}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 8px', marginTop: '16px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: '#aaa', transition: 'color 0.15s' }}>Çıkış yap</span>
          </button>
          <img src='/powered_by_dcc.png' alt='Powered by DCC' style={{ height: '20px', width: 'auto', opacity: 0.6, display: 'block', margin: '8px 8px', cursor: 'pointer' }} onClick={() => window.open('https://dirtycheapcreative.com', '_blank')} />
        </nav>
      </div>

      <div style={{ flex: 1, background: '#f5f4f0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Marka Kimliği</div>
        </div>

        <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: '#0a0a0a', marginBottom: '6px' }}>MARKA KİMLİĞİ</div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>Markanın görsel ve sesli kimliğini buradan yönet.</div>
      </div>

      {msg && <div style={{ marginBottom: '16px', padding: '10px 14px', background: msg.includes('Hata') || msg.includes('hatası') ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${msg.includes('Hata') || msg.includes('hatası') ? '#ef4444' : '#22c55e'}`, fontSize: '12px', color: '#0a0a0a' }}>{msg}</div>}

      {/* Cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>

        {/* AI DUBLAJ SANATÇISI */}
        <div style={{ background: '#fff', border: '1px solid #e5e4db', padding: '22px 26px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: '500' }}>AI DUBLAJ SANATÇISI</div>
            <button onClick={openVoiceModal} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '10px' }}>AYARLA →</button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', lineHeight: 1.5, marginBottom: '12px' }}>AI seslendirme için marka sesi belirle. Erkek ve kadın için ayrı ayrı.</div>
          {brandVoices ? (
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {brandVoices.male && <span style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: '#0a0a0a' }}>ERKEK: {brandVoices.male.name}</span>}
              {brandVoices.female && <span style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: '#0a0a0a' }}>KADIN: {brandVoices.female.name}</span>}
              {!brandVoices.male && !brandVoices.female && <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Henüz seçim yapılmadı.</span>}
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Henüz seçim yapılmadı.</div>
          )}
        </div>

        {/* MARKA DOSYALARI */}
        <div style={{ background: '#fff', border: '1px solid #e5e4db', padding: '22px 26px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: '500' }}>MARKA DOSYALARI</div>
            <button onClick={() => setShowUploadModal(true)} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '10px' }}>+ DOSYA EKLE</button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', lineHeight: 1.5, marginBottom: '12px' }}>Logo, font ve marka dosyalarını yönet.</div>
          <div style={{ fontSize: '11px', color: '#0a0a0a' }}>{files.length} dosya yüklendi</div>
        </div>
      </div>

      {/* FILES GRID */}
      {files.length > 0 && (
        <div>
          <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '12px' }}>YÜKLENEN DOSYALAR</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {files.map(f => {
              const brief = briefs.find(b => b.id === f.brief_id)
              return (
                <div key={f.id} style={{ background: '#fff', border: '1px solid #e5e4db', overflow: 'hidden' }}>
                  <div style={{ height: '100px', overflow: 'hidden' }}>
                    <FileThumb type={f.file_type} url={f.file_url} />
                  </div>
                  <div style={{ padding: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>{f.file_name}</div>
                    <div style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>
                      {brief ? brief.campaign_name : 'TÜM KAMPANYALAR'}
                    </div>
                    <a href={f.file_url} target="_blank" className="btn btn-outline" style={{ padding: '3px 10px', fontSize: '9px', textDecoration: 'none' }}>İNDİR ↓</a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div onClick={() => setShowUploadModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '28px', width: '440px', maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#0a0a0a' }}>DOSYA EKLE</div>
              <button onClick={() => { setShowUploadModal(false); setMsg('') }} style={{ width: '28px', height: '28px', border: '1px solid #e5e4db', background: '#fff', color: '#0a0a0a', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div onClick={() => fileRef.current?.click()} style={{ border: '1px dashed #0a0a0a', padding: '28px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px' }}>
              <div style={{ fontSize: '28px', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>+</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                {fileRef.current?.files?.[0] ? fileRef.current.files[0].name : 'Dosya seç veya sürükle'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>Logo, font, marka rehberi, ürün görseli</div>
            </div>
            <input ref={fileRef} type="file" onChange={() => setMsg('')} style={{ display: 'none' }} />
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>DOSYA ADI / ETİKETİ</div>
              <input value={fileLabel} onChange={e => setFileLabel(e.target.value)} placeholder="örn. Ana Logo, Marka Fontu..." style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e4db', fontSize: '13px', color: '#0a0a0a', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>KAMPANYA İLE EŞLEŞTİR (OPSİYONEL)</div>
              <select value={selectedBriefId} onChange={e => setSelectedBriefId(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e4db', fontSize: '13px', color: '#0a0a0a', background: '#fff' }}>
                <option value="">Tüm kampanyalar</option>
                {briefs.map(b => <option key={b.id} value={b.id}>{b.campaign_name}</option>)}
              </select>
            </div>
            <button onClick={handleUpload} disabled={uploading} className="btn" style={{ width: '100%', padding: '10px' }}>
              {uploading ? 'Yükleniyor...' : 'YÜKLE'}
            </button>
          </div>
        </div>
      )}

      {/* VOICE ARTIST MODAL */}
      {voiceModalOpen && (
        <div onClick={() => setVoiceModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid #0a0a0a', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e4db', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#0a0a0a' }}>AI DUBLAJ SANATÇISI</div>
              <button onClick={() => setVoiceModalOpen(false)} style={{ width: '28px', height: '28px', border: '1px solid #e5e4db', background: '#fff', color: '#0a0a0a', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding: '28px', overflowY: 'auto', flex: 1 }}>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
                Markaya özel AI dublaj sanatçısı seç. AI Express videolarda ve Ses Stüdyosu'nda otomatik olarak bu sesler kullanılır.
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '0', marginBottom: '20px' }}>
                {(['male', 'female'] as const).map(tab => (
                  <button key={tab} onClick={() => setVoiceTab(tab)}
                    style={{
                      padding: '8px 20px', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer', border: '1px solid #0a0a0a',
                      background: voiceTab === tab ? '#0a0a0a' : '#fff',
                      color: voiceTab === tab ? '#fff' : '#0a0a0a',
                      marginRight: tab === 'male' ? '-1px' : '0',
                    }}>
                    {tab === 'male' ? 'ERKEK' : 'KADIN'}
                    {(tab === 'male' ? selectedMaleVoice : selectedFemaleVoice) && <span style={{ marginLeft: '6px' }}>●</span>}
                  </button>
                ))}
              </div>

              {/* Voice list */}
              {voicesLoading ? (
                <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>Sesler yükleniyor...</div>
              ) : currentVoices.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>Ses bulunamadı.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '24px' }}>
                  {currentVoices.map((v: any) => (
                    <div
                      key={v.voice_id}
                      onClick={() => setSelectedForTab(selectedForTab?.voice_id === v.voice_id ? null : { voice_id: v.voice_id, name: v.name })}
                      style={{
                        padding: '8px 10px', cursor: 'pointer', transition: 'border-color 0.15s',
                        border: selectedForTab?.voice_id === v.voice_id ? '1px solid #0a0a0a' : '1px solid #e5e4db',
                        background: selectedForTab?.voice_id === v.voice_id ? 'rgba(0,0,0,0.02)' : '#fff',
                      }}
                      onMouseEnter={e => { if (selectedForTab?.voice_id !== v.voice_id) e.currentTarget.style.background = '#fafaf7' }}
                      onMouseLeave={e => { if (selectedForTab?.voice_id !== v.voice_id) e.currentTarget.style.background = '#fff' }}
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

              {/* Save */}
              <button onClick={saveVoices} disabled={voiceSaving} className="btn" style={{ width: '100%', padding: '12px', fontSize: '12px' }}>
                {voiceSaving ? 'KAYDEDİLİYOR...' : 'KAYDET'}
              </button>
            </div>
          </div>
        </div>
      )}

      <audio ref={previewAudioRef} style={{ display: 'none' }} />
      <style>{`@media (max-width: 768px) { div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; } }`}</style>
        </div>
      </div>
    </div>
  )
}
