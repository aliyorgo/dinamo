import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import sharp from 'sharp'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

export async function POST(req: NextRequest) {
  try {
    const { briefId, videoUrl: passedVideoUrl } = await req.json()
    if (!briefId) return NextResponse.json({ error: 'briefId gerekli' }, { status: 400 })

    // Get brief with video URL — fallback chain: passed URL > ai_video_url > video_submissions
    const { data: brief } = await supabase.from('briefs').select('*, clients(brand_tone)').eq('id', briefId).single()
    let resolvedVideoUrl = passedVideoUrl || brief?.ai_video_url
    if (!resolvedVideoUrl) {
      const { data: sub } = await supabase.from('video_submissions').select('video_url').eq('brief_id', briefId).order('version', { ascending: false }).limit(1).maybeSingle()
      resolvedVideoUrl = sub?.video_url
    }
    if (!resolvedVideoUrl) return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })

    const tmpDir = path.join(os.tmpdir(), `static-${briefId}-${Date.now()}`)
    fs.mkdirSync(tmpDir, { recursive: true })

    // Download video
    const videoPath = path.join(tmpDir, 'video.mp4')
    const videoRes = await fetch(resolvedVideoUrl)
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer())
    fs.writeFileSync(videoPath, videoBuffer)

    // Get video duration
    let duration = 10
    try {
      const probe = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`, { encoding: 'utf8' }).trim()
      duration = parseFloat(probe) || 10
    } catch {}

    // Extract 16 candidate frames at well-spread positions
    const TOTAL_CANDIDATES = 16
    const startTime = 0.5
    const endTime = Math.max(duration - 0.3, startTime + 1)
    const frameFiles: string[] = []
    for (let i = 0; i < TOTAL_CANDIDATES; i++) {
      // Spread: pick at odd fractions (1/32, 3/32, 5/32...) for maximum diversity
      const ts = startTime + ((2 * i + 1) / (2 * TOTAL_CANDIDATES)) * (endTime - startTime)
      const outFile = path.join(tmpDir, `frame_${String(i).padStart(2, '0')}.jpg`)
      try {
        execSync(`ffmpeg -y -ss ${ts.toFixed(2)} -i "${videoPath}" -vframes 1 -q:v 2 "${outFile}" 2>/dev/null`)
        if (fs.existsSync(outFile)) frameFiles.push(outFile)
      } catch {}
    }

    if (frameFiles.length === 0) {
      cleanup(tmpDir)
      return NextResponse.json({ error: 'Frame çıkarılamadı' }, { status: 500 })
    }

    // Score frames by sharpness + compute avg color for diversity filtering
    const scored: { path: string; score: number; index: number; avgColor: number[] }[] = []
    for (let i = 0; i < frameFiles.length; i++) {
      try {
        const img = sharp(frameFiles[i])
        const stats = await img.stats()
        const entropy = stats.entropy
        const avgColor = stats.channels.slice(0, 3).map(c => Math.round(c.mean))
        scored.push({ path: frameFiles[i], score: entropy, index: i, avgColor })
      } catch {
        scored.push({ path: frameFiles[i], score: 0, index: i, avgColor: [0, 0, 0] })
      }
    }

    // Select top 4 with diversity: pick best, then pick next best that differs enough
    scored.sort((a, b) => b.score - a.score)
    const selected: typeof scored = []
    const colorDiffThreshold = 30 // min RGB distance between selected frames

    for (const candidate of scored) {
      if (selected.length >= 4) break
      const tooSimilar = selected.some(s => {
        const diff = Math.sqrt(
          Math.pow(s.avgColor[0] - candidate.avgColor[0], 2) +
          Math.pow(s.avgColor[1] - candidate.avgColor[1], 2) +
          Math.pow(s.avgColor[2] - candidate.avgColor[2], 2)
        )
        return diff < colorDiffThreshold
      })
      if (!tooSimilar || selected.length === 0) selected.push(candidate)
    }
    // Fill remaining if diversity filter was too strict
    for (const candidate of scored) {
      if (selected.length >= 4) break
      if (!selected.includes(candidate)) selected.push(candidate)
    }

    const topFrames = selected.slice(0, 4)
    const topIndexes = new Set(topFrames.map(f => f.index))
    const poolFrames = scored.filter(f => !topIndexes.has(f.index))

    // Upload frames to Supabase storage and get URLs
    const uploadFrame = async (framePath: string, label: string): Promise<string> => {
      const buf = fs.readFileSync(framePath)
      const storagePath = `static-frames/${briefId}/${label}_${Date.now()}.jpg`
      await supabase.storage.from('videos').upload(storagePath, buf, { contentType: 'image/jpeg', upsert: true })
      const { data } = supabase.storage.from('videos').getPublicUrl(storagePath)
      return data.publicUrl
    }

    const frameUrls = await Promise.all(topFrames.map((f, i) => uploadFrame(f.path, `top_${i}`)))
    const poolUrls = await Promise.all(poolFrames.map((f, i) => uploadFrame(f.path, `pool_${i}`)))

    // Generate copy via Anthropic
    let copy = ''
    try {
      const briefContext = [
        brief.campaign_name && `Kampanya: ${brief.campaign_name}`,
        brief.message && `Brief: ${brief.message.substring(0, 200)}`,
        brief.target_audience && `Hedef kitle: ${brief.target_audience}`,
        brief.clients?.brand_tone && `Marka tonu: ${brief.clients.brand_tone}`,
      ].filter(Boolean).join('\n')

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 60,
          system: `Türkçe reklam görseli için kısa, çarpıcı ad copy üret.
KURALLAR:
- EN FAZLA 40 karakter. 40 karakteri ASLA aşma.
- Kelime ortasında kesme, tamamlanmış cümle veya ifade olsun.
- Brief'teki ürün veya kampanya özelliklerini kullan, generic olma.
- Sentence case kullan.
- Tırnak işareti KULLANMA (tek veya çift).
- Açıklama YAPMA, sadece copy metnini döndür, başka hiçbir şey yazma.`,
          messages: [{ role: 'user', content: briefContext || 'Marka reklam görseli copy yaz' }],
        }),
      })
      const data = await res.json()
      copy = (data.content?.[0]?.text || '').trim().substring(0, 40)
    } catch {}

    // Store pool in Supabase for refresh endpoint (temp storage via brief metadata)
    await supabase.from('briefs').update({
      static_frame_pool: poolUrls,
    }).eq('id', briefId)

    cleanup(tmpDir)

    return NextResponse.json({
      frames: frameUrls,
      candidatePool: poolUrls,
      copy,
    })
  } catch (err: any) {
    console.error('Static images prepare error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function cleanup(dir: string) {
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
}
