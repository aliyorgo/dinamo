import { NextRequest, NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity-logger'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await logActivity({
      actionType: body.actionType,
      userId: user.id,
      userEmail: user.email,
      userName: body.userName,
      clientId: body.clientId,
      clientName: body.clientName,
      targetType: body.targetType,
      targetId: body.targetId,
      targetLabel: body.targetLabel,
      metadata: body.metadata,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
