import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ActivityLogInput {
  actionType: string
  userId?: string
  userEmail?: string
  userName?: string
  clientId?: string
  clientName?: string
  targetType?: string
  targetId?: string
  targetLabel?: string
  metadata?: Record<string, any>
}

export async function logActivity(input: ActivityLogInput) {
  try {
    await supabase.from('activity_logs').insert({
      action_type: input.actionType,
      user_id: input.userId || null,
      user_email: input.userEmail || null,
      user_name: input.userName || null,
      client_id: input.clientId || null,
      client_name: input.clientName || null,
      target_type: input.targetType || null,
      target_id: input.targetId || null,
      target_label: input.targetLabel || null,
      metadata: input.metadata || {},
    })
  } catch (err) {
    console.error('[activity-log] failed:', err)
  }
}
