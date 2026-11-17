import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import styles from './FinanceChart.module.css'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: entry.color }} />
          <span className={styles.tooltipName}>{entry.name}</span>
          <span className={styles.tooltipValue}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function FinanceChart({ data = [], title }) {
  return (
    <div className={styles.wrapper}>
      {title && <p className={styles.title}>{title}</p>}
      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 8, right: 0, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#9DBE8A" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#9DBE8A" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#E07F88" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#E07F88" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              dy={6}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="income"
              name="Income"
              stroke="#9DBE8A"
              strokeWidth={2}
              fill="url(#incomeGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#9DBE8A', strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="expense"
              name="Expense"
              stroke="#E07F88"
              strokeWidth={2}
              fill="url(#expenseGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#E07F88', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
