import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const { data, error } = await supabase.from('brand_pronunciations').select('*').order('written')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { written, pronounced } = await req.json()
  if (!written || !pronounced) return NextResponse.json({ error: 'written ve pronounced zorunlu' }, { status: 400 })

  const { data, error } = await supabase.from('brand_pronunciations').insert({ written, pronounced, is_active: true }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { id, written, pronounced, is_active } = await req.json()
  if (!id) return NextResponse.json({ error: 'id zorunlu' }, { status: 400 })

  const updates: any = { updated_at: new Date().toISOString() }
  if (written !== undefined) updates.written = written
  if (pronounced !== undefined) updates.pronounced = pronounced
  if (is_active !== undefined) updates.is_active = is_active

  const { data, error } = await supabase.from('brand_pronunciations').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id zorunlu' }, { status: 400 })

  const { error } = await supabase.from('brand_pronunciations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
