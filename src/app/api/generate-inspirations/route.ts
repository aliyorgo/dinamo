import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getActiveBrandRules, buildBrandRulesBlock } from '@/lib/brand-learning'
import { getClaudeModel } from '@/lib/claude-model'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const DURATIONS: Record<string, number> = { 'Bumper / Pre-roll': 6, 'Story / Reels': 15, 'Feed Video': 30, 'Long Form': 60 }

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
}

export async function POST(request: Request) {
  console.log('[inspirations] POST request received')

  const { brief_id, user_id, count, source, existing_ideas, target_levels } = await request.json()
  console.log('[inspirations] Params:', { brief_id, user_id, count, source })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[inspirations] ANTHROPIC_API_KEY not set')
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  console.log('[inspirations] Fetching brief...')
  const { data: brief, error: briefErr } = await supabase.from('briefs').select('*, clients(company_name)').eq('id', brief_id).single()
  if (briefErr) console.error('[inspirations] Brief fetch error:', briefErr.message)
  if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })
  console.log('[inspirations] Brief found:', brief.campaign_name, brief.video_type)

  const duration = DURATIONS[brief.video_type] || 30
  const numIdeas = count || 3

  // Build client context (max 1500 chars)
  let context = ''
  const { data: clientData } = await supabase.from('clients').select('ai_notes').eq('id', brief.client_id).maybeSingle()
  if (clientData?.ai_notes) context += `Notlar: ${clientData.ai_notes.substring(0, 500)}\n`
  const { data: prevApproved } = await supabase.from('brief_inspirations').select('title, concept').eq('brief_id', brief_id).eq('status', 'approved').limit(5)
  if (prevApproved?.length) context += `Önceki konseptler: ${prevApproved.map((p: any) => `${p.title} — ${(p.concept||'').substring(0,100)}`).join('; ')}\n`
  const { data: prevBriefs } = await supabase.from('briefs').select('message, cta').eq('client_id', brief.client_id).eq('status', 'delivered').order('created_at', { ascending: false }).limit(3)
  if (prevBriefs?.length) context += `Önceki briefler: ${prevBriefs.map((b: any) => `${(b.message||'').substring(0,150)}`).join('; ')}\n`
  if (context.length > 1500) context = context.substring(0, 1500)

  const rules = brief.client_id ? await getActiveBrandRules(brief.client_id) : []
  const rulesBlock = buildBrandRulesBlock(rules)

  const prompt = `${rulesBlock}Aşağıdaki brief için ${duration} saniyelik bir ${brief.video_type} videosu için ${numIdeas} farklı yaratıcı konsept öner.

Marka: ${brief.clients?.company_name || ''}
Mesaj: ${brief.message || ''}
Hedef kitle: ${brief.target_audience || ''}
CTA: ${brief.cta || ''}
Süre: ${duration} saniye
${context ? `\nMÜŞTERİ BAĞLAMI:\n${context}` : ''}
Her konsept için SADECE şunları ver:
- title: Başlık (max 5 kelime)
- concept: Videonun ana fikrini anlatan 2-3 cümle. Kısa ve öz.

${target_levels && Array.isArray(target_levels) && target_levels.length > 0 ? `Şu seviyelerde ${numIdeas} fikir üret: ${target_levels.join(', ')}.` : `${numIdeas} fikir birbirinden farklı yaklaşımda olsun: biri sade ve minimal, biri orta düzey, biri yaratıcı ve sinematik.`} Türkiye pazarına uygun ol.
${existing_ideas && Array.isArray(existing_ideas) && existing_ideas.length > 0 ? `\nMevcut korunmuş fikirler (bunlardan FARKLI üret, tekrarlama):\n${existing_ideas.map((e: any) => `- ${e.title}: ${e.concept}`).join('\n')}` : ''}
Her fikir için level belirt: "minimal", "orta" veya "sinematik".

Süre bazlı derinlik:
- 10-15sn: kısa ve direkt fikir, tek konsept
- 30sn: kavramsal akış, orta derinlik
- 60sn+: hikaye anlatımı, başlangıç-orta-son yapısı

YASAK:
- VFX terminolojisi (pırıltı, patlama, ışıltı, slow-motion, time-lapse, hyperlapse)
- Cinsel/duygusal abartı klişeleri
- 'Ekran patlıyor', 'göz kamaştırıcı geçiş', 'rüya gibi atmosfer' tarzı süslü dil
- Renk kodu (#hex) veya spesifik renk adı (mavi, kırmızı vb.)

BUNUN YERİNE reklamcı insight'ı ile yaz:
- Tüketicinin yaşadığı durum/his
- Markanın çözdüğü problem
- Hedef kitlenin gerçek hayat anı
- Atmosfer/mekan/tarz kavramsal seviye

Sadece JSON döndür:
{"inspirations": [{"title":"başlık","concept":"2-3 cümle açıklama","level":"minimal|orta|sinematik"}]}`

  console.log('[inspirations] Sending to Anthropic API...')
  let res: Response
  try {
    const model = await getClaudeModel('inspirations')
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: 'Sen deneyimli bir video prodüksiyon direktörüsün. Kling, Veo, Runway gibi AI video üretim araçları ve Adobe Premiere\'e hakimsin. Yanıtın SADECE geçerli bir JSON objesi olsun. Başka hiçbir şey yazma. Markdown code block kullanma. Açıklama ekleme.',
        messages: [{ role: 'user', content: prompt }]
      })
    })
  } catch (fetchErr) {
    console.error('[inspirations] Fetch error:', fetchErr)
    return NextResponse.json({ error: 'AI servisi ile bağlantı kurulamadı', details: String(fetchErr) }, { status: 502 })
  }

  console.log('[inspirations] API response status:', res.status)

  if (!res.ok) {
    const errBody = await res.text()
    console.error('[inspirations] API error body:', errBody.substring(0, 500))
    return NextResponse.json({ error: `AI yanıt hatası (${res.status})`, details: errBody.substring(0, 300) }, { status: res.status })
  }

  const data = await res.json()
  const text = data.content?.[0]?.text || ''
  console.log('[inspirations] Raw response length:', text.length)
  console.log('[inspirations] Raw response preview:', text.substring(0, 300))

  // Clean markdown code blocks
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim()

  let parsed: any = null

  // Attempt 1: direct parse
  try {
    parsed = JSON.parse(cleaned)
    console.log('[inspirations] Direct parse succeeded')
  } catch (e1) {
    console.error('[inspirations] Direct parse failed:', (e1 as Error).message)

    // Attempt 2: regex extract
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0])
        console.log('[inspirations] Regex parse succeeded')
      } catch (e2) {
        console.error('[inspirations] Regex parse failed:', (e2 as Error).message)
        console.error('[inspirations] Matched text preview:', jsonMatch[0].substring(0, 200))
      }
    } else {
      console.error('[inspirations] No JSON object found in response')
    }
  }

  if (!parsed?.inspirations || !Array.isArray(parsed.inspirations)) {
    console.error('[inspirations] Invalid structure. Keys:', parsed ? Object.keys(parsed) : 'null')
    return NextResponse.json({
      error: 'AI yanıtı parse edilemedi. Lütfen tekrar deneyin.',
      raw: text.substring(0, 300),
    }, { status: 500 })
  }

  console.log('[inspirations] Parsed', parsed.inspirations.length, 'inspirations. Inserting...')

  const results = []
  for (const insp of parsed.inspirations) {
    const insertData = {
      brief_id,
      title: insp.title || 'Başlıksız',
      concept: insp.concept || '',
      generated_by: user_id || null,
      is_starred: false,
      is_visible_to_creator: true,
      source: source || 'admin',
      status: 'normal',
      ...(insp.level ? { level: insp.level } : {}),
    }
    console.log('[inspirations] Inserting:', insp.title)
    const { data: inserted, error: insErr } = await supabase.from('brief_inspirations').insert(insertData).select('*').single()
    if (insErr) {
      console.error('[inspirations] Insert error for "' + insp.title + '":', insErr.message, insErr.details, insErr.hint)
    }
    if (inserted) results.push(inserted)
  }

  console.log('[inspirations] Done. Inserted', results.length, 'of', parsed.inspirations.length)
  return NextResponse.json({ inspirations: results })
}
