import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { briefId } = await req.json()
    if (!briefId) return NextResponse.json({ error: 'briefId gerekli' }, { status: 400 })

    const { data: brief } = await supabase.from('briefs').select('campaign_name, message, cta, target_audience, clients(company_name, street_host_description)').eq('id', briefId).single()
    if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

    const brandName = (brief as any).clients?.company_name || 'marka'
    const hostDesc = (brief as any).clients?.street_host_description || ''

    const systemPrompt = `Sen sokak röportajı senaryo yazarısın. İstanbul sokağında mikrofon tutarak insanlara soran bir format.
5 sahne: intro (host soru sorar), vatandaş 1 (kısa tepki), vatandaş 2 (detay paylaşır), vatandaş 3 (uzun anlatım), outro (host kapanış).

MARKA: ${brandName}
KAMPANYA: ${brief.campaign_name || ''}
MESAJ: ${brief.message || ''}
CTA: ${brief.cta || ''}
HEDEF KİTLE: ${brief.target_audience || ''}

KURALLAR:
- intro_question: maks 12-14 kelime. Host sokakta mikrofon tutarak sorar. Doğal, samimi, merak uyandırıcı.
- citizen_1 dialogue: maks 10-12 kelime. Kısa pozitif tepki.
- citizen_2 dialogue: maks 11-13 kelime. Brief detayını paylaşır (fiyat, kalite, deneyim).
- citizen_3 dialogue: maks 16-18 kelime. En uzun, detaylı, ikna edici.
- outro_closing: maks 8-10 kelime. Host sözlü CTA.
- cta_text: ekrana yazılacak kısa CTA (maks 5 kelime).

VATANDAŞ TİPLERİ:
- Gerçekçi İstanbul sokak insanı. Çeşitli yaş, cinsiyet, görünüm.
- Kıyafet, aksesuar, fiziksel özellik detaylı yaz (Veo prompt'a gidecek).
- 3 vatandaş birbirinden FARKLI tip olsun (genç/orta yaş/yaşlı veya erkek/kadın karışık).

TÜM DİYALOGLAR TÜRKÇE (ş, ç, ğ, ı, ö, ü dahil). Doğal günlük konuşma dili.

CRITICAL: Output MUST be ONLY raw JSON. No markdown, no backticks.
FORMAT:
{
  "intro_question": "...",
  "citizen_1": { "type": "fiziksel görünüm detaylı", "dialogue": "..." },
  "citizen_2": { "type": "fiziksel görünüm detaylı", "dialogue": "..." },
  "citizen_3": { "type": "fiziksel görünüm detaylı", "dialogue": "..." },
  "outro_closing": "...",
  "cta_text": "..."
}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, system: systemPrompt, messages: [{ role: 'user', content: `Marka: ${brandName}\nKampanya: ${brief.campaign_name}\nMesaj: ${brief.message || ''}\nCTA: ${brief.cta || ''}\n\nJSON:` }] }),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error('[street-script] Claude error:', res.status, errBody.substring(0, 300))
      return NextResponse.json({ error: 'AI hatası' }, { status: 500 })
    }

    const aiData = await res.json()
    const rawText = (aiData.content?.[0]?.text || '').trim()
    console.log('[street-script] Response:', rawText.substring(0, 400))

    let script: any
    try {
      const clean = rawText.replace(/```json\n?|```\n?/g, '').trim()
      const start = clean.indexOf('{')
      const end = clean.lastIndexOf('}')
      script = JSON.parse(clean.substring(start, end + 1))
    } catch {
      return NextResponse.json({ error: 'JSON parse hatası', raw: rawText.substring(0, 300) }, { status: 500 })
    }

    if (!script?.intro_question || !script?.citizen_1?.dialogue) {
      return NextResponse.json({ error: 'Eksik alanlar', raw: rawText.substring(0, 300) }, { status: 500 })
    }

    return NextResponse.json(script)
  } catch (err: any) {
    console.error('[street-script] FATAL:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
