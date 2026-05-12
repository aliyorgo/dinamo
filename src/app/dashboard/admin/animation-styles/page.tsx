'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const EMPTY_FORM = { label: '', slug: '', prompt_template: '', mood_hints: '', model: 'seedance', task_type: 'seedance-2-fast-preview', sort_order: 0, requires_mascot_image: false, active: true }

export default function AnimationStylesPage() {
  const [styles, setStyles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>({ ...EMPTY_FORM })
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const res = await fetch('/api/admin/animation-styles')
    const data = await res.json()
    setStyles(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  function openNew() {
    setEditId(null); setForm({ ...EMPTY_FORM, sort_order: styles.length + 1 }); setModalOpen(true)
  }

  function openEdit(style: any) {
    setEditId(style.id)
    setForm({ label: style.label, slug: style.slug, prompt_template: style.prompt_template || '', mood_hints: (style.mood_hints || []).join(', '), model: style.model || 'seedance', task_type: style.task_type || 'seedance-2-fast-preview', sort_order: style.sort_order || 0, requires_mascot_image: style.requires_mascot_image || false, active: style.active !== false })
    setModalOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    if (editId) {
      await fetch(`/api/admin/animation-styles/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    } else {
      await fetch('/api/admin/animation-styles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    }
    setModalOpen(false); setSaving(false); loadData()
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`"${label}" stilini silmek istediğinizden emin misiniz?`)) return
    await fetch(`/api/admin/animation-styles/${id}`, { method: 'DELETE' })
    loadData()
  }

  async function toggleActive(id: string, current: boolean) {
    await fetch(`/api/admin/animation-styles/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !current }) })
    setStyles(prev => prev.map(s => s.id === id ? { ...s, active: !current } : s))
  }

  if (loading) return <div style={{ padding: '48px', color: '#888', fontSize: '14px' }}>Yükleniyor...</div>

  return (
    <div style={{ padding: '48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '300', letterSpacing: '-1px', margin: 0 }}>AI Animation Stilleri</h1>
        <button onClick={openNew} className="btn" style={{ padding: '8px 20px' }}>+ YENİ STİL</button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e7e3', overflow: 'hidden' }}>
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #e8e7e3', fontSize: '12px', color: '#888', letterSpacing: '1px', fontFamily: 'monospace' }}>STİLLER · {styles.length}</div>
        {styles.map((style, i) => (
          <div key={style.id} style={{ padding: '14px 24px', borderBottom: i < styles.length - 1 ? '1px solid #f0f0ee' : 'none', display: 'flex', alignItems: 'center', gap: '16px' }}>
            {style.icon_path ? <img src={style.icon_path} alt={style.label} style={{ width: '40px', height: '40px', objectFit: 'contain', flexShrink: 0 }} /> : <div style={{ width: '40px', height: '40px', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '16px', color: '#ccc' }}>{style.label?.[0] || '?'}</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{style.label}</span>
                {style.requires_mascot_image && <span style={{ fontSize: '8px', padding: '1px 5px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', letterSpacing: '0.5px' }}>MASKOT</span>}
              </div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{style.slug} · {style.model}</div>
            </div>
            <button onClick={() => openEdit(style)} style={{ padding: '4px 10px', background: '#fff', color: '#555', border: '1px solid #e8e7e3', fontSize: '10px', cursor: 'pointer' }}>Düzenle</button>
            <button onClick={() => handleDelete(style.id, style.label)} style={{ padding: '4px 10px', background: '#fff', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontSize: '10px', cursor: 'pointer' }}>Sil</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: style.active ? '#22c55e' : '#888' }}>{style.active ? 'Aktif' : 'Pasif'}</span>
              <button onClick={() => toggleActive(style.id, style.active)} style={{ width: '44px', height: '24px', borderRadius: '100px', border: 'none', cursor: 'pointer', background: style.active ? '#22c55e' : '#ddd', position: 'relative', transition: 'background 0.2s' }}>
                <span style={{ position: 'absolute', top: '3px', left: style.active ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* EDIT/NEW MODAL */}
      {modalOpen && (
        <div onClick={() => setModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', padding: '28px', maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '20px' }}>{editId ? 'Stil Düzenle' : 'Yeni Stil'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>SLUG {editId && '(değiştirilemez)'}</div>
                <input value={form.slug} onChange={e => !editId && setForm({ ...form, slug: e.target.value })} readOnly={!!editId} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e4db', fontSize: '12px', background: editId ? '#f5f4f0' : '#fff', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>LABEL</div>
                <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e4db', fontSize: '12px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>MODEL</div>
                <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e4db', fontSize: '12px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>TASK TYPE</div>
                <input value={form.task_type} onChange={e => setForm({ ...form, task_type: e.target.value })} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e4db', fontSize: '12px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>MOOD HINTS (virgülle)</div>
                <input value={form.mood_hints} onChange={e => setForm({ ...form, mood_hints: e.target.value })} placeholder="warm, playful, emotional" style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e4db', fontSize: '12px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>SORT ORDER</div>
                <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e4db', fontSize: '12px', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>PROMPT TEMPLATE</div>
              <textarea value={form.prompt_template} onChange={e => setForm({ ...form, prompt_template: e.target.value })} rows={12} style={{ width: '100%', padding: '8px', border: '1px solid #e5e4db', fontSize: '11px', fontFamily: 'monospace', lineHeight: 1.5, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.requires_mascot_image} onChange={e => setForm({ ...form, requires_mascot_image: e.target.checked })} /> Maskot görseli gerektirir
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Aktif
              </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalOpen(false)} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '11px' }}>İPTAL</button>
              <button onClick={handleSave} disabled={saving || !form.slug || !form.label} className="btn" style={{ padding: '8px 16px', fontSize: '11px' }}>{saving ? 'Kaydediliyor...' : editId ? 'GÜNCELLE' : 'KAYDET'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
