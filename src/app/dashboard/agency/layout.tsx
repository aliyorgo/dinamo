'use client'
import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

const supabase = getSupabaseBrowser()

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
      if (!user) { router.push('/login'); return }
      setReady(true)
    }
    check()
  }, [router])

  if (!ready) return null
  return <div className="dashboard-scale">{children}</div>
}
