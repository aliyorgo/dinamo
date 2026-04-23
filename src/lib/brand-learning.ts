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
  if (!text || text.trim().length < 20) return

  const prompt = `Aşağıdaki metin bir müşterinin ${sourceType} içeriğidir. Metinden markanın GENEL kural veya tercihi çıkar.

ÖNEMLİ KURALLAR:
- Sadece jenerik olarak uygulanabilir tercihler çıkar, tek bir brief'e özel detaylar değil
- Her kural şu yapıda olmalı:
  - rule_text: kısa ve net kural metni (Türkçe, max 100 karakter)
  - rule_condition: hangi koşulda geçerli ("Eğer ürün bikini/mayo ise", "Eğer Ramazan dönemindeyse", null = her zaman)
  - rule_type: "positive" (tercih) veya "negative" (yasak)
  - temporal: dönemsel mi (bayram, sezon, kampanya dönemi) true/false
- Aynı metinden birden fazla kural çıkabilir
- Kural çıkarılamıyorsa boş array döndür
- JSON array formatında sadece kurallar döndür, açıklama yazma, markdown code fence yok

Metin:
"${text}"

JSON array:`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    const raw = (data.content?.[0]?.text || '').trim()
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const candidates = JSON.parse(cleaned)
    if (!Array.isArray(candidates) || !candidates.length) return

    for (const c of candidates) {
      const existing = await findSimilarCandidate(clientId, c.rule_text)
      if (existing) {
        const newSourceIds = [...(existing.source_ids || []), sourceId]
        const newSnippets = [...(existing.source_snippets || []), text.slice(0, 200)]
        await supabase
          .from('brand_learning_candidates')
          .update({ source_ids: newSourceIds, source_snippets: newSnippets })
          .eq('id', existing.id)
      } else {
        await supabase.from('brand_learning_candidates').insert({
          client_id: clientId,
          source_type: sourceType,
          source_ids: [sourceId],
          source_snippets: [text.slice(0, 200)],
          rule_text: c.rule_text,
          rule_condition: c.rule_condition || null,
          rule_type: c.rule_type || 'positive',
          temporal: c.temporal || false,
        })
      }
    }
    console.log(`[brand-learning] Extracted ${candidates.length} candidates for ${clientId.slice(0, 8)}`)
  } catch (err: any) {
    console.error('[brand-learning] extraction failed:', err.message)
  }
}

async function findSimilarCandidate(clientId: string, ruleText: string) {
  const { data } = await supabase
    .from('brand_learning_candidates')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'pending')
  if (!data) return null
  return data.find((c: any) => stringSimilarity.compareTwoStrings(c.rule_text.toLowerCase(), ruleText.toLowerCase()) > 0.75)
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
