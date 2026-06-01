import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { briefId, count = 1 } = await req.json()
    if (!briefId) return NextResponse.json({ error: 'briefId gerekli' }, { status: 400 })

    const { data: brief } = await supabase.from('briefs').select('id, client_id, clients(street_host_image_url, street_host_description, brand_intro_music_url)').eq('id', briefId).single()
    if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

    const client = (brief as any).clients
    if (!client?.street_host_image_url) return NextResponse.json({ error: 'Marka sokak röp ayarları eksik (host image)' }, { status: 400 })

    const videoIds: string[] = []
    for (let i = 0; i < Math.min(count, 3); i++) {
      const { data: row, error } = await supabase.from('street_videos').insert({
        brief_id: briefId,
        host_image_url: client.street_host_image_url,
        intro_music_url: client.brand_intro_music_url || null,
        host_description: client.street_host_description || null,
        status: 'queued',
      }).select('id').single()

      if (error) {
        console.error('[street-generate] Insert error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      videoIds.push(row.id)
    }

    console.log('[street-generate] Created:', videoIds)
    return NextResponse.json({ ok: true, video_ids: videoIds })
  } catch (err: any) {
    console.error('[street-generate] FATAL:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
