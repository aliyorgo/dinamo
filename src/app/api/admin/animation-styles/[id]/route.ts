import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const updates: any = { updated_at: new Date().toISOString() }
  if (body.label !== undefined) updates.label = body.label
  if (body.prompt_template !== undefined) updates.prompt_template = body.prompt_template
  if (body.mood_hints !== undefined) updates.mood_hints = typeof body.mood_hints === 'string' ? body.mood_hints.split(',').map((s: string) => s.trim()).filter(Boolean) : body.mood_hints
  if (body.model !== undefined) updates.model = body.model
  if (body.task_type !== undefined) updates.task_type = body.task_type
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order
  if (body.requires_mascot_image !== undefined) updates.requires_mascot_image = body.requires_mascot_image
  if (body.active !== undefined) updates.active = body.active
  if (body.icon_path !== undefined) updates.icon_path = body.icon_path
  if (body.description_tr !== undefined) updates.description_tr = body.description_tr

  const { data, error } = await supabase.from('animation_styles').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabase.from('animation_styles').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
