import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default async function VideoPage({ params }: { params: { id: string } }) {
  const { id } = await params
  const { data: brief } = await supabase.from('briefs').select('public_link').eq('id', id).single()

  if (brief?.public_link) {
    redirect(brief.public_link)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ textAlign: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: '28px', fontWeight: '500', color: '#fff', letterSpacing: '-0.5px', marginBottom: '32px' }}>
          dinam<span style={{ display: 'inline-block', width: '22px', height: '22px', borderRadius: '50%', border: '3.5px solid #22c55e', position: 'relative', top: '4px', marginLeft: '2px' }}></span>
        </div>
        <div style={{ fontSize: '20px', fontWeight: '300', color: '#fff', marginBottom: '12px' }}>Bu video bulunamadı.</div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '32px' }}>Video henüz yayınlanmamış veya link geçersiz olabilir.</div>
        <a href="/test" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: '100px', background: '#22c55e', color: '#fff', fontSize: '14px', fontWeight: '500', textDecoration: 'none' }}>
          Ana Sayfaya Dön
        </a>
      </div>
    </div>
  )
}
