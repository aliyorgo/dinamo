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
  { label: 'Krediler', href: '/dashboard/admin/credits' },
  { label: 'Raporlar', href: '/dashboard/admin/reports' },
  { label: 'Faturalar', href: '/dashboard/admin/invoices' },
  { label: 'Ajanslar', href: '/dashboard/admin/agencies' },
  { label: 'Ana Sayfa', href: '/dashboard/admin/homepage' },
  { label: 'Ayarlar', href: '/dashboard/admin/settings' },
]

function formatTL(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₺'
}

export default function InvoicesPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingInvoice, setEditingInvoice] = useState<string | null>(null)
  const [invoiceNoInput, setInvoiceNoInput] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: ud } = await supabase.from('users').select('name, role').eq('id', user.id).single()
    if (!ud || ud.role !== 'admin') { router.push('/login'); return }
    setUserName(ud.name)
    const { data: s } = await supabase.from('credit_sales').select('*, clients(company_name)').order('created_at', { ascending: false })
    // Sort: incomplete first, then by date desc
    const sorted = (s || []).sort((a: any, b: any) => {
      const aDone = a.invoice_sent && a.payment_received ? 1 : 0
      const bDone = b.invoice_sent && b.payment_received ? 1 : 0
      if (aDone !== bDone) return aDone - bDone
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    setSales(sorted)
    setLoading(false)
  }

  async function toggleField(id: string, field: 'invoice_sent' | 'payment_received', current: boolean) {
    const update: any = { [field]: !current }
    if (!current) update[field + '_at'] = new Date().toISOString()
    else update[field + '_at'] = null
    await supabase.from('credit_sales').update(update).eq('id', id)
    setSales(prev => prev.map(s => s.id === id ? { ...s, ...update } : s))
  }

  async function saveInvoiceNo(id: string) {
    await supabase.from('credit_sales').update({ invoice_no: invoiceNoInput }).eq('id', id)
    setSales(prev => prev.map(s => s.id === id ? { ...s, invoice_no: invoiceNoInput } : s))
    setEditingInvoice(null)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const totalAmount = sales.reduce((s, x) => s + Number(x.total_amount || 0), 0)
  const totalVat = Math.round(totalAmount * 0.2)
  const totalWithVat = totalAmount + totalVat
  const paidAmount = sales.filter(x => x.payment_received).reduce((s, x) => s + Number(x.total_amount || 0), 0)
  const pendingAmount = totalAmount - paidAmount
  const pendingWithVat = pendingAmount + Math.round(pendingAmount * 0.2)

  function borderColor(sale: any) {
    if (sale.invoice_sent && sale.payment_received) return '#22c55e'
    if (sale.invoice_sent) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');`}</style>

      {/* SIDEBAR */}
      <div style={{ width: '220px', background: '#111113', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#fff', letterSpacing: '-0.5px', marginBottom: '12px' }}>
            dinam<span style={{ display: 'inline-block', width: '11px', height: '11px', borderRadius: '50%', border: '2.5px solid #22c55e', position: 'relative', top: '1px' }}></span>
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '3px' }}>Admin</div>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff' }}>{userName}</div>
        </div>
        <nav style={{ padding: '10px 8px', flex: 1 }}>
          {NAV.map(item => (
            <div key={item.href} onClick={() => router.push(item.href)}
              style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: item.href === '/dashboard/admin/invoices' ? 'rgba(255,255,255,0.08)' : 'transparent', marginBottom: '1px' }}>
              <span style={{ fontSize: '12px', color: item.href === '/dashboard/admin/invoices' ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: item.href === '/dashboard/admin/invoices' ? '500' : '400' }}>{item.label}</span>
            </div>
          ))}
        </nav>
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 8px', borderRadius: '7px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter,sans-serif' }}>Çıkış yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>Faturalar</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {loading ? <div style={{ color: '#888', fontSize: '14px' }}>Yükleniyor...</div> : (
            <>
              {/* SUMMARY */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
                {[
                  { label: 'Toplam (KDV Hariç)', value: formatTL(totalAmount), sub: null, color: '#0a0a0a' },
                  { label: 'Toplam (KDV Dahil)', value: formatTL(totalWithVat), sub: `KDV: ${formatTL(totalVat)}`, color: '#0a0a0a' },
                  { label: 'Tahsil Edilen', value: formatTL(paidAmount), sub: null, color: '#22c55e' },
                  { label: 'Bekleyen (KDV Dahil)', value: formatTL(pendingWithVat), sub: `KDV hariç: ${formatTL(pendingAmount)}`, color: pendingAmount > 0 ? '#f59e0b' : '#888' },
                ].map(card => (
                  <div key={card.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{card.label}</div>
                    <div style={{ fontSize: '24px', fontWeight: '300', color: card.color, letterSpacing: '-1px' }}>{card.value}</div>
                    {card.sub && <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>{card.sub}</div>}
                  </div>
                ))}
              </div>

              {/* LIST */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
                  Kredi Satışları ({sales.length})
                </div>
                {sales.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: '#888', fontSize: '13px' }}>Henüz satış kaydı yok.</div>
                ) : sales.map((s, i) => (
                  <div key={s.id} style={{
                    padding: '14px 20px', borderBottom: i < sales.length - 1 ? '0.5px solid rgba(0,0,0,0.06)' : 'none',
                    borderLeft: `3px solid ${borderColor(s)}`,
                    display: 'flex', alignItems: 'center', gap: '16px',
                  }}>
                    {/* Info */}
                    {(() => {
                      const amt = Number(s.total_amount || 0)
                      const vat = Math.round(amt * 0.2)
                      return (
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{s.clients?.company_name || '—'}</div>
                          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                            {s.credits} kredi · {formatTL(amt)} <span style={{color:'#aaa'}}>+KDV {formatTL(vat)}</span> = <strong style={{color:'#0a0a0a'}}>{formatTL(amt + vat)}</strong> · {new Date(s.created_at).toLocaleDateString('tr-TR')}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Invoice No */}
                    <div style={{ width: '120px', flexShrink: 0 }}>
                      {editingInvoice === s.id ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input value={invoiceNoInput} onChange={e => setInvoiceNoInput(e.target.value)} placeholder="Fatura no"
                            style={{ width: '80px', padding: '5px 8px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '6px', fontSize: '11px', color: '#0a0a0a', fontFamily: 'Inter,sans-serif', outline: 'none' }} />
                          <button onClick={() => saveInvoiceNo(s.id)}
                            style={{ padding: '5px 8px', background: '#111113', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '10px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>✓</button>
                        </div>
                      ) : (
                        <div onClick={() => { setEditingInvoice(s.id); setInvoiceNoInput(s.invoice_no || '') }}
                          style={{ fontSize: '11px', color: s.invoice_no ? '#0a0a0a' : '#ccc', cursor: 'pointer', padding: '4px 0' }}>
                          {s.invoice_no || 'Fatura no ekle'}
                        </div>
                      )}
                    </div>

                    {/* Toggles */}
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button onClick={() => toggleField(s.id, 'invoice_sent', s.invoice_sent)}
                        style={{
                          padding: '5px 12px', borderRadius: '100px', fontSize: '10px', fontWeight: '500', cursor: 'pointer',
                          fontFamily: 'Inter,sans-serif', transition: 'all 0.2s',
                          border: s.invoice_sent ? '1px solid #22c55e' : '1px solid rgba(0,0,0,0.15)',
                          background: s.invoice_sent ? 'rgba(34,197,94,0.1)' : '#fff',
                          color: s.invoice_sent ? '#22c55e' : '#888',
                        }}>
                        {s.invoice_sent ? '✓ Fatura Kesildi' : 'Fatura Kesilmedi'}
                      </button>
                      <button onClick={() => toggleField(s.id, 'payment_received', s.payment_received)}
                        style={{
                          padding: '5px 12px', borderRadius: '100px', fontSize: '10px', fontWeight: '500', cursor: 'pointer',
                          fontFamily: 'Inter,sans-serif', transition: 'all 0.2s',
                          border: s.payment_received ? '1px solid #22c55e' : '1px solid rgba(0,0,0,0.15)',
                          background: s.payment_received ? 'rgba(34,197,94,0.1)' : '#fff',
                          color: s.payment_received ? '#22c55e' : '#888',
                        }}>
                        {s.payment_received ? '✓ Ödeme Geldi' : 'Ödeme Bekleniyor'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
