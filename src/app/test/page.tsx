'use client'

export default function HomePage() {
  return (
    <div style={{fontFamily:"'DM Sans', system-ui, sans-serif",background:'#fff',color:'#0a0a0a',minHeight:'100vh'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; }
        .nav-link { color: #888; font-size: 12px; font-weight: 500; letter-spacing: 0.5px; transition: color 0.2s; }
        .nav-link:hover { color: #0a0a0a; }
        .step:hover { background: #f7f6f2 !important; }
        .feature:hover { background: #f7f6f2 !important; }
        .vtype:hover { background: #f7f6f2 !important; }
        .pricing-card:hover { border-color: rgba(0,0,0,0.2) !important; }
        @media (max-width: 768px) {
          .nav-links { display: none !important; }
          .hero-grid { grid-template-columns: 1fr !important; padding: 100px 24px 60px !important; }
          .hero-title { font-size: 48px !important; letter-spacing: -2px !important; }
          .phone-wrap { display: none !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .video-types-grid { grid-template-columns: 1fr 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr 1fr !important; }
          .dcc-grid { grid-template-columns: 1fr !important; }
          .dcc-stats { grid-template-columns: 1fr 1fr !important; }
          .section-pad { padding: 60px 24px !important; }
          .cta-title { font-size: 40px !important; }
          .footer { flex-direction: column !important; gap: 12px !important; text-align: center !important; }
          .nav { padding: 16px 24px !important; }
          .nav-mobile-btns { gap: 8px !important; }
          .nav-mobile-btns a { padding: 8px 14px !important; font-size: 12px !important; }
        }
      `}</style>

      {/* NAV */}
      <nav className="nav" style={{position:'fixed',top:0,left:0,right:0,zIndex:100,padding:'18px 52px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(255,255,255,0.92)',backdropFilter:'blur(16px)',borderBottom:'1px solid rgba(0,0,0,0.08)'}}>
        <a href="/test" style={{fontSize:'20px',fontWeight:'500',letterSpacing:'-0.5px',color:'#0a0a0a',flexShrink:0}}>
          dinam<span style={{display:'inline-block',width:'20px',height:'20px',borderRadius:'50%',border:'4px solid #1db81d',position:'relative',top:'3px'}}></span>
        </a>
        <div className="nav-links" style={{display:'flex',alignItems:'center',gap:'32px'}}>
          <a href="#nasil-calisir" className="nav-link">NASIL ÇALIŞIR</a>
          <a href="#fiyatlandirma" className="nav-link">FİYATLANDIRMA</a>
          <a href="#hakkimizda" className="nav-link">HAKKIMIZDA</a>
        </div>
        <div className="nav-mobile-btns" style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <a href="/login" style={{background:'#0a0a0a',color:'#fff',padding:'9px 20px',borderRadius:'100px',fontSize:'14px',fontWeight:'500'}}>GİRİŞ YAP</a>
          <a href="#demo" style={{background:'#1db81d',color:'#fff',padding:'9px 20px',borderRadius:'100px',fontSize:'14px',fontWeight:'500'}}>DEMO HESAP</a>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero-grid" style={{minHeight:'100vh',display:'grid',gridTemplateColumns:'1fr 1fr',alignItems:'center',padding:'120px 52px 80px',gap:'60px',maxWidth:'1200px',margin:'0 auto'}}>
        <div>
          <div style={{display:'inline-flex',alignItems:'center',gap:'6px',fontSize:'11px',letterSpacing:'1.5px',color:'#1db81d',marginBottom:'28px',padding:'6px 14px',border:'1px solid rgba(29,184,29,0.25)',borderRadius:'100px',background:'#e8f7e8',fontFamily:'monospace'}}>
            <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'#1db81d',display:'inline-block'}}></span>
            AI VİDEO PRODÜKSIYONU
          </div>
          <h1 className="hero-title" style={{fontSize:'80px',fontWeight:'300',lineHeight:'1.0',letterSpacing:'-3px',marginBottom:'24px'}}>
            Tek yapmanız<br/>gereken<br/>brief yazmak.
          </h1>
          <p style={{fontSize:'17px',fontWeight:'300',color:'#888',marginBottom:'16px',lineHeight:'1.7',maxWidth:'420px'}}>
            Brief'inizi yükleyin, <strong style={{color:'#0a0a0a',fontWeight:'400'}}>24 saat içinde</strong> videonuz hazır.<br/>
            Hızlı, brief'e sadık, insan kalitesinde AI video üretimi.
          </p>
          <div style={{display:'flex',alignItems:'center',gap:'16px',marginTop:'36px',flexWrap:'wrap'}}>
            <a href="#demo" style={{background:'#0a0a0a',color:'#fff',padding:'13px 26px',borderRadius:'100px',fontSize:'14px',fontWeight:'500',display:'inline-flex',alignItems:'center',gap:'8px'}}>
              Demo hesap talep edin →
            </a>
            <a href="#nasil-calisir" style={{color:'#888',fontSize:'14px',display:'inline-flex',alignItems:'center',gap:'6px'}}>
              Nasıl çalışır ↓
            </a>
          </div>
          <div style={{marginTop:'44px',fontSize:'11px',color:'#bbb',letterSpacing:'1.5px',fontFamily:'monospace'}}>
            POWERED BY <a href="https://dccfilm.com" target="_blank" style={{color:'#bbb',borderBottom:'1px solid #bbb'}}>DCC FILM</a>
          </div>
        </div>
        <div className="phone-wrap" style={{display:'flex',justifyContent:'center',alignItems:'center'}}>
          <div style={{position:'relative',width:'260px',height:'540px',background:'#1a1a1a',borderRadius:'42px',border:'2px solid #2a2a2a',boxShadow:'0 40px 80px rgba(0,0,0,0.18)'}}>
            <div style={{position:'absolute',inset:0,borderRadius:'40px',overflow:'hidden',background:'#000'}}>
              <video autoPlay muted loop playsInline style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}>
                <source src="/montage.webm" type="video/webm"/>
              </video>
            </div>
            <div style={{position:'absolute',top:'12px',left:'50%',transform:'translateX(-50%)',width:'90px',height:'24px',background:'#1a1a1a',borderRadius:'18px',zIndex:10}}></div>
            <div style={{position:'absolute',bottom:'10px',left:'50%',transform:'translateX(-50%)',width:'80px',height:'4px',background:'rgba(255,255,255,0.35)',borderRadius:'4px',zIndex:10}}></div>
            <div style={{position:'absolute',bottom:'28px',left:0,right:0,textAlign:'center',zIndex:10,fontSize:'13px',fontWeight:'400',color:'rgba(255,255,255,0.7)'}}>
              dinam<span style={{display:'inline-block',width:'12px',height:'12px',borderRadius:'50%',border:'3px solid #2ecc2e',position:'relative',top:'2px'}}></span>
            </div>
          </div>
        </div>
      </div>

      {/* NASIL ÇALIŞIR */}
      <section id="nasil-calisir" className="section-pad" style={{padding:'100px 52px',maxWidth:'1200px',margin:'0 auto'}}>
        <div style={{fontSize:'11px',letterSpacing:'2px',color:'#1db81d',marginBottom:'16px',fontFamily:'monospace'}}>SÜREÇ</div>
        <h2 style={{fontSize:'44px',fontWeight:'300',letterSpacing:'-1.5px',marginBottom:'16px'}}>Dört adım, 24 saat.</h2>
        <p style={{fontSize:'16px',color:'#888',fontWeight:'300',maxWidth:'520px',lineHeight:'1.7',marginBottom:'52px'}}>Yayından 24 saat önce brief'inizi girin.</p>
        <div className="steps-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'1px',background:'rgba(0,0,0,0.08)',border:'1px solid rgba(0,0,0,0.08)',borderRadius:'16px',overflow:'hidden'}}>
          {[
            {n:'01',t:'Brief\'inizi girin',b:'Kampanya hedefinizi, mesajınızı ve video tipini belirleyin. Marka kimliğiniz sistemde hazır.'},
            {n:'02',t:'Prodüktörümüz inceliyor',b:'Brief\'inizi değerlendiriyor, gerekirse onay veya ek bilgi talep ediyoruz.'},
            {n:'03',t:'24 saat içinde teslim',b:'Videonuz üretilir, prodüktör onayından geçer ve hesabınıza iletilir.'},
            {n:'04',t:'Revizyon hakkınız var',b:'Her videoya bir revizyon hakkı tanınır, ek ücret alınmaz.'},
          ].map(s=>(
            <div key={s.n} className="step" style={{background:'#fff',padding:'36px 28px',transition:'background 0.2s'}}>
              <div style={{fontSize:'11px',color:'#1db81d',letterSpacing:'1px',marginBottom:'18px',fontFamily:'monospace'}}>{s.n}</div>
              <div style={{fontSize:'16px',fontWeight:'500',marginBottom:'10px',letterSpacing:'-0.3px'}}>{s.t}</div>
              <p style={{fontSize:'14px',color:'#888',lineHeight:'1.65',fontWeight:'300'}}>{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ÖZELLİKLER */}
      <div style={{background:'#f7f6f2',borderTop:'1px solid rgba(0,0,0,0.08)',borderBottom:'1px solid rgba(0,0,0,0.08)'}}>
        <div className="section-pad" style={{padding:'100px 52px',maxWidth:'1200px',margin:'0 auto'}}>
          <div style={{fontSize:'11px',letterSpacing:'2px',color:'#1db81d',marginBottom:'16px',fontFamily:'monospace'}}>ÖZELLİKLER</div>
          <h2 style={{fontSize:'44px',fontWeight:'300',letterSpacing:'-1.5px',marginBottom:'52px'}}>Neden Dinamo?</h2>
          <div className="features-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1px',background:'rgba(0,0,0,0.08)',border:'1px solid rgba(0,0,0,0.08)',borderRadius:'16px',overflow:'hidden'}}>
            {[
              {t:'24 Saat Teslim',b:'Brief\'ten videoya, garantili.',icon:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'},
              {t:'Brief\'e Sadık',b:'Her video prodüktör gözetiminde üretilir.',icon:'<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>'},
              {t:'Şeffaf Fiyatlandırma',b:'Kredi bazlı sistem, sürpriz maliyet yok.',icon:'<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>'},
              {t:'Telif Güvencesi',b:'Tüm haklar DCC FILM üzerinden temizlenir.',icon:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'},
              {t:'Marka Uyumu',b:'Logo, font ve görsel kimliğiniz sistemde hazır.',icon:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>'},
              {t:'AI Hızı, İnsan Kalitesi',b:'Her projeniz AI yönetmenler tarafından üretilir, prodüktörlerimiz tarafından kontrol edilir.',icon:'<circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0112 0v2"/>'},
            ].map(f=>(
              <div key={f.t} className="feature" style={{background:'#f7f6f2',padding:'32px 28px',transition:'background 0.2s'}}>
                <div style={{width:'30px',height:'30px',borderRadius:'8px',background:'#e8f7e8',border:'1px solid rgba(29,184,29,0.2)',marginBottom:'18px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1db81d" strokeWidth="1.5" dangerouslySetInnerHTML={{__html:f.icon}}/>
                </div>
                <div style={{fontSize:'15px',fontWeight:'500',marginBottom:'8px',letterSpacing:'-0.2px'}}>{f.t}</div>
                <p style={{fontSize:'13px',color:'#888',lineHeight:'1.65',fontWeight:'300'}}>{f.b}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FİYATLANDIRMA */}
      <div id="fiyatlandirma" style={{background:'#f7f6f2',borderBottom:'1px solid rgba(0,0,0,0.08)'}}>
        <div className="section-pad" style={{padding:'100px 52px',maxWidth:'1200px',margin:'0 auto'}}>
          <div style={{fontSize:'11px',letterSpacing:'2px',color:'#1db81d',marginBottom:'16px',fontFamily:'monospace'}}>FİYATLANDIRMA</div>
          <h2 style={{fontSize:'44px',fontWeight:'300',letterSpacing:'-1.5px',marginBottom:'16px'}}>Şeffaf, öngörülebilir.</h2>
          <p style={{fontSize:'16px',color:'#888',fontWeight:'300',marginBottom:'36px'}}>Kredi satın alın, harcayın. Sürpriz maliyet yok.</p>
          <div className="video-types-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'1px',background:'rgba(0,0,0,0.08)',border:'1px solid rgba(0,0,0,0.08)',borderRadius:'16px',overflow:'hidden',marginBottom:'32px'}}>
            {[
              {dur:'6–10 SN',name:'Bumper / Pre-roll',credit:'12 kredi',price:'42.000 TL'},
              {dur:'15 SN',name:'Story / Reels',credit:'18 kredi',price:'63.000 TL'},
              {dur:'30 SN',name:'Feed Video',credit:'24 kredi',price:'84.000 TL'},
              {dur:'45–60 SN',name:'Long Form',credit:'36 kredi',price:'126.000 TL'},
            ].map(v=>(
              <div key={v.name} className="vtype" style={{background:'#f7f6f2',padding:'28px 22px',transition:'background 0.2s'}}>
                <div style={{fontSize:'11px',color:'#1db81d',letterSpacing:'1px',marginBottom:'10px',fontFamily:'monospace'}}>{v.dur}</div>
                <div style={{fontSize:'15px',fontWeight:'500',marginBottom:'6px',letterSpacing:'-0.3px'}}>{v.name}</div>
                <div style={{fontSize:'13px',color:'#888',fontWeight:'300'}}>{v.credit}</div>
                <div style={{fontSize:'18px',fontWeight:'300',letterSpacing:'-0.5px',marginTop:'14px',paddingTop:'14px',borderTop:'1px solid rgba(0,0,0,0.08)'}}>{v.price}</div>
              </div>
            ))}
          </div>
          <div className="pricing-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px'}}>
            {[
              {name:'Demo',credit:'40',price:null,priceNote:'Ücretsiz deneme',features:['2 video üretimi','Tanıtım toplantısı','Marka kiti kurulumu'],featured:false},
              {name:'Başlangıç',credit:'100',price:'350.000 TL',priceNote:null,features:['~5–8 video üretimi','İlk revizyon dahil','Kredi süresiz geçerli'],featured:false},
              {name:'Standart',credit:'500',price:'1.750.000 TL',priceNote:null,features:['~27 video üretimi','Öncelikli üretim','İlk revizyon dahil'],featured:true},
              {name:'Kurumsal',credit:'1.000+',price:null,priceNote:'Bizimle iletişime geçin',features:['Özel fiyatlandırma','Dedicated prodüktör','Öncelikli destek'],featured:false},
            ].map(p=>(
              <div key={p.name} className="pricing-card" style={{background:p.featured?'#e8f7e8':'#fff',border:`1px solid ${p.featured?'rgba(29,184,29,0.35)':'rgba(0,0,0,0.12)'}`,borderRadius:'16px',padding:'28px 22px',position:'relative',transition:'border-color 0.2s'}}>
                {p.featured&&<div style={{position:'absolute',top:'-1px',left:'50%',transform:'translateX(-50%)',background:'#1db81d',color:'#fff',fontSize:'11px',fontWeight:'500',padding:'3px 12px',borderRadius:'0 0 8px 8px'}}>Popüler</div>}
                <div style={{fontSize:'12px',color:'#888',fontFamily:'monospace',letterSpacing:'1px',textTransform:'uppercase',marginBottom:'18px'}}>{p.name}</div>
                <div style={{fontSize:'32px',fontWeight:'300',letterSpacing:'-1px',marginBottom:'4px'}}>{p.credit} <span style={{fontSize:'13px',color:'#888',fontWeight:'300'}}>kredi</span></div>
                <div style={{fontSize:'14px',color:'#888',marginBottom:'24px',paddingBottom:'24px',borderBottom:'1px solid rgba(0,0,0,0.08)',fontWeight:'300'}}>
                  {p.price?<strong style={{color:'#0a0a0a',fontWeight:'500'}}>{p.price}</strong>:<em>{p.priceNote}</em>}
                </div>
                <ul style={{listStyle:'none',display:'flex',flexDirection:'column',gap:'9px'}}>
                  {p.features.map(f=>(
                    <li key={f} style={{fontSize:'13px',color:'#888',display:'flex',alignItems:'center',gap:'8px',fontWeight:'300'}}>
                      <span style={{width:'5px',height:'5px',borderRadius:'50%',background:'#1db81d',flexShrink:0}}></span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DCC */}
      <div id="hakkimizda" style={{borderBottom:'1px solid rgba(0,0,0,0.08)'}}>
        <div className="section-pad dcc-grid" style={{padding:'100px 52px',maxWidth:'1200px',margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'80px',alignItems:'center'}}>
          <div>
            <div style={{fontSize:'11px',letterSpacing:'2px',color:'#1db81d',marginBottom:'16px',fontFamily:'monospace'}}>DCC FILM GÜVENCESİ</div>
            <h2 style={{fontSize:'40px',fontWeight:'300',letterSpacing:'-1.5px',marginBottom:'20px'}}>Arkasında gerçek bir prodüksiyon şirketi var.</h2>
            <p style={{fontSize:'16px',color:'#888',fontWeight:'300',marginBottom:'20px',lineHeight:'1.7'}}>Dinamo'nun arkasında gerçek bir prodüksiyon şirketi var. DCC FILM olarak yıllardır Türkiye'nin en büyük markalarıyla çalışıyor, global kampanyalar üretiyoruz.</p>
            <p style={{fontSize:'16px',color:'#888',fontWeight:'300',marginBottom:'20px',lineHeight:'1.7'}}>Şeffaf fiyatlandırma, 24 saat teslim garantisi ve yıllarca süren prodüksiyon deneyimiyle her projeniz emin ellerde. Tek yapmanız gereken yayından 24 saat önce brief'inizi girmek.</p>
            <p style={{fontSize:'16px',color:'#1db81d',fontWeight:'500'}}>Türkiye'nin bu alanda ilk ve tek garantili AI video prodüksiyon platformu.</p>
          </div>
          <div className="dcc-stats" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1px',background:'rgba(0,0,0,0.08)',border:'1px solid rgba(0,0,0,0.08)',borderRadius:'16px',overflow:'hidden'}}>
            {[
              {n:'24h',l:'Teslim garantisi'},
              {n:'%100',l:'Telif güvencesi'},
              {n:'20+',l:'Yıl prodüksiyon deneyimi'},
              {n:'∞',l:'Kredi geçerlilik süresi'},
            ].map(s=>(
              <div key={s.l} style={{background:'#fff',padding:'28px'}}>
                <div style={{fontSize:'36px',fontWeight:'300',letterSpacing:'-2px',marginBottom:'4px'}}>{s.n}</div>
                <div style={{fontSize:'13px',color:'#888',fontWeight:'300'}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div id="demo" style={{background:'#f7f6f2',borderBottom:'1px solid rgba(0,0,0,0.08)'}}>
        <div className="section-pad" style={{padding:'120px 52px',textAlign:'center',maxWidth:'640px',margin:'0 auto'}}>
          <h2 className="cta-title" style={{fontSize:'58px',fontWeight:'300',letterSpacing:'-2px',lineHeight:'1.05',marginBottom:'20px'}}>Hemen başlayın.</h2>
          <p style={{fontSize:'16px',color:'#888',fontWeight:'300',marginBottom:'36px',lineHeight:'1.7'}}>Demo hesabınızı talep edin, ilk videonuzu birlikte üretelim.</p>
          <a href="mailto:dinamo@dccfilm.com" style={{padding:'14px 30px',background:'#0a0a0a',color:'#fff',borderRadius:'100px',fontSize:'15px',fontWeight:'500',display:'inline-flex',alignItems:'center',gap:'8px'}}>
            Demo hesap talep edin →
          </a>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="footer" style={{borderTop:'1px solid rgba(0,0,0,0.08)',padding:'36px 52px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#f7f6f2'}}>
        <div style={{fontSize:'13px',color:'#888',fontWeight:'300'}}>Dinamo — Powered by <a href="https://dccfilm.com" target="_blank" style={{color:'#888',borderBottom:'1px solid #ddd'}}>DCC FILM</a></div>
        <div style={{fontSize:'12px',color:'#888',fontFamily:'monospace'}}>AI yönetmen ağımıza katılmak için <a href="mailto:dinamo@dccfilm.com" style={{color:'#555'}}>iletişime geçin</a></div>
      </footer>
    </div>
  )
}