'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
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
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setMsg('Dosya seçin.'); return }
    setUploading(true)
    setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: cd } = await supabase.from('creators').select('id').eq('user_id', user?.id).maybeSingle()
    if (!cd) { setMsg('Creator kaydı bulunamadı.'); setUploading(false); return }
    const ext = file.name.split('.').pop()
    const fileName = `${briefId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('videos').upload(fileName, file)
    if (upErr) { setMsg(upErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
    const { error: insErr } = await supabase.from('video_submissions').insert({ brief_id: briefId, creator_id: cd.id, video_url: urlData.publicUrl, version: submissions.length + 1, status: 'pending' })
    if (insErr) { setMsg(insErr.message); setUploading(false); return }
    setMsg('Video yüklendi, prodüktör onayı bekleniyor.')
    if (fileRef.current) fileRef.current.value = ''
    loadData()
    setUploading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const internalRevisions = revisions.filter(r => r.question.startsWith('İÇ REVİZYON:'))
  const clientRevisions = revisions.filter(r => r.question.startsWith('REVİZYON:'))

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');`}</style>

      <div style={{width:'220px',background:'#111113',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'15px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'12px'}}>
            dinam<span style={{display:'inline-block',width:'9px',height:'9px',borderRadius:'50%',border:'2px solid #22c55e',position:'relative',top:'1px'}}></span>
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
            <span style={{fontSize:'11px',color:'rgba(255,255,255,0.25)',fontFamily:'Inter,sans-serif'}}>Çıkış yap</span>
          </button>
        </div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f5f4f0',overflow:'hidden'}}>
        <div style={{padding:'14px 28px',background:'#fff',borderBottom:'0.5px solid rgba(0,0,0,0.08)',flexShrink:0}}>
          <div style={{fontSize:'12px',color:'#888'}}>İşlerim / <span style={{color:'#0a0a0a',fontWeight:'500'}}>{brief?.campaign_name}</span></div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>
          {brief && (
            <>
              {(internalRevisions.length > 0 || clientRevisions.length > 0) && (
                <div style={{background:'#fff',border:'2px solid #ef4444',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px'}}>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#ef4444'}}></div>
                    <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Revizyon Talepleri</div>
                  </div>
                  {internalRevisions.map((r,i)=>(
                    <div key={r.id} style={{padding:'10px 14px',background:'#fef2f2',borderRadius:'8px',marginBottom:'6px'}}>
                      <div style={{fontSize:'10px',color:'#ef4444',fontWeight:'500',marginBottom:'3px',textTransform:'uppercase',letterSpacing:'0.3px'}}>Prodüktör / Admin</div>
                      <div style={{fontSize:'13px',color:'#0a0a0a'}}>{r.question.replace('İÇ REVİZYON: ','')}</div>
                    </div>
                  ))}
                  {clientRevisions.map((r,i)=>(
                    <div key={r.id} style={{padding:'10px 14px',background:'#fef2f2',borderRadius:'8px',marginBottom:'6px'}}>
                      <div style={{fontSize:'10px',color:'#ef4444',fontWeight:'500',marginBottom:'3px',textTransform:'uppercase',letterSpacing:'0.3px'}}>Müşteri Revizyonu</div>
                      <div style={{fontSize:'13px',color:'#0a0a0a'}}>{r.question.replace('REVİZYON: ','')}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px'}}>
                  <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'14px'}}>Brief</div>
                  {[
                    {label:'Video Tipi', value: brief.video_type},
                    {label:'Format', value: Array.isArray(brief.format)?brief.format.join(', '):brief.format},
                    {label:'Mesaj', value: brief.message},
                    {label:'CTA', value: brief.cta},
                    {label:'Hedef Kitle', value: brief.target_audience},
                    {label:'Seslendirme', value: brief.voiceover_type==='real'?'Gerçek Seslendirme':brief.voiceover_type==='ai'?'AI Seslendirme':null},
                    {label:'Seslendirme Metni', value: brief.voiceover_text},
                    {label:'Notlar', value: brief.notes},
                  ].filter(f=>f.value).map(f=>(
                    <div key={f.label} style={{marginBottom:'10px'}}>
                      <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'3px'}}>{f.label}</div>
                      <div style={{fontSize:'13px',color:'#0a0a0a',lineHeight:'1.5'}}>{f.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                  {producerBrief?.producer_note && (
                    <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px 20px'}}>
                      <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>Prodüktör Notu</div>
                      <div style={{fontSize:'13px',color:'#0a0a0a',lineHeight:'1.6'}}>{producerBrief.producer_note}</div>
                    </div>
                  )}
                  <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px 20px'}}>
                    <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>Marka Kiti</div>
                    {brief.clients?.logo_url&&<a href={brief.clients.logo_url} target="_blank" style={{display:'block',fontSize:'12px',color:'#22c55e',marginBottom:'6px',textDecoration:'none'}}>Logo İndir ↓</a>}
                    {brief.clients?.font_url&&<a href={brief.clients.font_url} target="_blank" style={{display:'block',fontSize:'12px',color:'#22c55e',textDecoration:'none'}}>Font İndir ↓</a>}
                    {!brief.clients?.logo_url&&!brief.clients?.font_url&&<div style={{fontSize:'12px',color:'#888'}}>Marka kiti yüklenmemiş.</div>}
                  </div>
                </div>
              </div>

              <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'14px'}}>Video Yükle</div>
                <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap'}}>
                  <input ref={fileRef} type="file" accept="video/*" style={{flex:1,fontSize:'13px',color:'#0a0a0a',minWidth:'200px'}} />
                  <button onClick={handleUpload} disabled={uploading} style={{padding:'9px 20px',background:'#111113',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:'500',whiteSpace:'nowrap'}}>
                    {uploading?'Yükleniyor...':'Yükle'}
                  </button>
                </div>
                {msg&&<div style={{fontSize:'12px',color:msg.includes('bulunamadı')||msg.includes('seçin')?'#ef4444':'#22c55e',marginTop:'10px'}}>{msg}</div>}
              </div>

              {submissions.length > 0 && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px'}}>
                  <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'14px'}}>Yüklediklerim</div>
                  {submissions.map((s,i)=>(
                    <div key={s.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<submissions.length-1?'0.5px solid rgba(0,0,0,0.06)':'none'}}>
                      <div>
                        <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>Versiyon {s.version}</div>
                        <div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>{new Date(s.submitted_at).toLocaleDateString('tr-TR')}</div>
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
