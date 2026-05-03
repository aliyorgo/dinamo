import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { use_fast_mode } = await req.json()

  if (typeof use_fast_mode !== 'boolean') {
    return NextResponse.json({ error: 'use_fast_mode boolean olmalı' }, { status: 400 })
  }

  const { error } = await supabase.from('clients').update({ use_fast_mode }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, use_fast_mode })
}
