import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { brief } = await request.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const fields = [
    { key: 'Kampanya Adı', val: brief?.campaign_name || '' },
    { key: 'Mesaj (Brief Metni)', val: brief?.message || '' },
    { key: 'Hedef Kitle', val: brief?.target_audience || '' },
    { key: 'Video Tipi', val: brief?.video_type || '' },
    { key: 'Format', val: brief?.format || '' },
    { key: 'Mecralar', val: Array.isArray(brief?.platforms) ? brief.platforms.join(', ') : '' },
    { key: 'CTA', val: brief?.has_cta === 'yes' ? (brief?.cta || '') : '' },
    { key: 'Seslendirme Tipi', val: brief?.voiceover_type === 'real' ? `Gerçek · ${brief?.voiceover_gender === 'male' ? 'Erkek' : 'Kadın'}` : brief?.voiceover_type === 'ai' ? `AI · ${brief?.voiceover_gender === 'male' ? 'Erkek' : 'Kadın'}` : 'Yok' },
    { key: 'Seslendirme Metni', val: brief?.voiceover_text || '' },
    { key: 'Notlar / Uyarılar', val: brief?.notes || '' },
  ]

  const briefText = fields.map(f => `${f.key}: ${f.val || '(boş)'}`).join('\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: `Sen Dinamo video prodüksiyon platformunun brief değerlendirme sistemisin.

Brief'i SADECE şu alanlar üzerinden değerlendir:
Kampanya Adı, Mesaj (Brief Metni), Hedef Kitle, Video Tipi, Format, Mecralar, CTA, Seslendirme, Notlar.

Değerlendirme kriterleri:
- Alanların DOLULUK oranı (boş alan = düşük puan)
- Mesajın NETLİĞİ (ne istediği anlaşılıyor mu)
- Alanların BİRBİRİNİ DESTEKLEMESİ (hedef kitle + mesaj + CTA tutarlı mı)

ASLA bahsetme: başarı metriği, KPI, platform analizi, bütçe, marka kimliği, rakip analizi, hedef URL, landing page. Bunlar bizim sistemde YOK.

Skor: 0-100. Label: 80+="GÜÇLÜ", 60-79="YETERLİ", <60="GELİŞTİR".
Skor 80 altındaysa 1 cümle (max 12 kelime) nazik öneri ver. Öneri SADECE yukarıdaki alanları işaret etsin.
Emir kipinde yazma ('yapın', 'belirtin', 'açın' gibi direktif kullanma). Yerine 'yapabilirsiniz', 'olabilir', 'daha net olabilir', 'düşünebilirsiniz' gibi nazik rica tonu kullan.
Örnekler: "Hedef kitle biraz daha net olabilir." / "CTA eklemeyi düşünebilirsiniz."
80+ ise suggestion null.

Sadece JSON döndür:
{"score":number,"label":"GÜÇLÜ"|"YETERLİ"|"GELİŞTİR","suggestion":"..."|null}`,
      messages: [{ role: 'user', content: briefText }]
    })
  })

  if (!res.ok) return NextResponse.json({ error: 'API error' }, { status: 500 })

  const data = await res.json()
  const text = (data.content?.[0]?.text || '').trim()

  try {
    const score = JSON.parse(text.replace(/```json|```/g, '').trim())
    return NextResponse.json(score)
  } catch {
    return NextResponse.json({ error: 'Parse error' }, { status: 500 })
  }
}
