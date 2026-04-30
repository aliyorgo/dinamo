import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getActiveBrandRules, buildBrandRulesBlock } from '@/lib/brand-learning'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const MODEL_INFO: Record<string,string> = {
  kling: 'Kling AI video generation model. Supports text-to-video and image-to-video. Best with detailed scene descriptions, camera movements, and style keywords.',
  runway: 'Runway Gen-3 Alpha. Text-to-video and image-to-video. Supports camera controls, motion descriptions. Works best with cinematic language.',
  midjourney: 'Midjourney v6 image generation. Text-to-image. Uses --ar for aspect ratio, --v 6 for version. Best with descriptive artistic prompts.',
  veo: 'Google Veo 2. Text-to-video. Supports long descriptions, cinematic styles, camera movements.',
  luma: 'Luma Dream Machine. Text-to-video and image-to-video. Supports motion descriptions and style keywords.',
  'nano-banana': 'Google Gemini Nano Banana. Image and video generation model. Supports detailed scene descriptions, style control, and cinematic prompts.',
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { inspiration_id, model, user_id } = body

    // Role check — only creators can generate prompts
    if (user_id) {
      const { data: roleData } = await supabase.from('users').select('role').eq('id', user_id).single()
      if (roleData && roleData.role !== 'creator') {
        return NextResponse.json({ error: 'Sadece creator prompt üretebilir' }, { status: 403 })
      }
    }
    console.log('[prompts] POST received:', { inspiration_id, model })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[prompts] ANTHROPIC_API_KEY not set')
      return NextResponse.json({ error: 'API key yok' }, { status: 500 })
    }
    if (!MODEL_INFO[model]) {
      console.error('[prompts] Invalid model:', model)
      return NextResponse.json({ error: 'Geçersiz model' }, { status: 400 })
    }

    const { data: insp, error: inspErr } = await supabase.from('brief_inspirations').select('*, briefs(video_type, client_id)').eq('id', inspiration_id).single()
    if (inspErr) console.error('[prompts] DB error:', inspErr.message)
    if (!insp) return NextResponse.json({ error: 'Fikir bulunamadı' }, { status: 404 })
    console.log('[prompts] Inspiration:', insp.title, 'scenario type:', typeof insp.scenario)

    // Safe scenario parse — could be JSON array, JSON string, or raw text
    let scenarioText = ''
    if (insp.scenario) {
      if (typeof insp.scenario === 'string') {
        try {
          const p = JSON.parse(insp.scenario)
          scenarioText = JSON.stringify(Array.isArray(p) ? p : p?.scenario || p)
        } catch {
          scenarioText = insp.scenario // raw text
        }
      } else {
        scenarioText = JSON.stringify(insp.scenario)
      }
    } else if (insp.scenes) {
      const scenes = Array.isArray(insp.scenes) ? insp.scenes.join('. ') : String(insp.scenes)
      scenarioText = scenes
    }
    console.log('[prompts] Scenario text length:', scenarioText.length)

    const rules = insp.briefs?.client_id ? await getActiveBrandRules(insp.briefs.client_id) : []
    const rulesBlock = buildBrandRulesBlock(rules)

    console.log('[prompts] Calling Anthropic API...')
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: 'Sen AI video üretim prompt mühendisisin. Yanıtın SADECE JSON olsun. Markdown code block kullanma.',
        messages: [{ role: 'user', content: `${rulesBlock}Bu video konsepti ve senaryosu için profesyonel, kullanıma hazır tek bir video prompt yaz.

Konsept: ${insp.title} — ${insp.concept}
Senaryo: ${scenarioText}

Kurallar:
- İngilizce yaz (AI modeller İngilizce daha iyi çalışır)
- Tek bir paragraf prompt, sahne sahne değil bütüncül
- Model adı belirtme, generic format
- Kopyala-yapıştır hazır olsun

Sadece JSON döndür:
{"prompt":"kullanıma hazır prompt"}` }]
      })
    })

    console.log('[prompts] API status:', res.status)
    if (!res.ok) {
      const errBody = await res.text()
      console.error('[prompts] API error:', errBody.substring(0, 300))
      return NextResponse.json({ error: `AI hatası (${res.status})`, details: errBody.substring(0, 200) }, { status: res.status })
    }

    const data = await res.json()
    const text = (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    console.log('[prompts] Response length:', text.length)
    console.log('[prompts] Response preview:', text.substring(0, 200))

    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim()
    let parsed: any = null
    try {
      parsed = JSON.parse(cleaned)
      console.log('[prompts] Direct parse OK')
    } catch (e1) {
      console.log('[prompts] Direct parse failed:', (e1 as Error).message)
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (m) {
        try {
          parsed = JSON.parse(m[0])
          console.log('[prompts] Regex parse OK')
        } catch (e2) {
          console.error('[prompts] Regex parse failed:', (e2 as Error).message)
        }
      }
    }

    if (!parsed?.prompts || !Array.isArray(parsed.prompts)) {
      console.error('[prompts] No valid prompts array. Keys:', parsed ? Object.keys(parsed) : 'null')
      return NextResponse.json({ error: 'Parse hatası', raw: text.substring(0, 200) }, { status: 500 })
    }

    console.log('[prompts] Parsed', parsed.prompts.length, 'prompts. Saving...')

    // Delete old prompts for this model
    const { error: delErr } = await supabase.from('inspiration_prompts').delete().eq('inspiration_id', inspiration_id).eq('model', model)
    console.log('[prompts] Delete old result:', delErr ? delErr.message : 'OK')

    // Insert new — one by one for better error tracking
    const results: any[] = []
    for (const p of parsed.prompts) {
      const row = { inspiration_id, model, scene: p.scene || 1, prompt: p.prompt || '' }
      console.log('[prompts] Inserting scene', row.scene, 'prompt length:', row.prompt.length)

      const { data: insertData, error: insertError } = await supabase
        .from('inspiration_prompts')
        .insert(row)
        .select('*')
        .single()

      console.log('[prompts] Insert result:', insertData?.id || 'null', insertError?.message || 'OK')

      if (insertError) {
        console.error('[prompts] Insert error detail:', insertError.message, insertError.details, insertError.hint)
        return NextResponse.json({ error: insertError.message, model, prompts: parsed.prompts }, { status: 500 })
      }
      if (insertData) results.push(insertData)
    }

    console.log('[prompts] All inserted:', results.length, 'prompts')
    return NextResponse.json({ model, prompts: results.length > 0 ? results : parsed.prompts })

  } catch (err) {
    console.error('[prompts] Unexpected error:', err)
    return NextResponse.json({ error: 'Beklenmeyen hata: ' + String(err) }, { status: 500 })
  }
}
