'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'giriş yaptı',
  'auth.logout': 'çıkış yaptı',
  'brief.created': 'brief oluşturdu',
  'brief.submitted': 'brief gönderdi',
  'brief.edited': 'brief düzenledi',
  'brief.deleted': 'brief sildi',
  'video.approved': 'videoyu onayladı',
  'video.rejected': 'videoyu reddetti',
  'video.revision_requested': 'revizyon istedi',
  'video.purchased': 'video satın aldı',
  'static_images.generated': 'statik görsel üretti',
  'static_images.downloaded': 'statik görsel indirdi',
  'cps.package_selected': 'CPS paketi seçti',
  'public_link.created': 'public link oluşturdu',
  'file.uploaded': 'dosya yükledi',
  'admin.client_created': 'müşteri ekledi',
  'admin.client_edited': 'müşteri düzenledi',
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'az önce'
  if (mins < 60) return `${mins} dk önce`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} saat önce`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'dün'
  if (days < 7) return `${days} gün önce`
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function ActionIcon({ type }: { type: string }) {
  const prefix = type.split('.')[0]
  const colors: Record<string, string> = { auth: '#3b82f6', brief: '#f59e0b', video: '#22c55e', static_images: '#8b5cf6', cps: '#ec4899', admin: '#ef4444', file: '#6b7280', public_link: '#06b6d4' }
  const color = colors[prefix] || '#888'
  return <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0, marginTop: '6px' }} />
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 20

  useEffect(() => { loadLogs(0) }, [])

  async function loadLogs(p: number) {
    setLoading(true)
    const { data } = await supabase.from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)
    if (data) {
      if (p === 0) setLogs(data)
      else setLogs(prev => [...prev, ...data])
      setHasMore(data.length === PAGE_SIZE)
    }
    setPage(p)
    setLoading(false)
  }

  return (
    <div style={{ padding: '24px 28px',  }}>
      <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '20px' }}>AKTİVİTE LOG</div>

      <div style={{ background: '#fff', border: '1px solid var(--color-border-tertiary)', padding: '16px 20px' }}>
        {logs.map((log, i) => (
          <div key={log.id} style={{ display: 'flex', gap: '10px', padding: '10px 0', borderBottom: i < logs.length - 1 ? '0.5px solid rgba(0,0,0,0.06)' : 'none', alignItems: 'flex-start' }}>
            <ActionIcon type={log.action_type} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', color: '#0a0a0a', lineHeight: 1.5 }}>
                <span style={{ fontWeight: '500' }}>{log.user_name || log.user_email || 'Bilinmeyen'}</span>
                {log.client_name && <span style={{ color: '#888' }}> ({log.client_name})</span>}
                {' '}{ACTION_LABELS[log.action_type] || log.action_type}
                {log.target_label && <span style={{ color: '#555' }}> — {log.target_label}</span>}
              </div>
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                  {Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                </div>
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#aaa', flexShrink: 0, whiteSpace: 'nowrap' }}>{relativeTime(log.created_at)}</div>
          </div>
        ))}

        {logs.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#aaa', fontSize: '13px' }}>Henüz aktivite yok</div>
        )}

        {hasMore && (
          <button onClick={() => loadLogs(page + 1)} disabled={loading}
            style={{ width: '100%', padding: '10px', background: 'none', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '12px', color: '#555', cursor: 'pointer', marginTop: '12px',  }}>
            {loading ? 'Yükleniyor...' : 'Daha fazla'}
          </button>
        )}
      </div>
    </div>
  )
}
