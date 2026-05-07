'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const EXAMPLE_VARIATIONS = JSON.stringify({
  hair: ["uzun düz sarı saçlı", "kısa bob kesim siyah saçlı", "dalgalı kahverengi saçlı"],
  skin: ["açık tenli", "buğday tenli", "esmer tenli"],
  outfit: ["casual tişört", "blazer ve gömlek", "spor sweatshirt"],
  environment: ["modern ev ofisi, doğal ışık", "kafe köşesi, sıcak ışık"],
  beard: null
}, null, 2)

function slugify(s: string) {
  const m: Record<string,string> = {'ğ':'g','ü':'u','ş':'s','ı':'i','ö':'o','ç':'c','Ğ':'G','Ü':'U','Ş':'S','İ':'I','Ö':'O','Ç':'C'}
  let r = s; for (const [k,v] of Object.entries(m)) r = r.replace(new RegExp(k,'g'),v)
  return r.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')
}

interface Persona {
  id: number; name: string; slug: string; gender: string; age_range: string; description: string;
  tone_description: string; environment_prompt: string; thumbnail_url: string | null;
  product_compatibility: string[]; appearance_base: string; appearance_variations: any;
  is_active: boolean; is_global: boolean; display_order: number; created_at: string;
}

const emptyForm = {
  name: '', slug: '', gender: 'female', age_range: '', description: '', tone_description: '',
  environment_prompt: '', thumbnail_url: '', product_compatibility: '', appearance_base: '',
  appearance_variations: '', is_active: true, is_global: true, display_order: 0,
}

