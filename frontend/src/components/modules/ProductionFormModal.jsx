import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { Select, Textarea, formStyles as f } from '@/components/ui/Field'
import { options } from '@/utils/labels'

const EMPTY = {
  title: '', subtitle: '', playwright: '', genre: '', status: 'development', synopsis: '',
  start_date: '', end_date: '', first_performance_date: '',
  venue: '', venue_capacity: '', budget_total: '', color_accent: '#A9874A',
}

const FIELDS = Object.keys(EMPTY)

/**
 * Formulário de produção (criar e editar). `initial` = produção existente.
 * onSubmit(data) deve devolver true (sucesso) ou uma mensagem de erro.
 */
export default function ProductionFormModal({ open, onClose, initial, onSubmit, loading }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const editing = !!initial

  useEffect(() => {
    if (!open) return
    setError(null)
    if (initial) {
      const next = { ...EMPTY }
      FIELDS.forEach((k) => { if (initial[k] != null) next[k] = String(initial[k]) })
      setForm(next)
    } else {
      setForm(EMPTY)
    }
  }, [open, initial])

  const set = (key) => (e) => setForm((s) => ({ ...s, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.title.trim()) { setError('O título é obrigatório.'); return }
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setError('A data de encerramento não pode ser anterior à de início.'); return
    }
    if (form.venue_capacity && Number(form.venue_capacity) <= 0) {
      setError('A capacidade deve ser maior que zero.'); return
    }
    if (form.budget_total && Number(form.budget_total) < 0) {
      setError('O orçamento não pode ser negativo.'); return
    }
    const data = { ...form }
    if (data.venue_capacity) data.venue_capacity = Number(data.venue_capacity)
    const result = await onSubmit(data)
    if (result !== true) setError(result || 'Não foi possível salvar.')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar produção' : 'Nova produção'}
      description={editing ? 'Atualize os dados, o status e o orçamento.' : 'Inicie uma nova jornada teatral.'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className={f.form} noValidate>
        <Input label="Título *" placeholder="ex: Romeu e Julieta" value={form.title} onChange={set('title')} autoFocus />
        <div className={f.row}>
          <Input label="Dramaturgo / Autor" value={form.playwright} onChange={set('playwright')} />
          <Input label="Subtítulo" value={form.subtitle} onChange={set('subtitle')} />
        </div>
        <div className={f.row}>
          <Select label="Gênero" placeholder="Selecione" options={options.genres} value={form.genre} onChange={set('genre')} />
          <Select label="Status" options={options.productionStatus} value={form.status} onChange={set('status')} />
        </div>
        <Textarea label="Sinopse" rows={3} value={form.synopsis} onChange={set('synopsis')} />
        <div className={f.row3}>
          <Input label="Início" type="date" value={form.start_date} onChange={set('start_date')} />
          <Input label="Estreia" type="date" value={form.first_performance_date} onChange={set('first_performance_date')} />
          <Input label="Encerramento" type="date" value={form.end_date} onChange={set('end_date')} />
        </div>
        <div className={f.row3}>
          <Input label="Local / Teatro" value={form.venue} onChange={set('venue')} />
          <Input label="Capacidade" type="number" min="1" value={form.venue_capacity} onChange={set('venue_capacity')} />
          <Input label="Orçamento (R$)" type="number" min="0" step="0.01" value={form.budget_total} onChange={set('budget_total')} />
        </div>
        <Input label="Cor de destaque" type="color" value={form.color_accent} onChange={set('color_accent')} />

        {error && <p className={f.error} role="alert">{error}</p>}

        <div className={f.actions}>
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" loading={loading}>
            {editing ? 'Salvar alterações' : 'Criar produção'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
