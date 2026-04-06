import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST { agencyId, agencyName, email, password }
// Creates an auth user + users record for an existing agency
export async function POST(request: Request) {
  const { agencyId, agencyName, email, password } = await request.json()
  if (!agencyId || !email || !password) {
    return NextResponse.json({ error: 'agencyId, email ve password zorunlu' }, { status: 400 })
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const { error: dbError } = await supabaseAdmin.from('users').insert({
    id: authData.user.id,
    email,
    name: agencyName || email,
    role: 'agency',
    agency_id: agencyId,
  })

  if (dbError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: dbError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, userId: authData.user.id })
}
