import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { briefId, keepFrameUrls } = await req.json()
    if (!briefId) return NextResponse.json({ error: 'briefId gerekli' }, { status: 400 })

    const keepSet = new Set(keepFrameUrls || [])
    const replaceCount = 4 - keepSet.size

    if (replaceCount <= 0) {
      return NextResponse.json({ frames: [...keepSet] })
    }

    // Get pool from brief metadata
    const { data: brief } = await supabase.from('briefs').select('static_frame_pool').eq('id', briefId).single()
    const pool: string[] = brief?.static_frame_pool || []

    // Take replacement frames from pool
    const replacements = pool.splice(0, replaceCount)

    // Update remaining pool
    await supabase.from('briefs').update({ static_frame_pool: pool }).eq('id', briefId)

    // Build new frame list: kept frames + replacements
    const kept = Array.from(keepSet) as string[]
    const newFrames = [...kept, ...replacements]

    // If pool exhausted and we still need more, return what we have
    return NextResponse.json({
      frames: newFrames.slice(0, 4),
      candidatePool: pool,
      poolExhausted: pool.length === 0,
    })
  } catch (err: any) {
    console.error('Static images refresh error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
