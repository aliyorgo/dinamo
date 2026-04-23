import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const briefId = req.nextUrl.searchParams.get('briefId')
  if (!briefId) return NextResponse.json({ error: 'briefId gerekli' }, { status: 400 })

  const { data, error: dbErr } = await supabase.from('briefs')
    .select('static_images_job_status, static_images_job_payload, static_images_error, static_images_url')
    .eq('id', briefId).single()

  if (dbErr) {
    console.error('[status] DB error:', dbErr.message)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

  const result = data.static_images_job_payload?.result || null
  console.log(`[status] ${briefId.slice(0,8)}: ${data.static_images_job_status}, result: ${result ? 'yes' : 'no'}`)

  return NextResponse.json({
    status: data.static_images_job_status,
    error: data.static_images_error,
    result,
    staticImagesUrl: data.static_images_url,
  })
}
