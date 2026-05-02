import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { brief_id, persona_id, use_product, settings } = await req.json()
  if (!brief_id || !persona_id) return NextResponse.json({ error: 'brief_id ve persona_id gerekli' }, { status: 400 })
  const tone = settings?.tone || 'samimi'
  const includeCta = settings?.cta !== false

  const { data: brief } = await supabase.from('briefs').select('campaign_name, message, target_audience, cta, product_image_url').eq('id', brief_id).single()
  if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

  const { data: persona } = await supabase.from('personas').select('*').eq('id', persona_id).single()
  if (!persona) return NextResponse.json({ error: 'Persona bulunamadı' }, { status: 404 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

  const toneNote = tone === 'samimi' ? 'Çok samimi, günlük konuşma dili.' : tone === 'resmi' ? 'Profesyonel ve resmi.' : 'Normal günlük konuşma.'
  const ctaNote = includeCta ? 'Segment 2\'de doğal CTA ekle (dene, bak, linkten ulaş gibi kısa).' : 'CTA EKLEME, sadece doğal kapanış.'
  const productNote = use_product ? 'Ürün videoda görünecek, persona ürünü gösteriyor.' : 'Ürün görünmüyor, sadece sözlü anlatım.'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `Sen TikTok UGC senaryocususun. 8 saniyelik video için 2 segmentlik konuşma metni yaz.

PERSONA: ${persona.name} — ${persona.tone_description}
TON: ${toneNote}
${ctaNote}
${productNote}

KURALLAR:
- 2 segment: her biri 40-50 karakter, toplam 80-100 karakter.
- Segment 1 (0-4 sn): HOOK — dikkat çekici, VİRGÜLLE BAŞLAMA, tereddüt yasak.
- Segment 2 (4-8 sn): DEĞER + doğal kapanış.
- Reklamcı klişesi yasak (dene, kazandıran, tam aradığın).
- Doğal Türkçe, persona tonuna sadık.

JSON formatında dön:
{"segments": [{"timestamp": "00:00-00:04", "camera": "medium shot", "action": "kısa aksiyon tarifi", "dialogue": "40-50 char"}, {"timestamp": "00:04-00:08", "camera": "close-up shot", "action": "kısa aksiyon tarifi", "dialogue": "40-50 char"}]}`,
      messages: [{ role: 'user', content: `Brief: ${brief.campaign_name}\nMesaj: ${brief.message || ''}\nHedef Kitle: ${brief.target_audience || ''}\nCTA: ${brief.cta || ''}\n\nJSON:` }],
    }),
  })

  if (!res.ok) return NextResponse.json({ error: 'AI hatası' }, { status: 500 })
  const data = await res.json()
  const text = (data.content?.[0]?.text || '').trim()
  try {
    const script = JSON.parse(text.replace(/```json|```/g, '').trim())
    return NextResponse.json(script)
  } catch {
    return NextResponse.json({ error: 'Parse hatası', raw: text }, { status: 500 })
  }
}
