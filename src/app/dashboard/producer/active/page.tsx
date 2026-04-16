'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const NAV = [
  {label:'BRİEFLER',href:'/dashboard/producer'},
  {label:'DEVAM EDENLER',href:'/dashboard/producer/active'},
  {label:'TAMAMLANANLAR',href:'/dashboard/producer/completed'},
]

const statusLabel: Record<string,string> = {submitted:'Yeni',read:'Okundu',in_production:'Üretimde',revision:'Revizyon',approved:'Onaylandı',delivered:'Teslim Edildi'}
const statusColor: Record<string,string> = {submitted:'#1db81d',read:'#888',in_production:'#f59e0b',revision:'#e24b4a',approved:'#1db81d',delivered:'#888'}

export default function ProducerActive() {
  const router = useRouter()
  const [briefs, setBriefs] = useState<any[]>([])
  const [userName, setUserName] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'producer') { router.push('/login'); return }
      setUserName(userData.name)
      const { data } = await supabase.from('briefs')
        .select('*, clients(company_name)')
        .in('status', ['in_production', 'revision'])
        .order('created_at', { ascending: false })
      setBriefs(data || [])
    }
    load()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'var(--font-dm-sans),sans-serif',background:'#f7f6f2'}}>
      <div style={{width:'240px',background:'#0A0A0A',padding:'32px 0',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'0 24px 32px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{height:"28px"}} />
          <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginTop:'4px',letterSpacing:'1px',fontFamily:'monospace'}}>PRODÜKTÖR</div>
        </div>
        <nav style={{flex:1,padding:'24px 0'}}>
          {NAV.map(item=>(
            <a key={item.href} href={item.href} style={{display:'block',padding:'10px 24px',fontSize:'11px',color:item.href==='/dashboard/producer/active'?'#fff':'#888',textDecoration:'none',letterSpacing:'1px',fontFamily:'monospace'}}>{item.label}</a>
          ))}
        </nav>
        <div style={{padding:'24px',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:'13px',color:'rgba(255,255,255,0.4)',marginBottom:'12px'}}>{userName}</div>
          <button onClick={handleLogout} style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',background:'none',border:'none',cursor:'pointer',letterSpacing:'1px',fontFamily:'monospace',padding:0}}>ÇIKIŞ YAP</button>
        </div>
      </div>
      <div style={{flex:1,padding:'48px'}}>
        <h1 style={{fontSize:'28px',fontWeight:'300',letterSpacing:'-1px',margin:'0 0 40px',color:'#0a0a0a'}}>Devam Edenler</h1>
        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
          {briefs.length === 0 ? (
            <div style={{padding:'48px',textAlign:'center',color:'rgba(255,255,255,0.4)',fontSize:'14px'}}>Devam eden proje yok.</div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid #e8e7e3'}}>
                  {['Kampanya','Marka','Video Tipi','Durum','Tarih'].map(h=>(
                    <th key={h} style={{padding:'12px 20px',textAlign:'left',fontSize:'11px',color:'rgba(255,255,255,0.4)',letterSpacing:'1px',fontFamily:'monospace',fontWeight:'400'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {briefs.map((brief,i)=>(
                  <tr key={brief.id} style={{borderBottom:i<briefs.length-1?'1px solid #f0f0ee':'none',cursor:'pointer'}}
                    onClick={()=>router.push(`/dashboard/producer/briefs/${brief.id}`)}
                    onMouseEnter={e=>(e.currentTarget.style.background='#fafaf8')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <td style={{padding:'14px 20px',fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>{brief.campaign_name}</td>
                    <td style={{padding:'14px 20px',fontSize:'13px',color:'#555'}}>{brief.clients?.company_name||'—'}</td>
                    <td style={{padding:'14px 20px',fontSize:'13px',color:'#555'}}>{brief.video_type}</td>
                    <td style={{padding:'14px 20px'}}>
                      <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'100px',background:`${statusColor[brief.status]}15`,color:statusColor[brief.status],fontFamily:'monospace'}}>
                        {statusLabel[brief.status]||brief.status}
                      </span>
                    </td>
                    <td style={{padding:'14px 20px',fontSize:'13px',color:'#555'}}>{new Date(brief.created_at).toLocaleDateString('tr-TR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
