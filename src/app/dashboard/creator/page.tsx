'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string, string> = {
  submitted: 'Atandı', read: 'Atandı', in_production: 'Üretimde',
  revision: 'Revizyon', approved: 'Onay Bekliyor', delivered: 'Teslim Edildi'
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
  const [isAvailable, setIsAvailable] = useState(true)

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
      setIsAvailable(creator.is_available !== false)
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
      const { data: st } = await supabase.from('admin_settings').select('value').eq('key', 'creator_credit_rate').maybeSingle()
      if (st) setCreditRate(Number(st.value) || 0)
      setLoading(false)
    }
    load()
  }, [router])

  async function toggleAvailable() {
    const newVal = !isAvailable
    setIsAvailable(newVal)
    await supabase.from('creators').update({ is_available: newVal }).eq('id', creatorId)
  }

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

  function getStatusBadge(status: string): { label: string; bg: string; border: string } {
    switch (status) {
      case 'submitted': case 'read': return { label: 'ATANDI', bg: 'rgba(156,163,175,0.12)', border: '#9ca3af' }
      case 'in_production': return { label: 'ÜRETİMDE', bg: 'rgba(59,130,246,0.12)', border: '#3b82f6' }
      case 'revision': return { label: 'REVİZYON', bg: 'rgba(239,68,68,0.12)', border: '#ef4444' }
      case 'approved': return { label: 'ONAY BEKLİYOR', bg: 'rgba(245,158,11,0.12)', border: '#f59e0b' }
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
            <button onClick={toggleAvailable}
              style={{ padding: '6px 14px', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer', border: '1px solid', borderColor: isAvailable ? '#e5e4db' : '#ef4444', background: isAvailable ? '#fff' : 'rgba(239,68,68,0.06)', color: isAvailable ? '#888' : '#ef4444' }}>
              {isAvailable ? 'MÜSAİT' : 'MÜSAİT DEĞİLİM'}
            </button>
          </div>

          {/* JOB LIST */}
          {sortedJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-tertiary)', fontSize: '14px' }}>Aktif iş yok.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sortedJobs.map(job => {
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
