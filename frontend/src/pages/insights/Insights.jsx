import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Users, DollarSign } from 'lucide-react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useInsightStore } from '@/store/insightStore'
import StatCard from '@/components/modules/StatCard'
import styles from './Insights.module.css'

export default function Insights() {
  const { metrics, occupancyTrends, fetchMetrics, fetchOccupancyTrends } = useInsightStore()

  useEffect(() => {
    fetchMetrics()
    fetchOccupancyTrends()
  }, [])

  const radarData = [
    { subject: 'Occupancy', value: 82 },
    { subject: 'Revenue',   value: 68 },
    { subject: 'Cast Fill', value: 91 },
    { subject: 'Tickets',   value: 75 },
    { subject: 'Budget',    value: 55 },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className="overline">Analytics</p>
          <h1 className={styles.title}>Insights</h1>
        </div>
      </div>

      <div className={styles.statsRow}>
        <StatCard label="Active Productions" value={metrics?.active_productions ?? '—'} icon={BarChart3} delay={0} />
        <StatCard label="Cast Members"        value={metrics?.total_cast_members ?? '—'}  icon={Users}    delay={0.05} />
        <StatCard label="Ticket Revenue"
          value={metrics?.ticket_revenue != null
            ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(metrics.ticket_revenue)
            : '—'}
          icon={DollarSign}
          delay={0.1}
        />
        <StatCard label="Tickets Sold" value={metrics?.total_tickets_sold ?? '—'} icon={TrendingUp} delay={0.15} />
      </div>

      <div className={styles.chartsGrid}>
        {/* Radar — performance health */}
        <div className={styles.chartCard}>
          <p className="overline" style={{ marginBottom: 'var(--sp-4)' }}>Performance Health</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <Radar name="Score" dataKey="value" stroke="var(--spotlight)" fill="var(--spotlight)" fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Bar — occupancy trend */}
        <div className={styles.chartCard}>
          <p className="overline" style={{ marginBottom: 'var(--sp-4)' }}>Seat Occupancy Trend</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={occupancyTrends.slice(-10)} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{
                  background: 'var(--backdrop)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                }}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar dataKey="occupancy" name="Occupancy %" fill="var(--spotlight)" radius={[3, 3, 0, 0]} opacity={0.75} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Placeholder */}
      <div className={styles.aiCard}>
        <div className={styles.aiIcon}>✦</div>
        <div className={styles.aiContent}>
          <p className={styles.aiTitle}>AI Insights — Coming Soon</p>
          <p className={styles.aiText}>
            Predictive audience analysis, cast scheduling optimization, and automated revenue forecasting
            powered by machine learning. Planned for the next release.
          </p>
        </div>
      </div>
    </div>
  )
}
