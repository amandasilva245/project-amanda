import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useFinanceStore } from '@/store/financeStore'
import { useAuthStore } from '@/store/authStore'
import { can } from '@/utils/permissions'
import { parseDate } from '@/utils/helpers'
import { CATEGORIES, fmtBRL } from '@/utils/labels'
import styles from './Finance.module.css'

/** Tabela de lançamentos com conciliação (RF21), edição e exclusão. */
export default function TransactionTable({ transactions, onEdit, showProduction = false, emptyText }) {
  const user = useAuthStore((s) => s.user)
  const { setReconciled, deleteTransaction } = useFinanceStore()
  const canWrite = can(user, 'FINANCE_WRITE')
  const canDelete = can(user, 'FINANCE_DELETE')
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const confirmDelete = async () => {
    setBusy(true)
    const result = await deleteTransaction(deleting.id)
    setBusy(false)
    if (result === true) setDeleting(null)
    else setError(result)
  }

  if (!transactions.length) {
    return <p className={styles.empty}>{emptyText ?? 'Nenhum lançamento encontrado.'}</p>
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Descrição</th>
            <th scope="col">Categoria</th>
            <th scope="col">Data</th>
            <th scope="col" className={styles.num}>Valor</th>
            <th scope="col" className={styles.center}>Conciliado</th>
            {(canWrite || canDelete) && <th scope="col"><span className="sr-only">Ações</span></th>}
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id}>
              <td>
                <div className={styles.descCell}>
                  <span className={styles.dot} data-type={tx.type} aria-hidden="true" />
                  <div>
                    <span className={styles.desc}>{tx.description}</span>
                    <span className={styles.sub}>
                      {showProduction && tx.production?.title}
                      {showProduction && tx.reference_code && ' · '}
                      {tx.reference_code && `Ref. ${tx.reference_code}`}
                    </span>
                    {tx.notes && <span className={styles.sub} title={tx.notes}>Obs.: {tx.notes}</span>}
                  </div>
                </div>
              </td>
              <td className={styles.muted}>{CATEGORIES[tx.category] ?? tx.category}</td>
              <td className={styles.muted}>{parseDate(tx.date).toLocaleDateString('pt-BR')}</td>
              <td className={`${styles.num} ${styles.amount}`} data-type={tx.type}>
                {tx.type === 'income' ? '+' : '−'} {fmtBRL(tx.amount)}
              </td>
              <td className={styles.center}>
                <input type="checkbox" className={styles.check} checked={tx.is_reconciled} disabled={!canWrite}
                  aria-label={`Conciliado: ${tx.description}`}
                  onChange={(e) => setReconciled(tx.id, e.target.checked)} />
              </td>
              {(canWrite || canDelete) && (
                <td className={styles.actions}>
                  {canWrite && (
                    <button type="button" className={styles.iconBtn} onClick={() => onEdit?.(tx)}
                      aria-label={`Editar ${tx.description}`} title="Editar">
                      <Pencil size={14} strokeWidth={1.75} />
                    </button>
                  )}
                  {canDelete && (
                    <button type="button" className={`${styles.iconBtn} ${styles.iconDanger}`}
                      onClick={() => { setError(null); setDeleting(tx) }}
                      aria-label={`Excluir ${tx.description}`} title="Excluir">
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDialog
        open={!!deleting}
        title="Excluir lançamento"
        message={deleting ? `Excluir “${deleting.description}” (${fmtBRL(deleting.amount)})? Esta ação não pode ser desfeita.` : ''}
        confirmLabel="Excluir"
        loading={busy}
        error={error}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
