import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const updates: any = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.mood !== undefined) updates.mood = Array.isArray(body.mood) && body.mood.length > 0 ? body.mood : null
  if (body.client_id !== undefined) updates.client_id = body.client_id || null
  if (body.is_active !== undefined) updates.is_active = body.is_active

  const { error } = await supabase.from('music_library').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: record } = await supabase.from('music_library').select('storage_path').eq('id', id).single()
  if (record?.storage_path) {
    await supabase.storage.from('music-library').remove([record.storage_path])
  }

  const { error } = await supabase.from('music_library').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
