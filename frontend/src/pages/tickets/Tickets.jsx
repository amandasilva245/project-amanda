import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Ticket, Plus, ScanLine, CheckCircle2, XCircle, Pencil, List, ShoppingCart } from 'lucide-react'
import { useProductionStore } from '@/store/productionStore'
import { useTicketStore } from '@/store/ticketStore'
import { useAuthStore } from '@/store/authStore'
import { StatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { BatchModal, SellModal, TicketListModal } from '@/components/modules/TicketModals'
import { can } from '@/utils/permissions'
import { fmtBRL } from '@/utils/labels'
import styles from './Tickets.module.css'

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1)

export default function Tickets() {
  const user = useAuthStore((s) => s.user)
  const { productions, fetchProductions } = useProductionStore()
  const { batches, summaries, loading, error, fetchBatches, checkIn } = useTicketStore()
  const canManage = can(user, 'TICKETS_MANAGE')

  const [batchModal, setBatchModal] = useState(null) // null | 'new' | lote
  const [selling, setSelling] = useState(null)
  const [listing, setListing] = useState(null)
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState(null)
  const codeRef = useRef(null)

  useEffect(() => { fetchProductions(); fetchBatches() }, [])

  const byProduction = useMemo(() => {
    const groups = new Map()
    batches.forEach((b) => {
      if (!groups.has(b.production_id)) groups.set(b.production_id, [])
      groups.get(b.production_id).push(b)
    })
    return [...groups.entries()].map(([id, list]) => ({
      production: productions.find((p) => p.id === id) ?? { id, title: 'Produção' },
      batches: list,
    }))
  }, [batches, productions])

  // RF24: check-in pelo código, atômico no servidor
  const handleCheckIn = async (e) => {
    e.preventDefault()
    const value = code.trim()
    if (!value) return
    setChecking(true)
    const res = await checkIn(value)
    setChecking(false)
    setCheckResult(res.result ? { ok: true, ...res.result } : { ok: false, message: res.error })
    setCode('')
    codeRef.current?.focus()
  }

  const prodOf = (b) => productions.find((p) => p.id === b?.production_id)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className="overline">Público</p>
          <h1 className={styles.title}>Bilheteria</h1>
        </div>
        {canManage && (
          <Button variant="primary" leftIcon={Plus} onClick={() => setBatchModal('new')} disabled={!productions.length}>
            Novo lote
          </Button>
        )}
      </div>

      {/* Check-in na portaria */}
      <section className={styles.checkin} aria-labelledby="checkin-title">
        <div className={styles.checkinHead}>
          <ScanLine size={18} strokeWidth={1.75} />
          <h2 id="checkin-title" className={styles.checkinTitle}>Check-in na entrada</h2>
        </div>
        <form className={styles.checkinForm} onSubmit={handleCheckIn}>
          <Input ref={codeRef} aria-label="Código do ingresso" placeholder="Digite ou leia o código do ingresso"
            value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="off"
            wrapperClass={styles.checkinInput} />
          <Button type="submit" variant="primary" loading={checking}>Validar entrada</Button>
        </form>
        {checkResult && (
          <div className={`${styles.checkResult} ${checkResult.ok ? styles.checkOk : styles.checkFail}`} role="status" aria-live="polite">
            {checkResult.ok ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
            <div>
              {checkResult.ok ? (
                <>
                  <strong>Entrada liberada · {checkResult.ticket.buyer_name}</strong>
                  <span>
                    {checkResult.production_title} · {format(new Date(checkResult.performance_date), 'dd/MM HH:mm')}
                    {checkResult.ticket.seat_number ? ` · assento ${checkResult.ticket.seat_number}` : ''}
                    {checkResult.ticket.is_premium ? ' · premium' : ''}
                  </span>
                </>
              ) : (
                <strong>{checkResult.message}</strong>
              )}
            </div>
          </div>
        )}
      </section>

      {error && <p className={styles.errorLine} role="alert">{error}</p>}

      {!loading && byProduction.length === 0 && (
        <div className={styles.empty}>
          <Ticket size={32} strokeWidth={1} style={{ color: 'var(--text-disabled)' }} />
          <p className={styles.emptyTitle}>Nenhum lote de ingressos</p>
          <p className={styles.emptyText}>
            {canManage ? 'Crie um lote para cada sessão: capacidade, preços e período de venda.' : 'Os lotes aparecem aqui quando forem criados.'}
          </p>
        </div>
      )}

      <div className={styles.list}>
        {byProduction.map(({ production, batches: list }) => {
          const s = summaries[production.id]
          return (
            <div key={production.id} className={styles.prodSection}>
              <div className={styles.prodHeader}>
                <div className={styles.prodMeta}>
                  {production.status && <StatusBadge status={production.status} />}
                  <h2 className={styles.prodTitle}>{production.title}</h2>
                </div>
                {s && (
                  <div className={styles.prodStats}>
                    <span className={styles.stat}>
                      <span className={styles.statValue}>{s.total_sold}</span>
                      <span className={styles.statLabel}> / {s.total_seats} ocupados</span>
                    </span>
                    <span className={styles.stat}>
                      <span className={styles.statValue} style={{ color: 'var(--success)' }}>{s.occupancy_rate.toLocaleString('pt-BR')}%</span>
                      <span className={styles.statLabel}> de ocupação</span>
                    </span>
                    <span className={styles.stat}>
                      <span className={styles.statValue}>{s.total_checked_in}</span>
                      <span className={styles.statLabel}> check-ins</span>
                    </span>
                    <span className={styles.statRevenue}>{fmtBRL(s.total_revenue, 0)}</span>
                  </div>
                )}
              </div>

              <div className={styles.batchGrid}>
                {list.map((batch) => {
                  const occ = batch.total_seats > 0 ? Math.round((batch.tickets_sold / batch.total_seats) * 100) : 0
                  return (
                    <div key={batch.id} className={styles.batchCard}>
                      <div className={styles.batchInfo}>
                        <div className={styles.batchTop}>
                          <p className={styles.batchDate}>
                            {cap(format(new Date(batch.performance_date), "EEEE, dd/MM/yyyy · HH:mm", { locale: ptBR }))}
                          </p>
                          <StatusBadge status={batch.status} />
                        </div>
                        {batch.venue_section && <p className={styles.batchSection}>{batch.venue_section}</p>}
                      </div>
                      <div className={styles.batchStats}>
                        <div className={styles.batchOccBar} role="img" aria-label={`${occ}% ocupado`}>
                          <div className={styles.batchOccFill} style={{ width: `${occ}%` }} />
                        </div>
                        <span className={styles.batchOccLabel}>{occ}%</span>
                      </div>
                      <div className={styles.batchNumbers}>
                        <span>{batch.tickets_sold} / {batch.total_seats} · {batch.available_seats} livres</span>
                        <span className={styles.batchPrice}>
                          {fmtBRL(batch.price, 0)}{batch.price_premium != null ? ` · ${fmtBRL(batch.price_premium, 0)}` : ''}
                        </span>
                      </div>
                      <div className={styles.batchActions}>
                        {canManage && batch.status === 'on_sale' && (
                          <Button size="sm" variant="primary" leftIcon={ShoppingCart} onClick={() => setSelling(batch)}>Vender</Button>
                        )}
                        <Button size="sm" variant="ghost" leftIcon={List} onClick={() => setListing(batch)}>Ingressos</Button>
                        {canManage && (
                          <Button size="sm" variant="ghost" leftIcon={Pencil} onClick={() => setBatchModal(batch)}
                            aria-label="Editar lote" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <BatchModal open={!!batchModal} batch={batchModal === 'new' ? null : batchModal}
        productions={productions} onClose={() => setBatchModal(null)} />
      <SellModal open={!!selling} batch={selling} production={prodOf(selling)} onClose={() => setSelling(null)} />
      <TicketListModal open={!!listing} batch={listing} production={prodOf(listing)} onClose={() => setListing(null)} />
    </div>
  )
}
