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

const EXTRACTION_PROMPT = (text: string) => `Bu metin bir markaya ait kaynak (brief, admin notu, marka dokümanı, sektör bilgisi, müşteri yazışması). Senin işin: yüzeysel kural çıkarmak değil, MARKAYI ANLAMAK ve üretime fayda sağlayacak yorumlanmış yönlendirmeler çıkarmak.

ÖNCE METNİ ANLA (output'a yazma, mental olarak yap):
- Markanın sektörü ve kategorisi ne (kozmetik, FMCG, bebek ürünleri, hizmet, B2B, lüks, vs.)
- Hedef kitlesi kim (yaş, demografi, gelir seviyesi, hayat tarzı)
- Marka pozisyonu nasıl (premium, kitle, yerli, küresel, sürdürülebilir, vs.)
- Sektörün konvansiyonları ve riskleri ne (örn: bebek ürünlerinde hızlı kesim olmaz, alkol kategorisinde aile vurgusu yapılmaz, sağlık iddialarında abartı yasak)

SONRA 3 TİP ÇIKTI ÜRET:

"rule" — pozitif yaratıcı yönlendirme. Spesifik literal kural değil, üst seviye yaklaşım.
"restriction" — yapılmayacak şey, yasak, sınır.
"insight" — markanın DNA'sından türeyen yaratıcı görselleştirme ipucu.

YORUMLAMA DERİNLİĞİ:
Metinde "genç hissi" yazıyorsa "genç hissi ver" diye yazma. Bunu "hızlı kesimler, modern müzik, sokak estetiği, yatay kamera hareketleri" gibi somut yaratıcı yönlendirmeye çevir.
Metinde "el yapımı zanaat" yazıyorsa "el yapımı vurgula" yerine "dokulu yüzeyler, doğal ışık, el hareketi yakın çekimleri" yaz.
Metinde "lüks marka" yazıyorsa "lüks görünüm" değil "yavaş tempo, derin gölgeler, minimal hareket, sade kompozisyon" yaz.
Metinde "anne hedef kitle" yazıyorsa "anneler için" değil "sıcak ışık, yumuşak ev içi sahneler, samimi yakın planlar" yaz.

Tüm output somut, üretilebilir, görsel terimlere çevrilmiş olsun. Soyut kalmasın.

CONDITION KULLAN:
Bir kural/insight her brief için geçerli olmayabilir. Koşul varsa belirt:
- Kategori bazlı: "Eğer ürün kozmetik kategorisinde ise"
- Zaman bazlı: "Eğer sevgililer günü dönemi ise"
- Ürün bazlı: "Eğer alkollü içecek ise"
- Demografi bazlı: "Eğer hedef 50+ kitle ise"
- Format bazlı: "Eğer dikey video ise"
Genel geçer kural ise condition null bırak.

SEKTÖR BİLGİSİNİ KULLAN:
Markanın sektörünü anladıktan sonra o sektörün bilinen pattern'larını ve risklerini kullan. Bebek ürünleri → yumuşak ışık. Lüks otomotiv → yavaş kamera, derin gölge. Hızlı tüketim → renkli, yüksek tempo. Sağlık ürünü → sade, güvenilir ton, abartı yok. Bu bilgiyi prompt'tan değil, kendi bilgi tabanından getir.

KISITLAR:
- type: "rule" | "restriction" | "insight"
- text: max 150 karakter
- condition: opsiyonel string veya null
- Renk kodları (#hex) veya "ana renk X" tarzı kurallar ÜRETME — renkler ayrı yönetiliyor
- Duplicate üretme
- Faydasız şişme bilgi üretme
- Soyut, yorumlanmamış cümle çıkarma — hep somut görsel/davranışsal terimlere çevir
- Ham metni kopyalama

ÖRNEK ÇIKTILAR:

[
  { "type": "rule", "text": "Yumuşak doğal ışık, sakin tempo, hızlı kesimsiz akış", "condition": "Eğer hedef kitle anne veya bebek ise" },
  { "type": "restriction", "text": "Erkek figürü gösterme", "condition": "Eğer ürün iç giyim/mayo ise" },
  { "type": "insight", "text": "Dokulu yüzeyler, doğal ışık ve el hareketi yakın çekimleri", "condition": null },
  { "type": "rule", "text": "Yavaş kamera hareketleri, derin gölgeler, minimal kompozisyon", "condition": "Eğer marka lüks segment ise" },
  { "type": "restriction", "text": "Sağlık iddiası yapma, fayda abartısından kaçın", "condition": null }
]

Sadece JSON array döndür.

Metin:
"${text}"

JSON array:`

export async function extractBrandRuleCandidate({ clientId, sourceType, sourceId, text }: ExtractionInput): Promise<{ extracted: number; inserted: number; duplicates: number; errors: number }> {
  const stats = { extracted: 0, inserted: 0, duplicates: 0, errors: 0 }
  console.log(`[brand-learning] Called: source=${sourceType}, clientId=${clientId?.slice(0,8)}, textLen=${text?.length}`)
  if (!text || text.trim().length < 20) { console.log('[brand-learning] Skipped: text too short'); return stats }

  const prompt = EXTRACTION_PROMPT(text)

  try {
    console.log(`[brand-learning] Calling Claude (interpretive, source=${sourceType})...`)
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) { console.error('[brand-learning] ANTHROPIC_API_KEY missing!'); return stats }

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
      if (!c.text) continue
      const ruleType = c.type || 'rule'
      const existing = await findSimilarCandidate(clientId, c.text)
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
          rule_text: c.text,
          rule_condition: c.condition || null,
          rule_type: ruleType === 'restriction' ? 'negative' : 'positive',
          type: ruleType,
          temporal: false,
        })
        if (insErr) { console.error('[brand-learning] Insert error:', insErr.message); stats.errors++ }
        else { stats.inserted++; console.log(`[brand-learning] New ${ruleType}: ${c.text.slice(0, 50)}`) }
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
