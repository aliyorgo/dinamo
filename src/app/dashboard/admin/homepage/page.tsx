'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const NAV = [
  { label: 'Genel Bakış', href: '/dashboard/admin' },
  { label: 'Briefler', href: '/dashboard/admin/briefs' },
  { label: 'Kredi Yönetimi', href: '/dashboard/admin/credits' },
  { label: 'Müşteriler', href: '/dashboard/admin/clients' },
  { label: 'Kullanıcılar', href: '/dashboard/admin/users' },
  { label: 'Ajanslar', href: '/dashboard/admin/agencies' },
  { label: "Creator'lar", href: '/dashboard/admin/creators' },
  { label: 'Raporlar', href: '/dashboard/admin/reports' },
  { label: 'Ayarlar', href: '/dashboard/admin/settings' },
]

const CMS_FIELDS = [
  { key: 'hero_title', label: 'Hero Başlık', type: 'text', default: 'Brief yaz. 24 saatte video.' },
  { key: 'hero_subtitle', label: 'Hero Alt Başlık', type: 'text', default: '24 saat teslim — AI prodüksiyon' },
  { key: 'hero_desc', label: 'Hero Açıklama', type: 'textarea', default: "Brief'inizi yükleyin, 24 saat içinde videonuz hazır. Hızlı, brief'e sadık, insan kalitesinde AI video üretimi." },
  { key: 'step1_title', label: 'Adım 1 Başlık', type: 'text', default: "Brief'inizi girin" },
  { key: 'step1_desc', label: 'Adım 1 Açıklama', type: 'textarea', default: 'Kampanya hedefinizi, mesajınızı ve video tipini belirleyin.' },
  { key: 'step2_title', label: 'Adım 2 Başlık', type: 'text', default: 'Prodüktörümüz inceliyor' },
  { key: 'step2_desc', label: 'Adım 2 Açıklama', type: 'textarea', default: "Brief'inizi değerlendiriyor, gerekirse onay veya ek bilgi talep ediyoruz." },
  { key: 'step3_title', label: 'Adım 3 Başlık', type: 'text', default: '24 saat içinde teslim' },
  { key: 'step3_desc', label: 'Adım 3 Açıklama', type: 'textarea', default: 'Videonuz üretilir, prodüktör onayından geçer ve hesabınıza iletilir.' },
  { key: 'step4_title', label: 'Adım 4 Başlık', type: 'text', default: 'Revizyon hakkınız var' },
  { key: 'step4_desc', label: 'Adım 4 Açıklama', type: 'textarea', default: 'Her videoya bir revizyon hakkı tanınır, ek ücret alınmaz.' },
  { key: 'cta_title', label: 'CTA Başlık', type: 'text', default: 'Hemen başlayın.' },
  { key: 'cta_button', label: 'CTA Buton Metni', type: 'text', default: 'Demo hesap talep edin →' },
  { key: 'footer_text', label: 'Footer Metin', type: 'text', default: 'Dinamo — Powered by DCC FILM' },
]

