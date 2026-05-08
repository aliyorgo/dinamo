import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCreditCost } from '@/lib/credits-server'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { brief_id, persona_id, use_product, script, settings, changes_summary } = await req.json()
  if (!brief_id || !persona_id || !script) return NextResponse.json({ error: 'brief_id, persona_id, script gerekli' }, { status: 400 })

  const { data: brief } = await supabase.from('briefs').select('id, client_id, client_user_id, product_image_url').eq('id', brief_id).single()
  if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

  // Check if first UGC for this brief (free) or subsequent (paid)
  const { count: existingCount } = await supabase.from('ugc_videos').select('id', { count: 'exact', head: true }).eq('brief_id', brief_id).neq('status', 'failed')
  const creditCost = (existingCount || 0) === 0 ? 0 : await getCreditCost('credit_ai_ugc_generate', 1)

  const { data: cu } = await supabase.from('client_users').select('allocated_credits').eq('id', brief.client_user_id).single()
  if (creditCost > 0) {
    if (!cu || cu.allocated_credits < creditCost) return NextResponse.json({ error: 'Yetersiz kredi' }, { status: 402 })
    await supabase.from('client_users').update({ allocated_credits: cu.allocated_credits - creditCost }).eq('id', brief.client_user_id)
    await supabase.from('credit_transactions').insert({ client_id: brief.client_id, client_user_id: brief.client_user_id, brief_id, amount: -creditCost, type: 'deduct', description: creditCost === 0 ? 'AI Persona üretim (ücretsiz)' : 'AI Persona üretim' })
  }

  // Calculate next version for this brief+persona
  const { count: existingVersions } = await supabase.from('ugc_videos').select('id', { count: 'exact', head: true }).eq('brief_id', brief_id).eq('persona_id', persona_id)
  const nextVersion = (existingVersions || 0) + 1

  // Create ugc_videos record
  const { data: ugcVideo, error: insErr } = await supabase.from('ugc_videos').insert({
    brief_id,
    persona_id,
    version: nextVersion,
    script,
    product_image_used: use_product && !!brief.product_image_url,
    status: 'queued',
    feedback_summary: changes_summary || null,
  }).select('id').single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // Update brief
  await supabase.from('briefs').update({ ugc_persona_id: persona_id, ugc_status: 'queued', ugc_video_id: ugcVideo.id }).eq('id', brief_id)

  return NextResponse.json({ ugc_video_id: ugcVideo.id, status: 'queued' })
}
