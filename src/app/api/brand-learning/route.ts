import { NextRequest, NextResponse } from 'next/server'
import { extractBrandRuleCandidate, getActiveBrandRules } from '@/lib/brand-learning'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// POST: trigger extraction (fire-and-forget from client)
export async function POST(req: NextRequest) {
  try {
    const { clientId, sourceType, sourceId, text } = await req.json()
    if (!clientId || !text) return NextResponse.json({ error: 'clientId ve text gerekli' }, { status: 400 })

    // Must await — Vercel terminates function after response
    await extractBrandRuleCandidate({ clientId, sourceType: sourceType || 'manual', sourceId: sourceId || clientId, text })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET: get active rules for a client
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId gerekli' }, { status: 400 })

  const rules = await getActiveBrandRules(clientId)
  return NextResponse.json({ rules })
}
