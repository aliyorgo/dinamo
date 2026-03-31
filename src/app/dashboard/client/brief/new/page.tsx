'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const VIDEO_TYPES = ['Bumper / Pre-roll','Story / Reels','Feed Video','Long Form']
const FORMATS = ['9:16','16:9','1:1']
const BASE_COSTS: Record<string,number> = {'Bumper / Pre-roll':12,'Story / Reels':18,'Feed Video':24,'Long Form':36}
const REVISION_COST = 4

export default function NewBriefPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [clientUser, setClientUser] = useState<any>(null)
  const [companyName, setCompanyName] = useState('')
  const [userName, setUserName] = useState('')
  const [settings, setSettings] = useState<Record<string,string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  const [form, setForm] = useState({
    campaign_name: '',
    video_type: '',
    format: [] as string[],
    target_audience: '',
    has_cta: '',
    cta: '',
    message: '',
    voiceover_type: 'none',
    voiceover_gender: '' as '' | 'male' | 'female',
    voiceover_text: '',
    notes: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name').eq('id', user.id).single()
      setUserName(userData?.name || '')
      const { data: cu } = await supabase.from('client_users').select('*, clients(company_name, credit_balance)').eq('user_id', user.id).single()
      setClientUser(cu)
      setCompanyName((cu as any)?.clients?.company_name || '')
      const { data: s } = await supabase.from('admin_settings').select('*')
      const map: Record<string,string> = {}
      s?.forEach((x:any) => map[x.key] = x.value)
      setSettings(map)
    }
    load()
  }, [router])

  function calcCost() {
    let cost = BASE_COSTS[form.video_type] || 0
    if (form.format.length > 1) cost += form.format.length - 1
    if (form.voiceover_type === 'real') cost += parseInt(settings['credit_voiceover_real'] || '6')
    return cost
  }

  function toggleFormat(f: string) {
    setForm(prev => ({
      ...prev,
      format: prev.format.includes(f) ? prev.format.filter(x=>x!==f) : [...prev.format, f]
    }))
  }

  async function generateVoiceover() {
    if (!form.message && !form.campaign_name) return
    setAiLoading(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `Aşağıdaki reklam kampanyası için kısa, etkili bir Türkçe seslendirme metni yaz. Sadece metni ver, açıklama ekleme.

Kampanya: ${form.campaign_name}
Mesaj: ${form.message}
CTA: ${form.cta}
Hedef kitle: ${form.target_audience}
Video tipi: ${form.video_type}

Seslendirme metni:`
          }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      setForm(prev => ({...prev, voiceover_text: text.trim()}))
    } catch {}
    setAiLoading(false)
  }

  async function handleSubmit() {
    if (!clientUser) return
    const cost = calcCost()
    if (clientUser.credit_balance < cost) return
    setSubmitting(true)
    await supabase.from('briefs').insert({
      client_id: clientUser.client_id,
      client_user_id: clientUser.id,
      campaign_name: form.campaign_name,
      video_type: form.video_type,
      format: form.format,
      message: form.message,
      cta: form.has_cta === 'yes' ? form.cta : null,
      target_audience: form.target_audience,
      voiceover_type: form.voiceover_type,
      voiceover_gender: form.voiceover_gender || null,
      voiceover_text: form.voiceover_text || null,
      notes: form.notes || null,
      status: 'submitted',
      credit_cost: cost,
    })
    router.push('/dashboard/client?submitted=1')
  }

  const cost = calcCost()
  const balance = clientUser?.credit_balance || 0

  const steps = ['Kampanya & Format','Hedef & CTA','Brief Metni','Seslendirme','Son Kontrol']

  function Sidebar() {
    return (
      <div style={{width:'220px',background:'#111113',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'15px',fontWeight:'500',color:'#fff',letterSpacing:'-0.5px',marginBottom:'12px'}}>
            dinam<span style={{display:'inline-block',width:'9px',height:'9px',borderRadius:'50%',border:'2px solid #22c55e',position:'relative',top:'1px'}}></span>
          </div>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'3px'}}>{companyName}</div>
          <div style={{fontSize:'13px',fontWeight:'500',color:'#fff'}}>{userName}</div>
        </div>

        <div style={{padding:'12px 16px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'4px'}}>Kredi Bakiyesi</div>
          <div style={{fontSize:'22px',fontWeight:'300',color:'#fff',letterSpacing:'-1px',marginBottom:'8px'}}>{balance}</div>
          {cost > 0 && (
            <div style={{background:'rgba(34,197,94,0.1)',border:'0.5px solid rgba(34,197,94,0.2)',borderRadius:'8px',padding:'8px 10px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:'10px',color:'rgba(34,197,94,0.7)'}}>Bu brief</span>
                <span style={{fontSize:'14px',fontWeight:'500',color:'#22c55e'}}>{cost} kredi</span>
              </div>
              {form.format.length > 1 && <div style={{fontSize:'9px',color:'rgba(34,197,94,0.5)',marginTop:'3px'}}>+{form.format.length-1} ek format</div>}
              {form.voiceover_type==='real' && <div style={{fontSize:'9px',color:'rgba(34,197,94,0.5)',marginTop:'2px'}}>+6 gerçek seslendirme</div>}
            </div>
          )}
        </div>

        <div style={{padding:'10px 8px',borderBottom:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div style={{fontSize:'9px',letterSpacing:'1.5px',color:'rgba(255,255,255,0.2)',padding:'0 6px',marginBottom:'6px',textTransform:'uppercase'}}>Adımlar</div>
          {steps.map((s,i)=>{
            const n = i+1
            const isDone = n < step
            const isCur = n === step
            return (
              <div key={s}>
                <div onClick={()=>{ if(isDone) setStep(n) }}
                  style={{display:'flex',alignItems:'flex-start',gap:'8px',padding:'5px 6px',borderRadius:'7px',cursor:isDone?'pointer':'default',background:isCur?'rgba(255,255,255,0.06)':'transparent',marginBottom:'1px'}}>
                  <div style={{width:'17px',height:'17px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:'500',flexShrink:0,marginTop:'1px',
                    background:isDone?'#22c55e':isCur?'#fff':'rgba(255,255,255,0.07)',
                    color:isDone?'#fff':isCur?'#111':'rgba(255,255,255,0.25)'}}>
                    {isDone?'✓':n}
                  </div>
                  <div style={{marginTop:'1px'}}>
                    <div style={{fontSize:'11px',color:isDone?'rgba(255,255,255,0.45)':isCur?'#fff':'rgba(255,255,255,0.3)',fontWeight:isCur?'500':'400'}}>
                      {n===1&&form.campaign_name?form.campaign_name.substring(0,18)+(form.campaign_name.length>18?'…':''):s}
                    </div>
                    {isDone&&n===1&&form.video_type&&<div style={{fontSize:'9px',color:'rgba(255,255,255,0.2)',marginTop:'1px'}}>{form.video_type} · {form.format.join(', ')}</div>}
                  </div>
                </div>
                {n<5&&<div style={{width:'1px',height:'8px',background:'rgba(255,255,255,0.07)',marginLeft:'14px'}}></div>}
              </div>
            )
          })}
        </div>

        <div style={{flex:1}}></div>
        <div style={{padding:'10px 8px',borderTop:'0.5px solid rgba(255,255,255,0.07)'}}>
          <div onClick={()=>router.push('/dashboard/client')} style={{display:'flex',alignItems:'center',gap:'7px',padding:'6px 8px',borderRadius:'7px',cursor:'pointer'}}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{fontSize:'11px',color:'rgba(255,255,255,0.25)',fontFamily:'Inter,sans-serif'}}>Projelerime dön</span>
          </div>
        </div>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width:'100%',boxSizing:'border-box',background:'#fff',border:'0.5px solid rgba(0,0,0,0.12)',
    borderRadius:'10px',padding:'10px 14px',fontSize:'14px',color:'#0a0a0a',
    fontFamily:'Inter,sans-serif',outline:'none'
  }
  const pillStyle = (sel:boolean): React.CSSProperties => ({
    padding:'8px 18px',borderRadius:'100px',border:'0.5px solid',
    borderColor:sel?'#111113':'rgba(0,0,0,0.12)',
    background:sel?'#111113':'#fff',
    color:sel?'#fff':'#555',fontSize:'13px',cursor:'pointer',
    fontFamily:'Inter,sans-serif',display:'inline-block',margin:'3px'
  })

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');`}</style>
      <Sidebar/>
      <div style={{flex:1,display:'flex',flexDirection:'column',background:'#f5f4f0',overflow:'hidden'}}>
        <div style={{padding:'14px 28px',background:'#fff',borderBottom:'0.5px solid rgba(0,0,0,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div style={{fontSize:'12px',color:'#888'}}>Yeni Brief / <span style={{color:'#0a0a0a',fontWeight:'500'}}>{steps[step-1]}</span></div>
          <div style={{fontSize:'11px',color:'#aaa'}}>Adım {step} / 5</div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'32px 40px',maxWidth:'640px'}}>

          {/* ADIM 1 */}
          {step===1&&(
            <div>
              <div style={{fontSize:'10px',letterSpacing:'1px',color:'#888',textTransform:'uppercase',marginBottom:'8px'}}>Adım 1 / 5</div>
              <div style={{fontSize:'26px',fontWeight:'300',color:'#0a0a0a',letterSpacing:'-0.5px',marginBottom:'28px'}}>Kampanyanıza bir isim verin</div>
              <div style={{marginBottom:'22px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>Kampanya Adı</div>
                <input style={inputStyle} value={form.campaign_name} onChange={e=>setForm({...form,campaign_name:e.target.value})} placeholder="örn. Yaz Kampanyası 2025..." />
              </div>
              <div style={{marginBottom:'22px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>Video Tipi</div>
                <div>{VIDEO_TYPES.map(t=><span key={t} style={pillStyle(form.video_type===t)} onClick={()=>setForm({...form,video_type:t})}>{t}</span>)}</div>
              </div>
              <div style={{marginBottom:'8px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'4px'}}>Format</div>
                <div style={{fontSize:'11px',color:'#aaa',marginBottom:'8px'}}>Birden fazla seçebilirsiniz. İlk format krediye dahil, her ek format +1 kredi.</div>
                <div>{FORMATS.map(f=><span key={f} style={pillStyle(form.format.includes(f))} onClick={()=>toggleFormat(f)}>{f}</span>)}</div>
              </div>
            </div>
          )}

          {/* ADIM 2 */}
          {step===2&&(
            <div>
              <div style={{fontSize:'10px',letterSpacing:'1px',color:'#888',textTransform:'uppercase',marginBottom:'8px'}}>Adım 2 / 5 · {form.campaign_name}</div>
              <div style={{fontSize:'26px',fontWeight:'300',color:'#0a0a0a',letterSpacing:'-0.5px',marginBottom:'28px'}}>Kimi hedefliyorsunuz?</div>
              <div style={{marginBottom:'22px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>Hedef Kitle</div>
                <input style={inputStyle} value={form.target_audience} onChange={e=>setForm({...form,target_audience:e.target.value})} placeholder="örn. 25-40 yaş, online alışveriş yapan..." />
              </div>
              <div style={{marginBottom:'22px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>Call to Action var mı?</div>
                <div>
                  <span style={pillStyle(form.has_cta==='yes')} onClick={()=>setForm({...form,has_cta:'yes'})}>Evet, var</span>
                  <span style={pillStyle(form.has_cta==='no')} onClick={()=>setForm({...form,has_cta:'no',cta:''})}>Hayır, yok</span>
                </div>
              </div>
              {form.has_cta==='yes'&&(
                <div style={{marginBottom:'8px'}}>
                  <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>CTA Metni</div>
                  <input style={inputStyle} value={form.cta} onChange={e=>setForm({...form,cta:e.target.value})} placeholder="örn. Hemen sipariş ver, %30 indirim fırsatını kaçırma..." />
                </div>
              )}
            </div>
          )}

          {/* ADIM 3 */}
          {step===3&&(
            <div>
              <div style={{fontSize:'10px',letterSpacing:'1px',color:'#888',textTransform:'uppercase',marginBottom:'8px'}}>Adım 3 / 5 · {form.campaign_name}</div>
              <div style={{fontSize:'26px',fontWeight:'300',color:'#0a0a0a',letterSpacing:'-0.5px',marginBottom:'8px'}}>Brief'inizi yazın</div>
              <div style={{fontSize:'13px',color:'#888',marginBottom:'24px',lineHeight:'1.6'}}>Ne anlatmak istiyorsunuz? Tonunuzu, mesajınızı, hikayenizi ve önemli detayları buraya yazın. Ne kadar detaylı olursa o kadar iyi.</div>
              <textarea style={{...inputStyle,resize:'vertical',lineHeight:'1.7'}} rows={10} value={form.message} onChange={e=>setForm({...form,message:e.target.value})} placeholder="Videonun mesajını, tonunu, hikayesini ve önemli detaylarını buraya yazın..." />
            </div>
          )}

          {/* ADIM 4 */}
          {step===4&&(
            <div>
              <div style={{fontSize:'10px',letterSpacing:'1px',color:'#888',textTransform:'uppercase',marginBottom:'8px'}}>Adım 4 / 5 · {form.campaign_name}</div>
              <div style={{fontSize:'26px',fontWeight:'300',color:'#0a0a0a',letterSpacing:'-0.5px',marginBottom:'28px'}}>Seslendirme</div>
              <div style={{marginBottom:'22px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>Seslendirme Tipi</div>
                <div>
                  <span style={pillStyle(form.voiceover_type==='none')} onClick={()=>setForm({...form,voiceover_type:'none',voiceover_gender:'',voiceover_text:''})}>Yok</span>
                  <span style={pillStyle(form.voiceover_type==='ai')} onClick={()=>setForm({...form,voiceover_type:'ai',voiceover_gender:''})}>AI Seslendirme</span>
                  <span style={pillStyle(form.voiceover_type==='real')} onClick={()=>setForm({...form,voiceover_type:'real'})}>Gerçek Seslendirme (+6 kredi)</span>
                </div>
              </div>
              {form.voiceover_type==='real'&&(
                <div style={{marginBottom:'22px'}}>
                  <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>Seslendirme Cinsiyeti</div>
                  <div>
                    <span style={pillStyle(form.voiceover_gender==='male')} onClick={()=>setForm({...form,voiceover_gender:'male'})}>Erkek</span>
                    <span style={pillStyle(form.voiceover_gender==='female')} onClick={()=>setForm({...form,voiceover_gender:'female'})}>Kadın</span>
                  </div>
                </div>
              )}
              {form.voiceover_type!=='none'&&(
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                    <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase'}}>Seslendirme Metni</div>
                    <button onClick={generateVoiceover} disabled={aiLoading} style={{fontSize:'11px',padding:'5px 12px',borderRadius:'6px',border:'0.5px solid rgba(0,0,0,0.15)',background:'#111113',color:'#fff',cursor:'pointer',fontFamily:'Inter,sans-serif'}}>
                      {aiLoading?'Yazıyor...':form.voiceover_text?'Yeniden Yaz':'AI ile Yaz'}
                    </button>
                  </div>
                  <textarea style={{...inputStyle,resize:'vertical',lineHeight:'1.7'}} rows={6} value={form.voiceover_text} onChange={e=>setForm({...form,voiceover_text:e.target.value})} placeholder="Seslendirme metnini yazın veya AI ile oluşturun..." />
                </div>
              )}
              {form.voiceover_type==='none'&&(
                <div style={{padding:'16px',background:'rgba(0,0,0,0.03)',borderRadius:'10px',fontSize:'13px',color:'#888',lineHeight:'1.6'}}>
                  Seslendirme olmadan da videonuz için müzik ve efekt kullanabiliriz.
                </div>
              )}
            </div>
          )}

          {/* ADIM 5 */}
          {step===5&&(
            <div>
              <div style={{fontSize:'10px',letterSpacing:'1px',color:'#888',textTransform:'uppercase',marginBottom:'8px'}}>Adım 5 / 5 · {form.campaign_name}</div>
              <div style={{fontSize:'26px',fontWeight:'300',color:'#0a0a0a',letterSpacing:'-0.5px',marginBottom:'28px'}}>Son notlar</div>
              <div style={{marginBottom:'22px'}}>
                <div style={{fontSize:'11px',color:'#888',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:'8px'}}>Uyarılar & Hassasiyetler</div>
                <textarea style={{...inputStyle,resize:'vertical',lineHeight:'1.7'}} rows={4} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Kaçınılması gereken içerik, hassas konular, marka kısıtlamaları..." />
              </div>
              <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.12)',borderRadius:'12px',padding:'18px'}}>
                <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a',marginBottom:'12px'}}>Brief Özeti</div>
                <div style={{fontSize:'12px',color:'#555',lineHeight:'2'}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#888'}}>Kampanya</span><span style={{color:'#0a0a0a',fontWeight:'500'}}>{form.campaign_name}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#888'}}>Video Tipi</span><span style={{color:'#0a0a0a'}}>{form.video_type}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#888'}}>Format</span><span style={{color:'#0a0a0a'}}>{form.format.join(', ')}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#888'}}>Hedef Kitle</span><span style={{color:'#0a0a0a'}}>{form.target_audience}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#888'}}>CTA</span><span style={{color:'#0a0a0a'}}>{form.has_cta==='yes'?form.cta:'Yok'}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#888'}}>Seslendirme</span><span style={{color:'#0a0a0a'}}>{form.voiceover_type==='none'?'Yok':form.voiceover_type==='real'?'Gercek Seslendirme':'AI Seslendirme'}{form.voiceover_gender?` (${form.voiceover_gender==='male'?'Erkek':'Kadin'})`:''}</span></div>
                  {form.message&&<div style={{marginTop:'6px',paddingTop:'6px',borderTop:'0.5px solid rgba(0,0,0,0.08)'}}><span style={{color:'#888'}}>Brief: </span><span style={{color:'#333'}}>{form.message.length>120?form.message.substring(0,120)+'...':form.message}</span></div>}
                  {form.notes&&<div><span style={{color:'#888'}}>Notlar: </span><span style={{color:'#333'}}>{form.notes.length>80?form.notes.substring(0,80)+'...':form.notes}</span></div>}
                  <div style={{marginTop:'8px',paddingTop:'8px',borderTop:'0.5px solid rgba(0,0,0,0.12)',fontWeight:'500',fontSize:'13px',color:'#0a0a0a'}}>{cost} kredi harcanacak</div>
                </div>
              </div>
              {balance < cost && (
                <div style={{marginTop:'12px',background:'#fef2f2',border:'0.5px solid #fca5a5',borderRadius:'10px',padding:'14px',fontSize:'13px',color:'#dc2626'}}>
                  Yetersiz kredi. Bakiyeniz: {balance} kredi.
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{padding:'16px 40px',background:'#fff',borderTop:'0.5px solid rgba(0,0,0,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <button onClick={()=>step>1?setStep(step-1):router.push('/dashboard/client')}
            style={{background:'none',border:'0.5px solid rgba(0,0,0,0.15)',borderRadius:'8px',padding:'9px 20px',fontSize:'13px',fontFamily:'Inter,sans-serif',color:'#555',cursor:'pointer'}}>
            {step===1?'İptal':'← Geri'}
          </button>
          {step<5?(
            <button onClick={()=>setStep(step+1)}
              disabled={
                (step===1&&(!form.campaign_name||!form.video_type||form.format.length===0))||
                (step===2&&(!form.target_audience||!form.has_cta))||
                (step===3&&!form.message)
              }
              style={{background:'#111113',color:'#fff',border:'none',borderRadius:'8px',padding:'9px 24px',fontSize:'13px',fontFamily:'Inter,sans-serif',cursor:'pointer',fontWeight:'500',opacity:(step===1&&(!form.campaign_name||!form.video_type||form.format.length===0))||(step===2&&(!form.target_audience||!form.has_cta))||(step===3&&!form.message)?0.4:1}}>
              Devam et →
            </button>
          ):(
            <button onClick={handleSubmit} disabled={submitting||balance<cost}
              style={{background:'#22c55e',color:'#fff',border:'none',borderRadius:'8px',padding:'9px 24px',fontSize:'13px',fontFamily:'Inter,sans-serif',cursor:'pointer',fontWeight:'500',opacity:balance<cost?0.4:1}}>
              {submitting?'Gönderiliyor...':'Brief Gönder'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
