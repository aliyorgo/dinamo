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
  const [agreementDate, setAgreementDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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

      <div style={{ background: '#fff', border: '1px solid #e5e4db', padding: '20px 24px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '12px' }}>TAAHHÜTNAME</div>
        {agreementAccepted ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '3px 8px', border: '1px solid #22c55e', color: '#22c55e' }}>ONAYLANDI</span>
            {agreementDate && <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{new Date(agreementDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
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
    </div>
  )
}
