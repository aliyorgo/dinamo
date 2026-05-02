'use client'
import { useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  badge?: string
  children: React.ReactNode
}

export default function InfoModal({ open, onClose, title, badge, children }: Props) {
  useEffect(() => {
    if (!open) return
    function handleEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-background-primary, #fff)', border: '0.5px solid var(--color-border-tertiary, #e5e4db)', borderRadius: '12px', padding: '1.75rem 1.75rem 1.5rem', maxWidth: '520px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '500', margin: 0, color: 'var(--color-text-primary, #0a0a0a)' }}>{title}</h2>
          {badge && <span style={{ fontSize: '11px', fontWeight: '500', padding: '2px 8px', borderRadius: '6px', background: 'var(--color-background-success, rgba(34,197,94,0.1))', color: 'var(--color-text-success, #166534)' }}>{badge}</span>}
        </div>

        {/* Content — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem' }}>
          {children}
        </div>

        {/* Footer */}
        <div style={{ paddingTop: '1rem', borderTop: '0.5px solid var(--color-border-tertiary, #e5e4db)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '500', background: 'var(--color-background-primary, #fff)', border: '1px solid var(--color-border-tertiary, #e5e4db)', color: 'var(--color-text-primary, #0a0a0a)', cursor: 'pointer', borderRadius: '6px' }}>Kapat</button>
        </div>
      </div>
    </div>
  )
}

export function InfoParagraph({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <p style={{ fontSize: '14px', lineHeight: 1.7, margin: '0 0 1rem', color: primary ? 'var(--color-text-primary, #0a0a0a)' : 'var(--color-text-secondary, #555)' }}>
      {children}
    </p>
  )
}
