import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { Select, Textarea, Checkbox, formStyles as f } from '@/components/ui/Field'
import api from '@/services/api'
import { useScheduleStore } from '@/store/scheduleStore'
import { options, SCHEDULE_TYPES } from '@/utils/labels'
import styles from './Schedule.module.css'

const pad = (n) => String(n).padStart(2, '0')
const dateOf = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const timeOf = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
// Data e hora locais (fuso do navegador) → ISO com offset, que a API exige
const toISO = (date, time) => new Date(`${date}T${time}`).toISOString()

const EMPTY = {
  production_id: '', title: '', type: 'rehearsal', date: '', start: '19:00', end: '22:00',
  location: '', description: '', notes: '', attendee_ids: [],
}

/**
 * Criar/editar evento da agenda. Se `production` vier, a produção é fixa;
 * senão o usuário escolhe em `productions`.
 */
export default function ScheduleModal({ open, onClose, event, production, productions = [] }) {
  const saveEvent = useScheduleStore((s) => s.saveEvent)
  const [form, setForm] = useState(EMPTY)
  const [people, setPeople] = useState([])
  const [error, setError] = useState(null)
  const [conflicts, setConflicts] = useState(null)
  const [saving, setSaving] = useState(false)
  const editing = !!event

  useEffect(() => {
    if (!open) return
    setError(null)
    setConflicts(null)
    if (event) {
      setForm({
        production_id: event.production_id,
        title: event.title,
        type: event.type,
        date: dateOf(event.start_time),
        start: timeOf(event.start_time),
        end: timeOf(event.end_time),
        location: event.location ?? '',
        description: event.description ?? '',
        notes: event.notes ?? '',
        attendee_ids: event.attendees.map((a) => a.user.id),
      })
    } else {
      setForm({ ...EMPTY, production_id: production?.id ?? '', location: production?.venue ?? '' })
    }
  }, [open, event, production])

  // Convidáveis = pessoas escaladas na produção (uma vez cada, mesmo com várias funções)
  useEffect(() => {
    if (!open || !form.production_id) { setPeople([]); return }
    const fromProd = (p) => {
      const seen = new Map()
      ;(p.participants ?? []).forEach((pt) => {
        const prev = seen.get(pt.user.id)
        seen.set(pt.user.id, { id: pt.user.id, name: pt.user.full_name, roles: prev ? `${prev.roles}, ${pt.role_title}` : pt.role_title })
      })
      return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
    }
    if (production && production.id === form.production_id && production.participants) {
      setPeople(fromProd(production))
      return
    }
    let alive = true
    api.get(`/api/v1/productions/${form.production_id}`)
      .then((res) => { if (alive) setPeople(fromProd(res.data)) })
      .catch(() => { if (alive) setPeople([]) })
    return () => { alive = false }
  }, [open, form.production_id, production])

  const set = (key) => (e) => { setConflicts(null); setForm((s) => ({ ...s, [key]: e.target.value })) }
  const toggle = (id) => { setConflicts(null); setForm((s) => ({
    ...s,
    attendee_ids: s.attendee_ids.includes(id) ? s.attendee_ids.filter((x) => x !== id) : [...s.attendee_ids, id],
  })) }
  const allSelected = people.length > 0 && people.every((p) => form.attendee_ids.includes(p.id))

  const submit = async (force = false) => {
    setError(null)
    if (!form.production_id) { setError('Escolha a produção.'); return }
    if (!form.title.trim()) { setError('Dê um título ao evento.'); return }
    if (!form.date || !form.start || !form.end) { setError('Informe data, início e término.'); return }
    if (form.end <= form.start) { setError('O término deve ser depois do início.'); return }

    const data = {
      title: form.title.trim(),
      type: form.type,
      start_time: toISO(form.date, form.start),
      end_time: toISO(form.date, form.end),
      location: form.location || null,
      description: form.description || null,
      notes: form.notes || null,
      attendee_ids: form.attendee_ids,
    }
    if (!editing) data.production_id = form.production_id

    setSaving(true)
    const result = await saveEvent(event?.id, data, force)
    setSaving(false)
    if (result.ok) { onClose(); return }
    if (result.conflicts) { setConflicts(result.conflicts); return }
    setError(result.error)
  }

  const productionOptions = useMemo(
    () => productions.map((p) => ({ value: p.id, label: p.title })),
    [productions],
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar evento' : 'Novo evento'}
      description={production?.title ?? event?.production?.title}
      size="lg"
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(false) }} className={f.form} noValidate>
        {!production && !editing && (
          <Select label="Produção *" placeholder="Selecione" options={productionOptions}
            value={form.production_id} onChange={set('production_id')} />
        )}
        <div className={f.row}>
          <Input label="Título *" placeholder="ex: Ensaio do 2º ato" value={form.title} onChange={set('title')} autoFocus />
          <Select label="Tipo" options={options.scheduleTypes} value={form.type} onChange={set('type')} />
        </div>
        <div className={f.row3}>
          <Input label="Data *" type="date" value={form.date} onChange={set('date')} />
          <Input label="Início *" type="time" value={form.start} onChange={set('start')} />
          <Input label="Término *" type="time" value={form.end} onChange={set('end')} />
        </div>
        <Input label="Local" value={form.location} onChange={set('location')} />
        <Textarea label="Descrição" rows={2} value={form.description} onChange={set('description')} />

        <fieldset className={styles.attendeeBox}>
          <legend className={styles.attendeeLegend}>
            Convidados ({form.attendee_ids.length})
            {people.length > 0 && (
              <button type="button" className={styles.linkBtn}
                onClick={() => setForm((s) => ({ ...s, attendee_ids: allSelected ? [] : people.map((p) => p.id) }))}>
                {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
              </button>
            )}
          </legend>
          {!form.production_id && <p className={styles.muted}>Escolha a produção para ver a companhia.</p>}
          {form.production_id && people.length === 0 && (
            <p className={styles.muted}>Ninguém escalado nesta produção ainda.</p>
          )}
          <div className={styles.attendeeGrid}>
            {people.map((p) => (
              <Checkbox key={p.id} checked={form.attendee_ids.includes(p.id)} onChange={() => toggle(p.id)}
                label={<span>{p.name} <span className={styles.muted}>· {p.roles}</span></span>} />
            ))}
          </div>
        </fieldset>

        <Textarea label="Notas internas" rows={2} value={form.notes} onChange={set('notes')} />

        {conflicts && (
          <div className={styles.conflictBox} role="alert">
            <p className={styles.conflictTitle}>
              <AlertTriangle size={14} strokeWidth={2} /> Conflito de horário
            </p>
            <ul className={styles.conflictList}>
              {conflicts.map((c, i) => (
                <li key={i}>
                  <strong>{c.user_name}</strong> já está em “{c.schedule_title}” ({c.production_title}),{' '}
                  {format(new Date(c.start_time), 'dd/MM HH:mm')}–{format(new Date(c.end_time), 'HH:mm')}
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && <p className={f.error} role="alert">{error}</p>}

        <div className={f.actions}>
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          {conflicts ? (
            <Button variant="outline" type="button" loading={saving} onClick={() => submit(true)}>
              Salvar mesmo assim
            </Button>
          ) : (
            <Button variant="primary" type="submit" loading={saving}>
              {editing ? 'Salvar' : `Agendar ${SCHEDULE_TYPES[form.type]?.toLowerCase() ?? ''}`}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}
