import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params

  // Fetch My Voices from ElevenLabs
  const apiKey = process.env.ELEVENLABS_API_KEY
  let myVoices: any[] = []
  if (apiKey) {
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': apiKey } })
      if (res.ok) {
        const data = await res.json()
        myVoices = (data.voices || [])
          .filter((v: any) => {
            const lang = v.labels?.language || ''
            return lang.toLowerCase().includes('turkish') || lang.toLowerCase().includes('tr')
          })
          .map((v: any) => ({
            voice_id: v.voice_id,
            name: v.name,
            gender: v.labels?.gender || 'unknown',
            preview_url: v.preview_url || null,
          }))
      }
    } catch {}
  }

  // Client relationships
  const { data: relations } = await supabase.from('client_voices').select('*').eq('client_id', clientId)
  const excludedIds = new Set((relations || []).filter(r => r.relationship_type === 'excluded').map(r => r.voice_id))
  const exclusiveList = (relations || []).filter(r => r.relationship_type === 'exclusive')

  // Build result
  const voicesWithStatus = myVoices.map(v => ({
    ...v,
    source: 'my_voices' as const,
    relationship: excludedIds.has(v.voice_id) ? 'excluded' : 'default',
    visible: !excludedIds.has(v.voice_id),
  }))

  // Add exclusive voices not in My Voices
  for (const ex of exclusiveList) {
    const inMyVoices = myVoices.some(v => v.voice_id === ex.voice_id)
    voicesWithStatus.push({
      voice_id: ex.voice_id,
      name: ex.voice_name || ex.voice_id,
      gender: ex.gender || 'unknown',
      preview_url: null,
      source: inMyVoices ? 'my_voices' : 'exclusive',
      relationship: 'exclusive',
      visible: true,
    })
  }

  const visibleCount = voicesWithStatus.filter(v => v.visible || v.relationship === 'exclusive').length
  const maleCount = voicesWithStatus.filter(v => (v.visible || v.relationship === 'exclusive') && v.gender === 'male').length
  const femaleCount = voicesWithStatus.filter(v => (v.visible || v.relationship === 'exclusive') && v.gender === 'female').length

  return NextResponse.json({ voices: voicesWithStatus, visibleCount, maleCount, femaleCount })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const { voice_id, voice_name, gender, relationship_type } = await req.json()

  if (!voice_id || !['exclusive', 'excluded'].includes(relationship_type)) {
    return NextResponse.json({ error: 'voice_id ve relationship_type (exclusive|excluded) gerekli' }, { status: 400 })
  }

  const { error } = await supabase.from('client_voices').upsert(
    { client_id: clientId, voice_id, voice_name: voice_name || null, gender: gender || null, relationship_type },
    { onConflict: 'client_id,voice_id,relationship_type' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const { voice_id, relationship_type } = await req.json()

  const { error } = await supabase.from('client_voices').delete()
    .eq('client_id', clientId).eq('voice_id', voice_id).eq('relationship_type', relationship_type)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
