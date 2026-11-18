import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Shirt, Castle, Lightbulb, Drama, Package } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Select, Textarea, formStyles as f } from '@/components/ui/Field'
import { useWorkStore } from '@/store/workStore'
import { useAuthStore } from '@/store/authStore'
import useProductionPeople from '@/hooks/useProductionPeople'
import { can } from '@/utils/permissions'
import { RESOURCE_STATUS, RESOURCE_TYPES, fmtBRL, options } from '@/utils/labels'
import styles from './Work.module.css'

export const TYPE_ICONS = { costume: Shirt, set: Castle, equipment: Lightbulb, prop: Drama, other: Package }
const STATUS_VARIANT = { planned: 'neutral', in_progress: 'warning', available: 'success', in_use: 'iris', maintenance: 'error' }

const EMPTY = { production_id: '', name: '', type: 'costume', status: 'planned', quantity: '1', unit_cost: '',
  supplier: '', location: '', responsible_id: '', notes: '' }

function ResourceModal({ open, onClose, resource, productions, productionId }) {
  const saveResource = useWorkStore((s) => s.saveResource)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const people = useProductionPeople(open ? form.production_id : null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (resource) {
      setForm({
        ...EMPTY, ...Object.fromEntries(Object.entries(resource).map(([k, v]) => [k, v == null ? '' : String(v)])),
        responsible_id: resource.responsible?.id ?? '',
      })
    } else {
      setForm({ ...EMPTY, production_id: productionId ?? '' })
    }
  }, [open, resource, productionId])

  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.production_id) return setError('Escolha a produção.')
    if (form.name.trim().length < 2) return setError('Informe o nome do recurso.')
    if (!(Number(form.quantity) >= 1)) return setError('A quantidade deve ser pelo menos 1.')
    if (form.unit_cost !== '' && Number(form.unit_cost) < 0) return setError('O custo não pode ser negativo.')
    const data = {
      name: form.name.trim(), type: form.type, status: form.status, quantity: Number(form.quantity),
      unit_cost: form.unit_cost === '' ? null : form.unit_cost, supplier: form.supplier || null,
      location: form.location || null, responsible_id: form.responsible_id || null, notes: form.notes || null,
    }
    if (!resource) data.production_id = form.production_id
    setSaving(true)
    const ok = await saveResource(resource?.id, data)
    setSaving(false)
    if (ok === true) onClose(); else setError(ok)
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={resource ? 'Editar recurso' : 'Novo recurso'}
      description="Figurinos, cenários, equipamentos e objetos de cena da produção.">
      <form className={f.form} onSubmit={submit} noValidate>
        {!productionId && (
          <Select label="Produção *" placeholder="Selecione" disabled={!!resource}
            options={productions.map((p) => ({ value: p.id, label: p.title }))}
            value={form.production_id} onChange={set('production_id')} />
        )}
        <Input label="Nome *" placeholder="ex: Capa de veludo do Rei" value={form.name} onChange={set('name')} autoFocus />
        <div className={f.row3}>
          <Select label="Tipo" options={options.resourceTypes} value={form.type} onChange={set('type')} />
          <Select label="Situação" options={options.resourceStatus} value={form.status} onChange={set('status')} />
          <Input label="Quantidade" type="number" min="1" value={form.quantity} onChange={set('quantity')} />
        </div>
        <div className={f.row3}>
          <Input label="Custo unitário (R$)" type="number" min="0" step="0.01" value={form.unit_cost} onChange={set('unit_cost')} />
          <Input label="Fornecedor / ateliê" value={form.supplier} onChange={set('supplier')} />
          <Input label="Onde está guardado" value={form.location} onChange={set('location')} />
        </div>
        <Select label="Responsável" placeholder={people.length ? 'Ninguém' : 'Sem participantes nesta produção'}
          options={people} value={form.responsible_id} onChange={set('responsible_id')} />
        <Textarea label="Observações" rows={2} value={form.notes} onChange={set('notes')} />
        {error && <p className={f.error} role="alert">{error}</p>}
        <div className={f.actions}>
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" loading={saving}>{resource ? 'Salvar' : 'Adicionar recurso'}</Button>
        </div>
      </form>
    </Modal>
  )
}

