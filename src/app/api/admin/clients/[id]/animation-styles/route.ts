import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Get all non-mascot styles + assigned style IDs for this brand
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params

  const [{ data: allStyles }, { data: assigned }] = await Promise.all([
    supabase.from('animation_styles').select('id, slug, label, icon_path, active').eq('requires_mascot_image', false).eq('active', true).order('sort_order'),
    supabase.from('brand_animation_styles').select('style_id').eq('client_id', clientId),
  ])

  return NextResponse.json({
    allStyles: allStyles || [],
    assignedStyleIds: (assigned || []).map((a: any) => a.style_id),
  })
}

// Update assigned styles (delete-then-insert, max 8)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const { styleIds } = await req.json()

  if (!Array.isArray(styleIds) || styleIds.length > 8) return NextResponse.json({ error: 'En fazla 8 stil seçilebilir' }, { status: 400 })

  // Delete existing
  await supabase.from('brand_animation_styles').delete().eq('client_id', clientId)

  // Insert new
  if (styleIds.length > 0) {
    const rows = styleIds.map((sid: string, i: number) => ({ client_id: clientId, style_id: sid, sort_order: i }))
    const { error } = await supabase.from('brand_animation_styles').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
