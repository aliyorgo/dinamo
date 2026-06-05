export default function ProcessingPlaceholder({ logoSize = 115, fontSize = 10, subtitle, accentColor = '#2ed573' }: {
  logoSize?: number
  fontSize?: number
  subtitle?: string
  accentColor?: string
}) {
  // Parse hex to rgba for gradient stops
  const r = parseInt(accentColor.slice(1, 3), 16)
  const g = parseInt(accentColor.slice(3, 5), 16)
  const b = parseInt(accentColor.slice(5, 7), 16)
  const scanGrad = `linear-gradient(to bottom, transparent 0%, rgba(${r},${g},${b},0.0) 30%, rgba(${r},${g},${b},0.6) 50%, rgba(${r},${g},${b},0.0) 70%, transparent 100%)`

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', animation: 'dinamoOpacityDip 7s infinite' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundImage: 'linear-gradient(135deg, #2a2a32 0%, #3d3d4a 25%, #4a4456 50%, #3d3d4a 75%, #2a2a32 100%)', backgroundSize: '300% 300%', animation: 'dinamoGradient 6s ease infinite' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 35%, transparent 70%)', animation: 'dinamoPulseGlow 4s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.35) 0%, transparent 40%)', animation: 'dinamoGlowCore 5.5s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, backgroundImage: 'radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,0.38) 85%, rgba(0,0,0,0.6) 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, height: '18%', zIndex: 4, backgroundImage: scanGrad, animation: 'dinamoScanline 4s ease-in infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 4, backgroundImage: 'linear-gradient(90deg, rgba(255,80,80,0.15), transparent 30%, transparent 70%, rgba(80,150,255,0.15))', mixBlendMode: 'screen', animation: 'dinamoGlitch 7s infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 5, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <img src="/dinamo_logo.png" alt="" style={{ width: `${logoSize}px`, objectFit: 'contain', display: 'block', animation: 'pulse 1.8s ease-in-out infinite' }} />
        <div style={{ fontSize: `${fontSize}px`, fontWeight: '500', letterSpacing: '0.1em', color: '#fff', marginTop: '2px', animation: 'pulse 1.5s ease infinite' }}>ÇALIŞIYOR</div>
        {subtitle && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 1.5, marginTop: '8px' }}>{subtitle}</div>}
      </div>
    </div>
  )
}
