'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { generateCertificatePDF, generateUgcCertificatePDF } from '@/lib/generate-certificate'
import { useClientContext } from '../layout'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function CertificatesPage() {
  const router = useRouter()
  const { userName, companyName, credits, customizationTier, clientId } = useClientContext()
  const [briefs, setBriefs] = useState<any[]>([])
  const [ugcVideos, setUgcVideos] = useState<any[]>([])
  const [legalName, setLegalName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!clientId) return
      const [{ data: b }, { data: ugc }, { data: cl }] = await Promise.all([
        supabase.from('briefs').select('*').eq('client_id', clientId).eq('status', 'delivered').order('created_at', { ascending: false }),
        supabase.from('ugc_videos').select('*, briefs!inner(campaign_name, client_id), personas(name)').eq('status', 'sold').eq('briefs.client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('clients').select('legal_name').eq('id', clientId).single(),
      ])
      setBriefs(b || [])
      setUgcVideos(ugc || [])
      setLegalName(cl?.legal_name || '')
      setLoading(false)
    }
    load()
  }, [clientId])

  function handleDownload(brief: any) {
    generateCertificatePDF(brief, companyName, legalName)
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
          <span style={{display:'inline-block',padding:'2px 8px',background:'rgba(29,184,29,0.15)',color:'#1db81d',fontSize:'9px',fontWeight:600,letterSpacing:'1px',marginBottom:'6px'}}>{customizationTier === 'corporate' ? 'KURUMSAL' : customizationTier === 'advanced' ? 'ADVANCED' : 'BASIC'}</span>
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
          {loading ? <div style={{ color: '#888', fontSize: '13px' }}>Yükleniyor...</div> : (briefs.length === 0 && ugcVideos.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#888', fontSize: '13px' }}>Henüz teslim edilen proje yok.</div>
          ) : (() => {
            const combined = [
              ...briefs.map(b => ({ type: 'express' as const, sortDate: b.updated_at || b.created_at, data: b })),
              ...ugcVideos.map((v: any) => ({ type: 'ugc' as const, sortDate: v.sold_at || v.created_at, data: v })),
            ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
            return (
            <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              {combined.map((item) => item.type === 'express' ? (
                <div key={`e-${item.data.id}`} style={{ padding: '10px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '500', color: '#0a0a0a' }}>{(() => { const name = item.data.campaign_name || ''; const match = name.match(/— Full AI #(\d+)$/); return match ? `${name.replace(/\s*— Full AI #\d+$/, '')} — V${match[1]}` : name })()}</span>
                      <span style={{ fontSize: '8px', padding: '1px 5px', background: '#f5f4f0', color: '#888', letterSpacing: '0.5px' }}>AI EXPRESS</span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#888', marginTop: '1px' }}>
                      {item.data.video_type} · {new Date(item.sortDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  <button onClick={() => handleDownload(item.data)}
                    style={{ padding: '6px 14px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', fontSize: '11px', color: '#0a0a0a', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 1h5l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="#0a0a0a" strokeWidth="1.2"/><path d="M9 1v4h4" stroke="#0a0a0a" strokeWidth="1.2"/></svg>
                    İndir
                  </button>
                </div>
              ) : (
                <div key={`u-${item.data.id}`} style={{ padding: '10px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '500', color: '#0a0a0a' }}>{item.data.briefs?.campaign_name || 'Persona Video'}{item.data.version ? ` — V${item.data.version}` : ''}</span>
                      <span style={{ fontSize: '8px', padding: '1px 5px', background: 'rgba(59,130,246,0.08)', color: '#3b82f6', letterSpacing: '0.5px' }}>PERSONA</span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#888', marginTop: '1px' }}>
                      {item.data.personas?.name || 'Persona'} · {new Date(item.sortDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  <button onClick={() => generateUgcCertificatePDF({ campaign_name: item.data.briefs?.campaign_name, id: item.data.brief_id }, companyName, item.data.personas?.name, legalName)}
                    style={{ padding: '6px 14px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', fontSize: '11px', color: '#0a0a0a', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 1h5l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="#0a0a0a" strokeWidth="1.2"/><path d="M9 1v4h4" stroke="#0a0a0a" strokeWidth="1.2"/></svg>
                    İndir
                  </button>
                </div>
              ))}
            </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
