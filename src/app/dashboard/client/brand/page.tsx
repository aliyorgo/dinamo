'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function BrandPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [credits, setCredits] = useState(0)
  const [clientId, setClientId] = useState('')
  const [files, setFiles] = useState<any[]>([])
  const [briefs, setBriefs] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedBriefId, setSelectedBriefId] = useState('')
  const [fileLabel, setFileLabel] = useState('')
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name').eq('id', user.id).single()
      setUserName(userData?.name || '')
      const { data: cu } = await supabase.from('client_users').select('credit_balance, client_id, clients(company_name)').eq('user_id', user.id).single()
      if (cu) {
        setCredits(cu.credit_balance)
        setClientId(cu.client_id)
        setCompanyName((cu as any).clients?.company_name || '')
        const { data: f } = await supabase.from('brief_files').select('*').eq('client_id', cu.client_id).order('created_at', { ascending: false })
        setFiles(f || [])
        const { data: b } = await supabase.from('briefs').select('id, campaign_name').eq('client_id', cu.client_id).neq('status','cancelled').order('created_at', { ascending: false })
        setBriefs(b || [])
      }
    }
    load()
  }, [router])

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file || !clientId) return
    setUploading(true)
    setMsg('')
    const ext = file.name.split('.').pop()
    const path = `brand/${clientId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('brand-assets').upload(path, file)
    if (upErr) { setMsg(upErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
    const insertData = {
      client_id: clientId,
      brief_id: selectedBriefId || null,
      file_url: urlData.publicUrl,
      file_name: fileLabel || file.name,
      file_type: file.type,
    }
    console.log('[Brand] Inserting brief_file:', insertData)
    const { error: insErr } = await supabase.from('brief_files').insert(insertData)
    console.log('[Brand] Insert result — error:', insErr)
    if (insErr) { setMsg('Kayıt hatası: ' + insErr.message); setUploading(false); return }
    setMsg('Dosya yüklendi.')
    setShowModal(false)
    setSelectedBriefId('')
    setFileLabel('')
    if (fileRef.current) fileRef.current.value = ''
    const { data: f } = await supabase.from('brief_files').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setFiles(f || [])
    setUploading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function FileThumb({ type, url }: { type: string, url: string }) {
    if (type?.includes('image')) return <img src={url} style={{width:'100%',height:'100%',objectFit:'contain',background:'#f5f5f5',padding:'6px'}} />
    if (type?.includes('video')) return <div style={{width:'100%',height:'100%',background:'#111',display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:'24px',color:'rgba(255,255,255,0.5)'}}>▶</span></div>
    if (type?.includes('pdf')) return <div style={{width:'100%',height:'100%',background:'#f5f4f0',display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:'14px',fontWeight:'600',color:'#888',letterSpacing:'0.5px'}}>PDF</span></div>
    return <div style={{width:'100%',height:'100%',background:'#f5f4f0'}} />
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"var(--font-dm-sans),'DM Sans',system-ui,sans-serif"}}>

      <div style={{width:'240px',background:'#0A0A0A',display:'flex',flexDirection:'column',flexShrink:0,height:'100vh',position:'sticky',top:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'18px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'12px'}}>
            dinam<span style={{display:'inline-block',width:'11px',height:'11px',borderRadius:'50%',border:'2.5px solid #22c55e',position:'relative',top:'1px'}}></span>
          </div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'3px'}}>{companyName}</div>
          <div style={{fontSize:'13px',fontWeight:'500',color:'#fff'}}>{userName}</div>
        </div>
        <div style={{padding:'12px 16px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',textTransform:'uppercase',marginBottom:'4px'}}>Kredi Bakiyesi</div>
          <div style={{fontSize:'22px',fontWeight:'300',color:'#fff',letterSpacing:'-1px'}}>{credits}</div>
        </div>
        <nav style={{padding:'10px 8px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          {[
            {label:'Projelerim',href:'/dashboard/client',active:false},
            {label:'Yeni Brief',href:'/dashboard/client/brief/new',active:false},
            {label:'Marka Paketi',href:'/dashboard/client/brand',active:true},
            {label:'Raporlar',href:'/dashboard/client/reports',active:false},
            {label:'Telif Belgeleri',href:'/dashboard/client/certificates',active:false},
            {label:'İçerik Güvencesi',href:'/dashboard/client/guarantee',active:false},
          ].map(item=>(
            <div key={item.href} onClick={()=>router.push(item.href)}
              style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',background:item.active?'rgba(255,255,255,0.08)':'transparent',marginBottom:'1px'}}>
              <span style={{fontSize:'12px',color:item.active?'#fff':'rgba(255,255,255,0.4)',fontWeight:item.active?'500':'400'}}>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{flex:1}}></div>
        <div style={{padding:'10px 8px',borderTop:'0.5px solid rgba(255,255,255,0.07)'}}>
          <button onClick={handleLogout} style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',borderRadius:'7px',cursor:'pointer',width:'100%',background:'none',border:'none'}}>
            <span style={{fontSize:'11px',color:'rgba(255,255,255,0.25)',fontFamily:'var(--font-dm-sans),sans-serif'}}>Çıkış yap</span>
          </button>
        </div>
      </div>

      <div style={{flex:1,background:'#f5f4f0',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'14px 28px',background:'#fff',borderBottom:'0.5px solid rgba(0,0,0,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>Marka Paketi</div>
          <button onClick={()=>setShowModal(true)}
            style={{background:'#111113',color:'#fff',border:'none',borderRadius:'8px',padding:'8px 18px',fontSize:'12px',fontFamily:'var(--font-dm-sans),sans-serif',cursor:'pointer',fontWeight:'500'}}>
            + Dosya Ekle
          </button>
        </div>

        <div style={{flex:1,padding:'24px 28px',overflowY:'auto'}}>
          {msg && <div style={{marginBottom:'16px',padding:'10px 14px',background:'#e8f7e8',borderRadius:'8px',fontSize:'13px',color:'#15803d'}}>{msg}</div>}

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'12px'}}>
            {files.map(f=>{
              const brief = briefs.find(b=>b.id===f.brief_id)
              return (
                <div key={f.id} style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',overflow:'hidden'}}>
                  <div style={{height:'100px',overflow:'hidden'}}>
                    <FileThumb type={f.file_type} url={f.file_url} />
                  </div>
                  <div style={{padding:'12px'}}>
                    <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginBottom:'4px'}}>{f.file_name}</div>
                    <div style={{fontSize:'10px',padding:'2px 8px',borderRadius:'100px',display:'inline-block',background:brief?'rgba(59,130,246,0.1)':'rgba(0,0,0,0.05)',color:brief?'#3b82f6':'#888'}}>
                      {brief?brief.campaign_name:'Tüm kampanyalar'}
                    </div>
                    <div style={{marginTop:'8px'}}>
                      <a href={f.file_url} target="_blank" style={{fontSize:'11px',color:'#22c55e',textDecoration:'none'}}>İndir ↓</a>
                    </div>
                  </div>
                </div>
              )
            })}
            {files.length===0&&(
              <div style={{gridColumn:'1/-1',textAlign:'center',padding:'60px 0',color:'#888',fontSize:'14px'}}>
                Henüz dosya yüklenmedi. Logo, font ve marka dosyalarınızı ekleyin.
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}>
          <div style={{background:'#fff',borderRadius:'16px',padding:'28px',width:'440px',maxWidth:'90vw'}}>
            <div style={{fontSize:'16px',fontWeight:'500',color:'#0a0a0a',marginBottom:'20px'}}>Dosya Ekle</div>
            <div style={{marginBottom:'16px'}}>
              <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',marginBottom:'6px'}}>Dosya</div>
              <input ref={fileRef} type="file" style={{width:'100%',fontSize:'13px',color:'#0a0a0a'}} />
            </div>
            <div style={{marginBottom:'16px'}}>
              <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',marginBottom:'6px'}}>Dosya Adı / Etiketi</div>
              <input value={fileLabel} onChange={e=>setFileLabel(e.target.value)} placeholder="örn. Ana Logo, Marka Fontu..." style={{width:'100%',padding:'9px 12px',border:'0.5px solid rgba(0,0,0,0.15)',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a',fontFamily:'var(--font-dm-sans),sans-serif',boxSizing:'border-box'}} />
            </div>
            <div style={{marginBottom:'20px'}}>
              <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',marginBottom:'6px'}}>Kampanya ile Eşleştir (opsiyonel)</div>
              <select value={selectedBriefId} onChange={e=>setSelectedBriefId(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'0.5px solid rgba(0,0,0,0.15)',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a',background:'#fff',fontFamily:'var(--font-dm-sans),sans-serif'}}>
                <option value="">Tüm kampanyalar</option>
                {briefs.map(b=><option key={b.id} value={b.id}>{b.campaign_name}</option>)}
              </select>
            </div>
            {msg&&<div style={{marginBottom:'12px',fontSize:'13px',color:'#e24b4a'}}>{msg}</div>}
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>{setShowModal(false);setMsg('')}} style={{padding:'9px 20px',border:'0.5px solid rgba(0,0,0,0.15)',borderRadius:'8px',background:'#fff',color:'#555',fontSize:'13px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif'}}>İptal</button>
              <button onClick={handleUpload} disabled={uploading} style={{padding:'9px 20px',background:'#111113',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontFamily:'var(--font-dm-sans),sans-serif',fontWeight:'500'}}>
                {uploading?'Yükleniyor...':'Yükle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
