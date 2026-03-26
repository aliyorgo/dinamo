'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const NAV = [{label:'GENEL BAKIŞ',href:'/dashboard/admin'},{label:'KULLANICILAR',href:'/dashboard/admin/users'},{label:'MÜŞTERİLER',href:'/dashboard/admin/clients'},{label:'BRİEFLER',href:'/dashboard/admin/briefs'},{label:'KREDİLER',href:'/dashboard/admin/credits'},{label:'AYARLAR',href:'/dashboard/admin/settings'}]
const statusLabel: Record<string,string> = {submitted:'Yeni',read:'Okundu',in_production:'Üretimde',revision:'Revizyon',approved:'Onaylandı',delivered:'Teslim Edildi'}
const statusColor: Record<string,string> = {submitted:'#1db81d',read:'#888',in_production:'#f59e0b',revision:'#e24b4a',approved:'#1db81d',delivered:'#888'}
export default function BriefsPage() {
  const router = useRouter()
  const [briefs, setBriefs] = useState<any[]>([])
  const [filter, setFilter] = useState('all')

  useEffect(() => { loadBriefs() }, [])

  async function loadBriefs() {
    const { data } = await supabase
      .from('briefs')
      .select('*, clients(company_name)')
      .order('created_at', { ascending: false })
    setBriefs(data || [])
  }

  const filtered = filter === 'all' ? briefs : briefs.filter(b => b.status === filter)

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'system-ui,sans-serif',background:'#f7f6f2'}}>
      <div style={{width:'220px',background:'#0a0a0a',padding:'32px 0',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'0 24px 32px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:'20px',fontWeight:'500',color:'#fff'}}>dinamo</div>
          <div style={{fontSize:'11px',color:'#666',marginTop:'4px',letterSpacing:'1px',fontFamily:'monospace'}}>ADMIN</div>
        </div>
        <nav style={{flex:1,padding:'24px 0'}}>
          {NAV.map(item=>(
            <a key={item.href} href={item.href} style={{display:'block',padding:'10px 24px',fontSize:'11px',color:'#888',textDecoration:'none',letterSpacing:'1px',fontFamily:'monospace'}}
              onMouseEnter={e=>(e.currentTarget.style.color='#fff')} onMouseLeave={e=>(e.currentTarget.style.color='#888')}>{item.label}</a>
          ))}
        </nav>
      </div>
      <div style={{flex:1,padding:'48px'}}>
        <h1 style={{fontSize:'28px',fontWeight:'300',letterSpacing:'-1px',margin:'0 0 24px'}}>Briefler</h1>
        <div style={{display:'flex',gap:'8px',marginBottom:'24px',flexWrap:'wrap'}}>
          {[{val:'all',label:'Tümü'},{val:'submitted',label:'Yeni'},{val:'in_production',label:'Üretimde'},{val:'revision',label:'Revizyon'},{val:'delivered',label:'Teslim'}].map(f=>(
            <button key={f.val} onClick={()=>setFilter(f.val)}
              style={{padding:'6px 16px',borderRadius:'100px',border:'1px solid',borderColor:filter===f.val?'#0a0a0a':'#e8e7e3',background:filter===f.val?'#0a0a0a':'#fff',color:filter===f.val?'#fff':'#888',fontSize:'12px',cursor:'pointer',fontFamily:'monospace',letterSpacing:'0.5px'}}>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
          {filtered.length === 0 ? (
            <div style={{padding:'48px',textAlign:'center',color:'#888',fontSize:'14px'}}>Brief yok.</div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid #e8e7e3'}}>
                  {['Kampanya','Marka','Video Tipi','Durum','Tarih'].map(h=>(
                    <th key={h} style={{padding:'12px 20px',textAlign:'left',fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',fontWeight:'400'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((brief,i)=>(
                  <tr key={brief.id} style={{borderBottom:i<filtered.length-1?'1px solid #f0f0ee':'none',cursor:'pointer'}}
                    onClick={()=>router.push(`/dashboard/admin/briefs/${brief.id}`)}
                    onMouseEnter={e=>(e.currentTarget.style.background='#fafaf8')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <td style={{padding:'14px 20px',fontSize:'14px',fontWeight:'500'}}>{brief.campaign_name}</td>
                    <td style={{padding:'14px 20px',fontSize:'13px',color:'#888'}}>{brief.clients?.company_name||'—'}</td>
                    <td style={{padding:'14px 20px',fontSize:'13px',color:'#888'}}>{brief.video_type}</td>
                    <td style={{padding:'14px 20px'}}>
                      <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'100px',background:`${statusColor[brief.status]}15`,color:statusColor[brief.status],fontFamily:'monospace'}}>
                        {statusLabel[brief.status]||brief.status}
                      </span>
                    </td>
                    <td style={{padding:'14px 20px',fontSize:'13px',color:'#888'}}>{new Date(brief.created_at).toLocaleDateString('tr-TR')}</td>
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