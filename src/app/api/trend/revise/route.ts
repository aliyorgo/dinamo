import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const TREND_ENGINES = ['trend', 'trend_cinema', 'trend_oops', 'trend_dans', 'trend_gokten']

export async function POST(req: NextRequest) {
  try {
    const { briefId, newCtaText } = await req.json()
    if (!briefId || !newCtaText?.trim()) return NextResponse.json({ error: 'briefId ve newCtaText gerekli' }, { status: 400 })
    if (newCtaText.length > 200) return NextResponse.json({ error: 'CTA çok uzun (max 200)' }, { status: 400 })

    const { data: brief } = await supabase.from('briefs').select('id, express_engine, kling_video_url, ai_video_status').eq('id', briefId).single()
    if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })
    if (!TREND_ENGINES.includes(brief.express_engine)) return NextResponse.json({ error: 'Bu brief trend değil' }, { status: 400 })
    if (!brief.kling_video_url) return NextResponse.json({ error: 'Bu brief revize için hazırlanmamış' }, { status: 400 })
    if (brief.ai_video_status === 'revising' || brief.ai_video_status === 'revising_claimed' || brief.ai_video_status === 'processing_concept' || brief.ai_video_status === 'processing_claimed') {
      return NextResponse.json({ error: 'Bu brief zaten işleniyor' }, { status: 409 })
    }

    await supabase.from('briefs').update({
      cta_text: newCtaText.trim(),
      ai_video_status: 'revising',
      ai_video_error: null,
    }).eq('id', briefId)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[trend/revise] Error:', err.message)
    return NextResponse.json({ error: err.message || 'Bilinmeyen hata' }, { status: 500 })
  }
}
