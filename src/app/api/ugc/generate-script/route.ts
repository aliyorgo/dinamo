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
  const feedbackBlock = Array.isArray(previous_feedbacks) && previous_feedbacks.length > 0
    ? `\n\nMÜŞTERİ TALEPLERİ (EN YÜKSEK ÖNCELİK):\n${previous_feedbacks.map((f: any) => `${f.video_version} (${f.persona_slug || ''}): "${f.feedback}"`).join('\n')}\n\nKRİTİK: Bu yorumlar müşteri talebidir, EMİR mahiyetindedir.\n- Müşteri talebine SADIK KAL, kendi yorumunu katma\n- En son yorum en önemli, çelişen yorumlarda en son yazılanı uygula\n- Persona kimliği KORUNUR (yaş, cinsiyet, ton, isim) — bu değişmez\n- Mekan, atmosfer, sahne detayları, konuşma içeriği değişebilir\n\nÖNCELİK: 1.Müşteri feedback 2.Brief 3.Marka kuralları 4.Persona default`
    : ''

  const { data: brief } = await supabase.from('briefs').select('campaign_name, message, target_audience, cta, product_image_url, clients(use_fast_mode)').eq('id', brief_id).single()
  if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

  const { data: persona } = await supabase.from('personas').select('*').eq('id', persona_id).single()
  if (!persona) return NextResponse.json({ error: 'Persona bulunamadı' }, { status: 404 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

  const toneNote = tone === 'samimi' ? 'Çok samimi, günlük konuşma dili.' : tone === 'resmi' ? 'Profesyonel ve resmi.' : 'Normal günlük konuşma.'
  const ctaNote = includeCta ? `ZORUNLU CTA: Dialogue'un son 20-30 karakteri CTA olmalı. Brief CTA: "${brief.cta || 'platformda bul'}". Bu CTA'yı doğal şekilde dialogue'a yedir. Boşsa generic CTA yaz (linkten bak, hemen dene).` : 'CTA EKLEME, sadece doğal kapanış.'
  const productNote = use_product ? 'Ürün videoda görünecek, persona ürünü gösteriyor.' : 'Ürün görünmüyor, sadece sözlü anlatım.'

  const model = await getClaudeModel('ugc-script', (brief as any).clients?.use_fast_mode || false)
  const supportsPrefill = model.includes('haiku')

  function extractJson(text: string): string {
    const clean = text.replace(/```json\n?|```\n?/g, '').trim()
    const start = clean.indexOf('{')
    const end = clean.lastIndexOf('}')
    if (start === -1 || end === -1) return clean
    return clean.substring(start, end + 1)
  }

  const systemPrompt = `Sen TikTok UGC senaryocususun. 8 saniyelik video için TEK STRING Türkçe konuşma metni yaz.

PERSONA: ${persona.name} — ${persona.tone_description}
TON: ${toneNote}
${ctaNote}
${productNote}${feedbackBlock}

KURALLAR:
- Tek string dialogue, toplam ${includeCta ? '145-165' : '140-155'} karakter. 8 saniyeyi TAM DOLDUR.
- HOOK + DEĞER + NET KAPANIŞ CÜMLESİ tek akışta. KAPANIŞ kuralları: Son cümle kesin ve net bitsin (yarım kalmasın). Eylem çağrısı veya net bir önermeyle bitsin (örn 'Hemen dene!', 'Bence bir bak.', 'Kaçırma!', 'Ben harikaydı diyorum.'). Son cümle kısa ve vurgulu olsun (3-5 kelime ideal). Soru cümlesiyle bitirme — net kapanış olsun.
- VİRGÜLLE BAŞLAMA yasak, tereddüt yasak.
- Reklamcı klişesi yasak (kazandıran, tam aradığın, bence). CTA gerekiyorsa istisna: 'dene', 'bak', 'al', 'linkten ulaş' gibi doğal CTA cümleleri kullanılabilir.
- Emoji yasak, sadece düz Türkçe metin.
- Doğal Türkçe, persona tonuna sadık.

CRITICAL: Output MUST be ONLY raw JSON. First character: '{'. Last character: '}'. No markdown, no backticks, no explanation.

FORMAT: {"dialogue":"140-155 char Türkçe metin"${feedbackBlock ? ',"changes_summary":"Yorumda isteneni nasıl uyguladığının 1-2 cümlelik doğal Türkçe özeti. Geçmiş zaman kullan. Renk adı yaz, hex kod yazma. Max 150 karakter."' : ''}}`

  const messages: any[] = [
    { role: 'user', content: `Brief: ${brief.campaign_name}\nMesaj: ${brief.message || ''}\nHedef Kitle: ${brief.target_audience || ''}\nCTA: ${brief.cta || ''}\n\nDialogue'da emoji yok, sadece Türkçe metin.\n\nJSON:` },
  ]
  if (supportsPrefill) messages.push({ role: 'assistant', content: '{"dialogue":"' })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 300, system: systemPrompt, messages }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.error('[GENERATE-SCRIPT] Claude API error:', res.status, errBody.substring(0, 300))
    return NextResponse.json({ error: 'AI hatası', detail: errBody.substring(0, 200) }, { status: 500 })
  }
  const aiData = await res.json()
  const responseText = (aiData.content?.[0]?.text || '').trim()
  const rawText = supportsPrefill ? '{"dialogue":"' + responseText : responseText
  console.log('[GENERATE-SCRIPT] Claude response:', rawText.substring(0, 300))

  let script: any
  try {
    script = JSON.parse(extractJson(rawText))
  } catch {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (jsonMatch) { try { script = JSON.parse(jsonMatch[0]) } catch {} }
  }

  if (!script?.dialogue || typeof script.dialogue !== 'string') {
    // RETRY once
    console.warn('[GENERATE-SCRIPT] Invalid format, retrying...')
    const retryMsgs: any[] = [{ role: 'user', content: `Brief: ${brief.campaign_name}. Persona: ${persona.name}. Write single Turkish UGC dialogue string, 140-155 chars. JSON only:` }]
    if (supportsPrefill) retryMsgs.push({ role: 'assistant', content: '{"dialogue":"' })
    const retryRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 300, system: 'CRITICAL: Output ONLY raw JSON. Format: {"dialogue":"140-155 chars Turkish text"}', messages: retryMsgs }),
    })
    if (retryRes.ok) {
      const retryData = await retryRes.json()
      const retryText = (retryData.content?.[0]?.text || '')
      const retryRaw = supportsPrefill ? '{"dialogue":"' + retryText : retryText
      try { script = JSON.parse(extractJson(retryRaw)) } catch {}
    }
    if (!script?.dialogue) {
      // 2nd RETRY
      console.warn('[GENERATE-SCRIPT] 1st retry failed, 2nd retry...')
      const retry2Msgs: any[] = [{ role: 'user', content: `Brief: ${brief.campaign_name}. Persona: ${persona.name}. Turkish UGC dialogue. Output ONLY JSON:` }]
      if (supportsPrefill) retry2Msgs.push({ role: 'assistant', content: '{"dialogue":"' })
      const retry2Res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 300, system: 'CRITICAL: Your response must be ONLY raw JSON. First character must be {. Last character must be }. Format: {"dialogue":"140-155 chars"}', messages: retry2Msgs }),
      })
      if (retry2Res.ok) {
        const retry2Data = await retry2Res.json()
        const retry2Text = (retry2Data.content?.[0]?.text || '')
        const retry2Raw = supportsPrefill ? '{"dialogue":"' + retry2Text : retry2Text
        try { script = JSON.parse(extractJson(retry2Raw)) } catch {}
      }
      if (!script?.dialogue) {
        console.error('[GENERATE-SCRIPT] All retries failed. Raw:', rawText.substring(0, 300))
        return NextResponse.json({ error: 'Geçersiz format', raw: rawText.substring(0, 200) }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ dialogue: script.dialogue, changes_summary: script.changes_summary || '' })
  } catch (err: any) {
    console.error('[GENERATE-SCRIPT] FATAL:', err.message, err.stack)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
