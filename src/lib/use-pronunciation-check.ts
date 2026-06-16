'use client'
import { useState, useCallback, useRef } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

const supabase = getSupabaseBrowser()

// Telaffuzu belirsiz aday ifadeleri yakala: içinde + & / # geçen ya da harf-rakam bitişik tokenlar (Türkçe destekli)
export function detectPronCandidates(text: string): string[] {
  if (!text) return []
  const tokens = text.split(/\s+/).map(t => t.replace(/^[.,!?:;"'()\[\]]+|[.,!?:;"'()\[\]]+$/g, '')).filter(Boolean)
  const seen = new Set<string>()
  const out: string[] = []
  for (const tok of tokens) {
    const isCandidate = /[+&\/#]/.test(tok) || /(\p{L}\p{N}|\p{N}\p{L})/u.test(tok)
    if (isCandidate) { const k = tok.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(tok) } }
  }
  return out
}

export interface PronunciationModalProps {
  candidates: string[]
  saving: boolean
  onContinue: (items: { written: string; pronounced: string }[]) => void
  onClose: () => void
}

// Dış ses / konuşma metnini kaydetmeden ÖNCE telaffuz tespiti yapan paylaşılan hook.
// checkAndPrompt: aday bul → kayıtlıları ele → kalan varsa modal aç ve karar bekle.
//   resolve(true)  = devam (kayıt yapıldı veya aday yok) → çağıran asıl kaydı yapar
//   resolve(false) = iptal (kullanıcı modalı kapattı) → çağıran kaydetmez (brief formu iptal davranışıyla tutarlı)
// clientId şu an API auth token'ından türetiliyor; parametre ileride client-bazlı genişletme için tutuluyor.
export function usePronunciationCheck() {
  const [candidates, setCandidates] = useState<string[] | null>(null)
  const [saving, setSaving] = useState(false)
  const resolverRef = useRef<((proceed: boolean) => void) | null>(null)

  const checkAndPrompt = useCallback(async (text: string, clientId?: string | null): Promise<boolean> => {
    void clientId
    const cands = detectPronCandidates(text || '')
    if (cands.length === 0) return true
    let remaining = cands
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const res = await fetch(`/api/pronunciations?words=${encodeURIComponent(cands.join(','))}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
        if (res.ok) { const d = await res.json(); const reg = new Set<string>(d.registered || []); remaining = cands.filter(c => !reg.has(c.toLowerCase())) }
      }
    } catch {}
    if (remaining.length === 0) return true
    setCandidates(remaining)
    return new Promise<boolean>(resolve => { resolverRef.current = resolve })
  }, [])

  const onContinue = useCallback(async (items: { written: string; pronounced: string }[]) => {
    setSaving(true)
    try {
      if (items.length > 0) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          await fetch('/api/pronunciations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ items }) })
        }
      }
    } catch {}
    setSaving(false)
    setCandidates(null)
    resolverRef.current?.(true)
    resolverRef.current = null
  }, [])

  const onClose = useCallback(() => {
    setCandidates(null)
    resolverRef.current?.(false)
    resolverRef.current = null
  }, [])

  const modalProps: PronunciationModalProps | null = candidates ? { candidates, saving, onContinue, onClose } : null

  return { checkAndPrompt, modalProps }
}
