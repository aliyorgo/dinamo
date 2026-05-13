import { getSupabaseBrowser } from '@/lib/supabase-browser'

const supabase = getSupabaseBrowser()

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
