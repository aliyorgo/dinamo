import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCreditCost } from '@/lib/credits-server'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { brief_id, style_slug, client_user_id } = await req.json()
    if (!brief_id || !style_slug || !client_user_id) return NextResponse.json({ error: 'brief_id, style_slug, client_user_id gerekli' }, { status: 400 })

    // Verify style exists and is active
    const { data: style } = await supabase.from('animation_styles').select('slug, label').eq('slug', style_slug).eq('active', true).single()
    if (!style) return NextResponse.json({ error: 'Stil bulunamadı veya pasif' }, { status: 404 })

    // Get brief
    const { data: brief } = await supabase.from('briefs').select('id, client_id').eq('id', brief_id).single()
    if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

    // Count existing animation videos for this brief (failed hariç) — BRIEF bazında ilk üretim bedava
    const { count: existingCount } = await supabase.from('animation_videos').select('id', { count: 'exact', head: true }).eq('brief_id', brief_id).neq('status', 'failed')
    const creditCost = (existingCount || 0) === 0 ? 0 : await getCreditCost('credit_ai_animation_generate', 1)

    // Credit check & deduct
    if (creditCost > 0) {
      const { data: cu } = await supabase.from('client_users').select('allocated_credits').eq('id', client_user_id).single()
      if (!cu || cu.allocated_credits < creditCost) return NextResponse.json({ error: 'Yetersiz kredi' }, { status: 402 })
      await supabase.from('client_users').update({ allocated_credits: cu.allocated_credits - creditCost }).eq('id', client_user_id)
      await supabase.from('credit_transactions').insert({ client_id: brief.client_id, client_user_id, brief_id, amount: -creditCost, type: 'deduct', description: creditCost === 0 ? 'AI Animation üretim (ücretsiz)' : 'AI Animation üretim' })
    }

    // Calculate next version for this brief+style
    const { count: styleCount } = await supabase.from('animation_videos').select('id', { count: 'exact', head: true }).eq('brief_id', brief_id).eq('style_slug', style_slug)
    const nextVersion = (styleCount || 0) + 1

    // Single INSERT — tek video üretim (Persona pattern)
    const { data: vid, error: insErr } = await supabase.from('animation_videos').insert({
      brief_id,
      style_slug,
      version: nextVersion,
      status: 'queued',
      credit_cost_generate: creditCost,
    }).select('id').single()
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    // Update brief
    await supabase.from('briefs').update({ last_animation_style: style_slug, animation_status: 'queued' }).eq('id', brief_id)

    return NextResponse.json({ animation_video_id: vid.id, credit_charged: creditCost, is_first: (existingCount || 0) === 0, version: nextVersion })
  } catch (err: any) {
    console.error('[animation/generate] Error:', err.message)
    return NextResponse.json({ error: err.message || 'Bilinmeyen hata' }, { status: 500 })
  }
}
