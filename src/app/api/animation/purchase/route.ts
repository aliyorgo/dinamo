import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCreditCost } from '@/lib/credits-server'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { animation_video_id } = await req.json()
    if (!animation_video_id) return NextResponse.json({ error: 'animation_video_id gerekli' }, { status: 400 })

    const { data: vid } = await supabase.from('animation_videos').select('id, brief_id, status, final_url').eq('id', animation_video_id).single()
    if (!vid) return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })
    if (vid.status !== 'ready') return NextResponse.json({ error: 'Video satın alınabilir durumda değil' }, { status: 400 })

    const { data: brief } = await supabase.from('briefs').select('client_id, client_user_id').eq('id', vid.brief_id).single()
    if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

    const creditCost = await getCreditCost('credit_ai_animation', 1)
    const { data: cu } = await supabase.from('client_users').select('allocated_credits').eq('id', brief.client_user_id).single()
    if (!cu || cu.allocated_credits < creditCost) return NextResponse.json({ error: 'Yetersiz kredi' }, { status: 402 })

    await supabase.from('client_users').update({ allocated_credits: cu.allocated_credits - creditCost }).eq('id', brief.client_user_id)
    await supabase.from('credit_transactions').insert({ client_id: brief.client_id, client_user_id: brief.client_user_id, brief_id: vid.brief_id, amount: -creditCost, type: 'deduct', description: 'AI Animation satın alma' })
    await supabase.from('animation_videos').update({ status: 'sold' }).eq('id', animation_video_id)

    return NextResponse.json({ status: 'sold', download_url: vid.final_url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
