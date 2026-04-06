'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function DemoRequestPage() {
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.from('demo_requests').insert({
      name: form.name, company: form.company, email: form.email, phone: form.phone || null,
    })
    if (err) { setError('Bir sorun oluştu, lütfen tekrar deneyin.'); setLoading(false); return }
    setSuccess(true)
    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '14px 16px', fontSize: '14px',
    fontFamily: "'Inter', sans-serif", background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '10px', color: '#0a0a0a', outline: 'none', transition: 'border-color 0.2s',
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', fontFamily: "'Inter', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');`}</style>
        <div style={{ textAlign: 'center', maxWidth: '440px', padding: '0 24px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '300', color: '#fff', letterSpacing: '-1px', marginBottom: '12px' }}>Talebiniz Alındı</div>
          <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.8 }}>En kısa sürede sizi arayacağız. Demo hesabınızı birlikte kuracağız.</div>
          <a href="/test" style={{ display: 'inline-block', marginTop: '40px', fontSize: '13px', color: 'rgba(255,255,255,0.25)' }}>← Ana sayfaya dön</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500&display=swap');
        input::placeholder { color: rgba(0,0,0,0.25); }
        input:focus { border-color: #22c55e !important; }
      `}</style>

      <div style={{ width: '100%', maxWidth: '600px', padding: '60px 24px' }}>
        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '36px', fontWeight: '500', color: '#fff', letterSpacing: '-1px' }}>
            dinam<span style={{ display: 'inline-block', width: '28px', height: '28px', borderRadius: '50%', border: '4px solid #22c55e', position: 'relative', top: '5px', marginLeft: '2px' }}></span>
          </span>
        </div>

        {/* TITLE */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: '300', color: '#fff', letterSpacing: '-2px', margin: 0, lineHeight: 1.1 }}>
            Dinamo'yu<br />Ücretsiz Deneyin
          </h1>
        </div>

        {/* DESCRIPTION */}
        <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto 20px' }}>
          <p style={{ fontSize: '16px', fontWeight: '300', color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, margin: '0 0 16px' }}>
            Dijital platformlarda içerik ihtiyacı hiç olmadığı kadar hızlı büyüyor. Her hafta yeni format, her gün yeni trend. Dinamo, markaların bu hıza yetişmesi için tasarlandı.
          </p>
          <p style={{ fontSize: '16px', fontWeight: '300', color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, margin: '0 0 16px' }}>
            Brief yazın ya da sadece anlatın — Dinamo'nun AI'ı bunu profesyonel bir prodüksiyon brief'ine dönüştürsün. Ücretsiz kredinizle gerçek bir video üretin. Onay sürecini, revizyon akışını ve teslim kalitesini bizzat görün.
          </p>
          <p style={{ fontSize: '16px', fontWeight: '300', color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, margin: '0 0 16px' }}>
            Demo talebinizin ardından sizi arıyoruz. Kısa bir tanışma görüşmesinde markanızı ve ihtiyaçlarınızı dinliyoruz. Hesabınızı açıyor, kredinizi yüklüyor, ilk brief'inizi birlikte yazıyoruz. 24 saat içinde ilk videonuz hazır.
          </p>
          <p style={{ fontSize: '16px', fontWeight: '300', color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, margin: 0 }}>
            Şeffaf kredi sistemi — ne kadar harcayacağınızı önceden bilirsiniz. Onaylamadan ödeme yok. Revizyon hakkı dahil.
          </p>
        </div>

        {/* SEPARATOR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '40px auto', maxWidth: '480px' }}>
          <div style={{ flex: 1, height: '1px', background: '#22c55e', opacity: 0.3 }}></div>
          <div style={{ fontSize: '10px', color: '#22c55e', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: '400' }}>Demo Talep</div>
          <div style={{ flex: 1, height: '1px', background: '#22c55e', opacity: 0.3 }}></div>
        </div>

        {/* FORM */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '480px', margin: '0 auto' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '400' }}>Ad Soyad</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Adınız Soyadınız" style={inputStyle} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '400' }}>Şirket Adı</label>
              <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} required placeholder="Şirketinizin adı" style={inputStyle} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '400' }}>E-posta</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="ornek@sirket.com" style={inputStyle} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '400' }}>Telefon</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="05XX XXX XXXX" style={inputStyle} />
            </div>
            {error && <div style={{ fontSize: '13px', color: '#ef4444', marginBottom: '16px', lineHeight: 1.5 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '15px', background: '#22c55e', color: '#fff', border: 'none',
              borderRadius: '10px', fontSize: '15px', fontWeight: '500', cursor: 'pointer',
              fontFamily: "'Inter', sans-serif", opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s',
            }}>
              {loading ? 'Gönderiliyor...' : 'Demo Talep Et'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <a href="/test" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)' }}>← Ana sayfaya dön</a>
        </div>
      </div>
    </div>
  )
}
