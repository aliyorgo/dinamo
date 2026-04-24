'use client'
import { useState } from 'react'

interface VideoCardProps {
  videoUrl?: string | null
  thumbnailUrl?: string | null
  title: string
  subtitle?: string
  status?: 'new' | 'ready' | 'review' | 'pending' | 'rejected' | 'processing' | null
  statusLabel?: string
  duration?: string
  selected?: boolean
  aspect?: string
  size?: 'default' | 'compact'
  actions?: React.ReactNode
  children?: React.ReactNode
  onClick?: () => void
}

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  new: { bg: '#4ade80', color: '#0a0a0a', border: 'none' },
  ready: { bg: '#4ade80', color: '#0a0a0a', border: 'none' },
  review: { bg: '#ffffff', color: '#0a0a0a', border: '1px solid #0a0a0a' },
  pending: { bg: 'transparent', color: '#0a0a0a', border: '1px solid #0a0a0a' },
  rejected: { bg: '#0a0a0a', color: '#ffffff', border: 'none' },
  processing: { bg: '#0a0a0a', color: '#ffffff', border: 'none' },
}

export default function VideoCard({
  videoUrl, thumbnailUrl, title, subtitle, status, statusLabel,
  duration, selected, aspect = '9/16', size = 'default', actions, children, onClick,
}: VideoCardProps) {
  const [hovered, setHovered] = useState(false)
  const isCompact = size === 'compact'
  const thumbH = isCompact ? '120px' : undefined

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--color-background-secondary)' : '#fff',
        border: selected ? '2px solid #0a0a0a' : '1px solid var(--color-border-tertiary)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.15s, border-color 0.15s',
        overflow: 'hidden',
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', background: '#0a0a0a', aspectRatio: isCompact ? undefined : aspect, height: thumbH }}>
        {videoUrl ? (
          <video src={videoUrl} preload="metadata" controls={false} muted playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onMouseEnter={e => { (e.target as HTMLVideoElement).play().catch(() => {}) }}
            onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
          />
        ) : thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : null}

        {/* Hover overlay + play button */}
        {videoUrl && hovered && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.15s' }}>
            <div style={{ width: '48px', height: '48px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#0a0a0a', fontSize: '18px', marginLeft: '3px' }}>▶</span>
            </div>
          </div>
        )}

        {/* Status badge */}
        {status && statusLabel && (
          <div style={{
            position: 'absolute', top: '8px', left: '8px',
            fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500',
            padding: '3px 8px',
            ...STATUS_STYLES[status] || STATUS_STYLES.pending,
          }}>
            {statusLabel}
          </div>
        )}

        {/* Duration */}
        {duration && (
          <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: '#0a0a0a', color: '#fff', fontSize: '11px', padding: '4px 8px' }}>
            {duration}
          </div>
        )}

        {/* Selected indicator */}
        {selected && (
          <div style={{ position: 'absolute', top: '8px', right: '8px', width: '10px', height: '10px', background: '#4ade80', border: '1px solid #0a0a0a' }} />
        )}
      </div>

      {/* Meta */}
      <div style={{ padding: isCompact ? '8px 10px' : '12px 14px' }}>
        <div style={{
          fontSize: isCompact ? '12px' : '14px', fontWeight: '500', color: 'var(--color-text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
          lineHeight: 1.4, marginBottom: subtitle ? '4px' : '0',
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{subtitle}</div>
        )}
        {children}
      </div>

      {/* Actions */}
      {actions && (
        <div style={{ padding: '0 14px 12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </div>
  )
}
