import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  try {
    const brief_id = req.nextUrl.searchParams.get('brief_id')
    if (!brief_id) return NextResponse.json({ error: 'brief_id gerekli' }, { status: 400 })

    const { data: versions } = await supabase
      .from('premium_versions')
      .select('*')
      .eq('brief_id', brief_id)
      .order('version_number', { ascending: true })

    return NextResponse.json({ versions: versions || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
