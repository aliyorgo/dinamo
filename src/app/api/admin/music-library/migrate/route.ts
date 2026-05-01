import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const LEGACY_MUSIC = [
  'alexgrohl-energetic-action-sport-500409.mp3',
  'alexgrohl-motivation-epic-rock-111444.mp3',
  'bfcmusic-motivation-rock-background-497403.mp3',
  'eliveta-corporate-491206.mp3',
  'freemusicforvideo-motivation-motivational-495609.mp3',
  'loksii-no-copyright-music-211881.mp3',
  'nastelbom-background-music-443623.mp3',
  'paulyudin-motivation-cinematic-159243.mp3',
]

export async function POST() {
  // Check if already migrated
  const { count } = await supabase.from('music_library').select('id', { count: 'exact', head: true })
  if ((count || 0) > 0) return NextResponse.json({ message: 'Zaten migre edilmiş', count })

  // These files need to be uploaded manually to Supabase Storage music-library bucket
  // This endpoint creates DB records for files that are already in the pipeline's /music/ folder
  // Admin should upload them via the UI instead

  await supabase.storage.createBucket('music-library', { public: true }).catch(() => {})

  const results = []
  for (const filename of LEGACY_MUSIC) {
    const name = filename.replace(/-\d+\.mp3$/, '').replace(/-/g, ' ')
    const storagePath = `general/${filename}`

    // Create DB record pointing to pipeline's known files
    const { data: urlData } = supabase.storage.from('music-library').getPublicUrl(storagePath)

    const { data, error } = await supabase.from('music_library').insert({
      name,
      file_url: urlData.publicUrl,
      storage_path: storagePath,
      mood: null,
      client_id: null,
      is_active: true,
    }).select().single()

    results.push({ filename, ok: !error, error: error?.message })
  }

  return NextResponse.json({ message: 'Migration tamamlandı', results })
}
