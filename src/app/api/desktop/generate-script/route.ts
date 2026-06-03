import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const FORMAT_DURATIONS: Record<string, number> = {
  'bumper': 6, 'pre-roll': 6, 'story': 15, 'reels': 15,
  'feed': 30, 'feed-video': 30, 'long': 45, 'long-form': 45,
}

export async function POST(req: NextRequest) {
  try {
    const { briefId } = await req.json()
    if (!briefId) return NextResponse.json({ error: 'briefId gerekli' }, { status: 400 })

    const { data: brief } = await supabase.from('briefs').select('campaign_name, message, cta, target_audience, format, video_type, clients(company_name, brand_primary_color, brand_secondary_color, desktop_vo_enabled, brand_tone)').eq('id', briefId).single()
    if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

    const totalDuration = FORMAT_DURATIONS[brief.video_type || ''] || 15
    const brandName = (brief as any).clients?.company_name || 'marka'
    const brandColor = (brief as any).clients?.brand_primary_color || '#FF6B35'
    const voEnabled = (brief as any).clients?.desktop_vo_enabled !== false

    // Music library listesi
    const { data: musicList } = await supabase.from('music_library').select('id, name, mood').eq('is_active', true).limit(20)
    const musicContext = (musicList || []).map((m: any) => `${m.id}: ${m.name} (${(m.mood || []).join(', ')})`).join('\n')

    const segmentCount = totalDuration <= 6 ? 3 : totalDuration <= 15 ? 5 : 6
    const voNote = voEnabled ? `voiceover_text: Türkçe VO metni, ~${Math.round(totalDuration * 2.5)} kelime (${totalDuration}sn'ye sığacak, ~2.5 kelime/sn).` : 'voiceover_text: null (VO kapalı).'

    const systemPrompt = `Sen premium video reklam yaratıcı direktörüsün. Marka için ${totalDuration} saniyelik statik görsel + animasyonlu yazı video reklamı senaryosu yaz.

MARKA: ${brandName}
KAMPANYA: ${brief.campaign_name || ''}
MESAJ: ${brief.message || ''}
CTA: ${brief.cta || ''}
HEDEF KİTLE: ${brief.target_audience || ''}
MARKA RENGİ: ${brandColor}
TOPLAM SÜRE: ${totalDuration} saniye

GÖREV:
1. image_concept_prompt: Nano Banana (AI görsel üretici) için İNGİLİZCE prompt. Premium lifestyle/ürün fotoğrafı konsepti. Marka rengi ve kampanya temasına uygun. Metin/yazı İÇERMEMELİ (yazılar FFmpeg ile eklenecek).

2. text_sequence: ${segmentCount} yazı segmenti. Her biri farklı template kullanır:
   - headline_zoom: büyük başlık, ortada, zoom efekti
   - slide_up: alttan kayarak çıkan alt başlık
   - karaoke: kelime kelime beliren metin (VO sync)
   - apple_minimal: ince, sade, premium
   - cta_fade: CTA butonu hissi, renkli arka plan

   Her segment: template, text (MAX 6 kelime Türkçe), start_sec, duration_sec.
   Segmentler toplam ${totalDuration}sn'yi kaplar. Son segment CTA olsun (cta_fade).
   Aynı template'i arka arkaya KULLANMA.

3. ${voNote}

4. music_library_id: Aşağıdaki listeden kampanya tonuna en uygun müziği seç (sadece ID döndür):
${musicContext || 'Müzik listesi boş — music_library_id: null'}

CRITICAL: Output ONLY raw JSON.
FORMAT:
{
  "image_concept_prompt": "English prompt for Nano Banana...",
  "text_sequence": [
    {"template": "headline_zoom", "text": "Türkçe max 6 kelime", "start_sec": 0, "duration_sec": 3},
    ...
  ],
  ${voEnabled ? '"voiceover_text": "Türkçe VO metni",' : ''}
  "music_library_id": "uuid-or-null",
  "total_duration_sec": ${totalDuration}
}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, system: systemPrompt, messages: [{ role: 'user', content: `Marka: ${brandName}\nMesaj: ${brief.message || ''}\nCTA: ${brief.cta || ''}\n\nJSON:` }] }),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error('[desktop-script] Claude error:', res.status, errBody.substring(0, 300))
      return NextResponse.json({ error: 'AI hatası' }, { status: 500 })
    }

    const aiData = await res.json()
    const rawText = (aiData.content?.[0]?.text || '').trim()
    console.log('[desktop-script] Response:', rawText.substring(0, 400))

    let script: any
    try {
      const clean = rawText.replace(/```json\n?|```\n?/g, '').trim()
      const start = clean.indexOf('{')
      const end = clean.lastIndexOf('}')
      script = JSON.parse(clean.substring(start, end + 1))
    } catch {
      return NextResponse.json({ error: 'JSON parse hatası', raw: rawText.substring(0, 300) }, { status: 500 })
    }

    if (!script?.image_concept_prompt || !script?.text_sequence?.length) {
      return NextResponse.json({ error: 'Eksik alanlar' }, { status: 500 })
    }

    return NextResponse.json(script)
  } catch (err: any) {
    console.error('[desktop-script] FATAL:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
