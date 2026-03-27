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
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadData() }, [briefId])

  async function loadData() {
    const { data: b } = await supabase.from('briefs').select('*, clients(company_name, logo_url, font_url)').eq('id', briefId).single()
    setBrief(b)
    const { data: pb } = await supabase.from('producer_briefs').select('*').eq('brief_id', briefId).single()
    setProducerBrief(pb)
    const { data: s } = await supabase.from('video_submissions').select('*').eq('brief_id', briefId).order('submitted_at', {ascending: false})
    setSubmissions(s || [])
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: creatorData } = await supabase.from('creators').select('id').eq('user_id', user?.id).single()
    const fileName = `${briefId}/${Date.now()}_${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage.from('videos').upload(fileName, file)
    if (uploadError) { setMsg(uploadError.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
    const version = submissions.length + 1
    await supabase.from('video_submissions').insert({
      brief_id: briefId,
      creator_id: creatorData?.id,
      video_url: urlData.publicUrl,
      version,
      status: 'pending',
    })
    setMsg('Video yüklendi, prodüktör onayı bekleniyor.')
    if (fileRef.current) fileRef.current.value = ''
    loadData()
    setUploading(false)
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'system-ui,sans-serif',background:'#f7f6f2'}}>
      <div style={{width:'220px',background:'#0a0a0a',padding:'32px 0',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'0 24px 32px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:'20px',fontWeight:'500',color:'#fff'}}>dinamo</div>
          <div style={{fontSize:'11px',color:'#666',marginTop:'4px',letterSpacing:'1px',fontFamily:'monospace'}}>CREATOR</div>
        </div>
        <nav style={{flex:1,padding:'24px 0'}}>
          <a href="/dashboard/creator" style={{display:'block',padding:'10px 24px',fontSize:'11px',color:'#888',textDecoration:'none',letterSpacing:'1px',fontFamily:'monospace'}}>← İŞLERİM</a>
        </nav>
      </div>

      <div style={{flex:1,padding:'48px',maxWidth:'800px'}}>
        {brief && (
          <>
            <div style={{marginBottom:'32px'}}>
              <h1 style={{fontSize:'28px',fontWeight:'400',letterSpacing:'-1px',margin:'0 0 8px',color:'#0a0a0a'}}>{brief.campaign_name}</h1>
              <div style={{fontSize:'14px',color:'#555'}}>{brief.clients?.company_name} · {brief.video_type}</div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'24px'}}>
              <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>BRİEF</div>
                {[
                  {label:'Video Tipi', value: brief.video_type},
                  {label:'Format', value: brief.format?.join(', ')},
                  {label:'Mesaj', value: brief.message},
                  {label:'CTA', value: brief.cta},
                  {label:'Hedef Kitle', value: brief.target_audience},
                  {label:'Seslendirme', value: brief.voiceover_type},
                  {label:'Seslendirme Metni', value: brief.voiceover_text},
                  {label:'Notlar', value: brief.notes},
                ].filter(f=>f.value).map(f=>(
                  <div key={f.label} style={{marginBottom:'12px'}}>
                    <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'4px'}}>{f.label.toUpperCase()}</div>
                    <div style={{fontSize:'14px',color:'#0a0a0a'}}>{f.value}</div>
                  </div>
                ))}
              </div>

              <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                {producerBrief?.producer_note && (
                  <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px'}}>
                    <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'12px'}}>PRODÜKTÖR NOTU</div>
                    <div style={{fontSize:'14px',color:'#0a0a0a',lineHeight:'1.6'}}>{producerBrief.producer_note}</div>
                  </div>
                )}
                <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px'}}>
                  <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>MARKA KİTİ</div>
                  {brief.clients?.logo_url && <div style={{marginBottom:'8px'}}><a href={brief.clients.logo_url} target="_blank" style={{fontSize:'13px',color:'#1db81d'}}>Logo İndir</a></div>}
                  {brief.clients?.font_url && <div><a href={brief.clients.font_url} target="_blank" style={{fontSize:'13px',color:'#1db81d'}}>Font İndir</a></div>}
                  {!brief.clients?.logo_url && !brief.clients?.font_url && <div style={{fontSize:'13px',color:'#888'}}>Marka kiti yüklenmemiş.</div>}
                </div>
              </div>
            </div>

            <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px',marginBottom:'24px'}}>
              <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>VİDEO YÜKLE</div>
              <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
                <input ref={fileRef} type="file" accept="video/*"
                  style={{flex:1,padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',color:'#0a0a0a'}} />
                <button onClick={handleUpload} disabled={uploading}
                  style={{padding:'10px 20px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',cursor:'pointer',whiteSpace:'nowrap'}}>
                  {uploading ? 'Yükleniyor...' : 'Yükle'}
                </button>
              </div>
              {msg && <div style={{fontSize:'13px',color:'#1db81d',marginTop:'12px'}}>{msg}</div>}
            </div>

            {submissions.length > 0 && (
              <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>YÜKLEDİKLERİM</div>
                {submissions.map((s,i)=>(
                  <div key={s.id} style={{marginBottom:i<submissions.length-1?'16px':'0',padding:'12px 16px',background:'#f7f6f2',borderRadius:'8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>Versiyon {s.version}</div>
                      <div style={{fontSize:'12px',color:'#888',marginTop:'2px'}}>{new Date(s.submitted_at).toLocaleDateString('tr-TR')}</div>
                    </div>
                    <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                      <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'100px',background:s.status==='pending'?'#f7f6f2':s.status==='producer_approved'||s.status==='admin_approved'?'#e8f7e8':'#fef2f2',color:s.status==='pending'?'#888':s.status==='producer_approved'||s.status==='admin_approved'?'#1db81d':'#e24b4a',fontFamily:'monospace'}}>
                        {s.status==='pending'?'Bekliyor':s.status==='revision_requested'?'Revizyon':s.status==='producer_approved'?'Onaylandı':'Onaylandı'}
                      </span>
                      <a href={s.video_url} target="_blank" style={{fontSize:'12px',color:'#1db81d'}}>Görüntüle</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
