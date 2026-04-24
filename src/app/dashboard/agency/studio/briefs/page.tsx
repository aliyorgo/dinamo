'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const AGENCY_NAV = [
  { label: 'Genel Bakis', href: '/dashboard/agency/overview' },
  { label: 'Musteriler', href: '/dashboard/agency/clients' },
  { label: 'Briefler', href: '/dashboard/agency/studio/briefs' },
  { label: 'Krediler', href: '/dashboard/agency/studio/credits' },
  { label: 'Uyeler', href: '/dashboard/agency/members' },
  { label: 'Uretim Raporu', href: '/dashboard/agency/production' },
  { label: 'Kazanclar', href: '/dashboard/agency/earnings' },
]

const statusLabel: Record<string, string> = {
  draft: 'Taslak', submitted: 'İnceleniyor', read: 'İncelendi',
  in_production: 'Üretimde', revision: 'Revizyon',
  approved: 'Onay Bekliyor', delivered: 'Teslim Edildi', cancelled: 'İptal Edildi',
}
const statusColor: Record<string, string> = {
  draft: '#f59e0b', submitted: '#888', read: '#888', in_production: '#3b82f6',
  revision: '#ef4444', approved: '#f59e0b', delivered: '#22c55e', cancelled: '#555',
}

export default function AgencyBriefsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [agency, setAgency] = useState<any>(null)
  const [userName, setUserName] = useState('')
  const [briefs, setBriefs] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: ud } = await supabase.from('users').select('name, role, agency_id').eq('id', user.id).single()
    if (!ud || ud.role !== 'agency' || !ud.agency_id) { router.push('/login'); return }

    setUserName(ud.name)

    const [{ data: ag }, { data: br }, { data: mb }] = await Promise.all([
      supabase.from('agencies').select('id, name, logo_url, demo_credits, total_earnings').eq('id', ud.agency_id).single(),
      supabase.from('briefs').select('id, campaign_name, client_name, agency_member_id, credit_cost, status, video_type, format, created_at').eq('agency_id', ud.agency_id).order('created_at', { ascending: false }),
      supabase.from('users').select('id, name').eq('agency_id', ud.agency_id).eq('role', 'agency_member'),
    ])

    setAgency(ag)
    setBriefs(br || [])
    setMembers(mb || [])
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh',  }}>

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
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Ajans Paneli</div>
        </div>
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{userName}</div>
        </div>
        <nav style={{ padding: '10px 8px', flex: 1 }}>
          {AGENCY_NAV.map(item => (
            <div key={item.href} onClick={() => router.push(item.href)}
              style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: item.href === '/dashboard/agency/studio/briefs' ? 'rgba(255,255,255,0.08)' : 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '12px', color: item.href === '/dashboard/agency/studio/briefs' ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: item.href === '/dashboard/agency/studio/briefs' ? '500' : '400' }}>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{ padding: '10px 8px' }}>
          <button onClick={() => router.push('/dashboard/agency/studio/briefs/new')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '9px 0', background: '#22c55e', color: '#111113', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',  }}>
            <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span> Brief Olustur
          </button>
        </div>
        <div onClick={() => router.push('/dashboard/agency/studio/credits')} style={{ padding: '10px 12px', margin: '0 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Kredi</span>
            <span style={{ fontSize: '12px', fontWeight: '500', color: '#22c55e' }}>{agency?.demo_credits || 0} kr</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Kazanc</span>
            <span style={{ fontSize: '11px', color: '#888' }}>{Number(agency?.total_earnings || 0).toLocaleString('tr-TR')} TL</span>
          </div>
        </div>
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} style={{ padding: '6px 8px', borderRadius: '7px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)',  }}>Çıkış yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Briefler</div>
          {briefs.length > 0 && (
            <button onClick={() => router.push('/dashboard/agency/studio/briefs/new')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer',  }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/></svg>
              Yeni Brief
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#888', fontSize: '14px' }}>Yükleniyor...</div>
          </div>
        ) : (
          <div style={{ flex: 1, padding: '24px 28px' }}>
            {briefs.length === 0 ? (
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '60px 40px', textAlign: 'center' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#111113', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"/></svg>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '400', color: '#0a0a0a', marginBottom: '8px' }}>Henuz brief yok</div>
                  <div style={{ fontSize: '13px', color: '#888' }}>Soldaki <strong style={{ color: '#22c55e' }}>+ Brief Olustur</strong> butonuyla baslayin.</div>
                </div>
              </div>
            ) : (() => {
              const CREDIT_TL = 3000
              const memberMap: Record<string, string> = {}
              members.forEach(m => { memberMap[m.id] = m.name })

              const groups: { id: string; name: string; briefs: any[]; lastDate: string }[] = []
              const memberIds = new Set<string>()
              const agencyBriefs: any[] = []

              briefs.forEach(b => {
                if (b.agency_member_id) memberIds.add(b.agency_member_id)
                else agencyBriefs.push(b)
              })

              memberIds.forEach(mid => {
                const mBriefs = briefs.filter(b => b.agency_member_id === mid)
                groups.push({ id: mid, name: memberMap[mid] || 'Uye', briefs: mBriefs, lastDate: mBriefs[0]?.created_at || '' })
              })
              groups.sort((a, b) => b.lastDate.localeCompare(a.lastDate))
              if (agencyBriefs.length > 0) groups.push({ id: '_agency', name: 'Ajans', briefs: agencyBriefs, lastDate: agencyBriefs[0]?.created_at || '' })

              return groups.map(group => (
                <div key={group.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                  <div style={{ padding: '12px 20px', background: '#0a0a0a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: group.id === '_agency' ? '#111' : '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: group.id === '_agency' ? '1px solid rgba(255,255,255,0.15)' : 'none' }}>
                      <span style={{ fontSize: '10px', fontWeight: '500', color: '#fff' }}>{group.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: '#fff', flex: 1 }}>{group.name}</span>
                    <span style={{ fontSize: '10px', fontWeight: '600', color: '#22c55e', background: 'rgba(34,197,94,0.15)', padding: '2px 8px', borderRadius: '100px' }}>{group.briefs.length}</span>
                  </div>
                  {group.briefs.map((brief: any, i: number) => {
                    const cost = Number(brief.credit_cost || 0) * CREDIT_TL
                    return (
                      <div key={brief.id}
                        onClick={() => router.push(`/dashboard/agency/studio/briefs/${brief.id}`)}
                        style={{ padding: '12px 20px', borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : 'none', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>
                            {brief.client_name ? `${brief.client_name} — ${brief.campaign_name}` : brief.campaign_name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                            {brief.video_type || ''}{brief.format ? ` · ${brief.format}` : ''}
                          </div>
                        </div>
                        <div style={{ fontSize: '11px', color: '#0a0a0a', flexShrink: 0, textAlign: 'right', minWidth: '60px' }}>
                          {brief.credit_cost || 0} kr
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>{cost > 0 ? `${cost.toLocaleString('tr-TR')} TL` : ''}</div>
                        </div>
                        <span style={{
                          fontSize: '10px', padding: '2px 8px', borderRadius: '100px', fontWeight: '500',
                          background: `${statusColor[brief.status] || '#888'}20`,
                          color: statusColor[brief.status] || '#888', flexShrink: 0,
                        }}>
                          {statusLabel[brief.status] || brief.status}
                        </span>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', flexShrink: 0, minWidth: '65px', textAlign: 'right' }}>
                          {new Date(brief.created_at).toLocaleDateString('tr-TR')}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
