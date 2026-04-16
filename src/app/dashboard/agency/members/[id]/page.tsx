'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const CREDIT_TL = 3000
const statusLabel: Record<string, string> = {
  draft: 'Taslak', submitted: 'Gonderildi', in_production: 'Uretimde',
  revision: 'Revizyon', approved: 'Onaylandi', delivered: 'Teslim', cancelled: 'Iptal',
}
const statusColor: Record<string, string> = {
  draft: '#f59e0b', submitted: '#888', in_production: '#3b82f6',
  revision: '#ef4444', approved: '#22c55e', delivered: '#22c55e', cancelled: '#555',
}

export default function AgencyMemberDetailPage() {
  const router = useRouter()
  const params = useParams()
  const memberId = params.id as string

  const [loading, setLoading] = useState(true)
  const [agency, setAgency] = useState<any>(null)
  const [member, setMember] = useState<any>(null)
  const [briefs, setBriefs] = useState<any[]>([])

  useEffect(() => { load() }, [memberId])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: ud } = await supabase.from('users').select('name, role, agency_id').eq('id', user.id).single()
    if (!ud || ud.role !== 'agency' || !ud.agency_id) { router.push('/login'); return }

    const [{ data: ag }, { data: mb }, { data: br }] = await Promise.all([
      supabase.from('agencies').select('id, name, logo_url').eq('id', ud.agency_id).single(),
      supabase.from('users').select('*').eq('id', memberId).eq('agency_id', ud.agency_id).single(),
      supabase.from('briefs').select('id, campaign_name, client_name, video_type, credit_cost, sale_price, status, created_at').eq('agency_member_id', memberId).order('created_at', { ascending: false }),
    ])
    if (!mb) { router.push('/dashboard/agency/members'); return }
    setAgency(ag)
    setMember(mb)
    setBriefs(br || [])
    setLoading(false)
  }

  function formatTL(n: number) { return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TL' }

  const totalCredits = briefs.reduce((s, b) => s + Number(b.credit_cost || 0), 0)
  const totalSales = briefs.reduce((s, b) => s + Number(b.sale_price || 0), 0)

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0', fontFamily: 'var(--font-dm-sans),sans-serif' }}><div style={{ color: '#888', fontSize: '14px' }}>Yukleniyor...</div></div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "var(--font-dm-sans),'DM Sans',system-ui,sans-serif" }}>

      {/* SIDEBAR - minimal */}
      <div style={{ width: '240px', background: '#0A0A0A', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff', marginBottom: '2px' }}>{agency?.name || ''}</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Ajans Paneli</div>
        </div>
        <nav style={{ padding: '10px 8px', flex: 1 }}>
          <div onClick={() => router.push('/dashboard/agency/members')}
            style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.08)', marginBottom: '1px' }}>
            <span style={{ fontSize: '12px', color: '#fff', fontWeight: '500' }}>Uyeler</span>
          </div>
        </nav>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button onClick={() => router.push('/dashboard/agency/members')} style={{ fontSize: '12px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontFamily: 'var(--font-dm-sans),sans-serif' }}>Uyeler</button>
          <span style={{ color: '#ddd' }}>/</span>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>{member?.name}</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {/* STATS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Toplam Is', value: String(briefs.length) },
              { label: 'Harcanan Kredi', value: `${totalCredits} kr` },
              { label: 'Satis Geliri', value: formatTL(totalSales), color: '#22c55e' },
              { label: 'E-posta', value: member?.email || '\u2014' },
            ].map(c => (
              <div key={c.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{c.label}</div>
                <div style={{ fontSize: '20px', fontWeight: '300', color: c.color || '#0a0a0a', letterSpacing: '-0.5px' }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* BRIEFS LIST */}
          <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
              Isler ({briefs.length})
            </div>
            {briefs.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>Is yok.</div>
            ) : briefs.map((b, i) => {
              const sc = statusColor[b.status] || '#888'
              return (
                <div key={b.id} style={{ padding: '12px 20px', borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{b.campaign_name}</div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                      {b.client_name || '\u2014'} \u00b7 {b.credit_cost || 0} kr
                      {b.sale_price ? ` \u00b7 ${formatTL(Number(b.sale_price))}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', fontWeight: '500', background: `${sc}15`, color: sc }}>
                    {statusLabel[b.status] || b.status}
                  </span>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>{b.created_at ? new Date(b.created_at).toLocaleDateString('tr-TR') : ''}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
