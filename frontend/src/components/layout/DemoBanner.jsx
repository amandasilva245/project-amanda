import { FlaskConical } from 'lucide-react'
import { useSystemMode } from '@/hooks/useSystemMode'
import styles from './DemoBanner.module.css'

/** Faixa fixa que deixa claro que o ambiente usa somente dados fictícios. */
export default function DemoBanner() {
  const { demo } = useSystemMode()
  if (!demo) return null
  return (
    <div className={styles.banner} role="note">
      <FlaskConical size={13} strokeWidth={1.75} aria-hidden="true" />
      <span><strong>Ambiente de demonstração</strong> · dados fictícios, nenhum pagamento real</span>
    </div>
  )
}
