import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { invalidateQualityModeCache } from '@/lib/claude-model'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const { data } = await supabase.from('system_settings').select('value').eq('key', 'ai_quality_mode').single()
  return NextResponse.json({ mode: data?.value || 'fast' })
}

export async function POST(req: NextRequest) {
  const { mode } = await req.json()
  if (mode !== 'fast' && mode !== 'quality') return NextResponse.json({ error: 'Geçersiz mod' }, { status: 400 })

  const { error } = await supabase.from('system_settings').upsert({ key: 'ai_quality_mode', value: mode }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateQualityModeCache()
  return NextResponse.json({ success: true, mode })
}
