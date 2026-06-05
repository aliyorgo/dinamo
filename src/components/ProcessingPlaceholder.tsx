'use client'
import { useEffect, useState, useRef } from 'react'

const LOG_COMMON = [
  '[agency] brief received from client portal',
  '[agency] parsing campaign objectives',
  '[agency] verifying brand guidelines',
  '[producer] brief approved — dispatching to AI orchestrator',
  '[producer] queue position: 1 / priority: normal',
  '[orchestrator] routing to engine',
  '[claude] sonnet-4.5-thinking initialized',
  '[claude] analyzing brief context',
  '[claude] extracting tone, target audience, key messages',
  '[claude] drafting creative concept (revision 1/3)',
  '[claude] concept locked — generating production script',
]
const LOG_EXPRESS = [
  '[claude] writing visual narrative (shot 1/1)',
  '[nano-banana] generating reference frame',
  '[nano-banana] character consistency: anchor locked',
  '[kling] piapi/kling-2-master initialized',
  '[kling] queued (region: us-west-2)',
  '[kling] processing — image to video, 15s, 720p',
  '[kling] frame generation: 24/360',
  '[kling] frame generation: 178/360',
  '[kling] frame generation: 360/360',
  '[kling] task complete: video_url received',
  '[ffmpeg] downloading source video',
  '[ffmpeg] applying CTA overlay',
  '[ffmpeg] re-encoding: libx264 -crf 19 yuv420p',
  '[supabase] uploading to storage bucket: ai-videos',
  '[supabase] upload complete',
  '[orchestrator] notifying client portal',
]
const LOG_PERSONA = [
  '[claude] selecting persona archetype',
  '[claude] matched: Gen Z creator — TR',
  '[claude] mizansen roll: 0.41 → third_person',
  '[claude] setup: gopro_walking_wide',
  '[claude] script: 18 words, 6 seconds',
  '[veo] piapi/veo3.1-video-fast initialized',
  '[veo] reference image attached',
  '[veo] task submitted: veo3.1-fast',
  '[veo] processing — text+image to video, 9:16',
  '[veo] generation: 18% — character locked',
  '[veo] generation: 47% — motion synthesis',
  '[veo] generation: 89% — final pass',
  '[veo] task complete',
  '[ffmpeg] detect-and-trim pass',
  '[ffmpeg] CTA overlay applied',
  '[supabase] uploading...',
]
const LOG_ANIMATION = [
  '[claude] reading animation_styles table',
  '[claude] style: mascot_only',
  '[claude] writing voiceover script (32 words)',
  '[elevenlabs] voice: Rachel-TR-v2',
  '[elevenlabs] generating TTS (12.3s)',
  '[elevenlabs] audio normalized: -16 LUFS',
  '[seedance] piapi/seedance-2-fast initialized',
  '[seedance] styleFreePrefix2D activated',
  '[seedance] task submitted: 720p, 15s',
  '[seedance] generation: 23% — style transfer',
  '[seedance] generation: 67% — motion',
  '[seedance] generation: 100%',
  '[ffmpeg] audio + video mux',
  '[ffmpeg] CTA overlay applied',
  '[supabase] uploading...',
]
const LOG_TREND = [
  '[claude] trend format: Bana Bak',
  '[claude] reading format playbook',
  '[nano-banana] generating opening frame',
  '[kling] piapi/kling-3.0 multi_shot initialized',
  '[kling] task: 6 shots, 15s total',
  '[kling] queued',
  '[kling] generation: 23%',
  '[kling] generation: 67%',
  '[kling] generation: 100%',
  '[elevenlabs] voiceover: 12 words',
  '[ffmpeg] sync audio + video',
  '[ffmpeg] CTA overlay',
  '[supabase] uploading...',
]

function getPool(engine?: string) {
  const e = engine === 'persona' ? LOG_PERSONA : engine === 'animation' ? LOG_ANIMATION : engine === 'trend' ? LOG_TREND : LOG_EXPRESS
  return [...LOG_COMMON, ...e]
}

export default function ProcessingPlaceholder({ logoSize = 115, fontSize = 10, subtitle, accentColor = '#2ed573', engine, status }: {
  logoSize?: number
  fontSize?: number
  subtitle?: string
  accentColor?: string
  engine?: 'express' | 'persona' | 'animation' | 'trend'
  status?: string
}) {
  const r = parseInt(accentColor.slice(1, 3), 16)
  const g = parseInt(accentColor.slice(3, 5), 16)
  const b = parseInt(accentColor.slice(5, 7), 16)
  const scanGrad = `linear-gradient(to bottom, transparent 0%, rgba(${r},${g},${b},0.0) 30%, rgba(${r},${g},${b},0.6) 50%, rgba(${r},${g},${b},0.0) 70%, transparent 100%)`

  const [logs, setLogs] = useState<string[]>([])
  const idxRef = useRef(0)

  useEffect(() => {
    if (status === 'failed' || status === 'error') return
    const pool = getPool(engine)
    const iv = setInterval(() => {
      idxRef.current = (idxRef.current + 1) % pool.length
      setLogs(prev => [...prev, pool[idxRef.current]].slice(-8))
    }, 1800)
    return () => clearInterval(iv)
  }, [engine, status])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', animation: 'dinamoOpacityDip 7s infinite' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundImage: 'linear-gradient(135deg, #2a2a32 0%, #3d3d4a 25%, #4a4456 50%, #3d3d4a 75%, #2a2a32 100%)', backgroundSize: '300% 300%', animation: 'dinamoGradient 6s ease infinite' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 35%, transparent 70%)', animation: 'dinamoPulseGlow 4s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.35) 0%, transparent 40%)', animation: 'dinamoGlowCore 5.5s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, backgroundImage: 'radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,0.38) 85%, rgba(0,0,0,0.6) 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, height: '18%', zIndex: 4, backgroundImage: scanGrad, animation: 'dinamoScanline 4s ease-in infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 4, backgroundImage: 'linear-gradient(90deg, rgba(255,40,40,0.5), transparent 25%, transparent 75%, rgba(40,150,255,0.5))', animation: 'dinamoGlitch 7s infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 5, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <img src="/dinamo_logo.png" alt="" style={{ width: `${logoSize}px`, objectFit: 'contain', display: 'block', animation: 'pulse 1.8s ease-in-out infinite' }} />
        <div style={{ fontSize: `${fontSize}px`, fontWeight: '500', letterSpacing: '0.1em', color: '#fff', marginTop: '2px', animation: 'pulse 1.5s ease infinite' }}>ÇALIŞIYOR</div>
        {subtitle && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 1.5, marginTop: '8px' }}>{subtitle}</div>}
      </div>
      {/* Fake railway log scroll — alt %25 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', zIndex: 6, pointerEvents: 'none', fontFamily: 'Menlo, Monaco, "SF Mono", Consolas, monospace', fontSize: 8, lineHeight: 1.4, color: 'rgba(255,255,255,0.65)', padding: '0 12px', overflow: 'hidden', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)', maskImage: 'linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
          {logs.map((line, i) => (
            <div key={`${i}-${line.slice(0, 15)}`} style={{ whiteSpace: 'normal', wordBreak: 'break-word', opacity: 0.55 + (i / Math.max(logs.length, 1)) * 0.4 }}>{line}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
