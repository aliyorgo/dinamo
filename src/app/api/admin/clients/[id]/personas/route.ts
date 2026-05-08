import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params

  // All active personas
  const { data: allPersonas } = await supabase.from('personas').select('*').eq('is_active', true).order('display_order')
  // Client relationships
  const { data: relations } = await supabase.from('client_personas').select('persona_id, relationship_type').eq('client_id', clientId)

  const excludedIds = new Set((relations || []).filter(r => r.relationship_type === 'excluded').map(r => r.persona_id))
  const exclusiveIds = new Set((relations || []).filter(r => r.relationship_type === 'exclusive').map(r => r.persona_id))

  const result = (allPersonas || []).map(p => ({
    ...p,
    relationship: excludedIds.has(p.id) ? 'excluded' : exclusiveIds.has(p.id) ? 'exclusive' : p.is_global ? 'global' : 'unavailable',
    visible: (p.is_global && !excludedIds.has(p.id)) || (!p.is_global && exclusiveIds.has(p.id)),
  }))

  const visibleCount = result.filter(p => p.visible).length
  return NextResponse.json({ personas: result, visibleCount })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const { persona_id, relationship_type } = await req.json()

  if (!persona_id || !['exclusive', 'excluded'].includes(relationship_type)) {
    return NextResponse.json({ error: 'persona_id ve relationship_type (exclusive|excluded) gerekli' }, { status: 400 })
  }

  const { error } = await supabase.from('client_personas').upsert({ client_id: clientId, persona_id, relationship_type }, { onConflict: 'client_id,persona_id,relationship_type' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const { persona_id, relationship_type } = await req.json()

  const { error } = await supabase.from('client_personas').delete().eq('client_id', clientId).eq('persona_id', persona_id).eq('relationship_type', relationship_type)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
