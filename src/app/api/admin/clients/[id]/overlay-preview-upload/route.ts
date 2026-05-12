import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file gerekli' }, { status: 400 })
  if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'Dosya 50MB\'dan kucuk olmali' }, { status: 400 })

  const ext = file.name.split('.').pop() || 'mp4'
  const storagePath = `brand-overlay-previews/${clientId}/preview.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabase.storage.from('videos').upload(storagePath, buffer, { contentType: file.type, upsert: true })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: urlData } = supabase.storage.from('videos').getPublicUrl(storagePath)
  const previewUrl = urlData.publicUrl + '?t=' + Date.now()
  await supabase.from('clients').update({ brand_overlay_preview_url: previewUrl }).eq('id', clientId)

  return NextResponse.json({ preview_url: previewUrl })
}
