import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase.from('client_users').select('client_id').eq('user_id', user.id).single()
  if (!cu) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const { logo_size_percent } = await req.json()
  if (typeof logo_size_percent !== 'number' || logo_size_percent < 50 || logo_size_percent > 200) {
    return NextResponse.json({ error: 'logo_size_percent must be 50-200' }, { status: 400 })
  }

  const { error } = await supabase.from('clients').update({ logo_size_percent }).eq('id', cu.client_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, logo_size_percent })
}
