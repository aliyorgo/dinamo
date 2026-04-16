'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [credits, setCredits] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!data || data.role !== 'client') { router.push('/login'); return }
      setUserName(data.name)
      const { data: cuList } = await supabase.from('client_users').select('credit_balance, clients(company_name)').eq('user_id', user.id).limit(1)
      const cu = cuList?.[0]
      if (cu) {
        setCredits(cu.credit_balance || 0)
        setCompanyName((cu as any).clients?.company_name || '')
      }
      setReady(true)
    }
    check()
  }, [router])

  if (!ready) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "var(--font-dm-sans),'DM Sans',system-ui,sans-serif" }}>
      <Sidebar role="client" userName={userName} companyName={companyName} credits={credits} />
      <main style={{ flex: 1, background: '#f5f4f0', overflow: 'hidden' }}>
        {children}
      </main>
    </div>
  )
}
