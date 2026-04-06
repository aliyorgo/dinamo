import { jsPDF } from 'jspdf'
import { ROBOTO_REGULAR } from './roboto-font'

export function generateCertificatePDF(brief: any, companyName: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Register Roboto font for Turkish character support
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold')

  const pw = doc.internal.pageSize.getWidth()
  const margin = 25
  const contentW = pw - margin * 2
  let y = 30

  // Title
  doc.setTextColor(0, 0, 0)
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(16)
  doc.text('İÇERİK LİSANS VE TELİF HAKKI SERTİFİKASI', pw / 2, y, { align: 'center' })
  y += 8
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(11)
  doc.text('Dinamo — DCC Film Yapım San. ve Tic. Ltd. Şti.', pw / 2, y, { align: 'center' })
  y += 14

  // Line
  doc.setDrawColor(200)
  doc.line(margin, y, pw - margin, y)
  y += 10

  // Info
  doc.setFontSize(11)
  const deliverDate = new Date(brief.updated_at || brief.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  const info: [string, string][] = [
    ['Kampanya:', brief.campaign_name || ''],
    ['Müşteri:', companyName || ''],
    ['Teslim Tarihi:', deliverDate],
    ['Referans No:', (brief.id || '').substring(0, 8).toUpperCase()],
  ]
  info.forEach(([label, value]) => {
    doc.setTextColor(0, 0, 0)
    doc.setFont('Roboto', 'bold')
    doc.text(label, margin, y)
    doc.setFont('Roboto', 'normal')
    doc.text(value, margin + 35, y)
    y += 6
  })
  y += 8

  // Sections
  const sections: [string, string][] = [
    ['1. Görsel İçerik', 'Bu projede kullanılan tüm görsel içerikler (AI üretimi ve stok görseller) ticari kullanım lisansı kapsamındadır. İçerikler müşteri adı altında sınırlamasız kullanılabilir.'],
    ['2. Müzik ve Ses', 'Projede kullanılan tüm müzik ve ses efektleri royalty-free lisanslıdır. Dijital ve sosyal medya platformlarında ticari kullanım hakları dahildir.'],
    ['3. Yapay Zeka Kullanımı', 'Bu içerik Dinamo AI altyapısı kullanılarak üretilmiştir. Tüm AI üretim süreçleri ticari lisans kapsamındadır. Oluşabilecek telif talepleri DCC Film tarafından karşılanır.'],
    ['4. Seslendirme', brief.voiceover_type === 'real' ? 'Bu projede profesyonel seslendirme sanatçısı kullanılmıştır. Seslendirme hakları proje kapsamında devredilmiştir.' : brief.voiceover_type === 'ai' ? 'Bu projede AI seslendirme teknolojisi kullanılmıştır. AI seslendirme ticari kullanım lisansı dahilindedir.' : 'Bu projede seslendirme kullanılmamıştır.'],
    ['5. Kullanım Hakkı', 'Müşteri, teslim edilen içeriği tüm dijital platformlarda (sosyal medya, web sitesi, dijital reklam) süresiz olarak kullanabilir. Broadcast (TV, sinema) kullanımı için ayrıca mutabakat gereklidir.'],
    ['6. Sorumluluk', 'DCC Film, teslim edilen içeriğin telif hakları konusunda tam sorumluluk üstlenir. Üçüncü taraflardan gelebilecek telif taleplerine karşı müşteriyi savunmayı ve oluşabilecek maliyetleri karşılamayı taahhüt eder.'],
  ]

  sections.forEach(([title, body]) => {
    if (y > 260) { doc.addPage(); y = 25 }
    doc.setTextColor(0, 0, 0)
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(11)
    doc.text(title, margin, y)
    y += 6
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(11)
    const lines = doc.splitTextToSize(body, contentW)
    doc.text(lines, margin, y)
    y += lines.length * 5 + 6
  })

  // Footer
  if (y > 250) { doc.addPage(); y = 25 }
  y += 10
  doc.setDrawColor(200)
  doc.line(margin, y, pw - margin, y)
  y += 8
  doc.setTextColor(0, 0, 0)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.text('Bu belge Dinamo platformu üzerinden otomatik oluşturulmuştur.', pw / 2, y, { align: 'center' })
  y += 4
  doc.text('DCC Film Yapım San. ve Tic. Ltd. Şti. — dinamo.media', pw / 2, y, { align: 'center' })

  const client = (companyName || 'client').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const campaign = (brief.campaign_name || 'brief').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  doc.save(`dinamo_telif_${client}_${campaign}.pdf`)
}
