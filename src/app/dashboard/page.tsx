'use client'

import { useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardPage() {
  const router = useRouter()

  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!data) { router.push('/login'); return }

      switch (data.role) {
        case 'admin': router.push('/dashboard/admin'); break
        case 'producer': router.push('/dashboard/admin'); break
        case 'creator': router.push('/dashboard/creator'); break
        case 'client': router.push('/dashboard/client'); break
        case 'agency': router.push('/dashboard/agency/overview'); break
        case 'agency_member': router.push('/dashboard/agency-member/studio'); break
        default: router.push('/login')
      }
    }
    checkRole()
  }, [router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ color: '#888', fontSize: '14px' }}>Yönlendiriliyor...</div>
    </div>
  )
}