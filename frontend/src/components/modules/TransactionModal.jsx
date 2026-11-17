import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { Select, Textarea, Checkbox, formStyles as f } from '@/components/ui/Field'
import { useFinanceStore } from '@/store/financeStore'
import { options } from '@/utils/labels'
import styles from './Finance.module.css'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const EMPTY = {
  production_id: '', type: 'expense', category: 'personnel', amount: '', date: '',
  description: '', reference_code: '', notes: '', is_reconciled: false,
}

/** Lançamento de receita/despesa (RF18) com código de referência (TCC §4.2). */
export default function TransactionModal({ open, onClose, transaction, productions = [], productionId }) {
  const saveTransaction = useFinanceStore((s) => s.saveTransaction)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const editing = !!transaction

  useEffect(() => {
    if (!open) return
    setError(null)
    if (transaction) {
      setForm({
        production_id: transaction.production_id, type: transaction.type, category: transaction.category,
        amount: String(transaction.amount), date: transaction.date, description: transaction.description,
        reference_code: transaction.reference_code ?? '', notes: transaction.notes ?? '',
        is_reconciled: transaction.is_reconciled,
      })
    } else {
      setForm({ ...EMPTY, production_id: productionId ?? '', date: today() })
    }
  }, [open, transaction, productionId])

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((s) => {
      const next = { ...s, [key]: value }
      // Ao trocar o tipo, a categoria passa para a primeira válida
      if (key === 'type') next.category = value === 'income' ? 'ticket_sales' : 'personnel'
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.production_id) { setError('Escolha a produção.'); return }
    if (!form.description.trim()) { setError('Descreva o lançamento.'); return }
    if (!(Number(form.amount) > 0)) { setError('O valor deve ser maior que zero.'); return }
    if (!form.date) { setError('Informe a data.'); return }

    const data = editing
      ? {
          category: form.category, amount: form.amount, date: form.date, description: form.description.trim(),
          reference_code: form.reference_code, notes: form.notes, is_reconciled: form.is_reconciled,
        }
      : { ...form, description: form.description.trim() }

    setSaving(true)
    const result = await saveTransaction(transaction?.id, data)
    setSaving(false)
    if (result === true) onClose()
    else setError(result)
  }

  const categoryOptions = form.type === 'income' ? options.income : options.expense

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar lançamento' : 'Novo lançamento'} size="md">
      <form onSubmit={handleSubmit} className={f.form} noValidate>
        {!editing && (
          <div className={styles.typeSwitch} role="radiogroup" aria-label="Tipo de lançamento">
            {[['expense', 'Despesa'], ['income', 'Receita']].map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={form.type === value}
                className={`${styles.typeBtn} ${form.type === value ? styles[`type_${value}`] : ''}`}
                onClick={() => set('type')({ target: { value } })}>
                {label}
              </button>
            ))}
          </div>
        )}
        {!editing && !productionId && (
          <Select label="Produção *" placeholder="Selecione" value={form.production_id} onChange={set('production_id')}
            options={productions.map((p) => ({ value: p.id, label: p.title }))} />
        )}
        <Input label="Descrição *" placeholder="ex: Aluguel do teatro — maio" value={form.description}
          onChange={set('description')} autoFocus />
        <div className={f.row}>
          <Select label="Categoria" options={categoryOptions} value={form.category} onChange={set('category')} />
          <Input label="Valor (R$) *" type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} />
        </div>
        <div className={f.row}>
          <Input label="Data *" type="date" value={form.date} onChange={set('date')} />
          <Input label="Código de referência" placeholder="NF, recibo, contrato…" value={form.reference_code}
            onChange={set('reference_code')} />
        </div>
        <Textarea label="Observações" rows={2} value={form.notes} onChange={set('notes')} />
        <Checkbox label="Conciliado (conferido no extrato)" checked={form.is_reconciled} onChange={set('is_reconciled')} />

        {error && <p className={f.error} role="alert">{error}</p>}

        <div className={f.actions}>
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" loading={saving}>{editing ? 'Salvar' : 'Lançar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
