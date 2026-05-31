import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { videoId, engine, newCtaText } = await req.json()
    if (!videoId || !engine || !newCtaText?.trim()) return NextResponse.json({ error: 'videoId, engine, newCtaText gerekli' }, { status: 400 })
    if (newCtaText.length > 200) return NextResponse.json({ error: 'CTA çok uzun (max 200)' }, { status: 400 })

    if (engine === 'express') {
      const { data: brief } = await supabase.from('briefs').select('id, pre_cta_video_url, ai_video_status').eq('id', videoId).single()
      if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })
      if (!brief.pre_cta_video_url) return NextResponse.json({ error: 'Revize için hazırlanmamış' }, { status: 400 })
      if (brief.ai_video_status === 'revising' || brief.ai_video_status === 'revising_claimed') return NextResponse.json({ error: 'Zaten işleniyor' }, { status: 409 })
      await supabase.from('briefs').update({ cta_text: newCtaText.trim(), ai_video_status: 'revising', ai_video_error: null }).eq('id', videoId)
    } else if (engine === 'persona') {
      const { data: video } = await supabase.from('ugc_videos').select('id, pre_cta_video_url, status').eq('id', videoId).single()
      if (!video) return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })
      if (!video.pre_cta_video_url) return NextResponse.json({ error: 'Revize için hazırlanmamış' }, { status: 400 })
      if (video.status === 'revising' || video.status === 'revising_claimed') return NextResponse.json({ error: 'Zaten işleniyor' }, { status: 409 })
      await supabase.from('ugc_videos').update({ cta_text: newCtaText.trim(), status: 'revising' }).eq('id', videoId)
    } else if (engine === 'animation') {
      const { data: video } = await supabase.from('animation_videos').select('id, pre_cta_video_url, status').eq('id', videoId).single()
      if (!video) return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })
      if (!video.pre_cta_video_url) return NextResponse.json({ error: 'Revize için hazırlanmamış' }, { status: 400 })
      if (video.status === 'revising' || video.status === 'revising_claimed') return NextResponse.json({ error: 'Zaten işleniyor' }, { status: 409 })
      await supabase.from('animation_videos').update({ cta_text: newCtaText.trim(), status: 'revising' }).eq('id', videoId)
    } else {
      return NextResponse.json({ error: 'Geçersiz engine' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[cta/revise] Error:', err.message)
    return NextResponse.json({ error: err.message || 'Bilinmeyen hata' }, { status: 500 })
  }
}
