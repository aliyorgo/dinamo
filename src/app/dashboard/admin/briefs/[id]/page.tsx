'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function AdminBriefDetail() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [brief, setBrief] = useState<any>(null)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: b } = await supabase.from('briefs').select('*, clients(company_name)').eq('id', id).single()
    setBrief(b)
    const { data: s } = await supabase.from('video_submissions').select('*').eq('brief_id', id).order('submitted_at', {ascending: false})
    setSubmissions(s || [])
  }

  async function handleApprove(submissionId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('video_submissions').update({ status: 'admin_approved' }).eq('id', submissionId)
    await supabase.from('approvals').insert({ video_submission_id: submissionId, approved_by: user?.id, role: 'admin' })
    await supabase.from('briefs').update({ status: 'delivered' }).eq('id', id)

    // Kredi kes
    const { data: briefData } = await supabase.from('briefs').select('credit_cost, client_id, client_user_id').eq('id', id).single()
    if (briefData) {
      const { data: clientUser } = await supabase.from('client_users').select('credit_balance').eq('id', briefData.client_user_id).single()
      if (clientUser) {
        await supabase.from('client_users').update({ credit_balance: clientUser.credit_balance - briefData.credit_cost }).eq('id', briefData.client_user_id)
        await supabase.from('credit_transactions').insert({
          client_id: briefData.client_id,
          client_user_id: briefData.client_user_id,
          brief_id: id,
          amount: -briefData.credit_cost,
          type: 'deduct',
          description: `${brief?.campaign_name} — video teslimi`
        })
      }
    }
    setMsg('Onaylandı, video müşteriye iletildi, kredi kesildi.')
    loadData()
  }

  async function handleRevision(submissionId: string) {
    await supabase.from('video_submissions').update({ status: 'revision_requested' }).eq('id', submissionId)
    await supabase.from('briefs').update({ status: 'revision' }).eq('id', id)
    setMsg('Revizyon talebi gönderildi.')
    loadData()
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'system-ui,sans-serif',background:'#f7f6f2'}}>
      <div style={{width:'220px',background:'#0a0a0a',padding:'32px 0',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'0 24px 32px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:'20px',fontWeight:'500',color:'#fff'}}>dinamo</div>
          <div style={{fontSize:'11px',color:'#666',marginTop:'4px',letterSpacing:'1px',fontFamily:'monospace'}}>ADMIN</div>
        </div>
        <nav style={{flex:1,padding:'24px 0'}}>
          <a href="/dashboard/admin/briefs" style={{display:'block',padding:'10px 24px',fontSize:'11px',color:'#888',textDecoration:'none',letterSpacing:'1px',fontFamily:'monospace'}}>← BRİEFLER</a>
        </nav>
      </div>

      <div style={{flex:1,padding:'48px',maxWidth:'800px'}}>
        {brief && (
          <>
            <div style={{marginBottom:'32px'}}>
              <h1 style={{fontSize:'28px',fontWeight:'400',letterSpacing:'-1px',margin:'0 0 8px',color:'#0a0a0a'}}>{brief.campaign_name}</h1>
              <div style={{fontSize:'14px',color:'#555'}}>{brief.clients?.company_name} · {brief.video_type} · {brief.credit_cost} kredi</div>
            </div>

            {msg && <div style={{padding:'12px 16px',background:'#e8f7e8',borderRadius:'8px',fontSize:'13px',color:'#1db81d',marginBottom:'24px'}}>{msg}</div>}

            <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
              <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'11px',color:'#888',letterSpacing:'1px',fontFamily:'monospace'}}>
                VİDEO GÖNDERİMLERİ ({submissions.length})
              </div>
              {submissions.length === 0 ? (
                <div style={{padding:'48px',textAlign:'center',color:'#888',fontSize:'14px'}}>Henüz video yüklenmedi.</div>
              ) : submissions.map((s,i)=>(
                <div key={s.id} style={{padding:'20px 24px',borderBottom:i<submissions.length-1?'1px solid #f0f0ee':'none'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'12px'}}>
                    <div>
                      <div style={{fontSize:'14px',fontWeight:'500',color:'#0a0a0a'}}>Versiyon {s.version}</div>
                      <div style={{fontSize:'12px',color:'#888',marginTop:'2px'}}>{new Date(s.submitted_at).toLocaleDateString('tr-TR')}</div>
                    </div>
                    <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'100px',background:'#f0f0ee',color:'#888',fontFamily:'monospace'}}>
                      {s.status}
                    </span>
                  </div>
                  <video controls style={{width:'100%',borderRadius:'8px',background:'#000',marginBottom:'12px',maxHeight:'300px'}}>
                    <source src={s.video_url} />
                  </video>
                  {s.status === 'pending' || s.status === 'producer_approved' ? (
                    <div style={{display:'flex',gap:'8px'}}>
                      <button onClick={()=>handleApprove(s.id)}
                        style={{padding:'9px 20px',background:'#1db81d',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',cursor:'pointer',fontWeight:'500'}}>
                        Onayla & Teslim Et
                      </button>
                      <button onClick={()=>handleRevision(s.id)}
                        style={{padding:'9px 20px',background:'#fff',color:'#e24b4a',border:'1px solid #e24b4a',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>
                        Revizyon İste
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
