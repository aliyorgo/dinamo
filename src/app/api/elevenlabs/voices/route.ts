import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

let cachedVoices: any[] | null = null
let cacheTime = 0
const CACHE_TTL = 30 * 1000 // 30 sec

export async function GET(req: NextRequest) {
  const gender = req.nextUrl.searchParams.get('gender') || ''
  const clientId = req.nextUrl.searchParams.get('client_id') || ''
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

  // Client-based filtering
  if (clientId) {
    const { data: relations } = await supabase.from('client_voices').select('voice_id, relationship_type, voice_name, gender').eq('client_id', clientId)
    if (relations && relations.length > 0) {
      const excludedIds = new Set(relations.filter(r => r.relationship_type === 'excluded').map(r => r.voice_id))
      const exclusiveList = relations.filter(r => r.relationship_type === 'exclusive')

      // Remove excluded from My Voices
      voices = voices.filter(v => !excludedIds.has(v.voice_id))

      // Add exclusive voices not already in list
      for (const ex of exclusiveList) {
        if (!voices.some(v => v.voice_id === ex.voice_id)) {
          voices.push({ voice_id: ex.voice_id, name: ex.voice_name || ex.voice_id, description: '', preview_url: null, gender: ex.gender || 'unknown' })
        }
      }
    }
  }

  if (gender === 'male' || gender === 'female') {
    voices = voices.filter(v => v.gender === gender)
  }

  return NextResponse.json({ voices })
}
