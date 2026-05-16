import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { brief_id, client_user_id } = await req.json()
    if (!brief_id || !client_user_id) return NextResponse.json({ error: 'brief_id ve client_user_id gerekli' }, { status: 400 })

    const { data: brief } = await supabase.from('briefs').select('id, client_id, campaign_name, format, message, target_audience, express_engine, premium_status').eq('id', brief_id).single()
    if (!brief) return NextResponse.json({ error: 'Brief bulunamadi' }, { status: 404 })

    // Set brief to premium mode and queue for worker
    await supabase.from('briefs').update({
      express_engine: 'premium',
      premium_status: 'pending',
      status: 'ai_processing',
    }).eq('id', brief_id)

    return NextResponse.json({ success: true, brief_id, message: 'Premium pipeline started — 3 versions will be generated' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
