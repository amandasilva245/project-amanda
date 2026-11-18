import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Theater, Users, DollarSign, Ticket, ArrowRight, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuthStore } from '@/store/authStore'
import { useProductionStore } from '@/store/productionStore'
import StatCard from '@/components/modules/StatCard'
import ProductionTimeline from '@/components/modules/ProductionTimeline'
import { StatusBadge } from '@/components/ui/Badge'
import { AvatarGroup } from '@/components/ui/Avatar'
import { Link } from 'react-router-dom'
import { Flourish } from '@/components/ui/Ornament'
import styles from './Dashboard.module.css'

const fmtCurrency = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

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
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  return (
    <div className={styles.page}>
      {/* Greeting Header */}
      <div className={styles.header}>
        <div>
          <p className="overline">Visão geral</p>
          <h1 className={styles.greeting}>
            {greeting()}, {user?.full_name?.split(' ')[0]}.
          </h1>
          <p className={styles.date}>{format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
          <Flourish width={220} className={styles.headerFlourish} />
        </div>
      </div>

      {/* KPI Strip */}
      <div className={styles.kpiGrid}>
        <StatCard
          label="Produções ativas"
          value={metrics?.active_productions ?? '—'}
          icon={Theater}
          trendLabel="Em pré-produção, ensaio ou em cartaz"
          delay={0}
        />
        <StatCard
          label="Elenco e equipe"
          value={metrics?.total_cast_members ?? '—'}
          icon={Users}
          trendLabel="Pessoas em todas as produções"
          delay={0.05}
        />
        <StatCard
          label="Receita de ingressos"
          value={metrics?.ticket_revenue != null ? fmtCurrency(metrics.ticket_revenue) : '—'}
          icon={DollarSign}
          trendLabel="Ingressos pagos, desde o início"
          delay={0.1}
        />
        <StatCard
          label="Ingressos vendidos"
          value={metrics?.total_tickets_sold ?? '—'}
          icon={Ticket}
          trendLabel="Confirmados e já utilizados"
          delay={0.15}
        />
      </div>

      {/* Timeline Section */}
      {active.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className="overline">Calendário de palco</p>
              <h2 className={styles.sectionTitle}>Produções ativas</h2>
            </div>
            <Link to="/productions" className={styles.seeAll}>
              Ver todas <ArrowRight size={13} strokeWidth={2} />
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
            <p className="overline">Produções</p>
            <h2 className={styles.sectionTitle}>Mais recentes</h2>
          </div>
          <Link to="/productions" className={styles.seeAll}>
            Todas as produções <ArrowRight size={13} strokeWidth={2} />
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
