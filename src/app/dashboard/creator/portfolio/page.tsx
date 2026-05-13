'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function CreatorPortfolio() {
  const router = useRouter()
  const [jobs, setJobs] = useState<any[]>([])
  const [videoMap, setVideoMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
      if (!user) { router.push('/login'); return }
      const { data: creator } = await supabase.from('creators').select('id').eq('user_id', user.id).maybeSingle()
      if (!creator) { setLoading(false); return }
      const { data: pb } = await supabase.from('producer_briefs').select('brief_id').eq('assigned_creator_id', creator.id)
      const briefIds = (pb || []).map((x: any) => x.brief_id)
      if (briefIds.length > 0) {
        const { data: b } = await supabase.from('briefs').select('*, clients(company_name)').in('id', briefIds).eq('status', 'delivered').order('created_at', { ascending: false })
        setJobs(b || [])
        const deliveredIds = (b || []).map(br => br.id)
        if (deliveredIds.length > 0) {
          const { data: vids } = await supabase.from('video_submissions').select('brief_id, video_url').in('brief_id', deliveredIds).order('version', { ascending: false })
          const map: Record<string, string> = {}
          vids?.forEach((v: any) => { if (!map[v.brief_id]) map[v.brief_id] = v.video_url })
          setVideoMap(map)
        }
      }
      setLoading(false)
    }
    load()
  }, [router])

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>PORTFOLIO · {jobs.length}</div>
      {loading ? (
        <div style={{ color: 'var(--color-text-tertiary)', fontSize: '14px' }}>Yükleniyor...</div>
      ) : jobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-tertiary)', fontSize: '14px' }}>Henüz tamamlanmış iş yok.</div>
      ) : (
        <div className="portfolio-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
          {jobs.map(job => (
            <div key={job.id} onClick={() => router.push(`/dashboard/creator/jobs/${job.id}`)}
              style={{ background: '#fff', border: '1px solid #e5e4db', cursor: 'pointer', overflow: 'hidden' }}>
              {videoMap[job.id] ? (
                <div style={{ aspectRatio: '9/16', overflow: 'hidden', background: '#0a0a0a' }}>
                  <video src={videoMap[job.id] + '#t=0.5'} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ) : (
                <div style={{ aspectRatio: '9/16', background: 'var(--color-background-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>Video</span>
                </div>
              )}
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: '11px', fontWeight: '500', color: '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.campaign_name}</div>
                <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#6b6b66', marginTop: '3px' }}>
                  {job.brief_type === 'cps_child' ? (job.cps_hook ? `CPS · ${job.cps_hook}` : `CPS YÖN ${job.mvc_order || ''}`) : job.brief_type === 'express_clone' ? 'AI EXPRESS' : 'ANA VİDEO'}
                </div>
                <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>{job.clients?.company_name} · {new Date(job.created_at).toLocaleDateString('tr-TR')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{`@media (max-width: 768px) { .portfolio-grid { grid-template-columns: repeat(2, 1fr) !important; } }`}</style>
    </div>
  )
}