/** Lista de recursos com filtros, totais por tipo e cadastro. productionId fixa a produção (aba). */
export default function ResourcePanel({ productionId, productions = [] }) {
  const user = useAuthStore((s) => s.user)
  const { resources, loading, error, fetchResources, deleteResource } = useWorkStore()
  const [filters, setFilters] = useState({ production_id: productionId ?? '', type: '', status: '', search: '' })
  const [modal, setModal] = useState(null) // null | 'new' | recurso
  const [removing, setRemoving] = useState(null)
  const [removeError, setRemoveError] = useState(null)
  const canWrite = can(user, 'RESOURCE_WRITE')

  useEffect(() => {
    const t = setTimeout(() => fetchResources({ ...filters, production_id: productionId ?? filters.production_id }), 200)
    return () => clearTimeout(t)
  }, [filters, productionId])

  const totals = useMemo(() => {
    const byType = {}
    let cost = 0
    resources.forEach((r) => {
      byType[r.type] = (byType[r.type] ?? 0) + r.quantity
      cost += Number(r.total_cost)
    })
    return { byType, cost }
  }, [resources])

  const setF = (k) => (e) => setFilters((s) => ({ ...s, [k]: e.target.value }))

  return (
    <div className={styles.stack}>
      <div className={styles.kpis}>
        {Object.entries(RESOURCE_TYPES).filter(([k]) => k !== 'other' || totals.byType.other).map(([k, label]) => {
          const Icon = TYPE_ICONS[k]
          return (
            <div key={k} className={styles.kpi}>
              <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
              <span className={styles.kpiValue}>{totals.byType[k] ?? 0}</span>
              <span className={styles.kpiLabel}>{label}</span>
            </div>
          )
        })}
        <div className={`${styles.kpi} ${styles.kpiWide}`}>
          <span className={styles.kpiValue}>{fmtBRL(totals.cost, 0)}</span>
          <span className={styles.kpiLabel}>custo dos itens listados</span>
        </div>
      </div>

      <div className={styles.toolbar}>
        <Input aria-label="Buscar recurso" placeholder="Buscar pelo nome…" value={filters.search} onChange={setF('search')}
          wrapperClass={styles.search} />
        {!productionId && (
          <Select aria-label="Produção" placeholder="Todas as produções" value={filters.production_id}
            options={productions.map((p) => ({ value: p.id, label: p.title }))} onChange={setF('production_id')} />
        )}
        <Select aria-label="Tipo" placeholder="Todos os tipos" options={options.resourceTypes} value={filters.type} onChange={setF('type')} />
        <Select aria-label="Situação" placeholder="Todas as situações" options={options.resourceStatus} value={filters.status} onChange={setF('status')} />
        {canWrite && (
          <Button variant="primary" leftIcon={Plus} onClick={() => setModal('new')}>Novo recurso</Button>
        )}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {!loading && resources.length === 0 ? (
        <p className={styles.empty}>Nenhum recurso encontrado com esses filtros.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Recurso</th>
                {!productionId && <th>Produção</th>}
                <th>Situação</th>
                <th className={styles.num}>Qtd.</th>
                <th className={styles.num}>Custo</th>
                <th>Responsável</th>
                {canWrite && <th aria-label="Ações" />}
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => {
                const Icon = TYPE_ICONS[r.type] ?? Package
                return (
                  <tr key={r.id}>
                    <td>
                      <div className={styles.nameCell}>
                        <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                        <div>
                          <span className={styles.name}>{r.name}</span>
                          <span className={styles.sub}>
                            {RESOURCE_TYPES[r.type]}{r.supplier ? ` · ${r.supplier}` : ''}{r.location ? ` · ${r.location}` : ''}
                          </span>
                          {r.notes && <span className={styles.sub} title={r.notes}>Obs.: {r.notes}</span>}
                        </div>
                      </div>
                    </td>
                    {!productionId && <td className={styles.muted}>{r.production_title}</td>}
                    <td><Badge variant={STATUS_VARIANT[r.status]}>{RESOURCE_STATUS[r.status]}</Badge></td>
                    <td className={styles.num}>{r.quantity}</td>
                    <td className={styles.num}>{r.unit_cost != null ? fmtBRL(r.total_cost) : '—'}</td>
                    <td className={styles.muted}>{r.responsible?.full_name ?? '—'}</td>
                    {canWrite && (
                      <td className={styles.actions}>
                        <Button size="sm" variant="ghost" leftIcon={Pencil} aria-label={`Editar ${r.name}`} onClick={() => setModal(r)} />
                        <Button size="sm" variant="ghost" leftIcon={Trash2} aria-label={`Excluir ${r.name}`}
                          onClick={() => { setRemoveError(null); setRemoving(r) }} />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ResourceModal open={!!modal} onClose={() => setModal(null)} resource={modal === 'new' ? null : modal}
        productions={productions} productionId={productionId} />
      <ConfirmDialog open={!!removing} title="Excluir recurso" confirmLabel="Excluir"
        message={removing ? `Excluir “${removing.name}” do inventário da produção?` : ''}
        error={removeError} onClose={() => setRemoving(null)}
        onConfirm={async () => {
          const ok = await deleteResource(removing.id)
          if (ok === true) setRemoving(null); else setRemoveError(ok)
        }} />
    </div>
  )
}
