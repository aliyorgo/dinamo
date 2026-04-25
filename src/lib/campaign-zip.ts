import JSZip from 'jszip'

interface ZipProgress {
  phase: 'downloading' | 'compressing' | 'done'
  pct: number
  detail: string
}

export async function downloadCampaignZip(briefId: string, onProgress?: (p: ZipProgress) => void) {
  onProgress?.({ phase: 'downloading', pct: 0, detail: 'Manifest alınıyor...' })

  const res = await fetch(`/api/briefs/${briefId}/campaign-manifest`)
  const manifest = await res.json()
  if (manifest.error) throw new Error(manifest.error)

  const zip = new JSZip()
  const { files, readme, zipName } = manifest
  const skipped: string[] = []

  zip.file('README.txt', readme)

  // Download files
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    const pct = Math.round(((i + 1) / files.length) * 80) // 0-80% for downloads
    onProgress?.({ phase: 'downloading', pct, detail: `${i + 1}/${files.length} indiriliyor` })
    try {
      const r = await fetch(f.url)
      if (!r.ok) { console.warn(`[zip] Skipped (${r.status}): ${f.path}`); skipped.push(f.path); continue }
      const blob = await r.blob()
      zip.file(f.path, blob)
    } catch (e) { console.warn(`[zip] Failed: ${f.path}`); skipped.push(f.path); continue }
  }

  // Add skipped note to README if any
  if (skipped.length > 0) {
    const note = '\n\nEKSIK DOSYALAR (indirilemedi):\n' + skipped.map(s => `- ${s}`).join('\n')
    zip.file('README.txt', readme + note)
  }

  // Compress
  onProgress?.({ phase: 'compressing', pct: 85, detail: 'Sıkıştırılıyor...' })

  const blob = await zip.generateAsync({ type: 'blob' }, (meta) => {
    const pct = 80 + Math.round((meta.percent / 100) * 20) // 80-100% for compression
    onProgress?.({ phase: 'compressing', pct, detail: `Sıkıştırılıyor %${Math.round(meta.percent)}` })
  })

  // Download
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = zipName
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  window.URL.revokeObjectURL(url)

  onProgress?.({ phase: 'done', pct: 100, detail: 'Tamamlandı' })
}
