'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { generateCertificatePDF } from '@/lib/generate-certificate'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function CertificatesPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [credits, setCredits] = useState(0)
  const [briefs, setBriefs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'client') { router.push('/login'); return }
      setUserName(userData.name)
      const { data: cu } = await supabase.from('client_users').select('allocated_credits, client_id, clients(company_name)').eq('user_id', user.id).single()
      if (cu) {
        setCredits(cu.allocated_credits)
        setCompanyName((cu as any).clients?.company_name || '')
        const { data: b } = await supabase.from('briefs').select('*').eq('client_id', cu.client_id).eq('status', 'delivered').order('created_at', { ascending: false })
        setBriefs(b || [])
      }
      setLoading(false)
    }
    load()
  }, [router])

  function handleDownload(brief: any) {
    generateCertificatePDF(brief, companyName)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "var(--font-dm-sans),'DM Sans',system-ui,sans-serif", background: '#f5f4f0' }}>

      {/* SIDEBAR */}
      <div style={{ width: '240px', background: '#0A0A0A', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#fff', letterSpacing: '-0.5px', marginBottom: '12px' }}>
            <img src="/dinamo_logo_siyah.png" alt="Dinamo" style={{ height: '28px' }} />
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '3px' }}>{companyName}</div>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff' }}>{userName}</div>
        </div>
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '4px' }}>Kredi Bakiyesi</div>
          <div style={{ fontSize: '24px', fontWeight: '300', color: '#fff', letterSpacing: '-1px' }}>{credits}</div>
        </div>
        <nav style={{ padding: '10px 8px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          {[
            { label: 'Projelerim', href: '/dashboard/client', active: false },
            { label: 'Yeni Brief', href: '/dashboard/client/brief/new', active: false },
            { label: 'Marka Paketi', href: '/dashboard/client/brand', active: false },
            { label: 'Raporlar', href: '/dashboard/client/reports', active: false },
            { label: 'Telif Belgeleri', href: '/dashboard/client/certificates', active: true },
            { label: 'İçerik Güvencesi', href: '/dashboard/client/guarantee', active: false },
          ].map(item => (
            <div key={item.href} onClick={() => router.push(item.href)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: item.active ? 'rgba(255,255,255,0.08)' : 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '12px', color: item.active ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: item.active ? '500' : '400' }}>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{ flex: 1 }}></div>
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 8px', borderRadius: '7px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-dm-sans),sans-serif' }}>Çıkış yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Telif Belgeleri</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <div onClick={() => router.push('/dashboard/client/guarantee')} style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '10px', padding: '12px 18px', marginBottom: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#0a0a0a' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              Tüm içeriklerimiz Dinamo İçerik Güvencesi kapsamındadır.
            </div>
            <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: '500' }}>Güvenceyi Görüntüle →</div>
          </div>
          {loading ? <div style={{ color: '#888', fontSize: '14px' }}>Yükleniyor...</div> : briefs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#888', fontSize: '14px' }}>Henüz teslim edilen proje yok.</div>
          ) : (
            <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
              {briefs.map((b, i) => (
                <div key={b.id} style={{ padding: '16px 20px', borderBottom: i < briefs.length - 1 ? '0.5px solid rgba(0,0,0,0.06)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>{b.campaign_name}</div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>
                      {b.video_type} · {new Date(b.updated_at || b.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  <button onClick={() => handleDownload(b)}
                    style={{ padding: '8px 16px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '8px', fontSize: '12px', color: '#0a0a0a', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.3)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)')}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 1h5l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="#0a0a0a" strokeWidth="1.2"/><path d="M9 1v4h4" stroke="#0a0a0a" strokeWidth="1.2"/></svg>
                    Sertifika Indir
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
