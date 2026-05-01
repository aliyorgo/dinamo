import { NextRequest, NextResponse } from 'next/server'

let cachedVoices: any[] | null = null
let cacheTime = 0
const CACHE_TTL = 30 * 1000 // 30 sec

export async function GET(req: NextRequest) {
  const gender = req.nextUrl.searchParams.get('gender') || ''
  const refresh = req.nextUrl.searchParams.get('refresh') === '1'
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key yok' }, { status: 500 })

  if (refresh || !cachedVoices || Date.now() - cacheTime > CACHE_TTL) {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
    })
    if (!res.ok) return NextResponse.json({ error: 'ElevenLabs API hatası' }, { status: 500 })
    const data = await res.json()
    cachedVoices = (data.voices || [])
      .filter((v: any) => {
        const labels = v.labels || {}
        const lang = labels.language || ''
        return lang.toLowerCase().includes('turkish') || lang.toLowerCase().includes('tr')
      })
      .map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name,
        description: v.labels?.description || v.labels?.accent || '',
        preview_url: v.preview_url || null,
        gender: v.labels?.gender || 'unknown',
      }))
    cacheTime = Date.now()
  }

  let voices = cachedVoices || []
  if (gender === 'male' || gender === 'female') {
    voices = voices.filter(v => v.gender === gender)
  }

  return NextResponse.json({ voices })
}
