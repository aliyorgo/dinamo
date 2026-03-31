import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { to, subject, html } = await request.json()

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Dinamo <hello@dinamo.media>',
      to,
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    return NextResponse.json({ error: err }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
