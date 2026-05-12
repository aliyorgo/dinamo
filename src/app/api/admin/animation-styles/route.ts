import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const { data, error } = await supabase.from('animation_styles').select('*').order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { slug, label, prompt_template, mood_hints, model, task_type, sort_order, requires_mascot_image, active, icon_path } = body
  if (!slug || !label) return NextResponse.json({ error: 'slug ve label zorunlu' }, { status: 400 })

  const moodArr = typeof mood_hints === 'string' ? mood_hints.split(',').map((s: string) => s.trim()).filter(Boolean) : (mood_hints || [])

  const { data, error } = await supabase.from('animation_styles').insert({
    slug, label, prompt_template: prompt_template || '', mood_hints: moodArr,
    model: model || 'seedance', task_type: task_type || 'seedance-2-fast-preview',
    sort_order: sort_order || 0, requires_mascot_image: requires_mascot_image || false,
    active: active !== false, icon_path: icon_path || null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
