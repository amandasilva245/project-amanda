import { clsx } from 'clsx'
import styles from './Badge.module.css'

const STATUS_CONFIG = {
  development:    { label: 'Development',    variant: 'neutral' },
  pre_production: { label: 'Pre-Production', variant: 'iris' },
  rehearsal:      { label: 'Rehearsal',      variant: 'warning' },
  performance:    { label: 'Performance',    variant: 'success' },
  archived:       { label: 'Archived',       variant: 'muted' },
  // transaction types
  income:  { label: 'Income',  variant: 'success' },
  expense: { label: 'Expense', variant: 'error' },
  // ticket
  confirmed: { label: 'Confirmed', variant: 'success' },
  reserved:  { label: 'Reserved',  variant: 'warning' },
  cancelled: { label: 'Cancelled', variant: 'error' },
  used:      { label: 'Used',      variant: 'muted' },
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
