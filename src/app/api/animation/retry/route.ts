import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { animation_video_id } = await req.json()
    if (!animation_video_id) return NextResponse.json({ error: 'animation_video_id gerekli' }, { status: 400 })

    const { data: vid } = await supabase.from('animation_videos').select('id, status').eq('id', animation_video_id).single()
    if (!vid) return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })
    if (vid.status !== 'failed') return NextResponse.json({ error: 'Sadece başarısız videolar tekrar denenebilir' }, { status: 400 })

    await supabase.from('animation_videos').update({ status: 'queued', error_message: null, final_url: null, raw_video_url: null, generating_started_at: null }).eq('id', animation_video_id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
