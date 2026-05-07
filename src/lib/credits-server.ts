import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getCreditCost(key: string, fallback: number): Promise<number> {
  try {
    const { data } = await supabase.from('admin_settings').select('value').eq('key', key).single()
    return data?.value ? Number(data.value) : fallback
  } catch {
    return fallback
  }
}

export async function getAllCreditSettings(): Promise<Record<string, any>> {
  try {
    const { data } = await supabase.from('admin_settings').select('key, value').or('key.like.credit_%,key.eq.ai_express_global_enabled,key.eq.ugc_global_enabled')
    const map: Record<string, any> = {}
    data?.forEach((s: any) => { map[s.key] = s.value })
    return map
  } catch {
    return {}
  }
}
