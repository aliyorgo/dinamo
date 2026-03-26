'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const statusLabel: Record<string, string> = {
  submitted: 'İnceleniyor',
  read: 'İncelendi',
  in_production: 'Üretimde',
  revision: 'Revizyon',
  approved: 'Onaylandı',
  delivered: 'Teslim Edildi',
}

const statusColor: Record<string, string> = {
  submitted: '#888',
  read: '#888',
  in_production: '#f59e0b',
  revision: '#e24b4a',
  approved: '#1db81d',
  delivered: '#1db81d',
}

export default function ClientDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [credits, setCredits] = useState(0)
  const [briefs, setBriefs] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: userData } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'client') { router.push('/login'); return }
      setUserName(userData.name)

      const { data: clientUser } = await supabase.from('client_users').select('credit_balance, client_id').eq('user_id', user.id).single()
      if (clientUser) {
        setCredits(clientUser.credit_balance)
        const { data: briefData } = await supabase
          .from('briefs')
          .select('*')
          .eq('client_id', clientUser.client_id)
          .order('created_at', { ascending: false })
        setBriefs(briefData || [])
      }
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
          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px', letterSpacing: '1px', fontFamily: 'monospace' }}>MÜŞTERİ</div>
        </div>
        <nav style={{ flex: 1, padding: '24px 0' }}>
          {[
            { label: 'PROJELERİM', href: '/dashboard/client' },
            { label: 'YENİ BRİEF', href: '/dashboard/client/brief/new' },
          ].map(item => (
            <a key={item.href} href={item.href} style={{ display: 'block', padding: '10px 24px', fontSize: '11px', color: '#888', textDecoration: 'none', letterSpacing: '1px', fontFamily: 'monospace' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#888')}>
              {item.label}
            </a>
          ))}
        </nav>
        <div style={{ padding: '24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '11px', color: '#666', letterSpacing: '1px', fontFamily: 'monospace', marginBottom: '4px' }}>KREDİ BAKİYESİ</div>
          <div style={{ fontSize: '24px', fontWeight: '300', color: '#fff', letterSpacing: '-1px', marginBottom: '12px' }}>{credits}</div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>{userName}</div>
          <button onClick={handleLogout} style={{ fontSize: '11px', color: '#666', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '1px', fontFamily: 'monospace', padding: 0 }}>
            ÇIKIŞ YAP
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: '48px' }}>
        <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '300', letterSpacing: '-1px', margin: 0 }}>Projelerim</h1>
            <p style={{ color: '#888', fontSize: '14px', marginTop: '8px' }}>Tüm brief ve video üretimleriniz</p>
          </div>
          <a href="/dashboard/client/brief/new"
            style={{ padding: '12px 24px', background: '#0a0a0a', color: '#fff', borderRadius: '100px', fontSize: '14px', textDecoration: 'none', fontWeight: '500' }}>
            + Yeni Brief
          </a>
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          {briefs.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e8e7e3', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
              <div style={{ color: '#888', fontSize: '14px', marginBottom: '20px' }}>Henüz brief göndermediniz.</div>
              <a href="/dashboard/client/brief/new"
                style={{ padding: '12px 24px', background: '#0a0a0a', color: '#fff', borderRadius: '100px', fontSize: '14px', textDecoration: 'none', fontWeight: '500' }}>
                İlk Brief'inizi Gönderin
              </a>
            </div>
          ) : briefs.map(brief => (
            <div key={brief.id}
              onClick={() => router.push(`/dashboard/client/briefs/${brief.id}`)}
              style={{ background: '#fff', border: '1px solid #e8