import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file gerekli' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Dosya 5MB\'dan kucuk olmali' }, { status: 400 })

  // Get style slug for storage path
  const { data: style } = await supabase.from('animation_styles').select('slug').eq('id', id).single()
  if (!style) return NextResponse.json({ error: 'Stil bulunamadi' }, { status: 404 })

  const ext = file.name.split('.').pop() || 'png'
  const storagePath = `animation-styles/${style.slug}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabase.storage.from('videos').upload(storagePath, buffer, { contentType: file.type, upsert: true })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: urlData } = supabase.storage.from('videos').getPublicUrl(storagePath)
  const iconUrl = urlData.publicUrl + '?t=' + Date.now()

  await supabase.from('animation_styles').update({ icon_path: iconUrl }).eq('id', id)

  return NextResponse.json({ icon_path: iconUrl })
}
