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
  submitted:'#888', read:'#888', in_production:'#f59e0b',
  revision:'#e24b4a', approved:'#f59e0b', delivered:'#1db81d', cancelled:'#ccc'
}

const REVISION_CREDIT_COST = 4

export default function ClientBriefDetail() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [brief, setBrief] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [answers, setAnswers] = useState<Record<string,string>>({})
  const [videos, setVideos] = useState<any[]>([])
  const [clientUser, setClientUser] = useState<any>(null)
  const [revisionNote, setRevisionNote] = useState('')
  const [revisionCount, setRevisionCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: cu } = await supabase.from('client_users').select('*').eq('user_id', user.id).single()
    setClientUser(cu)
    const { data: b } = await supabase.from('briefs').select('*').eq('id', id).single()
    setBrief(b)
    const { data: q } = await supabase.from('brief_questions').select('*').eq('brief_id', id).order('asked_at')
    setQuestions(q || [])
    const { data: v } = await supabase.from('video_submissions').select('*').eq('brief_id', id).order('version', { ascending: true })
    setVideos(v || [])
    const revCount = (q || []).filter((x: any) => x.question.startsWith('REVİZYON:')).length
    setRevisionCount(revCount)
  }

  async function handleAnswer(questionId: string) {
    const answer = answers[questionId]
    if (!answer?.trim()) return
    await supabase.from('brief_questions').update({ answer, answered_at: new Date().toISOString() }).eq('id', questionId)
    setAnswers(prev => ({...prev, [questionId]: ''}))
    loadData()
  }

  async function handleRevision(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!revisionNote.trim()) { setMsg('Lütfen neyi değiştirmek istediğinizi yazın.'); return }
    if (!clientUser || !brief) return
    setLoading(true)
    setMsg('')

    if (revisionCount >= 1) {
      if (clientUser.credit_balance < REVISION_CREDIT_COST) {
        setMsg(`Yetersiz kredi. Bu revizyon için ${REVISION_CREDIT_COST} kredi gerekiyor.`)
        setLoading(false)
        return
      }
      await supabase.from('client_users').update({ credit_balance: clientUser.credit_balance - REVISION_CREDIT_COST }).eq('id', clientUser.id)
      await supabase.from('credit_transactions').insert({
        client_id: brief.client_id,
        client_user_id: clientUser.id,
        brief_id: id,
        amount: -REVISION_CREDIT_COST,
        type: 'deduct',
        description: `${brief.campaign_name} — ${revisionCount + 1}. revizyon`
      })
    }

    await supabase.from('briefs').update({ status: 'revision' }).eq('id', id)
    await supabase.from('brief_questions').insert({
      brief_id: id,
      question: `REVİZYON: ${revisionNote}`
    })
    setRevisionNote('')
    setMsg(revisionCount === 0 ? 'Revizyon talebiniz gönderildi (ücretsiz).' : `Revizyon talebiniz gönderildi (${REVISION_CREDIT_COST} kredi düşüldü).`)
    loadData()
    setLoading(false)
  }

