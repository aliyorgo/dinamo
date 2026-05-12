import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { brief_id, style_slug } = await req.json()
    if (!brief_id || !style_slug) return NextResponse.json({ error: 'brief_id ve style_slug gerekli' }, { status: 400 })

    const [{ data: brief }, { data: style }] = await Promise.all([
      supabase.from('briefs').select('campaign_name, message, target_audience, cta').eq('id', brief_id).single(),
      supabase.from('animation_styles').select('label, mood_hints, prompt_template').eq('slug', style_slug).single(),
    ])
    if (!brief || !style) return NextResponse.json({ error: 'Brief veya stil bulunamadı' }, { status: 404 })

    const moodStr = (style.mood_hints || []).join(', ')
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-opus-4-20250514', max_tokens: 300,
        system: `Sen bir reklam metin yazarısın. ${style.label} tarzında animasyon için 25-30 kelimelik Türkçe dış ses metni yaz. Stilin mood'u: ${moodStr}. Broadcast kalitesinde, doğal ritimli, nokta veya ünlemle biten. Sadece metni dön, başka bir şey yazma.`,
        messages: [{ role: 'user', content: `Kampanya: ${brief.campaign_name}\nBrief: ${brief.message || ''}\nHedef Kitle: ${brief.target_audience || ''}\nCTA: ${brief.cta || ''}\n\nDış ses metni:` }],
      }),
    })
    const aiData = await res.json()
    const voiceoverText = (aiData.content?.[0]?.text || '').trim().replace(/^["']|["']$/g, '')

    return NextResponse.json({ voiceoverText })
  } catch (err: any) {
    console.error('[animation/generate-voiceover] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
