import JSZip from 'jszip'

export async function downloadCampaignZip(briefId: string, onProgress?: (pct: number) => void) {
  const res = await fetch(`/api/briefs/${briefId}/campaign-manifest`)
  const manifest = await res.json()
  if (manifest.error) throw new Error(manifest.error)

  const zip = new JSZip()
  const { files, readme, zipName } = manifest

  // Add README
  zip.file('README.txt', readme)

  // Download and add each file
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    try {
      const r = await fetch(f.url)
      if (!r.ok) continue
      const blob = await r.blob()
      zip.file(f.path, blob)
    } catch { continue }
    onProgress?.(Math.round(((i + 1) / files.length) * 100))
  }

  // Generate and download
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = zipName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
