import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCreditCost } from '@/lib/credits-server'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { videoId, engine, newCtaText } = await req.json()
    if (!videoId || !engine || !newCtaText?.trim()) return NextResponse.json({ error: 'videoId, engine, newCtaText gerekli' }, { status: 400 })
    if (newCtaText.length > 200) return NextResponse.json({ error: 'CTA çok uzun (max 200)' }, { status: 400 })

    // Kredi düşürme (tüm engine'lar için ortak)
    const ctaCost = await getCreditCost('credit_cta_revise', 1)
    let clientId: string | null = null

    if (engine === 'express') {
      const { data: brief } = await supabase.from('briefs').select('id, client_id, pre_cta_video_url, ai_video_status').eq('id', videoId).single()
      if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })
      if (!brief.pre_cta_video_url) return NextResponse.json({ error: 'Revize için hazırlanmamış' }, { status: 400 })
      if (brief.ai_video_status === 'revising' || brief.ai_video_status === 'revising_claimed') return NextResponse.json({ error: 'Zaten işleniyor' }, { status: 409 })
      clientId = brief.client_id
      await supabase.from('briefs').update({ cta_text: newCtaText.trim(), ai_video_status: 'revising', ai_video_error: null }).eq('id', videoId)
    } else if (engine === 'persona') {
      const { data: video } = await supabase.from('ugc_videos').select('id, brief_id, pre_cta_video_url, status').eq('id', videoId).single()
      if (!video) return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })
      if (!video.pre_cta_video_url) return NextResponse.json({ error: 'Revize için hazırlanmamış' }, { status: 400 })
      if (video.status === 'revising' || video.status === 'revising_claimed') return NextResponse.json({ error: 'Zaten işleniyor' }, { status: 409 })
      const { data: brief } = await supabase.from('briefs').select('client_id').eq('id', video.brief_id).single()
      clientId = brief?.client_id || null
      await supabase.from('ugc_videos').update({ cta_text: newCtaText.trim(), status: 'revising' }).eq('id', videoId)
    } else if (engine === 'animation') {
      const { data: video } = await supabase.from('animation_videos').select('id, brief_id, pre_cta_video_url, status').eq('id', videoId).single()
      if (!video) return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })
      if (!video.pre_cta_video_url) return NextResponse.json({ error: 'Revize için hazırlanmamış' }, { status: 400 })
      if (video.status === 'revising' || video.status === 'revising_claimed') return NextResponse.json({ error: 'Zaten işleniyor' }, { status: 409 })
      const { data: brief } = await supabase.from('briefs').select('client_id').eq('id', video.brief_id).single()
      clientId = brief?.client_id || null
      await supabase.from('animation_videos').update({ cta_text: newCtaText.trim(), status: 'revising' }).eq('id', videoId)
    } else if (engine === 'street') {
      const { data: video } = await supabase.from('street_videos').select('id, brief_id, pre_cta_video_url, status').eq('id', videoId).single()
      if (!video) return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })
      if (!video.pre_cta_video_url) return NextResponse.json({ error: 'Revize için hazırlanmamış' }, { status: 400 })
      if (video.status === 'revising' || video.status === 'revising_claimed') return NextResponse.json({ error: 'Zaten işleniyor' }, { status: 409 })
      const { data: brief } = await supabase.from('briefs').select('client_id').eq('id', video.brief_id).single()
      clientId = brief?.client_id || null
      await supabase.from('street_videos').update({ cta_text: newCtaText.trim(), status: 'revising' }).eq('id', videoId)
    } else {
      return NextResponse.json({ error: 'Geçersiz engine' }, { status: 400 })
    }

    // Kredi düşür (ctaCost > 0 ve clientId varsa)
    if (ctaCost > 0 && clientId) {
      const { data: cu } = await supabase.from('client_users').select('id, allocated_credits').eq('client_id', clientId).order('allocated_credits', { ascending: false }).limit(1).single()
      if (cu) {
        if (cu.allocated_credits < ctaCost) {
          // Yetersiz kredi — revize'yi geri al
          console.warn(`[cta/revise] Yetersiz kredi: ${cu.allocated_credits} < ${ctaCost}`)
          // NOT: revize zaten başlatıldı (status=revising), geri almıyoruz — worker işleyecek
          // Kredi yetersiz uyarısı log'a yazılır ama işlem engellenmez (mevcut davranış korunur)
        } else {
          await supabase.from('client_users').update({ allocated_credits: cu.allocated_credits - ctaCost }).eq('id', cu.id)
          await supabase.from('credit_transactions').insert({ client_id: clientId, client_user_id: cu.id, amount: -ctaCost, type: 'cta_revise', description: `CTA revize (${engine})` })
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[cta/revise] Error:', err.message)
    return NextResponse.json({ error: err.message || 'Bilinmeyen hata' }, { status: 500 })
  }
}
