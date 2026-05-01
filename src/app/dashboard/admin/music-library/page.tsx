'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const MOODS = ['ENERJİK', 'DUYGUSAL', 'EĞLENCELİ', 'DRAMATIK', 'SAKİN', 'LÜKS', 'GENEL']

const MOOD_COLORS: Record<string, { bg: string; border: string }> = {
  'ENERJİK': { bg: 'rgba(239,68,68,0.08)', border: '#ef4444' },
  'DUYGUSAL': { bg: 'rgba(168,85,247,0.08)', border: '#a855f7' },
  'EĞLENCELİ': { bg: 'rgba(245,158,11,0.08)', border: '#f59e0b' },
  'DRAMATIK': { bg: 'rgba(64,64,64,0.08)', border: '#404040' },
  'SAKİN': { bg: 'rgba(59,130,246,0.08)', border: '#3b82f6' },
  'LÜKS': { bg: 'rgba(180,160,120,0.08)', border: '#b4a078' },
  'GENEL': { bg: 'rgba(156,163,175,0.08)', border: '#9ca3af' },
}

export default function MusicLibraryPage() {
  const [music, setMusic] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterMood, setFilterMood] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterActive, setFilterActive] = useState(true)
  const [search, setSearch] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [uploadMoods, setUploadMoods] = useState<string[]>([])
  const [uploadClient, setUploadClient] = useState('')
  const [msg, setMsg] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ name: '', moods: [] as string[], client_id: '' })
  const [migrating, setMigrating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadMusic(); loadClients() }, [])

  async function loadMusic() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterMood) params.set('mood', filterMood)
    if (filterClient) params.set('client_id', filterClient)
    if (!filterActive) params.set('active', 'false')
    if (search) params.set('search', search)
    const res = await fetch(`/api/admin/music-library?${params}`)
    const data = await res.json()
    setMusic(data.music || [])
    setLoading(false)
  }

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id, company_name').order('company_name')
    setClients(data || [])
  }

  useEffect(() => { loadMusic() }, [filterMood, filterClient, filterActive])

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    form.append('name', uploadName || file.name.replace(/\.[^.]+$/, ''))
    if (uploadMoods.length) form.append('mood', uploadMoods.join(','))
    if (uploadClient) form.append('client_id', uploadClient)
    const res = await fetch('/api/admin/music-library', { method: 'POST', body: form })
    const data = await res.json()
    setUploading(false)
    if (data.error) { setMsg('Hata: ' + data.error); return }
    setShowUpload(false)
    setUploadName(''); setUploadMoods([]); setUploadClient('')
    if (fileRef.current) fileRef.current.value = ''
    loadMusic()
  }

  async function toggleActive(id: string, current: boolean) {
    await fetch(`/api/admin/music-library/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current }),
    })
    setMusic(prev => prev.map(m => m.id === id ? { ...m, is_active: !current } : m))
  }

  async function saveEdit() {
    if (!editId) return
    await fetch(`/api/admin/music-library/${editId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editData.name, mood: editData.moods.length > 0 ? editData.moods : null, client_id: editData.client_id || null }),
    })
    setEditId(null)
    loadMusic()
  }

  async function deleteMusic(id: string, name: string) {
    if (!confirm(`"${name}" müziğini silmek istediğinize emin misiniz?`)) return
    await fetch(`/api/admin/music-library/${id}`, { method: 'DELETE' })
    loadMusic()
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    loadMusic()
  }

  async function handleMigrate() {
    if (!confirm('Pipeline\'daki 8 mevcut müzik dosyasını DB\'ye kaydet?')) return
    setMigrating(true)
    const res = await fetch('/api/admin/music-library/migrate', { method: 'POST' })
    const data = await res.json()
    setMigrating(false)
    setMsg(data.message || 'Migration tamamlandı')
    setTimeout(() => setMsg(''), 3000)
    loadMusic()
  }

  const totalCount = music.length
  const moodCounts = MOODS.reduce((a, m) => { a[m] = music.filter(x => Array.isArray(x.mood) ? x.mood.includes(m) : x.mood === m).length; return a }, {} as Record<string, number>)
  const brandCount = music.filter(m => m.client_id).length
  const untaggedCount = music.filter(m => !m.mood || (Array.isArray(m.mood) && m.mood.length === 0)).length

  function MoodBadges({ mood }: { mood: string[] | null }) {
    if (!mood || mood.length === 0) return <span style={{ fontSize: '9px', letterSpacing: '1px', padding: '2px 6px', border: '1px solid #e5e4db', color: '#9ca3af', textTransform: 'uppercase' }}>ETİKETSİZ</span>
    return <>{mood.map(m => { const c = MOOD_COLORS[m] || MOOD_COLORS['GENEL']; return <span key={m} style={{ fontSize: '9px', letterSpacing: '1px', padding: '2px 6px', background: c.bg, border: `1px solid ${c.border}`, color: '#0a0a0a', textTransform: 'uppercase' }}>{m}</span> })}</>
  }

  function MoodCheckboxes({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {MOODS.map(m => {
          const active = selected.includes(m)
          const c = MOOD_COLORS[m] || MOOD_COLORS['GENEL']
          return (
            <span key={m} onClick={() => onChange(active ? selected.filter(x => x !== m) : [...selected, m])}
              style={{ fontSize: '10px', letterSpacing: '1px', padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase', fontWeight: active ? '600' : '400',
                background: active ? c.bg : '#fff', border: `1px solid ${active ? c.border : '#e5e4db'}`, color: '#0a0a0a' }}>
              {m}
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ padding: '48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '300', letterSpacing: '-1px', margin: 0, color: '#0a0a0a' }}>Music Library</h1>
        <button onClick={() => setShowUpload(true)} className="btn" style={{ padding: '10px 20px' }}>+ MÜZİK YÜKLE</button>
      </div>

      {!loading && music.length === 0 && (
        <div style={{ marginBottom: '16px', padding: '14px 18px', background: '#fff', border: '1px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '13px', color: '#0a0a0a' }}>Library boş — yukarıdaki <strong>+ MÜZİK YÜKLE</strong> butonuyla MP3 dosyaları ekle.</div>
        </div>
      )}

      {msg && <div style={{ marginBottom: '16px', padding: '10px 14px', background: msg.includes('Hata') ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${msg.includes('Hata') ? '#ef4444' : '#22c55e'}`, fontSize: '12px', color: '#0a0a0a' }}>{msg}</div>}

      {/* Stats */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: '#0a0a0a' }}><strong>{totalCount}</strong> müzik</span>
        <span style={{ fontSize: '12px', color: '#888' }}>{Object.values(moodCounts).filter(v => v > 0).length} mood'da</span>
        <span style={{ fontSize: '12px', color: '#888' }}>{brandCount} marka özel</span>
        {untaggedCount > 0 && <span style={{ fontSize: '12px', color: '#f59e0b' }}>{untaggedCount} etiketsiz</span>}
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Müzik ara..." style={{ flex: 1, minWidth: '160px', padding: '8px 12px', border: '1px solid #e5e4db', fontSize: '13px' }} />
        <select value={filterMood} onChange={e => setFilterMood(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #e5e4db', fontSize: '13px', background: '#fff' }}>
          <option value="">Tüm Mood'lar</option>
          {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
          <option value="">ETİKETSİZ</option>
        </select>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #e5e4db', fontSize: '13px', background: '#fff' }}>
          <option value="">Tüm Markalar</option>
          <option value="general">Genel Havuz</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#888', cursor: 'pointer' }}>
          <input type="checkbox" checked={filterActive} onChange={e => setFilterActive(e.target.checked)} /> Sadece aktif
        </label>
        <button type="submit" className="btn btn-outline" style={{ padding: '8px 14px', fontSize: '11px' }}>ARA</button>
      </form>

      {/* Music grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888', fontSize: '13px' }}>Yükleniyor...</div>
      ) : music.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#888', fontSize: '14px' }}>Müzik bulunamadı.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
          {music.map(m => (
            <div key={m.id} style={{ background: '#fff', border: '1px solid #e5e4db', padding: '16px 18px', opacity: m.is_active ? 1 : 0.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '8px' }}>{m.name}</div>
                <button onClick={() => toggleActive(m.id, m.is_active)} style={{ fontSize: '9px', letterSpacing: '1px', padding: '2px 6px', border: '1px solid #e5e4db', background: m.is_active ? '#fff' : '#f5f4f0', color: m.is_active ? '#22c55e' : '#888', cursor: 'pointer', flexShrink: 0 }}>
                  {m.is_active ? 'AKTİF' : 'PASİF'}
                </button>
              </div>
              <audio controls src={m.file_url} style={{ width: '100%', marginBottom: '8px', height: '32px' }} />
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                <MoodBadges mood={m.mood} />
                {m.clients?.company_name && <span style={{ fontSize: '9px', letterSpacing: '1px', padding: '2px 6px', border: '1px solid #3b82f6', color: '#3b82f6', textTransform: 'uppercase' }}>{m.clients.company_name}</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#888' }}>
                  {m.size_bytes ? `${(m.size_bytes / 1024 / 1024).toFixed(1)} MB` : ''}
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => { setEditId(m.id); setEditData({ name: m.name, moods: Array.isArray(m.mood) ? m.mood : m.mood ? [m.mood] : [], client_id: m.client_id || '' }) }} className="btn btn-outline" style={{ padding: '3px 8px', fontSize: '9px' }}>DÜZENLE</button>
                  <button onClick={() => deleteMusic(m.id, m.name)} className="btn btn-outline" style={{ padding: '3px 8px', fontSize: '9px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>SİL</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* UPLOAD MODAL */}
      {showUpload && (
        <div onClick={() => setShowUpload(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '28px', width: '440px', maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#0a0a0a' }}>MÜZİK YÜKLE</div>
              <button onClick={() => setShowUpload(false)} style={{ width: '28px', height: '28px', border: '1px solid #e5e4db', background: '#fff', color: '#0a0a0a', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div onClick={() => fileRef.current?.click()} style={{ border: '1px dashed #0a0a0a', padding: '28px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px' }}>
              <div style={{ fontSize: '28px', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>+</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                {fileRef.current?.files?.[0] ? fileRef.current.files[0].name : 'MP3 veya WAV dosya seç'}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="audio/*" onChange={() => { if (fileRef.current?.files?.[0] && !uploadName) setUploadName(fileRef.current.files[0].name.replace(/\.[^.]+$/, '')) }} style={{ display: 'none' }} />
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>İSİM</div>
              <input value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="Müzik adı..." style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e4db', fontSize: '13px', color: '#0a0a0a', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>MOOD</div>
              <MoodCheckboxes selected={uploadMoods} onChange={setUploadMoods} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>MARKA (OPSİYONEL)</div>
              <select value={uploadClient} onChange={e => setUploadClient(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e4db', fontSize: '13px', color: '#0a0a0a', background: '#fff' }}>
                <option value="">Genel Havuz</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <button onClick={handleUpload} disabled={uploading} className="btn" style={{ width: '100%', padding: '10px' }}>
              {uploading ? 'YÜKLENİYOR...' : 'YÜKLE'}
            </button>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editId && (
        <div onClick={() => setEditId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid #0a0a0a', padding: '28px', width: '400px', maxWidth: '90vw' }}>
            <div style={{ fontSize: '14px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#0a0a0a', marginBottom: '20px' }}>DÜZENLE</div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>İSİM</div>
              <input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e4db', fontSize: '13px', color: '#0a0a0a', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>MOOD</div>
              <MoodCheckboxes selected={editData.moods} onChange={v => setEditData({ ...editData, moods: v })} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>MARKA</div>
              <select value={editData.client_id} onChange={e => setEditData({ ...editData, client_id: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e4db', fontSize: '13px', color: '#0a0a0a', background: '#fff' }}>
                <option value="">Genel Havuz</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEditId(null)} className="btn btn-outline" style={{ flex: 1, padding: '10px' }}>İPTAL</button>
              <button onClick={saveEdit} className="btn" style={{ flex: 1, padding: '10px' }}>KAYDET</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
