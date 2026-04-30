'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function CreatorWallet() {
  const router = useRouter()
  const [earnings, setEarnings] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [creditRate, setCreditRate] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: creator } = await supabase.from('creators').select('*').eq('user_id', user.id).maybeSingle()
      if (!creator) { setLoading(false); return }
      setProfile(creator)
      const { data: e } = await supabase.from('creator_earnings').select('*, briefs(campaign_name)').eq('creator_id', creator.id).order('created_at', { ascending: false })
      setEarnings(e || [])
      const { data: p } = await supabase.from('creator_payments').select('*').eq('creator_id', creator.id).order('paid_at', { ascending: false })
      setPayments(p || [])
      const { data: st } = await supabase.from('admin_settings').select('value').eq('key', 'creator_credit_rate').maybeSingle()
      if (st) setCreditRate(Number(st.value) || 0)
      setLoading(false)
    }
    load()
  }, [router])

  const isIndividual = profile?.entity_type === 'personal' || !profile?.entity_type
  const taxRate = isIndividual ? 0.25 : 0
  const totalEarned = earnings.reduce((s, e) => s + Number(e.tl_amount), 0)
  const totalTax = Math.round(totalEarned * taxRate)
  const totalNet = totalEarned - totalTax
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount_tl), 0)
  const pendingGross = earnings.filter(e => !e.paid).reduce((s, e) => s + Number(e.tl_amount), 0)
  const pendingNet = pendingGross - Math.round(pendingGross * taxRate)

  if (loading) return <div style={{ padding: '24px 28px', color: 'var(--color-text-tertiary)', fontSize: '14px' }}>Yükleniyor...</div>

  return (
    <div style={{ padding: '24px 28px' }}>
      {isIndividual && (
        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', padding: '12px 16px', marginBottom: '16px', fontSize: '12px', color: '#92400e', lineHeight: 1.6 }}>
          Şahıs olarak çalıştığınız için ödemelerinizde %25 stopaj kesintisi uygulanmaktadır.
        </div>
      )}
      <div className="wallet-grid" style={{ display: 'grid', gridTemplateColumns: isIndividual ? 'repeat(5,1fr)' : 'repeat(4,1fr)', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Brüt Kazanç', value: totalEarned.toLocaleString('tr-TR') + ' ₺', color: '#0a0a0a' },
          ...(isIndividual ? [{ label: 'Stopaj (%25)', value: '-' + totalTax.toLocaleString('tr-TR') + ' ₺', color: '#ef4444' }] : []),
          { label: isIndividual ? 'Net Kazanç' : 'Toplam Kazanç', value: (isIndividual ? totalNet : totalEarned).toLocaleString('tr-TR') + ' ₺', color: '#0a0a0a' },
          { label: 'Ödenen', value: totalPaid.toLocaleString('tr-TR') + ' ₺', color: '#22c55e' },
          { label: 'Bekleyen', value: (isIndividual ? pendingNet : pendingGross).toLocaleString('tr-TR') + ' ₺', color: pendingGross > 0 ? '#f59e0b' : '#888' },
        ].map(card => (
          <div key={card.label} style={{ background: '#fff', border: '1px solid #e5e4db', padding: '16px' }}>
            <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>{card.label}</div>
            <div style={{ fontSize: '20px', fontWeight: '500', color: card.color, letterSpacing: '-0.5px' }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e4db', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e4db', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: '#0a0a0a' }}>KAZANÇ GEÇMİŞİ</div>
        {earnings.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '14px' }}>Henüz kazanç yok.</div>
        ) : earnings.map((e, i) => (
          <div key={e.id} style={{ padding: '14px 20px', borderBottom: i < earnings.length - 1 ? '1px solid #f0f0ee' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{e.briefs?.campaign_name || '—'}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{e.credits} kredi · {Number(e.tl_rate).toLocaleString('tr-TR')} ₺/kredi · {new Date(e.created_at).toLocaleDateString('tr-TR')}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '15px', fontWeight: '300', color: '#0a0a0a' }}>{Number(e.tl_amount).toLocaleString('tr-TR')} ₺</div>
                {isIndividual && <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '1px' }}>net {Math.round(Number(e.tl_amount) * 0.75).toLocaleString('tr-TR')} ₺</div>}
              </div>
              <span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '2px 7px', border: `1px solid ${e.paid ? '#22c55e' : '#f59e0b'}`, color: e.paid ? '#22c55e' : '#f59e0b' }}>{e.paid ? 'ÖDENDİ' : 'BEKLİYOR'}</span>
            </div>
          </div>
        ))}
      </div>

      {payments.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e4db', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e4db', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: '500', color: '#0a0a0a' }}>ÖDEME GEÇMİŞİ</div>
          {payments.map((p, i) => (
            <div key={p.id} style={{ padding: '14px 20px', borderBottom: i < payments.length - 1 ? '1px solid #f0f0ee' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{Number(p.amount_tl).toLocaleString('tr-TR')} ₺</div>
                  {p.vat_included && <span style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', padding: '2px 6px', border: '1px solid #3b82f6', color: '#3b82f6' }}>KDV DAHİL</span>}
                </div>
                {p.note && <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{p.note}</div>}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>{new Date(p.paid_at).toLocaleDateString('tr-TR')}</div>
            </div>
          ))}
        </div>
      )}
      <style>{`@media (max-width: 768px) { .wallet-grid { grid-template-columns: repeat(2, 1fr) !important; } }`}</style>
    </div>
  )
}
