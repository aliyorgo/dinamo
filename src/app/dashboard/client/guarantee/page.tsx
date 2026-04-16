'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function GuaranteePage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [credits, setCredits] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: ud } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!ud || ud.role !== 'client') { router.push('/login'); return }
      setUserName(ud.name)
      const { data: cu } = await supabase.from('client_users').select('allocated_credits, clients(company_name)').eq('user_id', user.id).single()
      if (cu) { setCredits(cu.allocated_credits); setCompanyName((cu as any).clients?.company_name || '') }
    }
    load()
  }, [router])

  async function handleLogout() { await supabase.auth.signOut(); router.push('/login') }

  const sections = [
    { title: '1. Telif Hakkı Güvencesi', body: 'Dinamo platformu üzerinden teslim edilen tüm video içerikler, telif hakkı açısından güvence altındadır. İçeriklerde kullanılan görseller, müzikler, ses efektleri ve yapay zeka ile üretilen materyaller ticari kullanım lisansı kapsamındadır. DCC Film, teslim ettiği içeriklerin telif haklarından tam sorumludur.' },
    { title: '2. Creator Taahhüt Sistemi', body: 'Dinamo Creator Network\'e dahil olan tüm içerik üreticileri, platforma katılmadan önce kapsamlı bir taahhütname imzalar. Bu taahhütname ile creator\'lar; telif hakkı koruması altındaki materyalleri izinsiz kullanmayacaklarını, yalnızca ticari lisanslı kaynakları tercih edeceklerini, müşteri bilgilerini gizli tutacaklarını ve platform kurallarına uyacaklarını beyan eder.' },
    { title: '3. Üçüncü Taraf Taleplerine Karşı Koruma', body: 'Teslim edilen içeriklerle ilgili herhangi bir üçüncü taraf telif hakkı talebi oluşması durumunda, DCC Film müşteriyi hukuki süreçte savunmayı ve oluşabilecek maliyetleri karşılamayı taahhüt eder. Bu güvence, platformumuz üzerinden teslim edilen ve müşteri tarafından onaylanan tüm içerikleri kapsar.' },
    { title: '4. Kullanım Hakkı', body: 'Müşteri, teslim edilen içeriği tüm dijital platformlarda — sosyal medya, web sitesi, dijital reklam, e-posta pazarlama — süresiz olarak kullanabilir. İçerikler müşteri markası adına üretilmiştir ve kullanım hakkı müşteriye aittir. Broadcast kullanımı (TV, sinema) için ayrıca mutabakat gereklidir.' },
    { title: '5. Kapsam', body: 'Bu güvence, Dinamo platformu üzerinden brief oluşturulmuş, üretim süreci platform dahilinde yürütülmüş ve müşteri onayı ile teslim edilmiş tüm içerikleri kapsar. Platform dışında gerçekleştirilen veya müşteri tarafından sağlanan materyallerden kaynaklanan talepler kapsam dışındadır.' },
    { title: '6. İletişim', body: 'İçerik güvencesi veya telif hakları ile ilgili sorularınız için legal@dinamo.media adresinden bizimle iletişime geçebilirsiniz.' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "var(--font-dm-sans),'DM Sans',system-ui,sans-serif", background: '#f5f4f0' }}>

      {/* SIDEBAR */}
      <div style={{ width: '240px', background: '#0A0A0A', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{height:'28px'}} />
        </div>
        <div style={{margin:'12px 12px',padding:'16px 20px',background:'rgba(29,184,29,0.06)',borderLeft:'3px solid #1DB81D'}}>
          <div style={{fontSize:'18px',fontWeight:'700',color:'#fff',marginBottom:'2px'}}>{companyName || 'Dinamo'}</div>
          <div style={{fontSize:'13px',fontWeight:'400',color:'#888',marginBottom:'12px'}}>{userName}</div>
          <div style={{fontSize:'10px',color:'#AAA',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'8px'}}>KREDİ BAKİYESİ</div>
          <div style={{fontSize:'28px',fontWeight:'700',color:'#1DB81D',letterSpacing:'-1px'}}>{credits}</div>
        </div>
        <nav style={{ padding: '10px 8px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          {[
            { label: 'Projelerim', href: '/dashboard/client', active: false },
            { label: 'Yeni Brief', href: '/dashboard/client/brief/new', active: false },
            { label: 'Marka Paketi', href: '/dashboard/client/brand', active: false },
            { label: 'Raporlar', href: '/dashboard/client/reports', active: false },
            { label: 'Telif Belgeleri', href: '/dashboard/client/certificates', active: false },
            { label: 'İçerik Güvencesi', href: '/dashboard/client/guarantee', active: true },
          ].map(item => (
            <div key={item.href} onClick={() => router.push(item.href)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: item.active ? 'rgba(255,255,255,0.08)' : 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '12px', color: item.active ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: item.active ? '500' : '400' }}>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{ flex: 1 }}></div>
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 8px', borderRadius: '7px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-dm-sans),sans-serif' }}>Çıkış yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>İçerik Güvencesi</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <div style={{ maxWidth: '680px' }}>
            {/* HEADER */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '28px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-0.5px', marginBottom: '6px' }}>Dinamo İçerik Güvencesi</div>
              <div style={{ fontSize: '13px', color: '#888' }}>DCC Film Yapım San. ve Tic. Ltd. Şti.</div>
            </div>

            {/* INFO BOX */}
            <div style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '12px', padding: '16px 20px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              <div style={{ fontSize: '14px', color: '#0a0a0a', fontWeight: '400' }}>Teslim ettiğimiz tüm içerikler bu güvence kapsamındadır.</div>
            </div>

            {/* SECTIONS */}
            {sections.map((s, i) => (
              <div key={i} style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: i < sections.length - 1 ? '0.5px solid rgba(0,0,0,0.06)' : 'none' }}>
                <div style={{ fontSize: '15px', fontWeight: '500', color: '#0a0a0a', marginBottom: '8px' }}>{s.title}</div>
                <div style={{ fontSize: '14px', color: '#555', lineHeight: 1.8, fontWeight: '300' }}>{s.body}</div>
              </div>
            ))}

            {/* FOOTER */}
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', color: '#aaa' }}>
              DCC Film Yapım San. ve Tic. Ltd. Şti. — dinamo.media
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
