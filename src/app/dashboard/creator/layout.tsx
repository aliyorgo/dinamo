'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const NAV = [
  { href: '/dashboard/creator', label: 'İşlerim' },
  { href: '/dashboard/creator/portfolio', label: 'Portfolio' },
  { href: '/dashboard/creator/wallet', label: 'Cüzdan' },
  { href: '/dashboard/creator/profile', label: 'Profil' },
]

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [userName, setUserName] = useState('')
  const [creditRate, setCreditRate] = useState(0)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: ud } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!ud || ud.role !== 'creator') { router.push('/login'); return }
      setUserName(ud.name || '')
      const { data: st } = await supabase.from('admin_settings').select('value').eq('key', 'creator_credit_rate').maybeSingle()
      if (st) setCreditRate(Number(st.value) || 0)
      setReady(true)
    }
    check()
  }, [router])

  function isActive(href: string) {
    if (href === '/dashboard/creator') return pathname === '/dashboard/creator'
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!ready) return null

  return (
    <div className="dashboard-scale" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* SIDEBAR */}
      <div className="dinamo-sidebar" style={{ width: '240px', background: '#0A0A0A', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{ height: '28px', display: 'block', marginBottom: '12px' }} />
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '3px' }}>Creator</div>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff' }}>{userName}</div>
        </div>

        {creditRate > 0 && (
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ padding: '10px 12px', border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.05)' }}>
              <div style={{ fontSize: '9px', color: 'rgba(34,197,94,0.7)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>KREDİ BAŞINA KAZANÇ</div>
              <div style={{ fontSize: '22px', fontWeight: '300', color: '#22c55e', letterSpacing: '-1px' }}>{creditRate.toLocaleString('tr-TR')} <span style={{ fontSize: '12px' }}>₺</span></div>
            </div>
          </div>
        )}

        <nav style={{ padding: '10px 8px', flex: 1 }}>
          {NAV.map(link => (
            <Link key={link.href} href={link.href}
              style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', marginBottom: '1px', cursor: 'pointer', background: isActive(link.href) ? 'rgba(255,255,255,0.08)' : 'transparent', borderLeft: isActive(link.href) ? '2px solid #22c55e' : '2px solid transparent', textDecoration: 'none' }}>
              <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: isActive(link.href) ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: '500' }}>{link.label}</span>
            </Link>
          ))}
        </nav>

        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>Çıkış yap</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0', minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}
