import { NextRequest, NextResponse } from 'next/server'
import { extractBrandRuleCandidate } from '@/lib/brand-learning'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

// POST: search for brand sources via Claude web search
export async function POST(req: NextRequest) {
  try {
    const { brandName } = await req.json()
    if (!brandName) return NextResponse.json({ error: 'brandName gerekli' }, { status: 400 })

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2025-04-14', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305' }],
        messages: [{ role: 'user', content: `"${brandName}" markası hakkında güvenilir kaynak URL'leri bul. Şu kaynak tiplerini ara:
- Wikipedia sayfası
- Resmi web sitesi (about/hakkımızda sayfası)
- LinkedIn şirket sayfası
- Instagram veya Twitter/X profili
- Güvenilir marka analiz makaleleri

Sadece gerçek, erişilebilir URL'ler döndür. Her URL için kaynak tipini belirt.

JSON array olarak döndür, başka bir şey yazma:
[
  { "url": "https://...", "type": "Wikipedia", "title": "..." },
  { "url": "https://...", "type": "Resmi Site", "title": "..." }
]

Bulamadığın kaynak tiplerini atla. Sadece JSON array döndür.` }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[brand-research] Claude error:', err.slice(0, 300))
      return NextResponse.json({ error: 'Arama başarısız' }, { status: 500 })
    }

    const data = await res.json()

    console.log('[brand-research] stop_reason:', data.stop_reason)
    console.log('[brand-research] content blocks:', JSON.stringify((data.content || []).map((b: any) => ({ type: b.type, text: b.type === 'text' ? b.text?.slice(0, 200) : undefined }))))

    // Extract text from response (may have multiple content blocks due to web search)
    let text = ''
    for (const block of data.content || []) {
      if (block.type === 'text') text += block.text
    }

    console.log('[brand-research] extracted text:', text.slice(0, 500))

    // Also collect URLs from web_search_tool_result blocks (citations)
    const citationUrls: any[] = []
    for (const block of data.content || []) {
      if (block.type === 'web_search_tool_result' && block.content) {
        for (const result of block.content) {
          if (result.type === 'web_search_result' && result.url) {
            citationUrls.push({ url: result.url, type: 'Web', title: result.title || result.url })
          }
        }
      }
    }
    if (citationUrls.length > 0) {
      console.log('[brand-research] citation URLs found:', citationUrls.length)
    }

    let sources: any[] = []
    try {
      sources = JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch {
      // Try to extract JSON array from text
      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        try { sources = JSON.parse(match[0]) } catch {}
      }
    }

    if (!Array.isArray(sources)) sources = []

    // If Claude didn't return JSON sources but we have citation URLs, use those
    if (sources.length === 0 && citationUrls.length > 0) {
      sources = citationUrls
    }

    // Also merge citation URLs into sources if they add new ones
    if (citationUrls.length > 0 && sources.length > 0) {
      const existingUrls = new Set(sources.map((s: any) => s.url))
      for (const c of citationUrls) {
        if (!existingUrls.has(c.url)) sources.push(c)
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>()
    sources = sources.filter(s => {
      if (!s.url || seen.has(s.url)) return false
      seen.add(s.url)
      return true
    })

    return NextResponse.json({ sources })
  } catch (err: any) {
    console.error('[brand-research] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT: fetch selected URLs, extract rules
export async function PUT(req: NextRequest) {
  try {
    const { clientId, urls } = await req.json()
    if (!clientId || !urls?.length) return NextResponse.json({ error: 'clientId ve urls gerekli' }, { status: 400 })

    // Fetch each URL content
    const contents: string[] = []
    for (const url of urls) {
      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DinamoBot/1.0)' },
          signal: AbortSignal.timeout(10000),
        })
        if (!r.ok) continue
        const html = await r.text()
        // Basic HTML to text: strip tags, decode entities, trim
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 8000) // Limit per source
        if (text.length > 100) contents.push(text)
      } catch { continue }
    }

    if (!contents.length) {
      return NextResponse.json({ error: 'Hiçbir kaynak parse edilemedi', candidateCount: 0 })
    }

    // Join all contents
    const combinedText = contents.join('\n\n---\n\n')

    // Use existing extraction pipeline
    await extractBrandRuleCandidate({
      clientId,
      sourceType: 'seed_import',
      sourceId: `research_${Date.now()}`,
      text: combinedText.slice(0, 25000),
    })

    return NextResponse.json({ ok: true, sourceCount: contents.length })
  } catch (err: any) {
    console.error('[brand-research] PUT error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
