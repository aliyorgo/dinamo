import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { brief_id, persona_id, use_product, script, settings } = await req.json()
  if (!brief_id || !persona_id || !script) return NextResponse.json({ error: 'brief_id, persona_id, script gerekli' }, { status: 400 })

  const { data: brief } = await supabase.from('briefs').select('id, client_id, client_user_id, product_image_url').eq('id', brief_id).single()
  if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

  // Deduct 1 credit for generation
  const { data: cu } = await supabase.from('client_users').select('allocated_credits').eq('id', brief.client_user_id).single()
  if (!cu || cu.allocated_credits < 1) return NextResponse.json({ error: 'Yetersiz kredi' }, { status: 402 })

  await supabase.from('client_users').update({ allocated_credits: cu.allocated_credits - 1 }).eq('id', brief.client_user_id)
  await supabase.from('credit_transactions').insert({ client_id: brief.client_id, client_user_id: brief.client_user_id, brief_id, amount: -1, type: 'deduct', description: 'AI UGC üretim' })

  // Create ugc_videos record
  // TODO: Pipeline aşamasında settings.watermark=true ise ffmpeg overlay eklenecek
  // TODO: settings.music=false ise Veo prompt'a "no music" eklenir
  // TODO: settings.speed Veo prompt'a "speaks at X pace" olarak eklenir
  const { data: ugcVideo, error: insErr } = await supabase.from('ugc_videos').insert({
    brief_id,
    persona_id,
    script,
    product_image_used: use_product && !!brief.product_image_url,
    status: 'queued',
  }).select('id').single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // Update brief
  await supabase.from('briefs').update({ ugc_persona_id: persona_id, ugc_status: 'queued', ugc_video_id: ugcVideo.id }).eq('id', brief_id)

  return NextResponse.json({ ugc_video_id: ugcVideo.id, status: 'queued' })
}
