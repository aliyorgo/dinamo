import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { text, voice_id } = await req.json()

  if (!text || !voice_id) return NextResponse.json({ error: 'text ve voice_id gerekli' }, { status: 400 })
  if (text.length > 500) return NextResponse.json({ error: 'Metin 500 karakteri aşamaz' }, { status: 400 })

  // Verify brief exists
  const { data: brief } = await supabase.from('briefs').select('id, campaign_name').eq('id', id).single()
  if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

  // Generate speech via ElevenLabs
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    return NextResponse.json({ error: 'ElevenLabs üretim hatası', detail: errBody }, { status: 500 })
  }

  const audioBuffer = await res.arrayBuffer()
  const fileName = `voiceover_${id}_${Date.now()}.mp3`
  const storagePath = `${id}/${fileName}`

  // Upload to Supabase Storage
  const { error: upErr } = await supabase.storage.from('audio').upload(storagePath, Buffer.from(audioBuffer), {
    contentType: 'audio/mpeg',
    upsert: true,
  })

  if (upErr) {
    // Try creating bucket if it doesn't exist
    await supabase.storage.createBucket('audio', { public: true })
    const { error: upErr2 } = await supabase.storage.from('audio').upload(storagePath, Buffer.from(audioBuffer), {
      contentType: 'audio/mpeg',
      upsert: true,
    })
    if (upErr2) return NextResponse.json({ error: 'Storage hatası: ' + upErr2.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from('audio').getPublicUrl(storagePath)
  const now = new Date().toISOString()

  await supabase.from('briefs').update({
    ai_voiceover_url: urlData.publicUrl,
    ai_voiceover_voice_id: voice_id,
    ai_voiceover_generated_at: now,
  }).eq('id', id)

  return NextResponse.json({ url: urlData.publicUrl, generated_at: now })
}
