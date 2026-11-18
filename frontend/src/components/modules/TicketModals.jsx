import { useEffect, useState } from 'react'
import TicketQR from '@/components/ui/TicketQR'
import { format } from 'date-fns'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { Select, Textarea, Checkbox, formStyles as f } from '@/components/ui/Field'
import { useTicketStore } from '@/store/ticketStore'
import { useAuthStore } from '@/store/authStore'
import { can } from '@/utils/permissions'
import { fmtBRL, isoToLocalInput, localInputToISO } from '@/utils/labels'
import styles from './Tickets.module.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* ── Lote: criar / editar (RF22) ──────────────────────────────────────────── */
const EMPTY_BATCH = {
  production_id: '', performance_date: '', venue_section: '', description: '',
  total_seats: '', price: '', price_premium: '', sale_start: '', sale_end: '', status: 'on_sale',
}

export function BatchModal({ open, onClose, batch, productions = [] }) {
  const saveBatch = useTicketStore((s) => s.saveBatch)
  const [form, setForm] = useState(EMPTY_BATCH)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const editing = !!batch

  useEffect(() => {
    if (!open) return
    setError(null)
    if (batch) {
      setForm({
        production_id: batch.production_id,
        performance_date: isoToLocalInput(batch.performance_date),
        venue_section: batch.venue_section ?? '', description: batch.description ?? '',
        total_seats: String(batch.total_seats), price: String(batch.price),
        price_premium: batch.price_premium != null ? String(batch.price_premium) : '',
        sale_start: isoToLocalInput(batch.sale_start), sale_end: isoToLocalInput(batch.sale_end),
        status: batch.status,
      })
    } else {
      const prod = productions[0]
      setForm({ ...EMPTY_BATCH, production_id: prod?.id ?? '', total_seats: prod?.venue_capacity ? String(prod.venue_capacity) : '' })
    }
  }, [open, batch])

  const set = (key) => (e) => setForm((s) => ({ ...s, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.production_id) { setError('Escolha a produção.'); return }
    if (!form.performance_date) { setError('Informe data e hora da sessão.'); return }
    if (!(Number(form.total_seats) > 0)) { setError('A capacidade deve ser maior que zero.'); return }
    if (form.price === '' || Number(form.price) < 0) { setError('Informe o preço da inteira.'); return }
    if (form.sale_start && form.sale_end && form.sale_end <= form.sale_start) {
      setError('O fim das vendas deve ser depois do início.'); return
    }
    const data = {
      performance_date: localInputToISO(form.performance_date),
      venue_section: form.venue_section, description: form.description,
      total_seats: Number(form.total_seats), price: form.price,
      price_premium: form.price_premium === '' ? null : form.price_premium,
      sale_start: localInputToISO(form.sale_start), sale_end: localInputToISO(form.sale_end),
    }
    if (editing) data.status = form.status
    else data.production_id = form.production_id
    setSaving(true)
    const result = await saveBatch(batch?.id, editing ? data : Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null)))
    setSaving(false)
    if (result === true) onClose()
    else setError(result)
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar lote' : 'Novo lote de ingressos'}
      description="Uma sessão com capacidade, preços e período de venda." size="md">
      <form onSubmit={handleSubmit} className={f.form} noValidate>
        {!editing && (
          <Select label="Produção *" placeholder="Selecione" value={form.production_id} onChange={set('production_id')}
            options={productions.map((p) => ({ value: p.id, label: p.title }))} />
        )}
        <div className={f.row}>
          <Input label="Sessão (data e hora) *" type="datetime-local" value={form.performance_date} onChange={set('performance_date')} />
          <Input label="Setor" placeholder="ex: Plateia, Balcão" value={form.venue_section} onChange={set('venue_section')} />
        </div>
        <div className={f.row3}>
          <Input label="Capacidade *" type="number" min="1" value={form.total_seats} onChange={set('total_seats')} />
          <Input label="Inteira (R$) *" type="number" min="0" step="0.01" value={form.price} onChange={set('price')} />
          <Input label="Premium (R$)" type="number" min="0" step="0.01" value={form.price_premium} onChange={set('price_premium')} />
        </div>
        <div className={f.row}>
          <Input label="Início das vendas" type="datetime-local" value={form.sale_start} onChange={set('sale_start')} />
          <Input label="Fim das vendas" type="datetime-local" value={form.sale_end} onChange={set('sale_end')} />
        </div>
        {editing && (
          <Select label="Status" value={form.status} onChange={set('status')} options={[
            { value: 'on_sale', label: 'À venda' }, { value: 'sold_out', label: 'Esgotado' },
            { value: 'cancelled', label: 'Cancelado' }, { value: 'completed', label: 'Concluído' },
          ]} />
        )}
        <Input label="Descrição" value={form.description} onChange={set('description')} />
        {error && <p className={f.error} role="alert">{error}</p>}
        <div className={f.actions}>
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" loading={saving}>{editing ? 'Salvar' : 'Criar lote'}</Button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Venda no balcão (RF24) ───────────────────────────────────────────────── */
const EMPTY_SALE = {
  buyer_name: '', buyer_email: '', buyer_phone: '', quantity: '1', seat_number: '',
  is_premium: false, status: 'confirmed', notes: '',
}

export function SellModal({ open, onClose, batch, production }) {
  const sell = useTicketStore((s) => s.sell)
  const [form, setForm] = useState(EMPTY_SALE)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [sold, setSold] = useState(null)

  useEffect(() => { if (open) { setForm(EMPTY_SALE); setError(null); setSold(null) } }, [open])

  const set = (key) => (e) =>
    setForm((s) => ({ ...s, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  if (!batch) return null
  const unit = form.is_premium ? batch.price_premium : batch.price
  const qty = Number(form.quantity) || 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (form.buyer_name.trim().length < 2) { setError('Informe o nome do comprador.'); return }
    if (!EMAIL_RE.test(form.buyer_email.trim())) { setError('Informe um e-mail válido.'); return }
    if (qty < 1 || qty > 20) { setError('Quantidade entre 1 e 20.'); return }
    if (qty > batch.available_seats) { setError(`Restam ${batch.available_seats} lugares.`); return }
    setSaving(true)
    const result = await sell({ ...form, batch_id: batch.id, quantity: qty, buyer_email: form.buyer_email.trim() })
    setSaving(false)
    if (result.tickets) setSold(result.tickets)
    else setError(result.error)
  }

  return (
    <Modal open={open} onClose={onClose} title={sold ? 'Venda registrada' : 'Registrar venda'}
      description={`${production?.title ?? ''} · ${format(new Date(batch.performance_date), 'dd/MM/yyyy HH:mm')}`} size="md">
      {sold ? (
        <div className={f.form}>
          <p className={styles.soldIntro}>
            {sold.length === 1 ? 'Código do ingresso' : `Códigos dos ${sold.length} ingressos`} para {sold[0].buyer_name}.
            Mostre o QR Code ou informe o código ao comprador: ele será pedido na entrada.
          </p>
          <ul className={styles.codeList}>
            {sold.map((t) => (
              <li key={t.id} className={styles.codeItem}>
                <TicketQR code={t.code} size={88} />
                <span className={styles.code}>{t.code}</span>
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
          <div className={f.actions}>
            <Button variant="ghost" type="button" onClick={() => { setSold(null); setForm(EMPTY_SALE) }}>Nova venda</Button>
            <Button variant="primary" type="button" onClick={onClose}>Concluir</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={f.form} noValidate>
          <div className={f.row}>
            <Input label="Nome do comprador *" value={form.buyer_name} onChange={set('buyer_name')} autoFocus autoComplete="off" />
            <Input label="E-mail *" type="email" value={form.buyer_email} onChange={set('buyer_email')} autoComplete="off" />
          </div>
          <div className={f.row3}>
            <Input label="Telefone" type="tel" value={form.buyer_phone} onChange={set('buyer_phone')} />
            <Input label="Quantidade" type="number" min="1" max="20" value={form.quantity} onChange={set('quantity')} />
            <Input label="Assento" placeholder="opcional" value={form.seat_number} onChange={set('seat_number')} disabled={qty > 1} />
          </div>
          <div className={f.row}>
            <Select label="Situação" value={form.status} onChange={set('status')} options={[
              { value: 'confirmed', label: 'Pago (confirmado)' }, { value: 'reserved', label: 'Reserva (pagar depois)' },
            ]} />
            <div className={styles.totalBox}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalValue}>{fmtBRL(Number(unit ?? 0) * qty)}</span>
            </div>
          </div>
          {batch.price_premium != null && (
            <Checkbox label={`Premium (${fmtBRL(batch.price_premium)} cada)`} checked={form.is_premium} onChange={set('is_premium')} />
          )}
          <Textarea label="Observações" rows={2} value={form.notes} onChange={set('notes')} />
          <p className={styles.privacy}>
            Usamos nome e e-mail só para identificar o ingresso na entrada. Nenhum dado de pagamento é guardado no Curtain.
          </p>
          {error && <p className={f.error} role="alert">{error}</p>}
          <div className={f.actions}>
            <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={saving}>Registrar {qty > 1 ? `${qty} ingressos` : 'ingresso'}</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

/* ── Lista de ingressos de um lote ───────────────────────────────────────── */
export function TicketListModal({ open, onClose, batch, production }) {
  const user = useAuthStore((s) => s.user)
  const { listTickets, ticketAction } = useTicketStore()
  const [tickets, setTickets] = useState([])
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [pendingCancel, setPendingCancel] = useState(null) // cancelar pede um segundo clique
  const canManage = can(user, 'TICKETS_MANAGE')

  const load = async () => {
    try { setTickets(await listTickets(batch.id)) } catch { setError('Não foi possível carregar os ingressos.') }
  }

  useEffect(() => { if (open && batch) { setError(null); setQuery(''); load() } }, [open, batch?.id])

  if (!batch) return null

  const act = async (t, action) => {
    setError(null)
    setPendingCancel(null)
    const res = await ticketAction(t.id, action)
    if (res.error) setError(res.error)
    else load()
  }

  const q = query.trim().toLowerCase()
  const shown = tickets.filter((t) => !q || t.code.toLowerCase().includes(q) || t.buyer_name.toLowerCase().includes(q))

  return (
    <Modal open={open} onClose={onClose} title="Ingressos do lote"
      description={`${production?.title ?? ''} · ${format(new Date(batch.performance_date), 'dd/MM/yyyy HH:mm')}`} size="lg">
      <div className={f.form}>
        <Input aria-label="Buscar ingresso" placeholder="Buscar por código ou nome…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {error && <p className={f.error} role="alert">{error}</p>}
        {shown.length === 0 ? <p className={styles.muted}>Nenhum ingresso.</p> : (
          <ul className={styles.ticketList}>
            {shown.map((t) => (
              <li key={t.id} className={styles.ticketRow}>
                <span className={styles.codeSmall}>{t.code}</span>
                <span className={styles.buyer}>
                  {t.buyer_name}
                  <small>{t.buyer_email}{t.buyer_phone ? ` · ${t.buyer_phone}` : ''}{t.seat_number ? ` · assento ${t.seat_number}` : ''}{t.is_premium ? ' · premium' : ''}</small>
                  {t.notes && <small title={t.notes}>Obs.: {t.notes}</small>}
                </span>
                <span className={styles.price}>{fmtBRL(t.price_paid)}</span>
                <StatusBadge status={t.status} />
                {canManage && (
                  <span className={styles.rowActions}>
                    {t.status === 'reserved' && <Button size="sm" variant="outline" onClick={() => act(t, 'confirm')}>Confirmar</Button>}
                    {(t.status === 'reserved' || t.status === 'confirmed') && (pendingCancel === t.id ? (
                      <Button size="sm" variant="destructive" onClick={() => act(t, 'cancel')}>Confirmar cancelamento</Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setPendingCancel(t.id)}>Cancelar</Button>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
