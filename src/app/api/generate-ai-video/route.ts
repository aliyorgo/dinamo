import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { briefId } = await request.json()
    if (!briefId) return NextResponse.json({ error: 'briefId gerekli' }, { status: 400 })

    const { data: brief } = await supabase.from('briefs').select('id').eq('id', briefId).single()
    if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

    // Mark for worker pickup — Railway worker will process it
    await supabase.from('briefs').update({
      ai_video_status: 'processing_concept',
      status: 'ai_processing',
    }).eq('id', briefId)

    return NextResponse.json({ ok: true, briefId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
