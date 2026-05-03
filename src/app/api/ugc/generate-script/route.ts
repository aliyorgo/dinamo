import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClaudeModel } from '@/lib/claude-model'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
  const { brief_id, persona_id, use_product, settings, previous_feedbacks } = await req.json()
  console.log('[GENERATE-SCRIPT] request:', { brief_id, persona_id, use_product, feedbackCount: previous_feedbacks?.length })
  if (!brief_id || !persona_id) return NextResponse.json({ error: 'brief_id ve persona_id gerekli' }, { status: 400 })
  const tone = settings?.tone || 'samimi'
  const includeCta = settings?.cta !== false
  // Build feedback injection
  const feedbackBlock = Array.isArray(previous_feedbacks) && previous_feedbacks.length > 0
    ? `\n\nMÜŞTERİ GERİ BİLDİRİMLERİ (önceki versiyonlar hakkında, en son en önemli):\n${previous_feedbacks.map((f: any) => `${f.video_version} (${f.persona_slug || ''}): "${f.feedback}"`).join('\n')}\nBu yorumları dikkate alarak daha iyi bir script üret. En son yorum en önemli.`
    : ''

  const { data: brief } = await supabase.from('briefs').select('campaign_name, message, target_audience, cta, product_image_url, clients(use_fast_mode)').eq('id', brief_id).single()
  if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

  const { data: persona } = await supabase.from('personas').select('*').eq('id', persona_id).single()
  if (!persona) return NextResponse.json({ error: 'Persona bulunamadı' }, { status: 404 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

  const toneNote = tone === 'samimi' ? 'Çok samimi, günlük konuşma dili.' : tone === 'resmi' ? 'Profesyonel ve resmi.' : 'Normal günlük konuşma.'
  const ctaNote = includeCta ? 'Segment 2\'de doğal CTA ekle (dene, bak, linkten ulaş gibi kısa).' : 'CTA EKLEME, sadece doğal kapanış.'
  const productNote = use_product ? 'Ürün videoda görünecek, persona ürünü gösteriyor.' : 'Ürün görünmüyor, sadece sözlü anlatım.'

  const model = await getClaudeModel('ugc-script', (brief as any).clients?.use_fast_mode || false)
  const supportsPrefill = model.includes('haiku')

  // Helper: extract first complete JSON object from text
  function extractJson(text: string): string {
    const clean = text.replace(/```json\n?|```\n?/g, '').trim()
    const start = clean.indexOf('{')
    const end = clean.lastIndexOf('}')
    if (start === -1 || end === -1) return clean
    return clean.substring(start, end + 1)
  }

  const systemPrompt = `Sen TikTok UGC senaryocususun. 8 saniyelik video için 2 segmentlik konuşma metni yaz.

PERSONA: ${persona.name} — ${persona.tone_description}
TON: ${toneNote}
${ctaNote}
${productNote}${feedbackBlock}

KURALLAR:
- 2 segment: her biri Segment 1 = 60-70 karakter, Segment 2 = 70-75 karakter. Toplam 130-145 karakter. 8 saniyeyi TAM DOLDUR.
- Segment 1 (0-4 sn): HOOK — dikkat çekici, VİRGÜLLE BAŞLAMA, tereddüt yasak.
- Segment 2 (4-8 sn): DEĞER + doğal kapanış.
- Reklamcı klişesi yasak (dene, kazandıran, tam aradığın).
- Doğal Türkçe, persona tonuna sadık.

CRITICAL: Output MUST be ONLY raw JSON. First character: '{'. Last character: '}'. No markdown, no backticks, no explanation, no preamble, no analysis.

ÖRNEK:
{"segments":[{"timestamp":"00:00-00:04","camera":"medium shot","action":"speaks to camera","dialogue":"60-75 char Türkçe"},{"timestamp":"00:04-00:08","camera":"close-up shot","action":"leans forward","dialogue":"60-75 char Türkçe"}]}`

  const messages: any[] = [
    { role: 'user', content: `Brief: ${brief.campaign_name}\nMesaj: ${brief.message || ''}\nHedef Kitle: ${brief.target_audience || ''}\nCTA: ${brief.cta || ''}\n\nDialogue'da emoji yok, sadece Türkçe metin.\n\nJSON:` },
  ]
  if (supportsPrefill) messages.push({ role: 'assistant', content: '{"segments":[{' })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 400, system: systemPrompt, messages }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.error('[GENERATE-SCRIPT] Claude API error:', res.status, errBody.substring(0, 300))
    return NextResponse.json({ error: 'AI hatası', detail: errBody.substring(0, 200) }, { status: 500 })
  }
  const aiData = await res.json()
  const responseText = (aiData.content?.[0]?.text || '').trim()
  const rawText = supportsPrefill ? '{"segments":[{' + responseText : responseText
  console.log('[GENERATE-SCRIPT] Claude response:', rawText.substring(0, 300))

  let script
  try {
    script = JSON.parse(extractJson(rawText))
  } catch {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (jsonMatch) { try { script = JSON.parse(jsonMatch[0]) } catch {} }
  }

  // Strict: exactly 2 segments (trim if Claude returns more)
  if (script?.segments?.length > 2) script.segments = script.segments.slice(0, 2)
  if (!script?.segments || !Array.isArray(script.segments) || script.segments.length !== 2) {
    // RETRY once
    console.warn('[GENERATE-SCRIPT] Invalid format, retrying...')
    const retryMsgs: any[] = [{ role: 'user', content: `Brief: ${brief.campaign_name}. Persona: ${persona.name}. Write 2 segments of Turkish UGC dialogue, 60-75 chars each, total 130-145 chars. JSON only:` }]
    if (supportsPrefill) retryMsgs.push({ role: 'assistant', content: '{"segments":[{' })
    const retryRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 400, system: 'CRITICAL: Output ONLY raw JSON starting with { ending with }. No markdown. Format: {"segments":[{"timestamp":"00:00-00:04","camera":"medium shot","action":"...","dialogue":"..."},{"timestamp":"00:04-00:08","camera":"close-up shot","action":"...","dialogue":"..."}]}', messages: retryMsgs }),
    })
    if (retryRes.ok) {
      const retryData = await retryRes.json()
      const retryText = (retryData.content?.[0]?.text || '')
      const retryRaw = supportsPrefill ? '{"segments":[{' + retryText : retryText
      try { script = JSON.parse(extractJson(retryRaw)) } catch {}
      if (script?.segments?.length > 2) script.segments = script.segments.slice(0, 2)
    }
    if (!script?.segments || script.segments.length !== 2) {
      // 2nd RETRY
      console.warn('[GENERATE-SCRIPT] 1st retry failed, 2nd retry...')
      const retry2Msgs: any[] = [{ role: 'user', content: `Brief: ${brief.campaign_name}. Persona: ${persona.name}. 2 Turkish UGC dialogue segments. Output ONLY JSON:` }]
      if (supportsPrefill) retry2Msgs.push({ role: 'assistant', content: '{"segments":[{' })
      const retry2Res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 400, system: 'CRITICAL: Your response must be ONLY raw JSON. First character must be {. Last character must be }. No markdown, no backticks, no explanation. Format: {"segments":[{"timestamp":"00:00-00:04","camera":"medium shot","action":"...","dialogue":"60-75 chars"},{"timestamp":"00:04-00:08","camera":"close-up shot","action":"...","dialogue":"60-75 chars"}]}', messages: retry2Msgs }),
      })
      if (retry2Res.ok) {
        const retry2Data = await retry2Res.json()
        const retry2Text = (retry2Data.content?.[0]?.text || '')
        const retry2Raw = supportsPrefill ? '{"segments":[{' + retry2Text : retry2Text
        try { script = JSON.parse(extractJson(retry2Raw)) } catch {}
        if (script?.segments?.length > 2) script.segments = script.segments.slice(0, 2)
      }
      if (!script?.segments || script.segments.length !== 2) {
        console.error('[GENERATE-SCRIPT] All retries failed. Raw:', rawText.substring(0, 300))
        return NextResponse.json({ error: 'Geçersiz format', raw: rawText.substring(0, 200) }, { status: 500 })
      }
    }
  }

  return NextResponse.json(script)
  } catch (err: any) {
    console.error('[GENERATE-SCRIPT] FATAL:', err.message, err.stack)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
