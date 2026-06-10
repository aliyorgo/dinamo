import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// client_id auth'tan türetilir — query'den ASLA alınmaz (güvenlik)
async function getClientId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  const { data: cu } = await supabase.from('client_users').select('client_id').eq('user_id', user.id).single()
  return cu?.client_id || null
}

// GET ?words=a,b,c → bu client + global kapsamda zaten kayıtlı written'ları (lowercase) döner
export async function GET(req: NextRequest) {
  const clientId = await getClientId(req)
  if (!clientId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wordsParam = req.nextUrl.searchParams.get('words') || ''
  const words = wordsParam.split(',').map(w => w.trim()).filter(Boolean)
  if (words.length === 0) return NextResponse.json({ registered: [] })

  const { data, error } = await supabase
    .from('brand_pronunciations')
    .select('written')
    .eq('is_active', true)
    .or(`client_id.is.null,client_id.eq.${clientId}`)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const wordSet = new Set(words.map(w => w.toLowerCase()))
  const registered = [...new Set((data || []).map((r: any) => (r.written || '').toLowerCase()).filter((w: string) => wordSet.has(w)))]
  return NextResponse.json({ registered })
}

// POST { items: [{written, pronounced}] } → client_id ile kaydet (boş pronounced atlanır)
export async function POST(req: NextRequest) {
  const clientId = await getClientId(req)
  if (!clientId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { items } = await req.json()
  if (!Array.isArray(items)) return NextResponse.json({ error: 'items dizisi zorunlu' }, { status: 400 })

  const rows = items
    .filter((it: any) => it && it.written && it.pronounced && String(it.pronounced).trim())
    .map((it: any) => ({ written: String(it.written).trim(), pronounced: String(it.pronounced).trim(), client_id: clientId, is_active: true }))
  if (rows.length === 0) return NextResponse.json({ inserted: 0 })

  const { error } = await supabase.from('brand_pronunciations').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ inserted: rows.length })
}
