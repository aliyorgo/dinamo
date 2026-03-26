'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const NAV = [{label:'GENEL BAKIŞ',href:'/dashboard/admin'},{label:'KULLANICILAR',href:'/dashboard/admin/users'},{label:'MÜŞTERİLER',href:'/dashboard/admin/clients'},{label:'BRİEFLER',href:'/dashboard/admin/briefs'},{label:'KREDİLER',href:'/dashboard/admin/credits'},{label:'AYARLAR',href:'/dashboard/admin/settings'}]
export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    const { data } = await supabase.from('admin_settings').select('*')
    const map: Record<string,string> = {}
    data?.forEach(s => map[s.key] = s.value)
    setSettings(map)
  }

  async function saveSetting(key: string, value: string) {
    setLoading(true)
    await supabase.from('admin_settings').update({ value }).eq('key', key)
    setMsg('Kaydedildi.')
    setTimeout(() => setMsg(''), 2000)
    setLoading(false)
  }

  const fields = [
    { key: 'approval_delegated_to_producer', label: 'Onay yetkisi prodüktöre devredildi', type: 'toggle' },
    { key: 'credit_bumper', label: 'Bumper kredi değeri', type: 'number' },
    { key: 'credit_story', label: 'Story/Reels kredi değeri', type: 'number' },
    { key: 'credit_feed', label: 'Feed Video kredi değeri', type: 'number' },
    { key: 'credit_longform', label: 'Long Form kredi değeri', type: 'number' },
    { key: 'credit_extra_format', label: 'Ekstra format kredi değeri', type: 'number' },
    { key: 'credit_revision', label: 'Revizyon kredi değeri', type: 'number' },
    { key: 'credit_voiceover_real', label: 'Gerçek seslendirme kredi değeri', type: 'number' },
  ]

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
        <h1 style={{fontSize:'28px',fontWeight:'300',letterSpacing:'-1px',margin:'0 0 40px'}}>Ayarlar</h1>
        {msg && <div style={{marginBottom:'20px',padding:'12px 16px',background:'#e8f7e8',borderRadius:'8px',fontSize:'13px',color:'#1db81d'}}>{msg}</div>}
        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
          <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'12px',color:'#888',letterSpacing:'1px',fontFamily:'monospace'}}>SİSTEM AYARLARI</div>
          {fields.map((field, i) => (
            <div key={field.key} style={{padding:'20px 24px',borderBottom:i<fields.length-1?'1px solid #f0f0ee':'none',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'24px'}}>
              <div style={{fontSize:'14px'}}>{field.label}</div>
              {field.type === 'toggle' ? (
                <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                  <span style={{fontSize:'13px',color:'#888'}}>{settings[field.key]==='true'?'Açık':'Kapalı'}</span>
                  <button onClick={()=>saveSetting(field.key, settings[field.key]==='true'?'false':'true')}
                    style={{width:'44px',height:'24px',borderRadius:'100px',border:'none',cursor:'pointer',background:settings[field.key]==='true'?'#1db81d':'#ddd',position:'relative',transition:'background 0.2s'}}>
                    <span style={{position:'absolute',top:'3px',left:settings[field.key]==='true'?'23px':'3px',width:'18px',height:'18px',borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}></span>
                  </button>
                </div>
              ) : (
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <input type="number" defaultValue={settings[field.key]} onBlur={e=>saveSetting(field.key, e.target.value)}
                    style={{width:'80px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',textAlign:'center'}} />
                  <span style={{fontSize:'13px',color:'#888'}}>kredi</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}