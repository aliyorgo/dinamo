import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity-logger'
import { getCreditCost } from '@/lib/credits-server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { briefId, userId } = await request.json()
    if (!briefId || !userId) return NextResponse.json({ error: 'briefId ve userId gerekli' }, { status: 400 })

    const { data: brief } = await supabase.from('briefs').select('ai_video_url').eq('id', briefId).single()
    if (!brief?.ai_video_url) return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })

    const cost = await getCreditCost('credit_ai_express', 1)
    const { data: cu } = await supabase.from('client_users').select('id, allocated_credits').eq('user_id', userId).single()
    if (!cu) return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    if ((cu.allocated_credits || 0) < cost) return NextResponse.json({ error: 'Yetersiz kredi' }, { status: 400 })

    await supabase.from('client_users').update({ allocated_credits: (cu.allocated_credits || 0) - cost }).eq('id', cu.id)

    await supabase.from('video_submissions').insert({
      brief_id: briefId,
      video_url: brief.ai_video_url,
      status: 'admin_approved',
      is_ai_generated: true,
      version: 1,
      submitted_at: new Date().toISOString(),
    })

    await supabase.from('briefs').update({ status: 'delivered' }).eq('id', briefId)

    // Log
    const { data: userData } = await supabase.from('users').select('name, email').eq('id', userId).single()
    const { data: briefData } = await supabase.from('briefs').select('campaign_name, client_id, clients(company_name)').eq('id', briefId).single()
    logActivity({
      actionType: 'video.purchased', userId, userEmail: userData?.email, userName: userData?.name,
      clientId: briefData?.client_id, clientName: (briefData?.clients as any)?.company_name,
      targetType: 'brief', targetId: briefId, targetLabel: briefData?.campaign_name,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
