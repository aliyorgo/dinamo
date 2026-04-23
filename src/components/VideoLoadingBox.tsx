'use client'

interface Props {
  aspect?: string // '9:16', '16:9', '1:1', '4:5'
  size?: 'large' | 'small'
  label?: string
  sublabel?: string
}

export default function VideoLoadingBox({ aspect = '9/16', size = 'large', label = 'Videonuz hazırlanıyor', sublabel = '24 saat içinde incelemenize sunulacak.' }: Props) {
  const cssAspect = aspect.replace(':', '/')
  const isSmall = size === 'small'
  const iconSize = isSmall ? 14 : 20
  const iconWrap = isSmall ? 32 : 48
  const titleSize = isSmall ? 10 : 14
  const subSize = isSmall ? 9 : 12
  const gap = isSmall ? 6 : 12
  const radius = isSmall ? 6 : 12

  return (
    <div style={{
      aspectRatio: cssAspect,
      background: '#f5f4f0',
      border: '0.5px solid rgba(0,0,0,0.08)',
      borderRadius: `${radius}px`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: `${gap}px`,
      width: '100%',
    }}>
      <div style={{ width: `${iconWrap}px`, height: `${iconWrap}px`, borderRadius: '50%', background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="5" stroke="#aaa" strokeWidth="1.2" />
          <path d="M8 5v3l2 1" stroke="#aaa" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ fontSize: `${titleSize}px`, fontWeight: '500', color: '#0a0a0a' }}>{label}</div>
      {sublabel && !isSmall && <div style={{ fontSize: `${subSize}px`, color: '#888' }}>{sublabel}</div>}
      {isSmall && <div style={{ fontSize: `${subSize}px`, color: '#888' }}>{label === 'Videonuz hazırlanıyor' ? '' : label}</div>}
    </div>
  )
}
