'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const NAV = [
  { label: 'Genel Bakış', href: '/dashboard/admin' },
  { label: 'Kullanıcılar', href: '/dashboard/admin/users' },
  { label: 'Müşteriler', href: '/dashboard/admin/clients' },
  { label: 'Briefler', href: '/dashboard/admin/briefs' },
  { label: "Creator'lar", href: '/dashboard/admin/creators' },
  { label: 'Kredi Yönetimi', href: '/dashboard/admin/credits' },
  { label: 'Raporlar', href: '/dashboard/admin/reports' },
  { label: 'Faturalar', href: '/dashboard/admin/invoices' },
  { label: 'Ajanslar', href: '/dashboard/admin/agencies' },
  { label: 'Ana Sayfa', href: '/dashboard/admin/homepage' },
  { label: 'Ayarlar', href: '/dashboard/admin/settings' },
]

function formatTL(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₺'
}

export default function ReportsPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  // Data
  const [clients, setClients] = useState<any[]>([])
  const [clientUsers, setClientUsers] = useState<any[]>([])
  const [creditSales, setCreditSales] = useState<any[]>([])
  const [creditPackages, setCreditPackages] = useState<any[]>([])
  const [creatorEarnings, setCreatorEarnings] = useState<any[]>([])
  const [creatorPayments, setCreatorPayments] = useState<any[]>([])
  const [briefs, setBriefs] = useState<any[]>([])
  const [creditTransactions, setCreditTransactions] = useState<any[]>([])
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [creators, setCreators] = useState<any[]>([])

  // Sale form
  const [saleForm, setSaleForm] = useState({ client_id: '', credits: 0, total_amount: 0, platform_fee: 0, note: '' })
  const [saleLoading, setSaleLoading] = useState(false)


  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: ud } = await supabase.from('users').select('name, role').eq('id', user.id).single()
    if (!ud || ud.role !== 'admin') { router.push('/login'); return }
    setUserName(ud.name)

    const [
      { data: cl }, { data: cu }, { data: cs }, { data: cp },
      { data: ce }, { data: cpy }, { data: br }, { data: ct },
      { data: st }, { data: cr }
    ] = await Promise.all([
      supabase.from('clients').select('*').order('company_name'),
      supabase.from('client_users').select('*, users(name)').order('created_at'),
      supabase.from('credit_sales').select('*, clients(company_name)').order('created_at', { ascending: false }),
      supabase.from('credit_packages').select('*').order('credits'),
      supabase.from('creator_earnings').select('*, creators(*, users(name)), briefs(campaign_name)').order('created_at', { ascending: false }),
      supabase.from('creator_payments').select('*, creators(*, users(name))').order('paid_at', { ascending: false }),
      supabase.from('briefs').select('*, clients(company_name)').order('created_at', { ascending: false }),
      supabase.from('credit_transactions').select('*, clients(company_name)').order('created_at', { ascending: false }).limit(20),
      supabase.from('admin_settings').select('*'),
      supabase.from('creators').select('*, users(name)').eq('is_active', true),
    ])

    setClients(cl || [])
    setClientUsers(cu || [])
    setCreditSales(cs || [])
    setCreditPackages(cp || [])
    setCreatorEarnings(ce || [])
    setCreatorPayments(cpy || [])
    setBriefs(br || [])
    setCreditTransactions(ct || [])
    setCreators(cr || [])

    const map: Record<string, string> = {}
    st?.forEach((x: any) => map[x.key] = x.value)
    setSettings(map)

    setLoading(false)
  }

  // Computed stats
  const totalSalesTL = creditSales.reduce((s, x) => s + Number(x.total_amount || 0), 0)
  const totalPlatformFee = creditSales.reduce((s, x) => s + Number(x.platform_fee || 0), 0)
  const totalCreatorPaid = creatorPayments.reduce((s, x) => s + Number(x.amount_tl || 0), 0)
  const totalCreatorPending = creatorEarnings.filter(e => !e.paid).reduce((s, e) => s + Number(e.tl_amount || 0), 0)

  // Projection
  const totalClientCredits = clients.reduce((s, c) => s + (c.credit_balance || 0), 0)
  const totalUserCredits = clientUsers.reduce((s, cu) => s + (cu.credit_balance || 0), 0)
  const allRemainingCredits = totalClientCredits + totalUserCredits
  const creditPriceTL = Number(settings['credit_price_tl'] || '3500')
  const creatorCreditRate = Number(settings['creator_credit_rate'] || '1500')
  const projectedGross = allRemainingCredits * creditPriceTL
  const projectedCreatorCost = allRemainingCredits * creatorCreditRate
  const projectedPlatformFee = projectedGross * 0.2
  const projectedNet = projectedGross - projectedCreatorCost

  // Sale form handlers
  function onPackageSelect(pkgId: string) {
    const pkg = creditPackages.find(p => p.id === pkgId)
    if (pkg) {
      const total = Number(pkg.price_tl)
      const fee = Math.round(total * 0.2)
      setSaleForm({ ...saleForm, credits: pkg.credits, total_amount: total, platform_fee: fee })
    }
  }

  function onSaleFieldChange(field: 'credits' | 'total_amount', val: number) {
    const updated = { ...saleForm, [field]: val }
    updated.platform_fee = Math.round(updated.total_amount * 0.2)
    setSaleForm(updated)
  }

  async function handleSale(e: React.FormEvent) {
    e.preventDefault()
    if (!saleForm.client_id || saleForm.credits <= 0 || saleForm.total_amount <= 0) { setMsg('Tüm alanları doldurun.'); return }
    setSaleLoading(true)
    setMsg('')

    const pricePerCredit = Math.round(saleForm.total_amount / saleForm.credits)

    const client = clients.find(c => c.id === saleForm.client_id)
    const { error: saleErr } = await supabase.from('credit_sales').insert({
      client_id: saleForm.client_id,
      agency_id: client?.agency_id || null,
      credits: saleForm.credits,
      price_per_credit: pricePerCredit,
      total_amount: saleForm.total_amount,
      platform_fee_rate: 0.40,
      platform_fee: saleForm.total_amount * 0.40,
      net_amount: saleForm.total_amount * 0.60,
      note: saleForm.note || null,
    })
    if (saleErr) { setMsg('Hata: ' + saleErr.message); setSaleLoading(false); return }

    if (client) {
      await supabase.from('clients').update({ credit_balance: client.credit_balance + saleForm.credits }).eq('id', saleForm.client_id)
      await supabase.from('credit_transactions').insert({
        client_id: saleForm.client_id,
        amount: saleForm.credits,
        type: 'purchase',
        description: saleForm.note || `${saleForm.credits} kredi satışı — ${formatTL(saleForm.total_amount)}`
      })
    }

    setMsg(`${client?.company_name} müşterisine ${saleForm.credits} kredi satışı kaydedildi.`)
    setSaleForm({ client_id: '', credits: 0, total_amount: 0, platform_fee: 0, note: '' })
    setSaleLoading(false)
    load()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Client report data
  const clientReport = clients.map(c => {
    const sales = creditSales.filter(s => s.client_id === c.id)
    const totalPurchased = sales.reduce((s, x) => s + (x.credits || 0), 0)
    const totalPaidTL = sales.reduce((s, x) => s + Number(x.total_amount || 0), 0)
    const platformFee = sales.reduce((s, x) => s + Number(x.platform_fee || 0), 0)
    const usedCredits = briefs.filter(b => b.client_id === c.id && b.status !== 'cancelled').reduce((s, b) => s + (b.credit_cost || 0), 0)
    return { ...c, totalPurchased, usedCredits, totalPaidTL, platformFee }
  })

  // Creator report data
  const creatorReport = creators.map(cr => {
    const earns = creatorEarnings.filter(e => e.creator_id === cr.id)
    const payments = creatorPayments.filter(p => p.creator_id === cr.id)
    const totalCredits = earns.reduce((s, e) => s + (e.credits || 0), 0)
    const totalEarned = earns.reduce((s, e) => s + Number(e.tl_amount || 0), 0)
    const totalPaid = payments.reduce((s, p) => s + Number(p.amount_tl || 0), 0)
    const pending = earns.filter(e => !e.paid).reduce((s, e) => s + Number(e.tl_amount || 0), 0)
    return { ...cr, totalCredits, totalEarned, totalPaid, pending }
  })

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '8px', fontSize: '13px', color: '#0a0a0a', fontFamily: 'var(--font-dm-sans),sans-serif', boxSizing: 'border-box', background: '#fff' }
  const sectionTitle: React.CSSProperties = { fontSize: '13px', fontWeight: '500', color: '#0a0a0a', padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }
  const thStyle: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '400', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: '13px', color: '#0a0a0a', borderTop: '0.5px solid rgba(0,0,0,0.06)' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "var(--font-dm-sans),'DM Sans',system-ui,sans-serif" }}>

      {/* SIDEBAR */}
      <div className="dinamo-sidebar" style={{ width: '240px', background: '#0A0A0A', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#fff', letterSpacing: '-0.5px', marginBottom: '12px' }}>
            <img src="/dinamo_logo.png" alt="Dinamo" style={{ height: '28px' }} />
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '3px' }}>Admin</div>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff' }}>{userName}</div>
        </div>

        <nav style={{ padding: '10px 8px', flex: 1 }}>
          {NAV.map(item => (
            <div key={item.href} onClick={() => router.push(item.href)}
              style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: item.href === '/dashboard/admin/reports' ? 'rgba(255,255,255,0.08)' : 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '12px', color: item.href === '/dashboard/admin/reports' ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: item.href === '/dashboard/admin/reports' ? '500' : '400' }}>{item.label}</span>
            </div>
          ))}
        </nav>

        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} className="dinamo-signout">Çıkış Yap</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Raporlar & Kredi Satışı</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {loading ? <div style={{ color: '#888', fontSize: '14px' }}>Yükleniyor...</div> : (
            <>
              {msg && (
                <div style={{ padding: '10px 16px', background: msg.includes('Hata') ? '#fef2f2' : '#e8f7e8', borderRadius: '10px', fontSize: '13px', color: msg.includes('Hata') ? '#dc2626' : '#16a34a', marginBottom: '20px' }}>
                  {msg}
                </div>
              )}

              {/* 1. ÖZET KARTLAR */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: 'Toplam Kredi Satışı', value: formatTL(totalSalesTL), color: '#0a0a0a' },
                  { label: 'Platform Geliri (Fee)', value: formatTL(totalPlatformFee), color: '#22c55e' },
                  { label: 'Creator Ödemeleri', value: formatTL(totalCreatorPaid), color: '#3b82f6' },
                  { label: 'Bekleyen Ödemeler', value: formatTL(totalCreatorPending), color: totalCreatorPending > 0 ? '#f59e0b' : '#888' },
                ].map(card => (
                  <div key={card.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{card.label}</div>
                    <div style={{ fontSize: '24px', fontWeight: '300', color: card.color, letterSpacing: '-1px' }}>{card.value}</div>
                  </div>
                ))}
              </div>

              {/* 2. PROJEKSİYON */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', marginBottom: '20px', overflow: 'hidden' }}>
                <div style={sectionTitle}>Gelir Projeksiyonu</div>
                <div style={{ padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '20px', lineHeight: 1.6 }}>
                    Senaryo: Tüm müşteriler mevcut kredilerini güncel fiyattan harcarsa platforma kalacak tahmini gelir.
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                    <tbody>
                      {[
                        { label: 'Kalan Toplam Kredi', value: allRemainingCredits.toLocaleString('tr-TR') + ' kredi', detail: `Havuzda: ${totalClientCredits.toLocaleString('tr-TR')} · Kullanıcılarda: ${totalUserCredits.toLocaleString('tr-TR')}`, highlight: false },
                        { label: 'Ortalama Kredi Satış Fiyatı', value: formatTL(creditPriceTL), detail: 'admin_settings → credit_price_tl', highlight: false },
                        { label: 'Potansiyel Brüt Gelir', value: formatTL(projectedGross), detail: `${allRemainingCredits.toLocaleString('tr-TR')} kredi × ${formatTL(creditPriceTL)}`, highlight: false },
                        { label: 'Creator Komisyonları (−)', value: '− ' + formatTL(projectedCreatorCost), detail: `${allRemainingCredits.toLocaleString('tr-TR')} kredi × ${formatTL(creatorCreditRate)} (creator_credit_rate)`, highlight: false },
                        { label: 'Platform Fee (%20)', value: formatTL(projectedPlatformFee), detail: 'Brüt gelirin %20\'si', highlight: false },
                        { label: 'Net Platform Geliri', value: formatTL(projectedNet), detail: 'Brüt gelir − Creator komisyonları', highlight: true },
                      ].map((row, i) => (
                        <tr key={row.label} style={{ borderBottom: i < 5 ? '0.5px solid rgba(0,0,0,0.06)' : 'none' }}>
                          <td style={{ padding: '14px 16px', fontSize: '13px', color: row.highlight ? '#0a0a0a' : '#555', fontWeight: row.highlight ? '500' : '300' }}>
                            {row.label}
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '2px', fontWeight: '300' }}>{row.detail}</div>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: row.highlight ? '20px' : '16px', fontWeight: row.highlight ? '500' : '300', color: row.highlight ? '#22c55e' : '#0a0a0a', textAlign: 'right', letterSpacing: '-0.5px' }}>
                            {row.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. KREDİ SATIŞ FORMU */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={sectionTitle}>Kredi Satış Kaydı</div>
                  <form onSubmit={handleSale} style={{ padding: '20px' }}>
                    <div style={{ marginBottom: '14px' }}>
                      <label style={labelStyle}>Müşteri</label>
                      <select value={saleForm.client_id} onChange={e => setSaleForm({ ...saleForm, client_id: e.target.value })} required style={inputStyle}>
                        <option value="">Seçin</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                      <label style={labelStyle}>Paket (opsiyonel — formu doldurur)</label>
                      <select defaultValue="" onChange={e => onPackageSelect(e.target.value)} style={inputStyle}>
                        <option value="">Manuel giriş</option>
                        {creditPackages.map(p => <option key={p.id} value={p.id}>{p.name} — {p.credits} kredi — {formatTL(Number(p.price_tl))}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                      <div>
                        <label style={labelStyle}>Kredi</label>
                        <input type="number" min="1" value={saleForm.credits || ''} onChange={e => onSaleFieldChange('credits', parseInt(e.target.value) || 0)} required style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Toplam TL</label>
                        <input type="number" min="1" value={saleForm.total_amount || ''} onChange={e => onSaleFieldChange('total_amount', parseInt(e.target.value) || 0)} required style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Platform Fee (%20)</label>
                        <input type="number" value={saleForm.platform_fee} readOnly style={{ ...inputStyle, background: '#f7f6f2', color: '#888' }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                      <label style={labelStyle}>Not (opsiyonel)</label>
                      <input type="text" value={saleForm.note} onChange={e => setSaleForm({ ...saleForm, note: e.target.value })} placeholder="Satış notu..." style={inputStyle} />
                    </div>
                    <button type="submit" disabled={saleLoading} style={{
                      width: '100%', padding: '10px', background: '#22c55e', color: '#fff', border: 'none',
                      borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'var(--font-dm-sans),sans-serif',
                    }}>
                      {saleLoading ? 'Kaydediliyor...' : 'Satışı Kaydet'}
                    </button>
                  </form>
                </div>

              </div>

              {/* 5. MÜŞTERİ BAZLI RAPOR */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', marginBottom: '20px', overflow: 'hidden' }}>
                <div style={sectionTitle}>Müşteri Bazlı Rapor</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafaf8' }}>
                      {['Müşteri', 'Alınan Kredi', 'Harcanan Kredi', 'Kalan', 'Ödenen TL', 'Platform Geliri'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientReport.map(c => (
                      <tr key={c.id}>
                        <td style={{ ...tdStyle, fontWeight: '500' }}>{c.company_name}</td>
                        <td style={tdStyle}>{c.totalPurchased}</td>
                        <td style={tdStyle}>{c.usedCredits}</td>
                        <td style={tdStyle}>{c.credit_balance}</td>
                        <td style={tdStyle}>{formatTL(c.totalPaidTL)}</td>
                        <td style={{ ...tdStyle, color: '#22c55e', fontWeight: '500' }}>{formatTL(c.platformFee)}</td>
                      </tr>
                    ))}
                    {clientReport.length === 0 && (
                      <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#888' }}>Veri yok.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 6. CREATOR BAZLI RAPOR */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', marginBottom: '20px', overflow: 'hidden' }}>
                <div style={sectionTitle}>Creator Bazlı Rapor</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafaf8' }}>
                      {['Creator', 'Toplam Kredi', 'Kazanılan TL', 'Ödenen TL', 'Bekleyen TL'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {creatorReport.map(cr => (
                      <tr key={cr.id}>
                        <td style={{ ...tdStyle, fontWeight: '500' }}>{cr.users?.name}</td>
                        <td style={tdStyle}>{cr.totalCredits}</td>
                        <td style={tdStyle}>{formatTL(cr.totalEarned)}</td>
                        <td style={{ ...tdStyle, color: '#22c55e' }}>{formatTL(cr.totalPaid)}</td>
                        <td style={{ ...tdStyle, color: cr.pending > 0 ? '#f59e0b' : '#888', fontWeight: cr.pending > 0 ? '500' : '400' }}>{formatTL(cr.pending)}</td>
                      </tr>
                    ))}
                    {creatorReport.length === 0 && (
                      <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#888' }}>Veri yok.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 7. SON İŞLEMLER */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={sectionTitle}>Son Kredi Satışları</div>
                {creditSales.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontSize: '13px' }}>Henüz satış kaydı yok.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#fafaf8' }}>
                        {['Tarih', 'Müşteri', 'Kredi', 'Toplam TL', 'Platform Fee', 'Kredi/TL'].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {creditSales.slice(0, 20).map(s => (
                        <tr key={s.id}>
                          <td style={{ ...tdStyle, fontSize: '12px', color: '#888' }}>{new Date(s.created_at).toLocaleDateString('tr-TR')}</td>
                          <td style={{ ...tdStyle, fontWeight: '500' }}>{s.clients?.company_name}</td>
                          <td style={tdStyle}>{s.credits}</td>
                          <td style={tdStyle}>{formatTL(Number(s.total_amount))}</td>
                          <td style={{ ...tdStyle, color: '#22c55e' }}>{formatTL(Number(s.platform_fee || 0))}</td>
                          <td style={{ ...tdStyle, fontSize: '12px', color: '#888' }}>{s.credits > 0 ? formatTL(Math.round(Number(s.total_amount) / s.credits)) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
