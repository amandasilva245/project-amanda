import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, CalendarClock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Avatar from '@/components/ui/Avatar'
import { Select, Textarea, Checkbox, formStyles as f } from '@/components/ui/Field'
import { useWorkStore } from '@/store/workStore'
import { useAuthStore } from '@/store/authStore'
import useProductionPeople from '@/hooks/useProductionPeople'
import { can } from '@/utils/permissions'
import { TASK_PRIORITY, TASK_STATUS, fmtDay, options } from '@/utils/labels'
import styles from './Work.module.css'

const EMPTY = { production_id: '', title: '', description: '', assignee_id: '', due_date: '', status: 'todo', priority: 'medium' }
const COLUMNS = ['todo', 'in_progress', 'done']

function TaskModal({ open, onClose, task, productions, productionId }) {
  const saveTask = useWorkStore((s) => s.saveTask)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const people = useProductionPeople(open ? form.production_id : null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(task ? {
      production_id: task.production_id, title: task.title, description: task.description ?? '',
      assignee_id: task.assignee?.id ?? '', due_date: task.due_date ?? '', status: task.status, priority: task.priority,
    } : { ...EMPTY, production_id: productionId ?? '' })
  }, [open, task, productionId])

  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.production_id) return setError('Escolha a produção.')
    if (form.title.trim().length < 2) return setError('Dê um título à tarefa.')
    const data = {
      title: form.title.trim(), description: form.description || null, assignee_id: form.assignee_id || null,
      due_date: form.due_date || null, status: form.status, priority: form.priority,
    }
    if (!task) data.production_id = form.production_id
    setSaving(true)
    const ok = await saveTask(task?.id, data)
    setSaving(false)
    if (ok === true) onClose(); else setError(ok)
  }

  return (
    <Modal open={open} onClose={onClose} title={task ? 'Editar tarefa' : 'Nova tarefa'}
      description="Quem faz o quê e até quando.">
      <form className={f.form} onSubmit={submit} noValidate>
        {!productionId && (
          <Select label="Produção *" placeholder="Selecione" disabled={!!task}
            options={productions.map((p) => ({ value: p.id, label: p.title }))}
            value={form.production_id} onChange={set('production_id')} />
        )}
        <Input label="Tarefa *" placeholder="ex: Fechar orçamento de iluminação" value={form.title} onChange={set('title')} autoFocus />
        <Textarea label="Detalhes" rows={2} value={form.description} onChange={set('description')} />
        <div className={f.row}>
          <Select label="Responsável" placeholder={people.length ? 'Ninguém' : 'Sem participantes nesta produção'}
            options={people} value={form.assignee_id} onChange={set('assignee_id')} />
          <Input label="Prazo" type="date" value={form.due_date} onChange={set('due_date')} />
        </div>
        <div className={f.row}>
          <Select label="Andamento" options={options.taskStatus} value={form.status} onChange={set('status')} />
          <Select label="Prioridade" options={options.taskPriority} value={form.priority} onChange={set('priority')} />
        </div>
        {error && <p className={f.error} role="alert">{error}</p>}
        <div className={f.actions}>
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" loading={saving}>{task ? 'Salvar' : 'Criar tarefa'}</Button>
        </div>
      </form>
    </Modal>
  )
}

