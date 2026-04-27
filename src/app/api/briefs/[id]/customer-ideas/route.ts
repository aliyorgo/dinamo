import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getActiveBrandRules, buildBrandRulesBlock } from '@/lib/brand-learning'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { data: brief } = await supabase.from('briefs').select('*, clients(company_name)').eq('id', id).single()
    if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'API key eksik' }, { status: 500 })

    const rules = brief.client_id ? await getActiveBrandRules(brief.client_id) : []
    const rulesBlock = buildBrandRulesBlock(rules)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: `${rulesBlock}Bu brief için 3 farklı yaratıcı yön öner.

Başlık: 2-3 kelime, tarz/mekan belirten kısa etiket. Edebi olma. Örnekler: "Sahil Çekimi", "Stüdyo Portre", "Sokak Sahnesi", "Ev İçi", "Doğa Planı"

Açıklama: 2 cümle max. Düz dil — ne çekiliyor + nasıl çekiliyor + tempo/his. Şiirsel olma, süsleme. Somut ve net yaz.

YAPMA: Renk kodu, renk adı, numerik değer, teknik terim kullanma.

Brief:
Kampanya: ${brief.campaign_name}
Mesaj: ${brief.message || ''}
Hedef Kitle: ${brief.target_audience || ''}
CTA: ${brief.cta || ''}
Video Tipi: ${brief.video_type || ''}
Marka: ${brief.clients?.company_name || ''}

Sadece JSON döndür: { "ideas": [{ "title": "...", "description": "..." }, ...] }` }],
      }),
    })

    if (!res.ok) return NextResponse.json({ error: 'AI hatası' }, { status: 500 })
    const data = await res.json()
    const text = (data.content?.[0]?.text || '').trim()
    let ideas = []
    try { ideas = JSON.parse(text.replace(/```json|```/g, '').trim()).ideas || [] } catch { ideas = [] }
    return NextResponse.json({ ideas })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
