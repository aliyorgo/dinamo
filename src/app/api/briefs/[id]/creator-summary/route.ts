import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getActiveBrandRules, buildBrandRulesBlock } from '@/lib/brand-learning'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: brief } = await supabase.from('briefs').select('*, clients(company_name)').eq('id', id).single()
  if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

  // Cache check
  if (brief.creator_summary) return NextResponse.json(brief.creator_summary)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

  const rules = brief.client_id ? await getActiveBrandRules(brief.client_id) : []
  const rulesBlock = buildBrandRulesBlock(rules)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `Sen bir reklam ajansında account director'sın. Müşteriden gelen brief'i aldın, creative ekibe (creator) anlatıyorsun.

Senin dilin ajans iç iletişim dili — müşteriye satış değil, ekip arkadaşına brief aktarımı:
- 'Marka X, şu sezon Y kampanyası başlatıyor'
- 'Bu kampanyayı şöyle bir iletişimle duyurmak istiyorlar'
- 'Videoda ton şöyle olsun, şundan kaçınalım'

YAZIM:
- 2-3 cümle akıcı paragraf
- Marka adıyla başla
- Kampanya ne, ne için, hangi tonla
- Varsa kritik kural ('şundan kaçınalım', 'şu mutlaka olsun')

YASAKLAR:
- Tüketici dili ('keyifli anlar yaşayacaksınız')
- 'Eğlenceli', 'samimi', 'canlı' pazarlama klişeleri — mood somut anlat ('gündelik tonda', 'enerjik tempo')
- Hedef kitle pazarlama segmenti ('alışveriş tutkunları')
- 'Bu reklamda', 'Bu kampanyada' jenerik girişler
- Renk kodu (#hex), format/süre/mecra teknik bilgisi

Sadece JSON döndür: {"summary":"..."}`,
      messages: [{ role: 'user', content: `${rulesBlock}Brief:
Kampanya: ${brief.campaign_name}
Mesaj: ${brief.message || ''}
Hedef Kitle: ${brief.target_audience || ''}
CTA: ${brief.cta || ''}
Hook: ${brief.hook || brief.cps_hook || ''}
Ton: ${brief.tone || brief.cps_ton || ''}
Seslendirme: ${brief.voiceover_text || ''}
Notlar: ${brief.notes || ''}

JSON: {"summary":"..."}` }],
    }),
  })

  if (!res.ok) return NextResponse.json({ error: 'AI hatası' }, { status: 500 })
  const data = await res.json()
  const text = (data.content?.[0]?.text || '').trim()
  try {
    const summary = JSON.parse(text.replace(/```json|```/g, '').trim())
    await supabase.from('briefs').update({ creator_summary: summary }).eq('id', id)
    return NextResponse.json(summary)
  } catch {
    return NextResponse.json({ error: 'Parse hatası' }, { status: 500 })
  }
}