/** Quadro de tarefas em três colunas. productionId fixa a produção (aba da produção). */
export default function TaskPanel({ productionId, productions = [] }) {
  const user = useAuthStore((s) => s.user)
  const { tasks, loading, error, fetchTasks, setTaskStatus, deleteTask } = useWorkStore()
  const [filters, setFilters] = useState({ production_id: '', mine: false })
  const [modal, setModal] = useState(null)
  const [removing, setRemoving] = useState(null)
  const canWrite = can(user, 'TASK_WRITE')

  useEffect(() => {
    fetchTasks({ production_id: productionId ?? filters.production_id, mine: filters.mine || '' })
  }, [productionId, filters])

  const byStatus = useMemo(() => {
    const g = { todo: [], in_progress: [], done: [] }
    tasks.forEach((t) => g[t.status].push(t))
    return g
  }, [tasks])
  const overdue = tasks.filter((t) => t.overdue).length

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        {!productionId && (
          <Select aria-label="Produção" placeholder="Todas as produções" value={filters.production_id}
            options={productions.map((p) => ({ value: p.id, label: p.title }))}
            onChange={(e) => setFilters((s) => ({ ...s, production_id: e.target.value }))} />
        )}
        <Checkbox label="Só as minhas" checked={filters.mine}
          onChange={(e) => setFilters((s) => ({ ...s, mine: e.target.checked }))} />
        {overdue > 0 && (
          <span className={styles.overdueNote}><AlertTriangle size={14} aria-hidden="true" /> {overdue} atrasada{overdue > 1 ? 's' : ''}</span>
        )}
        <span className={styles.spacer} />
        {canWrite && <Button variant="primary" leftIcon={Plus} onClick={() => setModal('new')}>Nova tarefa</Button>}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {!loading && tasks.length === 0 && <p className={styles.empty}>Nenhuma tarefa por aqui.</p>}

      {tasks.length > 0 && (
        <div className={styles.board}>
          {COLUMNS.map((col) => (
            <section key={col} className={styles.column} aria-label={TASK_STATUS[col]}>
              <h3 className={styles.columnTitle}>{TASK_STATUS[col]} <span>{byStatus[col].length}</span></h3>
              <ul className={styles.cards}>
                {byStatus[col].map((t) => {
                  const mine = t.assignee?.id === user?.id
                  return (
                    <li key={t.id} className={`${styles.card} ${t.overdue ? styles.cardLate : ''}`}>
                      <div className={styles.cardTop}>
                        <span className={`${styles.priority} ${styles['p_' + t.priority]}`}>{TASK_PRIORITY[t.priority]}</span>
                        {canWrite && (
                          <span className={styles.cardActions}>
                            <Button size="sm" variant="ghost" leftIcon={Pencil} aria-label={`Editar ${t.title}`} onClick={() => setModal(t)} />
                            <Button size="sm" variant="ghost" leftIcon={Trash2} aria-label={`Excluir ${t.title}`} onClick={() => setRemoving(t)} />
                          </span>
                        )}
                      </div>
                      <p className={styles.cardTitle}>
                        {t.status === 'done' && <CheckCircle2 size={14} aria-hidden="true" />} {t.title}
                      </p>
                      {!productionId && <p className={styles.sub}>{t.production_title}</p>}
                      <div className={styles.cardMeta}>
                        {t.assignee ? (
                          <span className={styles.assignee}><Avatar name={t.assignee.full_name} size="xs" /> {t.assignee.full_name}</span>
                        ) : <span className={styles.sub}>Sem responsável</span>}
                        {t.due_date && (
                          <span className={t.overdue ? styles.late : styles.sub}>
                            <CalendarClock size={13} aria-hidden="true" /> {fmtDay(t.due_date)}
                          </span>
                        )}
                      </div>
                      {(canWrite || mine) && (
                        <Select aria-label={`Andamento de ${t.title}`} options={options.taskStatus} value={t.status}
                          onChange={(e) => setTaskStatus(t.id, e.target.value)} className={styles.statusSelect} />
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <TaskModal open={!!modal} onClose={() => setModal(null)} task={modal === 'new' ? null : modal}
        productions={productions} productionId={productionId} />
      <ConfirmDialog open={!!removing} title="Excluir tarefa" confirmLabel="Excluir"
        message={removing ? `Excluir a tarefa “${removing.title}”?` : ''} onClose={() => setRemoving(null)}
        onConfirm={async () => { await deleteTask(removing.id); setRemoving(null) }} />
    </div>
  )
}
