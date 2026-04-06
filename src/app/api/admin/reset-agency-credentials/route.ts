import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  let pw = ''
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}

// POST { agencyId, newEmail? }
// Resets (and optionally changes email for) the agency user
// Returns { password, email, userId }
export async function POST(request: Request) {
  const { agencyId, newEmail } = await request.json()
  if (!agencyId) return NextResponse.json({ error: 'agencyId required' }, { status: 400 })

  // Find the agency user
  const { data: agencyUser, error: findErr } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .eq('agency_id', agencyId)
    .eq('role', 'agency')
    .single()

  if (findErr || !agencyUser) {
    return NextResponse.json({ error: 'Agency user not found' }, { status: 404 })
  }

  const newPassword = generatePassword()
  const updates: { password: string; email?: string } = { password: newPassword }
  if (newEmail) updates.email = newEmail

  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
    agencyUser.id,
    updates,
  )

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

  // If email changed, sync to users table too
  if (newEmail) {
    await supabaseAdmin.from('users').update({ email: newEmail }).eq('id', agencyUser.id)
  }

  return NextResponse.json({
    password: newPassword,
    email: newEmail || agencyUser.email,
    userId: agencyUser.id,
  })
}
