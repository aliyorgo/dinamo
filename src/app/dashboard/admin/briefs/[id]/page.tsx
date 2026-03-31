'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const NAV = [
  {label:'GENEL BAKIŞ',href:'/dashboard/admin'},
  {label:'KULLANICILAR',href:'/dashboard/admin/users'},
  {label:'MÜŞTERİLER',href:'/dashboard/admin/clients'},
  {label:'BRİEFLER',href:'/dashboard/admin/briefs'},
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

interface VideoRowProps {
  submission: Submission
  isLast: boolean
  onApprove: () => void
  onRevision: (note: string) => void
  loading: boolean
}

function VideoSubmissionRow({ submission: s, isLast, onApprove, onRevision, loading }: VideoRowProps) {
  const [revNote, setRevNote] = useState('')
  const [showRevForm, setShowRevForm] = useState(false)

  return (
    <div style={{padding:'24px',borderBottom:isLast?'none':'1px solid #f0f0ee'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px'}}>
        <div>
          <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>Versiyon {s.version}</div>
          <div style={{fontSize:'12px',color:'#888',marginTop:'2px'}}>{new Date(s.submitted_at).toLocaleDateString('tr-TR')}</div>
        </div>
        <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'100px',background:'#f0f0ee',color:'#666',fontFamily:'monospace'}}>{s.status}</span>
      </div>
      <video controls style={{width:'100%',borderRadius:'8px',background:'#000',marginBottom:'16px',maxHeight:'320px'}}>
        <source src={s.video_url} />
      </video>
      {(s.status === 'pending' || s.status === 'producer_approved') && !showRevForm && (
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={onApprove} disabled={loading}
            style={{padding:'9px 20px',background:'#1db81d',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontWeight:'500'}}>
            {loading ? 'İşleniyor...' : 'Onayla & Teslim Et'}
          </button>
          <button onClick={()=>setShowRevForm(true)}
            style={{padding:'9px 20px',background:'#fff',color:'#e24b4a',border:'1px solid #e24b4a',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>
            Revizyon İste
          </button>
        </div>
      )}
      {showRevForm && (
        <div style={{marginTop:'12px'}}>
          <textarea value={revNote} onChange={e=>setRevNote(e.target.value)} placeholder="Revizyon notu..." rows={3}
            style={{width:'100%',padding:'10px 14px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box',resize:'vertical',fontFamily:'system-ui,sans-serif',color:'#0a0a0a',marginBottom:'8px'}} />
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>{ onRevision(revNote); setShowRevForm(false) }} disabled={loading}
              style={{padding:'9px 20px',background:'#e24b4a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>
              Revizyon Gönder
            </button>
            <button onClick={()=>setShowRevForm(false)}
              style={{padding:'9px 20px',background:'#fff',color:'#888',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>
              İptal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminBriefDetail() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [brief, setBrief] = useState<any>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [clientEmail, setClientEmail] = useState('')
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
    if (b?.client_users?.users?.email) setClientEmail(b.client_users.users.email)
    const { data: s } = await supabase
      .from('video_submissions')
      .select('*')
      .eq('brief_id', id)
      .order('submitted_at', { ascending: false })
    setSubmissions(s || [])
  }

  async function handleApprove(submissionId: string) {
    setLoading(true)
    setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('video_submissions').update({ status: 'admin_approved' }).eq('id', submissionId)
    await supabase.from('approvals').insert({ video_submission_id: submissionId, approved_by: user?.id, role: 'admin' })
    await supabase.from('briefs').update({ status: 'delivered' }).eq('id', id)

    const { data: briefData } = await supabase
      .from('briefs')
      .select('credit_cost, client_id, client_user_id, campaign_name')
      .eq('id', id)
      .single()

    if (briefData?.client_user_id) {
      const { data: cu } = await supabase
        .from('client_users')
        .select('credit_balance')
        .eq('id', briefData.client_user_id)
        .single()

      if (cu) {
        const newBalance = Math.max(0, cu.credit_balance - (briefData.credit_cost || 0))
        await supabase.from('client_users').update({ credit_balance: newBalance }).eq('id', briefData.client_user_id)
        await supabase.from('credit_transactions').insert({
          client_id: briefData.client_id,
          client_user_id: briefData.client_user_id,
          brief_id: id,
          amount: -(briefData.credit_cost || 0),
          type: 'deduct',
          description: `${briefData.campaign_name} — video teslimi`
        })
      }
    }

    if (clientEmail && briefData) {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: clientEmail,
          subject: `${briefData.campaign_name} — Videonuz Hazır`,
          html: `<p>Merhaba,</p><p><strong>${briefData.campaign_name}</strong> kampanyanız için hazırlanan video onaylandı ve hesabınıza iletildi.</p><p>Dinamo paneline giriş yaparak videonuzu indirebilirsiniz.</p><p>İyi çalışmalar,<br/>Dinamo</p>`
        })
      })
    }

    setMsg('Onaylandı, video müşteriye iletildi, kredi kesildi.')
    loadData()
    setLoading(false)
  }

  async function handleRevision(submissionId: string, note: string) {
    setLoading(true)
    await supabase.from('video_submissions').update({ status: 'revision_requested', producer_notes: note }).eq('id', submissionId)
    await supabase.from('briefs').update({ status: 'revision' }).eq('id', id)

    if (clientEmail && brief) {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: clientEmail,
          subject: `${brief.campaign_name} — Revizyon Talebi`,
          html: `<p>Merhaba,</p><p><strong>${brief.campaign_name}</strong> kampanyanız için revizyon talebi oluşturuldu.</p><p>Dinamo panelinden detayları inceleyebilirsiniz.</p><p>İyi çalışmalar,<br/>Dinamo</p>`
        })
      })
    }

    setMsg('Revizyon talebi gönderildi.')
    loadData()
    setLoading(false)
  }

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

      <div style={{flex:1,padding:'48px',maxWidth:'900px'}}>
        <a href="/dashboard/admin/briefs" style={{fontSize:'12px',color:'#888',textDecoration:'none',fontFamily:'monospace',display:'block',marginBottom:'24px'}}>← BRİEFLER</a>

        {brief && (
          <>
            <div style={{marginBottom:'32px',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <h1 style={{fontSize:'28px',fontWeight:'400',letterSpacing:'-1px',margin:'0 0 8px',color:'#0a0a0a'}}>{brief.campaign_name}</h1>
                <div style={{fontSize:'14px',color:'#555'}}>{brief.clients?.company_name} · {brief.video_type} · {brief.credit_cost} kredi</div>
              </div>
              <span style={{fontSize:'11px',padding:'4px 12px',borderRadius:'100px',background:'#e8f7e8',color:'#1db81d',fontFamily:'monospace'}}>{brief.status}</span>
            </div>

            {msg && (
              <div style={{padding:'12px 16px',background:'#e8f7e8',borderRadius:'8px',fontSize:'13px',color:'#1db81d',marginBottom:'24px'}}>{msg}</div>
            )}

            <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
              <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace'}}>
                VİDEO GÖNDERİMLERİ ({submissions.length})
              </div>
              {submissions.length === 0 ? (
                <div style={{padding:'48px',textAlign:'center',color:'#888',fontSize:'14px'}}>Henüz video yüklenmedi.</div>
              ) : submissions.map((s, i) => (
                <VideoSubmissionRow
                  key={s.id}
                  submission={s}
                  isLast={i === submissions.length - 1}
                  onApprove={() => handleApprove(s.id)}
                  onRevision={(note: string) => handleRevision(s.id, note)}
                  loading={loading}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
