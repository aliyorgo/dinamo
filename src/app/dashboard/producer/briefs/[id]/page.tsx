'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string,string> = {
  submitted:'Yeni', read:'Okundu', in_production:'Üretimde',
  revision:'Revizyon', approved:'Onay Bekliyor', delivered:'Teslim Edildi'
}

const REVISION_CREDIT_COST = 4

// Creator kazanç kaydı oluştur
async function recordCreatorEarning(briefId: string, submissionId: string) {
  const { data: pb } = await supabase.from('producer_briefs').select('assigned_creator_id').eq('brief_id', briefId).maybeSingle()
  if (!pb?.assigned_creator_id) return
  const { data: brief } = await supabase.from('briefs').select('credit_cost, campaign_name').eq('id', briefId).single()
  if (!brief) return
  const { data: rate } = await supabase.from('admin_settings').select('value').eq('key', 'creator_credit_rate').maybeSingle()
  const tlRate = parseFloat(rate?.value || '500')
  const creatorCredits = brief.credit_cost // Creator tüm brief kredisini kazanır
  await supabase.from('creator_earnings').insert({
    brief_id: briefId,
    creator_id: pb.assigned_creator_id,
    video_submission_id: submissionId,
    credits: creatorCredits,
    tl_rate: tlRate,
    tl_amount: creatorCredits * tlRate,
    paid: false
  })
}

// Müşteri kredi kesimi
async function deductClientCredits(briefId: string) {
  const { data: brief } = await supabase.from('briefs').select('credit_cost, client_id, client_user_id, campaign_name').eq('id', briefId).single()
  if (!brief?.client_user_id) return
  const { data: cu } = await supabase.from('client_users').select('credit_balance').eq('id', brief.client_user_id).single()
  if (!cu) return
  const newBalance = Math.max(0, cu.credit_balance - (brief.credit_cost || 0))
  await supabase.from('client_users').update({ credit_balance: newBalance }).eq('id', brief.client_user_id)
  await supabase.from('credit_transactions').insert({
    client_id: brief.client_id,
    client_user_id: brief.client_user_id,
    brief_id: briefId,
    amount: -(brief.credit_cost || 0),
    type: 'deduct',
    description: `${brief.campaign_name} — teslim`
  })
}

