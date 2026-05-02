import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { brief_id, persona_id, use_product, settings } = await req.json()
  if (!brief_id || !persona_id) return NextResponse.json({ error: 'brief_id ve persona_id gerekli' }, { status: 400 })
  const tone = settings?.tone || 'samimi'
  const speed = settings?.speed || 'normal'
  const includeCta = settings?.cta !== false
  const includeMusic = settings?.music !== false

  const { data: brief } = await supabase.from('briefs').select('campaign_name, message, target_audience, cta, product_image_url').eq('id', brief_id).single()
  if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

  const { data: persona } = await supabase.from('personas').select('*').eq('id', persona_id).single()
  if (!persona) return NextResponse.json({ error: 'Persona bulunamadı' }, { status: 404 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

  const productNote = use_product ? 'Ürün videoda görünecek, persona ürünü eline alıp gösteriyor/kullanıyor.' : 'Ürün videoda görünmeyecek, persona sadece sözlü anlatım yapıyor.'
  const toneNote = tone === 'samimi' ? 'Çok samimi, günlük konuşma dili, "kanka/abi" tarzı hitap.' : tone === 'resmi' ? 'Profesyonel ve resmi, tam cümleler, jargonsuz ama ciddi.' : 'Normal günlük konuşma tonu.'
  const speedNote = speed === 'yavas' ? 'Yavaş ve düşünceli konuşma, duraklar bırak.' : speed === 'hizli' ? 'Hızlı ve enerjik konuşma, kısa keskin cümleler.' : 'Normal konuşma temposu.'
  const ctaNote = includeCta ? 'Son shot\'ta CTA ekle (linke tıkla, dene, sor vb.)' : 'CTA EKLEME, son shot sadece samimi kapanış olsun.'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: `Sen UGC (User Generated Content) video scripti yazıyorsun. Türkçe, doğal, samimi.

PERSONA: ${persona.name}
Yaş: ${persona.age_range}, Cinsiyet: ${persona.gender}
Ton: ${persona.tone_description}
Ortam: ${persona.environment_prompt}

KURALLAR:
- KARAKTERLİMİTİ: 3 shot toplam dialogue YAKLAŞIK 350 karakter olmalı, 360'ı ASLA geçme. Her shot ~110-120 karakter.
- Her shot tam 8 saniye = 15-20 kelime Türkçe dialogue
- Persona'nın dilinde yaz (Z kuşağı kız "ya bak şunu denedim" der, esnaf abi "evladım" der)
- Doğal UGC hissi, stüdyo reklamı DEĞİL
- ${productNote}
- TON: ${toneNote}
- HIZ: ${speedNote}
- ${ctaNote}
- MÜZİK: ${includeMusic ? 'Arka planda hafif ortam müziği olacak, buna göre sessiz anlar bırakabilirsin.' : 'Müzik YOK, sadece ses. Konuşma arasında sessizlik doğal olsun.'}
- VEO PROMPT NOTU: Dialogue yazarken konuşma hızını dikkate al. ${speed === 'yavas' ? '8 saniyeye 12-15 kelime sığdır.' : speed === 'hizli' ? '8 saniyeye 20-25 kelime sığdır.' : '8 saniyeye 15-20 kelime sığdır.'}

SHOT YAPISI:
- Shot 1: Geniş plan açılış, kanca + ortam tanıtımı${use_product ? ' + ürünü gösterme' : ''}
- Shot 2: Zoom in, ${use_product ? 'ürün detayı / fayda anlatımı' : 'konu detayı / fayda anlatımı'}
- Shot 3: Orta plan kapanış, samimi tavsiye, CTA

JSON formatında dön, başka bir şey yazma.`,
      messages: [{ role: 'user', content: `Brief: ${brief.campaign_name}\nMesaj: ${brief.message || ''}\nHedef Kitle: ${brief.target_audience || ''}\nCTA: ${brief.cta || ''}\n\nJSON:\n{"shots": [{"shot": 1, "dialogue": "...", "action": "...", "camera": "wide"}, {"shot": 2, "dialogue": "...", "action": "...", "camera": "close-up"}, {"shot": 3, "dialogue": "...", "action": "...", "camera": "medium"}]}` }],
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
