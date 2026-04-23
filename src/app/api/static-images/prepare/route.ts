import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getActiveBrandRules, buildBrandRulesBlock } from '@/lib/brand-learning'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

export async function POST(req: NextRequest) {
  try {
    const { briefId, videoUrl } = await req.json()
    if (!briefId) return NextResponse.json({ error: 'briefId gerekli' }, { status: 400 })

    // Generate copy via Anthropic (lightweight, stays on Vercel)
    const { data: brief } = await supabase.from('briefs').select('campaign_name, message, target_audience, client_id, clients(brand_tone)').eq('id', briefId).single()
    let copy = ''
    try {
      const rules = brief?.client_id ? await getActiveBrandRules(brief.client_id) : []
      const rulesBlock = buildBrandRulesBlock(rules)
      const ctx = [
        rulesBlock,
        brief?.campaign_name && `Kampanya: ${brief.campaign_name}`,
        brief?.message && `Brief: ${brief.message.substring(0, 200)}`,
        brief?.target_audience && `Hedef kitle: ${brief.target_audience}`,
        (brief?.clients as any)?.brand_tone && `Marka tonu: ${(brief?.clients as any).brand_tone}`,
      ].filter(Boolean).join('\n')

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 60,
          system: `Türkçe reklam görseli için kısa, çarpıcı ad copy üret.\nKURALLAR:\n- EN FAZLA 40 karakter. 40 karakteri ASLA aşma.\n- Kelime ortasında kesme, tamamlanmış cümle veya ifade olsun.\n- Brief'teki ürün veya kampanya özelliklerini kullan, generic olma.\n- Sentence case kullan.\n- Tırnak işareti KULLANMA.\n- Sadece copy metnini döndür.`,
          messages: [{ role: 'user', content: ctx || 'Marka reklam görseli copy yaz' }],
        }),
      })
      const data = await res.json()
      copy = (data.content?.[0]?.text || '').trim().substring(0, 40)
    } catch {}

    // Queue job for Railway worker
    await supabase.from('briefs').update({
      static_images_job_status: 'pending',
      static_images_job_payload: { action: 'prepare', videoUrl, copy },
      static_images_error: null,
    }).eq('id', briefId)

    return NextResponse.json({ status: 'queued', copy })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
