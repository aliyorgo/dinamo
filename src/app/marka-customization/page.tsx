export default function MarkaCustomizationPage() {
  const sections = [
    {
      title: 'Basic Marka Customization',
      sub: 'Tüm paketlere ücretsiz dahil',
      desc: 'Markanızı sisteme tanıtmak için temel kurulum. Demo\'dan Kurumsal\'a kadar her pakette ücretsiz dahildir.',
      groups: [
        { label: 'Marka tanıma', items: ['Web research ile marka URL\'inizden otomatik analiz', 'Marka tonu ve hedef kitle temel girişi', 'Marka renk paleti'] },
        { label: 'Görsel varlıklar', items: ['Logo yüklemesi ve boyutlandırma'] },
        { label: 'Ses ve müzik', items: ['Geniş ses kütüphanesinden marka için seslendirme tercihi', 'Ücretsiz müzik kütüphanesine erişim'] },
        { label: 'AI öğrenmesi', items: ['Sistemin marka yorumlarınızdan ve revizyonlarınızdan otomatik öğrenmesi', 'Her üretimde markanızı biraz daha iyi tanır'] },
        { label: 'AI Persona', items: ['Sistem persona havuzundan Persona video üretimi (sınırlı seçim)'] },
      ],
    },
    {
      title: 'Advanced Marka Customization',
      sub: 'Standart ve Kurumsal pakete dahil. Başlangıç paketinde ek alınabilir.',
      price: '150.000 TL değerinde',
      desc: 'Markanızı Dinamo\'ya derinlemesine tanıtmak için kapsamlı kurulum. AI\'ın marka kimliğinizle hizalandığı, ekibimizin sürece dahil olduğu paket.',
      groups: [
        { label: 'Derin marka eğitimi', items: ['Marka rehberinizin uzun metin olarak sisteme işlenmesi', 'Marka kuralları ve yasaklarının kategorize edilmesi', 'Marka tonunun cümle örnekleriyle kalibrasyonu', 'Ekibimizin manuel eğitim katkısı: İlk üretimlerinizi gözlemleyip yorumlarla AI\'ı yönlendiririz'] },
        { label: 'Custom marka grafikleri', items: ['Renk, tipografi ve özel boyutlandırmalar', 'Markaya özel CTA tasarımları'] },
        { label: 'Markaya özel ses', items: ['Markaya özel AI seslendirme sanatçısı*', 'Marka sesinin AI\'a öğretilmesi*'] },
        { label: 'Markaya özel persona havuzu', items: ['Markanızın hedef kitlesine özel persona üretimi', 'Sistem persona havuzunun tamamına erişim'] },
        { label: 'Hizmet', items: ['Onboarding görüşmesi', 'Marka rehberi PDF', 'İlk üretimlerde sistem tanıtım desteği', 'Öncelikli destek'] },
      ],
      note: '* Telif anlaşmaları gerekli durumlarda Dinamo tarafından koordine edilir.',
    },
    {
      title: 'Kurumsal Eklentileri',
      sub: 'Sadece Kurumsal pakete özel — Advanced\'e ek olarak',
      groups: [
        { label: '', items: ['Yıllık brand refresh — Advanced kurulumun yıllık tekrarı', 'Üç aylık marka raporu — Sistemdeki marka tutarlılığınız, gelişen kurallar, üretim performansı', 'Özel hesap yöneticisi — Markanız için ayrılmış sürekli iletişim noktası', 'Yeni özelliklere öncelikli erişim — Beta sürümler ve geliştirme aşamasındaki yeniliklere ilk siz ulaşırsınız'] },
      ],
    },
  ]

  return (
    <div style={{ background: '#0a0a0a', color: '#fff', minHeight: '100vh', fontFamily: 'var(--font-sans), Inter, system-ui, sans-serif' }}>
      {/* Nav */}
      <div style={{ padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <a href="/test2" style={{ textDecoration: 'none' }}><img src="/dinamo_logo.png" alt="Dinamo" style={{ height: '24px' }} /></a>
        <a href="/test2#fiyatlandirma" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>← Paketlere Dön</a>
      </div>

      {/* Header */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '80px 48px 40px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '3px', color: '#1db81d', textTransform: 'uppercase', marginBottom: '16px' }}>MARKA CUSTOMIZATION</div>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: '300', letterSpacing: '-2px', lineHeight: 1.1, marginBottom: '16px' }}>Markanızı Dinamo'ya tanıtın.</h1>
        <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, fontWeight: '300', maxWidth: '600px' }}>
          Her paket farklı düzeyde marka entegrasyonu sunar. Temel kurulumdan kurumsal derinliğe — markanız ne kadar iyi tanınırsa üretim o kadar iyi olur.
        </p>
      </div>

      {/* Sections */}
      {sections.map((section, si) => (
        <div key={si} style={{ maxWidth: '900px', margin: '0 auto', padding: '0 48px 80px' }}>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '400', letterSpacing: '-0.5px', margin: 0 }}>{section.title}</h2>
              {section.price && <span style={{ fontSize: '10px', padding: '3px 8px', background: 'rgba(29,184,29,0.1)', border: '1px solid rgba(29,184,29,0.2)', color: '#1db81d' }}>{section.price}</span>}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginBottom: '20px' }}>{section.sub}</div>
            {section.desc && <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, fontWeight: '300', marginBottom: '32px' }}>{section.desc}</p>}

            {section.groups.map((group, gi) => (
              <div key={gi} style={{ marginBottom: '24px' }}>
                {group.label && <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '12px', fontWeight: '500' }}>{group.label}</div>}
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {group.items.map((item, ii) => (
                    <li key={ii} style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'flex-start', gap: '10px', fontWeight: '300', lineHeight: 1.6 }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#1db81d', flexShrink: 0, marginTop: '8px' }}></span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {section.note && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', marginTop: '16px' }}>{section.note}</p>}
          </div>
        </div>
      ))}

      {/* CTA */}
      <div style={{ textAlign: 'center', padding: '40px 48px 100px' }}>
        <a href="/demo-request" style={{ display: 'inline-block', padding: '14px 32px', background: '#1db81d', color: '#fff', fontSize: '14px', fontWeight: '500', textDecoration: 'none', borderRadius: '100px' }}>Demo hesap talep edin →</a>
      </div>

      {/* Footer */}
      <div style={{ padding: '20px 48px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>dinamo.media — DCC Film Yapım</span>
      </div>
    </div>
  )
}
