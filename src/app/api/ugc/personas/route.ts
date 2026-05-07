import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id gerekli' }, { status: 400 })

  // Get all active personas
  const { data: allPersonas } = await supabase.from('personas').select('*').eq('is_active', true).order('display_order')
  if (!allPersonas) return NextResponse.json([])

  // Get client relationships
  const { data: relations } = await supabase.from('client_personas').select('persona_id, relationship_type').eq('client_id', clientId)
  const excludedIds = new Set((relations || []).filter(r => r.relationship_type === 'excluded').map(r => r.persona_id))
  const exclusiveIds = new Set((relations || []).filter(r => r.relationship_type === 'exclusive').map(r => r.persona_id))

  // Filter: global (not excluded) + exclusive (assigned)
  const filtered = allPersonas.filter(p =>
    (p.is_global && !excludedIds.has(p.id)) || (!p.is_global && exclusiveIds.has(p.id))
  )

  return NextResponse.json(filtered)
}
