'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

const supabase = getSupabaseBrowser()

type ClientCtx = {
  userName: string
  companyName: string
  credits: number
  clientUserId: string
  clientId: string
  customizationTier: string
  refreshCredits: () => Promise<void>
}

const ClientContext = createContext<ClientCtx>({
  userName: '', companyName: '', credits: 0, clientUserId: '', clientId: '', customizationTier: 'basic',
  refreshCredits: async () => {},
})

export function useClientContext() { return useContext(ClientContext) }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [credits, setCredits] = useState(0)
  const [clientUserId, setClientUserId] = useState('')
  const [clientId, setClientId] = useState('')
  const [customizationTier, setCustomizationTier] = useState('basic')

  async function refreshCredits() {
    if (!clientUserId) return
    const { data } = await supabase.from('client_users').select('allocated_credits').eq('id', clientUserId).single()
    if (data) setCredits(data.allocated_credits)
  }

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'client') { router.push('/login'); return }
      setUserName(userData.name)
      const { data: cu } = await supabase.from('client_users').select('id, allocated_credits, client_id, clients(company_name, customization_tier)').eq('user_id', user.id).single()
      if (cu) {
        setCredits(cu.allocated_credits)
        setClientUserId(cu.id)
        setClientId(cu.client_id)
        setCompanyName((cu as any).clients?.company_name || '')
        setCustomizationTier((cu as any).clients?.customization_tier || 'basic')
      }
      setReady(true)
    }
    check()
  }, [router])

  if (!ready) return null
  return (
    <ClientContext.Provider value={{ userName, companyName, credits, clientUserId, clientId, customizationTier, refreshCredits }}>
      <div className="dashboard-scale" style={{ background: 'linear-gradient(to right, #0A0A0A 240px, #f5f4f0 240px)', minHeight: '100vh' }}>{children}</div>
    </ClientContext.Provider>
  )
}
