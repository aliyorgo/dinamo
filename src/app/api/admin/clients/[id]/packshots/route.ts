import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const aspectRatio = formData.get('aspect_ratio') as string | null
  if (!file || !aspectRatio) return NextResponse.json({ error: 'file ve aspect_ratio gerekli' }, { status: 400 })
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Dosya 20MB\'dan küçük olmalı' }, { status: 400 })

  const ext = file.name.split('.').pop() || 'png'
  const storagePath = `${clientId}/packshot_${aspectRatio.replace(':', 'x')}_${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabase.storage.from('brand-packshots').upload(storagePath, buffer, { contentType: file.type, upsert: true })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: urlData } = supabase.storage.from('brand-packshots').getPublicUrl(storagePath)
  const url = urlData.publicUrl

  // Update packshots JSONB
  const { data: client } = await supabase.from('clients').select('packshots').eq('id', clientId).single()
  const packshots = client?.packshots || {}
  const key = aspectRatio.replace(':', 'x')
  packshots[key] = url

  await supabase.from('clients').update({ packshots }).eq('id', clientId)

  return NextResponse.json({ url, aspect: key })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const { aspect_ratio } = await req.json()
  if (!aspect_ratio) return NextResponse.json({ error: 'aspect_ratio gerekli' }, { status: 400 })

  const { data: client } = await supabase.from('clients').select('packshots').eq('id', clientId).single()
  const packshots = client?.packshots || {}
  const key = aspect_ratio.replace(':', 'x')
  delete packshots[key]

  await supabase.from('clients').update({ packshots }).eq('id', clientId)
  return NextResponse.json({ success: true })
}
