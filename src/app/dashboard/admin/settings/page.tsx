'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { NEGATIVE_PROMPT, CHARACTER_TYPES, SYSTEM_PROMPT } from '@/lib/ai-express-rules'
import { UGC_NEGATIVE_PROMPT, UGC_SYSTEM_PROMPT } from '@/lib/ai-ugc-rules'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)


export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [packages, setPackages] = useState<any[]>([])
  const [pkgEdits, setPkgEdits] = useState<Record<string,{name:string,credits:string,price_tl:string}>>({})
  const [newPkg, setNewPkg] = useState({name:'',credits:'',price_tl:''})

  // User management
  const [admins, setAdmins] = useState<any[]>([])
  const [producers, setProducers] = useState<any[]>([])
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'admin' })
  const [userSaving, setUserSaving] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '' })
  const [addingRole, setAddingRole] = useState<string|null>(null)
  const [rulesModalOpen, setRulesModalOpen] = useState(false)
  const [ugcRulesModalOpen, setUgcRulesModalOpen] = useState(false)
  const [aiQualityMode, setAiQualityMode] = useState<'fast'|'quality'>('fast')
  const [qualitySaving, setQualitySaving] = useState(false)

  // Brand pronunciations
  const [pronunciations, setPronunciations] = useState<any[]>([])
  const [pronModalOpen, setPronModalOpen] = useState(false)
  const [pronEditId, setPronEditId] = useState<string|null>(null)
  const [pronForm, setPronForm] = useState({ written: '', pronounced: '' })

  useEffect(() => { loadSettings(); loadUsers(); loadPronunciations(); fetch('/api/admin/ai-quality-mode').then(r=>r.json()).then(d=>{ if(d.mode) setAiQualityMode(d.mode) }).catch(()=>{}) }, [])

  async function loadSettings() {
    const { data } = await supabase.from('admin_settings').select('*')
    const map: Record<string,string> = {}
    data?.forEach(s => map[s.key] = s.value)
    setSettings(map)
    const { data: pkgs } = await supabase.from('credit_packages').select('*').order('credits')
    setPackages(pkgs || [])
    const edits: Record<string,{name:string,credits:string,price_tl:string}> = {}
    pkgs?.forEach(p => { edits[p.id] = { name: p.name, credits: String(p.credits), price_tl: String(p.price_tl || 0) } })
    setPkgEdits(edits)
  }

  async function loadUsers() {
    const { data } = await supabase.from('users').select('*').in('role', ['admin', 'producer']).order('created_at', { ascending: false })
    setAdmins((data || []).filter(u => u.role === 'admin'))
    setProducers((data || []).filter(u => u.role === 'producer'))
  }

  async function createUser(role: string) {
    setUserSaving(true)
    const res = await fetch('/api/admin/create-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...userForm, role }) })
    const data = await res.json()
    setUserSaving(false)
    if (data.error) { setMsg(data.error); return }
    setUserForm({ name: '', email: '', password: '', role: 'admin' })
    setMsg('Kullanıcı oluşturuldu.')
    loadUsers()
    setTimeout(() => setMsg(''), 3000)
  }

  async function updateUser() {
    if (!editingUser) return
    setUserSaving(true)
    const res = await fetch('/api/admin/update-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: editingUser.id, name: editForm.name, email: editForm.email, password: editForm.password || undefined, role: editingUser.role }) })
    const data = await res.json()
    setUserSaving(false)
    if (data.error) { setMsg(data.error); return }
    setEditingUser(null)
    setMsg('Kullanıcı güncellendi.')
    loadUsers()
    setTimeout(() => setMsg(''), 3000)
  }

  async function deleteUser(user: any) {
    if (!confirm(`"${user.name}" kullanıcısını silmek istediğinizden emin misiniz?`)) return
    await fetch('/api/admin/delete-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) })
    setMsg('Kullanıcı silindi.')
    loadUsers()
    setTimeout(() => setMsg(''), 3000)
  }

  async function saveSetting(key: string, value: string) {
    setLoading(true)
    const { data: existing } = await supabase.from('admin_settings').select('id').eq('key', key).maybeSingle()
    if (existing) {
      await supabase.from('admin_settings').update({ value }).eq('key', key)
    } else {
      await supabase.from('admin_settings').insert({ key, value })
    }
    setMsg('Kaydedildi.')
    setTimeout(() => setMsg(''), 2000)
    setLoading(false)
  }

  async function savePkg(id: string) {
    const e = pkgEdits[id]
    if (!e) return
    await supabase.from('credit_packages').update({ name: e.name, credits: parseInt(e.credits), price_tl: parseFloat(e.price_tl) || 0 }).eq('id', id)
    setMsg('Paket güncellendi.')
    setTimeout(() => setMsg(''), 2000)
    loadSettings()
  }

  async function addPkg() {
    if (!newPkg.name || !newPkg.credits) return
    await supabase.from('credit_packages').insert({ name: newPkg.name, credits: parseInt(newPkg.credits), price_tl: parseFloat(newPkg.price_tl) || 0 })
    setNewPkg({ name: '', credits: '', price_tl: '' })
    setMsg('Paket eklendi.')
    setTimeout(() => setMsg(''), 2000)
    loadSettings()
  }

  async function deletePkg(id: string, name: string) {
    if (!confirm(`"${name}" paketini silmek istediğinizden emin misiniz?`)) return
    await supabase.from('credit_packages').delete().eq('id', id)
    setMsg('Paket silindi.')
    setTimeout(() => setMsg(''), 2000)
    loadSettings()
  }

  async function loadPronunciations() {
    const res = await fetch('/api/admin/pronunciations')
    const data = await res.json()
    if (Array.isArray(data)) setPronunciations(data)
  }

  async function savePronunciation() {
    if (!pronForm.written || !pronForm.pronounced) return
    if (pronEditId) {
      await fetch('/api/admin/pronunciations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pronEditId, ...pronForm }) })
      setMsg('Telaffuz güncellendi.')
    } else {
      await fetch('/api/admin/pronunciations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pronForm) })
      setMsg('Telaffuz eklendi.')
    }
    setPronModalOpen(false)
    setPronEditId(null)
    setPronForm({ written: '', pronounced: '' })
    loadPronunciations()
    setTimeout(() => setMsg(''), 2000)
  }

  async function togglePronunciation(id: string, currentActive: boolean) {
    await fetch('/api/admin/pronunciations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_active: !currentActive }) })
    loadPronunciations()
  }

  async function deletePronunciation(id: string, written: string) {
    if (!confirm(`"${written}" telaffuzunu silmek istediğinizden emin misiniz?`)) return
    await fetch('/api/admin/pronunciations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setMsg('Telaffuz silindi.')
    loadPronunciations()
    setTimeout(() => setMsg(''), 2000)
  }

  const fields = [
    { key: 'approval_delegated_to_producer', label: 'Onay yetkisi prodüktöre devredildi', type: 'toggle' },
    { key: 'creator_credit_rate', label: '1 kredinın TL karşılığı (Creator ödemesi)', type: 'number', unit: '₺' },
    { key: 'credit_bumper', label: 'Bumper kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_story', label: 'Story/Reels kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_feed', label: 'Feed Video kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_longform', label: 'Long Form kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_extra_format', label: 'Ekstra format kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_revision', label: 'Müşteri revizyon kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_voiceover_real', label: 'Profesyonel seslendirme kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_ai_express', label: 'AI Express kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'credit_ai_ugc', label: 'AI Persona kredi değeri', type: 'number', unit: 'kredi' },
    { key: 'ai_express_global_enabled', label: 'AI Express global aktif', type: 'toggle' },
    { key: 'ugc_global_enabled', label: 'Persona global aktif', type: 'toggle' },
    { key: 'prices_visible', label: 'Anasayfada fiyatları göster', type: 'toggle' },
    { key: 'works_visible', label: 'Anasayfada işleri göster', type: 'toggle' },
    { key: 'partners_visible', label: 'Anasayfada partnerleri göster', type: 'toggle' },
    { key: 'advanced_customization_price', label: 'Advanced Customization fiyatı', type: 'number', unit: 'TL' },
  ]

  return (
    <div style={{padding:'48px'}}>
        <h1 style={{fontSize:'28px',fontWeight:'300',letterSpacing:'-1px',margin:'0 0 40px',color:'#0a0a0a'}}>Ayarlar</h1>
        {msg && <div style={{marginBottom:'20px',padding:'12px 16px',background:'#e8f7e8',borderRadius:'8px',fontSize:'13px',color:'#1db81d'}}>{msg}</div>}
        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
          <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'12px',color:'rgba(255,255,255,0.4)',letterSpacing:'1px',fontFamily:'monospace'}}>SİSTEM AYARLARI</div>
          {fields.map((field, i) => (
            <div key={field.key} style={{padding:'20px 24px',borderBottom:i<fields.length-1?'1px solid #f0f0ee':'none',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'24px'}}>
              <div style={{fontSize:'14px',color:'#0a0a0a'}}>{field.label}</div>
              {field.type === 'toggle' ? (
                <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                  <span style={{fontSize:'13px',color:'rgba(255,255,255,0.4)'}}>{settings[field.key]==='true'?'Açık':'Kapalı'}</span>
                  <button onClick={()=>{const newVal=settings[field.key]==='true'?'false':'true'; setSettings({...settings,[field.key]:newVal}); saveSetting(field.key,newVal)}}
                    style={{width:'44px',height:'24px',borderRadius:'100px',border:'none',cursor:'pointer',background:settings[field.key]==='true'?'#1db81d':'#ddd',position:'relative',transition:'background 0.2s'}}>
                    <span style={{position:'absolute',top:'3px',left:settings[field.key]==='true'?'23px':'3px',width:'18px',height:'18px',borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}></span>
                  </button>
                </div>
              ) : (
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <input type="number" defaultValue={settings[field.key]} onBlur={e=>saveSetting(field.key, e.target.value)}
                    style={{width:'100px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'14px',textAlign:'right',color:'#0a0a0a'}} />
                  {field.unit && <span style={{fontSize:'13px',color:'rgba(255,255,255,0.4)'}}>{field.unit}</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* KREDİ PAKETLERİ */}
        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden',marginTop:'32px'}}>
          <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',fontSize:'12px',color:'rgba(255,255,255,0.4)',letterSpacing:'1px',fontFamily:'monospace'}}>KREDİ PAKETLERİ</div>
          {packages.map((p, i) => {
            const e = pkgEdits[p.id] || { name: p.name, credits: String(p.credits), price_tl: String(p.price_tl || 0) }
            const isKurumsal = p.name === 'Kurumsal' || e.name === 'Kurumsal'
            return (
              <div key={p.id} style={{padding:'16px 24px',borderBottom:i<packages.length-1?'1px solid #f0f0ee':'none',display:'flex',alignItems:'center',gap:'12px'}}>
                <div>
                  <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>İsim</div>
                  <input value={e.name} onChange={ev=>setPkgEdits({...pkgEdits,[p.id]:{...e,name:ev.target.value}})}
                    style={{width:'120px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a'}} />
                </div>
                <div>
                  <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>Kredi</div>
                  <input type="number" value={e.credits} onChange={ev=>setPkgEdits({...pkgEdits,[p.id]:{...e,credits:ev.target.value}})}
                    style={{width:'80px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a',textAlign:'right'}} />
                </div>
                <div>
                  <div style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>Fiyat (TL)</div>
                  {isKurumsal ? (
                    <div style={{padding:'7px 10px',fontSize:'12px',color:'rgba(255,255,255,0.4)',fontStyle:'italic'}}>İletişime Geçin</div>
                  ) : (
                    <input type="number" value={e.price_tl} onChange={ev=>setPkgEdits({...pkgEdits,[p.id]:{...e,price_tl:ev.target.value}})}
                      style={{width:'120px',padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',color:'#0a0a0a',textAlign:'right'}} />
                  )}
                </div>
                <div style={{display:'flex',gap:'6px',marginTop:'16px'}}>
                  <button onClick={()=>savePkg(p.id)} style={{padding:'7px 14px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'6px',fontSize:'11px',cursor:'pointer'}}>Kaydet</button>
                  <button onClick={()=>deletePkg(p.id,p.name)} style={{padding:'7px 14px',background:'#fff',color:'#ef4444',border:'1px solid #ef4444',borderRadius:'6px',fontSize:'11px',cursor:'pointer'}}>Sil</button>
                </div>
              </div>
            )
          })}
        </div>
        {/* MARKA TELAFFUZLARI */}
        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden',marginTop:'32px'}}>
          <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',letterSpacing:'1px',fontFamily:'monospace'}}>MARKA TELAFFUZLARI</div>
              <div style={{fontSize:'11px',color:'#888',marginTop:'4px'}}>TTS seslendirmede marka isimlerinin Türkçe okunuşunu belirler</div>
            </div>
            <button onClick={()=>{setPronEditId(null);setPronForm({written:'',pronounced:''});setPronModalOpen(true)}} className="btn" style={{padding:'7px 16px',fontSize:'11px',flexShrink:0}}>+ YENİ EKLE</button>
          </div>
          {pronunciations.length === 0 ? (
            <div style={{padding:'24px',textAlign:'center',fontSize:'13px',color:'#888'}}>Henüz telaffuz kuralı eklenmemiş</div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid #e8e7e3'}}>
                  <th style={{padding:'10px 24px',textAlign:'left',fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'#888',fontWeight:'500'}}>YAZILIŞ</th>
                  <th style={{padding:'10px 16px',textAlign:'left',fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'#888',fontWeight:'500'}}>OKUNUŞ</th>
                  <th style={{padding:'10px 16px',textAlign:'center',fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'#888',fontWeight:'500'}}>AKTİF</th>
                  <th style={{padding:'10px 24px',textAlign:'right',fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'#888',fontWeight:'500'}}>AKSİYON</th>
                </tr>
              </thead>
              <tbody>
                {pronunciations.map((p, i) => (
                  <tr key={p.id} style={{borderBottom:i<pronunciations.length-1?'1px solid #f0f0ee':'none'}}>
                    <td style={{padding:'12px 24px',fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{p.written}</td>
                    <td style={{padding:'12px 16px',fontSize:'13px',color:'#0a0a0a',fontFamily:'monospace'}}>{p.pronounced}</td>
                    <td style={{padding:'12px 16px',textAlign:'center'}}>
                      <button onClick={()=>togglePronunciation(p.id, p.is_active)}
                        style={{width:'44px',height:'24px',borderRadius:'100px',border:'none',cursor:'pointer',background:p.is_active?'#1db81d':'#ddd',position:'relative',transition:'background 0.2s'}}>
                        <span style={{position:'absolute',top:'3px',left:p.is_active?'23px':'3px',width:'18px',height:'18px',borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}></span>
                      </button>
                    </td>
                    <td style={{padding:'12px 24px',textAlign:'right'}}>
                      <div style={{display:'flex',gap:'6px',justifyContent:'flex-end'}}>
                        <button onClick={()=>{setPronEditId(p.id);setPronForm({written:p.written,pronounced:p.pronounced});setPronModalOpen(true)}} style={{padding:'4px 10px',background:'#fff',color:'#555',border:'1px solid #e8e7e3',borderRadius:'6px',fontSize:'10px',cursor:'pointer'}}>Düzenle</button>
                        <button onClick={()=>deletePronunciation(p.id, p.written)} style={{padding:'4px 10px',background:'#fff',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'6px',fontSize:'10px',cursor:'pointer'}}>Sil</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pronunciation Modal */}
        {pronModalOpen && (
          <div onClick={()=>setPronModalOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div onClick={e=>e.stopPropagation()} style={{background:'#fff',border:'1px solid #0a0a0a',width:'100%',maxWidth:'400px'}}>
              <div style={{padding:'16px 24px',borderBottom:'1px solid #e5e4db',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{fontSize:'14px',fontWeight:'500',letterSpacing:'1.5px',textTransform:'uppercase',color:'#0a0a0a'}}>{pronEditId ? 'TELAFFUZ DÜZENLE' : 'YENİ TELAFFUZ'}</div>
                <button onClick={()=>setPronModalOpen(false)} style={{width:'28px',height:'28px',border:'1px solid #e5e4db',background:'#fff',color:'#0a0a0a',fontSize:'14px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
              </div>
              <div style={{padding:'24px'}}>
                <div style={{marginBottom:'16px'}}>
                  <div style={{fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'#888',marginBottom:'4px',fontWeight:'500'}}>YAZILIŞ</div>
                  <input value={pronForm.written} onChange={e=>setPronForm({...pronForm,written:e.target.value})} placeholder="Örn: Turkcell" style={{width:'100%',padding:'8px 10px',fontSize:'13px',border:'1px solid #e5e4db',boxSizing:'border-box'}} />
                </div>
                <div style={{marginBottom:'24px'}}>
                  <div style={{fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'#888',marginBottom:'4px',fontWeight:'500'}}>OKUNUŞ (TTS)</div>
                  <input value={pronForm.pronounced} onChange={e=>setPronForm({...pronForm,pronounced:e.target.value})} placeholder="Örn: Türksel" style={{width:'100%',padding:'8px 10px',fontSize:'13px',border:'1px solid #e5e4db',boxSizing:'border-box'}} />
                </div>
                <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
                  <button onClick={()=>setPronModalOpen(false)} className="btn btn-outline" style={{padding:'8px 16px',fontSize:'11px'}}>İPTAL</button>
                  <button onClick={savePronunciation} disabled={!pronForm.written||!pronForm.pronounced} className="btn" style={{padding:'8px 16px',fontSize:'11px'}}>{pronEditId ? 'GÜNCELLE' : 'KAYDET'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN KULLANICILARI */}
        {(['admin', 'producer'] as const).map(role => {
          const list = role === 'admin' ? admins : producers
          const label = role === 'admin' ? 'ADMİN KULLANICILARI' : 'PRODÜKTÖR KULLANICILARI'
          return (
            <div key={role} style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden',marginTop:'32px'}}>
              <div style={{padding:'16px 24px',borderBottom:'1px solid #e8e7e3',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',letterSpacing:'1px',fontFamily:'monospace'}}>{label}</div>
                <div style={{fontSize:'11px',color:'#888'}}>{list.length} kişi</div>
              </div>
              {list.map(u => (
                <div key={u.id} style={{padding:'12px 24px',borderBottom:'1px solid #f0f0ee',display:'flex',alignItems:'center',gap:'12px'}}>
                  {editingUser?.id === u.id ? (
                    <>
                      <input value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})} placeholder="Ad" style={{flex:1,padding:'6px 10px',border:'1px solid #e8e7e3',borderRadius:'6px',fontSize:'13px'}} />
                      <input value={editForm.email} onChange={e=>setEditForm({...editForm,email:e.target.value})} placeholder="Email" style={{flex:1,padding:'6px 10px',border:'1px solid #e8e7e3',borderRadius:'6px',fontSize:'13px'}} />
                      <input value={editForm.password} onChange={e=>setEditForm({...editForm,password:e.target.value})} placeholder="Yeni şifre (boş = değişmez)" style={{flex:1,padding:'6px 10px',border:'1px solid #e8e7e3',borderRadius:'6px',fontSize:'13px'}} />
                      <button onClick={updateUser} disabled={userSaving} style={{padding:'5px 12px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'6px',fontSize:'11px',cursor:'pointer'}}>Kaydet</button>
                      <button onClick={()=>setEditingUser(null)} style={{padding:'5px 12px',background:'#fff',color:'#888',border:'1px solid #e8e7e3',borderRadius:'6px',fontSize:'11px',cursor:'pointer'}}>İptal</button>
                    </>
                  ) : (
                    <>
                      <div style={{flex:1}}>
                        <div style={{fontSize:'13px',fontWeight:'500',color:'#0a0a0a'}}>{u.name || '—'}</div>
                        <div style={{fontSize:'11px',color:'#888'}}>{u.email}</div>
                      </div>
                      <button onClick={()=>{setEditingUser(u);setEditForm({name:u.name||'',email:u.email||'',password:''})}} style={{padding:'4px 10px',background:'#fff',color:'#555',border:'1px solid #e8e7e3',borderRadius:'6px',fontSize:'10px',cursor:'pointer'}}>Düzenle</button>
                      <button onClick={()=>deleteUser(u)} style={{padding:'4px 10px',background:'#fff',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'6px',fontSize:'10px',cursor:'pointer'}}>Sil</button>
                    </>
                  )}
                </div>
              ))}
              <div style={{padding:'12px 24px',borderTop:'1px solid #e8e7e3'}}>
                {addingRole === role ? (
                  <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                    <input value={role === userForm.role ? userForm.name : ''} onChange={e=>setUserForm({...userForm,name:e.target.value,role})} placeholder="Ad Soyad" style={{flex:1,minWidth:'120px',padding:'7px 10px',border:'1px solid #0a0a0a',fontSize:'13px'}} />
                    <input value={role === userForm.role ? userForm.email : ''} onChange={e=>setUserForm({...userForm,email:e.target.value,role})} placeholder="Email" style={{flex:1,minWidth:'140px',padding:'7px 10px',border:'1px solid #0a0a0a',fontSize:'13px'}} />
                    <input value={role === userForm.role ? userForm.password : ''} onChange={e=>setUserForm({...userForm,password:e.target.value,role})} placeholder="Şifre (boş = dinamo2026)" style={{width:'160px',padding:'7px 10px',border:'1px solid #0a0a0a',fontSize:'13px'}} />
                    <button onClick={async () => { await createUser(role); setAddingRole(null) }} disabled={userSaving||!(role===userForm.role&&userForm.email)} className="btn" style={{padding:'7px 16px',whiteSpace:'nowrap'}}>OLUŞTUR</button>
                    <button onClick={()=>setAddingRole(null)} className="btn btn-outline" style={{padding:'7px 12px'}}>İPTAL</button>
                  </div>
                ) : (
                  <button onClick={()=>{setAddingRole(role);setUserForm({name:'',email:'',password:'',role})}} className="btn" style={{padding:'8px 20px',width:'100%'}}>
                    + YENİ {role === 'admin' ? 'ADMİN' : 'PRODÜKTÖR'} EKLE
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* AI KALİTE MODU */}
        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden',marginTop:'32px'}}>
          <div style={{padding:'20px 24px'}}>
            <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'12px'}}>AI KALİTE MODU</div>
            <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
              {(['fast','quality'] as const).map(mode=>(
                <button key={mode} onClick={async()=>{
                  setQualitySaving(true)
                  await fetch('/api/admin/ai-quality-mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode})})
                  setAiQualityMode(mode)
                  setQualitySaving(false)
                  setMsg(`AI kalite modu güncellendi: ${mode==='fast'?'Hız':'Kalite'}`)
                  setTimeout(()=>setMsg(''),3000)
                }} disabled={qualitySaving}
                  style={{flex:1,padding:'12px 16px',border:aiQualityMode===mode?'2px solid #0a0a0a':'1px solid #e8e7e3',background:aiQualityMode===mode?'#0a0a0a':'#fff',color:aiQualityMode===mode?'#fff':'#555',fontSize:'13px',fontWeight:'600',cursor:'pointer',borderRadius:'8px',transition:'all 0.15s'}}>
                  {mode==='fast'?'HIZ':'KALİTE'}
                </button>
              ))}
            </div>
            <div style={{fontSize:'12px',color:'#888',lineHeight:1.6}}>
              {aiQualityMode==='fast'
                ? 'Tüm AI üretimleri Claude Haiku ile yapılır. Hızlı (~2sn) ve düşük maliyet.'
                : 'UGC script + prompt mühendisliği Sonnet 4.6, Creative Studio fikir/senaryo Opus 4.6 ile yapılır. Daha yavaş (~5-10sn), belirgin kalite artışı.'}
            </div>
            <div style={{fontSize:'10px',color:'#f59e0b',marginTop:'8px'}}>Bu ayar tüm müşterilerin tüm AI üretimlerini etkiler. Anında geçerlidir.</div>
          </div>
        </div>

        {/* AI EXPRESS GLOBAL KURALLAR */}
        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden',marginTop:'32px'}}>
          <div style={{padding:'20px 24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',letterSpacing:'1px',fontFamily:'monospace',marginBottom:'6px'}}>AI EXPRESS GLOBAL KURALLAR</div>
              <div style={{fontSize:'13px',color:'#888'}}>Sistem tüm AI Express üretimlerinde bu kuralları kullanır. Değişiklik için kod tarafına müdahale gerekir.</div>
            </div>
            <button onClick={()=>setRulesModalOpen(true)} className="btn btn-outline" style={{padding:'8px 16px',fontSize:'11px',flexShrink:0}}>GÖRÜNTÜLE →</button>
          </div>
        </div>

        {/* AI EXPRESS RULES MODAL */}
        {/* AI Persona GLOBAL KURALLAR (BETA) */}
        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden',marginTop:'16px'}}>
          <div style={{padding:'20px 24px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',letterSpacing:'1px',fontFamily:'monospace'}}>AI Persona GLOBAL KURALLAR</div>
                <span style={{fontSize:'9px',letterSpacing:'1px',padding:'2px 6px',background:'rgba(245,158,11,0.1)',border:'1px solid #f59e0b',color:'#92400e'}}>BETA</span>
              </div>
              <div style={{fontSize:'13px',color:'#888'}}>Persona video üretimi kuralları. Çıktılara göre revize edilecek.</div>
            </div>
            <button onClick={()=>setUgcRulesModalOpen(true)} className="btn btn-outline" style={{padding:'8px 16px',fontSize:'11px',flexShrink:0}}>GÖRÜNTÜLE →</button>
          </div>
        </div>

        {/* UGC Rules Modal */}
        {ugcRulesModalOpen && (
          <div onClick={()=>setUgcRulesModalOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div onClick={e=>e.stopPropagation()} style={{background:'#fff',border:'1px solid #0a0a0a',width:'100%',maxWidth:'800px',maxHeight:'90vh',display:'flex',flexDirection:'column'}}>
              <div style={{padding:'16px 24px',borderBottom:'1px solid #e5e4db',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{fontSize:'14px',fontWeight:'500',letterSpacing:'1.5px',textTransform:'uppercase',color:'#0a0a0a'}}>AI Persona GLOBAL KURALLAR</div>
                  <span style={{fontSize:'9px',letterSpacing:'1px',padding:'2px 6px',background:'rgba(245,158,11,0.1)',border:'1px solid #f59e0b',color:'#92400e'}}>BETA</span>
                </div>
                <button onClick={()=>setUgcRulesModalOpen(false)} style={{width:'28px',height:'28px',border:'1px solid #e5e4db',background:'#fff',color:'#0a0a0a',fontSize:'14px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
              </div>
              <div style={{padding:'28px',overflowY:'auto',flex:1}}>
                <div style={{padding:'12px 16px',background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.2)',marginBottom:'24px',fontSize:'12px',color:'#92400e'}}>
                  Beta sürümünde, çıktılara göre revize edilecek.
                </div>
                <div style={{marginBottom:'24px'}}>
                  <div style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--color-text-tertiary)',marginBottom:'4px',fontWeight:'500'}}>NEGATIVE PROMPT (VEO)</div>
                  <div style={{fontSize:'11px',color:'#888',marginBottom:'8px'}}>Veo modeline gönderilen yasak içerik listesi</div>
                  <pre style={{background:'#f5f4f0',padding:'14px',fontSize:'12px',color:'#0a0a0a',overflow:'auto',whiteSpace:'pre-wrap',wordBreak:'break-word',lineHeight:1.6,margin:0,border:'1px solid #e5e4db'}}>{UGC_NEGATIVE_PROMPT}</pre>
                </div>
                <div>
                  <div style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--color-text-tertiary)',marginBottom:'4px',fontWeight:'500'}}>PERSONA SYSTEM PROMPT (CLAUDE)</div>
                  <div style={{fontSize:'11px',color:'#888',marginBottom:'8px'}}>Script ve Veo prompt üretimi için Claude talimatı</div>
                  <pre style={{background:'#f5f4f0',padding:'14px',fontSize:'11px',color:'#0a0a0a',overflow:'auto',whiteSpace:'pre-wrap',wordBreak:'break-word',lineHeight:1.7,margin:0,border:'1px solid #e5e4db',maxHeight:'400px'}}>{UGC_SYSTEM_PROMPT}</pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {rulesModalOpen && (
          <div onClick={()=>setRulesModalOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div onClick={e=>e.stopPropagation()} style={{background:'#fff',border:'1px solid #0a0a0a',width:'100%',maxWidth:'800px',maxHeight:'90vh',display:'flex',flexDirection:'column'}}>
              <div style={{padding:'16px 24px',borderBottom:'1px solid #e5e4db',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
                <div style={{fontSize:'14px',fontWeight:'500',letterSpacing:'1.5px',textTransform:'uppercase',color:'#0a0a0a'}}>AI EXPRESS GLOBAL KURALLAR</div>
                <button onClick={()=>setRulesModalOpen(false)} style={{width:'28px',height:'28px',border:'1px solid #e5e4db',background:'#fff',color:'#0a0a0a',fontSize:'14px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
              </div>
              <div style={{padding:'28px',overflowY:'auto',flex:1}}>
                <div style={{padding:'12px 16px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',marginBottom:'24px',fontSize:'12px',color:'#ef4444'}}>
                  Düzenleme için kod tarafına müdahale gerekir, geliştirici desteği alın.
                </div>

                {/* NEGATIVE PROMPT */}
                <div style={{marginBottom:'24px'}}>
                  <div style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--color-text-tertiary)',marginBottom:'4px',fontWeight:'500'}}>NEGATIVE PROMPT (KLING API)</div>
                  <div style={{fontSize:'11px',color:'#888',marginBottom:'8px'}}>Modele gönderilen yasak içerik listesi</div>
                  <pre style={{background:'#f5f4f0',padding:'14px',fontSize:'12px',color:'#0a0a0a',overflow:'auto',whiteSpace:'pre-wrap',wordBreak:'break-word',lineHeight:1.6,margin:0,border:'1px solid #e5e4db'}}>{NEGATIVE_PROMPT}</pre>
                </div>

                {/* KARAKTER TİPLERİ */}
                <div style={{marginBottom:'24px'}}>
                  <div style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--color-text-tertiary)',marginBottom:'4px',fontWeight:'500'}}>KARAKTER TİPLERİ</div>
                  <div style={{fontSize:'11px',color:'#888',marginBottom:'12px'}}>Videoda gösterilen karakter varyasyonları, rastgele seçilir</div>
                  {(['female','male'] as const).map(g=>(
                    <div key={g} style={{marginBottom:'12px'}}>
                      <div style={{fontSize:'10px',letterSpacing:'1px',textTransform:'uppercase',color:'#0a0a0a',fontWeight:'500',marginBottom:'6px'}}>{g==='female'?'KADIN':'ERKEK'}</div>
                      {CHARACTER_TYPES[g].map((c,i)=>(
                        <div key={i} style={{padding:'6px 10px',background:'#f5f4f0',border:'1px solid #e5e4db',marginBottom:'4px',fontSize:'12px',color:'#0a0a0a',fontFamily:'monospace'}}>{c}</div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* SYSTEM PROMPT */}
                <div>
                  <div style={{fontSize:'9px',letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--color-text-tertiary)',marginBottom:'4px',fontWeight:'500'}}>CLAUDE SYSTEM PROMPT</div>
                  <div style={{fontSize:'11px',color:'#888',marginBottom:'8px'}}>AI Express için Claude'a gönderilen ana talimat metni</div>
                  <pre style={{background:'#f5f4f0',padding:'14px',fontSize:'11px',color:'#0a0a0a',overflow:'auto',whiteSpace:'pre-wrap',wordBreak:'break-word',lineHeight:1.7,margin:0,border:'1px solid #e5e4db',maxHeight:'400px'}}>{SYSTEM_PROMPT}</pre>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
