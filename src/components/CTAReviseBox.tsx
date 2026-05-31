'use client'
import { useState } from 'react'

interface CTAReviseBoxProps {
  videoId: string
  engine: 'express' | 'persona' | 'animation'
  currentCtaText?: string | null
  preCtaVideoUrl?: string | null
  status?: string | null
  ctaEnabled?: boolean
  onStatusChange?: (newStatus: string) => void
}

export default function CTAReviseBox({ videoId, engine, currentCtaText, preCtaVideoUrl, status, ctaEnabled = true, onStatusChange }: CTAReviseBoxProps) {
  const [editedCta, setEditedCta] = useState(currentCtaText || '')

  if (!ctaEnabled) return null

  if (!preCtaVideoUrl) {
    return <div style={{marginTop:'8px',fontSize:'9px',color:'#ccc',fontStyle:'italic'}}>Bu video revize edilemiyor (eski sürüm)</div>
  }

  const isRevising = status === 'revising' || status === 'revising_claimed'
  const unchanged = editedCta.trim() === (currentCtaText || '').trim()

  return (
    <div style={{marginTop:'12px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'4px'}}>
        <span style={{fontSize:'12px',fontWeight:600,color:'#0a0a0a'}}>Hızlı CTA Revize</span>
        <span style={{fontSize:'10px',fontStyle:'italic',color:'#bbb'}}>~ 15 sn</span>
      </div>
      <div style={{display:'flex',borderRadius:'8px',border:'1px solid #e0dfd8',overflow:'hidden',opacity:isRevising?0.5:1,transition:'opacity 0.2s',maxWidth:'400px'}}>
        <input value={editedCta} onChange={e => setEditedCta(e.target.value)} disabled={isRevising} maxLength={200} placeholder="CTA metni..." style={{flex:1,fontSize:'12px',padding:'8px 12px',border:'none',outline:'none',background:'#fff',color:'#0a0a0a',minWidth:0}} />
        <button disabled={isRevising || unchanged || !editedCta.trim()} onClick={async () => {
          try {
            const res = await fetch('/api/cta/revise', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ videoId, engine, newCtaText: editedCta.trim() }) })
            const data = await res.json()
            if (!res.ok) { alert(data.error || 'Hata'); return }
            onStatusChange?.('revising')
          } catch { alert('Bağlantı hatası') }
        }} style={{padding:'8px 14px',background:isRevising||unchanged?'#e5e4db':'#22c55e',color:'#fff',border:'none',borderLeft:'1px solid #e0dfd8',cursor:isRevising||unchanged?'not-allowed':'pointer',transition:'background 0.15s',display:'flex',alignItems:'center'}}>
          {isRevising ? <span style={{width:20,height:20,border:'2.5px solid #999',borderTop:'2.5px solid transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite',display:'inline-block'}} /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
        </button>
      </div>
    </div>
  )
}
