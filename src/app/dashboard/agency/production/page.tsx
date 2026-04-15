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

const CREDIT_TL = 3000
const statusLabel: Record<string, string> = {
  draft: 'Taslak', submitted: 'Gonderildi', in_production: 'Uretimde',
  revision: 'Revizyon', approved: 'Onaylandi', delivered: 'Teslim', cancelled: 'Iptal',
}

export default function AgencyProductionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [agency, setAgency] = useState<any>(null)
  const [userName, setUserName] = useState('')
  const [briefs, setBriefs] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [filterMember, setFilterMember] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [editingSalePrice, setEditingSalePrice] = useState<string | null>(null)
  const [salePriceInput, setSalePriceInput] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: ud } = await supabase.from('users').select('name, role, agency_id').eq('id', user.id).single()
    if (!ud || ud.role !== 'agency' || !ud.agency_id) { router.push('/login'); return }
    setUserName(ud.name)

    const [{ data: ag }, { data: br }, { data: mb }, { data: cls }] = await Promise.all([
      supabase.from('agencies').select('*').eq('id', ud.agency_id).single(),
      supabase.from('briefs').select('id, campaign_name, client_name, client_id, agency_member_id, video_type, credit_cost, sale_price, status, created_at').eq('agency_id', ud.agency_id).order('created_at', { ascending: false }),
      supabase.from('users').select('id, name').eq('agency_id', ud.agency_id).eq('role', 'agency_member'),
      supabase.from('clients').select('id, company_name').eq('agency_id', ud.agency_id),
    ])
    setAgency(ag)
    setBriefs(br || [])
    setMembers(mb || [])
    setClients(cls || [])
    setLoading(false)
  }

  async function saveSalePrice(briefId: string) {
    const price = parseFloat(salePriceInput)
    if (isNaN(price)) return
    await supabase.from('briefs').update({ sale_price: price }).eq('id', briefId)
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, sale_price: price } : b))
    setEditingSalePrice(null)
  }

  async function handleLogout() { await supabase.auth.signOut(); router.push('/login') }

  function formatTL(n: number) { return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TL' }

  const filtered = briefs.filter(b => {
    if (filterMember && b.agency_member_id !== filterMember) return false
    if (filterClient && b.client_id !== filterClient) return false
    return true
  })

  const totalCredits = filtered.reduce((s, b) => s + Number(b.credit_cost || 0), 0)
  const totalCost = totalCredits * CREDIT_TL
  const totalSales = filtered.reduce((s, b) => s + Number(b.sale_price || 0), 0)
  const totalMargin = totalSales - totalCost

  const memberMap: Record<string, string> = {}
  members.forEach(m => { memberMap[m.id] = m.name })
  const clientMap: Record<string, string> = {}
  clients.forEach(c => { clientMap[c.id] = c.company_name })

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0', fontFamily: 'var(--font-dm-sans),sans-serif' }}><div style={{ color: '#888', fontSize: '14px' }}>Yukleniyor...</div></div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "var(--font-dm-sans),'DM Sans',system-ui,sans-serif" }}>

      {/* SIDEBAR */}
      <div style={{ width: '220px', background: '#111113', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff', marginBottom: '2px' }}>{agency?.name || ''}</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Ajans Paneli</div>
        </div>
        <nav style={{ padding: '10px 8px', flex: 1 }}>
          {AGENCY_NAV.map(item => (
            <div key={item.href} onClick={() => router.push(item.href)}
              style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: item.href === '/dashboard/agency/production' ? 'rgba(255,255,255,0.08)' : 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '12px', color: item.href === '/dashboard/agency/production' ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: item.href === '/dashboard/agency/production' ? '500' : '400' }}>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} style={{ padding: '6px 8px', borderRadius: '7px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-dm-sans),sans-serif' }}>Cikis yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Uretim Raporu</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {/* SUMMARY CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Toplam Is', value: String(filtered.length), color: '#0a0a0a' },
              { label: 'Kredi Harcamasi', value: `${totalCredits} kr`, color: '#0a0a0a' },
              { label: 'Satis Geliri', value: formatTL(totalSales), color: '#22c55e' },
              { label: 'Marj', value: formatTL(totalMargin), color: totalMargin >= 0 ? '#22c55e' : '#ef4444' },
            ].map(c => (
              <div key={c.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{c.label}</div>
                <div style={{ fontSize: '24px', fontWeight: '300', color: c.color, letterSpacing: '-0.5px' }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* FILTERS */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <select value={filterMember} onChange={e => setFilterMember(e.target.value)}
              style={{ padding: '7px 12px', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '8px', fontSize: '12px', background: '#fff', fontFamily: 'var(--font-dm-sans),sans-serif', cursor: 'pointer' }}>
              <option value="">Tum Uyeler</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
              style={{ padding: '7px 12px', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '8px', fontSize: '12px', background: '#fff', fontFamily: 'var(--font-dm-sans),sans-serif', cursor: 'pointer' }}>
              <option value="">Tum Musteriler</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>

          {/* GROUPED BY MEMBER */}
          {(() => {
            // Group briefs by member
            const groups: { id: string; name: string; briefs: any[]; lastDate: string }[] = []
            const memberIds = new Set<string>()
            const agencyBriefs: any[] = []

            filtered.forEach(b => {
              if (b.agency_member_id) {
                memberIds.add(b.agency_member_id)
              } else {
                agencyBriefs.push(b)
              }
            })

            memberIds.forEach(mid => {
              const mBriefs = filtered.filter(b => b.agency_member_id === mid)
              const last = mBriefs[0]?.created_at || ''
              groups.push({ id: mid, name: memberMap[mid] || 'Uye', briefs: mBriefs, lastDate: last })
            })

            // Sort by last activity (most recent first)
            groups.sort((a, b) => b.lastDate.localeCompare(a.lastDate))

            // Add agency group if any
            if (agencyBriefs.length > 0) {
              groups.push({ id: '_agency', name: 'Ajans', briefs: agencyBriefs, lastDate: agencyBriefs[0]?.created_at || '' })
            }

            if (groups.length === 0) return <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#aaa', fontSize: '12px' }}>Kayit yok.</div>

            return groups.map(group => {
              const groupCredits = group.briefs.reduce((s: number, b: any) => s + Number(b.credit_cost || 0), 0)
              return (
                <div key={group.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                  <div style={{ padding: '12px 20px', background: '#0a0a0a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: group.id === '_agency' ? '#111113' : '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: group.id === '_agency' ? '1px solid rgba(255,255,255,0.15)' : 'none' }}>
                      <span style={{ fontSize: '11px', fontWeight: '500', color: '#fff' }}>{group.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#fff', flex: 1 }}>{group.name}</span>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{group.briefs.length} is</span>
                    <span style={{ fontSize: '10px', color: '#22c55e' }}>{groupCredits} kr</span>
                  </div>
                  {group.briefs.map((b: any, i: number) => {
                    const cost = Number(b.credit_cost || 0) * CREDIT_TL
                    const sale = Number(b.sale_price || 0)
                    const margin = sale - cost
                    const sl = statusLabel[b.status] || b.status
                    return (
                      <div key={b.id} style={{ padding: '10px 20px', borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.04)' : 'none', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                        <div style={{ width: '70px', color: '#888', flexShrink: 0 }}>{b.created_at ? new Date(b.created_at).toLocaleDateString('tr-TR') : '—'}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '500', color: '#0a0a0a' }}>{b.campaign_name}</div>
                          <div style={{ fontSize: '11px', color: '#888', marginTop: '1px' }}>
                            {b.client_name || (b.client_id ? clientMap[b.client_id] : '')}
                            {b.video_type ? ` · ${b.video_type}` : ''}
                          </div>
                        </div>
                        <div style={{ width: '50px', textAlign: 'right', flexShrink: 0 }}>{b.credit_cost || 0} kr</div>
                        <div style={{ width: '90px', textAlign: 'right', flexShrink: 0 }}>
                          {editingSalePrice === b.id ? (
                            <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end' }}>
                              <input type="number" value={salePriceInput} onChange={e => setSalePriceInput(e.target.value)} autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') saveSalePrice(b.id); if (e.key === 'Escape') setEditingSalePrice(null) }}
                                style={{ width: '60px', padding: '2px 4px', border: '1px solid rgba(0,0,0,0.15)', borderRadius: '4px', fontSize: '11px', outline: 'none' }} />
                              <button onClick={() => saveSalePrice(b.id)} style={{ padding: '2px 5px', background: '#111', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '9px', cursor: 'pointer' }}>OK</button>
                            </div>
                          ) : (
                            <span onClick={() => { setEditingSalePrice(b.id); setSalePriceInput(String(b.sale_price || '')) }}
                              style={{ cursor: 'pointer', color: sale > 0 ? '#0a0a0a' : '#ccc', borderBottom: '1px dashed rgba(0,0,0,0.15)', paddingBottom: '1px' }}>
                              {sale > 0 ? formatTL(sale) : 'Gir'}
                            </span>
                          )}
                        </div>
                        <div style={{ width: '70px', textAlign: 'right', flexShrink: 0, fontWeight: '500', color: sale > 0 ? (margin >= 0 ? '#22c55e' : '#ef4444') : '#ccc' }}>
                          {sale > 0 ? formatTL(margin) : '—'}
                        </div>
                        <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '100px', fontWeight: '500', background: `${(statusLabel[b.status] as any)?.color || '#888'}15`, color: (statusLabel[b.status] as any)?.color || '#888', flexShrink: 0 }}>
                          {typeof sl === 'string' ? sl : sl}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })
          })()}
        </div>
      </div>
    </div>
  )
}
