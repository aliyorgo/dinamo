import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function getClientId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  const { data: cu } = await supabase.from('client_users').select('client_id').eq('user_id', user.id).single()
  return cu?.client_id || null
}

export async function GET(req: NextRequest) {
  const clientId = await getClientId(req)
  if (!clientId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client } = await supabase.from('clients').select('ai_express_settings, packshot_url').eq('id', clientId).single()
  return NextResponse.json({
    ai_express_settings: client?.ai_express_settings || null,
    packshot_url: client?.packshot_url || '',
  })
}

export async function POST(req: NextRequest) {
  const clientId = await getClientId(req)
  if (!clientId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { settings } = await req.json()
  if (!settings || typeof settings !== 'object') {
    return NextResponse.json({ error: 'settings object required' }, { status: 400 })
  }

  const { error } = await supabase.from('clients').update({ ai_express_settings: settings }).eq('id', clientId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, settings })
}
