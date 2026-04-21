import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Users, Calendar, MapPin, DollarSign, Plus, Edit } from 'lucide-react'
import { format } from 'date-fns'
import { useProductionStore } from '@/store/productionStore'
import { useAuthStore } from '@/store/authStore'
import { StatusBadge } from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import styles from './ProductionDetail.module.css'

const DEPT_COLORS = {
  cast: 'var(--spotlight)',
  direction: 'var(--iris)',
  technical: 'var(--info)',
  production: 'var(--success)',
  administration: 'var(--text-muted)',
}

const STATUS_FLOW = [
  { key: 'development',    label: 'Development' },
  { key: 'pre_production', label: 'Pre-Production' },
  { key: 'rehearsal',      label: 'Rehearsal' },
  { key: 'performance',    label: 'Performance' },
  { key: 'archived',       label: 'Archived' },
]

export default function ProductionDetail() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const { currentProduction: prod, fetchProductionById, loading } = useProductionStore()

  const [activeTab, setTab] = useState('overview')

  useEffect(() => {
    fetchProductionById(id)
  }, [id])

  if (loading || !prod) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    )
  }

  const currentStep = STATUS_FLOW.findIndex((s) => s.key === prod.status)

  const deptGroups = (prod.participants ?? []).reduce((acc, p) => {
    const dept = p.department
    if (!acc[dept]) acc[dept] = []
    acc[dept].push(p)
    return acc
  }, {})

  const fmtCurrency = (v) =>
    v != null
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
      : '—'

  return (
    <div className={styles.page}>
      {/* Back Nav */}
      <Link to="/productions" className={styles.backLink}>
        <ArrowLeft size={14} strokeWidth={2} />
        All Productions
      </Link>

      {/* Hero */}
      <motion.div
        className={styles.hero}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          className={styles.heroAccent}
          style={{ background: `linear-gradient(135deg, ${prod.color_accent ?? '#DFA843'}22, transparent)` }}
        />
        <div className={styles.heroContent}>
          <div className={styles.heroTop}>
            <StatusBadge status={prod.status} />
            {prod.genre && <span className={styles.heroGenre}>{prod.genre}</span>}
          </div>
          <h1 className={styles.heroTitle}>{prod.title}</h1>
          {prod.playwright && (
            <p className={styles.heroPlaywright}>by {prod.playwright}</p>
          )}
          {prod.synopsis && (
            <p className={styles.heroSynopsis}>{prod.synopsis}</p>
          )}

          <div className={styles.heroMeta}>
            {prod.venue && (
              <span className={styles.metaItem}>
                <MapPin size={13} strokeWidth={1.75} />
                {prod.venue}
              </span>
            )}
            {prod.first_performance_date && (
              <span className={styles.metaItem}>
                <Calendar size={13} strokeWidth={1.75} />
                {format(new Date(prod.first_performance_date), 'MMM d, yyyy')}
              </span>
            )}
            {prod.budget_total && (
              <span className={styles.metaItem}>
                <DollarSign size={13} strokeWidth={1.75} />
                Budget: {fmtCurrency(prod.budget_total)}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Status Pipeline */}
      <div className={styles.pipeline}>
        {STATUS_FLOW.map((step, i) => {
          const isActive   = i === currentStep
          const isPast     = i < currentStep
          const isFuture   = i > currentStep
          return (
            <div key={step.key} className={styles.pipelineStep}>
              <div
                className={`${styles.pipelineDot}
                  ${isActive ? styles.dotActive : ''}
                  ${isPast   ? styles.dotPast   : ''}
                  ${isFuture ? styles.dotFuture : ''}`}
              />
              <span className={`${styles.pipelineLabel} ${isActive ? styles.labelActive : ''}`}>
                {step.label}
              </span>
              {i < STATUS_FLOW.length - 1 && (
                <div className={`${styles.pipelineConnector} ${isPast ? styles.connectorPast : ''}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {['overview', 'cast', 'schedule'].map((t) => (
          <button
            key={t}
            className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div className={styles.overviewGrid}>
          <div className={styles.infoCard}>
            <p className="overline">Details</p>
            <div className={styles.infoRows}>
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Status</span>
                <StatusBadge status={prod.status} />
              </div>
              {prod.start_date && (
                <div className={styles.infoRow}>
                  <span className={styles.infoKey}>Start</span>
                  <span className={styles.infoVal}>{format(new Date(prod.start_date), 'MMM d, yyyy')}</span>
                </div>
              )}
              {prod.end_date && (
                <div className={styles.infoRow}>
                  <span className={styles.infoKey}>End</span>
                  <span className={styles.infoVal}>{format(new Date(prod.end_date), 'MMM d, yyyy')}</span>
                </div>
              )}
              {prod.venue_capacity && (
                <div className={styles.infoRow}>
                  <span className={styles.infoKey}>Capacity</span>
                  <span className={styles.infoVal}>{prod.venue_capacity.toLocaleString()} seats</span>
                </div>
              )}
              {prod.budget_total && (
                <div className={styles.infoRow}>
                  <span className={styles.infoKey}>Budget</span>
                  <span className={styles.infoVal}>{fmtCurrency(prod.budget_total)}</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.castPreview}>
            <p className="overline">Company — {prod.participants?.length ?? 0} members</p>
            <div className={styles.castGrid}>
              {(prod.participants ?? []).slice(0, 8).map((p) => (
                <div key={p.id} className={styles.castItem}>
                  <Avatar name={p.user.full_name} src={p.user.avatar_url} size="sm" />
                  <div className={styles.castInfo}>
                    <span className={styles.castName}>{p.user.full_name}</span>
                    <span className={styles.castRole}>{p.role_title}</span>
                  </div>
                  {p.is_lead && (
                    <span className={styles.leadBadge}>Lead</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cast' && (
        <div className={styles.castDepts}>
          {Object.entries(deptGroups).map(([dept, members]) => (
            <div key={dept} className={styles.deptGroup}>
              <div className={styles.deptHeader}>
                <div
                  className={styles.deptBar}
                  style={{ background: DEPT_COLORS[dept] ?? 'var(--text-muted)' }}
                />
                <p className={styles.deptName}>{dept.charAt(0).toUpperCase() + dept.slice(1)}</p>
                <span className={styles.deptCount}>{members.length}</span>
              </div>
              <div className={styles.memberGrid}>
                {members.map((m) => (
                  <div key={m.id} className={styles.memberCard}>
                    <Avatar name={m.user.full_name} src={m.user.avatar_url} size="md" />
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>{m.user.full_name}</span>
                      <span className={styles.memberRole}>{m.role_title}</span>
                      {m.character_name && (
                        <span className={styles.memberChar}>as {m.character_name}</span>
                      )}
                    </div>
                    {m.is_confirmed && (
                      <span className={styles.confirmedDot} title="Confirmed" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className={styles.scheduleEmpty}>
          <Calendar size={32} strokeWidth={1} style={{ color: 'var(--text-disabled)' }} />
          <p>Schedule coming soon.</p>
        </div>
      )}
    </div>
  )
}
