import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { Select, Textarea, Checkbox, formStyles as f } from '@/components/ui/Field'
import { useCastStore } from '@/store/castStore'
import { useProductionStore } from '@/store/productionStore'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'
import { getErrorMessage, stripEmpty } from '@/utils/helpers'
import { options } from '@/utils/labels'

const EMPTY = {
  user_id: '', role_title: '', department: 'cast', character_name: '',
  fee: '', fee_paid: '', start_date: '', end_date: '', notes: '',
  is_lead: false, is_confirmed: false,
}

/** Adiciona (participant = null) ou edita uma participação na produção (RF12, RF13). */
export default function ParticipantModal({ open, onClose, production, participant }) {
  const editing = !!participant
  const { members, fetchMembers } = useCastStore()
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin')
  const refreshCurrent = useProductionStore((s) => s.refreshCurrent)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (participant) {
      const next = { ...EMPTY }
      Object.keys(EMPTY).forEach((k) => {
        if (participant[k] != null) next[k] = typeof EMPTY[k] === 'boolean' ? participant[k] : String(participant[k])
      })
      next.user_id = participant.user.id
      setForm(next)
    } else {
      setForm(EMPTY)
      if (!members.length) fetchMembers({ full: isAdmin })
    }
  }, [open, participant])

  const set = (key) => (e) =>
    setForm((s) => ({ ...s, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!editing && !form.user_id) { setError('Escolha a pessoa.'); return }
    if (!form.role_title.trim()) { setError('Informe a função.'); return }
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setError('A data final não pode ser anterior à inicial.'); return
    }
    if (form.fee && form.fee_paid && Number(form.fee_paid) > Number(form.fee)) {
      setError('O valor pago não pode ser maior que o cachê.'); return
    }
    setSaving(true)
    try {
      const base = `/api/v1/productions/${production.id}/participants`
      if (editing) {
        const { user_id, ...rest } = form
        await api.patch(`${base}/${participant.id}`, stripEmpty(rest))
      } else {
        const { fee_paid, ...rest } = form
        await api.post(base, stripEmpty(rest))
      }
      await refreshCurrent()
      onClose()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const people = members
    .filter((m) => m.is_active !== false)
    .map((m) => ({ value: m.id, label: m.full_name }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar participação' : 'Adicionar participante'}
      description={editing ? participant.user.full_name : production?.title}
      size="md"
    >
      <form onSubmit={handleSubmit} className={f.form} noValidate>
        {!editing && (
          <Select label="Pessoa *" placeholder="Selecione" options={people} value={form.user_id} onChange={set('user_id')} />
        )}
        <div className={f.row}>
          <Input label="Função *" placeholder="ex: Atriz, Iluminador" value={form.role_title} onChange={set('role_title')} />
          <Select label="Departamento" options={options.departments} value={form.department} onChange={set('department')} />
        </div>
        <Input label="Personagem" value={form.character_name} onChange={set('character_name')} />
        <div className={f.row}>
          <Input label="Cachê (R$)" type="number" min="0" step="0.01" value={form.fee} onChange={set('fee')} />
          {editing && (
            <Input label="Valor já pago (R$)" type="number" min="0" step="0.01" value={form.fee_paid} onChange={set('fee_paid')} />
          )}
        </div>
        <div className={f.row}>
          <Input label="Início" type="date" value={form.start_date} onChange={set('start_date')} />
          <Input label="Fim" type="date" value={form.end_date} onChange={set('end_date')} />
        </div>
        <Textarea label="Observações" rows={2} value={form.notes} onChange={set('notes')} />
        <div className={f.checks}>
          <Checkbox label="Papel principal" checked={form.is_lead} onChange={set('is_lead')} />
          <Checkbox label="Participação confirmada" checked={form.is_confirmed} onChange={set('is_confirmed')} />
        </div>

        {error && <p className={f.error} role="alert">{error}</p>}

        <div className={f.actions}>
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" loading={saving}>
            {editing ? 'Salvar' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
