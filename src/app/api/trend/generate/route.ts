import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCreditCost } from '@/lib/credits-server'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
  const { brief_id, client_user_id, cinema_mode, format_type } = await req.json()
  if (!brief_id || !client_user_id) return NextResponse.json({ error: 'brief_id ve client_user_id gerekli' }, { status: 400 })

  const { data: brief } = await supabase.from('briefs').select('id, client_id, root_campaign_id, campaign_name, format, video_type, product_image_url, message, voiceover_text, voiceover_type, voiceover_gender, cta, target_audience, platforms, notes, languages, selected_ai_idea').eq('id', brief_id).single()
  if (!brief) return NextResponse.json({ error: 'Brief bulunamadi' }, { status: 404 })

  const rootId = brief.root_campaign_id || brief_id

  // Count Trend children for credit calc
  const { count: completedCount } = await supabase.from('briefs').select('id', { count: 'exact', head: true }).eq('root_campaign_id', rootId).in('express_engine', ['trend', 'trend_cinema', 'trend_oops']).not('ai_video_status', 'in', '("failed","timeout")').not('ai_video_status', 'is', null)
  const cc = completedCount || 0
  const creditCost = cc === 0 ? 0 : await getCreditCost('credit_ai_express_generate', 1)

  if (creditCost > 0) {
    const { data: cu } = await supabase.from('client_users').select('allocated_credits').eq('id', client_user_id).single()
    if (!cu || cu.allocated_credits < creditCost) return NextResponse.json({ error: 'Yetersiz kredi' }, { status: 402 })
    await supabase.from('client_users').update({ allocated_credits: cu.allocated_credits - creditCost }).eq('id', client_user_id)
    await supabase.from('credit_transactions').insert({ client_id: brief.client_id, client_user_id, brief_id, amount: -creditCost, type: 'deduct', description: 'AI Trend uretim' })
  }

  // Count existing Trend children for naming
  const { count: existingCount } = await supabase.from('briefs').select('id', { count: 'exact', head: true }).eq('root_campaign_id', rootId).in('express_engine', ['trend', 'trend_cinema', 'trend_oops'])
  const trendNum = (existingCount || 0) + 1
  const baseName = brief.campaign_name?.replace(/\s*—\s*Trend #\d+$/, '').replace(/\s*—\s*Full AI #\d+$/, '').replace(/\s*—\s*\d+$/, '') || brief.campaign_name

  const { data: newBrief, error: insErr } = await supabase.from('briefs').insert({
    campaign_name: `${baseName} — Trend #${trendNum}`,
    parent_brief_id: brief_id,
    root_campaign_id: rootId,
    client_id: brief.client_id,
    client_user_id,
    brief_type: 'express_clone',
    express_engine: format_type === 'amandikkat' ? 'trend_oops' : cinema_mode ? 'trend_cinema' : 'trend',
    format: cinema_mode ? '16:9' : '9:16',
    message: brief.message || '',
    voiceover_text: brief.voiceover_text,
    voiceover_gender: brief.voiceover_gender,
    cta: brief.cta,
    target_audience: brief.target_audience,
    platforms: brief.platforms,
    video_type: brief.video_type,
    voiceover_type: brief.voiceover_type,
    notes: brief.notes,
    languages: brief.languages,
    product_image_url: brief.product_image_url,
    pipeline_type: 'character',
    status: 'ai_processing',
    ai_video_status: 'processing_concept',
    credit_cost: creditCost,
  }).select('id, campaign_name, status, format, ai_video_status, ai_video_url, created_at, express_engine').single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  return NextResponse.json({ success: true, child_brief: newBrief, credit_charged: creditCost, completed_count: cc })
  } catch (err: any) {
    console.error('[trend/generate] Error:', err.message, err.stack?.slice(0, 300))
    return NextResponse.json({ error: err.message || 'Bilinmeyen hata' }, { status: 500 })
  }
}
