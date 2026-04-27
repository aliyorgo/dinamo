import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { brief } = await request.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const campaign = brief?.campaign_name || '—'
  const videoType = brief?.video_type || '—'
  const format = brief?.format || '—'
  const platforms = Array.isArray(brief?.platforms) ? brief.platforms.join(', ') : '—'
  const audience = brief?.target_audience || '—'
  const cta = brief?.has_cta === 'yes' ? (brief?.cta || '—') : (brief?.cta || 'Yok')
  const message = brief?.message || '—'
  const voiceover = brief?.voiceover_type || 'none'
  const notes = brief?.notes || '—'

  const briefText = `Kampanya: ${campaign}\nVideo: ${videoType} · ${format}\nMecralar: ${platforms}\nHedef Kitle: ${audience}\nCTA: ${cta}\nBrief: ${message}\nSeslendirme: ${voiceover}\nNotlar: ${notes}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: `Brief'i 0-100 puan değerlendir. Label belirle: 80+="GÜÇLÜ", 60-79="YETERLİ", <60="GELİŞTİR". Skor 80 altındaysa 1 cümle (max 12 kelime) Türkçe gelişim önerisi ver, 80+ ise suggestion boş bırak. Sadece JSON döndür, başka hiçbir şey yazma.
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
