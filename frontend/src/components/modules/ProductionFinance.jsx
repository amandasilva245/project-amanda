import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import FinanceChart from './FinanceChart'
import TransactionTable from './TransactionTable'
import TransactionModal from './TransactionModal'
import api from '@/services/api'
import { useFinanceStore } from '@/store/financeStore'
import { CATEGORIES, fmtBRL } from '@/utils/labels'
import { getErrorMessage } from '@/utils/helpers'
import styles from './Finance.module.css'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const monthLabel = (ym) => { const [y, m] = ym.split('-'); return `${MONTHS[Number(m) - 1]}/${y.slice(2)}` }

/** Aba Financeiro da produção: saldo, % do orçamento e fluxo mensal (RF18, RF19, RF21). */
export default function ProductionFinance({ production }) {
  const { transactions, fetchTransactions } = useFinanceStore()
  const [summary, setSummary] = useState(null)
  const [cashflow, setCashflow] = useState([])
  const [error, setError] = useState(null)
  const [reconciled, setReconciled] = useState('')
  const [modal, setModal] = useState(null)

  const loadTotals = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        api.get(`/api/v1/finance/summary/${production.id}`),
        api.get(`/api/v1/finance/cashflow/${production.id}`),
      ])
      setSummary(s.data)
      setCashflow(c.data.map((r) => ({ ...r, month: monthLabel(r.month) })))
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }, [production.id])

  useEffect(() => {
    const params = { production_id: production.id }
    if (reconciled) params.is_reconciled = reconciled === 'yes'
    fetchTransactions(params)
  }, [production.id, reconciled])

  // Totais acompanham qualquer alteração feita na lista
  useEffect(() => { loadTotals() }, [transactions, loadTotals])

  if (error) return <p className={styles.empty}>{error}</p>

  const pct = summary?.budget_used_pct
  const net = Number(summary?.net_balance ?? 0)

  const cats = (map) => Object.entries(map ?? {}).sort((a, b) => b[1] - a[1])

  return (
    <div className={styles.stack}>
      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Receitas</p>
          <p className={styles.summaryValue} style={{ color: 'var(--success)' }}>{fmtBRL(summary?.total_income ?? 0, 0)}</p>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Despesas</p>
          <p className={styles.summaryValue} style={{ color: 'var(--error)' }}>{fmtBRL(summary?.total_expense ?? 0, 0)}</p>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Saldo líquido</p>
          <p className={styles.summaryValue} style={{ color: net >= 0 ? 'var(--success)' : 'var(--error)' }}>
            {fmtBRL(net, 0)}
          </p>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Orçamento usado</p>
          <p className={styles.summaryValue}>{pct != null ? `${pct.toLocaleString('pt-BR')}%` : '—'}</p>
          {pct != null ? (
            <div className={styles.budgetBar} role="img" aria-label={`${pct}% do orçamento`}>
              <div className={styles.budgetFill} data-over={pct > 100} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          ) : (
            <p className={styles.sub}>Defina o orçamento em “Editar”.</p>
          )}
        </div>
      </div>

      <div className={styles.twoCol}>
        <div className={styles.panel}>
          {cashflow.length ? <FinanceChart data={cashflow} title="Fluxo de caixa mensal" /> : (
            <p className={styles.sub}>O fluxo mensal aparece após o primeiro lançamento.</p>
          )}
        </div>
        <div className={styles.panel}>
          <p className="overline">Despesas por categoria</p>
          <ul className={styles.catList}>
            {cats(summary?.expense_by_category).map(([c, v]) => (
              <li key={c} className={styles.catRow}><span>{CATEGORIES[c] ?? c}</span><span>{fmtBRL(v)}</span></li>
            ))}
            {!cats(summary?.expense_by_category).length && <li className={styles.sub}>Sem despesas.</li>}
          </ul>
          <p className="overline" style={{ marginTop: 'var(--sp-5)' }}>Receitas por categoria</p>
          <ul className={styles.catList}>
            {cats(summary?.income_by_category).map(([c, v]) => (
              <li key={c} className={styles.catRow}><span>{CATEGORIES[c] ?? c}</span><span>{fmtBRL(v)}</span></li>
            ))}
            {!cats(summary?.income_by_category).length && <li className={styles.sub}>Sem receitas.</li>}
          </ul>
        </div>
      </div>

      <div className={styles.sectionHead}>
        <div style={{ minWidth: 200 }}>
          <Select aria-label="Conciliação" value={reconciled} onChange={(e) => setReconciled(e.target.value)}
            placeholder="Todos os lançamentos"
            options={[{ value: 'no', label: 'Pendentes de conciliação' }, { value: 'yes', label: 'Conciliados' }]} />
        </div>
        <Button variant="primary" size="sm" leftIcon={Plus} onClick={() => setModal('new')}>Novo lançamento</Button>
      </div>

      <TransactionTable transactions={transactions} onEdit={(tx) => setModal(tx)}
        emptyText="Nenhum lançamento nesta produção." />

      <TransactionModal
        open={!!modal}
        transaction={modal === 'new' ? null : modal}
        productionId={production.id}
        onClose={() => setModal(null)}
      />
    </div>
  )
}
