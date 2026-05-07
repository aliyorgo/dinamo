import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCreditCost } from '@/lib/credits-server'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { ugc_video_id } = await req.json()
  if (!ugc_video_id) return NextResponse.json({ error: 'ugc_video_id gerekli' }, { status: 400 })

  // Get video
  const { data: video } = await supabase.from('ugc_videos').select('*, briefs(client_id, client_user_id)').eq('id', ugc_video_id).single()
  if (!video) return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })
  if (video.status !== 'ready') return NextResponse.json({ error: 'Video henüz hazır değil' }, { status: 400 })

  const clientUserId = video.briefs?.client_user_id
  const clientId = video.briefs?.client_id
  if (!clientUserId) return NextResponse.json({ error: 'Müşteri bilgisi bulunamadı' }, { status: 400 })

  // Credit check
  const cost = await getCreditCost('credit_ai_ugc', 1)
  const { data: cu } = await supabase.from('client_users').select('allocated_credits').eq('id', clientUserId).single()
  if (!cu || cu.allocated_credits < cost) return NextResponse.json({ error: 'Yetersiz kredi' }, { status: 402 })

  // Deduct credit
  await supabase.from('client_users').update({ allocated_credits: cu.allocated_credits - cost }).eq('id', clientUserId)
  await supabase.from('credit_transactions').insert({
    client_id: clientId,
    client_user_id: clientUserId,
    brief_id: video.brief_id,
    amount: -cost,
    type: 'deduct',
    description: 'AI Persona satın alma',
  })

  // Update video status
  await supabase.from('ugc_videos').update({ status: 'sold', sold_at: new Date().toISOString() }).eq('id', ugc_video_id)

  return NextResponse.json({ download_url: video.final_url, status: 'sold' })
}
