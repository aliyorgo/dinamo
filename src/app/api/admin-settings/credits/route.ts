import { NextResponse } from 'next/server'
import { getAllCreditSettings } from '@/lib/credits-server'

export async function GET() {
  const settings = await getAllCreditSettings()
  return NextResponse.json(settings)
}
