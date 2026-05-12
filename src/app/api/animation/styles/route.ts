import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('client_id')

  if (clientId) {
    // Brand-specific: assigned non-mascot styles + mascot styles if mascot enabled
    const [{ data: assigned }, { data: mascotStyles }, { data: client }] = await Promise.all([
      supabase.from('brand_animation_styles').select('animation_styles(slug, label, icon_path, mood_hints, requires_mascot_image, description_tr)').eq('client_id', clientId),
      supabase.from('animation_styles').select('slug, label, icon_path, mood_hints, requires_mascot_image, description_tr').eq('requires_mascot_image', true).eq('active', true).order('sort_order'),
      supabase.from('clients').select('mascot_enabled, mascot_image_url, mascot_only_icon_url, mascot_hybrid_icon_url').eq('id', clientId).single(),
    ])

    const brandStyles = (assigned || []).map((a: any) => a.animation_styles).filter(Boolean)
    const hasMascot = client?.mascot_enabled && client?.mascot_image_url
    const allStyles = hasMascot ? [...brandStyles, ...(mascotStyles || [])] : brandStyles

    return NextResponse.json({ styles: allStyles, hasMascot, mascotIcons: { mascot_only: client?.mascot_only_icon_url || null, mascot_hybrid: client?.mascot_hybrid_icon_url || null } })
  }

  // Fallback: all active styles
  const { data, error } = await supabase.from('animation_styles').select('slug, label, icon_path, mood_hints, requires_mascot_image, description_tr').eq('active', true).order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ styles: data || [], hasMascot: false })
}
