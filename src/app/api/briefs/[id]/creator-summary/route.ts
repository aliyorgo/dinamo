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
      messages: [{ role: 'user', content: `${rulesBlock}Creator için bu brief'in özetini çıkar. Edebi olma, düz dil.

Brief:
Kampanya: ${brief.campaign_name}
Mesaj: ${brief.message || ''}
Hedef Kitle: ${brief.target_audience || ''}
CTA: ${brief.cta || ''}
Video Tipi: ${brief.video_type}
Notlar: ${brief.notes || ''}

JSON döndür:
{"customer_want":"müşteri ne istiyor (1 cümle)","mood":"1-2 kelime mood (romantik/enerjik/minimal vb.)","critical_point":"en kritik nokta (1 cümle)"}` }],
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
