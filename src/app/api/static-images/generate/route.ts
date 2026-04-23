import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import archiver from 'archiver'
import fs from 'fs'
import path from 'path'
import os from 'os'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const FORMATS = [
  { name: 'story_9x16', w: 1080, h: 1920, type: 'crop' },
  { name: 'feed_4x5', w: 1080, h: 1350, type: 'crop' },
  { name: 'square_1x1', w: 1080, h: 1080, type: 'crop' },
  { name: 'landscape_16x9', w: 1920, h: 1080, type: 'panel' },
  { name: 'og_1200x628', w: 1200, h: 628, type: 'panel' },
]

function textColor(bgHex: string): string {
  const hex = bgHex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return (r * 0.299 + g * 0.587 + b * 0.114) > 128 ? '#000000' : '#FFFFFF'
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export async function POST(req: NextRequest) {
  try {
    const { briefId, selectedFrames, copy } = await req.json()
    if (!briefId || !selectedFrames?.length) return NextResponse.json({ error: 'briefId ve frame seçimi gerekli' }, { status: 400 })

    // Get brief + client brand info
    const { data: brief } = await supabase.from('briefs')
      .select('*, clients(brand_logo_url, brand_primary_color, brand_secondary_color, brand_font_url, brand_logo_position)')
      .eq('id', briefId).single()
    if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

    const brand = brief.clients || {}
    const primaryColor = brand.brand_primary_color || '#1DB81D'
    const secondaryColor = brand.brand_secondary_color || '#0A0A0A'
    const logoUrl = brand.brand_logo_url || null
    const logoPosition = brand.brand_logo_position || 'bottom'
    const copyText = (copy || '').trim()

    const tmpDir = path.join(os.tmpdir(), `static-gen-${briefId}-${Date.now()}`)
    fs.mkdirSync(tmpDir, { recursive: true })

    // Download logo if exists
    let logoBuffer: Buffer | null = null
    if (logoUrl) {
      try {
        const logoRes = await fetch(logoUrl)
        logoBuffer = Buffer.from(await logoRes.arrayBuffer())
      } catch {}
    }

    // Download all selected frames
    const frameBuffers: Buffer[] = []
    for (const url of selectedFrames) {
      const res = await fetch(url)
      frameBuffers.push(Buffer.from(await res.arrayBuffer()))
    }

    const outputFiles: string[] = []

    for (let fi = 0; fi < frameBuffers.length; fi++) {
      const frameBuf = frameBuffers[fi]

      for (const fmt of FORMATS) {
        const outPath = path.join(tmpDir, `frame${fi + 1}_${fmt.name}.jpg`)

        if (fmt.type === 'crop') {
          // Smart crop to target aspect ratio, then overlay logo + copy
          let composed = await sharp(frameBuf)
            .resize(fmt.w, fmt.h, { fit: 'cover', position: 'attention' })
            .jpeg({ quality: 92 })
            .toBuffer()

          const overlays: sharp.OverlayOptions[] = []

          // Logo top-right with subtle shadow
          if (logoBuffer) {
            const logoBuf = await sharp(logoBuffer).resize(120, 60, { fit: 'inside' }).png().toBuffer()
            overlays.push({ input: logoBuf, top: 40, left: fmt.w - 160, blend: 'over' })
          }

          // Copy text at bottom
          if (copyText) {
            const fgColor = '#FFFFFF'
            const fontSize = Math.round(fmt.w * 0.038)
            const svgText = `<svg width="${fmt.w}" height="${fontSize * 3}">
              <rect x="0" y="0" width="${fmt.w}" height="${fontSize * 3}" fill="rgba(0,0,0,0.45)" rx="0"/>
              <text x="${fmt.w / 2}" y="${fontSize * 2}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="${fgColor}" letter-spacing="1">${escapeXml(copyText)}</text>
            </svg>`
            const textBuf = Buffer.from(svgText)
            overlays.push({ input: textBuf, top: fmt.h - fontSize * 3 - 40, left: 0, blend: 'over' })
          }

          if (overlays.length > 0) {
            composed = await sharp(composed).composite(overlays).jpeg({ quality: 92 }).toBuffer()
          }

          fs.writeFileSync(outPath, composed)
        } else {
          // Panel layout: left 40% frame, right 60% brand bg + logo + copy
          const frameW = Math.round(fmt.w * 0.4)
          const panelW = fmt.w - frameW

          // Crop frame for left side (4:5 aspect crop)
          const frameCropped = await sharp(frameBuf)
            .resize(frameW, fmt.h, { fit: 'cover', position: 'attention' })
            .jpeg({ quality: 92 })
            .toBuffer()

          // Create brand panel (right side)
          const panelOverlays: sharp.OverlayOptions[] = []

          // Logo on panel
          if (logoBuffer) {
            const logoH = Math.round(fmt.h * 0.08)
            const logoBuf = await sharp(logoBuffer).resize({ height: logoH, fit: 'inside' }).png().toBuffer()
            const logoMeta = await sharp(logoBuf).metadata()
            const logoX = Math.round((panelW - (logoMeta.width || 100)) / 2)
            let logoY: number
            if (logoPosition === 'top') logoY = Math.round(fmt.h * 0.08)
            else if (logoPosition === 'middle') logoY = Math.round((fmt.h - logoH) / 2) - Math.round(fmt.h * 0.1)
            else logoY = Math.round(fmt.h * 0.75)
            panelOverlays.push({ input: logoBuf, top: logoY, left: logoX, blend: 'over' })
          }

          // Copy text on panel
          if (copyText) {
            const fgColor = textColor(secondaryColor)
            const fontSize = Math.round(panelW * 0.065)
            const textY = Math.round(fmt.h * 0.45)
            const svgText = `<svg width="${panelW}" height="${fontSize * 4}">
              <text x="${panelW / 2}" y="${fontSize * 1.5}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="${fgColor}" letter-spacing="1">${escapeXml(copyText)}</text>
            </svg>`
            panelOverlays.push({ input: Buffer.from(svgText), top: textY, left: 0, blend: 'over' })
          }

          let panel = sharp({ create: { width: panelW, height: fmt.h, channels: 3, background: secondaryColor } }).jpeg()
          if (panelOverlays.length > 0) {
            panel = sharp(await panel.toBuffer()).composite(panelOverlays).jpeg({ quality: 92 }) as any
          }
          const panelBuf = await (panel as any).toBuffer()

          // Compose final: frame left + panel right
          const final = await sharp({ create: { width: fmt.w, height: fmt.h, channels: 3, background: '#000000' } })
            .composite([
              { input: frameCropped, top: 0, left: 0, blend: 'over' },
              { input: panelBuf, top: 0, left: frameW, blend: 'over' },
            ])
            .jpeg({ quality: 92 })
            .toBuffer()

          fs.writeFileSync(outPath, final)
        }

        outputFiles.push(outPath)
      }
    }

    // ZIP all output files
    const zipPath = path.join(tmpDir, 'static_images.zip')
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath)
      const archive = archiver('zip', { zlib: { level: 6 } })
      output.on('close', resolve)
      archive.on('error', reject)
      archive.pipe(output)
      for (const f of outputFiles) {
        archive.file(f, { name: path.basename(f) })
      }
      archive.finalize()
    })

    // Upload ZIP to Supabase storage
    const zipData = fs.readFileSync(zipPath)
    const storagePath = `static-images/${briefId}/${Date.now()}_static_images.zip`
    const { error: upErr } = await supabase.storage.from('videos').upload(storagePath, zipData, { contentType: 'application/zip', upsert: true })
    if (upErr) throw new Error('ZIP upload hatası: ' + upErr.message)
    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(storagePath)
    const zipUrl = urlData.publicUrl

    // Update brief
    await supabase.from('briefs').update({
      static_images_url: zipUrl,
      static_images_generated_at: new Date().toISOString(),
    }).eq('id', briefId)

    // Cleanup
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}

    return NextResponse.json({ url: zipUrl })
  } catch (err: any) {
    console.error('Static images generate error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
