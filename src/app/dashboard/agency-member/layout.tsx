'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function AgencyMemberLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('users').select('name, role, agency_id').eq('id', user.id).single()
      if (!data || data.role !== 'agency_member' || !data.agency_id) { router.push('/login'); return }
      setUserName(data.name)
      const { data: ag } = await supabase.from('agencies').select('name').eq('id', data.agency_id).single()
      if (ag) setAgencyName(ag.name)
      setReady(true)
    }
    check()
  }, [router])

  if (!ready) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "var(--font-dm-sans),'DM Sans',system-ui,sans-serif" }}>
      <Sidebar role="agency_member" userName={userName} companyName={agencyName} />
      <main style={{ flex: 1, background: '#f5f4f0', overflow: 'hidden' }}>
        {children}
      </main>
    </div>
  )
}
