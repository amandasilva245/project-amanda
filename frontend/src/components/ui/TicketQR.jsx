import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

/**
 * QR Code do ingresso. O conteúdo é o próprio código (ex.: "K7M2QP9XRT"),
 * então qualquer leitor que "digita" o texto lido funciona no check-in.
 */
export default function TicketQR({ code, size = 132, label }) {
  const { cells, n } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(code)
    qr.make()
    const count = qr.getModuleCount()
    const list = []
    for (let r = 0; r < count; r += 1) {
      for (let c = 0; c < count; c += 1) if (qr.isDark(r, c)) list.push(`M${c} ${r}h1v1h-1z`)
    }
    return { cells: list.join(''), n: count }
  }, [code])

  const quiet = 2
  return (
    <svg role="img" aria-label={label ?? `QR Code do ingresso ${code}`} width={size} height={size}
      viewBox={`${-quiet} ${-quiet} ${n + quiet * 2} ${n + quiet * 2}`} shapeRendering="crispEdges"
      style={{ background: '#F6EEDC', borderRadius: 4, display: 'block' }}>
      <path d={cells} fill="#1E140E" />
    </svg>
  )
}
