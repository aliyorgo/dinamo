'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const PIE_COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6']

export default function ClientReportsPage() {
  const router = useRouter()
  const reportRef = useRef<HTMLDivElement>(null)
  const [userName, setUserName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [credits, setCredits] = useState(0)
  const [briefs, setBriefs] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [packages, setPackages] = useState<any[]>([])
  const [clientPackageName, setClientPackageName] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingCell, setEditingCell] = useState<{id:string, field:string, value:string}|null>(null)
  const [savedCell, setSavedCell] = useState<string|null>(null)
  const [generatingLinkId, setGeneratingLinkId] = useState<string|null>(null)
  const [copiedLinkId, setCopiedLinkId] = useState<string|null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('name, role').eq('id', user.id).single()
      if (!userData || userData.role !== 'client') { router.push('/login'); return }
      setUserName(userData.name)
      // Try client_users — use limit(1) instead of single/maybeSingle to avoid multi-row error
      const { data: cuList, error: cuErr } = await supabase.from('client_users').select('allocated_credits, client_id, clients(company_name)').eq('user_id', user.id).limit(1)
      const cu = cuList?.[0] || null
      let clientId: string | null = cu?.client_id || null

      console.log('[Reports] user:', user.id, '| cu:', cu, '| cuErr:', cuErr?.message, '| clientId:', clientId)

      if (cu) {
        setCredits(cu.allocated_credits)
        setCompanyName((cu as any).clients?.company_name || '')
      }

      if (clientId) {
        const { data: b, error: bErr } = await supabase.from('briefs').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
        console.log('[Reports] Briefs:', b?.length, '| Error:', bErr?.message)
        setBriefs(b || [])
        const { data: t } = await supabase.from('credit_transactions').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(200)
        setTransactions(t || [])
      } else {
        console.log('[Reports] No clientId found')
        setBriefs([])
      }
      const { data: pkgs } = await supabase.from('credit_packages').select('*').order('credits')
      setPackages(pkgs || [])
      setLoading(false)
    }
    load()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Per-format credit costs
  const FORMAT_CREDITS: Record<string,number> = {'Bumper / Pre-roll':6,'Story / Reels':12,'Feed Video':20,'Long Form':30}

  function briefCreditCost(b: any) { return FORMAT_CREDITS[b.video_type] || b.credit_cost || 0 }

  // Inline cell edit — onBlur auto-save
  async function saveCell(id: string, field: string, rawValue: string) {
    const brief = briefs.find(b => b.id === id)
    if (!brief) return
    let parsed: any = rawValue
    if (field === 'views') parsed = parseInt(rawValue) || 0
    else if (field === 'engagement_rate') parsed = parseFloat(rawValue) || 0
    // Skip if unchanged
    const oldVal = brief[field] ?? (field === 'public_link' ? '' : 0)
    if (String(oldVal) === String(parsed)) { setEditingCell(null); return }
    console.log('[Reports] Saving', field, '=', parsed, 'for brief:', id)
    const { error } = await supabase.from('briefs').update({ [field]: parsed }).eq('id', id)
    console.log('[Reports] Update result — error:', error)
    if (error) { alert('Kayıt hatası: ' + error.message); setEditingCell(null); return }
    setBriefs(prev => prev.map(b => b.id === id ? { ...b, [field]: parsed } : b))
    setEditingCell(null)
    setSavedCell(`${id}_${field}`)
    setTimeout(() => setSavedCell(null), 1500)
  }

  async function generatePublicLink(briefId: string) {
    setGeneratingLinkId(briefId)
    // Find latest approved submission, fallback to any submission
    const { data: subs } = await supabase.from('video_submissions').select('*').eq('brief_id', briefId)
      .in('status', ['admin_approved','producer_approved','approved']).order('submitted_at', { ascending: false }).limit(1)
    let sub = subs?.[0]
    if (!sub?.video_url) {
      const { data: anySubs } = await supabase.from('video_submissions').select('*').eq('brief_id', briefId).order('submitted_at', { ascending: false }).limit(1)
      sub = anySubs?.[0]
      if (!sub?.video_url) { alert('Bu brief için yüklenmiş video bulunamadı.'); setGeneratingLinkId(null); return }
    }
    const srcPath = sub.video_url.split('/videos/')[1]
    if (!srcPath) { alert('Video storage yolu bulunamadı.'); setGeneratingLinkId(null); return }
    const decodedPath = decodeURIComponent(srcPath)
    const destPath = `${briefId}.mp4`
    // Download from videos bucket, upload to delivered-videos
    const { data: fileData, error: dlErr } = await supabase.storage.from('videos').download(decodedPath)
    if (dlErr || !fileData) {
      // Fallback: use original URL directly
      console.log('[Reports] Download failed, using original URL:', dlErr?.message)
      const { error } = await supabase.from('briefs').update({ public_link: sub.video_url }).eq('id', briefId)
      if (!error) setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, public_link: sub.video_url } : b))
      setGeneratingLinkId(null); return
    }
    const { error: upErr } = await supabase.storage.from('delivered-videos').upload(destPath, fileData, { upsert: true })
    if (upErr) { console.log('[Reports] Upload failed:', upErr.message); alert('Dosya kopyalama hatası: ' + upErr.message); setGeneratingLinkId(null); return }
    const { data: urlData } = supabase.storage.from('delivered-videos').getPublicUrl(destPath)
    const publicLink = urlData.publicUrl
    const { error } = await supabase.from('briefs').update({ public_link: publicLink }).eq('id', briefId)
    if (error) { alert('Link kayıt hatası: ' + error.message); setGeneratingLinkId(null); return }
    console.log('[Reports] Public link created:', publicLink)
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, public_link: publicLink } : b))
    setGeneratingLinkId(null)
  }

  async function handlePdf() {
    const html2canvas = (await import('html2canvas')).default
    const { jsPDF } = await import('jspdf')
    if (!reportRef.current) return
    const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#f5f4f0' })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageW = pdf.internal.pageSize.getWidth()
    const imgH = (canvas.height * pageW) / canvas.width
    let y = 0
    const pageH = pdf.internal.pageSize.getHeight()
    while (y < imgH) {
      if (y > 0) pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, -y, pageW, imgH)
      y += pageH
    }
    const dateStr = new Date().toISOString().slice(0,10)
    pdf.save(`rapor_${companyName.replace(/\s+/g,'_')}_${dateStr}.pdf`)
  }

  // Date filter helper
  function inRange(dateStr: string) {
    if (!dateStr) return true
    const d = dateStr.slice(0, 10)
    if (dateFrom && d < dateFrom) return false
    if (dateTo && d > dateTo) return false
    return true
  }

  // Derived data — filtered by date range
  const filteredBriefs = briefs.filter(b => inRange(b.created_at))
  const delivered = filteredBriefs.filter(b => b.status === 'delivered')
  const filteredTransactions = transactions.filter(t => inRange(t.created_at))
  const totalCreditsSpent = filteredTransactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalCreditsBought = filteredTransactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalViews = delivered.reduce((s, b) => s + (b.views || 0), 0)
  const avgEngagement = delivered.length > 0 ? delivered.reduce((s, b) => s + (b.engagement_rate || 0), 0) / delivered.length : 0

  // Credit price from packages
  const currentPkg = packages.find(p => p.name === clientPackageName)
  const creditPriceTL = currentPkg && currentPkg.credits > 0 && currentPkg.price_tl ? currentPkg.price_tl / currentPkg.credits : 0
  const totalCostTL = delivered.reduce((s, b) => s + briefCreditCost(b) * creditPriceTL, 0)
  const costPerVideo = delivered.length > 0 ? totalCostTL / delivered.length : 0

  // Pie chart data — format distribution
  const formatCounts: Record<string,number> = {}
  delivered.forEach(b => { formatCounts[b.video_type] = (formatCounts[b.video_type]||0) + 1 })
  const pieData = Object.entries(formatCounts).map(([name, value]) => ({ name, value }))

  // Bar chart data — views per video
  const barData = delivered.filter(b => (b.views||0) > 0).sort((a,b) => (b.views||0) - (a.views||0)).slice(0, 10).map(b => ({
    name: b.campaign_name.length > 15 ? b.campaign_name.substring(0,15)+'…' : b.campaign_name,
    views: b.views || 0,
  }))

  // Cost-effectiveness
  const bestCpv = delivered.filter(b => (b.views||0) > 0).sort((a,b) => {
    const cpvA = (briefCreditCost(a) * creditPriceTL) / a.views
    const cpvB = (briefCreditCost(b) * creditPriceTL) / b.views
    return cpvA - cpvB
  })[0]
  const bestEngagement = delivered.filter(b => (b.engagement_rate||0) > 0).sort((a,b) => (b.engagement_rate||0) - (a.engagement_rate||0))[0]
  const overallCpv = totalViews > 0 ? totalCostTL / totalViews : 0

  // Upsell logic
  const isEligibleForUpsell = ['Başlangıç','Standart','Demo'].includes(clientPackageName)
  const savingsIfKurumsal = isEligibleForUpsell && creditPriceTL > 0 ? totalCreditsSpent * creditPriceTL * 0.25 : 0

  const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '400', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '10px 12px', fontSize: '13px', color: '#0a0a0a', borderTop: '0.5px solid rgba(0,0,0,0.06)' }

  const usagePercent = totalCreditsBought > 0 ? Math.min(100, Math.round((totalCreditsSpent / totalCreditsBought) * 100)) : 0

  return (
    <div style={{ display: 'flex', minHeight: '100vh',  background: '#f5f4f0' }}>

      {/* SIDEBAR */}
      <div style={{ width: '240px', background: '#0A0A0A', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100dvh', overflowY: 'auto' }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', cursor: 'pointer' }} onClick={() => router.push('/dashboard/client')}>
          <img src="/dinamo_logo.png" alt="Dinamo" style={{height:'28px'}} />
        </div>
        <div style={{margin:'12px 12px',padding:'16px 20px',background:'rgba(29,184,29,0.06)',borderLeft:'3px solid #1DB81D'}}>
          <div style={{fontSize:'18px',fontWeight:'700',color:'#fff',marginBottom:'2px'}}>{companyName || 'Dinamo'}</div>
          <div style={{fontSize:'13px',fontWeight:'400',color:'#888',marginBottom:'12px'}}>{userName}</div>
          <div style={{fontSize:'10px',color:'#AAA',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'8px'}}>KREDİ BAKİYESİ</div>
          <div style={{fontSize:'28px',fontWeight:'700',color:'#1DB81D',letterSpacing:'-1px'}}>{credits}</div>
        </div>
        <nav style={{ padding: '10px 8px' }}>
          {[
            { label: 'Projelerim', href: '/dashboard/client' },
            { label: 'Yeni Brief', href: '/dashboard/client/brief/new' },
            { label: 'Marka Kimliği', href: '/dashboard/client/brand-identity' },
            { label: 'Raporlar', href: '/dashboard/client/reports', active: true },
            { label: 'Telif Belgeleri', href: '/dashboard/client/certificates' },
            { label: 'İçerik Güvencesi', href: '/dashboard/client/guarantee' },
          ].map(item => (
            <div key={item.href} onClick={() => router.push(item.href)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: (item as any).active ? 'rgba(255,255,255,0.08)' : 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: (item as any).active ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: '500' }}>{item.label}</span>
            </div>
          ))}
          <button onClick={handleLogout}
            onMouseEnter={e=>{(e.currentTarget.firstChild as HTMLElement).style.color='#FF4444'}}
            onMouseLeave={e=>{(e.currentTarget.firstChild as HTMLElement).style.color='#aaa'}}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 8px', marginTop: '16px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: '#aaa',  transition: 'color 0.15s' }}>Çıkış yap</span>
          </button>
          <img src='/powered_by_dcc.png' alt='Powered by DCC' style={{height:'20px',width:'auto',opacity:0.6,display:'block',margin:'8px 8px',cursor:'pointer'}} onClick={()=>window.open('https://dirtycheapcreative.com','_blank')} />
        </nav>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Raporlar</div>
          <button onClick={handlePdf} style={{ background: '#111113', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '12px', fontWeight: '500', cursor: 'pointer',  display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            PDF İndir
          </button>
        </div>

        <div style={{ flex: 1, padding: '24px 28px' }} ref={reportRef}>
          {loading ? <div style={{ color: '#888', fontSize: '14px' }}>Yükleniyor...</div> : (
            <>
              {/* TARİH FİLTRESİ */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>Tarih Aralığı</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '13px',  color: '#0a0a0a', outline: 'none' }} />
                  <span style={{ fontSize: '12px', color: '#888' }}>—</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '13px',  color: '#0a0a0a', outline: 'none' }} />
                </div>
                {[
                  { label: 'Bu Ay', fn: () => { const n=new Date(); setDateFrom(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`); setDateTo('') } },
                  { label: 'Son 3 Ay', fn: () => { const n=new Date(); n.setMonth(n.getMonth()-3); setDateFrom(n.toISOString().slice(0,10)); setDateTo('') } },
                  { label: 'Son 6 Ay', fn: () => { const n=new Date(); n.setMonth(n.getMonth()-6); setDateFrom(n.toISOString().slice(0,10)); setDateTo('') } },
                  { label: 'Tümü', fn: () => { setDateFrom(''); setDateTo('') } },
                ].map(p => (
                  <button key={p.label} onClick={p.fn}
                    style={{ padding: '6px 14px', borderRadius: '100px', border: '1px solid rgba(0,0,0,0.1)', background: '#fff', fontSize: '11px', color: '#555', cursor: 'pointer',  fontWeight: '500' }}>
                    {p.label}
                  </button>
                ))}
                {(dateFrom || dateTo) && (
                  <div style={{ fontSize: '11px', color: '#22c55e', fontWeight: '500' }}>
                    {delivered.length} video · {totalCreditsSpent} kredi
                  </div>
                )}
              </div>

              {/* KREDİ KULLANIM BARSI */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' }}>
                  <div style={{ fontSize: '20px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-0.5px' }}>
                    {dateFrom || dateTo ? 'Seçili dönemde' : 'Toplam'} <strong style={{ fontWeight: '600' }}>{totalCreditsSpent}</strong> / {totalCreditsBought} kredi kullanıldı
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: '600', color: '#22c55e' }}>%{usagePercent}</div>
                </div>
                <div style={{ width: '100%', height: '10px', background: 'rgba(0,0,0,0.06)', borderRadius: '100px', overflow: 'hidden' }}>
                  <div style={{ width: `${usagePercent}%`, height: '100%', background: 'linear-gradient(90deg, #22c55e, #16a34a)', borderRadius: '100px', transition: 'width 0.6s ease' }} />
                </div>
              </div>

              {/* ÖZET KARTLAR */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: 'Üretilen Video', value: String(delivered.length), sub: 'adet' },
                  { label: 'Toplam Görüntülenme', value: totalViews.toLocaleString('tr-TR'), sub: 'views' },
                  { label: 'Ort. Etkileşim Oranı', value: `%${avgEngagement.toFixed(1)}`, sub: 'engagement' },
                  { label: 'Video Başı Maliyet', value: costPerVideo > 0 ? `${costPerVideo.toLocaleString('tr-TR', {maximumFractionDigits:0})} ₺` : '—', sub: 'format kredisi × birim fiyat ÷ video' },
                ].map(card => (
                  <div key={card.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '18px' }}>
                    <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{card.label}</div>
                    <div style={{ fontSize: '28px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-1px' }}>{card.value}</div>
                    <div style={{ fontSize: '10px', color: '#bbb', marginTop: '4px' }}>{card.sub}</div>
                  </div>
                ))}
              </div>

              {/* VİDEO TABLOSU */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>Videolar</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>{filteredBriefs.length} brief · {delivered.length} teslim edildi</div>
                </div>
                {filteredBriefs.length === 0 ? (
                  <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '15px', color: '#888', marginBottom: '8px' }}>Bu tarih aralığında brief bulunamadı.</div>
                    <div style={{ fontSize: '12px', color: '#bbb' }}>Tarih aralığını genişletmeyi veya "Tümü" seçeneğini deneyin.</div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '950px' }}>
                      <thead>
                        <tr style={{ background: '#fafaf8' }}>
                          {['Başlık','Tarih','Format','Durum','Görüntülenme','Etkileşim %','Public Link','CPV',''].map(h => (
                            <th key={h} style={thStyle}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBriefs.map(b => {
                          const isDelivered = b.status === 'delivered'
                          const videoCostTL = briefCreditCost(b) * creditPriceTL
                          const cpv = (b.views||0) > 0 ? (videoCostTL / b.views).toFixed(2) : null
                          const statusMap: Record<string,{label:string,color:string,bg:string}> = {
                            submitted: {label:'Gönderildi',color:'#f59e0b',bg:'rgba(245,158,11,0.1)'},
                            read: {label:'İnceleniyor',color:'#3b82f6',bg:'rgba(59,130,246,0.1)'},
                            in_production: {label:'Üretimde',color:'#8b5cf6',bg:'rgba(139,92,246,0.1)'},
                            revision: {label:'Revizyon',color:'#ef4444',bg:'rgba(239,68,68,0.1)'},
                            approved: {label:'Onaylandı',color:'#22c55e',bg:'rgba(34,197,94,0.1)'},
                            delivered: {label:'Teslim',color:'#22c55e',bg:'rgba(34,197,94,0.1)'},
                            cancelled: {label:'İptal',color:'#888',bg:'rgba(0,0,0,0.05)'},
                          }
                          const st = statusMap[b.status] || {label:b.status,color:'#888',bg:'rgba(0,0,0,0.05)'}

                          const isEditingViews = editingCell?.id === b.id && editingCell?.field === 'views'
                          const isEditingEng = editingCell?.id === b.id && editingCell?.field === 'engagement_rate'

                          const inputStyle: React.CSSProperties = { padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.5)', fontSize: '13px',  outline: 'none', background: '#fff' }
                          const clickableStyle: React.CSSProperties = isDelivered ? { cursor: 'text', padding: '4px 8px', borderRadius: '6px', border: '1px solid transparent', transition: 'border-color 0.15s' } : {}

                          return (
                            <tr key={b.id}
                              onMouseEnter={e => (e.currentTarget.style.background = '#fafaf8')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                              <td style={{ ...tdStyle, fontWeight: '500' }}>{b.campaign_name}</td>
                              <td style={{ ...tdStyle, fontSize: '12px', color: '#888' }}>{new Date(b.created_at).toLocaleDateString('tr-TR')}</td>
                              <td style={{ ...tdStyle, fontSize: '12px' }}>{b.video_type}</td>
                              <td style={tdStyle}><span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '100px', background: st.bg, color: st.color, fontWeight: '500' }}>{st.label}</span></td>

                              {/* VIEWS */}
                              <td style={tdStyle}>
                                {isEditingViews ? (
                                  <input autoFocus value={editingCell.value} onChange={e => setEditingCell({...editingCell, value: e.target.value})}
                                    onBlur={() => saveCell(b.id, 'views', editingCell.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                    style={{ ...inputStyle, width: '80px' }} />
                                ) : (
                                  <span onClick={() => isDelivered && setEditingCell({id:b.id, field:'views', value: String(b.views||0)})}
                                    style={{...clickableStyle, color: savedCell===`${b.id}_views` ? '#22c55e' : 'inherit', fontWeight: savedCell===`${b.id}_views` ? '500' : 'inherit'}}>
                                    {isDelivered ? (b.views||0).toLocaleString('tr-TR') : '—'}
                                  </span>
                                )}
                              </td>

                              {/* ENGAGEMENT */}
                              <td style={tdStyle}>
                                {isEditingEng ? (
                                  <input autoFocus value={editingCell.value} onChange={e => setEditingCell({...editingCell, value: e.target.value})}
                                    onBlur={() => saveCell(b.id, 'engagement_rate', editingCell.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                    style={{ ...inputStyle, width: '60px' }} />
                                ) : (
                                  <span onClick={() => isDelivered && setEditingCell({id:b.id, field:'engagement_rate', value: String(b.engagement_rate||0)})}
                                    style={{...clickableStyle, color: savedCell===`${b.id}_engagement_rate` ? '#22c55e' : 'inherit', fontWeight: savedCell===`${b.id}_engagement_rate` ? '500' : 'inherit'}}>
                                    {isDelivered && b.engagement_rate ? `%${b.engagement_rate}` : '—'}
                                  </span>
                                )}
                              </td>

                              {/* PUBLIC LINK */}
                              <td style={{ ...tdStyle, fontSize: '12px' }}>
                                {isDelivered && b.public_link ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <a href={`/video/${b.id}`} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>Link ↗</a>
                                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/video/${b.id}`); setCopiedLinkId(b.id); setTimeout(() => setCopiedLinkId(null), 1500) }}
                                      style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff', color: copiedLinkId === b.id ? '#22c55e' : '#888', cursor: 'pointer',  whiteSpace: 'nowrap' }}>
                                      {copiedLinkId === b.id ? 'Kopyalandı ✓' : 'Kopyala'}
                                    </button>
                                  </span>
                                ) : isDelivered ? (
                                  <button onClick={() => generatePublicLink(b.id)} disabled={generatingLinkId === b.id}
                                    style={{ background: 'none', border: '1px solid rgba(0,0,0,0.12)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: generatingLinkId === b.id ? '#bbb' : '#555', cursor: 'pointer',  whiteSpace: 'nowrap' }}>
                                    {generatingLinkId === b.id ? 'Oluşturuluyor...' : 'Link Oluştur'}
                                  </button>
                                ) : (
                                  <span style={{ color: '#ddd' }}>—</span>
                                )}
                              </td>

                              {/* CPV */}
                              <td style={tdStyle}>{isDelivered && cpv ? `${cpv} ₺` : '—'}</td>

                              {/* SAVED FLASH */}
                              <td style={tdStyle}>
                                {(savedCell===`${b.id}_views` || savedCell===`${b.id}_engagement_rate`) && (
                                  <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: '500' }}>✓</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* CHARTS */}
              {delivered.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  {/* PIE CHART */}
                  <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a', marginBottom: '16px' }}>Formata Göre Dağılım</div>
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(props: any)=>`${props.name} ${((props.percent||0)*100).toFixed(0)}%`} labelLine={false} style={{fontSize:'11px'}}>
                            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <div style={{ color: '#bbb', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>Veri yok</div>}
                  </div>

                  {/* BAR CHART */}
                  <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a', marginBottom: '16px' }}>Video Başı Görüntülenme</div>
                    {barData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={barData} layout="vertical" margin={{left:10,right:20}}>
                          <XAxis type="number" tick={{fontSize:10}} />
                          <YAxis type="category" dataKey="name" width={100} tick={{fontSize:10}} />
                          <Tooltip />
                          <Bar dataKey="views" fill="#22c55e" radius={[0,4,4,0]} barSize={16} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <div style={{ color: '#bbb', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>Henüz görüntülenme verisi yok</div>}
                  </div>
                </div>
              )}

              {/* COST-ETKİ ANALİZİ */}
              {(bestCpv || bestEngagement || overallCpv > 0) && (
                <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a', marginBottom: '14px' }}>Maliyet-Etki Analizi</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
                    {bestCpv && (
                      <div style={{ background: '#fafaf8', borderRadius: '10px', padding: '14px' }}>
                        <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>En İyi CPV</div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '4px' }}>{bestCpv.campaign_name}</div>
                        <div style={{ fontSize: '12px', color: '#22c55e' }}>
                          {((briefCreditCost(bestCpv) * creditPriceTL) / bestCpv.views).toFixed(2)} ₺&apos;ye {bestCpv.views.toLocaleString('tr-TR')} görüntülenme
                        </div>
                      </div>
                    )}
                    {bestEngagement && (
                      <div style={{ background: '#fafaf8', borderRadius: '10px', padding: '14px' }}>
                        <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>En Yüksek Etkileşim</div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a', marginBottom: '4px' }}>{bestEngagement.campaign_name}</div>
                        <div style={{ fontSize: '12px', color: '#3b82f6' }}>%{bestEngagement.engagement_rate} etkileşim</div>
                      </div>
                    )}
                    {overallCpv > 0 && (
                      <div style={{ background: '#fafaf8', borderRadius: '10px', padding: '14px' }}>
                        <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Genel CPV</div>
                        <div style={{ fontSize: '22px', fontWeight: '300', color: '#0a0a0a', letterSpacing: '-1px' }}>{overallCpv.toFixed(2)} ₺</div>
                        <div style={{ fontSize: '10px', color: '#bbb' }}>toplam maliyet ÷ toplam görüntülenme</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* KURUMSAL UPSELL */}
              {isEligibleForUpsell && savingsIfKurumsal > 0 && (
                <div style={{ background: 'rgba(34,197,94,0.03)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '12px', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '13px', color: '#0a0a0a', marginBottom: '4px' }}>
                      Kurumsal pakete geçseydiniz bu dönem <strong style={{ color: '#22c55e' }}>{savingsIfKurumsal.toLocaleString('tr-TR', {maximumFractionDigits:0})} ₺</strong> tasarruf ederdiniz.
                    </div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Mevcut paketiniz: {clientPackageName} · Kurumsal fiyat mevcut birim fiyatın %25 altında hesaplanmıştır.</div>
                  </div>
                  <a href="/demo-request" style={{ fontSize: '12px', color: '#22c55e', fontWeight: '500', whiteSpace: 'nowrap', padding: '8px 16px', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', textDecoration: 'none' }}>
                    Kurumsal paket hakkında bilgi al →
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
