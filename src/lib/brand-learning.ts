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

const PROMPT_LITERAL = (sourceType: string, text: string) => `Bu metin bir müşterinin ${sourceType} içeriğidir. LITERAL yaklaş — metinde açıkça geçen kural veya yasakları çıkar. Fantezi yapma, genelleme yapma, yorum ekleme.

Her madde şu yapıda:
- type: "rule" (pozitif talimat) veya "restriction" (yasak)
- text: kısa net Türkçe cümle, max 100 karakter
- condition: hangi koşulda geçerli, yoksa null

Duplicate ve çok benzer kurallar üretme, tek madde olarak ver. Metinde açık bir kural yoksa boş array döndür. Sadece JSON array döndür, açıklama yazma, markdown code fence yok.

Metin:
"${text}"

JSON array:`

const PROMPT_INTERPRETIVE = (text: string) => `Bu metin admin tarafından yazılan/yapıştırılan bir marka bilgi kaynağıdır (wiki, analiz, marka dosyası, sektör bilgisi, serbest notlar). YORUMSAL yaklaş — bu bilgiyi işleyerek markaya dair faydalı çıktılar üret.

3 tip çıktı üretebilirsin:
- type "rule": açık pozitif talimat ("Mavi rengi ön plana çıkar")
- type "restriction": açık yasak ("Erkek figürü gösterme")
- type "insight": bu bilgiden türeyen yaratıcı yönlendirme — markanın DNA'sından görselleştirme ipuçları çıkar, "Marka ne hissi vermeli, nasıl görünmeli" sorusunu cevapla. Örnek: metin "el yapımı zanaat" bahsediyorsa insight "Dokulu yüzeyler, doğal ışık ve el hareketi vurgulanmalı"

Her madde:
- type: "rule" | "restriction" | "insight"
- text: max 150 karakter
- condition: opsiyonel, yoksa null

Insight'lar yaratıcı ve kreatif olsun, markanın ruhunu yakalasın. Ham metni olduğu gibi kopyalama, mutlaka işle ve yorum üret. Duplicate üretme. Faydasız şişme bilgi çıkarma — sadece üretime fayda verecek olanlar. Sadece JSON array döndür.

Metin:
"${text}"

JSON array:`

export async function extractBrandRuleCandidate({ clientId, sourceType, sourceId, text }: ExtractionInput) {
  console.log(`[brand-learning] Called: source=${sourceType}, clientId=${clientId?.slice(0,8)}, textLen=${text?.length}`)
  if (!text || text.trim().length < 20) { console.log('[brand-learning] Skipped: text too short'); return }

  const isInterpretive = ['admin_notes', 'seed_import'].includes(sourceType)
  const prompt = isInterpretive ? PROMPT_INTERPRETIVE(text) : PROMPT_LITERAL(sourceType, text)

  try {
    console.log(`[brand-learning] Calling Claude (${isInterpretive ? 'interpretive' : 'literal'})...`)
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) { console.error('[brand-learning] ANTHROPIC_API_KEY missing!'); return }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      console.error(`[brand-learning] Claude API error ${res.status}:`, (await res.text()).slice(0, 200))
      return
    }

    const data = await res.json()
    const raw = (data.content?.[0]?.text || '').trim()
    console.log('[brand-learning] Claude response:', raw.slice(0, 300))

    let candidates: any[]
    try {
      candidates = JSON.parse(raw.replace(/```json|```/g, '').trim())
    } catch {
      console.error('[brand-learning] JSON parse failed:', raw.slice(0, 100))
      return
    }

    if (!Array.isArray(candidates) || !candidates.length) {
      console.log('[brand-learning] No candidates extracted')
      return
    }

    console.log(`[brand-learning] ${candidates.length} candidates found`)

    for (const c of candidates) {
      if (!c.text) continue
      const ruleType = c.type || 'rule'
      const existing = await findSimilarCandidate(clientId, c.text)
      if (existing) {
        const newSourceIds = [...(existing.source_ids || []), sourceId]
        const newSnippets = [...(existing.source_snippets || []), text.slice(0, 200)]
        const { error: upErr } = await supabase.from('brand_learning_candidates')
          .update({ source_ids: newSourceIds, source_snippets: newSnippets })
          .eq('id', existing.id)
        if (upErr) console.error('[brand-learning] Update error:', upErr.message)
      } else {
        const { error: insErr } = await supabase.from('brand_learning_candidates').insert({
          client_id: clientId,
          source_type: sourceType,
          source_ids: [sourceId],
          source_snippets: [text.slice(0, 200)],
          rule_text: c.text,
          rule_condition: c.condition || null,
          rule_type: ruleType === 'restriction' ? 'negative' : 'positive',
          type: ruleType,
          temporal: false,
        })
        if (insErr) console.error('[brand-learning] Insert error:', insErr.message)
        else console.log(`[brand-learning] New ${ruleType}: ${c.text.slice(0, 50)}`)
      }
    }
    console.log(`[brand-learning] Done: ${candidates.length} for ${clientId.slice(0, 8)}`)
  } catch (err: any) {
    console.error('[brand-learning] extraction failed:', err.message)
  }
}

async function findSimilarCandidate(clientId: string, ruleText: string) {
  const { data } = await supabase.from('brand_learning_candidates').select('*').eq('client_id', clientId).eq('status', 'pending')
  if (!data) return null
  return data.find((c: any) => stringSimilarity.compareTwoStrings(c.rule_text.toLowerCase(), ruleText.toLowerCase()) > 0.6)
}

export async function getActiveBrandRules(clientId: string) {
  const { data } = await supabase.from('brand_rules').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
  return data || []
}

export function buildBrandRulesBlock(rules: any[]): string {
  if (!rules.length) return ''

  const ruleItems = rules.filter(r => r.type === 'rule' || (!r.type && r.rule_type === 'positive'))
  const restrictions = rules.filter(r => r.type === 'restriction' || (!r.type && r.rule_type === 'negative'))
  const insights = rules.filter(r => r.type === 'insight')

  const sections: string[] = []
  if (ruleItems.length) {
    sections.push('MARKA KURALLARI:\n' + ruleItems.map(r => {
      const cond = r.rule_condition ? ` (${r.rule_condition})` : ''
      return `- ${r.rule_text}${cond}`
    }).join('\n'))
  }
  if (restrictions.length) {
    sections.push('MARKA YASAKLARI:\n' + restrictions.map(r => {
      const cond = r.rule_condition ? ` (${r.rule_condition})` : ''
      return `- ${r.rule_text}${cond}`
    }).join('\n'))
  }
  if (insights.length) {
    sections.push('YARATICI YÖNLENDİRMELER:\n' + insights.map(r => `- ${r.rule_text}`).join('\n'))
  }

  if (!sections.length) return ''
  return sections.join('\n\n') + '\n\nBu kurallar, yasaklar ve yönlendirmeleri dikkate alarak üretim yap. Koşul belirtilmişse o koşul sağlanıyorsa uygula.\n\n'
}
