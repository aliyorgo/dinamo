'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
export default function CreatorDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [jobs, setJobs] = useState<any[]>([])
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'creator') { router.push('/login'); return }
      setUserName(userData.name)
      const { data: creatorData } = await supabase.from('creators').select('id').eq('user_id', user.id).single()
      if (!creatorData) return
      const { data: jobData } = await supabase.from('producer_briefs').select('*, briefs(campaign_name, video_type, status, created_at, clients(company_name))').eq('assigned_creator_id', creatorData.id).order('forwarded_at', { ascending: false })
      setJobs(jobData || [])
    }
    load()
  }, [router])
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }
  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'system-ui,sans-serif',background:'#f7f6f2'}}>
      <div style={{width:'220px',background:'#0a0a0a',padding:'32px 0',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'0 24px 32px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:'20px',fontWeight:'500',color:'#fff'}}>dinamo</div>
          <div style={{fontSize:'11px',color:'#666',marginTop:'4px',letterSpacing:'1px',fontFamily:'monospace'}}>CREATOR</div>
        </div>
        <nav style={{flex:1,padding:'24px 0'}}>
          <a href="/dashboard/creator" style={{display:'block',padding:'10px 24px',fontSize:'11px',color:'#fff',textDecoration:'none',letterSpacing:'1px',fontFamily:'monospace'}}>İŞLERİM</a>
        </nav>
        <div style={{padding:'24px',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:'13px',color:'#666',marginBottom:'12px'}}>{userName}</div>
          <button onClick={handleLogout} style={{fontSize:'11px',color:'#666',background:'none',border:'none',cursor:'pointer',letterSpacing:'1px',fontFamily:'monospace',padding:0}}>ÇIKIŞ YAP</button>
        </div>
      </div>
      <div style={{flex:1,padding:'48px'}}>
        <h1 style={{fontSize:'28px',fontWeight:'300',letterSpacing:'-1px',margin:'0 0 8px'}}>İşlerim</h1>
        <p style={{color:'#888',fontSize:'14px',marginTop:'0',marginBottom:'40px'}}>Size atanan projeler</p>
        <div style={{display:'grid',gap:'16px'}}>
          {jobs.length === 0 ? (
            <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'48px',textAlign:'center',color:'#888',fontSize:'14px'}}>Henüz atanmış iş yok.</div>
          ) : jobs.map(job => (
            <div key={job.id} onClick={() => router.push(`/dashboard/creator/jobs/${job.brief_id}`)}
              style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px',cursor:'pointer'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontSize:'16px',fontWeight:'500',marginBottom:'4px'}}>{job.briefs?.campaign_name}</div>
                  <div style={{fontSize:'13px',color:'#888'}}>{job.briefs?.clients?.company_name} · {job.briefs?.video_type}</div>
                </div>
                <div style={{fontSize:'11px',color:'#888',fontFamily:'monospace'}}>{job.forwarded_at ? new Date(job.forwarded_at).toLocaleDateString('tr-TR') : ''}</div>
              </div>
              {job.producer_note && <div style={{marginTop:'16px',padding:'12px',background:'#f7f6f2',borderRadius:'8px',fontSize:'13px',color:'#444'}}>{job.producer_note}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}