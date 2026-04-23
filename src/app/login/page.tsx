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
  const [resetMode, setResetMode] = useState(false)
  const [resetMsg, setResetMsg] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-posta veya şifre hatalı.')
      setLoading(false)
      return
    }
    // Log login activity
    if (authData?.session?.access_token) {
      fetch('/api/activity-log', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authData.session.access_token}` },
        body: JSON.stringify({ actionType: 'auth.login', userName: email })
      }).catch(() => {})
    }
    router.push('/dashboard')
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { setError('E-posta adresinizi girin.'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://dinamo.media/reset-password',
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setResetMsg('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '14px 16px', fontSize: '14px', fontFamily: "'Inter', sans-serif",
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', color: '#fff', outline: 'none',
    transition: 'border-color 0.3s',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0a', fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');
        input::placeholder { color: rgba(255,255,255,0.25); }
        input:focus { border-color: #1db81d !important; }
      `}</style>
      <div style={{ width: '100%', maxWidth: '380px', padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{ height: '48px' }} />
        </div>

        {/* Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '400' }}>E-posta</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="ornek@sirket.com" style={inputStyle} />
          </div>
          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '400' }}>Şifre</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••" style={inputStyle} />
          </div>
          {error && (
            <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', fontWeight: '400' }}>{error}</div>
          )}
          {resetMsg && (
            <div style={{ color: '#22c55e', fontSize: '13px', marginBottom: '16px', fontWeight: '400' }}>{resetMsg}</div>
          )}
          {!resetMode ? (
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px', background: '#1db81d', color: '#fff',
              border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '500',
              cursor: 'pointer', fontFamily: "'Inter', sans-serif",
              transition: 'opacity 0.3s',
              opacity: loading ? 0.6 : 1,
            }}>
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          ) : (
            <button type="button" onClick={handleReset} disabled={loading} style={{
              width: '100%', padding: '14px', background: 'rgba(255,255,255,0.08)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', fontSize: '14px', fontWeight: '500',
              cursor: 'pointer', fontFamily: "'Inter', sans-serif",
              opacity: loading ? 0.6 : 1,
            }}>
              {loading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
            </button>
          )}
        </form>
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <span onClick={() => { setResetMode(!resetMode); setError(''); setResetMsg('') }}
            style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', fontWeight: '300', cursor: 'pointer' }}>
            {resetMode ? 'Giriş Yap' : 'Şifremi unuttum'}
          </span>
        </div>
      </div>
    </div>
  )
}
