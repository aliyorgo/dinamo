import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const briefId = req.nextUrl.searchParams.get('briefId')
  if (!briefId) return NextResponse.json({ error: 'briefId gerekli' }, { status: 400 })

  const { data, error: dbErr } = await supabase.from('briefs')
    .select('static_images_job_status, static_images_job_payload, static_images_job_claimed_at, static_images_error, static_images_url')
    .eq('id', briefId).single()

  if (dbErr) {
    console.error('[status] DB error:', dbErr.message)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

  // Timeout: processing for more than 2 minutes
  if (data.static_images_job_status === 'processing' && data.static_images_job_claimed_at) {
    const elapsed = Date.now() - new Date(data.static_images_job_claimed_at).getTime()
    if (elapsed > 120000) {
      await supabase.from('briefs').update({ static_images_job_status: 'failed', static_images_error: 'Zaman aşımı' }).eq('id', briefId)
      return NextResponse.json({ status: 'failed', error: 'Zaman aşımı', result: null, staticImagesUrl: data.static_images_url })
    }
  }

  const result = data.static_images_job_payload?.result || null

  return NextResponse.json({
    status: data.static_images_job_status,
    error: data.static_images_error,
    result,
    staticImagesUrl: data.static_images_url,
  })
}
