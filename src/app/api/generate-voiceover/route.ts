import { NextResponse } from 'next/server'

const DURATION_MAP: Record<string, { seconds: number, words: number }> = {
  'Bumper / Pre-roll': { seconds: 6, words: 11 },
  'Story / Reels': { seconds: 15, words: 20 },
  'Feed Video': { seconds: 30, words: 35 },
  'Long Form': { seconds: 60, words: 65 },
}

export async function POST(request: Request) {
  const { brand_name, campaign_name, message, cta, target_audience, video_type } = await request.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const dur = DURATION_MAP[video_type] || { seconds: 30, words: 35 }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: 'Sen profesyonel bir reklam metni yazarısın.',
      messages: [{
        role: 'user',
        content: `${brand_name || 'Marka'} için bir reklam seslendirme metni yaz.

Kurallar:
- Kesinlikle ${dur.words} kelimeyi geçme (${dur.seconds} saniyelik video). Logo girişi ve çıkışı için sürenin bir kısmı görsel kullanılacak, dış ses tüm süreyi kaplayamaz.
- Kısa, net, nefes alınabilir cümleler yaz.
- Sadece seslendirme metnini yaz, başlık ekleme, açıklama ekleme, tırnak işareti kullanma
- Doğal, akıcı Türkçe kullan. Yabancı kelimeleri Türkçeye uyarla ama marka adını ("${brand_name || ''}") olduğu gibi bırak
- Argo veya uydurma kelime kullanma, sade düzgün Türkçe yaz
- Samimi ve ikna edici bir ton kullan

Kampanya: ${campaign_name || ''}
Mesaj/Brief: ${message || ''}
CTA: ${cta || 'Yok'}
Hedef kitle: ${target_audience || ''}

Seslendirme metni:`
      }]
    })
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: res.status })
  }

  const data = await res.json()
  const text = data.content?.[0]?.text || ''

  return NextResponse.json({ text: text.trim() })
}
