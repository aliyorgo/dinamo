import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const { userId, name, email, password, role } = await request.json()
  if (!userId) return NextResponse.json({ error: 'userId gerekli' }, { status: 400 })

  // Update auth user (email/password)
  const authUpdate: any = {}
  if (email) authUpdate.email = email
  if (password) authUpdate.password = password

  if (Object.keys(authUpdate).length > 0) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdate)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Update users table
  const dbUpdate: any = {}
  if (name !== undefined) dbUpdate.name = name
  if (email) dbUpdate.email = email
  if (role) dbUpdate.role = role

  if (Object.keys(dbUpdate).length > 0) {
    const { error } = await supabaseAdmin.from('users').update(dbUpdate).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
