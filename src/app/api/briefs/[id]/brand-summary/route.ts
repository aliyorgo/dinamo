import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getActiveBrandRules, buildBrandRulesBlock } from '@/lib/brand-learning'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: brief } = await supabase.from('briefs').select('client_id').eq('id', id).single()
  if (!brief?.client_id) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

  // Cache check on client level
  const { data: client } = await supabase.from('clients').select('company_name, brand_summary').eq('id', brief.client_id).single()
  if (client?.brand_summary) return NextResponse.json({ brand_summary: client.brand_summary })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

  const rules = await getActiveBrandRules(brief.client_id)
  const rulesBlock = buildBrandRulesBlock(rules)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: `${rulesBlock}Bu marka için 3-4 cümle özet yaz. Kim, tarzı ne, nasıl işler yapıyor.
Reklamcı dilinde, sade. 'Yenilikçi', 'değerli müşteri' gibi pazarlama klişeleri kullanma.

Marka: ${client?.company_name || ''}

Sadece düz metin döndür, JSON yok.` }],
    }),
  })

  if (!res.ok) return NextResponse.json({ error: 'AI hatası' }, { status: 500 })
  const data = await res.json()
  const text = (data.content?.[0]?.text || '').trim()
  await supabase.from('clients').update({ brand_summary: text }).eq('id', brief.client_id)
  return NextResponse.json({ brand_summary: text })
}
