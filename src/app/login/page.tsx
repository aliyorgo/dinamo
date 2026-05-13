'use client'

import { useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

const supabase = getSupabaseBrowser()

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '12px 14px', fontSize: '14px',
  background: 'transparent', border: '1px solid #6b6b66',
  color: '#fff', outline: 'none',
  transition: 'border-color 0.15s, border-width 0.1s',
}

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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
      <style>{`
        input::placeholder { color: #6b6b66; }
        input:focus { border-color: #ffffff !important; border-width: 2px !important; }
      `}</style>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{ height: '48px' }} />
        </div>

        {/* Title */}
        <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#6b6b66', fontWeight: '500', textAlign: 'center', marginBottom: '32px' }}>
          {resetMode ? 'ŞİFRE SIFIRLAMA' : 'GİRİŞ YAP'}
        </div>

        {/* Form */}
        <form onSubmit={resetMode ? handleReset : handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b6b66', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500' }}>E-POSTA</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="ornek@sirket.com" style={inputStyle} />
          </div>
          {!resetMode && (
            <div style={{ marginBottom: '28px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#6b6b66', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500' }}>ŞİFRE</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••" style={inputStyle} />
            </div>
          )}
          {error && (
            <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>{error}</div>
          )}
          {resetMsg && (
            <div style={{ color: '#4ade80', fontSize: '13px', marginBottom: '16px' }}>{resetMsg}</div>
          )}
          <button type={resetMode ? 'button' : 'submit'} onClick={resetMode ? handleReset : undefined} disabled={loading}
            style={{
              width: '100%', padding: '14px',
              background: '#ffffff', color: '#0a0a0a',
              border: '1px solid #ffffff',
              fontSize: '11px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.15s',
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.color = '#ffffff' } }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#0a0a0a' }}>
            {resetMode ? (loading ? 'GÖNDERİLİYOR...' : 'SIFIRLAMA BAĞLANTISI GÖNDER') : (loading ? 'GİRİŞ YAPILIYOR...' : 'GİRİŞ YAP')}
          </button>
        </form>

        {/* Links */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <span onClick={() => { setResetMode(!resetMode); setError(''); setResetMsg('') }}
            style={{ fontSize: '13px', color: '#6b6b66', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#4ade80' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6b6b66' }}>
            {resetMode ? 'Giriş Yap' : 'Şifremi unuttum'}
          </span>
        </div>
      </div>
    </div>
  )
}
