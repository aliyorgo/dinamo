'use client'

import { useState, useEffect } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

interface PremiumVersion {
  id: string
  version_number: number
  style_slug: string
  director_slug: string
  concept_title: string
  concept_pitch: string
  scene_prompt: string
  voiceover_script_tr: string
  music_mood: string
  is_selected: boolean
}

interface Props {
  briefId: string
  clientUserId: string
  premiumStatus: string | null
  onStatusChange?: (status: string) => void
}

export default function PremiumVersionSelector({ briefId, clientUserId, premiumStatus, onStatusChange }: Props) {
  const [versions, setVersions] = useState<PremiumVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(premiumStatus || 'idle')
  const [error, setError] = useState('')
  const [premiumVideoUrl, setPremiumVideoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'versions_ready' || status === 'version_selected' || status === 'shots_in_progress' || status === 'final_ready') {
      loadVersions()
    }
  }, [status])

  useEffect(() => {
    const shouldPoll = !status || status === 'pending' || status === 'generating_versions' || status === 'version_selected' || status === 'shots_in_progress' || (status === 'final_ready' && !premiumVideoUrl)
    if (shouldPoll) {
      const interval = setInterval(pollStatus, 5000)
      return () => clearInterval(interval)
    }
  }, [status, premiumVideoUrl])

  async function pollStatus() {
    const res = await fetch(`/api/premium/status?brief_id=${briefId}`)
    const data = await res.json()
    if (data.premium_status && data.premium_status !== status) {
      setStatus(data.premium_status)
      onStatusChange?.(data.premium_status)
    }
    if (data.premium_video_url) setPremiumVideoUrl(data.premium_video_url)
  }

  async function loadVersions() {
    const res = await fetch(`/api/premium/versions?brief_id=${briefId}`)
    const data = await res.json()
    if (data.versions) setVersions(data.versions)
  }

  async function handleStart() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/premium/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief_id: briefId, client_user_id: clientUserId })
    })
    const data = await res.json()
    if (data.success) {
      setStatus('pending')
      onStatusChange?.('pending')
    } else {
      setError(data.error || 'Hata olustu')
    }
    setLoading(false)
  }

  async function handleSelect(versionId: string) {
    setLoading(true)
    setError('')
    const res = await fetch('/api/premium/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief_id: briefId, version_id: versionId })
    })
    const data = await res.json()
    if (data.success) {
      setStatus('version_selected')
      onStatusChange?.('version_selected')
    } else {
      setError(data.error || 'Secim hatasi')
    }
    setLoading(false)
  }

  // Idle — show start button
  if (!status || status === 'idle') {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <button
          onClick={handleStart}
          disabled={loading}
          style={{ padding: '14px 28px', background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
        >
          {loading ? 'Baslatiliyor...' : 'Premium TVC Uret (3 Versiyon)'}
        </button>
        {error && <p style={{ color: '#dc2626', marginTop: '8px', fontSize: '12px' }}>{error}</p>}
      </div>
    )
  }

  // Generating versions
  if (status === 'pending' || status === 'generating_versions') {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', color: '#555' }}>3 versiyon uretiliyor...</div>
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#888' }}>Account Director + Agency Creative calisiyor (~30sn)</div>
      </div>
    )
  }

  // Versions ready — show 3 cards
  if (status === 'versions_ready' && versions.length > 0) {
    return (
      <div style={{ padding: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>3 Konsept Hazir — Birini Sec:</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          {versions.map(v => (
            <div key={v.id} style={{ border: '1px solid #e5e5e5', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>V{v.version_number}</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0a0a0a' }}>{v.concept_title}</div>
              <div style={{ fontSize: '11px', color: '#555', lineHeight: 1.5 }}>{v.concept_pitch}</div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
                <span style={{ background: '#f3f3f3', padding: '2px 6px', borderRadius: '4px', marginRight: '4px' }}>{v.style_slug}</span>
                <span style={{ background: '#f3f3f3', padding: '2px 6px', borderRadius: '4px' }}>{v.director_slug}</span>
              </div>
              <button
                onClick={() => handleSelect(v.id)}
                disabled={loading}
                style={{ marginTop: 'auto', padding: '10px', background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
              >
                Bu Versiyonu Sec
              </button>
            </div>
          ))}
        </div>
        {error && <p style={{ color: '#dc2626', marginTop: '8px', fontSize: '12px' }}>{error}</p>}
      </div>
    )
  }

  // Production in progress
  if (status === 'version_selected' || status === 'shots_in_progress') {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', color: '#555' }}>Premium video uretiliyor...</div>
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#888' }}>Shot-by-shot uretim devam ediyor</div>
      </div>
    )
  }

  // Final ready — show video player
  if (status === 'final_ready') {
    return (
      <div style={{ padding: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#16a34a', marginBottom: '12px' }}>Premium TVC Hazir</div>
        {premiumVideoUrl ? (
          <video
            controls
            style={{ width: '100%', maxHeight: '400px', borderRadius: '8px', background: '#000' }}
            src={premiumVideoUrl}
          />
        ) : (
          <div style={{ fontSize: '12px', color: '#888' }}>Video yukleniyor...</div>
        )}
      </div>
    )
  }

  // Failed
  if (status === 'failed') {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', color: '#dc2626' }}>Premium uretim basarisiz</div>
        <button onClick={handleStart} style={{ marginTop: '8px', padding: '8px 16px', background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Tekrar Dene</button>
      </div>
    )
  }

  return null
}
