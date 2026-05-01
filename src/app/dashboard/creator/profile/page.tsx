'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function CreatorProfile() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [creatorId, setCreatorId] = useState('')
  const [profile, setProfile] = useState({ phone: '', iban: '', entity_type: 'personal' as 'personal' | 'company', tax_no: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [showAgreement, setShowAgreement] = useState(false)
  const [agreementChecked, setAgreementChecked] = useState(false)
  const [agreementAccepted, setAgreementAccepted] = useState(false)
  const [showAgreementView, setShowAgreementView] = useState(false)
  const [unavailDates, setUnavailDates] = useState<string[]>([])
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() } })
  const [agreementDate, setAgreementDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!loading && window.location.hash === '#availability') {
      document.getElementById('availability')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [loading])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: ud } = await supabase.from('users').select('name').eq('id', user.id).single()
      setUserName(ud?.name || '')
      const { data: creator } = await supabase.from('creators').select('*').eq('user_id', user.id).maybeSingle()
      if (!creator) { setLoading(false); return }
      setCreatorId(creator.id)
      setProfile({ phone: creator.phone || '', iban: creator.iban || '', entity_type: creator.entity_type || 'personal', tax_no: creator.tax_no || '', address: creator.address || '' })
      setUnavailDates(Array.isArray(creator.unavailable_dates) ? creator.unavailable_dates : [])
      if (creator.agreement_accepted) { setAgreementAccepted(true); setAgreementDate(creator.agreement_accepted_at || null) }
      if (!creator.phone || !creator.iban) setMsg('Lütfen önce profilinizi tamamlayın.')
      setLoading(false)
    }
    load()
  }, [router])

  async function handleSave() {
    setSaving(true); setMsg('')
    const { error } = await supabase.from('creators').update({
      phone: profile.phone || null, iban: profile.iban || null,
      entity_type: profile.entity_type, tax_no: profile.entity_type === 'company' ? profile.tax_no || null : null,
      address: profile.address || null,
    }).eq('id', creatorId)
    setMsg(error ? 'Hata: ' + error.message : 'Kaydedildi.')
    setSaving(false)
  }

  async function handleAgreementAccept() {
    const now = new Date().toISOString()
    await supabase.from('creators').update({ agreement_accepted: true, agreement_accepted_at: now }).eq('id', creatorId)
    setAgreementAccepted(true); setAgreementDate(now); setShowAgreement(false)
  }

  if (loading) return <div style={{ padding: '24px 28px', color: 'var(--color-text-tertiary)', fontSize: '14px' }}>Yükleniyor...</div>

  return (
    <div style={{ padding: '24px 28px', maxWidth: '480px' }}>
      <div style={{ background: '#fff', border: '1px solid #e5e4db', padding: '24px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '20px' }}>KİŞİSEL BİLGİLER</div>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>AD SOYAD</div>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>{userName}</div>
        </div>
        {[
          { key: 'phone', label: 'TELEFON', placeholder: '05XX XXX XXXX' },
          { key: 'iban', label: 'IBAN', placeholder: 'TR...' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>{f.label}</div>
            <input value={(profile as any)[f.key]} onChange={e => setProfile({ ...profile, [f.key]: e.target.value })} placeholder={f.placeholder}
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 13px', border: '1px solid #e5e4db', fontSize: '13px', color: '#0a0a0a' }} />
          </div>
        ))}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>FATURA TİPİ</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {([['personal', 'Şahıs'], ['company', 'Şirket']] as const).map(([val, label]) => (
              <button key={val} onClick={() => setProfile({ ...profile, entity_type: val })}
                style={{ flex: 1, padding: '9px', border: '1px solid', borderColor: profile.entity_type === val ? '#0a0a0a' : '#e5e4db', background: profile.entity_type === val ? '#0a0a0a' : '#fff', color: profile.entity_type === val ? '#fff' : '#555', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {profile.entity_type === 'company' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>VERGİ NO</div>
            <input value={profile.tax_no} onChange={e => setProfile({ ...profile, tax_no: e.target.value })} placeholder="Vergi numarası"
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 13px', border: '1px solid #e5e4db', fontSize: '13px', color: '#0a0a0a' }} />
          </div>
        )}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>ADRES</div>
          <textarea value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} placeholder="Açık adres" rows={3}
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 13px', border: '1px solid #e5e4db', fontSize: '13px', color: '#0a0a0a', resize: 'vertical' }} />
        </div>
        {msg && <div style={{ fontSize: '12px', color: msg.includes('Hata') ? '#ef4444' : '#22c55e', marginBottom: '12px' }}>{msg}</div>}
        <button onClick={handleSave} disabled={saving} className="btn" style={{ padding: '10px 24px' }}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
      </div>

      {/* MÜSAİTLİK TAKVİMİ */}
      <div id="availability" style={{ background: '#fff', border: '1px solid #e5e4db', padding: '20px 24px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>MÜSAİTLİK</div>
        <div style={{ fontSize: '12px', color: '#6b6b66', lineHeight: 1.5, marginBottom: '16px' }}>Müsait olmadığın günleri işaretle. Mevcut işlerin etkilenmez, sadece yeni atamalarda görünür.</div>

        {/* Calendar */}
        {(() => {
          const { year, month } = calMonth
          const TR_MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
          const TR_DAYS = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz']
          const firstDay = new Date(year, month, 1)
          const startDay = (firstDay.getDay() + 6) % 7
          const daysInMonth = new Date(year, month + 1, 0).getDate()
          const today = new Date(); today.setHours(0,0,0,0)
          const tomorrow = new Date(today.getTime() + 86400000)
          const maxDate = new Date(today.getTime() + 60 * 86400000)

          async function toggleDate(dateStr: string) {
            const next = unavailDates.includes(dateStr) ? unavailDates.filter(d => d !== dateStr) : [...unavailDates, dateStr]
            setUnavailDates(next)
            await supabase.from('creators').update({ unavailable_dates: next }).eq('id', creatorId)
          }

          function prevMonth() { setCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { year: p.year, month: p.month - 1 }) }
          function nextMonth() { setCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { year: p.year, month: p.month + 1 }) }

          return (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <button onClick={prevMonth} style={{ background: 'none', border: '1px solid #e5e4db', padding: '4px 10px', cursor: 'pointer', fontSize: '12px' }}>←</button>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#0a0a0a' }}>{TR_MONTHS[month]} {year}</div>
                <button onClick={nextMonth} style={{ background: 'none', border: '1px solid #e5e4db', padding: '4px 10px', cursor: 'pointer', fontSize: '12px' }}>→</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '16px' }}>
                {TR_DAYS.map(d => <div key={d} style={{ fontSize: '9px', textAlign: 'center', color: '#888', padding: '4px 0', letterSpacing: '1px' }}>{d}</div>)}
                {Array.from({ length: startDay }).map((_, i) => <div key={'e' + i} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const date = new Date(year, month, day)
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isPast = date < tomorrow
                  const isFuture = date > maxDate
                  const disabled = isPast || isFuture
                  const selected = unavailDates.includes(dateStr)
                  const isToday = date.getTime() === today.getTime()
                  return (
                    <button key={day} onClick={() => !disabled && toggleDate(dateStr)} disabled={disabled}
                      style={{ padding: '8px 0', fontSize: '12px', fontWeight: isToday ? '600' : '400', textAlign: 'center', cursor: disabled ? 'default' : 'pointer', border: isToday ? '1px solid #0a0a0a' : '1px solid transparent', background: selected ? '#0a0a0a' : 'transparent', color: selected ? '#fff' : disabled ? '#ccc' : '#0a0a0a' }}>
                      {day}
                    </button>
                  )
                })}
              </div>
            </>
          )
        })()}

        {/* Marked days list */}
        {unavailDates.length > 0 ? (
          <div>
            <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>İŞARETLİ GÜNLER</div>
            {[...unavailDates].sort().map(d => (
              <div key={d} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f0f0ee' }}>
                <span style={{ fontSize: '12px', color: '#0a0a0a' }}>{new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <button onClick={async () => { const next = unavailDates.filter(x => x !== d); setUnavailDates(next); await supabase.from('creators').update({ unavailable_dates: next }).eq('id', creatorId) }}
                  style={{ fontSize: '14px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>×</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Henüz gün işaretlemedin.</div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e4db', padding: '20px 24px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '12px' }}>TAAHHÜTNAME</div>
        {agreementAccepted ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '3px 8px', border: '1px solid #22c55e', color: '#22c55e' }}>ONAYLANDI</span>
              {agreementDate && <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{new Date(agreementDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
            </div>
            <button onClick={() => setShowAgreementView(true)} style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#0a0a0a', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>TAAHHÜTNAMEYİ OKU</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: '#f59e0b' }}>Henüz onaylanmadı</span>
            <button onClick={() => setShowAgreement(true)} className="btn" style={{ padding: '7px 16px' }}>Taahhütnameyi Oku</button>
          </div>
        )}
      </div>

      {showAgreement && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', border: '1px solid #0a0a0a', width: '100%', maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', margin: '24px' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #e5e4db', flexShrink: 0 }}>
              <div style={{ fontSize: '18px', fontWeight: '500', color: '#0a0a0a' }}>Dinamo Creator Taahhütnamesi</div>
            </div>
            <div style={{ flex: 1, padding: '24px 28px', fontSize: '13px', color: '#333', lineHeight: 1.8, overflowY: 'auto' }}>
              <p style={{ marginBottom: '16px' }}>Dinamo platformu üzerinden gerçekleştireceğim tüm prodüksiyon çalışmalarında aşağıdaki koşulları kabul ettiğimi beyan ederim.</p>
              <p style={{ marginBottom: '8px' }}><strong>TELİF HAKLARI:</strong> Ürettiğim içeriklerde telif hakkı koruması altındaki hiçbir görsel, ses, müzik veya materyali izinsiz kullanmayacağımı taahhüt ederim.</p>
              <p style={{ marginBottom: '8px' }}><strong>YAPAY ZEKA ARAÇLARI:</strong> AI ile ürettiğim tüm içeriklerde yalnızca ticari kullanıma izin veren platformları kullanacağımı taahhüt ederim.</p>
              <p style={{ marginBottom: '8px' }}><strong>GİZLİLİK:</strong> Müşteri bilgilerini ve brief içeriklerini gizli tutacağımı taahhüt ederim.</p>
              <p style={{ marginBottom: '8px' }}><strong>PLATFORM DIŞI İLETİŞİM:</strong> Müşterilerle platform dışında ticari ilişki kurmayacağımı kabul ederim.</p>
              <p><strong>SORUMLULUK:</strong> Bu taahhütname kapsamındaki yükümlülüklerimi yerine getirmediğim durumlarda doğabilecek sorumluluğun tarafıma ait olduğunu kabul ederim.</p>
            </div>
            <div style={{ padding: '20px 28px', borderTop: '1px solid #e5e4db', flexShrink: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '16px' }}>
                <input type="checkbox" checked={agreementChecked} onChange={e => setAgreementChecked(e.target.checked)} style={{ accentColor: '#0a0a0a', width: '18px', height: '18px' }} />
                <span style={{ fontSize: '13px', color: '#0a0a0a' }}>Okudum ve kabul ediyorum</span>
              </label>
              <button onClick={handleAgreementAccept} disabled={!agreementChecked} className="btn" style={{ width: '100%', padding: '13px', opacity: agreementChecked ? 1 : 0.4 }}>
                Onaylıyorum
              </button>
            </div>
          </div>
        </div>
      )}
      {/* VIEW AGREEMENT MODAL (read-only) */}
      {showAgreementView && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', border: '1px solid #0a0a0a', width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', margin: '24px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e4db', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: '500', color: '#0a0a0a' }}>Dinamo Creator Taahhütnamesi</div>
              {agreementDate && <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>{new Date(agreementDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} tarihinde onayladın</span>}
            </div>
            <div style={{ flex: 1, padding: '20px 24px', fontSize: '13px', color: '#333', lineHeight: 1.8, overflowY: 'auto' }}>
              <p style={{ marginBottom: '16px' }}>Dinamo platformu üzerinden gerçekleştireceğim tüm prodüksiyon çalışmalarında aşağıdaki koşulları kabul ettiğimi beyan ederim.</p>
              <p style={{ marginBottom: '8px' }}><strong>TELİF HAKLARI:</strong> Ürettiğim içeriklerde telif hakkı koruması altındaki hiçbir görsel, ses, müzik veya materyali izinsiz kullanmayacağımı taahhüt ederim.</p>
              <p style={{ marginBottom: '8px' }}><strong>YAPAY ZEKA ARAÇLARI:</strong> AI ile ürettiğim tüm içeriklerde yalnızca ticari kullanıma izin veren platformları kullanacağımı taahhüt ederim.</p>
              <p style={{ marginBottom: '8px' }}><strong>GİZLİLİK:</strong> Müşteri bilgilerini ve brief içeriklerini gizli tutacağımı taahhüt ederim.</p>
              <p style={{ marginBottom: '8px' }}><strong>PLATFORM DIŞI İLETİŞİM:</strong> Müşterilerle platform dışında ticari ilişki kurmayacağımı kabul ederim.</p>
              <p><strong>SORUMLULUK:</strong> Bu taahhütname kapsamındaki yükümlülüklerimi yerine getirmediğim durumlarda doğabilecek sorumluluğun tarafıma ait olduğunu kabul ederim.</p>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e4db', flexShrink: 0 }}>
              <button onClick={() => setShowAgreementView(false)} className="btn btn-outline" style={{ width: '100%', padding: '10px' }}>KAPAT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
