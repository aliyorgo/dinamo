import { createClient } from '@supabase/supabase-js'
import * as stringSimilarity from 'string-similarity'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ExtractionInput {
  clientId: string
  sourceType: string
  sourceId: string
  text: string
}

export async function extractBrandRuleCandidate({ clientId, sourceType, sourceId, text }: ExtractionInput) {
  console.log(`[brand-learning] Called: source=${sourceType}, clientId=${clientId?.slice(0,8)}, textLen=${text?.length}`)
  if (!text || text.trim().length < 20) { console.log('[brand-learning] Skipped: text too short'); return }

  const prompt = `Aşağıdaki metin bir müşterinin ${sourceType} içeriğidir. Metinden markanın GENEL kural veya tercihi çıkar.

ÖNEMLİ KURALLAR:
- Sadece jenerik olarak uygulanabilir tercihler çıkar, tek bir brief'e özel detaylar değil
- Her kural şu yapıda olmalı:
  - rule_text: kısa ve net kural metni (Türkçe, max 100 karakter)
  - rule_condition: hangi koşulda geçerli ("Eğer ürün bikini/mayo ise", "Eğer Ramazan dönemindeyse", null = her zaman)
  - rule_type: "positive" (tercih) veya "negative" (yasak)
  - temporal: dönemsel mi (bayram, sezon, kampanya dönemi) true/false
- Aynı metinden birden fazla kural çıkabilir
- Duplicate ve çok benzer kurallar üretme — kavramsal olarak aynı şeyi söyleyen kuralları tek madde olarak ver
- Kural çıkarılamıyorsa boş array döndür
- JSON array formatında sadece kurallar döndür, açıklama yazma, markdown code fence yok

Metin:
"${text}"

JSON array:`

  try {
    console.log('[brand-learning] Calling Claude...')
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) { console.error('[brand-learning] ANTHROPIC_API_KEY missing!'); return }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[brand-learning] Claude API error ${res.status}:`, errText.slice(0, 200))
      return
    }

    const data = await res.json()
    const raw = (data.content?.[0]?.text || '').trim()
    console.log('[brand-learning] Claude response:', raw.slice(0, 200))
    const cleaned = raw.replace(/```json|```/g, '').trim()

    let candidates: any[]
    try {
      candidates = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('[brand-learning] JSON parse failed:', cleaned.slice(0, 100))
      return
    }

    if (!Array.isArray(candidates) || !candidates.length) {
      console.log('[brand-learning] No candidates extracted')
      return
    }

    console.log(`[brand-learning] ${candidates.length} candidates found`)

    for (const c of candidates) {
      if (!c.rule_text) continue
      const existing = await findSimilarCandidate(clientId, c.rule_text)
      if (existing) {
        const newSourceIds = [...(existing.source_ids || []), sourceId]
        const newSnippets = [...(existing.source_snippets || []), text.slice(0, 200)]
        const { error: upErr } = await supabase
          .from('brand_learning_candidates')
          .update({ source_ids: newSourceIds, source_snippets: newSnippets })
          .eq('id', existing.id)
        if (upErr) console.error('[brand-learning] Update error:', upErr.message)
        else console.log('[brand-learning] Merged with existing:', existing.id.slice(0, 8))
      } else {
        const { error: insErr } = await supabase.from('brand_learning_candidates').insert({
          client_id: clientId,
          source_type: sourceType,
          source_ids: [sourceId],
          source_snippets: [text.slice(0, 200)],
          rule_text: c.rule_text,
          rule_condition: c.rule_condition || null,
          rule_type: c.rule_type || 'positive',
          temporal: c.temporal || false,
        })
        if (insErr) console.error('[brand-learning] Insert error:', insErr.message)
        else console.log('[brand-learning] New candidate:', c.rule_text.slice(0, 50))
      }
    }
    console.log(`[brand-learning] Done: ${candidates.length} candidates for ${clientId.slice(0, 8)}`)
  } catch (err: any) {
    console.error('[brand-learning] extraction failed:', err.message, err.stack?.slice(0, 200))
  }
}

async function findSimilarCandidate(clientId: string, ruleText: string) {
  const { data } = await supabase
    .from('brand_learning_candidates')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'pending')
  if (!data) return null
  return data.find((c: any) => stringSimilarity.compareTwoStrings(c.rule_text.toLowerCase(), ruleText.toLowerCase()) > 0.6)
}

export async function getActiveBrandRules(clientId: string) {
  const { data } = await supabase
    .from('brand_rules')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  return data || []
}

export function buildBrandRulesBlock(rules: any[]): string {
  if (!rules.length) return ''
  return 'MARKA KURALLARI:\n' + rules.map((r: any) => {
    const cond = r.rule_condition ? ` (${r.rule_condition})` : ''
    const typeLabel = r.rule_type === 'positive' ? 'Tercih' : 'Yasak'
    return `- [${typeLabel}] ${r.rule_text}${cond}`
  }).join('\n') + '\n\nBu kurallara uyarak üretim yap. Koşul belirtilmişse o koşul sağlanıyorsa uygula.\n\n'
}
