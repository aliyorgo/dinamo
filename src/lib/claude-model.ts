import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// 60s in-memory cache
let cachedMode: string | null = null
let cacheTime = 0
const CACHE_TTL = 60_000

export async function getQualityMode(): Promise<'fast' | 'quality'> {
  if (cachedMode && Date.now() - cacheTime < CACHE_TTL) return cachedMode as 'fast' | 'quality'
  const { data } = await supabase.from('system_settings').select('value').eq('key', 'ai_quality_mode').single()
  cachedMode = data?.value === 'quality' ? 'quality' : 'fast'
  cacheTime = Date.now()
  return cachedMode as 'fast' | 'quality'
}

const MODEL_MAP: Record<string, { fast: string; quality: string }> = {
  'ugc-script': { fast: 'claude-haiku-4-5-20251001', quality: 'claude-sonnet-4-6' },
  'generate-prompts': { fast: 'claude-haiku-4-5-20251001', quality: 'claude-sonnet-4-6' },
  'generate-brief': { fast: 'claude-haiku-4-5-20251001', quality: 'claude-sonnet-4-6' },
  'inspirations': { fast: 'claude-haiku-4-5-20251001', quality: 'claude-opus-4-6' },
  'scenario': { fast: 'claude-haiku-4-5-20251001', quality: 'claude-opus-4-6' },
  'ideas': { fast: 'claude-haiku-4-5-20251001', quality: 'claude-opus-4-6' },
  'customer-ideas': { fast: 'claude-haiku-4-5-20251001', quality: 'claude-opus-4-6' },
}

export async function getClaudeModel(endpoint: string, clientUseFastMode?: boolean): Promise<string> {
  const globalMode = await getQualityMode()

  // Global fast → everyone uses fast
  if (globalMode === 'fast') {
    return 'claude-haiku-4-5-20251001'
  }

  // Global quality but client override → fast
  if (clientUseFastMode === true) {
    return 'claude-haiku-4-5-20251001'
  }

  // Global quality + no override → quality mapping
  return MODEL_MAP[endpoint]?.quality || 'claude-haiku-4-5-20251001'
}

export function invalidateQualityModeCache(): void {
  cachedMode = null
  cacheTime = 0
}
