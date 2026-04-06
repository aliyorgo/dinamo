import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(request: Request) {
  const { name, contact_email, commission_rate, demo_credits, login_email, password } = await request.json()

  // 1. Create agency record
  const { data: agency, error: agencyError } = await supabaseAdmin
    .from('agencies')
    .insert({ name, contact_email: contact_email || null, commission_rate, demo_credits: demo_credits || 0 })
    .select()
    .single()

  if (agencyError) return NextResponse.json({ error: agencyError.message }, { status: 400 })

  // 2. Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: login_email,
    password,
    email_confirm: true,
  })

  if (authError) {
    await supabaseAdmin.from('agencies').delete().eq('id', agency.id)
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // 3. Create users record
  const { error: userError } = await supabaseAdmin.from('users').insert({
    id: authData.user.id,
    email: login_email,
    name,
    role: 'agency',
    agency_id: agency.id,
  })

  if (userError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    await supabaseAdmin.from('agencies').delete().eq('id', agency.id)
    return NextResponse.json({ error: userError.message }, { status: 400 })
  }

  // 4. Send welcome email via Resend
  try {
    await resend.emails.send({
      from: 'Dinamo <noreply@dinamo.media>',
      to: login_email,
      subject: `${name} — Dinamo Ajans Paneline Hoşgeldiniz`,
      html: `
        <div style="font-family: Inter, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #0a0a0a; color: #fff; border-radius: 16px;">
          <div style="font-size: 32px; font-weight: 500; letter-spacing: -1px; margin-bottom: 32px;">
            dinam<span style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; border: 3px solid #22c55e; position: relative; top: 3px;"></span>
          </div>
          <h1 style="font-size: 22px; font-weight: 400; margin: 0 0 12px; color: #fff;">Hoşgeldiniz, ${name}</h1>
          <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.6; margin: 0 0 32px;">
            Dinamo ajans paneline erişiminiz hazır. Aşağıdaki bilgilerle giriş yapabilirsiniz.
          </p>
          <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <div style="margin-bottom: 12px;">
              <div style="font-size: 10px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">E-posta</div>
              <div style="font-size: 14px; color: #fff;">${login_email}</div>
            </div>
            <div>
              <div style="font-size: 10px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Şifre</div>
              <div style="font-size: 14px; color: #fff; font-family: monospace; letter-spacing: 1px;">${password}</div>
            </div>
          </div>
          <a href="https://dinamo.media/login" style="display: inline-block; padding: 12px 28px; background: #22c55e; color: #0a0a0a; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
            Panele Giriş Yap →
          </a>
          <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin-top: 32px;">
            Bu maili beklemiyorsanız görmezden gelebilirsiniz.
          </p>
        </div>
      `,
    })
  } catch {
    // Email failure is non-blocking
  }

  return NextResponse.json({ success: true, agency })
}
