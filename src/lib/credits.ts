'use client'
import { useState, useEffect } from 'react'

export type CreditSettings = {
  credit_ai_express: number
  credit_ai_express_generate: number
  credit_ai_ugc: number
  credit_ai_ugc_generate: number
  credit_bumper: number
  credit_feed: number
  credit_language_addon: number
  credit_longform: number
  credit_revision: number
  credit_story: number
  credit_voiceover_real: number
}

const DEFAULTS: CreditSettings = {
  credit_ai_express: 1,
  credit_ai_express_generate: 1,
  credit_ai_ugc: 1,
  credit_ai_ugc_generate: 1,
  credit_bumper: 6,
  credit_feed: 20,
  credit_language_addon: 2,
  credit_longform: 30,
  credit_revision: 4,
  credit_story: 12,
  credit_voiceover_real: 6,
}

let cached: CreditSettings | null = null
let cachedFlags: { aiExpressGlobal: boolean; ugcGlobal: boolean } | null = null

export function useCredits(): { credits: CreditSettings | null; flags: { aiExpressGlobal: boolean; ugcGlobal: boolean }; loading: boolean } {
  const [credits, setCredits] = useState<CreditSettings | null>(cached)
  const [flags, setFlags] = useState(cachedFlags || { aiExpressGlobal: true, ugcGlobal: true })
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    if (cached) { setCredits(cached); if (cachedFlags) setFlags(cachedFlags); setLoading(false); return }
    fetch('/api/admin-settings/credits')
      .then(r => r.json())
      .then(data => {
        const merged = { ...DEFAULTS }
        for (const key of Object.keys(DEFAULTS)) {
          if (data[key] !== undefined && data[key] !== null) {
            (merged as any)[key] = Number(data[key]) || (DEFAULTS as any)[key]
          }
        }
        cached = merged
        setCredits(merged)
        const f = { aiExpressGlobal: data.ai_express_global_enabled !== 'false', ugcGlobal: data.ugc_global_enabled !== 'false' }
        cachedFlags = f
        setFlags(f)
      })
      .catch(() => setCredits(DEFAULTS))
      .finally(() => setLoading(false))
  }, [])

  return { credits, flags, loading }
}

export { DEFAULTS as CREDIT_DEFAULTS }
