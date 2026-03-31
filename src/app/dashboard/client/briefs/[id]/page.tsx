'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string,string> = {submitted:'İnceleniyor',read:'İncelendi',in_production:'Üretimde',revision:'Revizyon',approved:'Onaylandı',delivered:'Teslim Edildi'}
const statusColor: Record<string,string> = {submitted:'#888',read:'#888',in_production:'#f59e0b',revision:'#e24b4a',approved:'#1db81d',delivered:'#1db81d'}

export default function ClientBriefDetail() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [brief, setBrief] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [answers, setAnswers] = useState<Record<string,string>>({})
  const [videos, setVideos] = useState<any[]>([])
  const [revisionNote, setRevisionNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: b } = await supabase.from('briefs').select('*, clients(company_name)').eq('id', id).single()
    setBrief(b)
    const { data: q } = await supabase.from('brief_questions').select('*').eq('brief_id', id).order('asked_at')
    setQuestions(q || [])
    const { data: v } = await supabase.from('video_submissions').select('*').eq('brief_id', id).order('submitted_at', {ascending: false})
    setVideos(v || [])
  }

  async function handleAnswer(questionId: string) {
    const answer = answers[questionId]
    if (!answer?.trim()) return
    await supabase.from('brief_questions').update({ answer, answered_at: new Date().toISOString() }).eq('id', questionId)
    setAnswers(prev => ({...prev, [questionId]: ''}))
    loadData()
  }

  async function handleRevision(e: React.FormEvent) {
    e.preventDefault()
    if (!revisionNote.trim()) return
    setLoading(true)
    await supabase.from('briefs').update({ status: 'revision' }).eq('id', id)
    await supabase.from('brief_questions').insert({ brief_id: id, question: `REVİZYON: ${revisionNote}` })
    setRevisionNote('')
    setMsg('Revizyon talebi gönderildi.')
    loadData()
    setLoading(false)
  }

  const latestVideo = videos[0]

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'system-ui,sans-serif',background:'#f7f6f2'}}>
      <div style={{width:'220px',background:'#0a0a0a',padding:'32px 0',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'0 24px 32px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:'20px',fontWeight:'500',color:'#fff'}}>dinamo</div>
          <div style={{fontSize:'11px',color:'#666',marginTop:'4px',letterSpacing:'1px',fontFamily:'monospace'}}>MÜŞTERİ</div>
        </div>
        <nav style={{flex:1,padding:'24px 0'}}>
          <a href="/dashboard/client" style={{display:'block',padding:'10px 24px',fontSize:'11px',color:'#888',textDecoration:'none',letterSpacing:'1px',fontFamily:'monospace'}}>← PROJELERİM</a>
          <a href="/dashboard/client/brief/new" style={{display:'block',padding:'10px 24px',fontSize:'11px',color:'#888',textDecoration:'none',letterSpacing:'1px',fontFamily:'monospace'}}>YENİ BRİEF</a>
        </nav>
      </div>

      <div style={{flex:1,padding:'48px',maxWidth:'800px'}}>
        {brief && (
          <>
            <div style={{marginBottom:'32px',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <h1 style={{fontSize:'28px',fontWeight:'400',letterSpacing:'-1px',margin:'0 0 8px',color:'#0a0a0a'}}>{brief.campaign_name}</h1>
                <div style={{fontSize:'14px',color:'#555'}}>{brief.video_type} · {new Date(brief.created_at).toLocaleDateString('tr-TR')}</div>
              </div>
              <span style={{fontSize:'11px',padding:'4px 12px',borderRadius:'100px',background:`${statusColor[brief.status]}15`,color:statusColor[brief.status],fontFamily:'monospace'}}>
                {statusLabel[brief.status] || brief.status}
              </span>
            </div>

            {latestVideo && (brief.status === 'approved' || brief.status === 'delivered') && (
              <div style={{background:'#fff',border:'1px solid rgba(29,184,29,0.3)',borderRadius:'12px',padding:'24px',marginBottom:'24px'}}>
                <div style={{fontSize:'11px',color:'#1db81d',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>VİDEONUZ HAZIR</div>
                <video controls style={{width:'100%',borderRadius:'8px',background:'#000'}}>
                  <source src={latestVideo.video_url} />
                </video>
                <a href={latestVideo.video_url} download target="_blank"
                  style={{display:'inline-block',marginTop:'12px',padding:'10px 20px',background:'#0a0a0a',color:'#fff',borderRadius:'8px',fontSize:'13px',textDecoration:'none'}}>
                  İndir
                </a>
              </div>
            )}

            {brief.status === 'in_production' && (
              <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px',marginBottom:'24px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'12px'}}>DURUM</div>
                <div style={{fontSize:'14px',color:'#0a0a0a'}}>Videonuz üretim aşamasında. 24 saat içinde teslim edilecek.</div>
              </div>
            )}

            {questions.length > 0 && (
              <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px',marginBottom:'24px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>SORULAR</div>
                {questions.map(q=>(
                  <div key={q.id} style={{marginBottom:'16px',padding:'12px 16px',background:'#f7f6f2',borderRadius:'8px'}}>
                    <div style={{fontSize:'13px',color:'#0a0a0a',marginBottom:'8px'}}>{q.question}</div>
                    {q.answer ? (
                      <div style={{fontSize:'13px',color:'#1db81d'}}>↳ {q.answer}</div>
                    ) : (
                      <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
                        <input value={answers[q.id] || ''} onChange={e=>setAnswers(prev=>({...prev,[q.id]:e.target.value}))}
                          placeholder="Cevabınız..." style={{flex:1,padding:'7px 12px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a'}} />
                        <button onClick={()=>handleAnswer(q.id)} style={{padding:'7px 16px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>Gönder</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {(brief.status === 'in_production' || brief.status === 'approved') && (
              <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>REVİZYON TALEBİ</div>
                <form onSubmit={handleRevision}>
                  <textarea value={revisionNote} onChange={e=>setRevisionNote(e.target.value)} placeholder="Revizyon notunuzu yazın..." rows={3}
                    style={{width:'100%',padding:'10px 14px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box',resize:'vertical',fontFamily:'system-ui,sans-serif',color:'#0a0a0a',marginBottom:'12px'}} />
                  {msg && <div style={{fontSize:'13px',color:'#1db81d',marginBottom:'12px'}}>{msg}</div>}
                  <button type="submit" disabled={loading}
                    style={{padding:'10px 20px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',cursor:'pointer'}}>
                    {loading ? 'Gönderiliyor...' : 'Revizyon Talep Et'}
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
