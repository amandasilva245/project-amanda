import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MapPin, Ticket } from 'lucide-react'
import { usePublicStore } from '@/store/publicStore'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { Checkbox, Select, formStyles as f } from '@/components/ui/Field'
import { fmtBRL } from '@/utils/labels'
import PublicLayout from './PublicLayout'
import styles from './Public.module.css'

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1)
const when = (d) => cap(format(new Date(d), "EEEE, dd 'de' MMMM · HH:mm", { locale: ptBR }))

function CheckoutModal({ event, onClose, holdMinutes }) {
  const createOrder = usePublicStore((s) => s.createOrder)
  const [form, setForm] = useState({ buyer_name: '', buyer_email: '', buyer_phone: '', quantity: '1', type: 'full', accept: false })
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (event) { setError(null); setForm((s) => ({ ...s, quantity: '1', type: 'full', accept: false })) }
  }, [event])

  if (!event) return <Modal open={false} onClose={onClose} />
  const maxQty = Math.min(10, event.available_seats)
  const unit = form.type === 'premium' ? event.price_premium : event.price
  const total = Number(unit) * Number(form.quantity || 0)
  const set = (k) => (e) => {
    setError(null)
    setForm((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (form.buyer_name.trim().length < 3) return setError('Informe seu nome completo.')
    if (!/^\S+@\S+\.\S+$/.test(form.buyer_email.trim())) return setError('Informe um e-mail válido.')
    if (!form.accept) return setError('Para emitir o ingresso, aceite o uso dos seus dados.')
    setSending(true)
    const res = await createOrder({
      batch_id: event.batch_id,
      buyer_name: form.buyer_name.trim(),
      buyer_email: form.buyer_email.trim(),
      buyer_phone: form.buyer_phone.trim() || null,
      quantity: Number(form.quantity),
      is_premium: form.type === 'premium',
      accept_terms: true,
    })
    if (!res.ok) { setSending(false); setError(res.error); return }
    // Guarda o link do pedido para o comprador voltar depois
    try { localStorage.setItem('curtain:last-order', `/ingressos/pedido/${res.data.order_id}?t=${res.data.token}`) } catch { /* sem armazenamento */ }
    window.location.assign(res.data.checkout_url)
  }

  const qtyOptions = Array.from({ length: maxQty }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))
  const typeOptions = [{ value: 'full', label: `Inteira · ${fmtBRL(event.price)}` }]
  if (event.price_premium != null) typeOptions.push({ value: 'premium', label: `Premium · ${fmtBRL(event.price_premium)}` })

  return (
    <Modal open={!!event} onClose={onClose} title={event.title} description={when(event.performance_date)}>
      <form className={f.form} onSubmit={submit} noValidate>
        <Input label="Nome completo *" value={form.buyer_name} onChange={set('buyer_name')} autoComplete="name" autoFocus />
        <div className={f.row}>
          <Input label="E-mail *" type="email" value={form.buyer_email} onChange={set('buyer_email')} autoComplete="email" />
          <Input label="Telefone" type="tel" value={form.buyer_phone} onChange={set('buyer_phone')} autoComplete="tel" />
        </div>
        <div className={f.row}>
          <Select label="Ingresso" options={typeOptions} value={form.type} onChange={set('type')} />
          <Select label="Quantidade" options={qtyOptions} value={form.quantity} onChange={set('quantity')} />
        </div>
        <Checkbox
          label="Autorizo o uso do meu nome, e-mail e telefone para emitir e validar o ingresso (guardados por 12 meses)."
          checked={form.accept} onChange={set('accept')}
        />
        <p className={styles.totalLine}>
          Total <strong>{fmtBRL(total)}</strong>
          <span>Os lugares ficam guardados por {holdMinutes} minutos enquanto você paga.</span>
        </p>
        {error && <p className={f.error} role="alert">{error}</p>}
        <div className={f.actions}>
          <Button variant="ghost" type="button" onClick={onClose}>Voltar</Button>
          <Button variant="primary" type="submit" loading={sending}>Pagar no Mercado Pago</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function PublicEvents() {
  const { status, events, loading, error, fetchVitrine } = usePublicStore()
  const [buying, setBuying] = useState(null)
  const [lastOrder, setLastOrder] = useState(null)

  useEffect(() => {
    fetchVitrine()
    try { setLastOrder(localStorage.getItem('curtain:last-order')) } catch { /* sem armazenamento */ }
  }, [])

  const productions = useMemo(() => {
    const groups = new Map()
    events.forEach((e) => {
      if (!groups.has(e.production_id)) groups.set(e.production_id, { ...e, sessions: [] })
      groups.get(e.production_id).sessions.push(e)
    })
    return [...groups.values()]
  }, [events])

  const enabled = status?.enabled

  return (
    <PublicLayout sandbox={status?.enabled && status?.sandbox}>
      <div className={styles.hero}>
        <p className="overline">Em cartaz</p>
        <h1 className={styles.heroTitle}>Escolha sua sessão</h1>
        {lastOrder && <a className={styles.lastOrder} href={lastOrder}>Ver meu último pedido</a>}
      </div>

      {status && !enabled && (
        <p className={styles.notice} role="status">A venda online está fechada no momento. {status.reason}</p>
      )}
      {error && <p className={styles.noticeError} role="alert">{error}</p>}

      {!loading && productions.length === 0 && !error && (
        <div className={styles.empty}>
          <Ticket size={32} strokeWidth={1} aria-hidden="true" />
          <p>Nenhuma sessão à venda agora. Volte em breve.</p>
        </div>
      )}

      <div className={styles.productions}>
        {productions.map((p) => (
          <article key={p.production_id} className={styles.prod} style={{ '--accent': p.color_accent || 'var(--gold)' }}>
            <div className={styles.prodHead}>
              <h2 className={styles.prodTitle}>{p.title}</h2>
              {p.subtitle && <p className={styles.prodSubtitle}>{p.subtitle}</p>}
              <p className={styles.prodMeta}>
                {p.playwright && <span>{p.playwright}</span>}
                {p.venue && <span><MapPin size={14} aria-hidden="true" /> {p.venue}</span>}
              </p>
              {p.synopsis && <p className={styles.synopsis}>{p.synopsis}</p>}
            </div>
            <ul className={styles.sessions}>
              {p.sessions.map((s) => (
                <li key={s.batch_id} className={styles.session}>
                  <div>
                    <p className={styles.sessionDate}>{when(s.performance_date)}</p>
                    <p className={styles.sessionInfo}>
                      {s.venue_section ? `${s.venue_section} · ` : ''}
                      {fmtBRL(s.price)}{s.price_premium != null ? ` · premium ${fmtBRL(s.price_premium)}` : ''}
                      {!s.sold_out && s.available_seats <= 10 ? ` · últimos ${s.available_seats} lugares` : ''}
                    </p>
                  </div>
                  {s.sold_out ? (
                    <span className={styles.soldOut}>Esgotado</span>
                  ) : (
                    <Button variant="primary" size="sm" disabled={!enabled} onClick={() => setBuying(s)}>
                      Comprar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <CheckoutModal event={buying} onClose={() => setBuying(null)} holdMinutes={status?.hold_minutes ?? 30} />
    </PublicLayout>
  )
}
