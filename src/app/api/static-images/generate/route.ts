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

function wordWrap(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (current && (current.length + 1 + word.length) > maxCharsPerLine) {
      lines.push(current)
      current = word
    } else {
      current = current ? current + ' ' + word : word
    }
  }
  if (current) lines.push(current)
  return lines
}

function buildTextSvg(text: string, containerW: number, fontSize: number, fgColor: string, maxWidthRatio: number): { svg: Buffer; height: number } {
  const padLeft = Math.round(containerW * 0.15)
  const maxW = Math.round(containerW * maxWidthRatio)
  const charsPerLine = Math.max(8, Math.floor(maxW / (fontSize * 0.55)))
  const lines = wordWrap(text, charsPerLine)
  const lineHeight = Math.round(fontSize * 1.3)
  const totalH = lineHeight * lines.length + fontSize
  const svgLines = lines.map((line, i) =>
    `<text x="${padLeft}" y="${fontSize + lineHeight * i}" text-anchor="start" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="${fgColor}" letter-spacing="0.5">${escapeXml(line)}</text>`
  ).join('\n')
  const svg = `<svg width="${containerW}" height="${totalH}">${svgLines}</svg>`
  return { svg: Buffer.from(svg), height: totalH }
}

function slugify(name: string): string {
  const turkishMap: Record<string, string> = { 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ı': 'i', 'ö': 'o', 'ç': 'c', 'Ğ': 'G', 'Ü': 'U', 'Ş': 'S', 'İ': 'I', 'Ö': 'O', 'Ç': 'C' }
  let s = name
  for (const [k, v] of Object.entries(turkishMap)) s = s.replace(new RegExp(k, 'g'), v)
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const { briefId, selectedFrames, copy } = await req.json()
    if (!briefId || !selectedFrames?.length) return NextResponse.json({ error: 'briefId ve frame seçimi gerekli' }, { status: 400 })

    const { data: brief } = await supabase.from('briefs')
      .select('*, clients(brand_logo_url, brand_primary_color, brand_secondary_color, brand_font_url, brand_logo_position)')
      .eq('id', briefId).single()
    if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

    const brand = brief.clients || {}
    const secondaryColor = brand.brand_secondary_color || '#0A0A0A'
    const logoUrl = brand.brand_logo_url || null
    const logoPosition = brand.brand_logo_position || 'bottom'
    const copyText = (copy || '').trim()
    const campaignSlug = slugify(brief.campaign_name || 'visuals')

    // Version counter
    const existingUrl = brief.static_images_url || ''
    const vMatch = existingUrl.match(/_v(\d+)\.zip/)
    const version = vMatch ? parseInt(vMatch[1]) + 1 : existingUrl ? 2 : 1
    const versionSuffix = version > 1 ? `_v${version}` : ''

    const tmpDir = path.join(os.tmpdir(), `static-gen-${briefId}-${Date.now()}`)
    fs.mkdirSync(tmpDir, { recursive: true })

    let logoBuffer: Buffer | null = null
    if (logoUrl) {
      try {
        const logoRes = await fetch(logoUrl)
        logoBuffer = Buffer.from(await logoRes.arrayBuffer())
      } catch {}
    }

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
          let composed = await sharp(frameBuf)
            .resize(fmt.w, fmt.h, { fit: 'cover', position: 'attention', kernel: 'lanczos3' })
            .sharpen({ sigma: 0.5 })
            .jpeg({ quality: 93 })
            .toBuffer()

          const overlays: sharp.OverlayOptions[] = []

          // Logo top-right — ~32% of frame width
          if (logoBuffer) {
            const logoW = Math.round(fmt.w * 0.32)
            const logoH = Math.round(logoW * 0.5)
            const logoBuf = await sharp(logoBuffer).resize(logoW, logoH, { fit: 'inside' }).png().toBuffer()
            const logoMeta = await sharp(logoBuf).metadata()
            overlays.push({ input: logoBuf, top: 40, left: fmt.w - (logoMeta.width || logoW) - 40, blend: 'over' })
          }

          // Copy text — multi-line, auto-contrast, no background
          if (copyText) {
            const sampleRegion = await sharp(composed)
              .extract({ left: 0, top: fmt.h - 160, width: fmt.w, height: 160 })
              .stats()
            const avgBrightness = sampleRegion.channels.slice(0, 3).reduce((s, c) => s + c.mean, 0) / 3
            const fgColor = avgBrightness > 128 ? '#000000' : '#FFFFFF'
            const fontSize = Math.round(fmt.w * 0.066)
            const { svg, height: textH } = buildTextSvg(copyText, fmt.w, fontSize, fgColor, 0.80)
            overlays.push({ input: svg, top: Math.round(fmt.h * 0.65), left: 0, blend: 'over' })
          }

          if (overlays.length > 0) {
            composed = await sharp(composed).composite(overlays).jpeg({ quality: 93 }).toBuffer()
          }
          fs.writeFileSync(outPath, composed)

        } else {
          // Panel layout
          const frameW = Math.round(fmt.w * 0.4)
          const panelW = fmt.w - frameW

          const frameCropped = await sharp(frameBuf)
            .resize(frameW, fmt.h, { fit: 'cover', position: 'attention', kernel: 'lanczos3' })
            .sharpen({ sigma: 0.5 })
            .jpeg({ quality: 93 })
            .toBuffer()

          const panelOverlays: sharp.OverlayOptions[] = []

          // Logo on panel — 50% bigger than before
          if (logoBuffer) {
            const logoH = Math.round(fmt.h * 0.12)
            const logoBuf = await sharp(logoBuffer).resize({ height: logoH, fit: 'inside' }).png().toBuffer()
            const logoMeta = await sharp(logoBuf).metadata()
            const logoX = Math.round((panelW - (logoMeta.width || 100)) / 2)
            let logoY: number
            if (logoPosition === 'top') logoY = Math.round(fmt.h * 0.08)
            else if (logoPosition === 'middle') logoY = Math.round((fmt.h - logoH) / 2) - Math.round(fmt.h * 0.1)
            else logoY = Math.round(fmt.h * 0.75)
            panelOverlays.push({ input: logoBuf, top: logoY, left: logoX, blend: 'over' })
          }

          // Copy text on panel — multi-line
          if (copyText) {
            const fgColor = textColor(secondaryColor)
            const fontSize = Math.round(panelW * 0.09)
            const textY = Math.round(fmt.h * 0.35)
            const { svg, height: textH } = buildTextSvg(copyText, panelW, fontSize, fgColor, 0.85)
            panelOverlays.push({ input: svg, top: textY, left: 0, blend: 'over' })
          }

          let panel = sharp({ create: { width: panelW, height: fmt.h, channels: 3, background: secondaryColor } }).jpeg()
          if (panelOverlays.length > 0) {
            panel = sharp(await panel.toBuffer()).composite(panelOverlays).jpeg({ quality: 93 }) as any
          }
          const panelBuf = await (panel as any).toBuffer()

          const final = await sharp({ create: { width: fmt.w, height: fmt.h, channels: 3, background: '#000000' } })
            .composite([
              { input: frameCropped, top: 0, left: 0, blend: 'over' },
              { input: panelBuf, top: 0, left: frameW, blend: 'over' },
            ])
            .jpeg({ quality: 93 })
            .toBuffer()

          fs.writeFileSync(outPath, final)
        }

        outputFiles.push(outPath)
      }
    }

    // ZIP with campaign name
    const zipFileName = `${campaignSlug}_visuals${versionSuffix}.zip`
    const zipPath = path.join(tmpDir, zipFileName)
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

    const zipData = fs.readFileSync(zipPath)
    const storagePath = `static-images/${briefId}/${zipFileName}`
    const { error: upErr } = await supabase.storage.from('videos').upload(storagePath, zipData, { contentType: 'application/zip', upsert: true })
    if (upErr) throw new Error('ZIP upload hatası: ' + upErr.message)
    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(storagePath)
    const zipUrl = urlData.publicUrl

    await supabase.from('briefs').update({
      static_images_url: zipUrl,
      static_images_generated_at: new Date().toISOString(),
    }).eq('id', briefId)

    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}

    return NextResponse.json({ url: zipUrl })
  } catch (err: any) {
    console.error('Static images generate error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
