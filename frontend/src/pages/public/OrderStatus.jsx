import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle2, Clock, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { usePublicStore } from '@/store/publicStore'
import Button from '@/components/ui/Button'
import { fmtBRL } from '@/utils/labels'
import TicketQR from '@/components/ui/TicketQR'
import PublicLayout from './PublicLayout'
import styles from './Public.module.css'

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1)

const STATES = {
  pending: { icon: Clock, tone: 'wait', title: 'Aguardando pagamento',
    text: 'Seus lugares estão guardados. Assim que o Mercado Pago aprovar, os ingressos aparecem aqui.' },
  paid: { icon: CheckCircle2, tone: 'ok', title: 'Pagamento aprovado',
    text: 'Apresente um código por pessoa na entrada. Guarde este link: ele é o seu comprovante.' },
  expired: { icon: XCircle, tone: 'fail', title: 'Prazo encerrado',
    text: 'O pagamento não foi concluído a tempo e os lugares voltaram para a venda. Você pode fazer um novo pedido.' },
  failed: { icon: XCircle, tone: 'fail', title: 'Pagamento não concluído',
    text: 'Não foi possível concluir o pagamento. Nenhum valor foi cobrado por este pedido.' },
  refunded: { icon: XCircle, tone: 'fail', title: 'Pedido estornado',
    text: 'O valor foi devolvido e os ingressos deste pedido foram cancelados.' },
  needs_refund: { icon: AlertTriangle, tone: 'wait', title: 'Pagamento recebido após o prazo',
    text: 'Os lugares já tinham sido vendidos. A produção vai estornar o valor pelo Mercado Pago.' },
}

export default function OrderStatus() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const token = params.get('t') ?? ''
  const { getOrder, refreshOrder } = usePublicStore()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(false)

  const check = useCallback(async () => {
    setChecking(true)
    const res = await refreshOrder(id, token)
    setChecking(false)
    if (res.ok) { setOrder(res.data); setError(null) } else setError(res.error)
  }, [id, token])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const res = await getOrder(id, token)
      if (!alive) return
      if (!res.ok) { setError(res.error); return }
      setOrder(res.data)
      // Voltando do Mercado Pago: confere o pagamento na hora
      if (res.data.status === 'pending' && (params.get('payment_id') || params.get('collection_id') || params.get('status'))) check()
    })()
    return () => { alive = false }
  }, [id, token])

  // Enquanto pendente, confere de novo a cada 15 s (no máximo 8 vezes)
  useEffect(() => {
    if (order?.status !== 'pending') return
    let n = 0
    const timer = setInterval(() => { n += 1; if (n > 8) clearInterval(timer); else check() }, 15000)
    return () => clearInterval(timer)
  }, [order?.status])

  if (error && !order) {
    return (
      <PublicLayout>
        <div className={styles.orderCard}>
          <p className={styles.noticeError} role="alert">{error}</p>
          <Link to="/ingressos" className={styles.lastOrder}>Ver sessões à venda</Link>
        </div>
      </PublicLayout>
    )
  }
  if (!order) return <PublicLayout><p className={styles.loading}>Carregando pedido…</p></PublicLayout>

  const st = STATES[order.status] ?? STATES.pending
  const Icon = st.icon
  return (
    <PublicLayout>
      <div className={styles.orderCard}>
        <div className={`${styles.orderState} ${styles[st.tone]}`} role="status" aria-live="polite">
          <Icon size={28} aria-hidden="true" />
          <div>
            <h1 className={styles.orderTitle}>{st.title}</h1>
            <p>{st.text}</p>
          </div>
        </div>

        <dl className={styles.orderFacts}>
          <div><dt>Espetáculo</dt><dd>{order.production_title}</dd></div>
          <div><dt>Sessão</dt><dd>{cap(format(new Date(order.performance_date), "EEEE, dd/MM/yyyy · HH:mm", { locale: ptBR }))}</dd></div>
          {(order.venue || order.venue_section) && (
            <div><dt>Local</dt><dd>{[order.venue, order.venue_section].filter(Boolean).join(' · ')}</dd></div>
          )}
          <div><dt>Comprador</dt><dd>{order.buyer_name} · {order.buyer_email}</dd></div>
          <div><dt>Ingressos</dt><dd>{order.quantity} × {order.is_premium ? 'premium' : 'inteira'} · {fmtBRL(order.total_amount)}</dd></div>
        </dl>

        {order.status === 'paid' && (
          <ul className={styles.codes} aria-label="Códigos dos ingressos">
            {order.tickets.map((t, i) => (
              <li key={t.code} className={styles.code}>
                <TicketQR code={t.code} size={148} />
                <span className={styles.codeLabel}>Ingresso {i + 1}{t.status === 'used' ? ' · utilizado' : ''}</span>
                <span className={styles.codeValue}>{t.code}</span>
              </li>
            ))}
          </ul>
        )}

        {order.status === 'pending' && (
          <>
            <p className={styles.holdNote}>
              Lugares guardados até {format(new Date(order.expires_at), 'HH:mm')}.
            </p>
            <div className={styles.orderActions}>
              {order.checkout_url && (
                <Button variant="primary" onClick={() => window.location.assign(order.checkout_url)}>Ir para o pagamento</Button>
              )}
              <Button variant="ghost" leftIcon={RefreshCw} loading={checking} onClick={check}>Já paguei, conferir</Button>
            </div>
            {error && <p className={styles.noticeError} role="alert">{error}</p>}
          </>
        )}

        {['expired', 'failed', 'refunded'].includes(order.status) && (
          <div className={styles.orderActions}>
            <Link to="/ingressos" className={styles.lastOrder}>Fazer um novo pedido</Link>
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
