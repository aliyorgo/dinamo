'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams, useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string,string> = { submitted:'Yeni', read:'Okundu', in_production:'Üretimde', revision:'Revizyon', approved:'Onay Bekliyor', delivered:'Teslim Edildi' }

async function recordCreatorEarning(briefId: string, submissionId: string) {
  const { data: pb } = await supabase.from('producer_briefs').select('assigned_creator_id').eq('brief_id', briefId).maybeSingle()
  if (!pb?.assigned_creator_id) return
  const { data: b } = await supabase.from('briefs').select('credit_cost').eq('id', briefId).single()
  if (!b) return
  const { data: rate } = await supabase.from('admin_settings').select('value').eq('key', 'creator_credit_rate').maybeSingle()
  const tlRate = parseFloat((rate as any)?.value || '500')
  await supabase.from('creator_earnings').insert({ brief_id: briefId, creator_id: pb.assigned_creator_id, video_submission_id: submissionId, credits: b.credit_cost, tl_rate: tlRate, tl_amount: b.credit_cost * tlRate, paid: false })
}

async function deductClientCredits(briefId: string) {
  const { data: b } = await supabase.from('briefs').select('credit_cost, client_id, client_user_id, campaign_name').eq('id', briefId).single()
  if (!b?.client_user_id) return
  const { data: cu } = await supabase.from('client_users').select('credit_balance').eq('id', b.client_user_id).single()
  if (!cu) return
  const newBal = Math.max(0, cu.credit_balance - (b.credit_cost || 0))
  await supabase.from('client_users').update({ credit_balance: newBal }).eq('id', b.client_user_id)
  await supabase.from('credit_transactions').insert({ client_id: b.client_id, client_user_id: b.client_user_id, brief_id: briefId, amount: -(b.credit_cost||0), type: 'deduct', description: `${b.campaign_name} — teslim` })
}

