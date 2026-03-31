'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams, useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const NAV = [
  {label:'GENEL BAKIŞ',href:'/dashboard/admin'},
  {label:'KULLANICILAR',href:'/dashboard/admin/users'},
  {label:'MÜŞTERİLER',href:'/dashboard/admin/clients'},
  {label:'BRİEFLER',href:'/dashboard/admin/briefs'},
  {label:'CREATOR\'LAR',href:'/dashboard/admin/creators'},
  {label:'KREDİLER',href:'/dashboard/admin/credits'},
  {label:'AYARLAR',href:'/dashboard/admin/settings'},
]

interface Submission {
  id: string
  version: number
  status: string
  video_url: string
  submitted_at: string
  producer_notes: string | null
}

async function recordCreatorEarning(briefId: string, submissionId: string) {
  const { data: pb } = await supabase.from('producer_briefs').select('assigned_creator_id').eq('brief_id', briefId).maybeSingle()
  if (!pb?.assigned_creator_id) return
  const { data: brief } = await supabase.from('briefs').select('credit_cost').eq('id', briefId).single()
  if (!brief) return
  const { data: rate } = await supabase.from('admin_settings').select('value').eq('key', 'creator_credit_rate').maybeSingle()
  const tlRate = parseFloat(rate?.value || '500')
  await supabase.from('creator_earnings').insert({
    brief_id: briefId,
    creator_id: pb.assigned_creator_id,
    video_submission_id: submissionId,
    credits: brief.credit_cost,
    tl_rate: tlRate,
    tl_amount: brief.credit_cost * tlRate,
    paid: false
  })
}

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

