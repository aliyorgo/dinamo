'use client'
import { useState } from 'react'

interface Props {
  candidates: string[]
  saving?: boolean
  onContinue: (items: { written: string; pronounced: string }[]) => void
  onClose: () => void
}

export default function PronunciationModal({ candidates, saving, onContinue, onClose }: Props) {
  const [inputs, setInputs] = useState<Record<string, string>>({})

  const handleContinue = () => {
    const items = candidates
      .map(w => ({ written: w, pronounced: (inputs[w] || '').trim() }))
      .filter(it => it.pronounced)
    onContinue(items)
  }

  return (
    <div onClick={saving ? undefined : onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', padding: '28px 32px', maxWidth: '520px', width: '90%', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#0a0a0a' }}>Telaffuz Kontrolü</div>
          <button onClick={onClose} disabled={saving} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#888', cursor: saving ? 'not-allowed' : 'pointer', lineHeight: 1 }}>&times;</button>
        </div>
        <div style={{ fontSize: '13px', color: '#6b6b66', marginBottom: '20px', lineHeight: 1.5 }}>
          Okunuşunu yazınız. Kelimenin sesli okunduğunda nasıl duyulması gerektiğini yazın. İki kural: (1) Kelime İngilizce ise ve İngilizce okunuyorsa İngilizce yazımıyla bırakın — örneğin "Bankam+" için "Bankam Plus" (plas değil), "Prime" için "Prime". (2) Kelime Türkçe okunuyorsa ama yazımı yanıltıcıysa Türkçe okunuşuyla yazın — örneğin "Turkcell" için "Türksel". Boş bırakırsanız kelime yazıldığı gibi okunur. Ekran yazıları ve CTA orijinal yazımıyla kalır.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
          {candidates.map(w => (
            <div key={w} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: '0 0 40%', fontSize: '14px', fontWeight: '500', color: '#0a0a0a', wordBreak: 'break-word' }}>{w}</div>
              <input
                value={inputs[w] || ''}
                onChange={e => setInputs(prev => ({ ...prev, [w]: e.target.value }))}
                placeholder="örn. Bankam Plus"
                style={{ flex: 1, padding: '9px 11px', fontSize: '13px', border: '1px solid #e5e4db', boxSizing: 'border-box' }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={handleContinue} disabled={saving} style={{ padding: '9px 24px', background: saving ? '#ccc' : '#0a0a0a', color: '#fff', border: 'none', fontSize: '13px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Kaydediliyor...' : 'Devam Et'}</button>
        </div>
      </div>
    </div>
  )
}
