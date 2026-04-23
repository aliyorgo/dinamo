import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { briefId, keepFrameUrls, videoUrl } = await req.json()
    if (!briefId) return NextResponse.json({ error: 'briefId gerekli' }, { status: 400 })

    await supabase.from('briefs').update({
      static_images_job_status: 'pending',
      static_images_job_payload: { action: 'refresh', keepFrameUrls, videoUrl },
      static_images_error: null,
    }).eq('id', briefId)

    return NextResponse.json({ status: 'queued' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
