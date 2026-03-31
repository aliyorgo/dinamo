'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string,string> = {
  submitted:'İnceleniyor', read:'İncelendi', in_production:'Üretimde',
  revision:'Revizyon', approved:'Onay Bekliyor', delivered:'Teslim Edildi', cancelled:'İptal Edildi'
}
const statusColor: Record<string,string> = {
  submitted:'#888', read:'#888', in_production:'#3b82f6',
  revision:'#ef4444', approved:'#f59e0b', delivered:'#22c55e', cancelled:'#555'
}

export default function ClientDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [credits, setCredits] = useState(0)
  const [briefs, setBriefs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'client') { router.push('/login'); return }
      setUserName(userData.name)
      const { data: cu } = await supabase.from('client_users').select('credit_balance, client_id, clients(company_name)').eq('user_id', user.id).single()
      if (cu) {
        setCredits(cu.credit_balance)
        setCompanyName((cu as any).clients?.company_name || '')
        const { data: b } = await supabase.from('briefs').select('*').eq('client_id', cu.client_id).neq('status','cancelled').order('created_at', { ascending: false })
        setBriefs(b || [])
      }
      setLoading(false)
    }
    load()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const pending = briefs.filter(b => b.status === 'approved')
  const inProd = briefs.filter(b => ['submitted','read','in_production','revision'].includes(b.status))
  const done = briefs.filter(b => b.status === 'delivered')

  const sidebarStyle: React.CSSProperties = {
    width: '220px', background: '#111113', display: 'flex',
    flexDirection: 'column', flexShrink: 0
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"'Inter',system-ui,sans-serif",background:'#f5f4f0'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');`}</style>

      {/* SIDEBAR */}
      <div style={sidebarStyle}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'15px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'12px'}}>
            dinam<span style={{display:'inline-block',width:'9px',height:'9px',borderRadius:'50%',border:'2px solid #22c55e',position:'relative',top:'1px'}}></span>
          </div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',letterSpacing:'0.3px',marginBottom:'3px'}}>{companyName}</div>
          <div style={{fontSize:'13px',fontWeight:'500',color:'#fff'}}>{userName}</div>
        </div>

        <div style={{padding:'12px 16px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'4px'}}>Kredi Bakiyesi</div>
          <div style={{fontSize:'24px',fontWeight:'300',color:'#fff',letterSpacing:'-1px'}}>{credits}</div>
        </div>

        <nav style={{padding:'10px 8px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          {[
            {label:'Projelerim', href:'/dashboard/client', active:true, icon:<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" fill="white"/><rect x="9" y="2" width="5" height="5" rx="1" fill="white"/><rect x="2" y="9" width="5" height="5" rx="1" fill="white"/><rect x="9" y="9" width="5" height="5" rx="1" fill="white"/></svg>},
            {label:'Yeni Brief', href:'/dashboard/client/brief/new', active:false, icon:<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round"/></svg>},
            {label:'Marka Paketi', href:'/dashboard/client/brand', active:false, icon:<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2"/><path d="M5 7h6M5 9.5h4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round"/></svg>},
          ].map(item=>(
            <div key={item.href} onClick={()=>router.push(item.href)}
              style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',background:item.active?'rgba(255,255,255,0.08)':'transparent',marginBottom:'1px'}}>
              {item.icon}
              <span style={{fontSize:'12px',color:item.active?'#fff':'rgba(255,255,255,0.4)',fontWeight:item.active?'500':'400'}}>{item.label}</span>
            </div>
          ))}
        </nav>

        <div style={{flex:1}}></div>

        <div style={{padding:'10px 8px',borderTop:'0.5px solid rgba(255,255,255,0.07)'}}>
          <button onClick={handleLogout} style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',borderRadius:'7px',cursor:'pointer',width:'100%',background:'none',border:'none'}}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3H3a1 1 0 00-1 1v8a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{fontSize:'11px',color:'rgba(255,255,255,0.25)',fontFamily:'Inter,sans-serif'}}>Çıkış yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'14px 28px',background:'#fff',borderBottom:'0.5px solid rgba(0,0,0,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>Merhaba, {userName.split(' ')[0]} 👋</div>
          <button onClick={()=>router.push('/dashboard/client/brief/new')}
            style={{background:'#111113',color:'#fff',border:'none',borderRadius:'8px',padding:'8px 18px',fontSize:'12px',fontFamily:'Inter,sans-serif',cursor:'pointer',fontWeight:'500',display:'flex',alignItems:'center',gap:'6px'}}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
            Yeni Brief
          </button>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>
          {loading ? (
            <div style={{color:'#888',fontSize:'14px'}}>Yükleniyor...</div>
          ) : (
            <>
              {pending.length > 0 && (
                <div style={{marginBottom:'28px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                    <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#f59e0b'}}></div>
                    <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Onayınızı Bekliyor</div>
                    <div style={{fontSize:'11px',color:'#888'}}>{pending.length} proje</div>
                  </div>
                  {pending.map(b=>(
                    <div key={b.id} onClick={()=>router.push(`/dashboard/client/briefs/${b.id}`)}
                      style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'14px 18px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px',transition:'border-color 0.15s'}}
                      onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.2)')}
                      onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.1)')}>
                      <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                        <div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#f5f4f0',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 3l9 5-9 5V3z" fill="#888"/></svg>
                        </div>
                        <div>
                          <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{b.campaign_name}</div>
                          <div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>{b.video_type} · {new Date(b.created_at).toLocaleDateString('tr-TR')}</div>
                        </div>
                      </div>
                      <div style={{fontSize:'10px',padding:'4px 12px',borderRadius:'100px',background:'rgba(245,158,11,0.1)',color:'#f59e0b',fontWeight:'500'}}>İncele & Onayla</div>
                    </div>
                  ))}
                </div>
              )}

              {inProd.length > 0 && (
                <div style={{marginBottom:'28px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                    <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#3b82f6'}}></div>
                    <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Devam Edenler</div>
                    <div style={{fontSize:'11px',color:'#888'}}>{inProd.length} proje</div>
                  </div>
                  {inProd.map(b=>(
                    <div key={b.id} onClick={()=>router.push(`/dashboard/client/briefs/${b.id}`)}
                      style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'14px 18px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}
                      onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.2)')}
                      onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.1)')}>
                      <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                        <div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#f5f4f0',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5" stroke="#888" strokeWidth="1.2"/><path d="M8 5v3l2 1" stroke="#888" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        </div>
                        <div>
                          <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{b.campaign_name}</div>
                          <div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>{b.video_type} · {statusLabel[b.status]}</div>
                        </div>
                      </div>
                      <div style={{fontSize:'10px',padding:'4px 12px',borderRadius:'100px',background:`${statusColor[b.status]}15`,color:statusColor[b.status],fontWeight:'500'}}>{statusLabel[b.status]}</div>
                    </div>
                  ))}
                </div>
              )}

              {done.length > 0 && (
                <div style={{marginBottom:'28px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                    <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#22c55e'}}></div>
                    <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Tamamlananlar</div>
                    <div style={{fontSize:'11px',color:'#888'}}>{done.length} proje</div>
                  </div>
                  <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
                    {done.map(b=>(
                      <div key={b.id} onClick={()=>router.push(`/dashboard/client/briefs/${b.id}`)}
                        style={{width:'160px',background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',overflow:'hidden',cursor:'pointer'}}
                        onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.2)')}
                        onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(0,0,0,0.1)')}>
                        <div style={{height:'90px',background:'#1a1a1f',position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <div style={{width:'28px',height:'28px',borderRadius:'50%',background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M5 3l9 5-9 5V3z" fill="white"/></svg>
                          </div>
                          <div style={{position:'absolute',top:'8px',right:'8px',fontSize:'9px',padding:'2px 7px',borderRadius:'100px',background:'rgba(34,197,94,0.9)',color:'#fff',fontWeight:'500'}}>Teslim</div>
                        </div>
                        <div style={{padding:'10px 12px'}}>
                          <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{b.campaign_name}</div>
                          <div style={{fontSize:'10px',color:'#888',marginTop:'2px'}}>{b.video_type}</div>
                          <div style={{fontSize:'10px',color:'#aaa',marginTop:'2px'}}>{new Date(b.created_at).toLocaleDateString('tr-TR')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {briefs.length === 0 && (
                <div style={{textAlign:'center',padding:'60px 0'}}>
                  <div style={{fontSize:'14px',color:'#888',marginBottom:'20px'}}>Henüz bir projeniz yok.</div>
                  <button onClick={()=>router.push('/dashboard/client/brief/new')}
                    style={{background:'#111113',color:'#fff',border:'none',borderRadius:'10px',padding:'12px 24px',fontSize:'13px',fontFamily:'Inter,sans-serif',cursor:'pointer',fontWeight:'500'}}>
                    İlk Brief'inizi Oluşturun
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
