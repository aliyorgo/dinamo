import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getActiveBrandRules, buildBrandRulesBlock } from '@/lib/brand-learning'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { briefId, packageSize } = await request.json()
    if (!briefId || !packageSize) return NextResponse.json({ error: 'briefId ve packageSize gerekli' }, { status: 400 })

    const { data: brief } = await supabase.from('briefs').select('campaign_name, message, video_type, target_audience, cta, voiceover_text, client_id').eq('id', briefId).single()
    if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

    const rules = brief.client_id ? await getActiveBrandRules(brief.client_id) : []
    const rulesBlock = buildBrandRulesBlock(rules)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: `Sen bir yaratıcı reklam stratejistisin. Brief'ten farklı yaratıcı varyasyonlar üretiyorsun.

Her varyasyon birbirinden FARKLI olmalı — farklı hook, ton, tempo kombinasyonları.
Hedef kitleyi farklı açılardan yakalamayı deneyen tamamlayıcı varyasyonlar oluştur.

Hook seçenekleri: "Direkt ürün", "Problem-ihtiyaç", "Hikaye", "Dikkat çekici açılış", "Faydadan başla"
Hero seçenekleri: "Erkek", "Kadın", "Yok"
Ton seçenekleri: "Enerjik", "Kurumsal", "Duygusal", "Eğlenceli", "Premium"
Tempo seçenekleri: "Hızlı", "Orta", "Yavaş"
CTA seçenekleri: "Satın al", "Keşfet", "Daha fazla bilgi al", "Başvur", "İncele"

Sadece JSON array dön, başka hiçbir şey yazma.`,
        messages: [{
          role: 'user',
          content: `${rulesBlock}Brief: ${brief.message || brief.campaign_name}
Kampanya: ${brief.campaign_name}
Video tipi: ${brief.video_type}
Hedef kitle: ${brief.target_audience || 'Belirtilmemiş'}
CTA: ${brief.cta || 'Belirtilmemiş'}

${packageSize} farklı yaratıcı varyasyon üret. JSON formatında:
[{"hook":"...","hero":"...","ton":"...","tempo":"...","cta":"..."}]`
        }]
      })
    })

    const data = await res.json()
    const text = data.content?.[0]?.text || '[]'
    const clean = text.replace(/```json|```/g, '').trim()
    const variations = JSON.parse(clean)

    return NextResponse.json({ variations })
  } catch (err: any) {
    console.error('[cps-generate] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
