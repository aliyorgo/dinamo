import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // Slug unique check if changing
  if (body.slug) {
    const { data: existing } = await supabase.from('personas').select('id').eq('slug', body.slug).neq('id', Number(id)).maybeSingle()
    if (existing) return NextResponse.json({ error: 'Bu slug zaten kullanılıyor' }, { status: 409 })
  }

  // Parse product_compatibility if string
  if (typeof body.product_compatibility === 'string') {
    body.product_compatibility = body.product_compatibility.split(',').map((s: string) => s.trim()).filter(Boolean)
  }

  // Parse appearance_variations if string
  if (typeof body.appearance_variations === 'string') {
    try { body.appearance_variations = JSON.parse(body.appearance_variations) } catch { return NextResponse.json({ error: 'Geçersiz JSON formatı' }, { status: 400 }) }
  }

  const { data, error } = await supabase.from('personas').update(body).eq('id', Number(id)).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Check active usage
  const { count } = await supabase.from('ugc_videos').select('id', { count: 'exact', head: true }).eq('persona_id', Number(id)).in('status', ['queued', 'generating'])
  if (count && count > 0) {
    return NextResponse.json({ error: `${count} aktif üretimde kullanılıyor, önce tamamlanmasını bekleyin` }, { status: 409 })
  }

  const { error } = await supabase.from('personas').delete().eq('id', Number(id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
