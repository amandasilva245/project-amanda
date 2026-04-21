import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Theater, Users, DollarSign, Ticket, ArrowRight, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { useAuthStore } from '@/store/authStore'
import { useProductionStore } from '@/store/productionStore'
import StatCard from '@/components/modules/StatCard'
import ProductionTimeline from '@/components/modules/ProductionTimeline'
import { StatusBadge } from '@/components/ui/Badge'
import { AvatarGroup } from '@/components/ui/Avatar'
import { Link } from 'react-router-dom'
import styles from './Dashboard.module.css'

const fmtCurrency = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)

export default function Dashboard() {
  const { user } = useAuthStore()
  const { productions, fetchProductions, metrics, fetchMetrics } = useProductionStore()

  useEffect(() => {
    fetchProductions()
    fetchMetrics()
  }, [])

  const active = productions.filter((p) =>
    ['rehearsal', 'performance', 'pre_production'].includes(p.status)
  )
  const recent = productions.slice(0, 6)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className={styles.page}>
      {/* Greeting Header */}
      <div className={styles.header}>
        <div>
          <p className="overline">Dashboard</p>
          <h1 className={styles.greeting}>
            {greeting()}, {user?.full_name?.split(' ')[0]}.
          </h1>
          <p className={styles.date}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className={styles.kpiGrid}>
        <StatCard
          label="Active Productions"
          value={metrics?.active_productions ?? '—'}
          icon={Theater}
          trend={1}
          trendLabel="2 new this month"
          delay={0}
        />
        <StatCard
          label="Cast & Crew"
          value={metrics?.total_cast_members ?? '—'}
          icon={Users}
          trendLabel="Across all productions"
          delay={0.05}
        />
        <StatCard
          label="Ticket Revenue"
          value={metrics?.ticket_revenue != null ? fmtCurrency(metrics.ticket_revenue) : '—'}
          icon={DollarSign}
          trend={1}
          trendLabel="vs last period"
          delay={0.1}
        />
        <StatCard
          label="Tickets Sold"
          value={metrics?.total_tickets_sold ?? '—'}
          icon={Ticket}
          trendLabel="All time"
          delay={0.15}
        />
      </div>

      {/* Timeline Section */}
      {active.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className="overline">Stage Schedule</p>
              <h2 className={styles.sectionTitle}>Active Productions</h2>
            </div>
            <Link to="/productions" className={styles.seeAll}>
              View all <ArrowRight size={13} strokeWidth={2} />
            </Link>
          </div>
          <div className={styles.timelineCard}>
            <ProductionTimeline productions={active} />
          </div>
        </section>
      )}

      {/* Productions Grid */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className="overline">Productions</p>
            <h2 className={styles.sectionTitle}>Recent Activity</h2>
          </div>
          <Link to="/productions" className={styles.seeAll}>
            All productions <ArrowRight size={13} strokeWidth={2} />
          </Link>
        </div>

        <div className={styles.productionGrid}>
          {recent.map((prod, i) => (
            <motion.div
              key={prod.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link to={`/productions/${prod.id}`} className={styles.prodCard}>
                <div
                  className={styles.prodAccent}
                  style={{ background: prod.color_accent ?? 'var(--spotlight)' }}
                />
                <div className={styles.prodBody}>
                  <div className={styles.prodTop}>
                    <StatusBadge status={prod.status} />
                  </div>
                  <h3 className={styles.prodTitle}>{prod.title}</h3>
                  {prod.playwright && (
                    <p className={styles.prodPlaywright}>{prod.playwright}</p>
                  )}
                  <div className={styles.prodMeta}>
                    {prod.venue && (
                      <span className={styles.prodVenue}>{prod.venue}</span>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}
