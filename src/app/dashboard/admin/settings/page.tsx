'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const NAV = [
  {label:'GENEL BAKIŞ',href:'/dashboard/admin'},
  {label:'KULLANICILAR',href:'/dashboard/admin/users'},
  {label:'MÜŞTERİLER',href:'/dashboard/admin/clients'},
  {label:'BRİEFLER',href:'/dashboard/admin/briefs'},
  {label:'CREATOR\'LAR',href:'/dashboard/admin/creators'},
  {label:'Kredi Yönetimi',href:'/dashboard/admin/credits'},
  {label:'RAPORLAR',href:'/dashboard/admin/reports'},
  {label:'FATURALAR',href:'/dashboard/admin/invoices'},
  {label:'AJANSLAR',href:'/dashboard/admin/agencies'},
  {label:'ANA SAYFA',href:'/dashboard/admin/homepage'},
  {label:'AYARLAR',href:'/dashboard/admin/settings'},
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [packages, setPackages] = useState<any[]>([])
  const [pkgEdits, setPkgEdits] = useState<Record<string,{name:string,credits:string,price_tl:string}>>({})
  const [newPkg, setNewPkg] = useState({name:'',credits:'',price_tl:''})

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    const { data } = await supabase.from('admin_settings').select('*')
    const map: Record<string,string> = {}
    data?.forEach(s => map[s.key] = s.value)
    setSettings(map)
    const { data: pkgs } = await supabase.from('credit_packages').select('*').order('credits')
    setPackages(pkgs || [])
    const edits: Record<string,{name:string,credits:string,price_tl:string}> = {}
    pkgs?.forEach(p => { edits[p.id] = { name: p.name, credits: String(p.credits), price_tl: String(p.price_tl || 0) } })
    setPkgEdits(edits)
  }

  async function saveSetting(key: string, value: string) {
    setLoading(true)
    const { data: existing } = await supabase.from('admin_settings').select('id').eq('key', key).maybeSingle()
    if (existing) {
      await supabase.from('admin_settings').update({ value }).eq('key', key)
    } else {
      await supabase.from('admin_settings').insert({ key, value })
    }
    setMsg('Kaydedildi.')
    setTimeout(() => setMsg(''), 2000)
    setLoading(false)
  }

  async function savePkg(id: string) {
    const e = pkgEdits[id]
    if (!e) return
    await supabase.from('credit_packages').update({ name: e.name, credits: parseInt(e.credits), price_tl: parseFloat(e.price_tl) || 0 }).eq('id', id)
    setMsg('Paket güncellendi.')
    setTimeout(() => setMsg(''), 2000)
    loadSettings()
  }

  async function addPkg() {
    if (!newPkg.name || !newPkg.credits) return
    await supabase.from('credit_packages').insert({ name: newPkg.name, credits: parseInt(newPkg.credits), price_tl: parseFloat(newPkg.price_tl) || 0 })
    setNewPkg({ name: '', credits: '', price_tl: '' })
    setMsg('Paket eklendi.')
    setTimeout(() => setMsg(''), 2000)
    loadSettings()
  }

  async function deletePkg(id: string, name: string) {
    if (!confirm(`"${name}" paketini silmek istediğinizden emin misiniz?`)) return
    await supabase.from('credit_packages').delete().eq('id', id)
    setMsg('Paket silindi.')
    setTimeout(() => setMsg(''), 2000)
    loadSettings()
  }

  const fields = [
    { key: 'approval_delegated_to_producer', label: 'Onay yetkisi prodüktöre devredildi', type: 'toggle' },
    { key: 'creator_credit_rate', label: '1 kredinın TL karşılığı (Creator ödemesi)', type: 'number', unit: '₺' },
    { key: 'credit_bumper', label: 'Bumper kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_story', label: 'Story/Reels kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_feed', label: 'Feed Video kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_longform', label: 'Long Form kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_extra_format', label: 'Ekstra format kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_revision', label: 'Müşteri revizyon kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_voiceover_real', label: 'Gerçek seslendirme kredi değeri', type: 'number', unit: 'kredi' },
  ]

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'var(--font-dm-sans),sans-serif',background:'#f7f6f2'}}>
      <div className="dinamo-sidebar" style={{width:'240px',background:'#0A0A0A',padding:'32px 0',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'0 24px 32px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{height:"28px"}} />
          <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginTop:'4px',letterSpacing:'1px',fontFamily:'monospace'}}>ADMIN</div>
        </div>
        <nav style={{flex:1,padding:'24px 0'}}>
          {NAV.map(item=>(
            <a key={item.href} href={item.href} style={{display:'block',padding:'10px 24px',fontSize:'11px',color:item.href==='/dashboard/admin/settings'?'#fff':'#888',textDecoration:'none',letterSpacing:'1px',fontFamily:'monospace'}}
              onMouseEnter={e=>(e.currentTarget.style.color='#fff')} onMouseLeave={e=>(e.currentTarget.style.color=item.href==='/dashboard/admin/settings'?'#fff':'#888')}>{item.label}</a>
          ))}
        </nav>
      </div>
      <div style={{flex:1,padding:'48px'}}>
        <h1 style={{fontSize:'28px',fontWeight:'300',letterSpacing:'-1px',margin:'0 0 40px',color:'#0a0a0a'}}>Ayarlar</h1>
        {msg && <div style={{marginBottom:'20px',padding:'12px 16px',background:'#e8f7e8',borderRadius:'8px',fontSize:'13px',color:'#1db81d'}}>{msg}</div>}
        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
          <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'12px',color:'rgba(255,255,255,0.4)',letterSpacing:'1px',fontFamily:'monospace'}}>SİSTEM AYARLARI</div>
          {fields.map((field, i) => (
            <div key={field.key} style={{padding:'20px 24px',borderBottom:i<fields.length-1?'1px solid #f0f0ee':'none',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'24px'}}>
              <div style={{fontSize:'14px',color:'#0a0a0a'}}>{field.label}</div>
              {field.type === 'toggle' ? (
                <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                  <span style={{fontSize:'13px',color:'rgba(255,255,255,0.4)'}}>{settings[field.key]==='true'?'Açık':'Kapalı'}</span>
                  <button onClick={()=>{const newVal=settings[field.key]==='true'?'false':'true'; setSettings({...settings,[field.key]:newVal}); saveSetting(field.key,newVal)}}
                    style={{width:'44px',height:'24px',borderRadius:'100px',border:'none',cursor:'pointer',background:settings[field.key]==='true'?'#1db81d':'#ddd',position:'relative',transition:'background 0.2s'}}>
                    <span style={{position:'absolute',top:'3px',left:settings[field.key]==='true'?'23px':'3px',width:'18px',height:'18px',borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}></span>
                  </button>
                </div>
              ) : (
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <input type="number" defaultValue={settings[field.key]} onBlur={e=>saveSetting(field.key, e.target.value)}
                    style={{width:'100px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',textAlign:'right',color:'#0a0a0a'}} />
                  {field.unit && <span style={{fontSize:'13px',color:'rgba(255,255,255,0.4)'}}>{field.unit}</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* KREDİ PAKETLERİ */}
        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden',marginTop:'32px'}}>
          <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'12px',color:'rgba(255,255,255,0.4)',letterSpacing:'1px',fontFamily:'monospace'}}>KREDİ PAKETLERİ</div>
          {packages.map((p, i) => {
            const e = pkgEdits[p.id] || { name: p.name, credits: String(p.credits), price_tl: String(p.price_tl || 0) }
            const isKurumsal = p.name === 'Kurumsal' || e.name === 'Kurumsal'
            return (
              <div key={p.id} style={{padding:'16px 24px',borderBottom:i<packages.length-1?'1px solid #f0f0ee':'none',display:'flex',alignItems:'center',gap:'12px'}}>
                <div>
                  <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>İsim</div>
                  <input value={e.name} onChange={ev=>setPkgEdits({...pkgEdits,[p.id]:{...e,name:ev.target.value}})}
                    style={{width:'120px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a'}} />
                </div>
                <div>
                  <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>Kredi</div>
                  <input type="number" value={e.credits} onChange={ev=>setPkgEdits({...pkgEdits,[p.id]:{...e,credits:ev.target.value}})}
                    style={{width:'80px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a',textAlign:'right'}} />
                </div>
                <div>
                  <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>Fiyat (TL)</div>
                  {isKurumsal ? (
                    <div style={{padding:'7px 10px',fontSize:'12px',color:'rgba(255,255,255,0.4)',fontStyle:'italic'}}>İletişime Geçin</div>
                  ) : (
                    <input type="number" value={e.price_tl} onChange={ev=>setPkgEdits({...pkgEdits,[p.id]:{...e,price_tl:ev.target.value}})}
                      style={{width:'120px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a',textAlign:'right'}} />
                  )}
                </div>
                <div style={{display:'flex',gap:'6px',marginTop:'16px'}}>
                  <button onClick={()=>savePkg(p.id)} style={{padding:'7px 14px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'6px',fontSize:'11px',cursor:'pointer'}}>Kaydet</button>
                  <button onClick={()=>deletePkg(p.id,p.name)} style={{padding:'7px 14px',background:'#fff',color:'#ef4444',border:'1px solid #ef4444',borderRadius:'6px',fontSize:'11px',cursor:'pointer'}}>Sil</button>
                </div>
              </div>
            )
          })}
          {/* New package form */}
          <div style={{padding:'16px 24px',borderTop:'1px solid #e8e7e3',background:'#fafaf8',display:'flex',alignItems:'center',gap:'12px'}}>
            <div>
              <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>İsim</div>
              <input value={newPkg.name} onChange={e=>setNewPkg({...newPkg,name:e.target.value})} placeholder="Paket adı"
                style={{width:'120px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a'}} />
            </div>
            <div>
              <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>Kredi</div>
              <input type="number" value={newPkg.credits} onChange={e=>setNewPkg({...newPkg,credits:e.target.value})} placeholder="0"
                style={{width:'80px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a',textAlign:'right'}} />
            </div>
            <div>
              <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>Fiyat (TL)</div>
              <input type="number" value={newPkg.price_tl} onChange={e=>setNewPkg({...newPkg,price_tl:e.target.value})} placeholder="0"
                style={{width:'120px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a',textAlign:'right'}} />
            </div>
            <button onClick={addPkg} disabled={!newPkg.name||!newPkg.credits} style={{padding:'7px 18px',background:'#1db81d',color:'#fff',border:'none',borderRadius:'6px',fontSize:'11px',cursor:'pointer',fontWeight:'500',marginTop:'16px',opacity:!newPkg.name||!newPkg.credits?0.4:1}}>
              Yeni Paket Ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
