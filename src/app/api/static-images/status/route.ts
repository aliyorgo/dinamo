import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Üretim fail/timeout olduğunda enqueue anında düşülen krediyi idempotent şekilde iade eder.
// credit_transactions tablosunda brief_id kolonu yok → eşleştirme description içindeki briefId üzerinden.
// Konvansiyon: type 'image_generate' + pozitif amount = iade, negatif amount = düşüm.
async function refundIfFailed(briefId: string) {
  try {
    // Idempotency: bu brief için zaten iade yapıldıysa tekrar iade etme
    const { data: existingRefund } = await supabase.from('credit_transactions')
      .select('id').eq('type', 'image_generate').gt('amount', 0)
      .like('description', `%${briefId}%`).limit(1).maybeSingle()
    if (existingRefund) return

    // Orijinal düşümü bul — doğru client_user ve cost buradan gelir (yanlış kullanıcıya iade riski yok)
    const { data: charge } = await supabase.from('credit_transactions')
      .select('client_id, client_user_id, amount').eq('type', 'image_generate').lt('amount', 0)
      .like('description', `%${briefId}%`).limit(1).maybeSingle()
    if (!charge || !charge.client_user_id) return
    const cost = Math.abs(charge.amount)
    if (cost <= 0) return

    // Krediyi geri ekle
    const { data: cu } = await supabase.from('client_users')
      .select('allocated_credits').eq('id', charge.client_user_id).single()
    if (!cu) return
    await supabase.from('client_users')
      .update({ allocated_credits: cu.allocated_credits + cost }).eq('id', charge.client_user_id)

    // İade kaydı (pozitif amount + briefId eşleşme anahtarı)
    await supabase.from('credit_transactions').insert({
      client_id: charge.client_id,
      client_user_id: charge.client_user_id,
      amount: cost,
      type: 'image_generate',
      description: `Görsel oluşturma iadesi - ${briefId}`,
    })
    console.log(`[status] kredi iadesi: brief ${briefId}, +${cost} → client_user ${charge.client_user_id}`)
  } catch (err: any) {
    // İade hatası status response'unu bozmasın
    console.error('[status] refund error:', err?.message || err)
  }
}

export async function GET(req: NextRequest) {
  const briefId = req.nextUrl.searchParams.get('briefId')
  if (!briefId) return NextResponse.json({ error: 'briefId gerekli' }, { status: 400 })

  const { data, error: dbErr } = await supabase.from('briefs')
    .select('static_images_job_status, static_images_job_payload, static_images_job_claimed_at, static_images_error, static_images_url')
    .eq('id', briefId).single()

  if (dbErr) {
    console.error('[status] DB error:', dbErr.message)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Brief bulunamadı' }, { status: 404 })

  // Timeout: 2 dakikadan uzun 'processing' → failed + iade
  if (data.static_images_job_status === 'processing' && data.static_images_job_claimed_at) {
    const elapsed = Date.now() - new Date(data.static_images_job_claimed_at).getTime()
    if (elapsed > 120000) {
      await supabase.from('briefs').update({ static_images_job_status: 'failed', static_images_error: 'Zaman aşımı' }).eq('id', briefId)
      await refundIfFailed(briefId)
      return NextResponse.json({ status: 'failed', error: 'Zaman aşımı', result: null, staticImagesUrl: data.static_images_url })
    }
  }

  // Worker fail path: status zaten 'failed' okunuyorsa iade tetikle (idempotent)
  if (data.static_images_job_status === 'failed') {
    await refundIfFailed(briefId)
  }

  const result = data.static_images_job_payload?.result || null

  return NextResponse.json({
    status: data.static_images_job_status,
    error: data.static_images_error,
    result,
    staticImagesUrl: data.static_images_url,
  })
}
