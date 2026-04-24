import { NextResponse } from 'next/server'
import { getActiveBrandRules, buildBrandRulesBlock } from '@/lib/brand-learning'

export async function POST(request: Request) {
  try {
    const { campaign_name, message, cta, target_audience, brand_name, clientId } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[captions] ANTHROPIC_API_KEY not set')
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    console.log('[captions] Generating for:', campaign_name)

    const rules = clientId ? await getActiveBrandRules(clientId) : []
    const rulesBlock = buildBrandRulesBlock(rules)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: 'Sen profesyonel bir sosyal medya icerik yazarisin. Yanitin SADECE gecerli bir JSON objesi olsun, baska hicbir sey yazma.',
        messages: [{
          role: 'user',
          content: `${rulesBlock}Asagidaki reklam kampanyasi icin sosyal medya basliklari yaz.

Marka: ${brand_name || ''}
Kampanya: ${campaign_name || ''}
Mesaj: ${message || ''}
CTA: ${cta || ''}
Hedef kitle: ${target_audience || ''}

Kurallar:
- 3 TikTok basligi ve 3 Instagram basligi yaz
- Emoji kullanma
- Her basligin sonuna 3-5 ilgili hashtag ekle
- Turkce yaz, kurumsal ama samimi ton
- Kisa ve dikkat cekici olsun

JSON formati:
{
  "tiktok": ["baslik 1", "baslik 2", "baslik 3"],
  "instagram": ["baslik 1", "baslik 2", "baslik 3"]
}`
        }]
      })
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[captions] Anthropic error:', res.status, err.substring(0, 300))
      return NextResponse.json({ error: `AI hata (${res.status})`, details: err.substring(0, 300) }, { status: res.status })
    }

    const data = await res.json()
    const raw = data.content?.[0]?.text || ''
    console.log('[captions] Raw response length:', raw.length)

    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()

    try {
      return NextResponse.json(JSON.parse(cleaned))
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (match) {
        try { return NextResponse.json(JSON.parse(match[0])) } catch {}
      }
      console.error('[captions] Parse failed, raw:', raw.substring(0, 300))
      return NextResponse.json({ error: 'AI yaniti parse edilemedi', raw: raw.substring(0, 300) }, { status: 500 })
    }
  } catch (error: any) {
    console.error('[captions] Unexpected error:', error)
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
