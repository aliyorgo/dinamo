import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify brief belongs to user's client
  const { data: cu } = await supabase.from('client_users').select('client_id').eq('user_id', user.id).single()
  if (!cu) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const { data: brief } = await supabase.from('briefs').select('client_id').eq('id', id).single()
  if (!brief || brief.client_id !== cu.client_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { settings } = await req.json()
  if (!settings || typeof settings !== 'object') {
    return NextResponse.json({ error: 'settings object required' }, { status: 400 })
  }

  const { error } = await supabase.from('briefs').update({ ai_express_settings: settings }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, settings })
}
