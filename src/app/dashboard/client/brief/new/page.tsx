'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function NewBriefPage() {
  const router = useRouter()
  const [fields, setFields] = useState<any[]>([])
  const [form, setForm] = useState<Record<string,any>>({})
  const [clientUser, setClientUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [creditCost, setCreditCost] = useState(0)
  const [settings, setSettings] = useState<Record<string,string>>({})

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: cu } = await supabase.from('client_users').select('*, clients(company_name, credit_balance)').eq('user_id', user.id).single()
      setClientUser(cu)
      const { data: formFields } = await supabase.from('brief_form_fields').select('*').eq('is_active', true).order('field_order')
      setFields(formFields || [])
      const { data: s } = await supabase.from('admin_settings').select('*')
      const map: Record<string,string> = {}
      s?.forEach(x => map[x.key] = x.value)
      setSettings(map)
      const defaults: Record<string,any> = {}
      formFields?.forEach(f => { defaults[f.field_key] = f.type === 'pills' ? [] : '' })
      setForm(defaults)
    }
    load()
  }, [router])

  useEffect(() => {
    let cost = 0
    const vt = form['video_type']
    if (vt === 'Bumper / Pre-roll') cost = parseInt(settings['credit_bumper'] || '12')
    else if (vt === 'Story / Reels') cost = parseInt(settings['credit_story'] || '18')
    else if (vt === 'Feed Video') cost = parseInt(settings['credit_feed'] || '24')
    else if (vt === 'Long Form') cost = parseInt(settings['credit_longform'] || '36')
    const formats = form['format'] || []
    if (formats.length > 1) cost += (formats.length - 1) * parseInt(settings['credit_extra_format'] || '1')
    if (form['voiceover_type'] === 'Gerçek Seslendirme (+6 kredi)') cost += parseInt(settings['credit_voiceover_real'] || '6')
    setCreditCost(cost)
  }, [form, settings])

  function handleChange(key: string, value: any) {
    setForm(prev => ({...prev, [key]: value}))
  }

  function handlePillToggle(key: string, value: string, multi: boolean) {
    if (multi) {
      const current = form[key] || []
      const next = current.includes(value) ? current.filter((v: string) => v !== value) : [...current, value]
      handleChange(key, next)
    } else {
      handleChange(key, form[key] === value ? '' : value)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientUser) { setMsg('Oturum hatası.'); return }
    if (creditCost === 0) { setMsg('Video tipi seçin.'); return }
    if (clientUser.credit_balance < creditCost) { setMsg('Yetersiz kredi.'); return }
    setLoading(true)
    setMsg('')
    const vot = form['voiceover_type']
    const { error } = await supabase.from('briefs').insert({
      client_id: clientUser.client_id,
      client_user_id: clientUser.id,
      campaign_name: form['campaign_name'],
      video_type: form['video_type'],
      format: form['format'],
      message: form['message'],
      cta: form['cta'],
      target_audience: form['target_audience'],
      voiceover_type: vot === 'Gerçek Seslendirme (+6 kredi)' ? 'real' : vot === 'AI Seslendirme' ? 'ai' : 'none',
      voiceover_text: form['voiceover_text'],
      notes: form['notes'],
      status: 'submitted',
      credit_cost: creditCost,
    })
    if (error) { setMsg(error.message); setLoading(false); return }
    router.push('/dashboard/client')
  }

  const multiPillFields = ['format']

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:'system-ui,sans-serif',background:'#f7f6f2'}}>
      <div style={{width:'220px',background:'#0a0a0a',padding:'32px 0',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'0 24px 32px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:'20px',fontWeight:'500',color:'#fff'}}>dinamo</div>
          <div style={{fontSize:'11px',color:'#666',marginTop:'4px',letterSpacing:'1px',fontFamily:'monospace'}}>MÜŞTERİ</div>
        </div>
        <nav style={{flex:1,padding:'24px 0'}}>
          <a href="/dashboard/client" style={{display:'block',padding:'10px 24px',fontSize:'11px',color:'#888',textDecoration:'none',letterSpacing:'1px',fontFamily:'monospace'}}>PROJELERİM</a>
          <a href="/dashboard/client/brief/new" style={{display:'block',padding:'10px 24px',fontSize:'11px',color:'#fff',textDecoration:'none',letterSpacing:'1px',fontFamily:'monospace'}}>YENİ BRİEF</a>
        </nav>
        <div style={{padding:'24px',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:'11px',color:'#666',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'4px'}}>KREDİ BAKİYESİ</div>
          <div style={{fontSize:'24px',fontWeight:'300',color:'#fff',letterSpacing:'-1px'}}>{clientUser?.credit_balance || 0}</div>
        </div>
      </div>

      <div style={{flex:1,padding:'48px',maxWidth:'800px'}}>
        <div style={{marginBottom:'40px'}}>
          <h1 style={{fontSize:'28px',fontWeight:'300',letterSpacing:'-1px',margin:'0 0 12px'}}>Yeni Brief</h1>
          {creditCost > 0 && (
            <div style={{display:'inline-flex',alignItems:'center',gap:'8px',padding:'6px 16px',background:'#e8f7e8',border:'1px solid rgba(29,184,29,0.25)',borderRadius:'100px',fontSize:'13px',color:'#1db81d',fontFamily:'monospace'}}>
              {creditCost} kredi harcanacak
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',padding:'32px',display:'flex',flexDirection:'column',gap:'24px'}}>
            {fields.map(field => (
              <div key={field.id}>
                <label style={{display:'block',fontSize:'11px',color:'#888',marginBottom:'8px',letterSpacing:'1px',fontFamily:'monospace',textTransform:'uppercase'}}>
                  {field.label}{field.is_required && ' *'}
                </label>

                {field.type === 'text' && (
                  <input type="text" value={form[field.field_key] || ''} onChange={e=>handleChange(field.field_key, e.target.value)} required={field.is_required}
                    style={{width:'100%',padding:'10px 14px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box'}} />
                )}

                {field.type === 'textarea' && (
                  <textarea value={form[field.field_key] || ''} onChange={e=>handleChange(field.field_key, e.target.value)} required={field.is_required} rows={3}
                    style={{width:'100%',padding:'10px 14px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box',resize:'vertical',fontFamily:'system-ui,sans-serif'}} />
                )}

                {field.type === 'pills' && field.options && (
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    {(typeof field.options === 'string' ? JSON.parse(field.options) : field.options).map((opt: string) => {
                      const isMulti = multiPillFields.includes(field.field_key)
                      const selected = isMulti ? (form[field.field_key] || []).includes(opt) : form[field.field_key] === opt
                      return (
                        <button key={opt} type="button" onClick={()=>handlePillToggle(field.field_key, opt, isMulti)}
                          style={{padding:'7px 16px',borderRadius:'100px',border:'1px solid',borderColor:selected?'rgba(29,184,29,0.4)':'#e8e7e3',background:selected?'#e8f7e8':'#fff',color:selected?'#1db81d':'#888',fontSize:'13px',cursor:'pointer'}}>
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                )}

                {field.type === 'toggle' && (
                  <div style={{display:'flex',gap:'8px'}}>
                    {['Var','Yok'].map(opt=>(
                      <button key={opt} type="button" onClick={()=>handleChange(field.field_key, opt)}
                        style={{padding:'7px 16px',borderRadius:'100px',border:'1px solid',borderColor:form[field.field_key]===opt?'rgba(29,184,29,0.4)':'#e8e7e3',background:form[field.field_key]===opt?'#e8f7e8':'#fff',color:form[field.field_key]===opt?'#1db81d':'#888',fontSize:'13px',cursor:'pointer'}}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {field.field_key === 'voiceover_type' && form['voiceover_type'] && form['voiceover_type'] !== 'Yok' && (
                  <div style={{marginTop:'12px',display:'flex',flexDirection:'column',gap:'12px'}}>
                    {form['voiceover_type'] === 'Gerçek Seslendirme (+6 kredi)' && (
                      <div>
                        <label style={{display:'block',fontSize:'11px',color:'#888',marginBottom:'8px',letterSpacing:'1px',fontFamily:'monospace',textTransform:'uppercase'}}>SESLENDİRME CİNSİYETİ</label>
                        <div style={{display:'flex',gap:'8px'}}>
                          {['Erkek','Kadın'].map(g=>(
                            <button key={g} type="button" onClick={()=>handleChange('voiceover_gender', g)}
                              style={{padding:'7px 16px',borderRadius:'100px',border:'1px solid',borderColor:form['voiceover_gender']===g?'rgba(29,184,29,0.4)':'#e8e7e3',background:form['voiceover_gender']===g?'#e8f7e8':'#fff',color:form['voiceover_gender']===g?'#1db81d':'#888',fontSize:'13px',cursor:'pointer'}}>
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <label style={{display:'block',fontSize:'11px',color:'#888',marginBottom:'8px',letterSpacing:'1px',fontFamily:'monospace',textTransform:'uppercase'}}>SESLENDİRME METNİ</label>
                      <textarea value={form['voiceover_text'] || ''} onChange={e=>handleChange('voiceover_text', e.target.value)} rows={3}
                        style={{width:'100%',padding:'10px 14px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',boxSizing:'border-box',resize:'vertical',fontFamily:'system-ui,sans-serif'}} />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {msg && <div style={{fontSize:'13px',color:'#e24b4a',padding:'12px 16px',background:'#fef2f2',borderRadius:'8px'}}>{msg}</div>}

            <button type="submit" disabled={loading}
              style={{padding:'13px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}>
              {loading ? 'Gönderiliyor...' : `Brief Gönder${creditCost > 0 ? ` — ${creditCost} Kredi` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}