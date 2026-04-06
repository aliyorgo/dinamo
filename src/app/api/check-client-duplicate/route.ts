import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const { company_name, agency_id } = await request.json()

  if (!company_name?.trim()) {
    return NextResponse.json({ ok: true })
  }

  const { data: existing } = await supabase
    .from('clients')
    .select('id, agency_id')
    .ilike('company_name', company_name.trim())

  if (!existing || existing.length === 0) {
    return NextResponse.json({ ok: true })
  }

  const match = existing[0]

  // Same agency
  if (agency_id && match.agency_id === agency_id) {
    return NextResponse.json({
      ok: false,
      message: 'Bu musteri zaten listenizde kayitli.',
    })
  }

  // Different agency
  if (match.agency_id && match.agency_id !== agency_id) {
    return NextResponse.json({
      ok: false,
      message: 'Bu musteri baska bir ajans hesabinda kayitli. Dinamo yetkilisi ile iletisime gecin.',
    })
  }

  // Direct client (agency_id is null)
  if (!match.agency_id) {
    return NextResponse.json({
      ok: false,
      message: "Bu musteri Dinamo'nun dogrudan musterisi olarak kayitli. Dinamo yetkilisi ile iletisime gecin.",
    })
  }

  return NextResponse.json({ ok: true })
}
