import { NextResponse } from 'next/server'
import { getActiveBrandRules, buildBrandRulesBlock } from '@/lib/brand-learning'

export async function POST(request: Request) {
  try {
    const { campaign_name, message, cta, target_audience, brand_name, clientId } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

    const rules = clientId ? await getActiveBrandRules(clientId) : []
    const rulesBlock = buildBrandRulesBlock(rules)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 250,
        system: 'Sen profesyonel bir sosyal medya icerik yazarisin. Sadece caption metnini dondur, baska hicbir sey yazma.',
        messages: [{
          role: 'user',
          content: `${rulesBlock}Asagidaki reklam kampanyasi icin TikTok ve Instagram'da kullanilabilecek tek bir caption yaz.

Marka: ${brand_name || ''}
Kampanya: ${campaign_name || ''}
Mesaj: ${message || ''}
CTA: ${cta || ''}
Hedef kitle: ${target_audience || ''}

Kurallar:
- 100-200 karakter civarinda optimal uzunluk
- Emoji kullanma
- Sonuna 3-5 ilgili hashtag ekle
- Turkce yaz, kurumsal ama samimi ton
- Kisa ve dikkat cekici olsun
- Sadece caption metnini yaz, tirnak kullanma, aciklama ekleme`
        }]
      })
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `AI hata (${res.status})` }, { status: res.status })
    }

    const data = await res.json()
    const caption = (data.content?.[0]?.text || '').trim().replace(/^["']|["']$/g, '')

    return NextResponse.json({ caption })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
