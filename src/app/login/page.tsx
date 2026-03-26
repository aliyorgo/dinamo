'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-posta veya şifre hatalı.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f6f2', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #e8e7e3', borderRadius: '16px', padding: '48px', width: '100%', maxWidth: '400px' }}>
        <div style={{ marginBottom: '32px', textAlign: 'center', fontSize: '24px', fontWeight: '500' }}>
          dinamo
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>E-posta</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8e7e3', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Şifre</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8e7e3', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
          {error && <div style={{ color: '#e24b4a', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '12px', background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <a href="#" style={{ fontSize: '13px', color: '#888', textDecoration: 'none' }}>Şifremi unuttum</a>
        </div>
      </div>
    </div>
  )
}