export default function AdminBriefDetail() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [brief, setBrief] = useState<any>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [questions, setQuestions] = useState<any[]>([])
  const [clientEmail, setClientEmail] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [revisionNotes, setRevisionNotes] = useState<Record<string,string>>({})
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: b } = await supabase
      .from('briefs')
      .select('*, clients(company_name), client_users(*, users(email, name))')
      .eq('id', id)
      .single()
    setBrief(b)
    setEditForm(b || {})
    if (b?.client_users?.users?.email) setClientEmail(b.client_users.users.email)
    const { data: s } = await supabase.from('video_submissions').select('*').eq('brief_id', id).order('submitted_at', { ascending: false })
    setSubmissions(s || [])
    const { data: q } = await supabase.from('brief_questions').select('*').eq('brief_id', id).order('asked_at')
    setQuestions(q || [])
  }

  async function handleApprove(submissionId: string) {
    setLoading(true)
    setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('video_submissions').update({ status: 'admin_approved' }).eq('id', submissionId)
    await supabase.from('approvals').insert({ video_submission_id: submissionId, approved_by: user?.id, role: 'admin' })
    await supabase.from('briefs').update({ status: 'approved' }).eq('id', id)
    await recordCreatorEarning(id, submissionId)

    if (clientEmail && brief) {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: clientEmail,
          subject: `${brief.campaign_name} — Videonuz Hazır`,
          html: `<p>Merhaba,</p><p><strong>${brief.campaign_name}</strong> kampanyanız için hazırlanan video onaylandı ve hesabınıza iletildi.</p><p>Dinamo paneline giriş yaparak videonuzu inceleyebilir ve onaylayabilirsiniz.</p><p>İyi çalışmalar,<br/>Dinamo</p>`
        })
      }).catch(()=>null)
    }

    setMsg('Video onaylandı, müşteriye iletildi.')
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

  async function handleRevision(submissionId: string) {
    const note = revisionNotes[submissionId]
    if (!note?.trim()) { setMsg('Revizyon notu yazmak zorunludur.'); return }
    setLoading(true)
    await supabase.from('video_submissions').update({ status: 'revision_requested', producer_notes: note }).eq('id', submissionId)
    await supabase.from('briefs').update({ status: 'revision' }).eq('id', id)
    await supabase.from('brief_questions').insert({ brief_id: id, question: `İÇ REVİZYON: ${note}` })

    if (clientEmail && brief) {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: clientEmail,
          subject: `${brief.campaign_name} — Revizyon`,
          html: `<p>Merhaba,</p><p><strong>${brief.campaign_name}</strong> kampanyanız için revizyon talebi oluşturuldu.</p><p>İyi çalışmalar,<br/>Dinamo</p>`
        })
      }).catch(()=>null)
    }

    setMsg('Revizyon talebi gönderildi.')
    loadData()
    setLoading(false)
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('briefs').update({
      campaign_name: editForm.campaign_name,
      video_type: editForm.video_type,
      message: editForm.message,
      cta: editForm.cta,
      target_audience: editForm.target_audience,
      notes: editForm.notes,
      credit_cost: parseInt(editForm.credit_cost),
    }).eq('id', id)
    if (error) { setMsg('Hata: ' + error.message); setLoading(false); return }
    setMsg('Brief güncellendi.')
    setEditMode(false)
    loadData()
    setLoading(false)
  }

  async function handleCancel() {
    if (!confirm('Bu briefi iptal etmek istediğinizden emin misiniz?')) return
    await supabase.from('briefs').update({ status: 'cancelled' }).eq('id', id)
    if (clientEmail && brief) {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: clientEmail,
          subject: `${brief.campaign_name} — Brief İptal Edildi`,
          html: `<p>Merhaba,</p><p><strong>${brief.campaign_name}</strong> kampanyanız için gönderilen brief iptal edildi.</p><p>İyi çalışmalar,<br/>Dinamo</p>`
        })
      }).catch(()=>null)
    }
    router.push('/dashboard/admin/briefs')
  }

  const clientRevisions = questions.filter(q => q.question.startsWith('REVİZYON:'))

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'system-ui,sans-serif',background:'#f7f6f2'}}>
      <div style={{width:'220px',background:'#0a0a0a',padding:'32px 0',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'0 24px 32px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:'20px',fontWeight:'500',color:'#fff'}}>dinamo</div>
          <div style={{fontSize:'11px',color:'#666',marginTop:'4px',letterSpacing:'1px',fontFamily:'monospace'}}>ADMIN</div>
        </div>
        <nav style={{flex:1,padding:'24px 0'}}>
          {NAV.map(item=>(
            <a key={item.href} href={item.href} style={{display:'block',padding:'10px 24px',fontSize:'11px',color:'#888',textDecoration:'none',letterSpacing:'1px',fontFamily:'monospace'}}
              onMouseEnter={e=>(e.currentTarget.style.color='#fff')} onMouseLeave={e=>(e.currentTarget.style.color='#888')}>{item.label}</a>
          ))}
        </nav>
      </div>

      <div style={{flex:1,padding:'48px',maxWidth:'960px'}}>
        <a href="/dashboard/admin/briefs" style={{fontSize:'12px',color:'#888',textDecoration:'none',fontFamily:'monospace',display:'block',marginBottom:'24px'}}>← BRİEFLER</a>

        {brief && (
          <>
            <div style={{marginBottom:'24px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'16px'}}>
              <div>
                <h1 style={{fontSize:'28px',fontWeight:'400',letterSpacing:'-1px',margin:'0 0 8px',color:'#0a0a0a'}}>{brief.campaign_name}</h1>
                <div style={{fontSize:'14px',color:'#555'}}>{brief.clients?.company_name} · {brief.video_type} · {brief.credit_cost} kredi</div>
              </div>
              <div style={{display:'flex',gap:'8px',flexShrink:0}}>
                <button onClick={()=>setEditMode(!editMode)}
                  style={{padding:'8px 16px',background:'#fff',color:'#0a0a0a',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>
                  {editMode ? 'İptal' : 'Düzenle'}
                </button>
                <button onClick={handleCancel}
                  style={{padding:'8px 16px',background:'#fff',color:'#e24b4a',border:'1px solid #e24b4a',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>
                  Brief İptal Et
                </button>
              </div>
            </div>

            {msg && <div style={{padding:'12px 16px',background:msg.startsWith('Hata')||msg.includes('zorunlu')?'#fef2f2':'#e8f7e8',borderRadius:'8px',fontSize:'13px',color:msg.startsWith('Hata')||msg.includes('zorunlu')?'#e24b4a':'#1db81d',marginBottom:'24px'}}>{msg}</div>}

            {/* MÜŞTERİ REVİZYONU */}
            {clientRevisions.length > 0 && (
              <div style={{background:'#fff',border:'2px solid #e24b4a',borderRadius:'12px',padding:'24px',marginBottom:'24px'}}>
                <div style={{fontSize:'11px',color:'#e24b4a',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'12px',display:'flex',alignItems:'center',gap:'8px'}}>
                  <span style={{width:'8px',height:'8px',borderRadius:'50%',background:'#e24b4a',display:'inline-block'}}></span>
                  MÜŞTERİ REVİZYONU ({clientRevisions.length})
                </div>
                {clientRevisions.map((r,i)=>(
                  <div key={r.id} style={{padding:'10px 14px',background:'#fef2f2',borderRadius:'8px',marginBottom:'8px'}}>
                    <div style={{fontSize:'12px',color:'#e24b4a',fontFamily:'monospace',marginBottom:'4px'}}>{i+1}. REVİZYON</div>
                    <div style={{fontSize:'14px',color:'#0a0a0a'}}>{r.question.replace('REVİZYON: ','')}</div>
                  </div>
                ))}
              </div>
            )}

            {editMode ? (
              <form onSubmit={handleEdit} style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px',marginBottom:'24px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>BRİEF DÜZENLE</div>
                {[
                  {key:'campaign_name',label:'Kampanya Adı',type:'text'},
                  {key:'video_type',label:'Video Tipi',type:'text'},
                  {key:'message',label:'Mesaj',type:'textarea'},
                  {key:'cta',label:'CTA',type:'text'},
                  {key:'target_audience',label:'Hedef Kitle',type:'text'},
                  {key:'notes',label:'Notlar',type:'textarea'},
                  {key:'credit_cost',label:'Kredi',type:'number'},
                ].map(f=>(
                  <div key={f.key} style={{marginBottom:'16px'}}>
                    <label style={{display:'block',fontSize:'11px',color:'#555',marginBottom:'6px',letterSpacing:'1px',fontFamily:'monospace'}}>{f.label.toUpperCase()}</label>
                    {f.type === 'textarea' ? (
                      <textarea value={editForm[f.key] || ''} onChange={e=>setEditForm({...editForm,[f.key]:e.target.value})} rows={3}
                        style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box',resize:'vertical',fontFamily:'system-ui,sans-serif',color:'#0a0a0a'}} />
                    ) : (
                      <input type={f.type} value={editForm[f.key] || ''} onChange={e=>setEditForm({...editForm,[f.key]:e.target.value})}
                        style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box',color:'#0a0a0a'}} />
                    )}
                  </div>
                ))}
                <button type="submit" disabled={loading}
                  style={{padding:'11px 24px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}>
                  {loading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </form>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginBottom:'24px'}}>
                <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px'}}>
                  <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'16px'}}>BRİEF BİLGİLERİ</div>
                  {[
                    {label:'Video Tipi',value:brief.video_type},
                    {label:'Format',value:Array.isArray(brief.format)?brief.format.join(', '):brief.format},
                    {label:'Mesaj',value:brief.message},
                    {label:'CTA',value:brief.cta},
                    {label:'Hedef Kitle',value:brief.target_audience},
                    {label:'Seslendirme',value:brief.voiceover_type},
                    {label:'Seslendirme Metni',value:brief.voiceover_text},
                    {label:'Notlar',value:brief.notes},
                    {label:'Kredi',value:`${brief.credit_cost} kredi`},
                  ].filter(f=>f.value).map(f=>(
                    <div key={f.label} style={{marginBottom:'10px'}}>
                      <div style={{fontSize:'11px',color:'#888',fontFamily:'monospace',marginBottom:'3px'}}>{f.label.toUpperCase()}</div>
                      <div style={{fontSize:'14px',color:'#0a0a0a',lineHeight:'1.5'}}>{f.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                  <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px'}}>
                    <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'12px'}}>MÜŞTERİ</div>
                    <div style={{fontSize:'14px',color:'#0a0a0a'}}>{brief.client_users?.users?.name}</div>
                    <div style={{fontSize:'13px',color:'#888',marginTop:'4px'}}>{clientEmail}</div>
                  </div>
                  {(brief.status === 'approved' || brief.status === 'in_production') && (
                    <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'24px'}}>
                      <div style={{fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'12px'}}>MÜŞTERİ ONAY</div>
                      <div style={{fontSize:'13px',color:'#555',marginBottom:'12px'}}>Müşteri onaylamadıysa manuel işaretleyin.</div>
                      <button onClick={handleClientApprove} disabled={loading}
                        style={{padding:'9px 20px',background:'#1db81d',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontWeight:'500'}}>
                        Müşteri Onayladı
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
              <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace'}}>
                VİDEO GÖNDERİMLERİ ({submissions.length})
              </div>
              {submissions.length === 0 ? (
                <div style={{padding:'48px',textAlign:'center',color:'#888',fontSize:'14px'}}>Henüz video yüklenmedi.</div>
              ) : submissions.map((s,i)=>(
                <div key={s.id} style={{padding:'24px',borderBottom:i<submissions.length-1?'1px solid #f0f0ee':'none'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
                    <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>Versiyon {s.version}</div>
                    <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'100px',background:'#f0f0ee',color:'#666',fontFamily:'monospace'}}>{s.status}</span>
                  </div>
                  <video controls style={{width:'100%',borderRadius:'8px',background:'#000',marginBottom:'16px',maxHeight:'300px'}}>
                    <source src={s.video_url} />
                  </video>
                  {(s.status === 'pending' || s.status === 'producer_approved') && (
                    <div>
                      <button onClick={()=>handleApprove(s.id)} disabled={loading}
                        style={{padding:'9px 20px',background:'#1db81d',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontWeight:'500',marginBottom:'12px',display:'block'}}>
                        {loading ? 'İşleniyor...' : 'Onayla → Müşteriye İlet'}
                      </button>
                      <textarea
                        value={revisionNotes[s.id] || ''}
                        onChange={e=>setRevisionNotes(prev=>({...prev,[s.id]:e.target.value}))}
                        placeholder="Revizyon notu (zorunlu)..." rows={2}
                        style={{width:'100%',padding:'9px 13px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',boxSizing:'border-box',resize:'vertical',fontFamily:'system-ui,sans-serif',color:'#0a0a0a',marginBottom:'8px'}} />
                      <button onClick={()=>handleRevision(s.id)} disabled={loading}
                        style={{padding:'9px 20px',background:'#fff',color:'#e24b4a',border:'1px solid #e24b4a',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>
                        Revizyon İste
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
