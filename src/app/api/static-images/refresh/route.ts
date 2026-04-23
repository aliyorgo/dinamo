import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import sharp from 'sharp'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { briefId, keepFrameUrls, videoUrl: passedVideoUrl } = await req.json()
    if (!briefId) return NextResponse.json({ error: 'briefId gerekli' }, { status: 400 })

    const keepSet = new Set(keepFrameUrls || [])
    const replaceCount = 4 - keepSet.size

    if (replaceCount <= 0) {
      return NextResponse.json({ frames: [...keepSet] })
    }

    // Get pool and video URL with fallback chain
    const { data: brief } = await supabase.from('briefs').select('static_frame_pool, ai_video_url').eq('id', briefId).single()
    let pool: string[] = brief?.static_frame_pool || []

    let resolvedVideoUrl = passedVideoUrl || brief?.ai_video_url
    if (!resolvedVideoUrl) {
      const { data: sub } = await supabase.from('video_submissions').select('video_url').eq('brief_id', briefId).order('version', { ascending: false }).limit(1).maybeSingle()
      resolvedVideoUrl = sub?.video_url
    }

    // If pool exhausted, extract fresh frames from video
    if (pool.length < replaceCount && resolvedVideoUrl) {
      const tmpDir = path.join(os.tmpdir(), `static-refresh-${briefId}-${Date.now()}`)
      fs.mkdirSync(tmpDir, { recursive: true })

      const videoPath = path.join(tmpDir, 'video.mp4')
      const videoRes = await fetch(resolvedVideoUrl)
      fs.writeFileSync(videoPath, Buffer.from(await videoRes.arrayBuffer()))

      let duration = 10
      try {
        const probe = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`, { encoding: 'utf8' }).trim()
        duration = parseFloat(probe) || 10
      } catch {}

      // Extract 8 fresh frames at random-ish positions
      const newFrames: string[] = []
      for (let i = 0; i < 8; i++) {
        const ts = 0.3 + Math.random() * (duration - 0.6)
        const outFile = path.join(tmpDir, `refresh_${i}.jpg`)
        try {
          execSync(`ffmpeg -y -ss ${ts.toFixed(2)} -i "${videoPath}" -vframes 1 -q:v 2 "${outFile}" 2>/dev/null`)
          if (fs.existsSync(outFile)) {
            const buf = fs.readFileSync(outFile)
            const storagePath = `static-frames/${briefId}/refresh_${Date.now()}_${i}.jpg`
            await supabase.storage.from('videos').upload(storagePath, buf, { contentType: 'image/jpeg', upsert: true })
            const { data } = supabase.storage.from('videos').getPublicUrl(storagePath)
            newFrames.push(data.publicUrl)
          }
        } catch {}
      }

      try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
      pool = [...pool, ...newFrames]
    }

    // Take replacement frames from pool
    const replacements = pool.splice(0, replaceCount)

    // Update remaining pool
    await supabase.from('briefs').update({ static_frame_pool: pool }).eq('id', briefId)

    const kept = Array.from(keepSet) as string[]
    const newFrames = [...kept, ...replacements]

    return NextResponse.json({
      frames: newFrames.slice(0, 4),
      candidatePool: pool,
    })
  } catch (err: any) {
    console.error('Static images refresh error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
