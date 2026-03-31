'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string,string> = {
  submitted:'Yeni', read:'Okundu', in_production:'Üretimde',
  revision:'Revizyon', approved:'Onay Bekliyor', delivered:'Teslim Edildi'
}
const statusColor: Record<string,string> = {
  submitted:'#22c55e', read:'#888', in_production:'#3b82f6',
  revision:'#ef4444', approved:'#f59e0b', delivered:'#888'
}

export default function ProducerDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [briefs, setBriefs] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'producer') { router.push('/login'); return }
      setUserName(userData.name)
      const { data: b } = await supabase.from('briefs').select('*, clients(company_name)').neq('status','cancelled').order('created_at', { ascending: false })
      setBriefs(b || [])
      setLoading(false)
    }
    load()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filtered = filter === 'all' ? briefs : briefs.filter(b => b.status === filter)
  const newCount = briefs.filter(b=>b.status==='submitted').length
  const revisionCount = briefs.filter(b=>b.status==='revision').length

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');`}</style>

      <div style={{width:'220px',background:'#111113',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'15px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'12px'}}>
            dinam<span style={{display:'inline-block',width:'9px',height:'9px',borderRadius:'50%',border:'2px solid #22c55e',position:'relative',top:'1px'}}></span>
          </div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'3px'}}>Prodüktör</div>
          <div style={{fontSize:'13px',fontWeight:'500',color:'#fff'}}>{userName}</div>
        </div>

        <nav style={{padding:'10px 8px',flex:1}}>
          <div style={{fontSize:'9px',letterSpacing:'1.5px',color:'rgba(255,255,255,0.2)',padding:'0 6px',marginBottom:'6px',textTransform:'uppercase'}}>Filtrele</div>
          {[
            {val:'all',label:'Tümü'},
            {val:'submitted',label:'Yeni Briefler',badge:newCount},
            {val:'in_production',label:'Üretimde'},
            {val:'revision',label:'Revizyon',badge:revisionCount},
            {val:'approved',label:'Onay Bekliyor'},
            {val:'delivered',label:'Tamamlananlar'},
          ].map(item=>(
            <div key={item.val} onClick={()=>setFilter(item.val)}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',background:filter===item.val?'rgba(255,255,255,0.08)':'transparent',marginBottom:'1px'}}>
              <span style={{fontSize:'12px',color:filter===item.val?'#fff':'rgba(255,255,255,0.4)',fontWeight:filter===item.val?'500':'400'}}>{item.label}</span>
              {item.badge&&item.badge>0&&<span style={{fontSize:'9px',background:'rgba(239,68,68,0.3)',color:'#fca5a5',borderRadius:'100px',padding:'1px 7px'}}>{item.badge}</span>}
            </div>
          ))}
        </nav>

        <div style={{padding:'10px 8px',borderTop:'0.5px solid rgba(255,255,255,0.07)'}}>
          <button onClick={handleLogout} style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',borderRadius:'7px',cursor:'pointer',width:'100%',background:'none',border:'none'}}>
            <span style={{fontSize:'11px',color:'rgba(255,255,255,0.25)',fontFamily:'Inter,sans-serif'}}>Çıkış yap</span>
          </button>
        </div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f5f4f0',overflow:'hidden'}}>
        <div style={{padding:'14px 28px',background:'#fff',borderBottom:'0.5px solid rgba(0,0,0,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>Briefler</div>
          <div style={{fontSize:'12px',color:'#888'}}>{filtered.length} proje</div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'20px 28px'}}>
          {loading ? <div style={{color:'#888',fontSize:'14px'}}>Yükleniyor...</div> : filtered.length === 0 ? (
            <div style={{textAlign:'center',padding:'60px 0',color:'#888',fontSize:'14px'}}>Proje yok.</div>
          ) : filtered.map(b=>(
            <div key={b.id} onClick={()=>router.push(`/dashboard/producer/briefs/${b.id}`)}
              style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px 20px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}
              onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.2)')}
              onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.1)')}>
              <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
                <div style={{width:'8px',height:'8px',borderRadius:'50%',background:statusColor[b.status],flexShrink:0}}></div>
                <div>
                  <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>{b.campaign_name}</div>
                  <div style={{fontSize:'12px',color:'#888',marginTop:'3px'}}>{b.clients?.company_name} · {b.video_type} · {new Date(b.created_at).toLocaleDateString('tr-TR')}</div>
                </div>
              </div>
              <div style={{fontSize:'11px',padding:'4px 12px',borderRadius:'100px',background:`${statusColor[b.status]}15`,color:statusColor[b.status],fontWeight:'500',flexShrink:0}}>
                {b.status==='revision'&&b.status?'Müşteri Revizyonu':statusLabel[b.status]||b.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
