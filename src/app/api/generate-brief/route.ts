import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { user_input, brand_name } = await request.json()

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
      max_tokens: 1200,
      system: `Sen profesyonel bir reklam ajansı brief yazarısın. Kullanıcının anlatımından yapılandırılmış bir video brief oluştur. Yanıtın SADECE geçerli bir JSON objesi olsun, başka hiçbir şey yazma — açıklama yok, markdown yok, backtick yok.

JSON şeması:
{
  "campaign_name": "string — kısa, akılda kalıcı kampanya adı",
  "video_type": "string — şunlardan biri: Bumper / Pre-roll, Story / Reels, Feed Video, Long Form",
  "format": "string — şunlardan biri: 9:16, 16:9, 1:1, 4:5, 2:3",
  "target_audience": "string — hedef kitle detaylı açıklama",
  "has_cta": "string — yes veya no",
  "cta": "string — CTA metni, has_cta no ise boş string",
  "message": "string — müşterinin ajansına yazdığı kampanya brifing metni (dış ses veya senaryo DEĞİL)",
  "voiceover_type": "string — ai",
  "voiceover_gender": "string — female veya male",
  "voiceover_text": "string — video tipine uygun sürede Türkçe profesyonel seslendirme metni",
  "notes": "string — ek notlar, uyarılar, hassasiyetler"
}

Kurallar:
- video_type: kullanıcının anlatımına göre en uygun tipi seç. Platform belirtildiyse (Instagram story, YouTube pre-roll vs.) ona göre seç.
- format: video_type'a uygun format seç. Story/Reels için 9:16, YouTube için 16:9 gibi.
- message: müşterinin ajansına yazdığı kampanya brifing metni olarak yaz. Dış ses, senaryo veya anlatı DEĞİL. Pazarlama yöneticisi tonunda, birinci çoğul şahıs ("Bu kampanyayla hedefliyoruz", "Markamız", "Beklentimiz"). Ne satıldığını, kime, neden, ne zaman, hangi mecrada olduğunu net anlatan 3-4 cümle.
- voiceover_type: "ai" olarak ayarla.
- voiceover_gender: "female" olarak ayarla. Kullanıcı başka bir tercih belirtmedikçe bu değeri kullan.
- voiceover_text: video tipine uygun sürede (Bumper ~9 kelime, Story ~22, Feed ~45, Long Form ~90) Türkçe profesyonel seslendirme metni yaz.
- notes: kullanıcının belirttiği hassasiyetler veya ek talepler.
- Marka adı: ${brand_name || 'belirtilmemiş'}
- Türkçe yaz, sade ve düzgün dil kullan.`,
      messages: [{
        role: 'user',
        content: user_input
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
    const json = JSON.parse(raw.trim())
    return NextResponse.json(json)
  } catch {
    // Try extracting JSON from response if wrapped in text
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        const json = JSON.parse(match[0])
        return NextResponse.json(json)
      } catch {}
    }
    return NextResponse.json({ error: 'AI yanıtı parse edilemedi', raw }, { status: 500 })
  }
}
