import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { ugc_video_id, revision_comment } = await req.json()
  if (!ugc_video_id || !revision_comment?.trim()) return NextResponse.json({ error: 'ugc_video_id ve revision_comment gerekli' }, { status: 400 })

  // Get current video + brief
  const { data: video } = await supabase.from('ugc_videos').select('*, briefs(*, clients(*))').eq('id', ugc_video_id).single()
  if (!video) return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })
  if (video.status !== 'ready') return NextResponse.json({ error: 'Sadece hazır videolar revize edilebilir' }, { status: 400 })

  const brief = video.briefs
  const clientUserId = brief?.client_user_id
  const clientId = brief?.client_id
  if (!clientUserId) return NextResponse.json({ error: 'Müşteri bilgisi bulunamadı' }, { status: 400 })

  // Credit check
  const { data: cu } = await supabase.from('client_users').select('allocated_credits').eq('id', clientUserId).single()
  if (!cu || cu.allocated_credits < 1) return NextResponse.json({ error: 'Yetersiz kredi' }, { status: 402 })

  // Generate revised script via Claude
  const persona = await supabase.from('personas').select('*').eq('id', video.persona_id).single()
  const settings = brief.ugc_settings || {}
  const tone = settings.tone || 'samimi'
  const includeCta = settings.cta !== false

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

  const currentScript = brief.ugc_scripts?.[String(video.persona_id)]
  const currentDialogue = currentScript?.segments?.map((s: any) => s.dialogue).join(' ') || ''

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `Sen TikTok UGC senaryocususun. Müşteri önceki videodan memnun değil ve revizyon istiyor.

MÜŞTERİ YORUMU: "${revision_comment}"
MEVCUT SCRİPT: "${currentDialogue}"
PERSONA: ${persona.data?.name} — ${persona.data?.tone_description}
TON: ${tone === 'samimi' ? 'Samimi' : tone === 'resmi' ? 'Resmi' : 'Normal'}
CTA: ${includeCta ? 'Var' : 'Yok'}

Yorumu dikkate al, scripti yeniden yaz. 2 segment, toplam 80-100 karakter.
Yorumda açık istek varsa uygula. Belirsizse farklı varyasyon yaz.

JSON: {"segments": [{"timestamp": "00:00-00:04", "camera": "medium shot", "action": "...", "dialogue": "40-50 char"}, {"timestamp": "00:04-00:08", "camera": "close-up shot", "action": "...", "dialogue": "40-50 char"}]}`,
      messages: [{ role: 'user', content: `Brief: ${brief.campaign_name}\nMesaj: ${brief.message || ''}\nYorum: ${revision_comment}\n\nJSON:` }],
    }),
  })

  if (!res.ok) return NextResponse.json({ error: 'AI hatası' }, { status: 500 })
  const data = await res.json()
  const text = (data.content?.[0]?.text || '').trim()
  let newScript
  try { newScript = JSON.parse(text.replace(/```json|```/g, '').trim()) } catch { return NextResponse.json({ error: 'Parse hatası' }, { status: 500 }) }

  // Update script in brief
  const updatedScripts = { ...(brief.ugc_scripts || {}), [String(video.persona_id)]: { segments: newScript.segments, edited: false, generated_at: new Date().toISOString() } }
  await supabase.from('briefs').update({ ugc_scripts: updatedScripts }).eq('id', brief.id)

  // Deduct credit
  await supabase.from('client_users').update({ allocated_credits: cu.allocated_credits - 1 }).eq('id', clientUserId)
  await supabase.from('credit_transactions').insert({ client_id: clientId, client_user_id: clientUserId, brief_id: brief.id, amount: -1, type: 'deduct', description: 'AI UGC revizyon' })

  // Create new ugc_videos record
  const revisionCount = (video.revision_count || 0) + 1
  const { data: newVideo, error: insErr } = await supabase.from('ugc_videos').insert({
    brief_id: brief.id,
    persona_id: video.persona_id,
    script: newScript,
    product_image_used: video.product_image_used,
    status: 'queued',
    revision_of_id: ugc_video_id,
    revision_comment: revision_comment.trim(),
    revision_count: revisionCount,
  }).select('id').single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // Update brief reference
  await supabase.from('briefs').update({ ugc_video_id: newVideo.id, ugc_status: 'queued' }).eq('id', brief.id)

  return NextResponse.json({ ugc_video_id: newVideo.id, status: 'queued', revision_count: revisionCount })
}
