import { NextResponse } from 'next/server'
import { getActiveBrandRules, buildBrandRulesBlock } from '@/lib/brand-learning'

export async function POST(request: Request) {
  const { campaign_name, brand_name, message, target_audience, video_type, format, cta, idea_title, idea_concept, idea_approach, clientId } = await request.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

  const rules = clientId ? await getActiveBrandRules(clientId) : []
  const rulesBlock = buildBrandRulesBlock(rules)

  const prompt = `${rulesBlock}Sen profesyonel bir video senaryo yazarisin. Asagidaki brief ve secilen fikir icin detayli bir video senaryosu yaz.

Brief:
- Kampanya: ${campaign_name || ''}
- Marka: ${brand_name || ''}
- Mesaj: ${message || ''}
- Hedef Kitle: ${target_audience || ''}
- Video Tipi: ${video_type || ''}
- Format: ${format || ''}
- CTA: ${cta || 'Yok'}

${idea_title ? `Secilen Fikir: ${idea_title}
Konsept: ${idea_concept || ''}
Yaklasim: ${idea_approach || ''}` : ''}

Sahne sahne yaz (Sahne 1, Sahne 2...). Her sahne icin:
- Gorsel aciklama (ne gosterilecek)
- Seslendirme/metin (varsa)
- Sure tahmini (saniye)
- Kamera/gecis notu

Turkce yaz, profesyonel ama anlasilir bir dilde.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `AI hata (${res.status})` }, { status: res.status })
    }

    const data = await res.json()
    const text = data.content?.[0]?.text || ''

    return NextResponse.json({ scenario: text })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Beklenmeyen hata' }, { status: 500 })
  }
}
