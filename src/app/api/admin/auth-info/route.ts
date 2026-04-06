import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST { ids: string[] }
// Returns { [userId]: { last_sign_in_at: string | null } }
export async function POST(request: Request) {
  const { ids } = await request.json()
  if (!ids || !Array.isArray(ids) || ids.length === 0) return NextResponse.json({})

  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (error) return NextResponse.json({}, { status: 400 })

  const idSet = new Set(ids as string[])
  const result: Record<string, { last_sign_in_at: string | null }> = {}
  for (const u of users) {
    if (idSet.has(u.id)) {
      result[u.id] = { last_sign_in_at: u.last_sign_in_at || null }
    }
  }

  return NextResponse.json(result)
}
