'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string, string> = {
  submitted: 'Atandı', read: 'Atandı', in_production: 'Üretimde',
  revision: 'Revizyon İstendi', approved: 'Onaylandı', delivered: 'Teslim Edildi'
}

export default function CreatorDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [creatorId, setCreatorId] = useState('')
  const [jobs, setJobs] = useState<any[]>([])
  const [forwardedMap, setForwardedMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [creditRate, setCreditRate] = useState(0)
  const [customRate, setCustomRate] = useState<number | null>(null)
  const [unavailableDates, setUnavailableDates] = useState<string[]>([])
  const [thanks, setThanks] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'creator') { router.push('/login'); return }
      setUserName(userData.name)
      const { data: creator } = await supabase.from('creators').select('*').eq('user_id', user.id).maybeSingle()
      if (!creator) { setLoading(false); return }
      setCreatorId(creator.id)
      setCustomRate(creator.custom_credit_rate)
      setUnavailableDates(Array.isArray(creator.unavailable_dates) ? creator.unavailable_dates : [])
      // Redirect to profile if incomplete
      if (!creator.phone || !creator.iban) { router.push('/dashboard/creator/profile'); return }
      if (!creator.agreement_accepted) { router.push('/dashboard/creator/profile'); return }
      // Load assigned briefs with forwarded_at
      const { data: pb } = await supabase.from('producer_briefs').select('brief_id, forwarded_at').eq('assigned_creator_id', creator.id)
      const briefIds = (pb || []).map((x: any) => x.brief_id)
      const fwdMap: Record<string, string> = {}
      pb?.forEach((p: any) => { fwdMap[p.brief_id] = p.forwarded_at })
      setForwardedMap(fwdMap)
      if (briefIds.length > 0) {
        const { data: b } = await supabase.from('briefs').select('*, clients(company_name)').in('id', briefIds).neq('status', 'cancelled').neq('status', 'delivered').order('created_at', { ascending: false })
        setJobs(b || [])
      }
      // Load unseen thanks
      const { data: thanksData } = await supabase.from('creator_earnings').select('id, brief_id, credits, briefs(campaign_name, clients(company_name))').eq('creator_id', creator.id).eq('thanks_seen', false)
      setThanks(thanksData || [])
      const { data: st } = await supabase.from('admin_settings').select('value').eq('key', 'creator_credit_rate').maybeSingle()
      if (st) setCreditRate(Number(st.value) || 0)
      setLoading(false)
    }
    load()
  }, [router])

  const rate = customRate || creditRate
  const now = Date.now()

  // Sort by urgency: overdue first, then by deadline ascending
  const sortedJobs = [...jobs].sort((a, b) => {
    const deadA = new Date(forwardedMap[a.id] || a.created_at).getTime() + 24 * 60 * 60 * 1000
    const deadB = new Date(forwardedMap[b.id] || b.created_at).getTime() + 24 * 60 * 60 * 1000
    const overdueA = now > deadA
    const overdueB = now > deadB
    if (overdueA && !overdueB) return -1
    if (!overdueA && overdueB) return 1
    return deadA - deadB
  })

  const activeCount = jobs.length
  const overdueCount = jobs.filter(j => {
    const dead = new Date(forwardedMap[j.id] || j.created_at).getTime() + 24 * 60 * 60 * 1000
    return now > dead
  }).length
  const todayCredits = jobs.reduce((s, j) => s + (j.credit_cost || 0), 0)

  function getTimerInfo(job: any): { label: string; color: string } {
    const fwd = forwardedMap[job.id] || job.created_at
    const deadline = new Date(fwd).getTime() + 24 * 60 * 60 * 1000
    const diff = deadline - now
    if (diff < 0) {
      const hrs = Math.ceil(Math.abs(diff) / 3600000)
      return { label: `GEÇ KALDI · ${hrs} saat`, color: '#ef4444' }
    }
    const hrs = Math.ceil(diff / 3600000)
    if (hrs <= 24) return { label: `${hrs} saat kaldı`, color: '#f59e0b' }
    return { label: `${hrs} saat kaldı`, color: '#888' }
  }

  function getJobType(job: any): string {
    if (job.brief_type === 'cps_child') return `CPS YÖN ${job.mvc_order || ''}`
    return 'ANA VİDEO'
  }

  async function dismissThanks(id: string) {
    await supabase.from('creator_earnings').update({ thanks_seen: true }).eq('id', id)
    setThanks(prev => prev.filter(t => t.id !== id))
  }

  // Client-side filtering
  const filteredJobs = sortedJobs.filter(job => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const match = (job.campaign_name || '').toLowerCase().includes(q) || (job.clients?.company_name || '').toLowerCase().includes(q)
      if (!match) return false
    }
    if (filterType !== 'all') {
      if (filterType === 'cps' && job.brief_type !== 'cps_child') return false
      if (filterType === 'ana' && job.brief_type === 'cps_child') return false
    }
    if (filterStatus !== 'all' && job.status !== filterStatus) return false
    return true
  })

  function getStatusBadge(status: string): { label: string; bg: string; border: string } {
    switch (status) {
      case 'submitted': case 'read': return { label: 'ATANDI', bg: 'rgba(156,163,175,0.12)', border: '#9ca3af' }
      case 'in_production': return { label: 'ÜRETİMDE', bg: 'rgba(59,130,246,0.12)', border: '#3b82f6' }
      case 'revision': return { label: 'REVİZYON İSTENDİ', bg: 'rgba(239,68,68,0.12)', border: '#ef4444' }
      case 'approved': return { label: 'ONAYLANDI', bg: 'rgba(245,158,11,0.12)', border: '#f59e0b' }
      default: return { label: statusLabel[status] || status, bg: 'rgba(0,0,0,0.06)', border: '#888' }
    }
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      {loading ? (
        <div style={{ color: 'var(--color-text-tertiary)', fontSize: '14px' }}>Yükleniyor...</div>
      ) : (
        <>
          {/* DAILY SUMMARY CARD */}
          <div style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '22px 26px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>BUGÜN BİTİRDİĞİNDE</div>
                <div style={{ fontSize: '28px', fontWeight: '500', color: '#0a0a0a', letterSpacing: '-1px' }}>{rate > 0 ? `${(todayCredits * rate).toLocaleString('tr-TR')} ₺` : `${todayCredits} kredi`}</div>
              </div>
              <div>
                <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>AKTİF İŞ</div>
                <div style={{ fontSize: '28px', fontWeight: '500', color: '#0a0a0a', letterSpacing: '-1px' }}>{activeCount}</div>
              </div>
              {overdueCount > 0 && (
                <div>
                  <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#ef4444', marginBottom: '4px' }}>GEÇ KALAN</div>
                  <div style={{ fontSize: '28px', fontWeight: '500', color: '#ef4444', letterSpacing: '-1px' }}>{overdueCount}</div>
                </div>
              )}
            </div>
            {(() => {
              const today = new Date(); today.setHours(0,0,0,0)
              const week = new Date(today.getTime() + 7 * 86400000)
              const upcoming = unavailableDates.filter(d => { const dt = new Date(d); return dt >= today && dt <= week })
              if (upcoming.length === 0) return null
              return (
                <div
                  onClick={() => router.push('/dashboard/creator/profile#availability')}
                  title={`${upcoming.length} gün müsait değilsin`}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1.5" y="2.5" width="13" height="12" rx="1" stroke="#0a0a0a" strokeWidth="1.2" />
                    <line x1="1.5" y1="5.5" x2="14.5" y2="5.5" stroke="#0a0a0a" strokeWidth="1.2" />
                    <line x1="5" y1="1" x2="5" y2="4" stroke="#0a0a0a" strokeWidth="1.2" />
                    <line x1="11" y1="1" x2="11" y2="4" stroke="#0a0a0a" strokeWidth="1.2" />
                  </svg>
                  <span style={{ fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b6b66', fontWeight: '500' }}>{upcoming.length}</span>
                </div>
              )
            })()}
          </div>

          {/* THANKS BANNERS */}
          {thanks.map(t => (
            <div key={t.id} style={{ background: '#fff', borderLeft: '3px solid #22c55e', border: '1px solid #e5e4db', borderLeftColor: '#22c55e', padding: '14px 18px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Tebrikler! <span style={{ color: 'var(--color-text-tertiary)' }}>{(t as any).briefs?.clients?.company_name}</span> · {(t as any).briefs?.campaign_name} teslim edildi.</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{t.credits} kredi kazandın{rate > 0 ? ` · ${(t.credits * rate).toLocaleString('tr-TR')} ₺` : ''}</div>
              </div>
              <button onClick={() => dismissThanks(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af', padding: '4px 8px' }}>×</button>
            </div>
          ))}
          {thanks.length > 0 && <div style={{ marginBottom: '16px' }} />}

          {/* SEARCH & FILTER TOOLBAR */}
          {jobs.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <input
                type="text" placeholder="Kampanya veya marka ara..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1, minWidth: '180px', padding: '8px 12px', border: '1px solid #e5e4db', background: '#fff', fontSize: '13px', outline: 'none' }}
              />
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #e5e4db', background: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                <option value="all">Tüm Tipler</option>
                <option value="ana">Ana Video</option>
                <option value="cps">CPS</option>
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #e5e4db', background: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                <option value="all">Tüm Durumlar</option>
                <option value="submitted">Atandı</option>
                <option value="in_production">Üretimde</option>
                <option value="revision">Revizyon</option>
                <option value="approved">Onay Bekliyor</option>
              </select>
            </div>
          )}

          {/* JOB LIST */}
          {filteredJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-tertiary)', fontSize: '14px' }}>{searchQuery || filterType !== 'all' || filterStatus !== 'all' ? 'Eşleşen iş bulunamadı.' : 'Aktif iş yok.'}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredJobs.map(job => {
                const timer = getTimerInfo(job)
                const jobType = getJobType(job)
                const badge = getStatusBadge(job.status)
                const durMap: Record<string, string> = { 'Bumper / Pre-roll': '6sn', 'Story / Reels': '15sn', 'Feed Video': '30sn', 'Long Form': '60sn' }
                return (
                  <div key={job.id} onClick={() => router.push(`/dashboard/creator/jobs/${job.id}`)}
                    style={{ background: '#fff', border: '1px solid #e5e4db', padding: '18px 22px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', transition: 'background 0.1s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fafaf7' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>{job.clients?.company_name} · {jobType}</div>
                      <div style={{ fontSize: '16px', fontWeight: '500', color: '#0a0a0a', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.campaign_name}</div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>{job.format} · {durMap[job.video_type] || '10sn'} · {job.credit_cost || 0} kredi</span>
                        <span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '2px 7px', background: badge.bg, border: `1px solid ${badge.border}`, color: '#0a0a0a' }}>{badge.label}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: '500', padding: '4px 10px', border: `1px solid ${timer.color}`, color: timer.color, flexShrink: 0, whiteSpace: 'nowrap' }}>{timer.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
