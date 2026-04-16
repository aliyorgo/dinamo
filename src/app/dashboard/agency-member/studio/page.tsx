'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string, string> = {
  draft: 'Taslak', submitted: 'Inceleniyor', in_production: 'Uretimde',
  revision: 'Revizyon', approved: 'Onaylandi', delivered: 'Teslim', cancelled: 'Iptal',
}
const statusColor: Record<string, string> = {
  draft: '#f59e0b', submitted: '#888', in_production: '#3b82f6',
  revision: '#ef4444', approved: '#22c55e', delivered: '#22c55e', cancelled: '#555',
}

export default function AgencyMemberStudio() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState('')
  const [agency, setAgency] = useState<any>(null)
  const [briefs, setBriefs] = useState<any[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: ud } = await supabase.from('users').select('name, role, agency_id').eq('id', user.id).single()
    if (!ud || ud.role !== 'agency_member' || !ud.agency_id) { router.push('/login'); return }
    setUserName(ud.name)
    setUserId(user.id)

    const [{ data: ag }, { data: br }] = await Promise.all([
      supabase.from('agencies').select('id, name, logo_url').eq('id', ud.agency_id).single(),
      supabase.from('briefs').select('id, campaign_name, client_name, status, video_type, created_at').eq('agency_member_id', user.id).order('created_at', { ascending: false }),
    ])
    setAgency(ag)
    setBriefs(br || [])
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0', fontFamily: 'var(--font-dm-sans),sans-serif' }}><div style={{ color: '#888', fontSize: '14px' }}>Yukleniyor...</div></div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "var(--font-dm-sans),'DM Sans',system-ui,sans-serif" }}>

      {/* SIDEBAR */}
      <div style={{ width: '240px', background: '#0A0A0A', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          {agency?.logo_url ? (
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', overflow: 'hidden' }}>
              <img src={agency.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
            </div>
          ) : (
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px', fontWeight: '500', color: '#fff' }}>{agency?.name?.charAt(0)?.toUpperCase() || 'A'}</span>
            </div>
          )}
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff', marginBottom: '2px' }}>{agency?.name || ''}</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{userName}</div>
        </div>
        <nav style={{ padding: '10px 8px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', marginBottom: '1px' }}>
            <span style={{ fontSize: '12px', color: '#fff', fontWeight: '500' }}>Islerim</span>
          </div>
        </nav>
        <div style={{ padding: '10px 8px' }}>
          <button onClick={() => router.push('/dashboard/agency-member/studio/new')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '9px 0', background: '#22c55e', color: '#111113', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
            <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span> Yeni Is Olustur
          </button>
        </div>
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} style={{ padding: '6px 8px', borderRadius: '7px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-dm-sans),sans-serif' }}>Cikis yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Islerim</div>
          {briefs.length > 0 && (
            <button onClick={() => router.push('/dashboard/agency-member/studio/new')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
              + Yeni Is
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
              Tum Isler ({briefs.length})
            </div>
            {briefs.length === 0 ? (
              <div style={{ padding: '60px 40px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '400', color: '#0a0a0a', marginBottom: '8px' }}>Henuz is olusturulmus</div>
                <div style={{ fontSize: '13px', color: '#888', marginBottom: '24px' }}>Soldaki butonla yeni is olusturun.</div>
              </div>
            ) : briefs.map((brief, i) => (
              <div key={brief.id} style={{ padding: '14px 20px', borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : 'none', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>
                    {brief.client_name ? `${brief.client_name} — ${brief.campaign_name}` : brief.campaign_name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{brief.video_type || '—'}</div>
                </div>
                <span style={{
                  fontSize: '10px', padding: '2px 8px', borderRadius: '100px', fontWeight: '500',
                  background: `${statusColor[brief.status] || '#888'}20`,
                  color: statusColor[brief.status] || '#888',
                }}>
                  {statusLabel[brief.status] || brief.status}
                </span>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                  {new Date(brief.created_at).toLocaleDateString('tr-TR')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
