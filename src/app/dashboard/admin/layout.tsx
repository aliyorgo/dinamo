'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const NAV = [
  { href: '/dashboard/admin', label: 'Genel Bakış' },
  { href: '/dashboard/admin/briefs', label: 'Briefler' },
  { href: '/dashboard/admin/credits', label: 'Kredi Yönetimi' },
  { href: '/dashboard/admin/clients', label: 'Müşteriler' },
  { href: '/dashboard/admin/users', label: 'Kullanıcılar' },
  { href: '/dashboard/admin/creators', label: "Creator'lar" },
  { href: '/dashboard/admin/reports', label: 'Raporlar' },
  { href: '/dashboard/admin/settings', label: 'Ayarlar' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [userName, setUserName] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!data || data.role !== 'admin') { router.push('/login'); return }
      setUserName(data.name || user.email || '')
      setReady(true)
    }
    check()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/dashboard/admin') return pathname === '/dashboard/admin'
    return pathname.startsWith(href)
  }

  if (!ready) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div className="dinamo-sidebar">
        <img src="/dinamo_logo_siyah.png" alt="Dinamo" style={{ height: '28px', width: 'auto', objectFit: 'contain', display: 'block', padding: '24px 0 16px 24px' }} />
        <div className="dinamo-user-block">
          <div className="dinamo-user-company">{userName}</div>
          <div className="dinamo-user-name">Admin</div>
        </div>
        <nav style={{ flex: 1 }}>
          {NAV.map(link => (
            <Link key={link.href} href={link.href}
              className={`dinamo-nav-link${isActive(link.href) ? ' active' : ''}`}>
              {link.label}
            </Link>
          ))}
        </nav>
        <button onClick={handleLogout} className="dinamo-signout">Çıkış Yap</button>
      </div>
      <div className="dinamo-main-content" style={{ flex: 1, marginLeft: '240px', minWidth: 0, width: '100%' }}>
        {children}
      </div>
    </div>
  )
}
