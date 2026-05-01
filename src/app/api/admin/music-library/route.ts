import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const mood = req.nextUrl.searchParams.get('mood') || ''
  const clientId = req.nextUrl.searchParams.get('client_id') || ''
  const activeOnly = req.nextUrl.searchParams.get('active') !== 'false'
  const search = req.nextUrl.searchParams.get('search') || ''

  let query = supabase.from('music_library').select('*, clients(company_name)').order('created_at', { ascending: false })

  if (activeOnly) query = query.eq('is_active', true)
  if (mood) query = query.contains('mood', [mood])
  if (clientId === 'general') query = query.is('client_id', null)
  else if (clientId) query = query.eq('client_id', clientId)
  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ music: data || [] })
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const name = formData.get('name') as string || file?.name || 'Untitled'
  const moodRaw = formData.get('mood') as string || ''
  const moodArr = moodRaw ? moodRaw.split(',').filter(Boolean) : null
  const clientId = formData.get('client_id') as string || null

  if (!file) return NextResponse.json({ error: 'Dosya gerekli' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() || 'mp3'
  const uuid = crypto.randomUUID()
  const folder = clientId ? `brands/${clientId}` : 'general'
  const storagePath = `${folder}/${uuid}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  // Ensure bucket exists
  await supabase.storage.createBucket('music-library', { public: true }).catch(() => {})

  const { error: upErr } = await supabase.storage.from('music-library').upload(storagePath, buffer, {
    contentType: file.type || 'audio/mpeg',
    upsert: true,
  })
  if (upErr) return NextResponse.json({ error: 'Upload hatası: ' + upErr.message }, { status: 500 })

  const { data: urlData } = supabase.storage.from('music-library').getPublicUrl(storagePath)

  const { data: record, error: insErr } = await supabase.from('music_library').insert({
    name,
    file_url: urlData.publicUrl,
    storage_path: storagePath,
    mood: moodArr,
    client_id: clientId || null,
    size_bytes: buffer.length,
    is_active: true,
  }).select().single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json(record)
}
