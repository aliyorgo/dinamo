'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams, useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string,string> = {
  submitted:'İnceleniyor', read:'İncelendi', in_production:'Üretimde',
  revision:'Revizyon', approved:'Onay Bekliyor', delivered:'Teslim Edildi', cancelled:'İptal Edildi'
}
const statusColor: Record<string,string> = {
  submitted:'#888', read:'#888', in_production:'#3b82f6',
  revision:'#ef4444', approved:'#f59e0b', delivered:'#22c55e', cancelled:'#555'
}

const REVISION_COST = 4

export default function ClientBriefDetail() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [brief, setBrief] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [answers, setAnswers] = useState<Record<string,string>>({})
  const [videos, setVideos] = useState<any[]>([])
  const [clientUser, setClientUser] = useState<any>(null)
  const [companyName, setCompanyName] = useState('')
  const [userName, setUserName] = useState('')
  const [revisionNote, setRevisionNote] = useState('')
  const [revisionCount, setRevisionCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: userData } = await supabase.from('users').select('name').eq('id', user.id).single()
    setUserName(userData?.name || '')
    const { data: cu } = await supabase.from('client_users').select('*, clients(company_name, credit_balance)').eq('user_id', user.id).single()
    setClientUser(cu)
    setCompanyName((cu as any)?.clients?.company_name || '')
    const { data: b } = await supabase.from('briefs').select('*').eq('id', id).single()
    setBrief(b)
    const { data: q } = await supabase.from('brief_questions').select('*').eq('brief_id', id).order('asked_at')
    setQuestions(q || [])
    const { data: v } = await supabase.from('video_submissions').select('*').eq('brief_id', id).order('version', { ascending: true })
    setVideos(v || [])
    const revCount = (q || []).filter((x:any) => x.question.startsWith('REVİZYON:')).length
    setRevisionCount(revCount)
  }

  async function handleAnswer(qId: string) {
    const answer = answers[qId]
    if (!answer?.trim()) return
    await supabase.from('brief_questions').update({ answer, answered_at: new Date().toISOString() }).eq('id', qId)
    setAnswers(prev => ({...prev, [qId]: ''}))
    loadData()
  }

  async function handleRevision(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!revisionNote.trim()) { setMsg('Revizyon notunuzu yazın.'); return }
    if (!clientUser || !brief) return
    setLoading(true)
    setMsg('')
    if (revisionCount >= 1) {
      if (clientUser.credit_balance < REVISION_COST) { setMsg(`Yetersiz kredi. Bu revizyon için ${REVISION_COST} kredi gerekiyor.`); setLoading(false); return }
      await supabase.from('client_users').update({ credit_balance: clientUser.credit_balance - REVISION_COST }).eq('id', clientUser.id)
      await supabase.from('credit_transactions').insert({ client_id: brief.client_id, client_user_id: clientUser.id, brief_id: id, amount: -REVISION_COST, type: 'deduct', description: `${brief.campaign_name} — ${revisionCount+1}. revizyon` })
    }
    await supabase.from('briefs').update({ status: 'revision' }).eq('id', id)
    await supabase.from('brief_questions').insert({ brief_id: id, question: `REVİZYON: ${revisionNote}` })
    setRevisionNote('')
    setMsg(revisionCount === 0 ? 'Revizyon talebiniz gönderildi (ücretsiz).' : `Revizyon talebiniz gönderildi (${REVISION_COST} kredi düşüldü).`)
    loadData()
    setLoading(false)
  }

  async function handleApprove() {
    if (!brief || !clientUser) return
    setLoading(true)
    const newBalance = Math.max(0, clientUser.credit_balance - (brief.credit_cost || 0))
    await supabase.from('client_users').update({ credit_balance: newBalance }).eq('id', clientUser.id)
    await supabase.from('credit_transactions').insert({ client_id: brief.client_id, client_user_id: clientUser.id, brief_id: id, amount: -(brief.credit_cost||0), type: 'deduct', description: `${brief.campaign_name} — müşteri onayı` })
    const { data: pb } = await supabase.from('producer_briefs').select('assigned_creator_id').eq('brief_id', id).maybeSingle()
    if (pb?.assigned_creator_id) {
      const { data: rate } = await supabase.from('admin_settings').select('value').eq('key', 'creator_credit_rate').maybeSingle()
      const tlRate = parseFloat((rate as any)?.value || '500')
      await supabase.from('creator_earnings').insert({ brief_id: id, creator_id: pb.assigned_creator_id, credits: brief.credit_cost, tl_rate: tlRate, tl_amount: brief.credit_cost * tlRate, paid: false })
    }
    await supabase.from('briefs').update({ status: 'delivered' }).eq('id', id)
    setMsg('Onaylandı. Teşekkürler!')
    loadData()
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm('Bu briefi silmek istediğinizden emin misiniz?')) return
    await supabase.from('briefs').delete().eq('id', id)
    router.push('/dashboard/client')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const unansweredQ = questions.filter(q => !q.question.startsWith('REVİZYON:') && !q.question.startsWith('İÇ REVİZYON:') && !q.answer)
  const visibleQ = questions.filter(q => !q.question.startsWith('REVİZYON:') && !q.question.startsWith('İÇ REVİZYON:') && q.answer)
  const clientRevisions = questions.filter(q => q.question.startsWith('REVİZYON:'))
  const approvedVideo = [...videos].reverse().find(v => v.status === 'producer_approved' || v.status === 'admin_approved') || (brief?.status === 'approved' || brief?.status === 'delivered' ? videos[videos.length-1] : null)

  const creditBreakdown = brief ? (() => {
    const formats = Array.isArray(brief.format) ? brief.format : []
    const extra = formats.length > 1 ? formats.length - 1 : 0
    const voiceCost = brief.voiceover_type === 'real' ? 6 : 0
    const base = brief.credit_cost - extra - voiceCost
    const items: {label:string,cost:number}[] = [{label: brief.video_type, cost: base}]
    if (extra > 0) items.push({label: `Ekstra format (${extra} adet)`, cost: extra})
    if (voiceCost > 0) items.push({label: 'Gerçek Seslendirme', cost: voiceCost})
    return items
  })() : []

  const inputStyle: React.CSSProperties = { width:'100%', boxSizing:'border-box', background:'#fff', border:'0.5px solid rgba(0,0,0,0.12)', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#0a0a0a', fontFamily:'Inter,sans-serif', outline:'none' }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');`}</style>

      <div style={{width:'220px',background:'#111113',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'15px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'12px'}}>
            dinam<span style={{display:'inline-block',width:'9px',height:'9px',borderRadius:'50%',border:'2px solid #22c55e',position:'relative',top:'1px'}}></span>
          </div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'3px'}}>{companyName}</div>
          <div style={{fontSize:'13px',fontWeight:'500',color:'#fff'}}>{userName}</div>
        </div>
        <div style={{padding:'12px 16px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',textTransform:'uppercase',marginBottom:'4px'}}>Kredi Bakiyesi</div>
          <div style={{fontSize:'22px',fontWeight:'300',color:'#fff',letterSpacing:'-1px'}}>{clientUser?.credit_balance||0}</div>
        </div>
        <nav style={{padding:'10px 8px',flex:1}}>
          <div onClick={()=>router.push('/dashboard/client')} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',marginBottom:'1px'}}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>Projelerime dön</span>
          </div>
          <div onClick={()=>router.push('/dashboard/client/brief/new')} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',marginBottom:'1px'}}>
            <span style={{fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>Yeni Brief</span>
          </div>
          <div onClick={()=>router.push('/dashboard/client/brand')} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer'}}>
            <span style={{fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>Marka Paketi</span>
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
          <div style={{fontSize:'12px',color:'#888'}}>Projelerim / <span style={{color:'#0a0a0a',fontWeight:'500'}}>{brief?.campaign_name}</span></div>
          {brief && <span style={{fontSize:'11px',padding:'4px 12px',borderRadius:'100px',background:`${statusColor[brief.status]}15`,color:statusColor[brief.status],fontWeight:'500'}}>{statusLabel[brief.status]||brief.status}</span>}
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>
          {!brief ? <div style={{color:'#888',fontSize:'14px'}}>Yükleniyor...</div> : (
            <>
              {brief.status==='cancelled' && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:'13px',color:'#888'}}>Bu brief admin tarafından iptal edildi.</div>
                  <button onClick={handleDelete} style={{padding:'8px 18px',background:'#ef4444',color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>Sil</button>
                </div>
              )}

              {unansweredQ.length > 0 && (
                <div style={{background:'#fff',border:'2px solid #22c55e',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px'}}>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#22c55e'}}></div>
                    <div style={{fontSize:'12px',fontWeight:'500',color:'#0a0a0a'}}>Cevabınızı Bekliyoruz</div>
                    <div style={{fontSize:'11px',color:'#888'}}>{unansweredQ.length} soru</div>
                  </div>
                  {unansweredQ.map(q=>(
                    <div key={q.id} style={{marginBottom:'12px',padding:'12px 16px',background:'#f5f4f0',borderRadius:'10px'}}>
                      <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a',marginBottom:'10px',lineHeight:'1.5'}}>{q.question}</div>
                      <div style={{display:'flex',gap:'8px'}}>
                        <input value={answers[q.id]||''} onChange={e=>setAnswers(prev=>({...prev,[q.id]:e.target.value}))} placeholder="Cevabınız..." style={{...inputStyle,flex:1,padding:'8px 12px'}} />
                        <button onClick={()=>handleAnswer(q.id)} style={{padding:'8px 16px',background:'#111113',color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontFamily:'Inter,sans-serif',fontWeight:'500',whiteSpace:'nowrap'}}>Yanıtla</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {approvedVideo && brief.status==='approved' && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',overflow:'hidden',marginBottom:'16px'}}>
                  <div style={{padding:'14px 20px',borderBottom:'0.5px solid rgba(0,0,0,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>Versiyon {approvedVideo.version} hazır</div>
                      <div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>{new Date(approvedVideo.submitted_at).toLocaleDateString('tr-TR')} tarihinde teslim edildi</div>
                    </div>
                    <span style={{fontSize:'10px',padding:'3px 10px',borderRadius:'100px',background:'rgba(245,158,11,0.1)',color:'#f59e0b',fontWeight:'500'}}>Onayınız bekleniyor</span>
                  </div>
                  <div style={{padding:'20px 24px'}}>
                    <video controls style={{width:'100%',borderRadius:'8px',background:'#000',marginBottom:'16px'}}>
                      <source src={approvedVideo.video_url} />
                    </video>
                    <div style={{display:'flex',gap:'10px',flexWrap:'wrap',marginBottom:'20px'}}>
                      <a href={approvedVideo.video_url} download target="_blank" style={{padding:'9px 20px',background:'#f5f4f0',color:'#0a0a0a',borderRadius:'8px',fontSize:'13px',textDecoration:'none',border:'0.5px solid rgba(0,0,0,0.12)'}}>İndir ↓</a>
                      <button onClick={handleApprove} disabled={loading} style={{padding:'9px 24px',background:'#22c55e',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontWeight:'500',fontFamily:'Inter,sans-serif'}}>
                        {loading?'İşleniyor...':'✓ Onaylıyorum'}
                      </button>
                    </div>
                    <div style={{borderTop:'0.5px solid rgba(0,0,0,0.08)',paddingTop:'20px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                        <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>Bu videoyu revize ettirmek istiyorum</div>
                        <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'100px',background:revisionCount===0?'rgba(34,197,94,0.1)':'rgba(245,158,11,0.1)',color:revisionCount===0?'#22c55e':'#f59e0b',fontWeight:'500'}}>
                          {revisionCount===0?'İlk revizyon ücretsiz':`${REVISION_COST} kredi`}
                        </span>
                      </div>
                      <form onSubmit={handleRevision}>
                        <textarea value={revisionNote} onChange={e=>setRevisionNote(e.target.value)}
                          placeholder={`Versiyon ${approvedVideo.version}'de neyi değiştirmek istiyorsunuz? Detaylı açıklayın...`} rows={3}
                          style={{...inputStyle,resize:'vertical',lineHeight:'1.6',marginBottom:'10px'}} />
                        {msg && <div style={{fontSize:'12px',color:msg.includes('Yetersiz')||msg.includes('yazın')?'#ef4444':'#22c55e',marginBottom:'10px'}}>{msg}</div>}
                        <button type="submit" disabled={loading} style={{padding:'9px 20px',background:'#fff',color:'#0a0a0a',border:'0.5px solid rgba(0,0,0,0.15)',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                          {loading?'Gönderiliyor...':revisionCount===0?'Revizyon Gönder (Ücretsiz)':`Revizyon Gönder (${REVISION_COST} Kredi)`}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {approvedVideo && brief.status==='delivered' && (
                <div style={{background:'#fff',border:'0.5px solid rgba(34,197,94,0.3)',borderRadius:'12px',overflow:'hidden',marginBottom:'16px'}}>
                  <div style={{padding:'14px 20px',borderBottom:'0.5px solid rgba(0,0,0,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>Versiyon {approvedVideo.version}</div>
                    <span style={{fontSize:'10px',padding:'3px 10px',borderRadius:'100px',background:'rgba(34,197,94,0.1)',color:'#22c55e',fontWeight:'500'}}>✓ Teslim Edildi</span>
                  </div>
                  <div style={{padding:'20px 24px'}}>
                    <video controls style={{width:'100%',borderRadius:'8px',background:'#000',marginBottom:'16px'}}>
                      <source src={approvedVideo.video_url} />
                    </video>
                    <a href={approvedVideo.video_url} download target="_blank" style={{display:'inline-block',padding:'9px 20px',background:'#111113',color:'#fff',borderRadius:'8px',fontSize:'13px',textDecoration:'none',fontWeight:'500'}}>İndir ↓</a>
                  </div>
                </div>
              )}

              {!approvedVideo && ['in_production','submitted','read'].includes(brief.status) && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                  <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a',marginBottom:'4px'}}>Videonuz hazırlanıyor</div>
                  <div style={{fontSize:'12px',color:'#888'}}>24 saat içinde incelemenize sunulacak.</div>
                </div>
              )}

              {videos.length > 1 && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px 20px',marginBottom:'16px'}}>
                  <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'12px'}}>Versiyon Geçmişi</div>
                  {[...videos].reverse().map(v=>(
                    <div key={v.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'0.5px solid rgba(0,0,0,0.06)'}}>
                      <div style={{fontSize:'13px',color:'#0a0a0a'}}>Versiyon {v.version}</div>
                      <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
                        <span style={{fontSize:'11px',color:'#888'}}>{new Date(v.submitted_at).toLocaleDateString('tr-TR')}</span>
                        <a href={v.video_url} target="_blank" style={{fontSize:'11px',color:'#22c55e',textDecoration:'none'}}>Görüntüle ↗</a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {clientRevisions.length > 0 && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px 20px',marginBottom:'16px'}}>
                  <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'12px'}}>Revizyon Geçmişi</div>
                  {clientRevisions.map((r,i)=>(
                    <div key={r.id} style={{padding:'10px 14px',background:'#f5f4f0',borderRadius:'8px',marginBottom:'6px'}}>
                      <div style={{fontSize:'11px',color:'#888',fontWeight:'500',marginBottom:'4px'}}>{i+1}. revizyon{i===0?' (ücretsiz)':`(${REVISION_COST} kredi)`}</div>
                      <div style={{fontSize:'13px',color:'#0a0a0a'}}>{r.question.replace('REVİZYON: ','')}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'20px 24px',marginBottom:'16px'}}>
                <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'16px'}}>Brief Detayları</div>
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
                  <div key={f.label} style={{marginBottom:'12px',paddingBottom:'12px',borderBottom:'0.5px solid rgba(0,0,0,0.06)'}}>
                    <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'4px'}}>{f.label}</div>
                    <div style={{fontSize:'13px',color:'#0a0a0a',lineHeight:'1.6'}}>{f.value}</div>
                  </div>
                ))}
                <div style={{background:'#f5f4f0',borderRadius:'8px',padding:'12px 16px'}}>
                  <div style={{fontSize:'10px',color:'#888',textTransform:'uppercase',letterSpacing:'0.3px',marginBottom:'8px'}}>Kredi Dökümü</div>
                  {creditBreakdown.map(item=>(
                    <div key={item.label} style={{display:'flex',justifyContent:'space-between',fontSize:'12px',color:'#555',marginBottom:'4px'}}>
                      <span>{item.label}</span><span>{item.cost} kredi</span>
                    </div>
                  ))}
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px',fontWeight:'500',color:'#0a0a0a',marginTop:'8px',paddingTop:'8px',borderTop:'0.5px solid rgba(0,0,0,0.1)'}}>
                    <span>Toplam</span><span>{brief.credit_cost} kredi</span>
                  </div>
                </div>
              </div>

              {visibleQ.length > 0 && (
                <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.1)',borderRadius:'12px',padding:'16px 20px'}}>
                  <div style={{fontSize:'11px',color:'#888',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'12px'}}>Yanıtlanan Sorular</div>
                  {visibleQ.map(q=>(
                    <div key={q.id} style={{marginBottom:'10px',padding:'10px 14px',background:'#f5f4f0',borderRadius:'8px'}}>
                      <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a',marginBottom:'4px'}}>{q.question}</div>
                      <div style={{fontSize:'12px',color:'#22c55e'}}>↳ {q.answer}</div>
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
