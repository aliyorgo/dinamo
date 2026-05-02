import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { brief_id } = await req.json()
  if (!brief_id) return NextResponse.json({ error: 'brief_id gerekli' }, { status: 400 })

  const { data: brief } = await supabase.from('briefs').select('campaign_name, message, product_image_url').eq('id', brief_id).single()
  if (!brief?.product_image_url) return NextResponse.json({ product_works_in_video: true, warning_message: '', suggested_toggle_default: true })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: [
        { type: 'text', text: `Bu ürün fotoğrafını analiz et. UGC (user generated content) video'da Veo AI ile birlikte kullanılacak.\n\nBrief: ${brief.campaign_name} — ${brief.message || ''}\n\nKüçük, elde tutulan ürünler (telefon, kozmetik, yemek, aksesuar) videoda İYİ çalışır.\nBüyük ürünler (mobilya, araba, beyaz eşya) videoda KÖTÜ çalışır.\n\nSadece JSON dön:\n{"product_works_in_video": true/false, "warning_message": "kısa uyarı veya boş string", "suggested_toggle_default": true/false}` },
        { type: 'image', source: { type: 'url', url: brief.product_image_url } }
      ] }],
    }),
  })

  if (!res.ok) return NextResponse.json({ product_works_in_video: true, warning_message: '', suggested_toggle_default: true })
  const data = await res.json()
  const text = (data.content?.[0]?.text || '').trim()
  try {
    return NextResponse.json(JSON.parse(text.replace(/```json|```/g, '').trim()))
  } catch {
    return NextResponse.json({ product_works_in_video: true, warning_message: '', suggested_toggle_default: true })
  }
}