async function handleApprove() {
  if (!brief || !clientUser) return
  setLoading(true)

  // Müşteri kredisi kes
  const newBalance = Math.max(0, clientUser.credit_balance - (brief.credit_cost || 0))
  await supabase.from('client_users').update({ credit_balance: newBalance }).eq('id', clientUser.id)
  await supabase.from('credit_transactions').insert({
    client_id: brief.client_id,
    client_user_id: clientUser.id,
    brief_id: id,
    amount: -(brief.credit_cost || 0),
    type: 'deduct',
    description: `${brief.campaign_name} — müşteri onayı`
  })

  // Creator kazanç kaydı
  const { data: pb } = await supabase.from('producer_briefs').select('assigned_creator_id').eq('brief_id', id).maybeSingle()
  if (pb?.assigned_creator_id) {
    const { data: rate } = await supabase.from('admin_settings').select('value').eq('key', 'creator_credit_rate').maybeSingle()
    const tlRate = parseFloat(rate?.value || '500')
    await supabase.from('creator_earnings').insert({
      brief_id: id,
      creator_id: pb.assigned_creator_id,
      credits: brief.credit_cost,
      tl_rate: tlRate,
      tl_amount: brief.credit_cost * tlRate,
      paid: false
    })
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

  // Müşterinin sadece gördüğü sorular (iç revizyonlar hariç)
  const visibleQuestions = questions.filter(q =>
    !q.question.startsWith('İÇ REVİZYON:') && !q.question.startsWith('REVİZYON:')
  )
  const unansweredQuestions = visibleQuestions.filter(q => !q.answer)
  const clientRevisions = questions.filter(q => q.question.startsWith('REVİZYON:'))

  // Müşteriye gösterilecek son video: producer/admin onaylı olan
  const approvedVideo = [...videos].reverse().find(v =>
    v.status === 'producer_approved' || v.status === 'admin_approved'
  ) || (brief?.status === 'approved' || brief?.status === 'delivered' ? videos[videos.length - 1] : null)

  // Kredi dökümü
  const creditBreakdown = brief ? (() => {
    const formats = Array.isArray(brief.format) ? brief.format : []
    const extra = formats.length > 1 ? formats.length - 1 : 0
    const voiceCost = brief.voiceover_type === 'real' ? 6 : 0
    const base = brief.credit_cost - extra - voiceCost
    const items = [{ label: brief.video_type, cost: base }]
    if (extra > 0) items.push({ label: `Ekstra format (${extra} adet)`, cost: extra })
    if (voiceCost > 0) items.push({ label: 'Gerçek Seslendirme', cost: voiceCost })
    return items
  })() : []

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
        <div style={{padding:'24px',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:'11px',color:'#666',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'4px'}}>KREDİ BAKİYESİ</div>
          <div style={{fontSize:'24px',fontWeight:'300',color:'#fff',letterSpacing:'-1px'}}>{clientUser?.credit_balance || 0}</div>
        </div>
      </div>

      <div style={{flex:1,padding:'48px',maxWidth:'800px'}}>
        {!brief ? (
          <div style={{color:'#888',fontSize:'14px'}}>Yükleniyor...</div>
        ) : (
          <>
            {/* BAŞLIK */}
            <div style={{marginBottom:'24px',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <h1 style={{fontSize:'28px',fontWeight:'400',letterSpacing:'-1px',margin:'0 0 8px',color:'#0a0a0a'}}>{brief.campaign_name}</h1>
                <div style={{fontSize:'14px',color:'#555'}}>{brief.video_type} · {new Date(brief.created_at).toLocaleDateString('tr-TR')}</div>
              </div>
              <span style={{fontSize:'11px',padding:'4px 12px',borderRadius:'100px',background:`${statusColor[brief.status]}15`,color:statusColor[brief.status],fontFamily:'monospace'}}>
                {statusLabel[brief.status] || brief.status}
              </span>
            </div>

            {/* İPTAL EDİLDİ */}
            {brief.status === 'cancelled' && (
              <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px',marginBottom:'24px'}}>
                <div style={{fontSize:'14px',color:'#888',marginBottom:'16px'}}>Bu brief admin tarafından iptal edildi.</div>
                <button onClick={handleDelete} style={{padding:'9px 20px',background:'#e24b4a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>Sil</button>
              </div>
            )}

            {/* CEVAP BEKLEYEN SORULAR — TEPEDE */}
            {unansweredQuestions.length > 0 && (
              <div style={{background:'#fff',border:'2px solid #1db81d',borderRadius:'12px',padding:'24px',marginBottom:'24px'}}>
                <div style={{fontSize:'11px',color:'#1db81d',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px',display:'flex',alignItems:'center',gap:'8px'}}>
                  <span style={{width:'8px',height:'8px',borderRadius:'50%',background:'#1db81d',display:'inline-block'}}></span>
                  CEVABINIZI BEKLİYORUZ ({unansweredQuestions.length})
                </div>
                {unansweredQuestions.map(q=>(
                  <div key={q.id} style={{marginBottom:'12px',padding:'14px 16px',background:'#f7f6f2',borderRadius:'8px'}}>
                    <div style={{fontSize:'13px',color:'#0a0a0a',marginBottom:'10px',fontWeight:'500',lineHeight:'1.5'}}>{q.question}</div>
                    <div style={{display:'flex',gap:'8px'}}>
                      <input value={answers[q.id] || ''} onChange={e=>setAnswers(prev=>({...prev,[q.id]:e.target.value}))}
                        placeholder="Cevabınız..." style={{flex:1,padding:'8px 12px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a'}} />
                      <button onClick={()=>handleAnswer(q.id)} style={{padding:'8px 16px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontWeight:'500'}}>Yanıtla</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* VİDEO ONAYI — ANA BÖLÜM */}
            {approvedVideo && brief.status === 'approved' && (
              <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden',marginBottom:'24px'}}>
                <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>Versiyon {approvedVideo.version} hazır</div>
                    <div style={{fontSize:'12px',color:'#888',marginTop:'2px'}}>{new Date(approvedVideo.submitted_at).toLocaleDateString('tr-TR')} tarihinde teslim edildi</div>
                  </div>
                  <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'100px',background:'#fff7e6',color:'#f59e0b',fontFamily:'monospace'}}>Onayınız bekleniyor</span>
                </div>
                <div style={{padding:'24px'}}>
                  <video controls style={{width:'100%',borderRadius:'8px',background:'#000',marginBottom:'20px'}}>
                    <source src={approvedVideo.video_url} />
                  </video>
                  <div style={{display:'flex',gap:'12px',flexWrap:'wrap',marginBottom:'20px'}}>
                    <a href={approvedVideo.video_url} download target="_blank"
                      style={{padding:'10px 20px',background:'#f7f6f2',color:'#0a0a0a',borderRadius:'8px',fontSize:'13px',textDecoration:'none',border:'1px solid #e8e7e3'}}>
                      İndir
                    </a>
                    <button onClick={handleApprove} disabled={loading}
                      style={{padding:'10px 24px',background:'#1db81d',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontWeight:'500'}}>
                      {loading ? 'İşleniyor...' : '✓ Onaylıyorum'}
                    </button>
                  </div>

                  {/* REVİZYON — DOĞRUDAN VİDEOYA BAĞLI */}
                  <div style={{borderTop:'1px solid #f0f0ee',paddingTop:'20px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                      <div style={{fontSize:'13px',color:'#555',fontWeight:'500'}}>Bu videoyu revize ettirmek istiyorum</div>
                      <span style={{fontSize:'12px',padding:'3px 10px',borderRadius:'100px',
                        background:revisionCount===0?'#e8f7e8':'#fff7e6',
                        color:revisionCount===0?'#1db81d':'#f59e0b',
                        fontFamily:'monospace',
                        border:`1px solid ${revisionCount===0?'rgba(29,184,29,0.3)':'rgba(245,158,11,0.3)'}`
                      }}>
                        {revisionCount === 0 ? 'İlk revizyon ücretsiz' : `${REVISION_CREDIT_COST} kredi`}
                      </span>
                    </div>
                    <form onSubmit={handleRevision}>
                      <textarea value={revisionNote} onChange={e=>setRevisionNote(e.target.value)}
                        placeholder="Versiyon 3'te neyi değiştirmemi istiyorsunuz? Mümkün olduğunca detaylı açıklayın..."
                        rows={3}
                        style={{width:'100%',padding:'10px 14px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box',resize:'vertical',fontFamily:'system-ui,sans-serif',color:'#0a0a0a',marginBottom:'10px'}} />
                      {msg && <div style={{fontSize:'13px',color:msg.includes('Yetersiz')||msg.includes('Lütfen')?'#e24b4a':'#1db81d',marginBottom:'10px'}}>{msg}</div>}
                      <button type="submit" disabled={loading}
                        style={{padding:'9px 20px',background:'#fff',color:'#0a0a0a',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>
                        {loading ? 'Gönderiliyor...' : revisionCount === 0 ? 'Revizyon Gönder (Ücretsiz)' : `Revizyon Gönder (${REVISION_CREDIT_COST} Kredi)`}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* TESLİM EDİLDİ */}
            {approvedVideo && brief.status === 'delivered' && (
              <div style={{background:'#fff',border:'1px solid rgba(29,184,29,0.3)',borderRadius:'12px',overflow:'hidden',marginBottom:'24px'}}>
                <div style={{padding:'16px 24px',borderBottom:'1px solid #f0f0ee',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>Versiyon {approvedVideo.version}</div>
                  <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'100px',background:'#e8f7e8',color:'#1db81d',fontFamily:'monospace'}}>✓ Teslim Edildi</span>
                </div>
                <div style={{padding:'24px'}}>
                  <video controls style={{width:'100%',borderRadius:'8px',background:'#000',marginBottom:'16px'}}>
                    <source src={approvedVideo.video_url} />
                  </video>
                  <a href={approvedVideo.video_url} download target="_blank"
                    style={{display:'inline-block',padding:'10px 20px',background:'#0a0a0a',color:'#fff',borderRadius:'8px',fontSize:'13px',textDecoration:'none'}}>
                    İndir
                  </a>
                </div>
              </div>
            )}

            {/* ÜRETİMDE */}
            {!approvedVideo && brief.status === 'in_production' && (
              <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px',marginBottom:'24px'}}>
                <div style={{fontSize:'14px',color:'#0a0a0a',marginBottom:'4px'}}>Videonuz hazırlanıyor</div>
                <div style={{fontSize:'13px',color:'#888'}}>24 saat içinde incelemenize sunulacak.</div>
              </div>
            )}

            {/* REVİZYON GEÇMİŞİ */}
            {clientRevisions.length > 0 && (
              <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px',marginBottom:'24px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>REVİZYON GEÇMİŞİ</div>
                {clientRevisions.map((r,i)=>(
                  <div key={r.id} style={{marginBottom:'8px',padding:'12px 16px',background:'#f7f6f2',borderRadius:'8px'}}>
                    <div style={{fontSize:'12px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>
                      {i+1}. REVİZYON{i === 0 ? ' (Ücretsiz)' : ` (${REVISION_CREDIT_COST} Kredi)`}
                    </div>
                    <div style={{fontSize:'13px',color:'#0a0a0a'}}>{r.question.replace('REVİZYON: ','')}</div>
                  </div>
                ))}
              </div>
            )}

            {/* VERSİYON GEÇMİŞİ */}
            {videos.length > 1 && (
              <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px',marginBottom:'24px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>VERSİYON GEÇMİŞİ</div>
                {[...videos].reverse().map(v=>(
                  <div key={v.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #f0f0ee'}}>
                    <div style={{fontSize:'13px',color:'#0a0a0a'}}>Versiyon {v.version}</div>
                    <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
                      <span style={{fontSize:'12px',color:'#888'}}>{new Date(v.submitted_at).toLocaleDateString('tr-TR')}</span>
                      <a href={v.video_url} target="_blank" style={{fontSize:'12px',color:'#1db81d'}}>Görüntüle</a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* BRİEF DETAYLARI */}
            <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px',marginBottom:'24px'}}>
              <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>BRİEF DETAYLARI</div>
              {brief.video_type && <div style={{marginBottom:'12px',paddingBottom:'12px',borderBottom:'1px solid #f0f0ee'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>VİDEO TİPİ</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.video_type}</div></div>}
              {brief.format?.length > 0 && <div style={{marginBottom:'12px',paddingBottom:'12px',borderBottom:'1px solid #f0f0ee'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>FORMAT</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{Array.isArray(brief.format)?brief.format.join(', '):brief.format}</div></div>}
              {brief.message && <div style={{marginBottom:'12px',paddingBottom:'12px',borderBottom:'1px solid #f0f0ee'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>MESAJ</div><div style={{fontSize:'14px',color:'#0a0a0a',lineHeight:'1.6'}}>{brief.message}</div></div>}
              {brief.cta && <div style={{marginBottom:'12px',paddingBottom:'12px',borderBottom:'1px solid #f0f0ee'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>CTA</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.cta}</div></div>}
              {brief.target_audience && <div style={{marginBottom:'12px',paddingBottom:'12px',borderBottom:'1px solid #f0f0ee'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>HEDEF KİTLE</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.target_audience}</div></div>}
              {brief.voiceover_type && brief.voiceover_type !== 'none' && <div style={{marginBottom:'12px',paddingBottom:'12px',borderBottom:'1px solid #f0f0ee'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>SESLENDİRME</div><div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.voiceover_type==='real'?'Gerçek Seslendirme':'AI Seslendirme'}</div></div>}
              {brief.voiceover_text && <div style={{marginBottom:'12px',paddingBottom:'12px',borderBottom:'1px solid #f0f0ee'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>SESLENDİRME METNİ</div><div style={{fontSize:'14px',color:'#0a0a0a',lineHeight:'1.6'}}>{brief.voiceover_text}</div></div>}
              {brief.notes && <div style={{marginBottom:'16px',paddingBottom:'16px',borderBottom:'1px solid #f0f0ee'}}><div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'4px'}}>NOTLAR</div><div style={{fontSize:'14px',color:'#0a0a0a',lineHeight:'1.6'}}>{brief.notes}</div></div>}
              <div style={{background:'#f7f6f2',borderRadius:'8px',padding:'14px 16px'}}>
                <div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'10px',letterSpacing:'1px'}}>KREDİ DÖKÜMÜ</div>
                {creditBreakdown.map(item=>(
                  <div key={item.label} style={{display:'flex',justifyContent:'space-between',fontSize:'13px',color:'#555',marginBottom:'6px'}}>
                    <span>{item.label}</span><span>{item.cost} kredi</span>
                  </div>
                ))}
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'14px',fontWeight:'500',color:'#0a0a0a',marginTop:'8px',paddingTop:'8px',borderTop:'1px solid #e8e7e3'}}>
                  <span>Toplam</span><span>{brief.credit_cost} kredi</span>
                </div>
              </div>
            </div>

            {/* SORULAR GEÇMİŞİ */}
            {visibleQuestions.filter(q=>q.answer).length > 0 && (
              <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>SORULAR</div>
                {visibleQuestions.filter(q=>q.answer).map(q=>(
                  <div key={q.id} style={{marginBottom:'12px',padding:'12px 16px',background:'#f7f6f2',borderRadius:'8px'}}>
                    <div style={{fontSize:'13px',color:'#0a0a0a',marginBottom:'4px',fontWeight:'500'}}>{q.question}</div>
                    <div style={{fontSize:'13px',color:'#1db81d'}}>↳ {q.answer}</div>
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
