import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { text, client_id, gender } = await req.json()

  if (!text || !client_id) return NextResponse.json({ error: 'text ve client_id gerekli' }, { status: 400 })

  const trimmed = text.slice(0, 500)

  const { data: client } = await supabase.from('clients').select('brand_voices').eq('id', client_id).single()
  const voiceGender = gender || 'female'
  const brandVoice = client?.brand_voices?.[voiceGender]
  if (!brandVoice?.voice_id) return NextResponse.json({ error: 'Marka sesi seçilmemiş' }, { status: 400 })

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${brandVoice.voice_id}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: trimmed,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  })

  if (!res.ok) return NextResponse.json({ error: 'ElevenLabs üretim hatası' }, { status: 500 })

  const audioBuffer = await res.arrayBuffer()
  const storagePath = `preview/${client_id}/${Date.now()}.mp3`

  const { error: upErr } = await supabase.storage.from('audio').upload(storagePath, Buffer.from(audioBuffer), {
    contentType: 'audio/mpeg', upsert: true,
  })
  if (upErr) {
    await supabase.storage.createBucket('audio', { public: true })
    const { error: upErr2 } = await supabase.storage.from('audio').upload(storagePath, Buffer.from(audioBuffer), {
      contentType: 'audio/mpeg', upsert: true,
    })
    if (upErr2) return NextResponse.json({ error: 'Storage hatası' }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from('audio').getPublicUrl(storagePath)

  return NextResponse.json({ url: urlData.publicUrl, voice_name: brandVoice.name })
}
