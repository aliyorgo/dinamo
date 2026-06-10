// Tek ortak status nokta component'i.
// Bu projede globals.css'te `*, *::before, *::after { border-radius: 0 !important }`
// global reset'i var; inline borderRadius bunu YENEMEZ. Bu yüzden yuvarlaklık
// whitelist'teki `.round` class'ından gelir (border-radius: 9999px !important).
// flexShrink:0 + minWidth/minHeight ise inline-flex içinde ezilip elips olmayı
// fiziksel olarak imkansız kılar. İki neden de burada köklü kapatılıyor.
export default function StatusDot({ color = '#1db81d', size = 8, pulse = false }: { color?: string; size?: number; pulse?: boolean }) {
  return (
    <span
      aria-hidden
      className="round"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        flexShrink: 0,
        borderRadius: '9999px',
        backgroundColor: color,
        verticalAlign: 'middle',
        animation: pulse ? 'pulse 1.5s ease infinite' : undefined,
      }}
    />
  )
}
