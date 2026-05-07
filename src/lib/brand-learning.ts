import { createClient } from '@supabase/supabase-js'
import * as stringSimilarity from 'string-similarity'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ExtractionInput {
  clientId: string
  clientName?: string
  sourceType: string
  sourceId: string
  text: string
}

const EXTRACTION_PROMPT = (text: string, clientName?: string) => `Sen bir marka analisti yapay zekasın. Marka${clientName ? ` "${clientName}"` : ''} için verilen brief/feedback/araştırma metnini analiz et ve marka geneli için kıymetli, ileri vadede işe yarayacak yaratıcı yönlendirmeler çıkar.

ÇIKTI FORMAT — KRİTİK:
Her çıkarım iki ayrı alan kullanır:
- rule_text: Kuralın asıl içeriği. NE yapılacak veya yapılmayacak. Koşul içermez, temiz kural metni.
- rule_condition: Hangi durumda bu kural uygulanır. Marka geneli için her zaman geçerliyse null. Koşula bağlıysa kısa açıklama (örn "Premium müşteri kampanyaları", "Hedef kitle 25 altı", "Yaz/sezonluk kampanyalar").

PRENSİPLER:

1. SADECE GENELLENEBİLİR ÇIKARIMLAR
Tek brief'in detayına takılma. Yarın başka kampanya geldiğinde de geçerli olabilecek çıkarımlar üret. Somut, üretilebilir, görsel terimlere çevrilmiş olsun.

YANLIŞ: rule_text="Bacak hatları, etek kumaş hareketi"
DOĞRU: rule_text="Hareket halinde insan yakın çekimleri", rule_condition="Moda/giyim ürünleri"

2. CONDITIONAL ALANINI DOĞRU KULLAN
Koşul rule_text'e GÖMÜLMEMELİ, rule_condition'da olmalı.

YANLIŞ: rule_text="Eğer premium ürün ise minimalist tasarım kullan", rule_condition=null
DOĞRU: rule_text="Minimalist tasarım, zarif grafik, yavaş tempo", rule_condition="Premium ürün kampanyaları"

3. SIKI ELEME
1-3 gerçekten değerli çıkarım, 5-6 yüzeysel çıkarımdan iyidir. Hiçbir kıymetli içerik yoksa boş array döndür. ZORLA çıkarım üretme.

4. YORUMLAMA DERİNLİĞİ
Soyut kavramları somut görsel/davranışsal terimlere çevir:
"genç hissi" → "hızlı kesimler, modern müzik, sokak estetiği"
"lüks marka" → "yavaş tempo, derin gölgeler, minimal hareket, sade kompozisyon"
"anne hedef kitle" → "sıcak ışık, yumuşak ev içi sahneler, samimi yakın planlar"

5. TİPLER
- rule: pozitif yaratıcı yönlendirme (rule_type="positive")
- restriction: yasak/sınır (rule_type="negative")
- insight: yaratıcı görselleştirme ipucu (rule_type="positive")

6. KAÇIN
- Brief'in spesifik detaylarını tekrarlamak
- Belirsiz/yorumlamalı ifadeler ("etkili", "anlamlı")
- Conditional yapıyı rule_text içine gömmek ("Eğer X ise Y" → YANLIŞ)
- Renk kodları (#hex) üretmek — renkler ayrı yönetiliyor
- Ham metni kopyalamak

ÇIKTI JSON FORMAT:
[
  { "rule_text": "Yumuşak doğal ışık, sakin tempo, hızlı kesimsiz akış", "rule_condition": "Hedef kitle anne/aile odaklı kampanyalar", "rule_type": "positive", "type": "rule" },
  { "rule_text": "Sağlık iddiası veya garantileme yapma", "rule_condition": null, "rule_type": "negative", "type": "restriction" },
  { "rule_text": "Dokulu yüzeyler, doğal ışık, el hareketi yakın çekimleri", "rule_condition": null, "rule_type": "positive", "type": "insight" }
]

Kıymetli içerik yoksa: []
Sadece JSON array döndür.

Metin:
"${text}"

JSON array:`

export async function extractBrandRuleCandidate({ clientId, clientName, sourceType, sourceId, text }: ExtractionInput): Promise<{ extracted: number; inserted: number; duplicates: number; errors: number }> {
  const stats = { extracted: 0, inserted: 0, duplicates: 0, errors: 0 }
  console.log(`[brand-learning] Called: source=${sourceType}, clientId=${clientId?.slice(0,8)}, textLen=${text?.length}`)
  if (!text || text.trim().length < 20) { console.log('[brand-learning] Skipped: text too short'); return stats }

  const prompt = EXTRACTION_PROMPT(text, clientName)

  try {
    console.log(`[brand-learning] Calling Claude (interpretive, source=${sourceType})...`)
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) { console.error('[brand-learning] ANTHROPIC_API_KEY missing!'); return stats }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-opus-4-20250514',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      console.error(`[brand-learning] Claude API error ${res.status}:`, (await res.text()).slice(0, 200))
      return stats
    }

    const data = await res.json()
    const raw = (data.content?.[0]?.text || '').trim()
    console.log('[brand-learning] Claude response:', raw.slice(0, 300))

    let candidates: any[]
    try {
      candidates = JSON.parse(raw.replace(/```json|```/g, '').trim())
    } catch {
      console.error('[brand-learning] JSON parse failed:', raw.slice(0, 100))
      return stats
    }

    if (!Array.isArray(candidates) || !candidates.length) {
      console.log('[brand-learning] No candidates extracted')
      return stats
    }

    stats.extracted = candidates.length
    console.log(`[brand-learning] ${candidates.length} candidates from Claude`)

    for (const c of candidates) {
      const ruleText = c.rule_text || c.text
      if (!ruleText) continue
      const ruleType = c.type || 'rule'
      const ruleCondition = c.rule_condition || c.condition || null
      const existing = await findSimilarCandidate(clientId, ruleText)
      if (existing) {
        stats.duplicates++
        const newSourceIds = [...(existing.source_ids || []), sourceId]
        const newSnippets = [...(existing.source_snippets || []), text.slice(0, 200)]
        const { error: upErr } = await supabase.from('brand_learning_candidates')
          .update({ source_ids: newSourceIds, source_snippets: newSnippets })
          .eq('id', existing.id)
        if (upErr) { console.error('[brand-learning] Update error:', upErr.message); stats.errors++ }
      } else {
        const { error: insErr } = await supabase.from('brand_learning_candidates').insert({
          client_id: clientId,
          source_type: sourceType,
          source_ids: [sourceId],
          source_snippets: [text.slice(0, 200)],
          rule_text: ruleText,
          rule_condition: ruleCondition,
          rule_type: c.rule_type || (ruleType === 'restriction' ? 'negative' : 'positive'),
          type: ruleType,
          temporal: false,
        })
        if (insErr) { console.error('[brand-learning] Insert error:', insErr.message); stats.errors++ }
        else { stats.inserted++; console.log(`[brand-learning] New ${ruleType}: ${ruleText.slice(0, 50)}${ruleCondition ? ` [${ruleCondition}]` : ''}`) }
      }
    }
    console.log(`[brand-learning] Done: ${stats.extracted} extracted, ${stats.inserted} inserted, ${stats.duplicates} duplicates, ${stats.errors} errors`)
    return stats
  } catch (err: any) {
    console.error('[brand-learning] extraction failed:', err.message)
    return stats
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
