import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import styles from './StatCard.module.css'

export default function StatCard({ label, value, subvalue, trend, trendLabel, icon: Icon, accent, delay = 0 }) {
  const trendPositive = trend > 0
  const trendNeutral  = trend === 0 || trend == null
  const TrendIcon = trendNeutral ? Minus : trendPositive ? TrendingUp : TrendingDown

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {Icon && (
          <div className={styles.iconWrap} style={accent ? { '--accent': accent } : {}}>
            <Icon size={15} strokeWidth={1.75} />
          </div>
        )}
      </div>

      <div className={styles.valueRow}>
        <span className={styles.value}>{value}</span>
        {subvalue && <span className={styles.subvalue}>{subvalue}</span>}
      </div>

      {trendLabel && (
        <div className={`${styles.trend} ${trendPositive ? styles.up : trendNeutral ? styles.neutral : styles.down}`}>
          <TrendIcon size={12} strokeWidth={2} />
          <span>{trendLabel}</span>
        </div>
      )}
    </motion.div>
  )
}
