'use client'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

type NavItem = { href?: string; label: string; divider?: boolean }

const navLinks: Record<string, NavItem[]> = {
  admin: [
    { href: '/dashboard/admin', label: 'Genel Bakış' },
    { href: '/dashboard/admin/briefs', label: 'Briefler' },
    { href: '/dashboard/admin/credits', label: 'Müşteriler' },
    { href: '/dashboard/admin/agencies', label: 'Ajanslar' },
    { href: '/dashboard/admin/creators', label: "Creator'lar" },
    { href: '/dashboard/admin/reports', label: 'Raporlar' },
    { href: '/dashboard/admin/invoices', label: 'Faturalar' },
    { href: '/dashboard/admin/music-library', label: 'Music Library' },
    { href: '/dashboard/admin/homepage', label: 'Ana Sayfa' },
    { href: '/dashboard/admin/settings', label: 'Ayarlar' },
  ],
  client: [
    { href: '/dashboard/client', label: 'Projelerim' },
    { href: '/dashboard/client/brief/new', label: 'Yeni Brief' },
    { href: '/dashboard/client/brand-identity', label: 'Marka Kimliği' },
    { href: '/dashboard/client/reports', label: 'Raporlar' },
    { href: '/dashboard/client/certificates', label: 'Telif Belgeleri' },
    { href: '/dashboard/client/guarantee', label: 'İçerik Güvencesi' },
  ],
  producer: [],
  creator: [
    { href: '/dashboard/creator', label: 'İşlerim' },
  ],
  agency: [
    { href: '/dashboard/agency/overview', label: 'Genel Bakış' },
    { href: '/dashboard/agency/clients', label: 'Müşterilerim' },
    { href: '/dashboard/agency/members', label: 'Ekip Üyeleri' },
    { href: '/dashboard/agency/production', label: 'Üretim Raporu' },
    { href: '/dashboard/agency/earnings', label: 'Kazançlar' },
    { divider: true, label: 'Stüdyo' },
    { href: '/dashboard/agency/studio/briefs', label: 'Brieflerim' },
    { href: '/dashboard/agency/studio/credits', label: 'Kredi Satın Al' },
  ],
  agency_member: [
    { href: '/dashboard/agency-member/studio', label: 'İşlerim' },
    { href: '/dashboard/agency-member/studio/new', label: 'Yeni İş Oluştur' },
  ],
}

const roleLabels: Record<string, string> = {
  admin: 'Admin', client: 'Müşteri', producer: 'Prodüktör',
  creator: 'Creator', agency: 'Ajans', agency_member: 'Ajans Üyesi',
}

interface SidebarProps {
  role: string
  userName: string
  companyName?: string
  credits?: number
  extra?: React.ReactNode
}

export default function Sidebar({ role, userName, companyName, credits, extra }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const links = navLinks[role] || []

  const isLight = false // all sidebars dark
  const bgColor = isLight ? '#FFFFFF' : '#0A0A0A'
  const textColor = isLight ? '#666' : 'rgba(255,255,255,0.4)'
  const activeTextColor = isLight ? '#0A0A0A' : '#FFFFFF'
  const activeBg = isLight ? '#F5F5F5' : 'rgba(255,255,255,0.08)'
  const hoverBg = isLight ? '#F5F5F5' : 'rgba(255,255,255,0.06)'
  const logoSrc = isLight ? '/dinamo_logo_siyah.png' : '/dinamo_logo.png'
  const borderRight = isLight ? '1px solid #E8E8E4' : 'none'
  const borderColor = isLight ? '#E8E8E4' : 'rgba(255,255,255,0.07)'
  const userBlockBg = isLight ? '#F0F7F0' : 'rgba(29,184,29,0.06)'
  const userNameColor = isLight ? '#0A0A0A' : '#FFFFFF'
  const subTextColor = isLight ? '#888' : 'rgba(255,255,255,0.4)'
  const dividerColor = isLight ? '#E8E8E4' : 'rgba(255,255,255,0.07)'
  const logoutColor = isLight ? '#AAA' : 'rgba(255,255,255,0.25)'

  function isActive(href?: string) {
    if (!href) return false
    if (href === '/dashboard/admin' && pathname === '/dashboard/admin') return true
    if (href === '/dashboard/client' && pathname === '/dashboard/client') return true
    if (href === '/dashboard/creator' && pathname === '/dashboard/creator') return true
    if (href === '/dashboard/agency/overview' && pathname === '/dashboard/agency/overview') return true
    if (href === '/dashboard/agency-member/studio' && pathname === '/dashboard/agency-member/studio') return true
    if (href !== '/dashboard/admin' && href !== '/dashboard/client' && href !== '/dashboard/creator' && href !== '/dashboard/agency/overview' && href !== '/dashboard/agency-member/studio') {
      return pathname.startsWith(href)
    }
    return false
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{
      width: '240px', background: bgColor, borderRight,
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 24px 16px' }}>
        <img src={logoSrc} alt="Dinamo" style={{ height: '28px' }} />
      </div>

      {/* User info block */}
      <div style={{
        margin: '0 12px 12px', padding: '16px 20px',
        background: userBlockBg, borderLeft: '3px solid #1DB81D',
      }}>
        <div style={{ fontSize: '18px', fontWeight: '700', color: userNameColor, marginBottom: '2px' }}>
          {companyName || roleLabels[role] || role}
        </div>
        <div style={{ fontSize: '13px', color: subTextColor }}>{userName}</div>
        {credits !== undefined && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ fontSize: '10px', color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>KREDİ BAKİYESİ</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#1DB81D', letterSpacing: '-1px' }}>{credits}</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {links.map((item, i) => {
          if (item.divider) {
            return (
              <div key={i} style={{ padding: '16px 24px 6px', borderTop: `1px solid ${dividerColor}`, marginTop: '8px' }}>
                <span style={{ fontSize: '10px', color: subTextColor, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{item.label}</span>
              </div>
            )
          }
          const active = isActive(item.href)
          return (
            <div key={item.href} onClick={() => item.href && router.push(item.href)}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = hoverBg; e.currentTarget.style.borderLeft = '2px solid #1DB81D'; (e.currentTarget.firstChild as HTMLElement).style.color = activeTextColor } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeft = '2px solid transparent'; (e.currentTarget.firstChild as HTMLElement).style.color = textColor } }}
              style={{
                padding: '10px 24px', cursor: 'pointer',
                background: active ? activeBg : 'transparent',
                borderLeft: active ? '2px solid #1DB81D' : '2px solid transparent',
                transition: 'all 0.15s ease',
              }}>
              <span style={{
                fontSize: '13px', letterSpacing: '0.05em',
                color: active ? activeTextColor : textColor,
                fontWeight: active ? '600' : '400',
                transition: 'color 0.15s ease',
              }}>{item.label}</span>
            </div>
          )
        })}
      </nav>

      {/* Extra content (agency widget etc) */}
      {extra}

      {/* Logout */}
      <div style={{ padding: '12px 24px', borderTop: `1px solid ${dividerColor}` }}>
        <button onClick={handleLogout}
          onMouseEnter={e => { e.currentTarget.style.color = '#FF4444' }}
          onMouseLeave={e => { e.currentTarget.style.color = logoutColor }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: logoutColor, padding: '6px 0', width: '100%', textAlign: 'left', transition: 'color 0.15s ease',  }}>
          Çıkış Yap
        </button>
      </div>
    </div>
  )
}
