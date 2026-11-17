/* ═══════════════════════════════════════════════════════════
   Ornamentos Royalcore — SVGs puramente decorativos.
   Todos usam currentColor e aria-hidden, sem impacto em lógica
   ou leitores de tela.
   ═══════════════════════════════════════════════════════════ */

/* Metade direita do arabesco; a esquerda é o espelho */
function FlourishHalf() {
  return (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M126 12c6 0 9-6.5 15.5-5.5 4.6.7 5.2 6.3 1.4 7.3-2.9.8-4.4-1.9-2.6-3.5" strokeWidth="1" />
      <path d="M146 12c7-3.6 14.5-4.4 22-1.4" strokeWidth=".9" />
      <path d="M146 12c7 3.6 14.5 4.4 22 1.4" strokeWidth=".9" opacity=".7" />
      <path d="M168 12c4-2.5 7.5-2.5 10 0-2.5 2.5-6 2.5-10 0z" strokeWidth=".8" />
      <path d="M184 12h52" strokeWidth=".7" opacity=".55" />
      <circle cx="181" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </g>
  )
}

/** Divisória horizontal com arabescos simétricos e flor-de-lis estilizada. */
export function Flourish({ width = 180, className, style }) {
  return (
    <svg
      viewBox="0 0 240 24"
      width={width}
      height={(width * 24) / 240}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <FlourishHalf />
      <g transform="matrix(-1 0 0 1 240 0)">
        <FlourishHalf />
      </g>
      {/* motivo central */}
      <g fill="currentColor">
        <path d="M120 3.5c1.6 2.6 3.6 5.4 3.6 8.5s-2 5.9-3.6 8.5c-1.6-2.6-3.6-5.4-3.6-8.5s2-5.9 3.6-8.5z" />
        <circle cx="113.2" cy="12" r="1.1" />
        <circle cx="126.8" cy="12" r="1.1" />
      </g>
    </svg>
  )
}

/** Brasão do Curtain: arco de proscênio com cortinas de veludo e coroa. */
export function Crest({ size = 36, className, style }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {/* coroa */}
      <g fill="currentColor">
        <path d="M15.2 6.4l1.6-3.1 1.6 2.1L20 1.8l1.6 3.6 1.6-2.1 1.6 3.1z" />
        <rect x="15.2" y="6.6" width="9.6" height="1" rx=".4" />
      </g>
      {/* arco do proscênio */}
      <path
        d="M5 37V19C5 12.4 11.7 9.4 20 9.4S35 12.4 35 19v18"
        fill="none" stroke="currentColor" strokeWidth="1.3"
      />
      <path
        d="M8 37V19.6c0-5 5.3-7.4 12-7.4s12 2.4 12 7.4V37"
        fill="none" stroke="currentColor" strokeWidth=".6" opacity=".6"
      />
      {/* cortinas */}
      <path
        d="M8.6 15.6c2.6 3.6 6.4 5.6 11.4 5.8M31.4 15.6c-2.6 3.6-6.4 5.6-11.4 5.8"
        fill="none" stroke="currentColor" strokeWidth="1"
      />
      <path
        d="M9.4 21v16M12.4 23.6V37M27.6 23.6V37M30.6 21v16"
        fill="none" stroke="currentColor" strokeWidth=".7" opacity=".75"
      />
      {/* palco */}
      <path d="M2.5 37.2h35" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="20" cy="29" r="1.4" fill="currentColor" />
    </svg>
  )
}

/** Losango pequeno — marcador decorativo. */
export function Lozenge({ size = 6, className, style }) {
  return (
    <svg
      viewBox="0 0 10 10"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 0l5 5-5 5-5-5z" fill="currentColor" />
    </svg>
  )
}
