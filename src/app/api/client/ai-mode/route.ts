import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET: return global mode + client's use_fast_mode
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '') || req.cookies.get('sb-access-token')?.value

  // Get user from auth
  const { data: { user } } = await supabase.auth.getUser(token || undefined)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase.from('client_users').select('client_id').eq('user_id', user.id).single()
  if (!cu) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const [{ data: sysMode }, { data: client }] = await Promise.all([
    supabase.from('system_settings').select('value').eq('key', 'ai_quality_mode').single(),
    supabase.from('clients').select('use_fast_mode').eq('id', cu.client_id).single(),
  ])

  return NextResponse.json({
    global_mode: sysMode?.value === 'quality' ? 'quality' : 'fast',
    use_fast_mode: client?.use_fast_mode || false,
  })
}

// POST: update client's use_fast_mode
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '') || req.cookies.get('sb-access-token')?.value

  const { data: { user } } = await supabase.auth.getUser(token || undefined)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase.from('client_users').select('client_id').eq('user_id', user.id).single()
  if (!cu) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const { use_fast_mode } = await req.json()
  if (typeof use_fast_mode !== 'boolean') {
    return NextResponse.json({ error: 'use_fast_mode boolean olmalı' }, { status: 400 })
  }

  const { error } = await supabase.from('clients').update({ use_fast_mode }).eq('id', cu.client_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, use_fast_mode })
}
