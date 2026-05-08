import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { brief_id, persona_id, locked, appearance } = await req.json()
  if (!brief_id || !persona_id) return NextResponse.json({ error: 'brief_id ve persona_id gerekli' }, { status: 400 })

  const { data: brief } = await supabase.from('briefs').select('locked_persona_appearance').eq('id', brief_id).single()
  const current = brief?.locked_persona_appearance || {}

  if (locked && appearance) {
    current[String(persona_id)] = { hair: appearance.hair || null, skin: appearance.skin || null, beard: appearance.beard || null }
  } else {
    delete current[String(persona_id)]
  }

  const { error } = await supabase.from('briefs').update({ locked_persona_appearance: current }).eq('id', brief_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, locked_persona_appearance: current })
}
