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
      system: `Sen bir reklamcısın. Creator/yapımcı için brief özeti çıkarıyorsun. Creator bu özeti okuyup videoyu üretmeye başlayacak.

Hedefin: 'Bu reklamda ne anlatıyoruz' sorusunun cevabını NET ver. Teknik detaylara takılma, ASIL HİKAYE neyse onu yakala.

YASAKLAR:
- Pazarlama klişeleri ('etkileyici', 'unutulmaz', 'göz alıcı')
- Format/süre/mecra tekrarı (ayrı kartta zaten var)
- Brief cümlelerini kopyalama — özetle
- 'Bu kampanyada' diye başlama

Sadece JSON döndür, başka hiçbir şey yazma.`,
      messages: [{ role: 'user', content: `${rulesBlock}Brief:
Kampanya: ${brief.campaign_name}
Mesaj: ${brief.message || ''}
Hedef Kitle: ${brief.target_audience || ''}
CTA: ${brief.cta || ''}
Hook: ${brief.hook || brief.cps_hook || ''}
Hero: ${brief.hero || brief.cps_hero || ''}
Ton: ${brief.tone || brief.cps_ton || ''}
Seslendirme: ${brief.voiceover_text || ''}
Notlar: ${brief.notes || ''}

3 ALAN ÜRET:

1) customer_want (1 cümle): Ana hikaye ne, hangi duyguyu ne yöntemle anlatıyoruz. Marka adı/ürün değil, anlatılan şey ön planda.

2) mood (1-2 kelime): Atmosfer/hissiyat. Romantik / Enerjik / Sakin / Lüks / Komik / Dramatik gibi.

3) critical_point (1 cümle): Creator'ın MUTLAKA dikkat etmesi gereken yaratıcı/içerik dikkat noktası. Format/süre DEĞİL — brief'teki özel istek, kural, müşteri hassasiyeti.

JSON: {"customer_want":"...","mood":"...","critical_point":"..."}` }],
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
