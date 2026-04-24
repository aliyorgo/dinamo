'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '12px 14px', fontSize: '14px',
  background: 'transparent', border: '1px solid #6b6b66',
  color: '#fff', outline: 'none',
  transition: 'border-color 0.15s',
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {}
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return }
    if (password !== confirm) { setError('Şifreler eşleşmiyor.'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setMsg('Şifreniz güncellendi. Giriş sayfasına yönlendiriliyorsunuz...')
    setTimeout(() => router.push('/login'), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
      <style>{`
        input::placeholder { color: #6b6b66; }
        input:focus { border-color: #ffffff !important; border-width: 2px !important; }
      `}</style>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{ height: '48px' }} />
        </div>
        <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#6b6b66', fontWeight: '500', textAlign: 'center', marginBottom: '32px' }}>
          YENİ ŞİFRE BELİRLEYİN
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b6b66', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500' }}>YENİ ŞİFRE</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" style={inputStyle} />
          </div>
          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#6b6b66', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '500' }}>ŞİFRE TEKRAR</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="••••••••" style={inputStyle} />
          </div>
          {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
          {msg && <div style={{ color: '#4ade80', fontSize: '13px', marginBottom: '16px' }}>{msg}</div>}
          <button type="submit" disabled={loading}
            style={{
              width: '100%', padding: '14px',
              background: '#ffffff', color: '#0a0a0a',
              border: '1px solid #ffffff',
              fontSize: '11px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase',
              cursor: 'pointer', opacity: loading ? 0.6 : 1,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.color = '#ffffff' } }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#0a0a0a' }}>
            {loading ? 'GÜNCELLENİYOR...' : 'ŞİFREYİ GÜNCELLE'}
          </button>
        </form>
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <span onClick={() => router.push('/login')}
            style={{ fontSize: '13px', color: '#6b6b66', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#4ade80' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6b6b66' }}>
            Giriş sayfasına dön
          </span>
        </div>
      </div>
    </div>
  )
}
