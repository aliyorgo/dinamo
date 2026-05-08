import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { video_id, script } = await req.json()
  if (!video_id) return NextResponse.json({ error: 'video_id gerekli' }, { status: 400 })

  // Verify video exists and is failed
  const { data: video } = await supabase.from('ugc_videos').select('id, status').eq('id', video_id).single()
  if (!video) return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })
  if (video.status !== 'failed') return NextResponse.json({ error: 'Video failed durumda değil' }, { status: 400 })

  // Reset to queued — worker will re-pick
  const update: any = { status: 'queued', error_message: null, final_url: null }
  if (script) update.script = script

  const { error } = await supabase.from('ugc_videos').update(update).eq('id', video_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
