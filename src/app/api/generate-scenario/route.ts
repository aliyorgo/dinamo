import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getActiveBrandRules, buildBrandRulesBlock } from '@/lib/brand-learning'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(request: Request) {
  console.log('[scenario] POST received')
  const { inspiration_id } = await request.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

  const { data: insp, error: inspErr } = await supabase.from('brief_inspirations').select('*, briefs(video_type, message, cta, client_id)').eq('id', inspiration_id).single()
  if (inspErr) console.error('[scenario] DB error:', inspErr.message)
  if (!insp) return NextResponse.json({ error: 'Fikir bulunamadı' }, { status: 404 })
  console.log('[scenario] Found:', insp.title)

  const durMap: Record<string, number> = { 'Bumper / Pre-roll': 6, 'Story / Reels': 15, 'Feed Video': 30, 'Long Form': 60 }
  const dur = durMap[insp.briefs?.video_type] || 30
  const scenes = Array.isArray(insp.scenes) ? insp.scenes.join('. ') : typeof insp.scenes === 'string' ? insp.scenes : ''

  // Build client context
  let context = ''
  if (insp.briefs) {
    const { data: cl } = await supabase.from('clients').select('ai_notes').eq('id', insp.briefs.client_id || '').maybeSingle()
    if (cl?.ai_notes) context += `Notlar: ${cl.ai_notes.substring(0, 500)}\n`
  }
  if (context.length > 1500) context = context.substring(0, 1500)

  const rules = insp.briefs?.client_id ? await getActiveBrandRules(insp.briefs.client_id) : []
  const rulesBlock = buildBrandRulesBlock(rules)

  console.log('[scenario] Calling claude-haiku-4-5-20251001...')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: 'Sen profesyonel bir video prodüksiyon yönetmenisin. Türkçe yaz. Sade ve net dil kullan.',
      messages: [{ role: 'user', content: `${rulesBlock}Bu video konseptini kısa bir senaryo paragrafına dönüştür. ${insp.briefs?.video_type} için toplam ${dur} saniye.

Konsept: ${insp.title} — ${insp.concept}
Mesaj: ${insp.briefs?.message || ''}
CTA: ${insp.briefs?.cta || ''}
${context ? `\nMÜŞTERİ BAĞLAMI:\n${context}` : ''}

KURALLAR:
- 1 paragraf, 4-6 cümle
- Müzik, ton, ışık gibi teknik detay YAZMA
- Sadece sahne akışı: ne çekiyoruz, nasıl çekiyoruz
- Düz dil, edebi olma
- Sahne numarası veya zaman kodu YAZMA` }]
    })
  })

  console.log('[scenario] API status:', res.status)
  if (!res.ok) {
    const err = await res.text()
    console.error('[scenario] API error:', err.substring(0, 300))
    return NextResponse.json({ error: `AI hatası (${res.status})` }, { status: res.status })
  }

  const data = await res.json()
  const text = data.content?.[0]?.text || ''
  console.log('[scenario] Response text:', text.substring(0, 300))

  // Save raw text directly — no JSON parse required
  const { error: updateErr } = await supabase.from('brief_inspirations').update({
    scenario: text,
    scenario_status: 'generated',
  }).eq('id', inspiration_id)

  if (updateErr) console.error('[scenario] Update error:', updateErr.message)
  else console.log('[scenario] Saved successfully')

  return NextResponse.json({ scenario: text })
}
