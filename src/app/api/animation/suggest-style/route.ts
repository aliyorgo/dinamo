import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { brief_id } = await req.json()
    if (!brief_id) return NextResponse.json({ error: 'brief_id gerekli' }, { status: 400 })

    const { data: brief } = await supabase.from('briefs').select('campaign_name, message, target_audience, cta, client_id, clients(mascot_enabled, mascot_image_url, mascot_name)').eq('id', brief_id).single()
    if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

    // Get available styles for this brand
    const { data: assigned } = await supabase.from('brand_animation_styles').select('style_id, animation_styles(slug, label, mood_hints)').eq('client_id', brief.client_id)
    const mascotEnabled = (brief.clients as any)?.mascot_enabled && (brief.clients as any)?.mascot_image_url

    // Build style list for Claude — mascot brands get ONLY mascot styles
    let styleOptions: string[] = []
    if (mascotEnabled) {
      const mascotName = (brief.clients as any)?.mascot_name || 'Maskot'
      styleOptions.push(`mascot_only: ${mascotName} MASKOT (playful, fun, joyful)`)
      styleOptions.push(`mascot_hybrid: ${mascotName} + GERCEK HIBRIT (playful, cinematic, magical)`)
    } else {
      styleOptions = (assigned || []).map((a: any) => `${a.animation_styles?.slug}: ${a.animation_styles?.label} (${(a.animation_styles?.mood_hints || []).join(', ')})`).filter(Boolean)
    }
    if (styleOptions.length === 0) return NextResponse.json({ error: 'Bu marka icin atanmis stil yok' }, { status: 400 })

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-opus-4-20250514', max_tokens: 500,
        system: `Sen bir animasyon direktörüsün. Verilen brief'e en uygun animasyon stilini seç ve o stilde 25-30 kelimelik Türkçe dış ses metni yaz. JSON dön.`,
        messages: [{ role: 'user', content: `Brief: ${brief.campaign_name}\nMesaj: ${brief.message || ''}\nHedef Kitle: ${brief.target_audience || ''}\nCTA: ${brief.cta || ''}\n\nMevcut stiller:\n${styleOptions.join('\n')}\n\nJSON formatı: {"suggestedStyleSlug":"slug","voiceoverText":"25-30 kelime Türkçe dış ses"}` }],
      }),
    })
    const aiData = await res.json()
    const text = (aiData.content?.[0]?.text || '').trim()
    const clean = text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)

    return NextResponse.json({ suggestedStyleSlug: result.suggestedStyleSlug, voiceoverText: result.voiceoverText || '' })
  } catch (err: any) {
    console.error('[animation/suggest-style] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
