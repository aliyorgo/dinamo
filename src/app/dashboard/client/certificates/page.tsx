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
    <div style={{ display: 'flex', minHeight: '100vh',  background: '#f5f4f0' }}>

      {/* SIDEBAR */}
      <div style={{ width: '240px', background: '#0A0A0A', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100dvh', overflowY: 'auto' }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', cursor: 'pointer' }} onClick={() => router.push('/dashboard/client')}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{height:'28px'}} />
        </div>
        <div style={{margin:'12px 12px',padding:'16px 20px',background:'rgba(29,184,29,0.06)',borderLeft:'3px solid #1DB81D'}}>
          <div style={{fontSize:'18px',fontWeight:'700',color:'#fff',marginBottom:'2px'}}>{companyName || 'Dinamo'}</div>
          <div style={{fontSize:'13px',fontWeight:'400',color:'#888',marginBottom:'12px'}}>{userName}</div>
          <div style={{fontSize:'10px',color:'#AAA',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'8px'}}>KREDİ BAKİYESİ</div>
          <div style={{fontSize:'28px',fontWeight:'700',color:'#1DB81D',letterSpacing:'-1px'}}>{credits}</div>
        </div>
        <nav style={{ padding: '10px 8px' }}>
          {[
            { label: 'Projelerim', href: '/dashboard/client', active: false },
            { label: 'Yeni Brief', href: '/dashboard/client/brief/new', active: false },
            { label: 'Marka Ayarları', href: '/dashboard/client/brand-identity', active: false },
            { label: 'Raporlar', href: '/dashboard/client/reports', active: false },
            { label: 'Telif Belgeleri', href: '/dashboard/client/certificates', active: true },
            { label: 'İçerik Güvencesi', href: '/dashboard/client/guarantee', active: false },
          ].map(item => (
            <div key={item.href} onClick={() => router.push(item.href)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: item.active ? 'rgba(255,255,255,0.08)' : 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: item.active ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: '500' }}>{item.label}</span>
            </div>
          ))}
          <button onClick={handleLogout}
            onMouseEnter={e=>{(e.currentTarget.firstChild as HTMLElement).style.color='#FF4444'}}
            onMouseLeave={e=>{(e.currentTarget.firstChild as HTMLElement).style.color='#aaa'}}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 8px', marginTop: '16px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: '#aaa',  transition: 'color 0.15s' }}>Çıkış yap</span>
          </button>
          <img src='/powered_by_dcc.png' alt='Powered by DCC' style={{height:'20px',width:'auto',opacity:0.6,display:'block',margin:'8px 8px',cursor:'pointer'}} onClick={()=>window.open('https://dirtycheapcreative.com','_blank')} />
        </nav>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Telif Belgeleri</div>
        </div>

        <div style={{ flex: 1, padding: '24px 28px' }}>
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
                    style={{ padding: '8px 16px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '8px', fontSize: '12px', color: '#0a0a0a', cursor: 'pointer',  fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px', transition: 'border-color 0.2s' }}
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
