import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  try {
    const brief_id = req.nextUrl.searchParams.get('brief_id')
    if (!brief_id) return NextResponse.json({ error: 'brief_id gerekli' }, { status: 400 })

    const { data: brief } = await supabase.from('briefs').select('id, premium_status, premium_video_url, premium_selected_version_id').eq('id', brief_id).single()
    if (!brief) return NextResponse.json({ error: 'Brief bulunamadi' }, { status: 404 })

    // If shots in progress, get shot status
    let shots = null
    if (brief.premium_status === 'shots_in_progress' && brief.premium_selected_version_id) {
      const { data: shotData } = await supabase
        .from('premium_shots')
        .select('shot_number, status, first_frame_url, video_url')
        .eq('version_id', brief.premium_selected_version_id)
        .order('shot_number', { ascending: true })
      shots = shotData
    }

    return NextResponse.json({
      premium_status: brief.premium_status,
      premium_video_url: brief.premium_video_url,
      shots,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
