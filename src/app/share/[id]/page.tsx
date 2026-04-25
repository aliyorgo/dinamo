import { createClient } from '@supabase/supabase-js'
import SharePageClient from './client'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export default async function SharePage({ params }: { params: { id: string } }) {
  const { id } = await params

  const { data: brief } = await supabase.from('briefs')
    .select('id, campaign_name, message, video_type, format, created_at, static_images_url, static_image_files, caption, client_id, clients(company_name)')
    .eq('id', id).single()

  if (!brief) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <div style={{ marginBottom: '32px' }}><img src="/dinamo_logo.png" alt="Dinamo" style={{ height: '36px' }} /></div>
          <div style={{ fontSize: '20px', fontWeight: '500', color: '#fff', marginBottom: '12px' }}>Kampanya bulunamadı</div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>Link geçersiz veya kampanya henüz paylaşılmamış.</div>
        </div>
      </div>
    )
  }

  // Fetch approved assets
  const { data: videos } = await supabase.from('video_submissions')
    .select('id, video_url, version, status')
    .eq('brief_id', id)
    .in('status', ['producer_approved', 'admin_approved'])
    .order('version', { ascending: true })

  const rootId = brief.id
  const { data: aiChildren } = await supabase.from('briefs')
    .select('id, campaign_name, ai_video_url, status, cps_hook, static_image_files, static_images_url')
    .eq('root_campaign_id', rootId)
    .ilike('campaign_name', '%Full AI%')
    .eq('status', 'delivered')

  const { data: cpsChildren } = await supabase.from('briefs')
    .select('id, campaign_name, cps_hook, cps_ton, status, video_submissions(id, video_url, status)')
    .eq('parent_brief_id', id)
    .eq('brief_type', 'cps_child')
    .order('mvc_order', { ascending: true })

  const clientName = (brief.clients as any)?.company_name || ''

  // Format date server-side with manual Turkish month names — no locale dependency
  const TR_MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
  let deliveryDate = ''
  try {
    const d = new Date(brief.created_at)
    if (!isNaN(d.getTime())) {
      deliveryDate = `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`
    }
  } catch {}
  if (!deliveryDate) deliveryDate = '—'

  // Extract caption as plain string to avoid serialization issues
  const caption = typeof brief.caption === 'string' ? brief.caption : ''

  return (
    <SharePageClient
      brief={brief}
      clientName={clientName}
      deliveryDate={deliveryDate}
      caption={caption}
      videos={videos || []}
      aiChildren={(aiChildren || []).filter(c => c.ai_video_url)}
      cpsChildren={(cpsChildren || []).filter((c: any) => c.video_submissions?.length > 0)}
    />
  )
}
