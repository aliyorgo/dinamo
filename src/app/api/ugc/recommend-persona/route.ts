import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { brief_id } = await req.json()
  if (!brief_id) return NextResponse.json({ error: 'brief_id gerekli' }, { status: 400 })

  const { data: brief } = await supabase.from('briefs').select('campaign_name, message, target_audience, cta, video_type, product_image_url, client_id').eq('id', brief_id).single()
  if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

  // Get client-filtered personas
  const { data: allPersonas } = await supabase.from('personas').select('id, name, slug, description, product_compatibility, tone_description, is_global, is_active').eq('is_active', true).order('display_order')
  const { data: relations } = await supabase.from('client_personas').select('persona_id, relationship_type').eq('client_id', brief.client_id)
  const excludedIds = new Set((relations || []).filter(r => r.relationship_type === 'excluded').map(r => r.persona_id))
  const exclusiveIds = new Set((relations || []).filter(r => r.relationship_type === 'exclusive').map(r => r.persona_id))
  const personas = (allPersonas || []).filter(p => (p.is_global && !excludedIds.has(p.id)) || (!p.is_global && exclusiveIds.has(p.id)))
  if (!personas.length) return NextResponse.json({ error: 'Persona verisi yok' }, { status: 500 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

  const personaList = personas.map(p => `ID:${p.id} — ${p.name} (${p.description}) [uygun: ${p.product_compatibility?.join(', ')}]`).join('\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: `Brief: ${brief.campaign_name}\nMesaj: ${brief.message || ''}\nHedef Kitle: ${brief.target_audience || ''}\nÜrün görseli: ${brief.product_image_url ? 'var' : 'yok'}\n\nPersona listesi:\n${personaList}\n\nBu brief için en uygun persona'yı seç. Sadece JSON dön:\n{"recommended_persona_id": N, "reasoning": "1 cümle neden"}` }],
    }),
  })

  if (!res.ok) return NextResponse.json({ error: 'AI hatası' }, { status: 500 })
  const data = await res.json()
  const text = (data.content?.[0]?.text || '').trim()
  try {
    const result = JSON.parse(text.replace(/```json|```/g, '').trim())
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Parse hatası', raw: text }, { status: 500 })
  }
}
