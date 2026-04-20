'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  const [packages, setPackages] = useState<any[]>([])
  const [homeVideos, setHomeVideos] = useState<any[]>([])
  const [videoCredits, setVideoCredits] = useState<Record<string,number>>({})
  const [cms, setCms] = useState<Record<string,string>>({})

  function c(key: string, fallback: string) { return cms[key] || fallback }

  useEffect(() => {
    setMounted(true)
    supabase.from('credit_packages').select('*').order('credits').then(({ data }) => {
      if (data) setPackages(data)
    })
    supabase.from('homepage_videos').select('*').eq('is_active', true).then(({ data }) => {
      if (data) {
        const shuffled = [...data].sort(() => Math.random() - 0.5)
        setHomeVideos(shuffled.slice(0, 4))
      }
    })
    supabase.from('admin_settings').select('key, value').in('key', ['credit_bumper','credit_story','credit_feed','credit_longform']).then(({ data }) => {
      const map: Record<string,number> = {}
      data?.forEach((s: any) => { map[s.key] = Number(s.value) || 0 })
      setVideoCredits(map)
    })
    supabase.from('cms_content').select('key, value').then(({ data }) => {
      const map: Record<string,string> = {}
      data?.forEach((s: any) => { map[s.key] = s.value })
      setCms(map)
    })
  }, [])

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: '#0a0a0a', color: '#fff', minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        a { text-decoration: none; color: inherit; }
        ::selection { background: rgba(29,184,29,0.3); }

        .nav-link { color: rgba(255,255,255,0.5); font-size: 13px; font-weight: 400; letter-spacing: 0.5px; transition: color 0.3s; }
        .nav-link:hover { color: #fff; }

        .step-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 36px 28px;
          transition: border-color 0.3s, transform 0.3s;
        }
        .step-card:hover { border-color: #1db81d; transform: translateY(-4px); }

        .work-card {
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          aspect-ratio: 9/16;
          cursor: pointer;
        }
        .work-card video { width: 100%; height: 100%; object-fit: cover; display: block; }
        .work-overlay {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.65);
          display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
          padding-bottom: 32px;
          opacity: 1; transition: opacity 0.4s;
        }
        .work-card:hover .work-overlay { opacity: 0; }

        .feat-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 32px 28px;
          transition: border-color 0.3s, transform 0.3s;
        }
        .feat-card:hover { border-color: rgba(29,184,29,0.4); transform: translateY(-4px); }

        .price-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 36px 28px;
          transition: border-color 0.3s, transform 0.3s;
          display: flex; flex-direction: column;
        }
        .price-card:hover { border-color: rgba(255,255,255,0.2); transform: translateY(-4px); }
        .price-card.featured { border-color: #1db81d; background: rgba(29,184,29,0.04); }
        .price-card.featured:hover { border-color: #1db81d; }

        .stat-box {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 32px;
          transition: border-color 0.3s;
        }
        .stat-box:hover { border-color: rgba(29,184,29,0.3); }

        .cta-btn {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 16px 36px; border-radius: 100px;
          font-size: 15px; font-weight: 500; font-family: 'Inter', sans-serif;
          cursor: pointer; transition: transform 0.3s, box-shadow 0.3s; border: none;
        }
        .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(29,184,29,0.3); }

        @media (max-width: 900px) {
          .nav-desk { display: none !important; }
          .hero-inner { padding: 0 24px !important; }
          .hero-h1 { font-size: clamp(32px, 9vw, 48px) !important; }
          .s-pad { padding-left: 24px !important; padding-right: 24px !important; }
          .grid-4 { grid-template-columns: 1fr 1fr !important; }
          .grid-3 { grid-template-columns: 1fr !important; }
          .grid-2 { grid-template-columns: 1fr !important; }
          .about-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
          .footer-inner { flex-direction: column !important; text-align: center !important; gap: 8px !important; }
          .hero-demo { right: 24px !important; bottom: 40px !important; }
        }
        @media (max-width: 600px) {
          .grid-4 { grid-template-columns: 1fr !important; }
          .stat-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ══════ NAV ══════ */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '20px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(10,10,10,0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <a href="/test">
          <img src="/dinamo_logo.png" alt="Dinamo" style={{ height: '32px' }} />
        </a>
        <div className="nav-desk" style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
          <a href="#nasil-calisir" className="nav-link">Nasıl Çalışır</a>
          <a href="#islerimiz" className="nav-link">İşlerimiz</a>
          <a href="#fiyatlandirma" className="nav-link">Fiyatlandırma</a>
          <a href="#hakkimizda" className="nav-link">Hakkımızda</a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/login" className="nav-link">Giriş</a>
          <a href="/demo-request" style={{
            background: '#1db81d', color: '#fff', padding: '10px 22px', borderRadius: '100px',
            fontSize: '13px', fontWeight: '500', transition: 'transform 0.2s',
          }}>Demo</a>
        </div>
      </nav>

      {/* ══════ HERO ══════ */}
      <section style={{ position: 'relative', height: '100vh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}>
          <source src="/montage.webm" type="video/webm" />
        </video>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
        <div className="hero-inner" style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 48px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            fontSize: '11px', letterSpacing: '2px', color: '#1db81d',
            marginBottom: '32px', padding: '8px 18px',
            border: '1px solid rgba(29,184,29,0.25)', borderRadius: '100px',
            background: 'rgba(29,184,29,0.08)', textTransform: 'uppercase',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1db81d' }}></span>
            AI Video Prodüksiyon
          </div>
          <h1 className="hero-h1" style={{
            fontSize: 'clamp(40px, 7vw, 80px)', fontWeight: '300',
            lineHeight: 1.05, letterSpacing: '-3px', marginBottom: '20px',
          }}>
            {c('hero_title', 'Brief yaz. 24 saatte video.').split('.').filter(Boolean).map((part, i) => (
              <span key={i}>{i > 0 && <br />}<span style={i > 0 ? { fontWeight: '500' } : {}}>{part.trim()}.</span></span>
            ))}
          </h1>
          <p style={{ fontSize: '17px', fontWeight: '300', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, maxWidth: '480px', margin: '0 auto' }}>
            {c('hero_desc', "Brief'inizi yükleyin, 24 saat içinde videonuz hazır. Hızlı, brief'e sadık, insan kalitesinde AI video üretimi.")}
          </p>
        </div>
        {/* Demo button — bottom right */}
        <a href="/demo-request" className="cta-btn hero-demo" style={{
          position: 'absolute', bottom: 48, right: 48, zIndex: 2,
          background: '#1db81d', color: '#fff',
        }}>
          Demo Hesap →
        </a>
        {/* Scroll indicator */}
        <div style={{ position: 'absolute', bottom: 48, left: '50%', transform: 'translateX(-50%)', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>SCROLL</span>
          <div style={{ width: '1px', height: '32px', background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)' }} />
        </div>
      </section>

      {/* ══════ NASIL ÇALIŞIR ══════ */}
      <section id="nasil-calisir" style={{ background: '#0f0f0f' }}>
        <div className="s-pad" style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 48px' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '3px', color: '#1db81d', textTransform: 'uppercase', marginBottom: '16px', fontWeight: '400' }}>Süreç</div>
            <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: '300', letterSpacing: '-1.5px', marginBottom: '16px' }}>Dört adım, 24 saat.</h2>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.4)', fontWeight: '300', maxWidth: '480px', lineHeight: 1.7, marginBottom: '60px' }}>Yayından 24 saat önce brief'inizi girin.</p>
          </div>
          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
            {[
              { n: '01', t: c('step1_title', "Brief'inizi girin"), b: c('step1_desc', 'Kampanya hedefinizi, mesajınızı ve video tipini belirleyin.') },
              { n: '02', t: c('step2_title', 'Prodüktörümüz inceliyor'), b: c('step2_desc', "Brief'inizi değerlendiriyor, gerekirse onay veya ek bilgi talep ediyoruz.") },
              { n: '03', t: c('step3_title', '24 saat içinde teslim'), b: c('step3_desc', 'Videonuz üretilir, prodüktör onayından geçer ve hesabınıza iletilir.') },
              { n: '04', t: c('step4_title', 'Revizyon hakkınız var'), b: c('step4_desc', 'Her videoya bir revizyon hakkı tanınır, ek ücret alınmaz.') },
            ].map((s) => (
              <div key={s.n} className="step-card">
                <div style={{ fontSize: '40px', fontWeight: '600', color: '#1db81d', letterSpacing: '-2px', marginBottom: '20px', lineHeight: 1 }}>{s.n}</div>
                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '10px', letterSpacing: '-0.3px' }}>{s.t}</div>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.7, fontWeight: '300' }}>{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ ÖZELLİKLER ══════ */}
      <section style={{ background: '#0a0a0a' }}>
        <style>{`
          @media (max-width: 768px) {
            .feat-grid-2x4 { grid-template-columns: 1fr !important; }
          }
          @media (min-width: 769px) and (max-width: 1024px) {
            .feat-grid-2x4 { grid-template-columns: repeat(2, 1fr) !important; }
          }
        `}</style>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 48px' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4.5vw, 44px)', fontWeight: '300', letterSpacing: '-1.5px', marginBottom: '16px', color: '#fff' }}>
              Sadece video değil, tam bir içerik sistemi
            </h2>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.4)', fontWeight: '300' }}>
              Brief'ten teslimata her adım Dinamo'da.
            </p>
          </div>
          <div className="feat-grid-2x4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {[
              { t: 'AI Destekli Brief', b: "Ne istediğini anlat, sistem brief'i oluştursun. Ya da kendin yaz, AI detaylandırsın." },
              { t: 'Telif Güvencesi', b: 'Her onaylı videoya otomatik İçerik Lisans Sertifikası. Arşivin her zaman hazır.' },
              { t: 'CPS', b: 'Creative Performance System ile aynı brief\u2019ten farklı yaratıcı yönler üretin. Hook, ton, tempo \u2014 her varyasyonu siz belirleyin. Kreatifi çeşitlendirin, test edin, kazananı bulun, performansı artırın.' },
              { t: 'Her Şey Tek Yerde', b: "Brief'ler, videolar, sertifikalar, tüm dosyalarınız \u2014 tek panelde, her zaman erişilebilir." },
              { t: 'İçerik Performans Raporu', b: 'Görüntülenme ve etkileşim verilerini gir, kampanya bazlı raporlar al.' },
              { t: 'Kendini Geliştiren AI', b: "Genel marka bilgileriyle başlar, her brief'ten öğrenir. Tonunu, dilini, tercihlerini hafızasına alır \u2014 zamanla daha etkili brief yazar." },
              { t: 'Her Formata, Her Dile Hazır', b: "Kadın veya erkek AI seslendirme, profesyonel dublaj, 7 dil seçeneği, 5 farklı format \u2014 tek brief'ten tüm mecralara." },
              { t: 'Pikseline Kadar Kontrol', b: 'Videonun istediğin saniyesine not bırak. Creator tam olarak ne, nerede değişecek bilir \u2014 revizyon süreci net ve hızlı.' },
            ].map((f) => (
              <div key={f.t} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid #222',
                borderRadius: '14px',
                padding: '32px 28px',
              }}>
                <div style={{ color: '#1db81d', fontSize: '14px', marginBottom: '14px', lineHeight: 1 }}>{'\u2192'}</div>
                <div style={{ fontSize: '16px', fontWeight: '500', color: '#fff', marginBottom: '10px', lineHeight: 1.3 }}>{f.t}</div>
                <p style={{ fontSize: '14px', color: '#888', lineHeight: 1.7, fontWeight: '300', margin: 0 }}>{f.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ İŞLERİMİZ ══════ */}
      {mounted && homeVideos.length > 0 && (
        <section id="islerimiz" style={{ background: '#0a0a0a' }}>
          <div className="s-pad" style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 48px' }}>
            <div>
              <div style={{ fontSize: '11px', letterSpacing: '3px', color: '#1db81d', textTransform: 'uppercase', marginBottom: '16px', fontWeight: '400' }}>Portföy</div>
              <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: '300', letterSpacing: '-1.5px', marginBottom: '60px' }}>İşlerimizden</h2>
            </div>
            <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: `repeat(${homeVideos.length}, 1fr)`, gap: '20px' }}>
              {homeVideos.map((w) => (
                <div
                  key={w.id}
                  className="work-card"
                  onMouseEnter={(e) => {
                    const vid = e.currentTarget.querySelector('video')
                    vid?.play()
                  }}
                  onMouseLeave={(e) => {
                    const vid = e.currentTarget.querySelector('video')
                    if (vid) { vid.pause(); vid.currentTime = 0 }
                  }}
                >
                  <video src={w.video_url} muted loop playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div className="work-overlay">
                    <div style={{ fontSize: '18px', fontWeight: '500', marginBottom: '6px' }}>{w.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════ AI EXPRESS ══════ */}
      <section style={{ background: '#0a0a0a' }}>
        <div className="s-pad" style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 48px' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', letterSpacing: '3px', color: '#1db81d', textTransform: 'uppercase', marginBottom: '16px', fontWeight: '400' }}>AI Express</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: '300', letterSpacing: '-1.5px', marginBottom: '12px' }}>AI Express — 5 Dakikada Video</h2>
            <div style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(29,184,29,0.1)', border: '1px solid rgba(29,184,29,0.2)', fontSize: '11px', color: '#1DB81D', marginBottom: '40px' }}>Beta · Dinamo müşterilerine özel</div>
          </div>
          <div style={{ maxWidth: '720px' }}>
              <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, marginBottom: '20px', fontWeight: '300' }}>
                Brief gönderdiniz. Ekip çalışırken, yapay zeka da çalışıyor.
              </p>
              <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, marginBottom: '20px', fontWeight: '300' }}>
                Dinamo AI Express, kampanya briefinizi okur. Marka tonunu, kurumsal renkleri, hedef kitleyi analiz eder ve 5 dakika içinde, 1 kredi ile fikir, görsel, Türkçe seslendirme ve müzik üretir. Her video için yorum bırakırsınız — sistem isteklerinizi anlayıp markanızı tanıdıkça daha iyi üretir.
              </p>
              <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, marginBottom: '20px', fontWeight: '300' }}>
                AI Express'le yayına çıkmadan önce fikrinizi test edin. Hangi mesajın işe yaradığını görün, brief'inizi geliştirin, kreatif yön belirleyin.
              </p>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.8, fontWeight: '300' }}>
                Beta sürecindedir. Sonuçlar garanti edilmez. İnsan yapımı üretimin yerini tutmaz — ama fikir aşamasını, içerik testini ve sosyal medya hızını değiştirir.
              </p>
          </div>
        </div>
      </section>

      {/* ══════ FİYATLANDIRMA ══════ */}
      <section id="fiyatlandirma" style={{ background: '#0a0a0a' }}>
        <div className="s-pad" style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 48px' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '3px', color: '#1db81d', textTransform: 'uppercase', marginBottom: '16px', fontWeight: '400' }}>Fiyatlandırma</div>
            <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: '300', letterSpacing: '-1.5px', marginBottom: '16px' }}>Şeffaf, öngörülebilir.</h2>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.4)', fontWeight: '300', marginBottom: '48px' }}>Kredi satın alın, harcayın. Sürpriz maliyet yok.</p>
          </div>

          {/* Video Types */}
          <div style={{ marginBottom: '60px' }}>
            <div style={{ fontSize: '12px', letterSpacing: '2px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: '24px' }}>Video Tipleri</div>
            <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
              {[
                { dur: '6–10 sn', name: 'Bumper / Pre-roll', key: 'credit_bumper', fallback: 12 },
                { dur: '15 sn', name: 'Story / Reels', key: 'credit_story', fallback: 18 },
                { dur: '30 sn', name: 'Feed Video', key: 'credit_feed', fallback: 24 },
                { dur: '45–60 sn', name: 'Long Form', key: 'credit_longform', fallback: 36 },
              ].map((v) => {
                const cr = videoCredits[v.key] || v.fallback
                return (
                  <div key={v.name} style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px', padding: '28px 24px', transition: 'border-color 0.3s',
                  }}>
                    <div style={{ fontSize: '11px', color: '#1db81d', letterSpacing: '1px', marginBottom: '12px', fontWeight: '500' }}>{v.dur}</div>
                    <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>{v.name}</div>
                    <div style={{ fontSize: '28px', fontWeight: '300', letterSpacing: '-1px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {cr} <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', fontWeight: '400' }}>kredi</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Packages — from Supabase credit_packages */}
          <div style={{ fontSize: '12px', letterSpacing: '2px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: '24px' }}>Paketler</div>
          {mounted && packages.length > 0 ? (
          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: `repeat(${packages.length}, 1fr)`, gap: '20px' }}>
            {packages.map((p) => (
              <div key={p.id} className={`price-card ${p.is_popular ? 'featured' : ''}`}>
                {p.is_popular && (
                  <div style={{
                    background: '#1db81d', color: '#fff', fontSize: '10px', fontWeight: '600',
                    padding: '5px 14px', borderRadius: '100px', alignSelf: 'flex-start',
                    marginBottom: '20px', letterSpacing: '0.5px',
                  }}>Popüler</div>
                )}
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '20px', fontWeight: '400' }}>{p.name}</div>
                <div style={{ fontSize: '40px', fontWeight: '300', letterSpacing: '-2px', marginBottom: '4px' }}>
                  {p.name === 'Kurumsal' ? '1.000+' : p.credits?.toLocaleString('tr-TR')} <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)', fontWeight: '400' }}>kredi</span>
                </div>
                <div style={{
                  fontSize: '15px', color: 'rgba(255,255,255,0.4)', marginBottom: '28px',
                  paddingBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: '300',
                }}>
                  {p.name === 'Demo' ? (
                    <span style={{ color: '#1db81d', fontWeight: '500' }}>Ücretsiz</span>
                  ) : p.name === 'Kurumsal' ? (
                    <a href="/demo-request" style={{ display: 'inline-block', padding: '8px 20px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '100px', color: '#fff', fontSize: '13px', fontWeight: '500', textDecoration: 'none', transition: 'background 0.2s' }}>İletişime Geçin</a>
                  ) : p.price_tl ? (
                    <><strong style={{ color: '#fff', fontWeight: '500' }}>{Number(p.price_tl).toLocaleString('tr-TR')} TL</strong><span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginLeft: '4px' }}>+KDV</span></>
                  ) : (
                    <em style={{ fontStyle: 'normal' }}>{p.price_note || 'İletişime geçin'}</em>
                  )}
                </div>
                {p.features && (
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                    {(Array.isArray(p.features) ? p.features : []).map((f: string) => (
                      <li key={f} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '300' }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#1db81d', flexShrink: 0 }}></span>
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          ) : (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>Yükleniyor...</div>
          )}
        </div>
      </section>

      {/* ══════ DCC FILM ══════ */}
      <section id="hakkimizda" style={{ background: '#0f0f0f' }}>
        <div className="s-pad about-grid" style={{
          maxWidth: '1200px', margin: '0 auto', padding: '120px 48px',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '3px', color: '#1db81d', textTransform: 'uppercase', marginBottom: '16px', fontWeight: '400' }}>DCC Film Güvencesi</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: '300', letterSpacing: '-1.5px', marginBottom: '24px', lineHeight: 1.2 }}>
              Arkasında gerçek bir prodüksiyon şirketi var.
            </h2>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.4)', fontWeight: '300', marginBottom: '20px', lineHeight: 1.8 }}>
              Dinamo'nun arkasında gerçek bir prodüksiyon şirketi var. DCC FILM olarak yıllardır Türkiye'nin en büyük markalarıyla çalışıyor, global kampanyalar üretiyoruz.
            </p>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.4)', fontWeight: '300', marginBottom: '24px', lineHeight: 1.8 }}>
              Şeffaf fiyatlandırma, 24 saat teslim garantisi ve yıllarca süren prodüksiyon deneyimiyle her projeniz emin ellerde. Tek yapmanız gereken yayından 24 saat önce brief'inizi girmek.
            </p>
            <p style={{ fontSize: '16px', color: '#1db81d', fontWeight: '500' }}>
              Türkiye'nin bu alanda ilk ve tek garantili AI video prodüksiyon platformu.
            </p>
          </div>
          <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {[
              { n: '24h', l: 'Teslim garantisi' },
              { n: '%100', l: 'Telif güvencesi' },
              { n: '20+', l: 'Yıl prodüksiyon deneyimi' },
              { n: '∞', l: 'Kredi geçerlilik süresi' },
            ].map((s) => (
              <div key={s.l} className="stat-box">
                <div style={{ fontSize: '40px', fontWeight: '300', letterSpacing: '-2px', marginBottom: '6px', lineHeight: 1 }}>{s.n}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', fontWeight: '300' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ LOGO BANDI ══════ */}
      <div style={{ background: '#0f0f0f', padding: '8px 0 48px 0' }}>
        <img src="/logos.png" style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', display: 'block', filter: 'brightness(0.65)', objectFit: 'contain' }} />
      </div>

      {/* ══════ CTA ══════ */}
      <section id="demo" style={{ background: '#0a0a0a' }}>
        <div className="s-pad" style={{ maxWidth: '700px', margin: '0 auto', padding: '140px 48px', textAlign: 'center' }}>
          <h2 style={{
            fontSize: 'clamp(36px, 6vw, 56px)', fontWeight: '300',
            letterSpacing: '-2px', lineHeight: 1.1, marginBottom: '20px',
          }}>
            {c('cta_title', 'Hemen başlayın.')}
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.4)', fontWeight: '300', marginBottom: '40px', lineHeight: 1.7 }}>
            Demo hesabınızı talep edin, ilk videonuzu birlikte üretelim.
          </p>
          <a href="/demo-request" className="cta-btn" style={{ background: '#1db81d', color: '#fff' }}>
            {c('cta_button', 'Demo hesap talep edin →')}
          </a>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer style={{ background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '36px 48px' }}>
        <div className="footer-inner" style={{
          maxWidth: '1200px', margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <img src="/powered_by_dcc.png" alt="Powered by DCC" style={{ height: '20px', width: 'auto', opacity: 0.5, cursor: 'pointer' }} onClick={() => window.open('https://dirtycheapcreative.com', '_blank')} />
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', display: 'flex', gap: '16px' }}>
            <a href="/creator-apply" style={{ color: 'rgba(255,255,255,0.35)' }}>Creator Başvurusu</a>
            <a href="mailto:dinamo@dccfilm.com" style={{ color: 'rgba(255,255,255,0.35)' }}>İletişim</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
