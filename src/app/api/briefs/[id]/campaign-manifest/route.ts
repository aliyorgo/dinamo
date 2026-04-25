import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function slugify(s: string) {
  const m: Record<string,string> = {'ğ':'g','ü':'u','ş':'s','ı':'i','ö':'o','ç':'c','Ğ':'G','Ü':'U','Ş':'S','İ':'I','Ö':'O','Ç':'C'}
  let r = s; for (const [k,v] of Object.entries(m)) r = r.replace(new RegExp(k,'g'),v)
  return r.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: brief } = await supabase.from('briefs')
    .select('id, campaign_name, message, video_type, format, created_at, ai_video_url, static_images_url, static_image_files, client_id, clients(company_name)')
    .eq('id', id).single()
  if (!brief) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

  const { data: videos } = await supabase.from('video_submissions')
    .select('id, video_url, version, status')
    .eq('brief_id', id)
    .in('status', ['producer_approved', 'admin_approved'])
    .order('version', { ascending: true })

  const { data: aiChildren } = await supabase.from('briefs')
    .select('id, campaign_name, ai_video_url, status, static_image_files, static_images_url')
    .eq('root_campaign_id', brief.id)
    .ilike('campaign_name', '%Full AI%')
    .eq('status', 'delivered')

  const { data: cpsChildren } = await supabase.from('briefs')
    .select('id, campaign_name, cps_hook, status, video_submissions(video_url, status)')
    .eq('parent_brief_id', id)
    .eq('brief_type', 'cps_child')

  const clientName = (brief.clients as any)?.company_name || ''
  const slug = slugify(brief.campaign_name || 'kampanya')
  const files: { path: string; url: string }[] = []

  // Main video
  ;(videos || []).forEach((v: any, i: number) => {
    if (v.video_url) files.push({ path: `ana_video/v${v.version}.mp4`, url: v.video_url })
  })

  // AI Express videos
  ;(aiChildren || []).filter((c: any) => c.ai_video_url).forEach((c: any, i: number) => {
    files.push({ path: `ai_express/v${i + 1}.mp4`, url: c.ai_video_url })
  })

  // CPS videos
  ;(cpsChildren || []).forEach((c: any, i: number) => {
    const vid = c.video_submissions?.[0]
    if (vid?.video_url) files.push({ path: `cps/yon_${i + 1}.mp4`, url: vid.video_url })
  })

  // Static images — main
  function addImages(raw: any, prefix: string) {
    const frames: any[] = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' && Object.keys(raw).length > 0) ? [raw] : []
    frames.forEach((ff: any, fi: number) => {
      const framePrefix = frames.length > 1 ? `${prefix}/frame_${fi + 1}` : prefix
      for (const [fmtKey, versions] of Object.entries(ff)) {
        const v = versions as any
        if (v?.with_text) files.push({ path: `${framePrefix}/yazili/${fmtKey}.jpg`, url: v.with_text })
        if (v?.no_text) files.push({ path: `${framePrefix}/yazisiz/${fmtKey}.jpg`, url: v.no_text })
      }
    })
  }

  if (brief.static_image_files) addImages(brief.static_image_files, 'gorseller/ana_video')
  ;(aiChildren || []).filter((c: any) => c.static_image_files).forEach((c: any, i: number) => {
    addImages(c.static_image_files, `gorseller/ai_express_v${i + 1}`)
  })

  // README
  const date = new Date(brief.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  const readmeLines = [
    'DINAMO KAMPANYA TESLIMATI',
    '─'.repeat(30),
    `Kampanya: ${brief.campaign_name}`,
    `Musteri: ${clientName}`,
    `Teslim Tarihi: ${date}`,
    `Ureten: DCC Film`,
    '',
    'ICINDEKILER',
    '',
    ...files.map(f => `${f.path}`),
    '',
    'Iletisim: hello@dinamo.media',
  ]

  return NextResponse.json({
    zipName: `${slug}_kampanya_teslimati.zip`,
    files,
    readme: readmeLines.join('\n'),
  })
}
