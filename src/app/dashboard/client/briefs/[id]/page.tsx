'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string,string> = {submitted:'Yeni',read:'Okundu',in_production:'Üretimde',revision:'Revizyon',approved:'Onaylandı',delivered:'Teslim Edildi'}

export default function ProducerBriefDetail() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [brief, setBrief] = useState<any>(null)
  const [creators, setCreators] = useState<any[]>([])
  const [voiceArtists, setVoiceArtists] = useState<any[]>([])
  const [producerBrief, setProducerBrief] = useState<any>(null)
  const [form, setForm] = useState({ producer_note: '', assigned_creator_id: '', assigned_voice_artist_id: '' })
  const [question, setQuestion] = useState('')
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: b } = await supabase.from('briefs').select('*, clients(company_name, logo_url, font_url)').eq('id', id).single()
    setBrief(b)
    if (b?.status === 'submitted') {
      await supabase.from('briefs').update({ status: 'read', read_at: new Date().toISOString() }).eq('id', id)
    }
    const { data: pb } = await supabase.from('producer_briefs').select('*, creators(*, users(name)), voice_artists(*, users(name))').eq('brief_id', id).single()
    setProducerBrief(pb)
    if (pb) setForm({ producer_note: pb.producer_note || '', assigned_creator_id: pb.assigned_creator_id || '', assigned_voice_artist_id: pb.assigned_voice_artist_id || '' })
    const { data: c } = await supabase.from('creators').select('*, users(name, email)').eq('is_active', true)
    setCreators(c || [])
    const { data: va } = await supabase.from('voice_artists').select('*, users(name, email)')
    setVoiceArtists(va || [])
    const { data: q } = await supabase.from('brief_questions').select('*').eq('brief_id', id).order('asked_at')
    setQuestions(q || [])
  }

  async function handleForward(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const { data: { user } } = await supabase.auth.getUser()

    if (producerBrief) {
      const { error } = await supabase.from('producer_briefs').update({
        producer_note: form.producer_note,
        assigned_creator_id: form.assigned_creator_id || null,
        assigned_voice_artist_id: form.assigned_voice_artist_id || null,
        forwarded_at: new Date().toISOString()
      }).eq('id', producerBrief.id)
      if (error) { setMsg('Hata: ' + error.message); setLoading(false); return }
    } else {
      const { error } = await supabase.from('producer_briefs').insert({
        brief_id: id,
        producer_id: user?.id,
        producer_note: form.producer_note,
        assigned_creator_id: form.assigned_creator_id || null,
        assigned_voice_artist_id: form.assigned_voice_artist_id || null,
        forwarded_at: new Date().toISOString()
      })
      if (error) { setMsg('Hata: ' + error.message); setLoading(false); return }
    }
    await supabase.from('briefs').update({ status: 'in_production' }).eq('id', id)
    setMsg("Brief creator'a iletildi.")
    loadData()
    setLoading(false)
  }

  async function handleQuestion(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('brief_questions').insert({ brief_id: id, question, asked_by: user?.id })
    setQuestion('')
    loadData()
  }

  async function handleStatusChange(status: string) {
    await supabase.from('briefs').update({ status }).eq('id', id)
    loadData()
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'system-ui,sans-serif',background:'#f7f6f2'}}>
      <div style={{width:'220px',background:'#0a0a0a',padding:'32px 0',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'0 24px 32px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:'20px',fontWeight:'500',color:'#fff'}}>dinamo</div>
          <div style={{fontSize:'11px',color:'#666',marginTop:'4px',letterSpacing:'1px',fontFamily:'monospace'}}>PRODÜKTÖR</div>
        </div>
        <nav style={{flex:1,padding:'24px 0'}}>
          <a href="/dashboard/producer" style={{display:'block',padding:'10px 24px',fontSize:'11px',color:'#888',textDecoration:'none',letterSpacing:'1px',fontFamily:'monospace'}}>← BRİEFLER</a>
        </nav>
      </div>

      <div style={{flex:1,padding:'48px',maxWidth:'900px'}}>
        {brief && (
          <>
            <div style={{marginBottom:'32px',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <h1 style={{fontSize:'28px',fontWeight:'400',letterSpacing:'-1px',margin:'0 0 8px',color:'#0a0a0a'}}>{brief.campaign_name}</h1>
                <div style={{fontSize:'14px',color:'#555'}}>{brief.clients?.company_name} · {brief.video_type}</div>
              </div>
              <span style={{fontSize:'11px',padding:'4px 12px',borderRadius:'100px',background:'#e8f7e8',color:'#1db81d',fontFamily:'monospace'}}>
                {statusLabel[brief.status] || brief.status}
              </span>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'24px'}}>
              <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>MÜŞTERİ BRİEFİ</div>
                {brief.video_type && <div style={{marginBottom:'12px'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>VİDEO TİPİ</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.video_type}</div></div>}
                {brief.format?.length > 0 && <div style={{marginBottom:'12px'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>FORMAT</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{Array.isArray(brief.format) ? brief.format.join(', ') : brief.format}</div></div>}
                {brief.message && <div style={{marginBottom:'12px'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>MESAJ</div><div style={{fontSize:'14px',color:'#0a0a0a',lineHeight:'1.6'}}>{brief.message}</div></div>}
                {brief.cta && <div style={{marginBottom:'12px'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>CTA</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.cta}</div></div>}
                {brief.target_audience && <div style={{marginBottom:'12px'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>HEDEF KİTLE</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.target_audience}</div></div>}
                {brief.voiceover_type && brief.voiceover_type !== 'none' && <div style={{marginBottom:'12px'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>SESLENDİRME</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.voiceover_type}</div></div>}
                {brief.voiceover_text && <div style={{marginBottom:'12px'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>SESLENDİRME METNİ</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.voiceover_text}</div></div>}
                {brief.notes && <div style={{marginBottom:'12px'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>NOTLAR</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.notes}</div></div>}
                <div><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>KREDİ</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.credit_cost} kredi</div></div>
              </div>

              <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px'}}>
                  <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>MARKA KİTİ</div>
                  {brief.clients?.logo_url && <div style={{marginBottom:'8px'}}><a href={brief.clients.logo_url} target="_blank" style={{fontSize:'13px',color:'#1db81d'}}>Logo İndir</a></div>}
                  {brief.clients?.font_url && <div><a href={brief.clients.font_url} target="_blank" style={{fontSize:'13px',color:'#1db81d'}}>Font İndir</a></div>}
                  {!brief.clients?.logo_url && !brief.clients?.font_url && <div style={{fontSize:'13px',color:'#888'}}>Marka kiti yüklenmemiş.</div>}
                </div>

                <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px'}}>
                  <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>DURUM DEĞİŞTİR</div>
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    {['in_production','revision','approved','delivered'].map(s=>(
                      <button key={s} onClick={()=>handleStatusChange(s)}
                        style={{padding:'6px 14px',borderRadius:'100px',border:'1px solid #e8e7e3',background:brief.status===s?'#0a0a0a':'#fff',color:brief.status===s?'#fff':'#555',fontSize:'12px',cursor:'pointer',fontFamily:'monospace'}}>
                        {statusLabel[s]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleForward} style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px',marginBottom:'24px'}}>
              <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>CREATOR'A İLET</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
                <div>
                  <label style={{display:'block',fontSize:'11px',color:'#555',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace'}}>CREATOR</label>
                  <select value={form.assigned_creator_id} onChange={e=>setForm({...form,assigned_creator_id:e.target.value})}
                    style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',background:'#fff',color:'#0a0a0a'}}>
                    <option value="">Seçin</option>
                    {creators.map(c=><option key={c.id} value={c.id}>{c.users?.name}</option>)}
                  </select>
                </div>
                {brief.voiceover_type === 'real' && (
                  <div>
                    <label style={{display:'block',fontSize:'11px',color:'#555',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace'}}>SESLENDİRME SANATÇISI</label>
                    <select value={form.assigned_voice_artist_id} onChange={e=>setForm({...form,assigned_voice_artist_id:e.target.value})}
                      style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',background:'#fff',color:'#0a0a0a'}}>
                      <option value="">Seçin</option>
                      {voiceArtists.map(va=><option key={va.id} value={va.id}>{va.users?.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div style={{marginBottom:'16px'}}>
                <label style={{display:'block',fontSize:'11px',color:'#555',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace'}}>PRODÜKTÖR NOTU</label>
                <textarea value={form.producer_note} onChange={e=>setForm({...form,producer_note:e.target.value})} rows={4}
                  style={{width:'100%',padding:'10px 14px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box',resize:'vertical',fontFamily:'system-ui,sans-serif',color:'#0a0a0a'}} />
              </div>
              {msg && <div style={{fontSize:'13px',color:msg.startsWith('Hata')?'#e24b4a':'#1db81d',marginBottom:'12px'}}>{msg}</div>}
              <button type="submit" disabled={loading}
                style={{padding:'11px 24px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}>
                {loading ? 'İletiliyor...' : producerBrief ? 'Güncelle' : "Creator'a İlet"}
              </button>
            </form>

            <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px'}}>
              <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>SORULAR</div>
              {questions.map(q=>(
                <div key={q.id} style={{marginBottom:'16px',padding:'12px 16px',background:'#f7f6f2',borderRadius:'8px'}}>
                  <div style={{fontSize:'13px',color:'#0a0a0a',marginBottom:'4px'}}>{q.question}</div>
                  {q.answer && <div style={{fontSize:'13px',color:'#1db81d'}}>↳ {q.answer}</div>}
                  {!q.answer && <div style={{fontSize:'12px',color:'#888'}}>Cevap bekleniyor...</div>}
                </div>
              ))}
              <form onSubmit={handleQuestion} style={{display:'flex',gap:'8px',marginTop:'16px'}}>
                <input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Müşteriye soru sor..."
                  style={{flex:1,padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',color:'#0a0a0a'}} />
                <button type="submit" style={{padding:'9px 20px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',cursor:'pointer'}}>Gönder</button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}