import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const style = formData.get('style') as string | null
  if (!file || !style) return NextResponse.json({ error: 'file ve style gerekli' }, { status: 400 })
  if (style !== 'mascot_only' && style !== 'mascot_hybrid') return NextResponse.json({ error: 'style: mascot_only veya mascot_hybrid' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Dosya 5MB\'dan kucuk olmali' }, { status: 400 })

  const ext = file.name.split('.').pop() || 'png'
  const storagePath = `brand-mascots/${clientId}/icons/${style}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabase.storage.from('videos').upload(storagePath, buffer, { contentType: file.type, upsert: true })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: urlData } = supabase.storage.from('videos').getPublicUrl(storagePath)
  const iconUrl = urlData.publicUrl + '?t=' + Date.now()

  const field = style === 'mascot_only' ? 'mascot_only_icon_url' : 'mascot_hybrid_icon_url'
  await supabase.from('clients').update({ [field]: iconUrl }).eq('id', clientId)

  return NextResponse.json({ icon_url: iconUrl, style })
}
