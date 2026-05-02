import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const BUCKET = 'persona-thumbnails'
const SOURCE_DIR = path.join(process.env.HOME!, 'Downloads/persona')

const FILES = [
  { file: 'persona_01_gen_z_kiz.png', id: 1, slug: 'gen_z_kiz' },
  { file: 'persona_02_calisan_kadin.png', id: 2, slug: 'calisan_kadin' },
  { file: 'persona_03_genc_anne.png', id: 3, slug: 'genc_anne' },
  { file: 'persona_04_tech_erkek.png', id: 4, slug: 'tech_erkek' },
  { file: 'persona_05_moda_kadin.png', id: 5, slug: 'moda_kadin' },
  { file: 'persona_06_anadolu_baba.png', id: 6, slug: 'anadolu_baba' },
  { file: 'persona_07_luks_kadin.png', id: 7, slug: 'luks_kadin' },
  { file: 'persona_08_beauty_kadin.png', id: 8, slug: 'beauty_kadin' },
  { file: 'persona_09_spor_erkek.png', id: 9, slug: 'spor_erkek' },
  { file: 'persona_10_beyaz_yaka_erkek.png', id: 10, slug: 'beyaz_yaka_erkek' },
]

async function main() {
  console.log('=== Persona Thumbnail Upload ===')
  console.log('Supabase URL:', supabaseUrl)

  // 1. Create bucket if not exists
  const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, { public: true })
  if (bucketErr && !bucketErr.message.includes('already exists')) {
    console.error('Bucket oluşturulamadı:', bucketErr.message)
    process.exit(1)
  }
  console.log('✓ Bucket ready:', BUCKET)

  // 2. Upload files
  const results: { id: number; slug: string; url: string; ok: boolean; error?: string }[] = []

  for (const item of FILES) {
    const filePath = path.join(SOURCE_DIR, item.file)
    if (!fs.existsSync(filePath)) {
      results.push({ id: item.id, slug: item.slug, url: '', ok: false, error: 'Dosya bulunamadı' })
      continue
    }

    const fileBuffer = fs.readFileSync(filePath)
    const storagePath = item.file

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, fileBuffer, {
      contentType: 'image/png',
      upsert: true,
      cacheControl: '31536000', // 1 year
    })

    if (upErr) {
      results.push({ id: item.id, slug: item.slug, url: '', ok: false, error: upErr.message })
      continue
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    const publicUrl = urlData.publicUrl

    // 3. Update DB
    const { error: dbErr } = await supabase.from('personas').update({ thumbnail_url: publicUrl }).eq('id', item.id)
    if (dbErr) {
      results.push({ id: item.id, slug: item.slug, url: publicUrl, ok: false, error: 'DB update hatası: ' + dbErr.message })
    } else {
      results.push({ id: item.id, slug: item.slug, url: publicUrl, ok: true })
    }
  }

  // 4. Report
  console.log('\n=== Sonuçlar ===')
  results.forEach(r => {
    console.log(`${r.ok ? '✓' : '✗'} ID:${r.id} ${r.slug} ${r.ok ? r.url.slice(-40) : r.error}`)
  })

  const failed = results.filter(r => !r.ok)
  if (failed.length > 0) {
    console.log(`\n⚠️ ${failed.length} dosya başarısız`)
  } else {
    console.log('\n✅ 10/10 başarılı')
  }

  // 5. Verify
  console.log('\n=== DB Doğrulama ===')
  const { data: personas } = await supabase.from('personas').select('id, slug, thumbnail_url').order('id')
  personas?.forEach(p => {
    console.log(`ID:${p.id} ${p.slug} → ${p.thumbnail_url ? '✓ URL var' : '✗ NULL'}`)
  })
}

main().catch(console.error)
