import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('[approve-credit] Missing env:', { url: !!url, key: !!key })
    return NextResponse.json({ error: 'Server yapilandirma hatasi' }, { status: 500 })
  }

  const supabase = createClient(url, key)

  const { requestId, status } = await request.json()
  console.log('[approve-credit] Request:', { requestId, status })

  if (!requestId || !status) return NextResponse.json({ error: 'requestId ve status gerekli' }, { status: 400 })

  // 1. Get the payment request
  const { data: req, error: reqErr } = await supabase.from('agency_payment_requests').select('*').eq('id', requestId).single()
  if (reqErr) {
    console.error('[approve-credit] Fetch request error:', reqErr.message)
    return NextResponse.json({ error: 'Talep bulunamadi: ' + reqErr.message }, { status: 404 })
  }
  console.log('[approve-credit] Found request:', { agency_id: req.agency_id, credits: req.credits_requested, amount: req.amount })

  // 2. Update status
  const { error: updateErr } = await supabase.from('agency_payment_requests').update({ status }).eq('id', requestId)
  if (updateErr) {
    console.error('[approve-credit] Update status error:', updateErr.message)
    return NextResponse.json({ error: 'Status guncellenemedi: ' + updateErr.message }, { status: 500 })
  }
  console.log('[approve-credit] Status updated to:', status)

  // 3. On approval: load credits + update invoiced
  if (status === 'approved') {
    const agencyId = req.agency_id

    const { data: agency, error: agFetchErr } = await supabase.from('agencies').select('demo_credits, invoiced_amount').eq('id', agencyId).single()
    if (agFetchErr || !agency) {
      console.error('[approve-credit] Fetch agency error:', agFetchErr?.message)
      return NextResponse.json({ error: 'Ajans bulunamadi' }, { status: 404 })
    }
    console.log('[approve-credit] Current agency:', { demo_credits: agency.demo_credits, invoiced_amount: agency.invoiced_amount })

    const creditsToAdd = Number(req.credits_requested) || 0
    const amountToInvoice = Number(req.amount) || 0
    const newCredits = Number(agency.demo_credits || 0) + creditsToAdd
    const newInvoiced = Number(agency.invoiced_amount || 0) + amountToInvoice

    console.log('[approve-credit] Will update:', { newCredits, newInvoiced, creditsToAdd, amountToInvoice })

    const { error: agUpdateErr } = await supabase.from('agencies').update({
      demo_credits: newCredits,
      invoiced_amount: newInvoiced,
    }).eq('id', agencyId)

    if (agUpdateErr) {
      console.error('[approve-credit] Agency update error:', agUpdateErr.message)
      return NextResponse.json({ error: 'Ajans guncellenemedi: ' + agUpdateErr.message }, { status: 500 })
    }
    console.log('[approve-credit] Agency updated successfully')

    return NextResponse.json({ ok: true, creditsAdded: creditsToAdd, amountInvoiced: amountToInvoice, newCredits, newInvoiced })
  }

  return NextResponse.json({ ok: true })
}
