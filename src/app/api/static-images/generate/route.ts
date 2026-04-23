import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { briefId, selectedFrames, copy } = await req.json()
    if (!briefId || !selectedFrames?.length) return NextResponse.json({ error: 'briefId ve frame seçimi gerekli' }, { status: 400 })

    await supabase.from('briefs').update({
      static_images_job_status: 'pending',
      static_images_job_payload: { action: 'generate', selectedFrames, copy },
      static_images_error: null,
    }).eq('id', briefId)

    return NextResponse.json({ status: 'queued' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
