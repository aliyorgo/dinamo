'use client'
import { useState, useEffect, useRef } from 'react'

interface Props {
  briefId: string
  videoUrl: string
  existingUrl?: string | null
  onClose: () => void
  onGenerated?: (url: string) => void
}

export default function StaticImageGeneratorModal({ briefId, videoUrl, existingUrl, onClose, onGenerated }: Props) {
  const [loading, setLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState('Kareler hazırlanıyor...')
  const [frames, setFrames] = useState<string[]>([])
  const [copy, setCopy] = useState('')
  const [selectedFrames, setSelectedFrames] = useState<Set<number>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState(existingUrl || '')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (existingUrl) { setLoading(false); return }
    triggerPrepare()
    return () => { stopPolling() }
  }, [])

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
  }

  async function pollStatus(onComplete: (result: any) => void) {
    stopPolling()
    timeoutRef.current = setTimeout(() => {
      stopPolling()
      setError('İşlem zaman aşımına uğradı. Tekrar deneyin.')
      setLoading(false)
      setGenerating(false)
      setRefreshing(false)
    }, 120000)

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/static-images/status?briefId=${briefId}`)
        const data = await res.json()
        console.log('[static-poll]', data.status, data.result ? 'has result' : 'no result', data.error || '')
        if (data.status === 'completed' && data.result) {
          stopPolling()
          onComplete(data.result)
        } else if (data.status === 'failed') {
          stopPolling()
          setError(data.error || 'İşlem başarısız')
          setLoading(false)
          setGenerating(false)
          setRefreshing(false)
        }
      } catch (e) {
        console.error('[static-poll] error:', e)
      }
    }, 3000)
  }

  async function triggerPrepare() {
    setLoading(true)
    setLoadingMessage('Kareler hazırlanıyor...')
    setError('')
    try {
      const res = await fetch('/api/static-images/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId, videoUrl }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      if (data.copy) setCopy(data.copy)

      // Poll for Railway completion
      pollStatus((result) => {
        setFrames(result.frames || [])
        setCopy(prev => prev || result.copy || '')
        setSelectedFrames(new Set())
        setLoading(false)
      })
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    const keepUrls = frames.filter((_, i) => selectedFrames.has(i))
    try {
      await fetch('/api/static-images/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId, keepFrameUrls: keepUrls, videoUrl }),
      })
      pollStatus((result) => {
        setFrames(result.frames || [])
        const newSelected = new Set<number>()
        keepUrls.forEach((_, i) => newSelected.add(i))
        setSelectedFrames(newSelected)
        setRefreshing(false)
      })
    } catch {
      setRefreshing(false)
    }
  }

  async function handleGenerate() {
    if (selectedFrames.size === 0) return
    setGenerating(true)
    setError('')
    try {
      const selectedUrls = frames.filter((_, i) => selectedFrames.has(i))
      await fetch('/api/static-images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId, selectedFrames: selectedUrls, copy }),
      })
      pollStatus((result) => {
        setDownloadUrl(result.url)
        onGenerated?.(result.url)
        setGenerating(false)
      })
    } catch (err: any) {
      setError(err.message)
      setGenerating(false)
    }
  }

  function toggleFrame(idx: number) {
    setSelectedFrames(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '28px 32px', maxWidth: '560px', width: '90%', maxHeight: '85vh', overflowY: 'auto', fontFamily: "var(--font-dm-sans),'DM Sans',sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#0a0a0a' }}>Statik Görsel Oluştur</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#888', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>

        {(loading || generating) && !downloadUrl ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ width: '24px', height: '24px', border: '2px solid #1DB81D', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
            <div style={{ fontSize: '13px', color: '#888' }}>{generating ? 'Görseller üretiliyor...' : loadingMessage}</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : downloadUrl ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>&#10003;</div>
            <div style={{ fontSize: '16px', fontWeight: '500', color: '#0a0a0a', marginBottom: '8px' }}>Görsel paketin hazır</div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '24px' }}>5 format × {selectedFrames.size || '?'} frame = {(selectedFrames.size || 1) * 5} görsel</div>
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer" onClick={() => setTimeout(onClose, 300)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', background: '#22c55e', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              ZIP İndir
            </a>
          </div>
        ) : (
          <>
            {error && <div style={{ background: '#fef2f2', border: '0.5px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#dc2626', marginBottom: '16px' }}>{error}</div>}

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reklam Metni</div>
                <div style={{ fontSize: '10px', color: copy.length > 35 ? '#f59e0b' : '#aaa' }}>{copy.length}/40</div>
              </div>
              <input value={copy} onChange={e => { if (e.target.value.length <= 40) setCopy(e.target.value) }} maxLength={40}
                placeholder="Metin ekleyin ya da metin olmadan üretin"
                style={{ width: '100%', padding: '10px 14px', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '8px', fontSize: '14px', color: '#0a0a0a', fontFamily: 'var(--font-dm-sans),sans-serif', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Frame Seçimi</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {frames.map((url, idx) => (
                  <div key={url} onClick={() => toggleFrame(idx)} style={{ position: 'relative', cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', border: selectedFrames.has(idx) ? '2px solid #1DB81D' : '2px solid transparent' }}>
                    <img src={url} alt={`Frame ${idx + 1}`} style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', top: '6px', right: '6px', width: '18px', height: '18px', borderRadius: '4px', background: selectedFrames.has(idx) ? '#1DB81D' : 'rgba(255,255,255,0.8)', border: selectedFrames.has(idx) ? 'none' : '1px solid rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {selectedFrames.has(idx) && <span style={{ color: '#fff', fontSize: '11px', fontWeight: '700' }}>&#10003;</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={handleRefresh} disabled={refreshing || generating}
                style={{ padding: '9px 18px', background: 'none', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', fontSize: '12px', color: '#555', cursor: refreshing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif' }}>
                {refreshing ? 'Yenileniyor...' : 'Yenile'}
              </button>
              <button onClick={handleGenerate} disabled={generating || selectedFrames.size === 0}
                style={{ padding: '9px 24px', background: selectedFrames.size === 0 ? '#ccc' : '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: generating || selectedFrames.size === 0 ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif', opacity: selectedFrames.size === 0 ? 0.5 : 1 }}>
                {selectedFrames.size === 0 ? 'Frame seçin' : `Üret (${selectedFrames.size} frame × 5 format)`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
