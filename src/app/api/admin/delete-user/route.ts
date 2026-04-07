import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: 'userId gerekli' }, { status: 400 })

  // Delete from users table first
  const { error: dbErr } = await supabaseAdmin.from('users').delete().eq('id', userId)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 400 })

  // Delete from auth
  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
