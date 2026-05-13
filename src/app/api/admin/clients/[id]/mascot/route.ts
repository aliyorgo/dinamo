import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Upload mascot image
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file gerekli' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Dosya 10MB\'dan küçük olmalı' }, { status: 400 })

  const ext = file.name.split('.').pop() || 'png'
  const storagePath = `brand-mascots/${clientId}/${Date.now()}_mascot.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabase.storage.from('videos').upload(storagePath, buffer, { contentType: file.type, upsert: true })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: urlData } = supabase.storage.from('videos').getPublicUrl(storagePath)
  await supabase.from('clients').update({ mascot_image_url: urlData.publicUrl }).eq('id', clientId)

  return NextResponse.json({ mascot_image_url: urlData.publicUrl })
}

// Update mascot fields (toggle, name, description)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const { mascot_enabled, mascot_name, mascot_description } = await req.json()

  const updates: any = {}
  if (mascot_enabled !== undefined) updates.mascot_enabled = mascot_enabled
  if (mascot_name !== undefined) updates.mascot_name = mascot_name
  if (mascot_description !== undefined) updates.mascot_description = mascot_description

  const { error } = await supabase.from('clients').update(updates).eq('id', clientId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
