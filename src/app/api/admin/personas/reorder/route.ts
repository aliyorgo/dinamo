import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function PATCH(req: NextRequest) {
  const { updates } = await req.json()
  if (!Array.isArray(updates)) return NextResponse.json({ error: 'updates array gerekli' }, { status: 400 })

  for (const { id, display_order } of updates) {
    await supabase.from('personas').update({ display_order }).eq('id', id)
  }
  return NextResponse.json({ success: true })
}