export default function HomepageAdmin() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [videos, setVideos] = useState<any[]>([])
  const [hvTitle, setHvTitle] = useState('')
  const [hvUploading, setHvUploading] = useState(false)
  const hvFileRef = useRef<HTMLInputElement>(null)
  const [cms, setCms] = useState<Record<string, string>>({})
  const [cmsEdits, setCmsEdits] = useState<Record<string, string>>({})
  const [logoUrl, setLogoUrl] = useState('')
  const logoFileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: ud } = await supabase.from('users').select('name, role').eq('id', user.id).single()
    if (!ud || ud.role !== 'admin') { router.push('/login'); return }
    setUserName(ud.name)
    const { data: hv } = await supabase.from('homepage_videos').select('*').order('created_at', { ascending: false })
    setVideos(hv || [])
    const { data: content } = await supabase.from('cms_content').select('*')
    const map: Record<string, string> = {}
    content?.forEach((c: any) => { map[c.key] = c.value })
    setCms(map)
    setCmsEdits(map)
    if (map['logo_url']) setLogoUrl(map['logo_url'])
    setLoading(false)
  }

  async function handleHvUpload() {
    const file = hvFileRef.current?.files?.[0]
    if (!file || !hvTitle.trim()) return
    setHvUploading(true)
    const ext = file.name.split('.').pop() || 'mp4'
    const path = `${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('homepage-videos').upload(path, file)
    if (upErr) { setHvUploading(false); return }
    const { data: urlData } = supabase.storage.from('homepage-videos').getPublicUrl(path)
    await supabase.from('homepage_videos').insert({ title: hvTitle, video_url: urlData.publicUrl, is_active: true })
    setHvTitle('')
    if (hvFileRef.current) hvFileRef.current.value = ''
    setHvUploading(false)
    load()
  }

  async function toggleHv(id: string, active: boolean) {
    await supabase.from('homepage_videos').update({ is_active: !active }).eq('id', id)
    setVideos(prev => prev.map(v => v.id === id ? { ...v, is_active: !active } : v))
  }

  async function deleteHv(id: string) {
    if (!confirm('Bu videoyu silmek istediğinizden emin misiniz?')) return
    await supabase.from('homepage_videos').delete().eq('id', id)
    setVideos(prev => prev.filter(v => v.id !== id))
  }

  async function saveCms(key: string) {
    const value = cmsEdits[key] || ''
    const { data: existing } = await supabase.from('cms_content').select('id').eq('key', key).maybeSingle()
    if (existing) await supabase.from('cms_content').update({ value }).eq('key', key)
    else await supabase.from('cms_content').insert({ key, value })
    setCms(prev => ({ ...prev, [key]: value }))
    setMsg('Kaydedildi.')
    setTimeout(() => setMsg(''), 2000)
  }

  async function handleLogoUpload() {
    const file = logoFileRef.current?.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop() || 'png'
    const path = `logo_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('brand-assets').upload(path, file)
    if (error) return
    const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
    const url = urlData.publicUrl
    setLogoUrl(url)
    // Save to cms_content
    const { data: existing } = await supabase.from('cms_content').select('id').eq('key', 'logo_url').maybeSingle()
    if (existing) await supabase.from('cms_content').update({ value: url }).eq('key', 'logo_url')
    else await supabase.from('cms_content').insert({ key: 'logo_url', value: url })
    setMsg('Logo güncellendi.')
    setTimeout(() => setMsg(''), 2000)
  }

  async function handleLogout() { await supabase.auth.signOut(); router.push('/login') }

  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 13px', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '8px', fontSize: '13px', color: '#0a0a0a', fontFamily: 'var(--font-dm-sans),sans-serif', outline: 'none' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "var(--font-dm-sans),'DM Sans',system-ui,sans-serif" }}>

      <div className="dinamo-sidebar" style={{ width: '240px', background: '#0A0A0A', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#fff', letterSpacing: '-0.5px', marginBottom: '12px' }}>
            <img src="/dinamo_logo.png" alt="Dinamo" style={{ height: '28px' }} />
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '3px' }}>Admin</div>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff' }}>{userName}</div>
        </div>
        <nav style={{ padding: '10px 8px', flex: 1 }}>
          {NAV.map(item => (
            <div key={item.href} onClick={()=>router.push(item.href)} className={`dinamo-nav-link${item.href==='/dashboard/admin/homepage'?' active':''}`}>{item.label}</div>
          ))}
        </nav>
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} className="dinamo-signout">Çıkış Yap</button>
        </div>
      </div>

      <div className="dinamo-main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Ana Sayfa Yönetimi</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {loading ? <div style={{ color: '#888', fontSize: '14px' }}>Yükleniyor...</div> : (
            <>
              {msg && <div style={{ padding: '10px 16px', background: '#e8f7e8', borderRadius: '8px', fontSize: '12px', color: '#22c55e', marginBottom: '16px' }}>{msg}</div>}

              {/* VIDEOLAR */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
                <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>Videolar</div>
                <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input value={hvTitle} onChange={e => setHvTitle(e.target.value)} placeholder="Video başlığı" style={{ ...inputStyle, width: '180px' }} />
                    <input ref={hvFileRef} type="file" accept="video/*" style={{ fontSize: '12px', color: '#0a0a0a', flex: 1, minWidth: '150px' }} />
                    <button onClick={handleHvUpload} disabled={hvUploading || !hvTitle.trim()} style={{ padding: '8px 16px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif', fontWeight: '500', opacity: hvUploading || !hvTitle.trim() ? 0.4 : 1 }}>
                      {hvUploading ? 'Yükleniyor...' : 'Yükle'}
                    </button>
                  </div>
                </div>
                {videos.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontSize: '13px' }}>Henüz video yok.</div>
                ) : videos.map((v, i) => (
                  <div key={v.id} style={{ padding: '12px 20px', borderBottom: i < videos.length - 1 ? '0.5px solid rgba(0,0,0,0.06)' : 'none', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <video src={v.video_url} style={{ width: '60px', height: '80px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} muted preload="metadata" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{v.title}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{new Date(v.created_at).toLocaleDateString('tr-TR')}</div>
                    </div>
                    <span onClick={() => toggleHv(v.id, v.is_active)} style={{ fontSize: '10px', padding: '4px 12px', borderRadius: '100px', cursor: 'pointer', background: v.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(0,0,0,0.05)', color: v.is_active ? '#22c55e' : '#888', fontWeight: '500' }}>
                      {v.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                    <button onClick={() => deleteHv(v.id)} style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>Sil</button>
                  </div>
                ))}
              </div>

              {/* METİNLER */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
                <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>Metinler</div>
                {CMS_FIELDS.map((field, i) => (
                  <div key={field.key} style={{ padding: '14px 20px', borderBottom: i < CMS_FIELDS.length - 1 ? '0.5px solid rgba(0,0,0,0.06)' : 'none' }}>
                    <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{field.label}</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      {field.type === 'textarea' ? (
                        <textarea value={cmsEdits[field.key] ?? field.default} onChange={e => setCmsEdits({ ...cmsEdits, [field.key]: e.target.value })} rows={2} style={{ ...inputStyle, flex: 1, resize: 'vertical' }} />
                      ) : (
                        <input value={cmsEdits[field.key] ?? field.default} onChange={e => setCmsEdits({ ...cmsEdits, [field.key]: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                      )}
                      <button onClick={() => saveCms(field.key)} style={{ padding: '8px 14px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif', whiteSpace: 'nowrap', marginTop: '1px' }}>Kaydet</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* LOGO */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>Logo</div>
                <div style={{ padding: '20px' }}>
                  {logoUrl && (
                    <div style={{ marginBottom: '16px', padding: '16px', background: '#0a0a0a', borderRadius: '10px', display: 'inline-block' }}>
                      <img src={logoUrl} alt="Logo" style={{ maxHeight: '48px', display: 'block' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input ref={logoFileRef} type="file" accept="image/svg+xml,image/png" style={{ fontSize: '12px', color: '#0a0a0a' }} />
                    <button onClick={handleLogoUpload} style={{ padding: '8px 16px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif', fontWeight: '500' }}>Logo Yükle</button>
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '8px' }}>SVG veya PNG format, şeffaf arka plan önerilir.</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
