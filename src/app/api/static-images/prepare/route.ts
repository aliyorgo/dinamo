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
    const { briefId } = await req.json()
    if (!briefId) return NextResponse.json({ error: 'briefId gerekli' }, { status: 400 })

    // Get brief with video URL
    const { data: brief } = await supabase.from('briefs').select('*, clients(brand_tone)').eq('id', briefId).single()
    if (!brief?.ai_video_url) return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })

    const tmpDir = path.join(os.tmpdir(), `static-${briefId}-${Date.now()}`)
    fs.mkdirSync(tmpDir, { recursive: true })

    // Download video
    const videoPath = path.join(tmpDir, 'video.mp4')
    const videoRes = await fetch(brief.ai_video_url)
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer())
    fs.writeFileSync(videoPath, videoBuffer)

    // Get video duration
    let duration = 10
    try {
      const probe = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`, { encoding: 'utf8' }).trim()
      duration = parseFloat(probe) || 10
    } catch {}

    // Extract 12 candidate frames at even intervals (skip first 0.5s)
    const startTime = 0.5
    const endTime = Math.max(duration - 0.3, startTime + 1)
    const interval = (endTime - startTime) / 12

    const frameFiles: string[] = []
    for (let i = 0; i < 12; i++) {
      const ts = startTime + interval * i
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

    // Score frames by sharpness (entropy from sharp stats)
    const scored: { path: string; score: number; index: number }[] = []
    for (let i = 0; i < frameFiles.length; i++) {
      try {
        const img = sharp(frameFiles[i])
        const stats = await img.stats()
        // Use entropy as sharpness proxy — higher = more detail
        const entropy = stats.entropy
        scored.push({ path: frameFiles[i], score: entropy, index: i })
      } catch {
        scored.push({ path: frameFiles[i], score: 0, index: i })
      }
    }

    scored.sort((a, b) => b.score - a.score)
    const topFrames = scored.slice(0, 4)
    const poolFrames = scored.slice(4)

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
          system: 'Türkçe reklam görseli için 2-5 kelimelik çarpıcı ad copy üret. Sadece copy döndür, açıklama yapma, tırnak kullanma. 30 karakter üstü yasak.',
          messages: [{ role: 'user', content: briefContext || 'Marka reklam görseli copy yaz' }],
        }),
      })
      const data = await res.json()
      copy = (data.content?.[0]?.text || '').trim().substring(0, 30)
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
