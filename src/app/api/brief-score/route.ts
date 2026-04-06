import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { brief } = await request.json()

  console.log('[brief-score] Incoming brief:', JSON.stringify(brief, null, 2))

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  // Defensive field extraction — handle both form state keys and DB column keys
  const campaign = brief?.campaign_name || brief?.campaignName || '—'
  const videoType = brief?.video_type || brief?.videoType || '—'
  const format = brief?.format || '—'
  const platforms = Array.isArray(brief?.platforms) ? brief.platforms.join(', ') : (brief?.platforms || '—')
  const audience = brief?.target_audience || brief?.targetAudience || '—'
  const hasCta = brief?.has_cta || brief?.hasCta || ''
  const cta = hasCta === 'yes' ? (brief?.cta || '—') : (brief?.cta ? brief.cta : 'Yok')
  const message = brief?.message || '—'
  const voiceover = brief?.voiceover_type || brief?.voiceoverType || 'none'
  const notes = brief?.notes || '—'
  const languages = Array.isArray(brief?.languages) ? brief.languages.join(', ') : '—'

  const briefText = `Kampanya: ${campaign}
Video Tipi: ${videoType}
Format: ${format}
Mecralar: ${platforms}
Hedef Kitle: ${audience}
CTA: ${cta}
Brief Metni: ${message}
Seslendirme: ${voiceover}
Notlar: ${notes}
Diller: ${languages}`

  console.log('[brief-score] Composed brief text:', briefText)

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
      system: `Sen bir video prodüksiyon brief analisti olarak görev yapıyorsun. Aşağıdaki brief bilgilerini değerlendir. Bazı alanlar boş olabilir — boş alanları düşük puanla ama hata verme, skor üret.

4 kritere göre 0-100 arası puanla:
1. hedef_kitle — Hedef Kitle: Hedef kitle ne kadar net ve detaylı tanımlanmış?
2. mesaj — Ana Mesaj: Brief metni ne kadar açık, tutarlı ve yönlendirici?
3. format_uyumu — Format Uyumu: Seçilen video tipi, format ve mecra birbiriyle uyumlu mu?
4. butce_beklenti — Beklenti Netliği: CTA, seslendirme, notlar gibi beklentiler açıkça belirtilmiş mi?

Her kriter için kısa, yapıcı ve cesaretlendirici bir iyileştirme tüyosu yaz (Türkçe, senli hitap, 1 cümle).
Toplam skor 4 kriterin ortalaması (yuvarlanmış tam sayı) olsun.

Sadece JSON dön, başka hiçbir şey yazma — açıklama yok, markdown yok, backtick yok.
{
  "total": number,
  "criteria": [
    { "key": "hedef_kitle", "label": "Hedef Kitle", "score": number, "tip": "string" },
    { "key": "mesaj", "label": "Ana Mesaj", "score": number, "tip": "string" },
    { "key": "format_uyumu", "label": "Format Uyumu", "score": number, "tip": "string" },
    { "key": "butce_beklenti", "label": "Beklenti Netliği", "score": number, "tip": "string" }
  ]
}`,
      messages: [{ role: 'user', content: briefText }]
    })
  })

  if (!res.ok) {
    const errBody = await res.text()
    console.log('[brief-score] API error:', res.status, errBody)
    return NextResponse.json({ error: 'API error' }, { status: 500 })
  }

  const data = await res.json()
  const text = data.content?.[0]?.text || ''
  console.log('[brief-score] Raw response:', text)

  try {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const score = JSON.parse(cleaned)
    return NextResponse.json(score)
  } catch (e) {
    console.log('[brief-score] Parse error:', e, '| text:', text)
    return NextResponse.json({ error: 'Parse error' }, { status: 500 })
  }
}
