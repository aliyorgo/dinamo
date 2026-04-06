import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { campaign_name, message, cta, target_audience, brand_name } = await request.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

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
      system: 'Sen profesyonel bir sosyal medya içerik yazarısın. Yanıtın SADECE geçerli bir JSON objesi olsun, başka hiçbir şey yazma.',
      messages: [{
        role: 'user',
        content: `Aşağıdaki reklam kampanyası için sosyal medya başlıkları yaz.

Marka: ${brand_name || ''}
Kampanya: ${campaign_name || ''}
Mesaj: ${message || ''}
CTA: ${cta || ''}
Hedef kitle: ${target_audience || ''}

Kurallar:
- 3 TikTok başlığı ve 3 Instagram başlığı yaz
- Emoji kullanma
- Her başlığın sonuna 3-5 ilgili hashtag ekle
- Türkçe yaz, kurumsal ama samimi ton
- Kısa ve dikkat çekici olsun

JSON formatı:
{
  "tiktok": ["başlık 1", "başlık 2", "başlık 3"],
  "instagram": ["başlık 1", "başlık 2", "başlık 3"]
}`
      }]
    })
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: res.status })
  }

  const data = await res.json()
  const raw = data.content?.[0]?.text || ''

  try {
    return NextResponse.json(JSON.parse(raw.trim()))
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try { return NextResponse.json(JSON.parse(match[0])) } catch {}
    }
    return NextResponse.json({ error: 'Parse edilemedi' }, { status: 500 })
  }
}
