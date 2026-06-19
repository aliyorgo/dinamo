import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getActiveBrandRules, buildBrandRulesBlock } from '@/lib/brand-learning'
import { getClaudeModel } from '@/lib/claude-model'
import { SCREEN_UI_IDEA_RULE, PROMO_IDEA_RULE } from '@/lib/ai-idea-rules'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: Request) {
  const { campaign_name, brand_name, message, target_audience, video_type, cta, count, clientId, promo_code, promo_offer } = await request.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

  let useFastMode = false
  if (clientId) {
    const { data: cl } = await supabase.from('clients').select('use_fast_mode').eq('id', clientId).maybeSingle()
    useFastMode = cl?.use_fast_mode || false
  }

  const rules = clientId ? await getActiveBrandRules(clientId) : []
  const rulesBlock = buildBrandRulesBlock(rules)
  const numIdeas = count || 3

  const prompt = `${rulesBlock}${promo_code && promo_offer ? `${PROMO_IDEA_RULE}\nFırsat: ${promo_offer}\n\n` : ''}Sen yaratici bir video produksiyon yonetmenisin. Asagidaki brief icin ${numIdeas} farkli yaratici video konsepti olustur.

Brief:
- Kampanya: ${campaign_name || 'Belirtilmemis'}
- Marka: ${brand_name || 'Belirtilmemis'}
- Mesaj: ${message || 'Belirtilmemis'}
- Hedef Kitle: ${target_audience || 'Belirtilmemis'}
- Video Tipi: ${video_type || 'Belirtilmemis'}
- CTA: ${cta || 'Yok'}

Her konsept icin title (baslik), concept (detayli aciklama, 2-3 cumle), approach (gorsel yaklasim) ver.

${SCREEN_UI_IDEA_RULE}

URETIM KISITLARI — fikirler bu kisitlara UYGUN olmali:
- Video 15 saniye, yapay zeka (Kling 3.0) ile uretilecek — gercekci, cekilebilir sahneler oner.
- Video 6 sahnelik akistan olusur — fikrin 6 sahneye bolunebilir bir akisi olsun.
- Markanin logosu, urunu, yazi, fiyat ekranda GORUNMEZ — fikir duygu/atmosfer/karakter uzerine kurulu olmali.
- Karakterler KONUSMAZ — diyalog yok, gorsel anlatim esas.
- Asiri karmasik sahnelerden (kalabalik, cok ozne) kacin — yapay zeka tutarliligi zorlanir.
- Mekan gercekci (Turkiye ortami tercih).

SADECE JSON formatinda don, baska metin yazma:
{"inspirations":[{"title":"...","concept":"...","approach":"..."}]}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: await getClaudeModel('ideas', useFastMode),
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `AI hata (${res.status})`, details: err.substring(0, 300) }, { status: res.status })
    }

    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim()

    let parsed: any = null
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]) } catch {}
      }
    }

    if (parsed?.inspirations && Array.isArray(parsed.inspirations)) {
      return NextResponse.json({ inspirations: parsed.inspirations })
    }

    return NextResponse.json({ error: 'AI yaniti parse edilemedi', raw: text.substring(0, 500) }, { status: 500 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Beklenmeyen hata' }, { status: 500 })
  }
}
