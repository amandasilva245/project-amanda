import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Users, DollarSign } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { useInsightStore } from '@/store/insightStore'
import StatCard from '@/components/modules/StatCard'
import { CATEGORIES, fmtBRL } from '@/utils/labels'
import styles from './Insights.module.css'

export default function Insights() {
  const { metrics, occupancyTrends, categoryBreakdown, fetchMetrics, fetchOccupancyTrends, fetchCategoryBreakdown } = useInsightStore()

  useEffect(() => {
    fetchMetrics()
    fetchOccupancyTrends()
    fetchCategoryBreakdown()
  }, [])

  // RF26: receitas e despesas por categoria (dados reais; antes era um radar com valores fixos)
  const categoryData = categoryBreakdown.map((r) => ({ ...r, name: CATEGORIES[r.category] ?? r.category }))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className="overline">Negócios</p>
          <h1 className={styles.title}>Indicadores</h1>
        </div>
      </div>

      <div className={styles.statsRow}>
        <StatCard label="Produções ativas" value={metrics?.active_productions ?? '—'} icon={BarChart3} delay={0} />
        <StatCard label="Pessoas no elenco"        value={metrics?.total_cast_members ?? '—'}  icon={Users}    delay={0.05} />
        <StatCard label="Receita de ingressos"
          value={metrics?.ticket_revenue != null
            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(metrics.ticket_revenue)
            : '—'}
          icon={DollarSign}
          delay={0.1}
        />
        <StatCard label="Ingressos vendidos" value={metrics?.total_tickets_sold ?? '—'} icon={TrendingUp} delay={0.15} />
      </div>

      <div className={styles.chartsGrid}>
        {/* Barras empilhadas — receitas e despesas por categoria */}
        <div className={styles.chartCard}>
          <p className="overline" style={{ marginBottom: 'var(--sp-4)' }}>Receitas e despesas por categoria</p>
          {categoryData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Sem lançamentos ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, categoryData.length * 34)}>
              <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(169,135,74,0.14)" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)} mil` : v)} />
                <YAxis type="category" dataKey="name" width={120} axisLine={false} tickLine={false}
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtBRL(v)}
                  contentStyle={{ background: 'var(--backdrop)', border: '1px solid var(--border-default)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-primary)' }}
                  cursor={{ fill: 'rgba(169,135,74,0.08)' }}
                labelFormatter={(d) => (d && d.length >= 10 ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : d)} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                <Bar dataKey="income" name="Receitas" stackId="a" fill="#9DBE8A" />
                <Bar dataKey="expense" name="Despesas" stackId="a" fill="#C98A93" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar — occupancy trend */}
        <div className={styles.chartCard}>
          <p className="overline" style={{ marginBottom: 'var(--sp-4)' }}>Ocupação por sessão</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={occupancyTrends.slice(-10)} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(169,135,74,0.14)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => (d && d.length >= 10 ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : d)} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{
                  background: 'var(--backdrop)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                }}
                cursor={{ fill: 'rgba(169,135,74,0.08)' }}
              />
              <Bar dataKey="occupancy" name="Ocupação %" fill="var(--spotlight)" radius={[3, 3, 0, 0]} opacity={0.75} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Placeholder */}
      <div className={styles.aiCard}>
        <div className={styles.aiIcon}>✦</div>
        <div className={styles.aiContent}>
          <p className={styles.aiTitle}>Trabalhos futuros · ainda não disponível</p>
          <p className={styles.aiText}>
            Previsão de público, sugestão de escalas de ensaio e projeção de receita com aprendizado
            de máquina estão previstas para uma próxima versão.
          </p>
        </div>
      </div>
    </div>
  )
}
