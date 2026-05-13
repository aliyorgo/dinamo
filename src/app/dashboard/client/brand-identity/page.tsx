'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { cleanVoiceName } from '@/lib/voice-utils'
import { downloadFile } from '@/lib/download-helper'
import PackageDetailModal from '@/components/PackageDetailModal'
import { useClientContext } from '../layout'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function BrandIdentityPage() {
  const router = useRouter()
  const { userName, companyName, credits, clientId: ctxClientId, customizationTier } = useClientContext()
  const [clientId, setClientId] = useState('')
  const [tierModalOpen, setTierModalOpen] = useState(false)
  const [upgradeStep, setUpgradeStep] = useState<'confirm' | 'content' | 'success' | null>(null)
  const tierLadder = ['basic', 'advanced', 'corporate'] as const
  const tierLabels: Record<string, string> = { basic: 'BASIC', advanced: 'ADVANCED', corporate: 'KURUMSAL' }
  const currentIdx = tierLadder.indexOf(customizationTier as any)
  const nextTier = currentIdx >= 0 && currentIdx < tierLadder.length - 1 ? tierLadder[currentIdx + 1] : null
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

  // AI Mode
  const [globalAiMode, setGlobalAiMode] = useState<'fast' | 'quality'>('fast')
  const [clientFastMode, setClientFastMode] = useState(false)
  // Logo size
  const [logoSizePercent, setLogoSizePercent] = useState(100)
  const [logoSizeModal, setLogoSizeModal] = useState(false)
  const [logoSizeTemp, setLogoSizeTemp] = useState(100)
  const [brandLogoUrlClient, setBrandLogoUrlClient] = useState('')
  const [clientPackshots, setClientPackshots] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadAiMode() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch('/api/client/ai-mode', { headers: { 'Authorization': `Bearer ${session.access_token}` } })
      if (res.ok) {
        const d = await res.json()
        setGlobalAiMode(d.global_mode)
        setClientFastMode(d.use_fast_mode)
      }
    }
    loadAiMode()
  }, [])

  async function toggleAiMode(fast: boolean) {
    setClientFastMode(fast)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    await fetch('/api/client/ai-mode', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ use_fast_mode: fast }) })
  }

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
      if (!user) { router.push('/login'); return }
      const { data: cu } = await supabase.from('client_users').select('client_id, clients(brand_voices, logo_size_percent, brand_logo_url, packshots)').eq('user_id', user.id).single()
      if (cu) {
        setClientId(cu.client_id)
        setBrandVoices((cu as any).clients?.brand_voices || null)
        setLogoSizePercent((cu as any).clients?.logo_size_percent || 100)
        setBrandLogoUrlClient((cu as any).clients?.brand_logo_url || '')
        setClientPackshots((cu as any).clients?.packshots || {})
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

  async function loadVoices(refresh = false) {
    setVoicesLoading(true)
    const q = refresh ? '&refresh=1' : ''
    const [maleRes, femaleRes] = await Promise.all([
      fetch(`/api/elevenlabs/voices?gender=male${q}${clientId ? `&client_id=${clientId}` : ''}`).then(r => r.json()),
      fetch(`/api/elevenlabs/voices?gender=female${q}${clientId ? `&client_id=${clientId}` : ''}`).then(r => r.json()),
    ])
    setVoices({ male: maleRes.voices || [], female: femaleRes.voices || [] })
    setVoicesLoading(false)
  }

  async function openVoiceModal() {
    setVoiceModalOpen(true)
    if (voices.male.length === 0 && voices.female.length === 0) loadVoices()
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
          <span style={{display:'inline-block',padding:'2px 8px',background:'rgba(29,184,29,0.15)',color:'#1db81d',fontSize:'9px',fontWeight:600,letterSpacing:'1px',marginBottom:'6px'}}>{customizationTier === 'corporate' ? 'KURUMSAL' : customizationTier === 'advanced' ? 'ADVANCED' : 'BASIC'}</span>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '2px' }}>{companyName || 'Dinamo'}</div>
          <div style={{ fontSize: '13px', fontWeight: '400', color: '#888', marginBottom: '12px' }}>{userName}</div>
          <div style={{ fontSize: '10px', color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>KREDİ BAKİYESİ</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1DB81D', letterSpacing: '-1px' }}>{credits}</div>
        </div>
        <nav style={{ padding: '10px 8px' }}>
          {[
            { label: 'Projelerim', href: '/dashboard/client', active: false },
            { label: 'Yeni Brief', href: '/dashboard/client/brief/new', active: false },
            { label: 'Marka Ayarları', href: '/dashboard/client/brand-identity', active: true },
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
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Marka Ayarları</div>
        </div>

        <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
      {/* Customization Tier + AI Mode — side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {/* Customization Tier Card */}
        <div style={{ padding: '20px', background: '#fff', border: '1px solid var(--color-border-tertiary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', letterSpacing: '1.5px', fontWeight: '500', color: '#0a0a0a' }}>ÖZELLEŞTİRME SEVİYESİ</div>
            <span style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: '500', padding: '2px 8px', border: '1px solid var(--color-border-tertiary)', color: 'var(--color-text-secondary)' }}>{customizationTier === 'corporate' ? 'KURUMSAL' : customizationTier === 'advanced' ? 'ADVANCED' : 'BASIC'}</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginBottom: '12px' }}>{customizationTier === 'corporate' ? 'Tüm Advanced özellikleri ve özel hesap yöneticisi.' : customizationTier === 'advanced' ? 'Derin marka eğitimi, custom grafikler ve markaya özel ses.' : 'Marka tanıma, ses kütüphanesi ve persona havuzu erişimi.'}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setTierModalOpen(true)} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '10px' }}>İÇERİĞİ GÖR</button>
            {nextTier && <button onClick={() => setUpgradeStep('confirm')} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '10px' }}>YÜKSELT</button>}
          </div>
        </div>

        {/* AI MODE TOGGLE */}
        {globalAiMode === 'quality' ? (
          <div style={{ padding: '20px', background: '#fff', border: '1px solid var(--color-border-tertiary)' }}>
            <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: '#0a0a0a', marginBottom: '12px' }}>DİNAMO AI MODU</div>
            <div style={{ display: 'flex', gap: '0', marginBottom: '8px' }}>
              {([['false', 'KALİTE'], ['true', 'HIZ']] as const).map(([val, label]) => (
                <button key={val} onClick={() => toggleAiMode(val === 'true')}
                  style={{ padding: '10px 28px', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer', border: '1px solid #0a0a0a', background: (clientFastMode ? 'true' : 'false') === val ? '#0a0a0a' : '#fff', color: (clientFastMode ? 'true' : 'false') === val ? '#fff' : '#0a0a0a', marginRight: val === 'false' ? '-1px' : '0', transition: 'all 0.15s' }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '12px', color: '#888' }}>
              {clientFastMode ? 'Platformdaki AI özelliklerinin hızı artar, kalite biraz düşer.' : 'AI kalitesi artar, bekleme süreleri biraz artar.'}
            </div>
          </div>
        ) : <div />}
      </div>

      <PackageDetailModal isOpen={tierModalOpen} onClose={() => setTierModalOpen(false)} mode="tier" initialTab={customizationTier} />

      {upgradeStep === 'confirm' && nextTier && (
        <div onClick={() => setUpgradeStep(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', padding: '32px', maxWidth: '440px', width: '90%' }}>
            <div style={{ fontSize: '16px', fontWeight: '500', color: '#0a0a0a', marginBottom: '12px' }}>Paket Yükseltme</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              <span style={{ fontWeight: '500', color: '#0a0a0a' }}>{tierLabels[customizationTier] || 'BASIC'}</span> paketinden <span style={{ fontWeight: '500', color: '#0a0a0a' }}>{tierLabels[nextTier]}</span> pakete geçmek üzeresiniz. Talebiniz Dinamo ekibine iletilecek ve sizinle iletişime geçeceğiz.
            </div>
            <div style={{ marginBottom: '24px' }}>
              <span onClick={() => setUpgradeStep('content')} style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textDecoration: 'underline', cursor: 'pointer' }}>Yeni paketin içeriğini görüntüle</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setUpgradeStep(null)} className="btn btn-outline" style={{ flex: 1, padding: '10px', fontSize: '11px' }}>İPTAL</button>
              <button onClick={async () => {
                try {
                  const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
                  await supabase.from('demo_requests').insert({ name: `[YÜKSELTME → ${tierLabels[nextTier]}] ${companyName}`, company: companyName, email: user?.email || '', phone: '' })
                } catch (err) { console.error('[tier-upgrade] request failed:', err) }
                setUpgradeStep('success')
              }} className="btn" style={{ flex: 1, padding: '10px', fontSize: '11px' }}>YÜKSELT</button>
            </div>
          </div>
        </div>
      )}

      {upgradeStep === 'success' && (
        <div onClick={() => setUpgradeStep(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', padding: '32px', maxWidth: '400px', width: '90%' }}>
            <div style={{ fontSize: '16px', fontWeight: '500', color: '#0a0a0a', marginBottom: '12px' }}>Yükseltme Talebiniz Alındı</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>Dinamo ekibi en kısa sürede sizinle iletişime geçecek. Genellikle 1 iş günü içinde dönüş yapıyoruz.</div>
            <button onClick={() => setUpgradeStep(null)} className="btn" style={{ width: '100%', padding: '10px' }}>TAMAM</button>
          </div>
        </div>
      )}

      <PackageDetailModal isOpen={upgradeStep === 'content'} onClose={() => setUpgradeStep('confirm')} mode="tier" initialTab={nextTier || 'advanced'} />

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
              {brandVoices.male && <span style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: '#0a0a0a' }}>ERKEK: {cleanVoiceName(brandVoices.male.name)}</span>}
              {brandVoices.female && <span style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: '#0a0a0a' }}>KADIN: {cleanVoiceName(brandVoices.female.name)}</span>}
              {!brandVoices.male && !brandVoices.female && <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Henüz seçim yapılmadı.</span>}
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Henüz seçim yapılmadı.</div>
          )}
        </div>

        {/* PACKSHOT'LAR — read-only */}
        <div style={{ background: '#fff', border: '1px solid #e5e4db', padding: '22px 26px', marginBottom: '16px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: '500', marginBottom: '10px' }}>PACKSHOT'LAR</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {['9x16', '16x9', '1x1', '4x5', '2x3'].map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <span style={{ color: clientPackshots[k] ? '#22c55e' : '#ccc' }}>{clientPackshots[k] ? '✓' : '✗'}</span>
                <span style={{ color: clientPackshots[k] ? '#0a0a0a' : '#aaa' }}>{k.replace('x', ':')}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '11px', color: '#aaa' }}>Eksik boyutlar için iletişime geçin.</div>
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

        {/* Logo boyutu admin marka studyosundan yonetilir */}
      </div>

      {/* Divider + Files Header */}
      <div style={{ borderTop: '1px solid var(--color-border-tertiary)', paddingTop: '24px', marginTop: '8px', marginBottom: '20px' }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#0a0a0a' }}>Marka Dosyaları</div>
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
                    <button onClick={() => downloadFile(f.file_url, f.file_name || f.file_url.split('/').pop() || 'file')} className="btn btn-outline" style={{ padding: '3px 10px', fontSize: '9px' }}>İNDİR ↓</button>
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
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button onClick={() => loadVoices(true)} disabled={voicesLoading} title="Ses listesini yenile" style={{ width: '28px', height: '28px', border: '1px solid #e5e4db', background: '#fff', color: '#0a0a0a', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.3s' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg></button>
                <button onClick={() => setVoiceModalOpen(false)} style={{ width: '28px', height: '28px', border: '1px solid #e5e4db', background: '#fff', color: '#0a0a0a', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
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

      {/* Logo Size Modal kaldirildi — admin marka studyosundan yonetilir */}
        </div>
      </div>
    </div>
  )
}
