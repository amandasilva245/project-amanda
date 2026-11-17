import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Search, Plus } from 'lucide-react'
import { useFinanceStore } from '@/store/financeStore'
import { useProductionStore } from '@/store/productionStore'
import { useAuthStore } from '@/store/authStore'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import TransactionTable from '@/components/modules/TransactionTable'
import TransactionModal from '@/components/modules/TransactionModal'
import { can } from '@/utils/permissions'
import { options } from '@/utils/labels'
import styles from './Finance.module.css'
import tx from '@/components/modules/Finance.module.css'

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
  const { productions, fetchProductions } = useProductionStore()
  const user = useAuthStore((s) => s.user)
  const [activeTab, setTab] = useState('overview')
  const [txSearch, setTxSearch] = useState('')
  const [filters, setFilters] = useState({ production_id: '', type: '', category: '', is_reconciled: '' })
  const [modal, setModal] = useState(null)

  useEffect(() => {
    fetchGlobalInsights()
    fetchProductions()
  }, [])

  // RF21: filtros por produção, tipo, categoria e conciliação (aplicados na API)
  useEffect(() => {
    const params = {}
    Object.entries(filters).forEach(([k, v]) => { if (v !== '') params[k] = v })
    fetchTransactions(params)
  }, [filters])

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }))

  const ins = globalInsights
  const netPositive = ins && ins.net_balance >= 0

  const q = txSearch.trim().toLowerCase()
  const filteredTx = transactions.filter((t) =>
    !q ||
    t.description?.toLowerCase().includes(q) ||
    t.reference_code?.toLowerCase().includes(q) ||
    (CATEGORY_LABELS[t.category] ?? t.category).toLowerCase().includes(q)
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className="overline">Negócios</p>
          <h1 className={styles.title}>Financeiro</h1>
        </div>
        {can(user, 'FINANCE_WRITE') && (
          <Button variant="primary" leftIcon={Plus} onClick={() => setModal('new')}>Novo lançamento</Button>
        )}
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
          { key: 'transactions',  label: 'Lançamentos' },
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
          <div className={tx.filters}>
            <Input
              aria-label="Buscar lançamentos"
              placeholder="Buscar por descrição, referência ou categoria…"
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              leftIcon={Search}
              wrapperClass={tx.search}
            />
            <Select aria-label="Produção" placeholder="Todas as produções" value={filters.production_id}
              onChange={setFilter('production_id')} options={productions.map((p) => ({ value: p.id, label: p.title }))} />
            <Select aria-label="Tipo" placeholder="Receitas e despesas" value={filters.type} onChange={setFilter('type')}
              options={[{ value: 'income', label: 'Receitas' }, { value: 'expense', label: 'Despesas' }]} />
            <Select aria-label="Categoria" placeholder="Todas as categorias" value={filters.category}
              onChange={setFilter('category')} options={[...options.income, ...options.expense.filter((o) => o.value !== 'other'), { value: 'other', label: 'Outros' }].filter((o, i, a) => a.findIndex((x) => x.value === o.value) === i)} />
            <Select aria-label="Conciliação" placeholder="Conciliação: todos" value={filters.is_reconciled}
              onChange={setFilter('is_reconciled')}
              options={[{ value: 'false', label: 'Pendentes' }, { value: 'true', label: 'Conciliados' }]} />
          </div>
          <TransactionTable transactions={filteredTx} onEdit={(t) => setModal(t)} showProduction
            emptyText={txSearch ? 'Nenhum lançamento encontrado.' : 'Nenhum lançamento registrado ainda.'} />
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

      <TransactionModal
        open={!!modal}
        transaction={modal === 'new' ? null : modal}
        productions={productions}
        onClose={() => setModal(null)}
      />
    </div>
  )
}
