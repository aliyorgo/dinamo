import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const { brand_overlay_settings } = await req.json()
  if (!brand_overlay_settings || typeof brand_overlay_settings !== 'object') {
    return NextResponse.json({ error: 'brand_overlay_settings object required' }, { status: 400 })
  }
  const { error } = await supabase.from('clients').update({ brand_overlay_settings }).eq('id', clientId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
