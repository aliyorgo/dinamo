'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const supabase = getSupabaseBrowser()

const AdminContext = createContext<{ role: string }>({ role: 'admin' })
export function useAdminContext() { return useContext(AdminContext) }

const PRODUCER_BLOCKED = ['/dashboard/admin/credits', '/dashboard/admin/creators', '/dashboard/admin/reports', '/dashboard/admin/activity', '/dashboard/admin/settings', '/dashboard/admin/agencies', '/dashboard/admin/invoices', '/dashboard/admin/homepage']

const NAV = [
  { href: '/dashboard/admin', label: 'Genel Bakış' },
  { href: '/dashboard/admin/briefs', label: 'Briefler' },
  { href: '/dashboard/admin/credits', label: 'Müşteriler', adminOnly: true },
  { href: '/dashboard/admin/creators', label: "Creator'lar", adminOnly: true },
  { href: '/dashboard/admin/reports', label: 'Raporlar', adminOnly: true },
  { href: '/dashboard/admin/personas', label: 'Personalar', adminOnly: true },
  { href: '/dashboard/admin/music-library', label: 'Music Library' },
  { href: '/dashboard/admin/activity', label: 'Loglar', adminOnly: true },
  { href: '/dashboard/admin/settings', label: 'Ayarlar', adminOnly: true },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      console.log('[ADMIN-LAYOUT] user.id:', user.id, '| DB role:', data?.role, '| name:', data?.name)
      if (!data || (data.role !== 'admin' && data.role !== 'producer')) { router.push('/login'); return }
      setUserName(data.name || user.email || '')
      setUserRole(data.role)
      // Producer URL guard
      if (data.role === 'producer' && PRODUCER_BLOCKED.some(p => pathname.startsWith(p))) {
        router.push('/dashboard/admin')
        return
      }
      setReady(true)
    }
    check()
  }, [router, pathname])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/dashboard/admin') return pathname === '/dashboard/admin'
    return pathname.startsWith(href)
  }

  if (!ready) return null

  const visibleNav = NAV.filter(link => !(link.adminOnly && userRole === 'producer'))
  console.log('[ADMIN-LAYOUT] render | userRole:', userRole, '| visibleNav:', visibleNav.length, '/', NAV.length)

  return (
    <AdminContext.Provider value={{ role: userRole }}>
      <div className="dashboard-scale" style={{ display: 'flex', minHeight: '100vh' }}>
        <div className="dinamo-sidebar">
          <div style={{ padding: '24px 24px 16px', cursor: 'pointer' }} onClick={() => router.push('/dashboard/admin')}>
            <img src="/dinamo_logo.png" alt="Dinamo" style={{ height: '28px', width: 'auto', objectFit: 'contain', display: 'block' }} />
          </div>
          <div className="dinamo-user-block">
            <div className="dinamo-user-company">{userName}</div>
            <div className="dinamo-user-name">{userRole === 'producer' ? 'Prodüktör' : 'Admin'}</div>
          </div>
          <nav>
            {visibleNav.map(link => (
              <Link key={link.href} href={link.href}
                className={`dinamo-nav-link${isActive(link.href) ? ' active' : ''}`}>
                {link.label}
              </Link>
            ))}
          </nav>
          <button onClick={handleLogout} className="dinamo-signout">Çıkış Yap</button>
          <a href="https://dirtycheapcreative.com" target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '16px 24px' }}>
            <img src="/powered_by_dcc.png" alt="Powered by DCC" style={{ height: '20px', width: 'auto', opacity: 0.5 }} />
          </a>
        </div>
        <div className="dinamo-main-content" style={{ flex: 1, marginLeft: '240px', minWidth: 0, width: '100%' }}>
          {children}
        </div>
      </div>
    </AdminContext.Provider>
  )
}
