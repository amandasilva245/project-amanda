import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Search } from 'lucide-react'
import { useFinanceStore } from '@/store/financeStore'
import Input from '@/components/ui/Input'
import styles from './Finance.module.css'

const fmtCurrency = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v ?? 0)

const CATEGORY_LABELS = {
  ticket_sales: 'Bilheteria', sponsorship: 'Patrocínio', grant: 'Editais',
  donation: 'Doação', merchandise: 'Merchandising',
  personnel: 'Pessoal', venue: 'Espaço', marketing: 'Marketing',
  costumes: 'Figurino', sets: 'Cenografia', equipment: 'Equipamentos',
  administration: 'Administração', other: 'Outros',
}

export default function Finance() {
  const { globalInsights, transactions, fetchGlobalInsights, fetchTransactions } = useFinanceStore()
  const [activeTab, setTab] = useState('overview')
  const [txSearch, setTxSearch] = useState('')

  useEffect(() => {
    fetchGlobalInsights()
    fetchTransactions()
  }, [])

  const ins = globalInsights
  const netPositive = ins && ins.net_balance >= 0

  const filteredTx = transactions.filter((tx) =>
    !txSearch ||
    tx.description?.toLowerCase().includes(txSearch.toLowerCase()) ||
    (CATEGORY_LABELS[tx.category] ?? tx.category).toLowerCase().includes(txSearch.toLowerCase())
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className="overline">Negócios</p>
          <h1 className={styles.title}>Financeiro</h1>
        </div>
      </div>

      {/* Metric Strip */}
      {ins && (
        <div className={styles.metrics}>
          {[
            { label: 'Total de Receitas', value: fmtCurrency(ins.total_income),  color: 'var(--success)', icon: TrendingUp  },
            { label: 'Total de Despesas', value: fmtCurrency(ins.total_expense), color: 'var(--error)',   icon: TrendingDown },
            { label: 'Saldo Líquido',     value: fmtCurrency(ins.net_balance),   color: netPositive ? 'var(--success)' : 'var(--error)' },
          ].map(({ label, value, color, icon: Icon }, i) => (
            <motion.div
              key={label}
              className={styles.metricCard}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className={styles.metricLabel}>{label}</p>
              <p className={styles.metricValue} style={{ color }}>{value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        {[
          { key: 'overview',      label: 'Visão Geral' },
          { key: 'transactions',  label: 'Transações' },
          { key: 'productions',   label: 'Produções' },
        ].map((t) => (
          <button
            key={t.key}
            className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && ins && (
        <div className={styles.overviewLayout}>
          <div className={styles.topProds}>
            <p className="overline" style={{ marginBottom: 'var(--sp-4)' }}>Maiores Receitas — Produções</p>
            <div className={styles.prodsList}>
              {(ins.top_productions ?? []).map((prod, i) => {
                const pct = ins.total_income > 0 ? (prod.revenue / ins.total_income) * 100 : 0
                return (
                  <div key={prod.id} className={styles.prodRow}>
                    <span className={styles.prodRank}>{i + 1}</span>
                    <div className={styles.prodInfo}>
                      <span className={styles.prodName}>{prod.title}</span>
                      <div className={styles.prodBarWrap}>
                        <motion.div
                          className={styles.prodBar}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.1 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                    </div>
                    <span className={styles.prodRevenue}>{fmtCurrency(prod.revenue)}</span>
                  </div>
                )
              })}
              {(ins.top_productions ?? []).length === 0 && (
                <p className={styles.txEmpty}>Nenhum dado financeiro por produção ainda.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className={styles.txSection}>
          <Input
            placeholder="Buscar por descrição ou categoria…"
            value={txSearch}
            onChange={(e) => setTxSearch(e.target.value)}
            leftIcon={Search}
            wrapperClass={styles.txSearch}
          />
          <div className={styles.txList}>
            <div className={styles.txHeader}>
              <span>Descrição</span>
              <span>Categoria</span>
              <span>Data</span>
              <span>Valor</span>
            </div>
            {filteredTx.map((tx) => (
              <motion.div
                key={tx.id}
                className={styles.txRow}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className={styles.txDesc}>
                  <span
                    className={styles.txTypeDot}
                    style={{ background: tx.type === 'income' ? 'var(--success)' : 'var(--error)' }}
                  />
                  <span className={styles.txDescText}>{tx.description}</span>
                </div>
                <span className={styles.txCat}>{CATEGORY_LABELS[tx.category] ?? tx.category}</span>
                <span className={styles.txDate}>
                  {new Date(tx.date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span
                  className={styles.txAmount}
                  style={{ color: tx.type === 'income' ? 'var(--success)' : 'var(--error)' }}
                >
                  {tx.type === 'income' ? '+' : '-'}{fmtCurrency(Math.abs(tx.amount))}
                </span>
              </motion.div>
            ))}
            {filteredTx.length === 0 && (
              <div className={styles.txEmpty}>
                {txSearch ? 'Nenhuma transação encontrada.' : 'Nenhuma transação registrada ainda.'}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'productions' && (
        <div className={styles.prodRevGrid}>
          {(ins?.top_productions ?? []).map((prod) => (
            <div key={prod.id} className={styles.prodRevCard}>
              <p className={styles.prodRevName}>{prod.title}</p>
              <p className={styles.prodRevAmount}>{fmtCurrency(prod.revenue)}</p>
            </div>
          ))}
          {(ins?.top_productions ?? []).length === 0 && (
            <div className={styles.txEmpty} style={{ gridColumn: '1 / -1', padding: 'var(--sp-12)' }}>
              Nenhum dado financeiro por produção ainda.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
