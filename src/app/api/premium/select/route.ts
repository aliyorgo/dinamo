import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { brief_id, version_id } = await req.json()
    if (!brief_id || !version_id) return NextResponse.json({ error: 'brief_id ve version_id gerekli' }, { status: 400 })

    // Verify version belongs to brief
    const { data: version } = await supabase.from('premium_versions').select('id, brief_id').eq('id', version_id).eq('brief_id', brief_id).single()
    if (!version) return NextResponse.json({ error: 'Version bulunamadi' }, { status: 404 })

    // Mark selected + update brief status for worker Phase 2 pickup
    await supabase.from('premium_versions').update({ is_selected: false }).eq('brief_id', brief_id)
    await supabase.from('premium_versions').update({ is_selected: true }).eq('id', version_id)
    await supabase.from('briefs').update({
      premium_selected_version_id: version_id,
      premium_status: 'version_selected',
    }).eq('id', brief_id)

    return NextResponse.json({ success: true, version_id, message: 'Version selected — production starting' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
