import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const gender = searchParams.get('gender')
  const isActive = searchParams.get('is_active')
  const isGlobal = searchParams.get('is_global')
  const search = searchParams.get('search')

  let query = supabase.from('personas').select('*').order('display_order', { ascending: true })
  if (gender) query = query.eq('gender', gender)
  if (isActive === 'true') query = query.eq('is_active', true)
  if (isActive === 'false') query = query.eq('is_active', false)
  if (isGlobal === 'true') query = query.eq('is_global', true)
  if (isGlobal === 'false') query = query.eq('is_global', false)
  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, slug, gender, age_range, description, tone_description, environment_prompt, thumbnail_url, product_compatibility, appearance_base, appearance_variations, is_active, is_global, display_order } = body

  if (!name || !slug || !gender || !age_range) {
    return NextResponse.json({ error: 'name, slug, gender, age_range zorunlu' }, { status: 400 })
  }

  // Slug unique check
  const { data: existing } = await supabase.from('personas').select('id').eq('slug', slug).maybeSingle()
  if (existing) return NextResponse.json({ error: 'Bu slug zaten kullanılıyor' }, { status: 409 })

  // Parse product_compatibility if string
  const compat = typeof product_compatibility === 'string'
    ? product_compatibility.split(',').map((s: string) => s.trim()).filter(Boolean)
    : product_compatibility || []

  // Validate appearance_variations JSON
  if (appearance_variations && typeof appearance_variations === 'string') {
    try { JSON.parse(appearance_variations) } catch { return NextResponse.json({ error: 'Geçersiz JSON formatı (appearance_variations)' }, { status: 400 }) }
  }

  const { data, error } = await supabase.from('personas').insert({
    name, slug, gender, age_range, description: description || '',
    tone_description: tone_description || '', environment_prompt: environment_prompt || '',
    thumbnail_url: thumbnail_url || null, product_compatibility: compat,
    appearance_base: appearance_base || '',
    appearance_variations: typeof appearance_variations === 'string' ? JSON.parse(appearance_variations) : (appearance_variations || {}),
    is_active: is_active !== false, is_global: is_global !== false,
    display_order: display_order || 0,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
