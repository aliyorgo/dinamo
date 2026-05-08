import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { brief_id, video_id, locked } = await req.json()
  if (!brief_id || !video_id) return NextResponse.json({ error: 'brief_id ve video_id gerekli' }, { status: 400 })

  if (locked) {
    // Get video's used_appearance
    const { data: video } = await supabase.from('ugc_videos').select('id, persona_id, used_appearance, version').eq('id', video_id).single()
    if (!video) return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })

    // Compute appearance from hash if used_appearance is null
    let appearance = video.used_appearance
    if (!appearance) {
      const { data: persona } = await supabase.from('personas').select('appearance_variations, gender').eq('id', video.persona_id).single()
      const vars = persona?.appearance_variations || {}
      if (vars.hair) {
        const seed = `${brief_id}_${video.persona_id}_${video.version || 1}`
        let h = 0; for (let i = 0; i < seed.length; i++) { h = ((h << 5) - h) + seed.charCodeAt(i); h |= 0 }; h = Math.abs(h)
        appearance = {
          hair: vars.hair?.[(h + 0) % vars.hair.length] || null,
          skin: vars.skin?.[(h + 1) % vars.skin.length] || null,
          beard: persona?.gender === 'male' ? (vars.beard?.[(h + 3) % vars.beard.length] || null) : null,
        }
      }
    }

    // Update brief with anchor + appearance lock
    const { data: brief } = await supabase.from('briefs').select('locked_persona_appearance').eq('id', brief_id).single()
    const lpa = brief?.locked_persona_appearance || {}
    lpa[String(video.persona_id)] = appearance

    await supabase.from('briefs').update({
      locked_anchor_video_id: video_id,
      locked_anchor_persona_id: video.persona_id,
      locked_persona_appearance: lpa,
    }).eq('id', brief_id)

    return NextResponse.json({ success: true })
  } else {
    // Unlock — clear anchor + remove persona appearance
    const { data: briefData } = await supabase.from('briefs').select('locked_anchor_video_id, locked_anchor_persona_id, locked_persona_appearance').eq('id', brief_id).single()
    if (briefData && briefData.locked_anchor_video_id === video_id) {
      const lpa = briefData.locked_persona_appearance || {}
      if (briefData.locked_anchor_persona_id) delete lpa[String(briefData.locked_anchor_persona_id)]
      await supabase.from('briefs').update({
        locked_anchor_video_id: null,
        locked_anchor_persona_id: null,
        locked_persona_appearance: lpa,
      }).eq('id', brief_id)
    }
    return NextResponse.json({ success: true })
  }
}
