import { clsx } from 'clsx'
import styles from './Badge.module.css'

const STATUS_CONFIG = {
  development:    { label: 'Desenvolvimento', variant: 'neutral' },
  pre_production: { label: 'Pré-produção',    variant: 'iris' },
  rehearsal:      { label: 'Ensaios',         variant: 'warning' },
  performance:    { label: 'Em cartaz',       variant: 'success' },
  archived:       { label: 'Arquivada',       variant: 'muted' },
  // transações
  income:  { label: 'Receita', variant: 'success' },
  expense: { label: 'Despesa', variant: 'error' },
  // ingressos
  confirmed: { label: 'Confirmado', variant: 'success' },
  reserved:  { label: 'Reservado',  variant: 'warning' },
  cancelled: { label: 'Cancelado',  variant: 'error' },
  used:      { label: 'Utilizado',  variant: 'muted' },
  // lotes
  on_sale:   { label: 'À venda',    variant: 'success' },
  sold_out:  { label: 'Esgotado',   variant: 'warning' },
  completed: { label: 'Concluído',  variant: 'muted' },
  // presença na agenda
  invited:   { label: 'Convidado',  variant: 'neutral' },
  absent:    { label: 'Ausente',    variant: 'error' },
}

export function StatusBadge({ status, className }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'neutral' }
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}

export default function Badge({ variant = 'neutral', dot = false, className, children }) {
  return (
    <span className={clsx(styles.badge, styles[variant], dot && styles.withDot, className)}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  )
}
