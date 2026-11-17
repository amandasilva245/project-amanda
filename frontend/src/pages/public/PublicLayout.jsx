import { Link } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'
import styles from './Public.module.css'

/** Moldura das páginas públicas (sem menu da equipe). */
export default function PublicLayout({ sandbox, children }) {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link to="/ingressos" className={styles.brand}>Curtain</Link>
        <span className={styles.topNote}>Ingressos</span>
      </header>
      {sandbox && (
        <div className={styles.sandbox} role="note">
          <FlaskConical size={16} aria-hidden="true" />
          <span>Ambiente de teste: os pagamentos são simulados no Mercado Pago e nada é cobrado.</span>
        </div>
      )}
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        Os dados do comprador são usados só para emitir e validar o ingresso e ficam guardados por 12 meses.
        O pagamento é feito no Mercado Pago; o Curtain não recebe dados de cartão.
      </footer>
    </div>
  )
}