export default function AdminPersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [filterGender, setFilterGender] = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [filterGlobal, setFilterGlobal] = useState('')
  const [search, setSearch] = useState('')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Delete
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [msg, setMsg] = useState('')

  async function loadPersonas() {
    const params = new URLSearchParams()
    if (filterGender) params.set('gender', filterGender)
    if (filterActive) params.set('is_active', filterActive)
    if (filterGlobal) params.set('is_global', filterGlobal)
    if (search) params.set('search', search)
    const res = await fetch(`/api/admin/personas?${params}`)
    const data = await res.json()
    setPersonas(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { loadPersonas() }, [filterGender, filterActive, filterGlobal, search])

  function openAdd() {
    setEditId(null)
    setForm({ ...emptyForm, display_order: personas.length + 1 })
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(p: Persona) {
    setEditId(p.id)
    setForm({
      name: p.name, slug: p.slug, gender: p.gender, age_range: p.age_range,
      description: p.description || '', tone_description: p.tone_description || '',
      environment_prompt: p.environment_prompt || '', thumbnail_url: p.thumbnail_url || '',
      product_compatibility: (p.product_compatibility || []).join(', '),
      appearance_base: p.appearance_base || '',
      appearance_variations: p.appearance_variations ? JSON.stringify(p.appearance_variations, null, 2) : '',
      is_active: p.is_active, is_global: p.is_global, display_order: p.display_order,
    })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.slug || !form.gender || !form.age_range) { setFormError('İsim, slug, cinsiyet ve yaş aralığı zorunlu'); return }
    if (form.appearance_variations) {
      try { JSON.parse(form.appearance_variations) } catch { setFormError('Geçersiz JSON formatı (Görünüm Varyasyonları)'); return }
    }
    setSaving(true); setFormError('')
    const body = {
      ...form,
      product_compatibility: form.product_compatibility,
      appearance_variations: form.appearance_variations || '{}',
      thumbnail_url: form.thumbnail_url || null,
    }
    const url = editId ? `/api/admin/personas/${editId}` : '/api/admin/personas'
    const method = editId ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { setFormError(data.error || 'Hata'); setSaving(false); return }
    setSaving(false); setModalOpen(false); setMsg(editId ? 'Persona güncellendi' : 'Persona eklendi'); setTimeout(() => setMsg(''), 2000); loadPersonas()
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const res = await fetch(`/api/admin/personas/${deleteId}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); setMsg(d.error || 'Silinemedi'); setDeleting(false); setDeleteId(null); return }
    setDeleting(false); setDeleteId(null); setMsg('Persona silindi'); setTimeout(() => setMsg(''), 2000); loadPersonas()
  }

  async function handleThumbnailUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/admin/personas/upload-thumbnail', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.url) setForm(f => ({ ...f, thumbnail_url: data.url }))
    else setFormError(data.error || 'Yükleme hatası')
    setUploading(false)
  }

  async function toggleActive(p: Persona) {
    await fetch(`/api/admin/personas/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !p.is_active }) })
    loadPersonas()
  }

  const activeCount = personas.filter(p => p.is_active).length
  const globalCount = personas.filter(p => p.is_global).length
  const exclusiveCount = personas.filter(p => !p.is_global).length

  const inputStyle = { width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #e5e4db', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: '#888', marginBottom: '4px', fontWeight: '500' as const }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '500' }}>PERSONA YÖNETİMİ</div>
        <button onClick={openAdd} style={{ padding: '8px 20px', background: '#0a0a0a', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '600', letterSpacing: '1px', cursor: 'pointer' }}>+ PERSONA EKLE</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', fontSize: '12px', color: '#888' }}>
        <span>{personas.length} persona</span>
        <span>{activeCount} aktif</span>
        <span>{globalCount} global</span>
        <span>{exclusiveCount} müşteri-özel</span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select value={filterGender} onChange={e => setFilterGender(e.target.value)} style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #e5e4db' }}>
          <option value="">Tüm Cinsiyetler</option>
          <option value="female">Kadın</option>
          <option value="male">Erkek</option>
        </select>
        <select value={filterActive} onChange={e => setFilterActive(e.target.value)} style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #e5e4db' }}>
          <option value="">Aktif/Pasif</option>
          <option value="true">Aktif</option>
          <option value="false">Pasif</option>
        </select>
        <select value={filterGlobal} onChange={e => setFilterGlobal(e.target.value)} style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #e5e4db' }}>
          <option value="">Global/Exclusive</option>
          <option value="true">Global</option>
          <option value="false">Exclusive</option>
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..." style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #e5e4db', flex: 1, minWidth: '120px' }} />
      </div>

      {msg && <div style={{ padding: '8px 14px', background: '#f0fdf4', border: '1px solid #22c55e', fontSize: '12px', color: '#0a0a0a', marginBottom: '16px' }}>{msg}</div>}

      {/* Grid */}
      {loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Yükleniyor...</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {personas.map(p => (
            <div key={p.id} style={{ border: '1px solid #e5e4db', background: '#fff', opacity: p.is_active ? 1 : 0.5 }}>
              {/* Thumbnail */}
              <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: '#f5f4f0', overflow: 'hidden' }}>
                {p.thumbnail_url ? <img src={p.thumbnail_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', color: '#ccc' }}>{p.name[0]}</div>}
                {/* Badges */}
                <span style={{ position: 'absolute', top: 0, left: 0, fontSize: '9px', letterSpacing: '1px', padding: '4px 8px', color: '#fff', fontWeight: '600', background: p.is_global ? '#22c55e' : '#a855f7' }}>{p.is_global ? 'GLOBAL' : 'EXCLUSIVE'}</span>
                {/* Active toggle */}
                <button onClick={() => toggleActive(p)} style={{ position: 'absolute', top: '6px', right: '6px', width: '36px', height: '20px', border: 'none', cursor: 'pointer', background: p.is_active ? '#22c55e' : '#ddd', transition: 'background 0.2s' }}>
                  <span className="dot" style={{ position: 'absolute', top: '2px', left: p.is_active ? '18px' : '2px', width: '16px', height: '16px', background: '#fff', transition: 'left 0.2s' }} />
                </button>
              </div>
              {/* Info */}
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '2px' }}>{p.name}</div>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>{p.gender === 'female' ? 'Kadın' : 'Erkek'} · {p.age_range} · {p.slug}</div>
                <div style={{ fontSize: '12px', color: '#6b6b66', lineHeight: 1.4, marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{p.description}</div>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  {(p.appearance_variations?.hair?.length || 0) > 0 && <span style={{ fontSize: '9px', padding: '2px 6px', background: '#f5f4f0', color: '#888' }}>hair:{p.appearance_variations.hair.length}</span>}
                  {(p.appearance_variations?.outfit?.length || 0) > 0 && <span style={{ fontSize: '9px', padding: '2px 6px', background: '#f5f4f0', color: '#888' }}>outfit:{p.appearance_variations.outfit.length}</span>}
                  {(p.appearance_variations?.skin?.length || 0) > 0 && <span style={{ fontSize: '9px', padding: '2px 6px', background: '#f5f4f0', color: '#888' }}>skin:{p.appearance_variations.skin.length}</span>}
                  {(p.appearance_variations?.environment?.length || 0) > 0 && <span style={{ fontSize: '9px', padding: '2px 6px', background: '#f5f4f0', color: '#888' }}>env:{p.appearance_variations.environment.length}</span>}
                </div>
                <div style={{ display: 'flex', gap: '6px', fontSize: '11px' }}>
                  <span style={{ fontSize: '10px', color: '#888' }}>#{p.display_order}</span>
                  <span style={{ flex: 1 }} />
                  <button onClick={() => openEdit(p)} style={{ background: 'none', border: 'none', color: '#0a0a0a', cursor: 'pointer', textDecoration: 'underline', fontSize: '11px' }}>Düzenle</button>
                  <button onClick={() => setDeleteId(p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', textDecoration: 'underline', fontSize: '11px' }}>Sil</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '40px 20px' }} onClick={() => setModalOpen(false)}>
          <div style={{ background: '#fff', border: '1px solid #0a0a0a', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e5e4db', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <div style={{ fontSize: '12px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500' }}>{editId ? 'PERSONA DÜZENLE' : 'PERSONA EKLE'}</div>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#888' }}>×</button>
            </div>
            {/* Body */}
            <div style={{ padding: '24px' }}>
              {formError && <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid #ef4444', fontSize: '12px', color: '#ef4444', marginBottom: '16px' }}>{formError}</div>}

              {/* 2 column grid: form left, thumbnail right */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                {/* Left */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div><div style={labelStyle}>İSİM *</div><input value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value, slug: editId ? f.slug : slugify(e.target.value) })) }} style={inputStyle} /></div>
                  <div><div style={labelStyle}>SLUG *</div><input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} style={inputStyle} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div><div style={labelStyle}>CİNSİYET *</div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                        <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><input type="radio" checked={form.gender === 'female'} onChange={() => setForm(f => ({ ...f, gender: 'female' }))} /> Kadın</label>
                        <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><input type="radio" checked={form.gender === 'male'} onChange={() => setForm(f => ({ ...f, gender: 'male' }))} /> Erkek</label>
                      </div>
                    </div>
                    <div><div style={labelStyle}>YAŞ ARALIĞI *</div><input value={form.age_range} onChange={e => setForm(f => ({ ...f, age_range: e.target.value }))} placeholder="25-35" style={inputStyle} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={labelStyle}>AKTİF</div>
                      <button onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))} style={{ width: '36px', height: '20px', border: 'none', cursor: 'pointer', background: form.is_active ? '#22c55e' : '#ddd', position: 'relative' }}>
                        <span className="dot" style={{ position: 'absolute', top: '2px', left: form.is_active ? '18px' : '2px', width: '16px', height: '16px', background: '#fff', transition: 'left 0.2s' }} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={labelStyle}>GLOBAL</div>
                      <button onClick={() => setForm(f => ({ ...f, is_global: !f.is_global }))} style={{ width: '36px', height: '20px', border: 'none', cursor: 'pointer', background: form.is_global ? '#22c55e' : '#ddd', position: 'relative' }}>
                        <span className="dot" style={{ position: 'absolute', top: '2px', left: form.is_global ? '18px' : '2px', width: '16px', height: '16px', background: '#fff', transition: 'left 0.2s' }} />
                      </button>
                    </div>
                  </div>
                  <div><div style={labelStyle}>SIRALAMA</div><input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: Number(e.target.value) }))} style={{ ...inputStyle, width: '80px' }} /></div>
                </div>
                {/* Right: Thumbnail */}
                <div>
                  <div style={labelStyle}>THUMBNAIL</div>
                  <div style={{ width: '100%', aspectRatio: '1', background: '#f5f4f0', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative' }} onClick={() => fileRef.current?.click()}>
                    {form.thumbnail_url ? <img src={form.thumbnail_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '13px', color: '#888' }}>{uploading ? 'Yükleniyor...' : 'Tıkla veya sürükle'}</span>}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleThumbnailUpload} />
                  {form.thumbnail_url && <button onClick={() => setForm(f => ({ ...f, thumbnail_url: '' }))} style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}>Görseli kaldır</button>}
                </div>
              </div>

              {/* Textareas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div><div style={labelStyle}>AÇIKLAMA</div><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                <div><div style={labelStyle}>APPEARANCE BASE</div><textarea value={form.appearance_base} onChange={e => setForm(f => ({ ...f, appearance_base: e.target.value }))} rows={2} placeholder="20'lerinin başında üniversiteli kadın" style={{ ...inputStyle, resize: 'vertical' }} /></div>
                <div><div style={labelStyle}>TON AÇIKLAMASI</div><textarea value={form.tone_description} onChange={e => setForm(f => ({ ...f, tone_description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                <div><div style={labelStyle}>ORTAM PROMPT</div><textarea value={form.environment_prompt} onChange={e => setForm(f => ({ ...f, environment_prompt: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                <div><div style={labelStyle}>ÜRÜN UYUMLULUĞU</div><input value={form.product_compatibility} onChange={e => setForm(f => ({ ...f, product_compatibility: e.target.value }))} placeholder="beauty, fashion, food, tech, lifestyle" style={inputStyle} /><div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>Virgülle ayrılmış</div></div>

                {/* JSON */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={labelStyle}>GÖRÜNÜM VARYASYONLARI (JSON)</div>
                    <button onClick={() => setForm(f => ({ ...f, appearance_variations: EXAMPLE_VARIATIONS }))} style={{ fontSize: '10px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>ÖRNEK ŞABLONU GÖSTER</button>
                  </div>
                  <textarea value={form.appearance_variations} onChange={e => setForm(f => ({ ...f, appearance_variations: e.target.value }))} rows={12} style={{ ...inputStyle, fontFamily: 'Menlo, Monaco, monospace', fontSize: '12px', resize: 'vertical' }} />
                  <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>hair (zorunlu) | skin (zorunlu) | outfit (zorunlu) | environment (opsiyonel) | beard (sadece male)</div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid #e5e4db', paddingTop: '16px' }}>
                <button onClick={() => setModalOpen(false)} style={{ padding: '8px 20px', border: '1px solid #0a0a0a', background: '#fff', fontSize: '11px', fontWeight: '600', letterSpacing: '1px', cursor: 'pointer' }}>İPTAL</button>
                <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', background: saving ? '#ccc' : '#0a0a0a', color: '#fff', border: 'none', fontSize: '11px', fontWeight: '600', letterSpacing: '1px', cursor: saving ? 'default' : 'pointer' }}>{saving ? 'KAYDEDİLİYOR...' : 'KAYDET'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDeleteId(null)}>
          <div style={{ background: '#fff', padding: '28px', maxWidth: '400px', width: '90%', border: '1px solid #0a0a0a' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Persona Sil</div>
            <div style={{ fontSize: '13px', color: '#555', marginBottom: '20px' }}>Bu personayı silmek istediğine emin misin? İlişkili müşteri atamaları da silinir.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: '8px 16px', border: '1px solid #e5e4db', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>İPTAL</button>
              <button onClick={handleDelete} disabled={deleting} style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', fontSize: '12px', cursor: 'pointer' }}>{deleting ? 'SİLİNİYOR...' : 'SİL'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