export default function ProducerBriefDetail() {
  const params = useParams()
  const id = params.id as string
  const [brief, setBrief] = useState<any>(null)
  const [creators, setCreators] = useState<any[]>([])
  const [voiceArtists, setVoiceArtists] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [approvalDelegated, setApprovalDelegated] = useState(false)
  const [form, setForm] = useState({ producer_note: '', assigned_creator_id: '', assigned_voice_artist_id: '' })
  const [revisionNotes, setRevisionNotes] = useState<Record<string,string>>({})
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
    const { data: pb } = await supabase.from('producer_briefs').select('*').eq('brief_id', id).maybeSingle()
    if (pb) setForm({ producer_note: pb.producer_note || '', assigned_creator_id: pb.assigned_creator_id || '', assigned_voice_artist_id: pb.assigned_voice_artist_id || '' })
    const { data: c } = await supabase.from('creators').select('*, users(name, email)').eq('is_active', true)
    setCreators(c || [])
    const { data: va } = await supabase.from('voice_artists').select('*, users(name, email)')
    setVoiceArtists(va || [])
    const { data: q } = await supabase.from('brief_questions').select('*').eq('brief_id', id).order('asked_at')
    setQuestions(q || [])
    const { data: s } = await supabase.from('video_submissions').select('*').eq('brief_id', id).order('version', { ascending: false })
    setSubmissions(s || [])
    const { data: settings } = await supabase.from('admin_settings').select('value').eq('key', 'approval_delegated_to_producer').maybeSingle()
    setApprovalDelegated(settings?.value === 'true')
  }

  async function handleForward(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    const creatorId = form.assigned_creator_id && form.assigned_creator_id.length > 10 ? form.assigned_creator_id : null
    const voiceId = form.assigned_voice_artist_id && form.assigned_voice_artist_id.length > 10 ? form.assigned_voice_artist_id : null
    await supabase.from('producer_briefs').delete().eq('brief_id', id)
    const { error } = await supabase.from('producer_briefs').insert({
      brief_id: id,
      producer_id: user?.id,
      producer_note: form.producer_note,
      assigned_creator_id: creatorId,
      assigned_voice_artist_id: voiceId,
      forwarded_at: new Date().toISOString()
    })
    if (error) { setMsg('Hata: ' + error.message); setLoading(false); return }
    await supabase.from('briefs').update({ status: 'in_production' }).eq('id', id)
    setMsg("Brief creator'a iletildi.")
    loadData()
    setLoading(false)
  }

  async function handleApprove(submissionId: string) {
    setLoading(true)
    setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('video_submissions').update({ status: 'producer_approved' }).eq('id', submissionId)
    await supabase.from('approvals').insert({ video_submission_id: submissionId, approved_by: user?.id, role: 'producer' })

    if (approvalDelegated) {
      // Yetki devredilmiş: müşteriye ilet, kredi kes, creator kazancı kaydet
      await supabase.from('briefs').update({ status: 'approved' }).eq('id', id)
      await recordCreatorEarning(id, submissionId)
      setMsg('Video onaylandı, müşteriye iletildi.')
    } else {
      // Admin onayına gönder
      await supabase.from('briefs').update({ status: 'approved' }).eq('id', id)
      setMsg('Video onaylandı, admin onayına gönderildi.')
    }
    loadData()
    setLoading(false)
  }

  async function handleRevision(submissionId: string) {
    const note = revisionNotes[submissionId]
    if (!note?.trim()) { setMsg('Revizyon notu yazmak zorunludur.'); return }
    setLoading(true)
    await supabase.from('video_submissions').update({ status: 'revision_requested', producer_notes: note }).eq('id', submissionId)
    await supabase.from('briefs').update({ status: 'revision' }).eq('id', id)
    await supabase.from('brief_questions').insert({ brief_id: id, question: `İÇ REVİZYON: ${note}` })
    setMsg('Revizyon talebi creator\'a iletildi.')
    loadData()
    setLoading(false)
  }

  async function handleClientApprove() {
    if (!brief) return
    setLoading(true)
    await deductClientCredits(id)
    await supabase.from('briefs').update({ status: 'delivered' }).eq('id', id)
    setMsg('Müşteri adına onaylandı, kredi kesildi.')
    loadData()
    setLoading(false)
  }

  async function handleQuestion(e: React.FormEvent<HTMLFormElement>) {
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

  const unansweredQuestions = questions.filter(q =>
    !q.question.startsWith('REVİZYON:') &&
    !q.question.startsWith('İÇ REVİZYON:') &&
    !q.answer
  )
  const clientRevisions = questions.filter(q => q.question.startsWith('REVİZYON:'))

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
            <div style={{marginBottom:'24px',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <h1 style={{fontSize:'28px',fontWeight:'400',letterSpacing:'-1px',margin:'0 0 8px',color:'#0a0a0a'}}>{brief.campaign_name}</h1>
                <div style={{fontSize:'14px',color:'#555'}}>{brief.clients?.company_name} · {brief.video_type}</div>
              </div>
              <span style={{fontSize:'11px',padding:'4px 12px',borderRadius:'100px',background:'#e8f7e8',color:'#1db81d',fontFamily:'monospace'}}>
                {brief.status === 'revision' && clientRevisions.length > 0 ? 'Müşteri Revizyonu' : statusLabel[brief.status] || brief.status}
              </span>
            </div>

            {msg && <div style={{padding:'12px 16px',background:msg.startsWith('Hata')||msg.includes('zorunlu')?'#fef2f2':'#e8f7e8',borderRadius:'8px',fontSize:'13px',color:msg.startsWith('Hata')||msg.includes('zorunlu')?'#e24b4a':'#1db81d',marginBottom:'24px'}}>{msg}</div>}

            {/* MÜŞTERİ REVİZYONU — TEPEDE KIRMIZI */}
            {clientRevisions.length > 0 && (
              <div style={{background:'#fff',border:'2px solid #e24b4a',borderRadius:'12px',padding:'24px',marginBottom:'24px'}}>
                <div style={{fontSize:'11px',color:'#e24b4a',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px',display:'flex',alignItems:'center',gap:'8px'}}>
                  <span style={{width:'8px',height:'8px',borderRadius:'50%',background:'#e24b4a',display:'inline-block'}}></span>
                  MÜŞTERİ REVİZYONU ({clientRevisions.length})
                </div>
                {clientRevisions.map((r,i)=>(
                  <div key={r.id} style={{marginBottom:'8px',padding:'12px 16px',background:'#fef2f2',borderRadius:'8px'}}>
                    <div style={{fontSize:'12px',color:'#e24b4a',fontFamily:'monospace',marginBottom:'4px'}}>
                      {i+1}. REVİZYON {i===0?'(Ücretsiz)':`(${REVISION_CREDIT_COST} Kredi)`}
                    </div>
                    <div style={{fontSize:'14px',color:'#0a0a0a',lineHeight:'1.5'}}>{r.question.replace('REVİZYON: ','')}</div>
                  </div>
                ))}
              </div>
            )}

            {/* CEVAP BEKLEYEN SORULAR */}
            {unansweredQuestions.length > 0 && (
              <div style={{background:'#fff',border:'2px solid #1db81d',borderRadius:'12px',padding:'24px',marginBottom:'24px'}}>
                <div style={{fontSize:'11px',color:'#1db81d',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'12px'}}>MÜŞTERİ CEVAP BEKLİYOR ({unansweredQuestions.length})</div>
                {unansweredQuestions.map(q=>(
                  <div key={q.id} style={{padding:'10px 14px',background:'#f7f6f2',borderRadius:'8px',marginBottom:'8px'}}>
                    <div style={{fontSize:'13px',color:'#0a0a0a'}}>{q.question}</div>
                  </div>
                ))}
              </div>
            )}

            {/* MÜŞTERİ ONAY BUTONU */}
            {brief.status === 'approved' && (
              <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'20px 24px',marginBottom:'24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{fontSize:'13px',color:'#555'}}>Müşteri henüz onaylamadı.</div>
                <button onClick={handleClientApprove} disabled={loading}
                  style={{padding:'9px 20px',background:'#1db81d',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontWeight:'500'}}>
                  Müşteri Onayladı
                </button>
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'24px'}}>
              <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>MÜŞTERİ BRİEFİ</div>
                {brief.video_type && <div style={{marginBottom:'10px'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'3px'}}>VİDEO TİPİ</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.video_type}</div></div>}
                {brief.format?.length > 0 && <div style={{marginBottom:'10px'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'3px'}}>FORMAT</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{Array.isArray(brief.format)?brief.format.join(', '):brief.format}</div></div>}
                {brief.message && <div style={{marginBottom:'10px'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'3px'}}>MESAJ</div><div style={{fontSize:'14px',color:'#0a0a0a',lineHeight:'1.5'}}>{brief.message}</div></div>}
                {brief.cta && <div style={{marginBottom:'10px'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'3px'}}>CTA</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.cta}</div></div>}
                {brief.target_audience && <div style={{marginBottom:'10px'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'3px'}}>HEDEF KİTLE</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.target_audience}</div></div>}
                {brief.voiceover_type && brief.voiceover_type !== 'none' && <div style={{marginBottom:'10px'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'3px'}}>SESLENDİRME</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.voiceover_type}</div></div>}
                {brief.voiceover_text && <div style={{marginBottom:'10px'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'3px'}}>SESLENDİRME METNİ</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.voiceover_text}</div></div>}
                {brief.notes && <div style={{marginBottom:'10px'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'3px'}}>NOTLAR</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.notes}</div></div>}
                <div><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'3px'}}>KREDİ</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.credit_cost} kredi</div></div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px'}}>
                  <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>MARKA KİTİ</div>
                  {brief.clients?.logo_url ? <a href={brief.clients.logo_url} target="_blank" style={{display:'block',fontSize:'13px',color:'#1db81d',marginBottom:'8px'}}>Logo İndir</a> : null}
                  {brief.clients?.font_url ? <a href={brief.clients.font_url} target="_blank" style={{display:'block',fontSize:'13px',color:'#1db81d'}}>Font İndir</a> : null}
                  {!brief.clients?.logo_url && !brief.clients?.font_url && <div style={{fontSize:'13px',color:'#888'}}>Marka kiti yüklenmemiş.</div>}
                </div>
                <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px'}}>
                  <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>DURUM DEĞİŞTİR</div>
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    {['in_production','revision','approved','delivered'].map(s=>(
                      <button key={s} onClick={()=>handleStatusChange(s)}
                        style={{padding:'6px 14px',borderRadius:'100px',border:'1px solid #e8e7e3',background:brief.status===s?'#0a0a0a':'#fff',color:brief.status===s?'#fff':'#555',fontSize:'11px',cursor:'pointer',fontFamily:'monospace'}}>
                        {statusLabel[s]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* VİDEO GÖNDERİMLERİ */}
            {submissions.length > 0 && (
              <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden',marginBottom:'24px'}}>
                <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace'}}>
                  VİDEO GÖNDERİMLERİ ({submissions.length})
                </div>
                {submissions.map((s,i)=>(
                  <div key={s.id} style={{padding:'24px',borderBottom:i<submissions.length-1?'1px solid #f0f0ee':'none'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
                      <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>Versiyon {s.version}</div>
                      <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'100px',background:'#f0f0ee',color:'#666',fontFamily:'monospace'}}>{s.status}</span>
                    </div>
                    <video controls style={{width:'100%',borderRadius:'8px',background:'#000',marginBottom:'16px',maxHeight:'300px'}}>
                      <source src={s.video_url} />
                    </video>
                    {s.status === 'pending' && (
                      <div>
                        <button onClick={()=>handleApprove(s.id)} disabled={loading}
                          style={{padding:'9px 20px',background:'#1db81d',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontWeight:'500',marginBottom:'12px',display:'block'}}>
                          {approvalDelegated ? 'Onayla & Müşteriye İlet' : 'Onayla → Admin Onayına Gönder'}
                        </button>
                        <textarea
                          value={revisionNotes[s.id] || ''}
                          onChange={e=>setRevisionNotes(prev=>({...prev,[s.id]:e.target.value}))}
                          placeholder="Revizyon notu (zorunlu)..." rows={2}
                          style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box',resize:'vertical',fontFamily:'system-ui,sans-serif',color:'#0a0a0a',marginBottom:'8px'}} />
                        <button onClick={()=>handleRevision(s.id)} disabled={loading}
                          style={{padding:'9px 20px',background:'#fff',color:'#e24b4a',border:'1px solid #e24b4a',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>
                          Revizyon İste (Creator'a)
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* CREATOR'A İLET */}
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
                <textarea value={form.producer_note} onChange={e=>setForm({...form,producer_note:e.target.value})} rows={3}
                  style={{width:'100%',padding:'10px 14px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box',resize:'vertical',fontFamily:'system-ui,sans-serif',color:'#0a0a0a'}} />
              </div>
              <button type="submit" disabled={loading}
                style={{padding:'11px 24px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}>
                {loading ? 'İletiliyor...' : "Creator'a İlet"}
              </button>
            </form>

            {/* SORULAR */}
            <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px'}}>
              <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>SORULAR</div>
              {questions.filter(q=>!q.question.startsWith('İÇ REVİZYON:')&&!q.question.startsWith('REVİZYON:')).length === 0 && (
                <div style={{fontSize:'13px',color:'#888',marginBottom:'16px'}}>Henüz soru yok.</div>
              )}
              {questions.filter(q=>!q.question.startsWith('İÇ REVİZYON:')&&!q.question.startsWith('REVİZYON:')).map(q=>(
                <div key={q.id} style={{marginBottom:'12px',padding:'12px 16px',background:'#f7f6f2',borderRadius:'8px'}}>
                  <div style={{fontSize:'13px',color:'#0a0a0a',marginBottom:'4px'}}>{q.question}</div>
                  {q.answer ? <div style={{fontSize:'13px',color:'#1db81d'}}>↳ {q.answer}</div> : <div style={{fontSize:'12px',color:'#888'}}>Cevap bekleniyor...</div>}
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
