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
  const [stats, setStats] = useState<{totalCredits:number,totalEarned:number,thisMonthEarned:number,netEarned:number,pending:number,paid:number}|null>(null)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: ud } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!ud || ud.role !== 'creator') { router.push('/login'); return }
      setUserName(ud.name || '')
      const { data: st } = await supabase.from('admin_settings').select('value').eq('key', 'creator_credit_rate').maybeSingle()
      if (st) setCreditRate(Number(st.value) || 0)
      // Stats
      const { data: creator } = await supabase.from('creators').select('id, entity_type').eq('user_id', user.id).maybeSingle()
      if (creator) {
        const { data: earnings } = await supabase.from('creator_earnings').select('credits, tl_amount, paid, created_at').eq('creator_id', creator.id)
        const { data: payments } = await supabase.from('creator_payments').select('amount_tl').eq('creator_id', creator.id)
        const isIndiv = creator.entity_type === 'personal' || !creator.entity_type
        const taxRate = isIndiv ? 0.25 : 0
        const totalCredits = (earnings || []).reduce((s, e) => s + e.credits, 0)
        const totalEarned = (earnings || []).reduce((s, e) => s + Number(e.tl_amount), 0)
        const now = new Date()
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        const thisMonthEarned = (earnings || []).filter(e => e.created_at >= monthStart).reduce((s, e) => s + Number(e.tl_amount), 0)
        const pending = (earnings || []).filter(e => !e.paid).reduce((s, e) => s + Number(e.tl_amount), 0)
        const paid = (payments || []).reduce((s, p) => s + Number(p.amount_tl), 0)
        if (totalCredits > 0) setStats({ totalCredits, totalEarned, thisMonthEarned, netEarned: totalEarned - Math.round(totalEarned * taxRate), pending: pending - Math.round(pending * taxRate), paid })
      }
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
      <div className="dinamo-sidebar" style={{ width: '240px', background: '#0A0A0A', flexShrink: 0, overflowY: 'auto' }}>
        {/* 1) Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{ height: '28px', display: 'block', marginBottom: '12px' }} />
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '3px' }}>Creator</div>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff' }}>{userName}</div>
        </div>

        {/* 2) Navigation */}
        <nav style={{ padding: '10px 8px' }}>
          {NAV.map(link => (
            <Link key={link.href} href={link.href}
              style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', marginBottom: '1px', cursor: 'pointer', background: isActive(link.href) ? 'rgba(255,255,255,0.08)' : 'transparent', borderLeft: isActive(link.href) ? '2px solid #22c55e' : '2px solid transparent', textDecoration: 'none' }}>
              <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: isActive(link.href) ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: '500' }}>{link.label}</span>
            </Link>
          ))}
        </nav>

        {/* 3) Stats */}
        {creditRate > 0 && (
          <div style={{ padding: '12px 16px' }}>
            <div style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
              {[
                { label: 'KREDİ KURU', value: `1 kr → ${creditRate.toLocaleString('tr-TR')} ₺` },
                ...(stats ? [
                  { label: 'TOPLAM', value: `${stats.totalCredits} kr · ${stats.totalEarned.toLocaleString('tr-TR')} ₺` },
                  { label: 'BU AY', value: `${stats.thisMonthEarned.toLocaleString('tr-TR')} ₺` },
                  { label: 'NET', value: `${stats.netEarned.toLocaleString('tr-TR')} ₺` },
                  { label: 'BEKLEYEN', value: `${stats.pending.toLocaleString('tr-TR')} ₺` },
                  { label: 'ÖDENEN', value: `${stats.paid.toLocaleString('tr-TR')} ₺` },
                ] : []),
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>{row.label}</span>
                  <span style={{ fontSize: '11px', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4) Logout */}
        <div style={{ padding: '10px 8px' }}>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>Çıkış yap</span>
          </button>
        </div>

        {/* 5) DCC */}
        <div style={{ padding: '8px 16px 16px' }}>
          <a href="https://dirtycheapcreative.com" target="_blank" rel="noopener noreferrer">
            <img src="/powered_by_dcc.png" alt="Powered by DCC" style={{ height: '18px', opacity: 0.4 }} />
          </a>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0', minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}
