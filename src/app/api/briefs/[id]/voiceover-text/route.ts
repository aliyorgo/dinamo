import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { voiceover_text } = await req.json()
  if (typeof voiceover_text !== 'string') return NextResponse.json({ error: 'voiceover_text string olmalı' }, { status: 400 })

  const { error } = await supabase.from('briefs').update({ voiceover_text }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, voiceover_text })
}
