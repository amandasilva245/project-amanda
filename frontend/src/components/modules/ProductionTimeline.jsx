import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { format, differenceInDays, isAfter, isBefore } from 'date-fns'
import styles from './ProductionTimeline.module.css'

const PHASES = [
  { key: 'development',    label: 'Dev',    color: 'var(--text-muted)' },
  { key: 'pre_production', label: 'Pre',    color: 'var(--iris)' },
  { key: 'rehearsal',      label: 'Rehearsal', color: 'var(--warning)' },
  { key: 'performance',    label: 'Live',   color: 'var(--success)' },
  { key: 'archived',       label: 'Archive',color: 'var(--scrim)' },
]

const STATUS_ORDER = PHASES.map((p) => p.key)

function PhaseBar({ production, totalDays, timelineStart }) {
  const start = production.start_date ? new Date(production.start_date) : null
  const end   = production.end_date   ? new Date(production.end_date)   : null

  if (!start || !end) return null

  const leftPct  = Math.max(0, differenceInDays(start, timelineStart) / totalDays) * 100
  const widthPct = Math.max(1, differenceInDays(end, start) / totalDays) * 100
  const phase    = PHASES.find((p) => p.key === production.status) ?? PHASES[0]

  return (
    <motion.div
      className={styles.bar}
      style={{
        left:  `${leftPct}%`,
        width: `${Math.min(widthPct, 100 - leftPct)}%`,
        background: phase.color,
      }}
      initial={{ scaleX: 0, originX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      title={`${production.title}: ${format(start, 'MMM d')} → ${format(end, 'MMM d')}`}
    />
  )
}

export default function ProductionTimeline({ productions = [] }) {
  const { timelineStart, totalDays, months } = useMemo(() => {
    const dates = productions.flatMap((p) => [
      p.start_date && new Date(p.start_date),
      p.end_date   && new Date(p.end_date),
    ]).filter(Boolean)

    if (!dates.length) {
      const now = new Date()
      return { timelineStart: now, totalDays: 180, months: [] }
    }

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

    // Pad by 14 days each side
    const start = new Date(minDate)
    start.setDate(start.getDate() - 14)
    const end = new Date(maxDate)
    end.setDate(end.getDate() + 14)

    const total = differenceInDays(end, start) || 1

    // Build month markers
    const monthMarkers = []
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    while (isBefore(cursor, end)) {
      const pct = Math.max(0, differenceInDays(cursor, start) / total) * 100
      monthMarkers.push({ label: format(cursor, 'MMM'), pct })
      cursor.setMonth(cursor.getMonth() + 1)
    }

    return { timelineStart: start, totalDays: total, months: monthMarkers }
  }, [productions])

  if (!productions.length) return null

  return (
    <div className={styles.wrapper}>
      {/* Month axis */}
      <div className={styles.axis}>
        {months.map((m) => (
          <span key={m.label + m.pct} className={styles.monthLabel} style={{ left: `${m.pct}%` }}>
            {m.label}
          </span>
        ))}
      </div>

      {/* Lanes */}
      <div className={styles.lanes}>
        {productions.map((prod) => (
          <div key={prod.id} className={styles.lane}>
            <span className={styles.laneLabel} title={prod.title}>{prod.title}</span>
            <div className={styles.track}>
              <PhaseBar production={prod} totalDays={totalDays} timelineStart={timelineStart} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
