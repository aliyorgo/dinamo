import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function logClientActivity(params: {
  actionType: string
  userName?: string
  clientName?: string
  clientId?: string
  targetType?: string
  targetId?: string
  targetLabel?: string
  metadata?: Record<string, any>
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    fetch('/api/activity-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify(params),
    }).catch(() => {})
  } catch {}
}
