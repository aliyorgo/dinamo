import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const errors: string[] = []

  try {
    // 1. Delete brief_files + storage
    const { data: files } = await supabase.from('brief_files').select('id, file_url').eq('brief_id', id)
    if (files && files.length > 0) {
      for (const f of files) {
        if (f.file_url) {
          const match = f.file_url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
          if (match) {
            const { error } = await supabase.storage.from(match[1]).remove([match[2]])
            if (error) errors.push(`storage brief_file ${f.id}: ${error.message}`)
          }
        }
      }
      const { error } = await supabase.from('brief_files').delete().eq('brief_id', id)
      if (error) errors.push(`brief_files: ${error.message}`)
    }

    // 2. Delete video_submissions + storage
    const { data: subs } = await supabase.from('video_submissions').select('id, video_url').eq('brief_id', id)
    if (subs && subs.length > 0) {
      for (const s of subs) {
        if (s.video_url) {
          const match = s.video_url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
          if (match) {
            const { error } = await supabase.storage.from(match[1]).remove([match[2]])
            if (error) errors.push(`storage video ${s.id}: ${error.message}`)
          }
        }
      }
      const { error } = await supabase.from('video_submissions').delete().eq('brief_id', id)
      if (error) errors.push(`video_submissions: ${error.message}`)
    }

    // 3. Delete approvals
    const { error: appErr } = await supabase.from('approvals').delete().eq('brief_id', id)
    if (appErr) errors.push(`approvals: ${appErr.message}`)

    // 4. Delete producer_briefs
    const { error: pbErr } = await supabase.from('producer_briefs').delete().eq('brief_id', id)
    if (pbErr) errors.push(`producer_briefs: ${pbErr.message}`)

    // 5. Delete creator_earnings
    const { error: ceErr } = await supabase.from('creator_earnings').delete().eq('brief_id', id)
    if (ceErr) errors.push(`creator_earnings: ${ceErr.message}`)

    // 6. Delete credit_transactions linked to this brief
    const { error: ctErr } = await supabase.from('credit_transactions').delete().eq('brief_id', id)
    if (ctErr) errors.push(`credit_transactions: ${ctErr.message}`)

    // 7. Delete admin_notes linked to this brief
    const { error: anErr } = await supabase.from('admin_notes').delete().eq('brief_id', id)
    if (anErr) errors.push(`admin_notes: ${anErr.message}`)

    // 8. Delete inspirations linked to this brief
    const { error: inspErr } = await supabase.from('inspirations').delete().eq('brief_id', id)
    if (inspErr) errors.push(`inspirations: ${inspErr.message}`)

    // 9. Delete the brief itself
    const { error: briefErr } = await supabase.from('briefs').delete().eq('id', id)
    if (briefErr) {
      return NextResponse.json({ error: `Brief silinemedi: ${briefErr.message}`, warnings: errors }, { status: 500 })
    }

    return NextResponse.json({ ok: true, warnings: errors.length > 0 ? errors : undefined })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Beklenmeyen hata', warnings: errors }, { status: 500 })
  }
}
