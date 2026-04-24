'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useParams } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const statusLabel: Record<string, { label: string; color: string }> = {
  draft: { label: 'Taslak', color: '#f59e0b' },
  submitted: { label: 'Gonderildi', color: '#888' },
  read: { label: 'Incelendi', color: '#888' },
  in_production: { label: 'Uretimde', color: '#3b82f6' },
  revision: { label: 'Revizyon', color: '#ef4444' },
  approved: { label: 'Onaylandi', color: '#22c55e' },
  delivered: { label: 'Teslim Edildi', color: '#22c55e' },
  completed: { label: 'Tamamlandi', color: '#22c55e' },
  cancelled: { label: 'Iptal', color: '#555' },
}

export default function AgencyBriefDetailPage() {
  const router = useRouter()
  const params = useParams()
  const briefId = params.id as string

  const [loading, setLoading] = useState(true)
  const [agency, setAgency] = useState<any>(null)
  const [brief, setBrief] = useState<any>(null)
  const [memberName, setMemberName] = useState('')
  const [submissions, setSubmissions] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])

  useEffect(() => { load() }, [briefId])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: ud } = await supabase.from('users').select('name, role, agency_id').eq('id', user.id).single()
    if (!ud || !ud.agency_id || !['agency', 'agency_member'].includes(ud.role || '')) { router.push('/login'); return }

    const [{ data: ag }, { data: br }, { data: subs }, { data: bf }] = await Promise.all([
      supabase.from('agencies').select('id, name, logo_url').eq('id', ud.agency_id).single(),
      supabase.from('briefs').select('*').eq('id', briefId).single(),
      supabase.from('video_submissions').select('id, video_url, status, submitted_at, version').eq('brief_id', briefId).order('version', { ascending: false }),
      supabase.from('brief_files').select('id, file_name, file_url').eq('brief_id', briefId),
    ])

    if (!br || br.agency_id !== ud.agency_id) { router.push('/dashboard/agency/studio/briefs'); return }
    setAgency(ag)
    setBrief(br)
    setSubmissions(subs || [])
    setFiles(bf || [])

    if (br.agency_member_id) {
      const { data: mb } = await supabase.from('users').select('name').eq('id', br.agency_member_id).single()
      if (mb) setMemberName(mb.name)
    }
    setLoading(false)
  }

  async function handleLogout() { await supabase.auth.signOut(); router.push('/login') }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0',  }}><div style={{ color: '#888', fontSize: '14px' }}>Yukleniyor...</div></div>

  const st = statusLabel[brief?.status] || { label: brief?.status, color: '#888' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh',  }}>

      {/* SIDEBAR */}
      <div style={{ width: '240px', background: '#0A0A0A', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          {agency?.logo_url ? (
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', overflow: 'hidden' }}>
              <img src={agency.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
            </div>
          ) : (
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px', fontWeight: '500', color: '#fff' }}>{agency?.name?.charAt(0)?.toUpperCase() || 'A'}</span>
            </div>
          )}
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff', marginBottom: '2px' }}>{agency?.name || ''}</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Brief Detay</div>
        </div>
        <nav style={{ padding: '10px 8px', flex: 1 }}>
          <div onClick={() => router.push('/dashboard/agency/studio/briefs')}
            style={{ display: 'flex', alignItems: 'center', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.08)', marginBottom: '1px' }}>
            <span style={{ fontSize: '12px', color: '#fff', fontWeight: '500' }}>Briefler</span>
          </div>
        </nav>
        <div style={{ padding: '10px 8px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} style={{ padding: '6px 8px', borderRadius: '7px', cursor: 'pointer', width: '100%', background: 'none', border: 'none' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)',  }}>Cikis yap</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f4f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 28px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button onClick={() => router.push('/dashboard/agency/studio/briefs')} style={{ fontSize: '12px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '0',  }}>Briefler</button>
          <span style={{ color: '#ddd' }}>/</span>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>{brief?.campaign_name}</div>
          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', fontWeight: '500', background: `${st.color}15`, color: st.color }}>{st.label}</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'start' }}>

            {/* LEFT — Brief Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* BRIEF TEXT */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '24px' }}>
                {brief?.client_name && <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{brief.client_name}</div>}
                <div style={{ fontSize: '22px', fontWeight: '500', color: '#0a0a0a', marginBottom: '6px', letterSpacing: '-0.5px' }}>{brief?.campaign_name}</div>
                <div style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>
                  {brief?.video_type}{brief?.format ? ` · ${brief.format}` : ''}{brief?.credit_cost ? ` · ${brief.credit_cost} kredi` : ''}
                </div>
                {brief?.message && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Brief Metni</div>
                    <div style={{ fontSize: '14px', color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{brief.message}</div>
                  </div>
                )}
                {brief?.cta && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>CTA</div>
                    <div style={{ fontSize: '14px', color: '#333' }}>{brief.cta}</div>
                  </div>
                )}
                {brief?.target_audience && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Hedef Kitle</div>
                    <div style={{ fontSize: '14px', color: '#333' }}>{brief.target_audience}</div>
                  </div>
                )}
                {brief?.notes && (
                  <div>
                    <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Notlar</div>
                    <div style={{ fontSize: '14px', color: '#333', lineHeight: 1.7 }}>{brief.notes}</div>
                  </div>
                )}
              </div>

              {/* SCENARIO */}
              {brief?.scenario_text && (
                <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '24px' }}>
                  <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Senaryo</div>
                  <div style={{ fontSize: '14px', color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{brief.scenario_text}</div>
                </div>
              )}

              {/* VOICEOVER */}
              {brief?.voiceover_text && (
                <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '24px' }}>
                  <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                    Seslendirme ({brief.voiceover_type === 'ai' ? 'AI' : 'Gercek'}{brief.voiceover_gender === 'female' ? ' · Kadin' : brief.voiceover_gender === 'male' ? ' · Erkek' : ''})
                  </div>
                  <div style={{ fontSize: '14px', color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{brief.voiceover_text}</div>
                </div>
              )}

              {/* VIDEO SUBMISSIONS */}
              {submissions.length > 0 && (
                <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>
                    Video Teslimleri ({submissions.length})
                  </div>
                  {submissions.map((sub, i) => (
                    <div key={sub.id} style={{ padding: '14px 20px', borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#0a0a0a' }}>Versiyon {sub.version}</span>
                        <span style={{ fontSize: '10px', color: '#888' }}>{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString('tr-TR') : ''}</span>
                      </div>
                      {sub.video_url && (
                        <video src={sub.video_url} controls style={{ width: '100%', maxHeight: '360px', borderRadius: '8px', background: '#000' }} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT — Info Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* STATUS & INFO */}
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Bilgiler</div>
                {[
                  { label: 'Durum', value: st.label, color: st.color },
                  { label: 'Musteri', value: brief?.client_name || 'Genel' },
                  { label: 'Uye', value: memberName || 'Ajans' },
                  { label: 'Video Tipi', value: brief?.video_type || '—' },
                  { label: 'Format', value: brief?.format || '—' },
                  { label: 'Kredi', value: `${brief?.credit_cost || 0}` },
                  { label: 'Satis Fiyati', value: brief?.sale_price ? `${Number(brief.sale_price).toLocaleString('tr-TR')} TL` : '—' },
                  { label: 'Tarih', value: brief?.created_at ? new Date(brief.created_at).toLocaleDateString('tr-TR') : '—' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>{row.label}</span>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: row.color || '#0a0a0a' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* PLATFORMS */}
              {brief?.platforms && brief.platforms.length > 0 && (
                <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Mecralar</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {brief.platforms.map((p: string) => (
                      <span key={p} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '100px', background: '#f5f4f0', color: '#555' }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* FILES */}
              {files.length > 0 && (
                <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Dosyalar ({files.length})</div>
                  {files.map(f => (
                    <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'block', fontSize: '12px', color: '#3b82f6', padding: '4px 0', textDecoration: 'none', borderBottom: '0.5px solid rgba(0,0,0,0.04)' }}>
                      {f.file_name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