export default function ProducerBriefDetail() {
  const params = useParams()
  const router = useRouter()
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
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) { const { data: ud } = await supabase.from('users').select('name').eq('id', user.id).single(); setUserName(ud?.name||'') }
    const { data: b } = await supabase.from('briefs').select('*, clients(company_name, logo_url, font_url)').eq('id', id).single()
    setBrief(b)
    if (b?.status==='submitted') await supabase.from('briefs').update({ status:'read', read_at: new Date().toISOString() }).eq('id', id)
    const { data: pb } = await supabase.from('producer_briefs').select('*').eq('brief_id', id).maybeSingle()
    if (pb) setForm({ producer_note: pb.producer_note||'', assigned_creator_id: pb.assigned_creator_id||'', assigned_voice_artist_id: pb.assigned_voice_artist_id||'' })
    const { data: c } = await supabase.from('creators').select('*, users(name)').eq('is_active', true)
    setCreators(c||[])
    const { data: va } = await supabase.from('voice_artists').select('*, users(name)')
    setVoiceArtists(va||[])
    const { data: q } = await supabase.from('brief_questions').select('*').eq('brief_id', id).order('asked_at')
    setQuestions(q||[])
    const { data: s } = await supabase.from('video_submissions').select('*').eq('brief_id', id).order('version', { ascending: false })
    setSubmissions(s||[])
    const { data: settings } = await supabase.from('admin_settings').select('value').eq('key', 'approval_delegated_to_producer').maybeSingle()
    setApprovalDelegated((settings as any)?.value === 'true')
  }

  async function handleForward(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    const creatorId = form.assigned_creator_id && form.assigned_creator_id.length > 10 ? form.assigned_creator_id : null
    const voiceId = form.assigned_voice_artist_id && form.assigned_voice_artist_id.length > 10 ? form.assigned_voice_artist_id : null
    await supabase.from('producer_briefs').delete().eq('brief_id', id)
    const { error } = await supabase.from('producer_briefs').insert({ brief_id: id, producer_id: user?.id, producer_note: form.producer_note, assigned_creator_id: creatorId, assigned_voice_artist_id: voiceId, forwarded_at: new Date().toISOString() })
    if (error) { setMsg('Hata: '+error.message); setLoading(false); return }
    await supabase.from('briefs').update({ status:'in_production' }).eq('id', id)
    setMsg("Creator'a iletildi.")
    loadData(); setLoading(false)
  }

  async function handleApprove(submissionId: string) {
    setLoading(true); setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('video_submissions').update({ status:'producer_approved' }).eq('id', submissionId)
    await supabase.from('approvals').insert({ video_submission_id: submissionId, approved_by: user?.id, role:'producer' })
    await supabase.from('briefs').update({ status:'approved' }).eq('id', id)
    if (approvalDelegated) await recordCreatorEarning(id, submissionId)
    setMsg(approvalDelegated?'Video onaylandı, müşteriye iletildi.':'Video onaylandı, admin onayına gönderildi.')
    loadData(); setLoading(false)
  }

  async function handleRevision(submissionId: string) {
    const note = revisionNotes[submissionId]
    if (!note?.trim()) { setMsg('Revizyon notu zorunludur.'); return }
    setLoading(true)
    await supabase.from('video_submissions').update({ status:'revision_requested', producer_notes: note }).eq('id', submissionId)
    await supabase.from('briefs').update({ status:'revision' }).eq('id', id)
    await supabase.from('brief_questions').insert({ brief_id: id, question: `İÇ REVİZYON: ${note}` })
    setMsg("Revizyon creator'a iletildi.")
    loadData(); setLoading(false)
  }

  async function handleClientApprove() {
    setLoading(true)
    await deductClientCredits(id)
    await supabase.from('briefs').update({ status:'delivered' }).eq('id', id)
    setMsg('Müşteri adına onaylandı, kredi kesildi.')
    loadData(); setLoading(false)
  }

  async function handleQuestion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!question.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('brief_questions').insert({ brief_id: id, question, asked_by: user?.id })
    setQuestion(''); loadData()
  }

  async function handleStatusChange(status: string) {
    await supabase.from('briefs').update({ status }).eq('id', id); loadData()
  }

  async function handleLogout() { await supabase.auth.signOut(); router.push('/login') }

  const clientRevisions = questions.filter(q => q.question.startsWith('REVİZYON:'))
  const unansweredQ = questions.filter(q => !q.question.startsWith('REVİZYON:') && !q.question.startsWith('İÇ REVİZYON:') && !q.answer)
  const visibleQ = questions.filter(q => !q.question.startsWith('REVİZYON:') && !q.question.startsWith('İÇ REVİZYON:'))

  const inputStyle: React.CSSProperties = { width:'100%', boxSizing:'border-box', background:'#fff', border:'0.5px solid rgba(0,0,0,0.12)', borderRadius:'10px', padding:'9px 13px', fontSize:'13px', color:'#0a0a0a', fontFamily:'Inter,sans-serif', outline:'none' }
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance:'none' as any }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');`}</style>

      <div style={{width:'220px',background:'#111113',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'15px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'12px'}}>
            dinam<span style={{display:'inline-block',width:'9px',height:'9px',borderRadius:'50%',border:'2px solid #22c55e',position:'relative',top:'1px'}}></span>
          </div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'3px'}}>Prodüktör</div>
          <div style={{fontSize:'13px',fontWeight:'500',color:'#fff'}}>{userName}</div>
        </div>
        <nav style={{padding:'10px 8px',flex:1}}>
          <div onClick={()=>router.push('/dashboard/producer')} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer'}}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>Briflere dön</span>
          </div>
        </nav>
        <div style={{padding:'10px 8px',borderTop:'0.5px solid rgba(255,255,255,0.07)'}}>
          <button onClick={handleLogout} style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',borderRadius:'7px',cursor:'pointer',width:'100%',background:'none',border:'none'}}>
            <span style={{fontSize:'11px',color:'rgba(255,255,255,0.25)',fontFamily:'Inter,sans-serif'}}>Çıkış yap</span>
          </button>
        </div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f5f4f0',overflow:'hidden'}}>
        <div style={{padding:'14px 28px',background:'#fff',borderBottom:'0.5px solid rgba(0,0,0,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div style={{fontSize:'12px',color:'#888'}}>Briefler / <span style={{color:'#0a0a0a',fontWeight:'500'}}>{brief?.campaign_name}</span></div>
          {brief && (
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
              {['in_production','revision','approved','delivered'].map(s=>(
                <button key={s} onClick={()=>handleStatusChange(s)}
                  style={{padding:'5px 12px',borderRadius:'100px',border:'0.5px solid',borderColor:brief.status===s?'#111113':'rgba(0,0,0,0.15)',background:brief.status===s?'#111113':'#fff',color:brief.status===s?'#fff':'#555',fontSize:'11px',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                  {statusLabel[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>
          {brief && (
            <>
              {msg && <div style={{padding:'10px 16px',background:msg.startsWith('Hata')||msg.includes('zorunlu')?'#fef2f2':'#e8f7e8',borderRadius:'8px',fontSize:'12px',color:msg.startsWith('Hata')||msg.includes('zorunlu')?'#ef4444':'#22c55e',marginBottom:'16px'}}>{msg}</div>}

              {clientRevisions.length > 0 && (
                <div style={{background:'#fff',border:'2px solid #ef4444',borderRadius:'12px',padding:'16px 20px',marginBottom:'16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                    <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#ef4444'}}></div>
                    <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Müşteri Revizyonu</div>
                  </div>
                  {clientRevisions.map((r,i)=>(
                    <div key={r.id} style={{padding:'10px 14px',background:'#fef2f2',borderRadius:'8px',marginBottom:'6px'}}>
                      <div style={{fontSize:'11px',color:'#ef4444',fontWeight:'500',marginBottom:'3px'}}>{i+1}. revizyon</div>
                      <div style={{fontSize:'13px',color:'#0a0a0a'}}>{r.question.replace('REVİZYON: ','')}</div>
                    </div>
                  ))}
                </div>
              )}

              {unansweredQ.length > 0 && (
                <div style={{background:'#fff',border:'2px solid #22c55e',borderRadius:'12px',padding:'16px 20px',marginBottom:'16px'}}>
                  <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a',marginBottom:'10px'}}>Müşteri Cevap Bekliyor</div>
                  {unansweredQ.map(q=>(
                    <div key={q.id} style={{padding:'10px 14px',background:'#f5f4f0',borderRadius:'8px',marginBottom:'6px'}}>
                      <div style={{fontSize:'13px',color:'#0a0a0a'}}>{q.question}</div>
                      <div style={{fontSize:'11px',color:'#888',marginTop:'3px'}}>Cevap bekleniyor...</div>
                    </div>
                  ))}
                </div>
              )}

              {brief.status === 'approved' && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'14px 20px',marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:'13px',color:'#555'}}>Müşteri henüz onaylamadı.</div>
                  <button onClick={handleClientApprove} disabled={loading} style={{padding:'8px 18px',background:'#22c55e',color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:'500'}}>Müşteri Onayladı</button>
                </div>
              )}

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px'}}>
                  <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'14px'}}>Müşteri Briefi</div>
                  {[
                    {label:'Video Tipi', value: brief.video_type},
                    {label:'Format', value: Array.isArray(brief.format)?brief.format.join(', '):brief.format},
                    {label:'Mesaj', value: brief.message},
                    {label:'CTA', value: brief.cta},
                    {label:'Hedef Kitle', value: brief.target_audience},
                    {label:'Seslendirme', value: brief.voiceover_type==='real'?'Gerçek':brief.voiceover_type==='ai'?'AI':null},
                    {label:'Seslendirme Metni', value: brief.voiceover_text},
                    {label:'Notlar', value: brief.notes},
                    {label:'Kredi', value: `${brief.credit_cost} kredi`},
                  ].filter(f=>f.value).map(f=>(
                    <div key={f.label} style={{marginBottom:'10px'}}>
                      <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'3px'}}>{f.label}</div>
                      <div style={{fontSize:'13px',color:'#0a0a0a',lineHeight:'1.5'}}>{f.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                  <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px 20px'}}>
                    <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'10px'}}>Marka Kiti</div>
                    {brief.clients?.logo_url&&<a href={brief.clients.logo_url} target="_blank" style={{display:'block',fontSize:'12px',color:'#22c55e',marginBottom:'6px',textDecoration:'none'}}>Logo ↓</a>}
                    {brief.clients?.font_url&&<a href={brief.clients.font_url} target="_blank" style={{display:'block',fontSize:'12px',color:'#22c55e',textDecoration:'none'}}>Font ↓</a>}
                    {!brief.clients?.logo_url&&!brief.clients?.font_url&&<div style={{fontSize:'12px',color:'#888'}}>Yüklenmemiş.</div>}
                  </div>
                </div>
              </div>

              {submissions.length > 0 && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',overflow:'hidden',marginBottom:'16px'}}>
                  <div style={{padding:'14px 20px',borderBottom:'0.5px solid rgba(0,0,0,0.08)',fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Video Gönderimleri ({submissions.length})</div>
                  {submissions.map((s,i)=>(
                    <div key={s.id} style={{padding:'20px 24px',borderBottom:i<submissions.length-1?'0.5px solid rgba(0,0,0,0.06)':'none'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
                        <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>Versiyon {s.version}</div>
                        <span style={{fontSize:'10px',padding:'3px 8px',borderRadius:'100px',background:'rgba(0,0,0,0.05)',color:'#888',fontWeight:'500'}}>{s.status}</span>
                      </div>
                      <video controls style={{width:'100%',borderRadius:'8px',background:'#000',marginBottom:'14px',maxHeight:'280px'}}>
                        <source src={s.video_url} />
                      </video>
                      {s.status === 'pending' && (
                        <div>
                          <button onClick={()=>handleApprove(s.id)} disabled={loading}
                            style={{padding:'9px 20px',background:'#22c55e',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:'500',marginBottom:'10px',display:'block'}}>
                            {approvalDelegated?'Onayla & Müşteriye İlet':'Onayla → Admin Onayına Gönder'}
                          </button>
                          <textarea value={revisionNotes[s.id]||''} onChange={e=>setRevisionNotes(prev=>({...prev,[s.id]:e.target.value}))}
                            placeholder="Revizyon notu (zorunlu)..." rows={2}
                            style={{...inputStyle,resize:'vertical',marginBottom:'8px'}} />
                          <button onClick={()=>handleRevision(s.id)} disabled={loading}
                            style={{padding:'9px 20px',background:'#fff',color:'#ef4444',border:'0.5px solid #ef4444',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                            Revizyon İste
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleForward} style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a',marginBottom:'16px'}}>Creator'a İlet</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                  <div>
                    <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'6px'}}>Creator</div>
                    <select value={form.assigned_creator_id} onChange={e=>setForm({...form,assigned_creator_id:e.target.value})} style={selectStyle}>
                      <option value="">Seçin</option>
                      {creators.map(c=><option key={c.id} value={c.id}>{c.users?.name}</option>)}
                    </select>
                  </div>
                  {brief.voiceover_type==='real'&&(
                    <div>
                      <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'6px'}}>Seslendirme Sanatçısı</div>
                      <select value={form.assigned_voice_artist_id} onChange={e=>setForm({...form,assigned_voice_artist_id:e.target.value})} style={selectStyle}>
                        <option value="">Seçin</option>
                        {voiceArtists.map(va=><option key={va.id} value={va.id}>{va.users?.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div style={{marginBottom:'14px'}}>
                  <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'6px'}}>Prodüktör Notu</div>
                  <textarea value={form.producer_note} onChange={e=>setForm({...form,producer_note:e.target.value})} rows={3} style={{...inputStyle,resize:'vertical'}} />
                </div>
                <button type="submit" disabled={loading} style={{padding:'9px 20px',background:'#111113',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:'500'}}>
                  {loading?'İletiliyor...':form.assigned_creator_id?'Güncelle':"Creator'a İlet"}
                </button>
              </form>

              <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px'}}>
                <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a',marginBottom:'14px'}}>Sorular</div>
                {visibleQ.length===0&&<div style={{fontSize:'12px',color:'#888',marginBottom:'14px'}}>Henüz soru yok.</div>}
                {visibleQ.map(q=>(
                  <div key={q.id} style={{marginBottom:'8px',padding:'10px 14px',background:'#f5f4f0',borderRadius:'8px'}}>
                    <div style={{fontSize:'13px',color:'#0a0a0a',marginBottom:'3px'}}>{q.question}</div>
                    {q.answer?<div style={{fontSize:'12px',color:'#22c55e'}}>↳ {q.answer}</div>:<div style={{fontSize:'11px',color:'#888'}}>Cevap bekleniyor</div>}
                  </div>
                ))}
                <form onSubmit={handleQuestion} style={{display:'flex',gap:'8px',marginTop:'12px'}}>
                  <input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Müşteriye soru sor..." style={{...inputStyle,flex:1}} />
                  <button type="submit" style={{padding:'9px 18px',background:'#111113',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontFamily:'Inter,sans-serif',whiteSpace:'nowrap'}}>Gönder</button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
