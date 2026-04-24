'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import ProductionStudio from '@/components/ProductionStudio'
import { useRouter, useParams } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function CreatorJobDetail() {
  const router = useRouter()
  const params = useParams()
  const briefId = params.id as string
  const [brief, setBrief] = useState<any>(null)
  const [producerBrief, setProducerBrief] = useState<any>(null)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [revisions, setRevisions] = useState<any[]>([])
  const [userName, setUserName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const [brandFiles, setBrandFiles] = useState<any[]>([])
  const [projectFiles, setProjectFiles] = useState<any[]>([])
  const [inspirations, setInspirations] = useState<any[]>([])
  const [inspLoading, setInspLoading] = useState(false)
  const [adminApproved, setAdminApproved] = useState<any>(null)
  const [studioLocked, setStudioLocked] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadData() }, [briefId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ud } = await supabase.from('users').select('name').eq('id', user.id).single()
    setUserName(ud?.name || '')
    const { data: b } = await supabase.from('briefs').select('*, clients(company_name, logo_url, font_url)').eq('id', briefId).single()
    setBrief(b)
    const { data: pb } = await supabase.from('producer_briefs').select('*').eq('brief_id', briefId).maybeSingle()
    setProducerBrief(pb)
    const { data: s } = await supabase.from('video_submissions').select('*').eq('brief_id', briefId).order('submitted_at', { ascending: false })
    setSubmissions(s || [])
    const { data: q } = await supabase.from('brief_questions').select('*').eq('brief_id', briefId).order('asked_at')
    setRevisions((q || []).filter((x:any) => x.question.startsWith('İÇ REVİZYON:') || x.question.startsWith('REVİZYON:')))
    // Load files: brand-wide (client_id, no brief_id) + this project's files (brief_id)
    if (b?.client_id) {
      const { data: brand, error: brandErr } = await supabase.from('brief_files').select('*').eq('client_id', b.client_id).is('brief_id', null).order('created_at', { ascending: false })
      const { data: project, error: projErr } = await supabase.from('brief_files').select('*').eq('brief_id', briefId).order('created_at', { ascending: false })
      console.log('[Creator] brand files:', brand?.length, brandErr, '| project files:', project?.length, projErr)

      // Generate signed URLs for all files
      async function signFiles(files: any[]) {
        return Promise.all(files.map(async f => {
          if (f.file_url) {
            const path = f.file_url.split('/brand-assets/')[1]
            if (path) {
              const { data: signed } = await supabase.storage.from('brand-assets').createSignedUrl(decodeURIComponent(path), 3600)
              return { ...f, file_url: signed?.signedUrl || f.file_url }
            }
          }
          return f
        }))
      }

      setBrandFiles(await signFiles(brand || []))
      setProjectFiles(await signFiles(project || []))
    }
    console.log('[Creator] clients data:', { logo_url: b?.clients?.logo_url, font_url: b?.clients?.font_url })
    const { data: insp } = await supabase.from('brief_inspirations').select('*').eq('brief_id', briefId).eq('is_visible_to_creator', true).order('is_starred', { ascending: false })
    setInspirations(insp || [])
    // Admin-approved inspiration
    const { data: adminInsp } = await supabase.from('brief_inspirations').select('*').eq('brief_id', briefId).eq('source', 'admin').eq('status', 'approved').maybeSingle()
    setAdminApproved(adminInsp)
    setStudioLocked(pb?.studio_locked || false)
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setMsg('Dosya seçin.'); return }
    setUploading(true)
    setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: cd } = await supabase.from('creators').select('id').eq('user_id', user?.id).maybeSingle()
    if (!cd) { setMsg('Creator kaydı bulunamadı.'); setUploading(false); return }
    const ext = file.name.split('.').pop() || 'mp4'
    const client = (brief?.clients?.company_name || 'client').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const campaign = (brief?.campaign_name || 'video').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const fmt = (brief?.format || '').replace(':', 'x')
    const date = new Date().toISOString().slice(0, 10)
    const autoName = `dinamo_${client}_${campaign}_${fmt}_${date}.${ext}`
    const storagePath = `${briefId}/${autoName}`
    const { error: upErr } = await supabase.storage.from('videos').upload(storagePath, file)
    if (upErr) { console.log('Storage upload error:', upErr.message); setMsg(upErr.message); setUploading(false); return }
    console.log('Storage upload OK, path:', storagePath)
    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(storagePath)
    const version = submissions.length + 1
    const { error: insErr } = await supabase.from('video_submissions').insert({ brief_id: briefId, creator_id: cd.id, video_url: urlData.publicUrl, version, status: 'pending', format: brief?.format || null })
    if (insErr) { console.log('Insert error:', insErr.message); setMsg(insErr.message); setUploading(false); return }
    console.log('Upload & insert successful')
    setMsg('Video yüklendi, prodüktör onayı bekleniyor.')
    if (fileRef.current) fileRef.current.value = ''
    // Refresh submissions state
    const { data: updatedSubs } = await supabase.from('video_submissions').select('*').eq('brief_id', briefId).order('submitted_at', { ascending: false })
    setSubmissions(updatedSubs || [])
    setUploading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function requestMoreInspo() {
    setInspLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const res = await fetch('/api/generate-inspirations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief_id: briefId, user_id: user?.id, count: 1 }) })
    const data = await res.json()
    if (data.inspirations) setInspirations(prev => [...data.inspirations, ...prev])
    setInspLoading(false)
  }


  const [scenarioLoading, setScenarioLoading] = useState<string|null>(null)
  const [scenarios, setScenarios] = useState<Record<string,{scenario:any[],prompts:any}>>({})
  const [copiedPrompt, setCopiedPrompt] = useState<string|null>(null)

  async function generateScenario(inspId: string) {
    setScenarioLoading(inspId)
    const res = await fetch('/api/generate-scenario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inspiration_id: inspId }) })
    const data = await res.json()
    if (data.scenario) setScenarios(prev => ({ ...prev, [inspId]: { scenario: data.scenario, prompts: data.prompts } }))
    setScenarioLoading(null)
  }

  function copyPrompt(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedPrompt(key)
    setTimeout(() => setCopiedPrompt(null), 1500)
  }

  const videoRef = useRef<HTMLVideoElement>(null)
  function parseTimecode(text: string): { tc: number|null, clean: string } {
    const match = text.match(/^\[(\d{2}):(\d{2})\.(\d)\]\s*/)
    if (!match) return { tc: null, clean: text }
    return { tc: parseInt(match[1])*60 + parseInt(match[2]) + parseInt(match[3])/10, clean: text.replace(match[0], '') }
  }
  function seekTo(seconds: number) { if (videoRef.current) { videoRef.current.currentTime = seconds; videoRef.current.play() } }

  const internalRevisions = revisions.filter(r => r.question.startsWith('İÇ REVİZYON:'))
  const clientRevisions = revisions.filter(r => r.question.startsWith('REVİZYON:'))

  return (
    <div style={{display:'flex',minHeight:'100vh',}}>

      <div style={{width:'240px',background:'#0A0A0A',display:'flex',flexDirection:'column',flexShrink:0,height:'100vh',position:'sticky',top:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'18px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'12px'}}>
            <img src="/dinamo_logo.png" alt="Dinamo" style={{height:'28px'}} />
          </div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'3px'}}>Creator</div>
          <div style={{fontSize:'13px',fontWeight:'500',color:'#fff'}}>{userName}</div>
        </div>
        <nav style={{padding:'10px 8px',flex:1}}>
          <div onClick={()=>router.push('/dashboard/creator')} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer'}}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>İşlerime dön</span>
          </div>
        </nav>
        <div style={{padding:'10px 8px',borderTop:'0.5px solid rgba(255,255,255,0.07)'}}>
          <button onClick={handleLogout} style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',borderRadius:'7px',cursor:'pointer',width:'100%',background:'none',border:'none'}}>
            <span style={{fontSize:'11px',color:'rgba(255,255,255,0.25)',}}>Çıkış yap</span>
          </button>
        </div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f5f4f0',overflow:'hidden'}}>
        <div style={{padding:'14px 28px',background:'#fff',borderBottom:'0.5px solid rgba(0,0,0,0.08)',flexShrink:0}}>
          <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>İşlerim / <span style={{color:'#0a0a0a',fontWeight:'500'}}>{brief?.campaign_name}</span></div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>
          {brief && (
            <>
              {brief.voiceover_type==='real'&&!brief.voiceover_file_url&&(
                <div style={{background:'#fffbeb',border:'1px solid rgba(245,158,11,0.3)',borderRadius:'10px',padding:'12px 16px',marginBottom:'16px',display:'flex',alignItems:'center',gap:'10px'}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><path d="M12 19v4M8 23h8"/></svg>
                  <div>
                    <div style={{fontSize:'13px',color:'#0a0a0a',fontWeight:'500'}}>Bu brief için gerçek seslendirme bekleniyor.</div>
                    <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginTop:'2px'}}>Prodüktör dosyayı yükleyince burada görünecek.</div>
                  </div>
                </div>
              )}

              {(internalRevisions.length > 0 || clientRevisions.length > 0) && (
                <div style={{background:'#fff',border:'2px solid #ef4444',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px'}}>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#ef4444'}}></div>
                    <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Revizyon Talepleri</div>
                  </div>
                  {internalRevisions.map((r,i)=>{
                    const {tc,clean}=parseTimecode(r.question.replace('İÇ REVİZYON: ',''))
                    return (
                      <div key={r.id} style={{padding:'10px 14px',background:'#fef2f2',borderRadius:'8px',marginBottom:'6px'}}>
                        <div style={{fontSize:'10px',color:'#ef4444',fontWeight:'500',marginBottom:'3px',textTransform:'uppercase',letterSpacing:'0.3px'}}>Prodüktör / Admin</div>
                        <div style={{fontSize:'13px',color:'#0a0a0a',display:'flex',alignItems:'flex-start',gap:'8px'}}>
                          {tc!==null&&<button onClick={()=>seekTo(tc)} style={{fontSize:'10px',padding:'2px 8px',borderRadius:'100px',background:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'none',cursor:'pointer',fontFamily:'monospace',fontWeight:'500',flexShrink:0,marginTop:'2px'}}>▶ {Math.floor(tc/60)}:{String(Math.floor(tc%60)).padStart(2,'0')}</button>}
                          <span>{clean}</span>
                        </div>
                      </div>
                    )
                  })}
                  {clientRevisions.map((r,i)=>{
                    const {tc,clean}=parseTimecode(r.question.replace('REVİZYON: ',''))
                    return (
                      <div key={r.id} style={{padding:'10px 14px',background:'#fef2f2',borderRadius:'8px',marginBottom:'6px'}}>
                        <div style={{fontSize:'10px',color:'#ef4444',fontWeight:'500',marginBottom:'3px',textTransform:'uppercase',letterSpacing:'0.3px'}}>Müşteri Revizyonu</div>
                        <div style={{fontSize:'13px',color:'#0a0a0a',display:'flex',alignItems:'flex-start',gap:'8px'}}>
                          {tc!==null&&<button onClick={()=>seekTo(tc)} style={{fontSize:'10px',padding:'2px 8px',borderRadius:'100px',background:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'none',cursor:'pointer',fontFamily:'monospace',fontWeight:'500',flexShrink:0,marginTop:'2px'}}>▶ {Math.floor(tc/60)}:{String(Math.floor(tc%60)).padStart(2,'0')}</button>}
                          <span>{clean}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 1. VIDEO SUBMISSIONS */}
              <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'14px'}}>Video Yükle</div>
                <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap'}}>
                  <input ref={fileRef} type="file" accept="video/*" style={{flex:1,fontSize:'13px',color:'#0a0a0a',minWidth:'200px'}} />
                  <button onClick={handleUpload} disabled={uploading} style={{padding:'9px 20px',background:'#111113',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontWeight:'500',whiteSpace:'nowrap'}}>
                    {uploading?'Yükleniyor...':'Yükle'}
                  </button>
                </div>
                {msg&&<div style={{fontSize:'12px',color:msg.includes('bulunamadı')?'#ef4444':'#22c55e',marginTop:'10px'}}>{msg}</div>}
              </div>

              {submissions.length > 0 && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                  <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'14px'}}>Yüklediklerim</div>
                  {submissions.map((s,i)=>(
                    <div key={s.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<submissions.length-1?'0.5px solid rgba(0,0,0,0.06)':'none'}}>
                      <div>
                        <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>Versiyon {s.version}</div>
                        <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginTop:'2px'}}>{new Date(s.submitted_at).toLocaleDateString('tr-TR')}</div>
                        {s.producer_notes&&<div style={{fontSize:'11px',color:'#ef4444',marginTop:'3px'}}>Not: {s.producer_notes}</div>}
                      </div>
                      <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                        <span style={{fontSize:'10px',padding:'3px 8px',borderRadius:'100px',
                          background:s.status==='pending'?'rgba(0,0,0,0.05)':s.status==='revision_requested'?'rgba(239,68,68,0.1)':'rgba(34,197,94,0.1)',
                          color:s.status==='pending'?'#888':s.status==='revision_requested'?'#ef4444':'#22c55e',fontWeight:'500'}}>
                          {s.status==='pending'?'Bekliyor':s.status==='revision_requested'?'Revizyon':'Onaylandı'}
                        </span>
                        <a href={s.video_url} target="_blank" style={{fontSize:'11px',color:'#22c55e',textDecoration:'none'}}>Görüntüle ↗</a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 2. BRIEF INFO */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px'}}>
                  <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'14px'}}>Brief</div>
                  {(() => {
                    const sf: string[] = producerBrief?.shared_fields || ['message','cta','target_audience','voiceover_text','notes']
                    return [
                      {label:'Video Tipi', field:'video_type', value: `${brief.video_type}${brief.video_type==='Bumper / Pre-roll'?' · 6 saniye':brief.video_type==='Story / Reels'?' · 15 saniye':brief.video_type==='Feed Video'?' · 30 saniye':brief.video_type==='Long Form'?' · 60 saniye':''}`, always:true},
                      {label:'Format', field:'format', value: brief.format, always:true},
                      {label:'Mecralar', field:'platforms', value: brief.platforms && Array.isArray(brief.platforms) && brief.platforms.length > 0 ? brief.platforms.join(', ') : null, always:true},
                      {label:'Mesaj', field:'message', value: brief.message, always:false},
                      {label:'CTA', field:'cta', value: brief.cta, always:false},
                      {label:'Hedef Kitle', field:'target_audience', value: brief.target_audience, always:false},
                      {label:'Seslendirme', field:'voiceover_type', value: brief.voiceover_type==='real'?`Gerçek Seslendirme${brief.voiceover_gender==='male'?' · Erkek':brief.voiceover_gender==='female'?' · Kadın':''}`:brief.voiceover_type==='ai'?`AI Seslendirme${brief.voiceover_gender==='male'?' · Erkek':brief.voiceover_gender==='female'?' · Kadın':''}`:null, always:true},
                      {label:'Seslendirme Metni', field:'voiceover_text', value: brief.voiceover_type!=='real'?brief.voiceover_text:null, always:false},
                      {label:'Notlar', field:'notes', value: brief.notes, always:false},
                    ].filter(f => f.value && (f.always || sf.includes(f.field))).map(f=>(
                      <div key={f.label} style={{marginBottom:'10px'}}>
                        <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'3px'}}>{f.label}</div>
                        <div style={{fontSize:'13px',color:'#0a0a0a',lineHeight:'1.5'}}>{f.value}</div>
                      </div>
                    ))
                  })()}
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                  {producerBrief?.producer_note && (
                    <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px 20px'}}>
                      <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>Prodüktör Notu</div>
                      <div style={{fontSize:'13px',color:'#0a0a0a',lineHeight:'1.6'}}>{producerBrief.producer_note}</div>
                    </div>
                  )}
                  {brief.voiceover_type==='real'&&(
                    <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px 20px',marginBottom:'12px'}}>
                      <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>Seslendirme</div>
                      {brief.voiceover_file_url ? (
                        <div>
                          <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'8px'}}>
                            <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#22c55e'}}></div>
                            <span style={{fontSize:'12px',color:'#22c55e',fontWeight:'500'}}>Seslendirme hazır</span>
                          </div>
                          <audio controls src={brief.voiceover_file_url} style={{width:'100%',marginBottom:'8px'}} />
                          <a href={brief.voiceover_file_url} download target="_blank" style={{fontSize:'11px',color:'#22c55e',textDecoration:'none'}}>İndir ↓</a>
                        </div>
                      ) : (
                        <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                          <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#f59e0b'}}></div>
                          <span style={{fontSize:'12px',color:'#f59e0b'}}>Seslendirme hazırlanıyor</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px 20px',marginBottom:'12px'}}>
                    <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>Marka Dosyaları</div>
                    {brief.clients?.logo_url&&(
                      <a href={brief.clients.logo_url} target="_blank" style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px',textDecoration:'none'}}>
                        <img src={brief.clients.logo_url} style={{width:'80px',height:'80px',objectFit:'contain',borderRadius:'6px',background:'#f5f5f5',padding:'6px'}} />
                        <span style={{fontSize:'12px',color:'#22c55e'}}>Logo ↓</span>
                      </a>
                    )}
                    {brief.clients?.font_url&&(
                      <a href={brief.clients.font_url} target="_blank" style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px',textDecoration:'none'}}>
                        <div style={{width:'80px',height:'80px',borderRadius:'6px',background:'#f5f5f5',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:'11px',fontWeight:'600',color:'rgba(255,255,255,0.4)'}}>FONT</span></div>
                        <span style={{fontSize:'12px',color:'#22c55e'}}>Font ↓</span>
                      </a>
                    )}
                    {brandFiles.map(f=>(
                      <a key={f.id} href={f.file_url} target="_blank" style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px',textDecoration:'none'}}>
                        {f.file_type?.includes('image') ? (
                          <img src={f.file_url} style={{width:'80px',height:'80px',objectFit:'contain',borderRadius:'6px',background:'#f5f5f5',padding:'6px'}} />
                        ) : f.file_type?.includes('video') ? (
                          <div style={{width:'80px',height:'80px',borderRadius:'6px',background:'#111',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:'16px',color:'rgba(255,255,255,0.5)'}}>▶</span></div>
                        ) : f.file_type?.includes('pdf') ? (
                          <div style={{width:'80px',height:'80px',borderRadius:'6px',background:'#f5f5f5',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:'11px',fontWeight:'600',color:'rgba(255,255,255,0.4)'}}>PDF</span></div>
                        ) : null}
                        <span style={{fontSize:'12px',color:'#22c55e'}}>{f.file_name} ↓</span>
                      </a>
                    ))}
                    {!brief.clients?.logo_url&&!brief.clients?.font_url&&brandFiles.length===0&&<div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>Marka dosyası yüklenmemiş.</div>}
                  </div>
                  {projectFiles.length > 0 && (
                    <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px 20px'}}>
                      <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>Bu Proje Dosyaları</div>
                      {projectFiles.map(f=>(
                        <a key={f.id} href={f.file_url} target="_blank" style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px',textDecoration:'none'}}>
                          {f.file_type?.includes('image') ? (
                            <img src={f.file_url} style={{width:'80px',height:'80px',objectFit:'contain',borderRadius:'6px',background:'#f5f5f5',padding:'6px'}} />
                          ) : f.file_type?.includes('video') ? (
                            <div style={{width:'80px',height:'80px',borderRadius:'6px',background:'#111',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:'16px',color:'rgba(255,255,255,0.5)'}}>▶</span></div>
                          ) : f.file_type?.includes('pdf') ? (
                            <div style={{width:'80px',height:'80px',borderRadius:'6px',background:'#f5f5f5',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:'11px',fontWeight:'600',color:'rgba(255,255,255,0.4)'}}>PDF</span></div>
                          ) : null}
                          <span style={{fontSize:'12px',color:'#22c55e'}}>{f.file_name} ↓</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {brief.format && (
                <div style={{background:'rgba(34,197,94,0.04)',border:'1px solid rgba(34,197,94,0.15)',borderRadius:'12px',padding:'16px 20px',marginBottom:'16px',display:'flex',alignItems:'center',gap:'14px'}}>
                  {(() => {
                    const r = brief.format.split(':').map(Number)
                    const scale = 40 / Math.max(r[0]||1, r[1]||1)
                    return <div style={{width:`${(r[0]||1)*scale}px`,height:`${(r[1]||1)*scale}px`,borderRadius:'4px',border:'2px solid #22c55e',background:'rgba(34,197,94,0.08)',flexShrink:0}} />
                  })()}
                  <div>
                    <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>Bu video <span style={{color:'#22c55e'}}>{brief.format}</span> formatında üretilmeli</div>
                    <div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginTop:'2px'}}>{brief.video_type}</div>
                  </div>
                </div>
              )}

              {/* 3. PRODÜKSIYONDAN GELENLER */}
              {(studioLocked || adminApproved) && (
                <div style={{background:'#fff',border:'1.5px solid rgba(34,197,94,0.3)',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a',textTransform:'uppercase',letterSpacing:'0.3px'}}>Prodüksiyondan Gelenler</div>
                    </div>
                  </div>

                  {adminApproved && (
                    <div style={{border:'1.5px solid #22c55e',borderRadius:'10px',padding:'14px 16px',background:'rgba(34,197,94,0.02)',marginBottom: adminApproved.scenario_status === 'approved' && adminApproved.scenario ? '14px' : '0'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                        <span style={{fontSize:'9px',padding:'2px 8px',borderRadius:'100px',background:'rgba(34,197,94,0.1)',color:'#22c55e',fontWeight:'500'}}>Onaylanan Fikir</span>
                      </div>
                      <div style={{fontSize:'15px',fontWeight:'500',color:'#0a0a0a',marginBottom:'6px'}}>{adminApproved.title}</div>
                      <div style={{fontSize:'13px',color:'#555',lineHeight:1.7}}>{adminApproved.concept}</div>
                    </div>
                  )}

                  {adminApproved?.scenario_status === 'approved' && adminApproved.scenario && (() => {
                    const raw = adminApproved.scenario
                    let parsed: any = null
                    if (Array.isArray(raw)) parsed = raw
                    else if (typeof raw === 'string') {
                      try { const p = JSON.parse(raw); parsed = Array.isArray(p) ? p : p?.scenario && Array.isArray(p.scenario) ? p.scenario : raw } catch { parsed = raw }
                    }
                    return (
                      <div style={{border:'0.5px solid rgba(0,0,0,0.08)',borderRadius:'10px',padding:'14px 16px',background:'#fafaf8'}}>
                        <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'10px'}}>Onaylanan Senaryo</div>
                        {Array.isArray(parsed) ? parsed.map((sc: any, i: number) => (
                          <div key={i} style={{display:'flex',gap:'10px',marginBottom:'10px',paddingBottom:'10px',borderBottom:i<parsed.length-1?'0.5px solid rgba(0,0,0,0.04)':'none'}}>
                            <div style={{fontSize:'20px',fontWeight:'300',color:'#ddd',flexShrink:0,width:'24px'}}>{sc.scene}</div>
                            <div style={{flex:1}}>
                              {sc.duration&&<div style={{fontSize:'10px',color:'#22c55e',fontWeight:'500',marginBottom:'3px'}}>{sc.duration}</div>}
                              <div style={{fontSize:'13px',color:'#0a0a0a',lineHeight:1.7}}>{sc.visual}</div>
                              {sc.audio&&<div style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',marginTop:'2px'}}>🎵 {sc.audio}</div>}
                              {sc.dialogue&&<div style={{fontSize:'11px',color:'#3b82f6',fontStyle:'italic',marginTop:'2px'}}>💬 {sc.dialogue}</div>}
                            </div>
                          </div>
                        )) : (
                          <div>{String(parsed).split('\n').filter(Boolean).map((line, i) => (
                            <p key={i} style={{fontSize:'13px',color:'#0a0a0a',lineHeight:1.8,margin:'0 0 4px'}}>{line}</p>
                          ))}</div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* CREATOR PRODUCTION STUDIO */}
              <div style={{marginBottom:'16px'}}>
                <ProductionStudio briefId={briefId} source="creator" userRole="creator" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
