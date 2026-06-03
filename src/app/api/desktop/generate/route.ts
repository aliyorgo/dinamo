import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { briefId } = await req.json()
    if (!briefId) return NextResponse.json({ error: 'briefId gerekli' }, { status: 400 })

    const { data: brief } = await supabase.from('briefs').select('id, client_id').eq('id', briefId).single()
    if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

    const { data: row, error } = await supabase.from('desktop_videos').insert({
      brief_id: briefId,
      status: 'queued',
    }).select('id').single()

    if (error) {
      console.error('[desktop-generate] Insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[desktop-generate] Created:', row.id)
    return NextResponse.json({ ok: true, video_id: row.id })
  } catch (err: any) {
    console.error('[desktop-generate] FATAL:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
