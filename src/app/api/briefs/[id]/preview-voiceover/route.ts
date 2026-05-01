import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { text } = await req.json()

  if (!text) return NextResponse.json({ error: 'text gerekli' }, { status: 400 })

  const trimmed = text.slice(0, 500)

  // Get brief with client brand_voices
  const { data: brief } = await supabase.from('briefs').select('id, voiceover_gender, client_id, preview_count, preview_cache').eq('id', id).single()
  if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

  // Get client brand_voices
  const { data: client } = await supabase.from('clients').select('brand_voices').eq('id', brief.client_id).single()
  const gender = brief.voiceover_gender || 'female'
  const brandVoice = client?.brand_voices?.[gender]
  if (!brandVoice?.voice_id) return NextResponse.json({ error: 'Marka sesi seçilmemiş' }, { status: 400 })

  const voiceId = brandVoice.voice_id
  const cacheKey = createHash('md5').update(`${trimmed}:${voiceId}`).digest('hex')
  const cache = brief.preview_cache || {}

  // Cache hit
  if (cache[cacheKey]) {
    return NextResponse.json({ url: cache[cacheKey].url, cached: true, count: brief.preview_count, voice_name: brandVoice.name })
  }

  // Limit check
  if ((brief.preview_count || 0) >= 10) {
    return NextResponse.json({ error: 'Preview limiti doldu (10/10)' }, { status: 429 })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

  // Generate via ElevenLabs
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
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
  const storagePath = `preview/${id}/${cacheKey}.mp3`

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
  const newCount = (brief.preview_count || 0) + 1
  const newCache = { ...cache, [cacheKey]: { url: urlData.publicUrl, voice_id: voiceId, created_at: new Date().toISOString() } }

  await supabase.from('briefs').update({ preview_count: newCount, preview_cache: newCache }).eq('id', id)

  return NextResponse.json({ url: urlData.publicUrl, cached: false, count: newCount, voice_name: brandVoice.name })
}
