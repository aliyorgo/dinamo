'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const NAV = [
  { label: 'GENEL BAKIŞ', href: '/dashboard/admin' },
  { label: 'KULLANICILAR', href: '/dashboard/admin/users' },
  { label: 'MÜŞTERİLER', href: '/dashboard/admin/clients' },
  { label: 'BRİEFLER', href: '/dashboard/admin/briefs' },
  { label: 'KREDİLER', href: '/dashboard/admin/credits' },
  { label: 'AYARLAR', href: '/dashboard/admin/settings' },
]

export default function AdminDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [stats, setStats] = useState({ briefs: 0, clients: 0, creators: 0 })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: userData } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'admin') { router.push('/login'); return }
      setUserName(userData.name)

      const [briefs, clients, creators] = await Promise.all([
        supabase.from('briefs').select('id', { count: 'exact', head: true }),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('creators').select('id', { count: 'exact', head: true }),
      ])
      setStats({ briefs: briefs.count || 0, clients: clients.count || 0, creators: creators.count || 0 })
    }
    load()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f7f6f2' }}>
      <div style={{ width: '220px', background: '#0a0a0a', padding: '32px 0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '0 24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '20px', fontWeight: '500', color: '#fff', letterSpacing: '-0.5px' }}>
            dinam<span style={{ display: 'inline-block', width: '18px', height: '18px', borderRadius: '50%', border: '4px solid #1db81d', position: 'relative', top: '2px' }}></span>
          </div>
          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px', letterSpacing: '1px', fontFamily: 'monospace' }}>ADMIN</div>
        </div>
        <nav style={{ flex: 1, padding: '24px 0' }}>
          {NAV.map(item => (
            <a key={item.href} href={item.href} style={{ display: 'block', padding: '10px 24px', fontSize: '11px', color: '#888', textDecoration: 'none', letterSpacing: '1px', fontFamily: 'monospace' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#888')}>
              {item.label}
            </a>
          ))}
        </nav>
        <div style={{ padding: '24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>{userName}</div>
          <button onClick={handleLogout} style={{ fontSize: '11px', color: '#666', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '1px', fontFamily: 'monospace', padding: 0 }}>
            ÇIKIŞ YAP
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: '48px' }}>
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '300', letterSpacing: '-1px', margin: 0 }}>Genel Bakış</h1>
          <p style={{ color: '#888', fontSize: '14px', marginTop: '8px' }}>Dinamo Admin Paneli</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '40px' }}>
          {[
            { label: 'Toplam Brief', value: stats.briefs },
            { label: 'Müşteri', value: stats.clients },
            { label: 'Creator', value: stats.creators },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#fff', border: '1px solid #e8e7e3', borderRadius: '12px', padding: '24px' }}>
              <div style={{ fontSize: '32px', fontWeight: '300', letterSpacing: '-1px' }}>{stat.value}</div>
              <div style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e8e7e3', borderRadius: '12px', padding: '24px' }}>
          <div style={{ fontSize: '12px', color: '#888', letterSpacing: '1px', fontFamily: 'monospace', marginBottom: '20px' }}>HIZLI İŞLEMLER</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { label: 'Yeni Kullanıcı', href: '/dashboard/admin/users/new' },
              { label: 'Yeni Müşteri', href: '/dashboard/admin/clients/new' },
              { label: 'Briefleri Gör', href: '/dashboard/admin/briefs' },
              { label: 'Kredi Yönetimi', href: '/dashboard/admin/credits' },
            ].map(action => (
              <a key={action.href} href={action.href}
                style={{ padding: '10px 20px', background: '#0a0a0a', color: '#fff', borderRadius: '100px', fontSize: '13px', textDecoration: 'none', fontWeight: '500' }}>
                {action.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}