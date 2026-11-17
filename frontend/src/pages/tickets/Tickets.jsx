import { useEffect } from 'react'
import { Ticket } from 'lucide-react'
import { useProductionStore } from '@/store/productionStore'
import { StatusBadge } from '@/components/ui/Badge'
import styles from './Tickets.module.css'

const fmtCurrency = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v ?? 0)

export default function Tickets() {
  const { productions, fetchProductions } = useProductionStore()

  useEffect(() => { fetchProductions() }, [])

  const productionsWithBatches = productions.filter(
    (p) => p.ticket_batches?.length > 0
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className="overline">Audience</p>
          <h1 className={styles.title}>Tickets</h1>
        </div>
      </div>

      {productionsWithBatches.length === 0 && (
        <div className={styles.empty}>
          <Ticket size={32} strokeWidth={1} style={{ color: 'var(--text-disabled)' }} />
          <p className={styles.emptyTitle}>No ticket batches</p>
          <p className={styles.emptyText}>Ticket batches will appear here once added to productions.</p>
        </div>
      )}

      <div className={styles.list}>
        {productionsWithBatches.map((prod) => {
          const batches = prod.ticket_batches ?? []
          const totalSold  = batches.reduce((s, b) => s + b.tickets_sold, 0)
          const totalSeats = batches.reduce((s, b) => s + b.total_seats, 0)
          const totalRev   = batches.reduce((s, b) => s + parseFloat(b.price) * b.tickets_sold, 0)
          const occ = totalSeats > 0 ? (totalSold / totalSeats * 100).toFixed(0) : 0

          return (
            <div key={prod.id} className={styles.prodSection}>
              <div className={styles.prodHeader}>
                <div className={styles.prodMeta}>
                  <StatusBadge status={prod.status} />
                  <h2 className={styles.prodTitle}>{prod.title}</h2>
                </div>
                <div className={styles.prodStats}>
                  <span className={styles.stat}>
                    <span className={styles.statValue}>{totalSold}</span>
                    <span className={styles.statLabel}> / {totalSeats} sold</span>
                  </span>
                  <span className={styles.stat}>
                    <span className={styles.statValue} style={{ color: 'var(--success)' }}>{occ}%</span>
                    <span className={styles.statLabel}> occupancy</span>
                  </span>
                  <span className={styles.statRevenue}>{fmtCurrency(totalRev)}</span>
                </div>
              </div>

              <div className={styles.batchGrid}>
                {batches.map((batch) => {
                  const batchOcc = batch.total_seats > 0
                    ? (batch.tickets_sold / batch.total_seats * 100).toFixed(0)
                    : 0
                  return (
                    <div key={batch.id} className={styles.batchCard}>
                      <div className={styles.batchInfo}>
                        <p className={styles.batchDate}>
                          {new Date(batch.performance_date).toLocaleDateString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                        {batch.venue_section && (
                          <p className={styles.batchSection}>{batch.venue_section}</p>
                        )}
                      </div>
                      <div className={styles.batchStats}>
                        <div className={styles.batchOccBar}>
                          <div
                            className={styles.batchOccFill}
                            style={{ width: `${batchOcc}%` }}
                          />
                        </div>
                        <span className={styles.batchOccLabel}>{batchOcc}%</span>
                      </div>
                      <div className={styles.batchNumbers}>
                        <span>{batch.tickets_sold} / {batch.total_seats}</span>
                        <span className={styles.batchPrice}>{fmtCurrency(batch.price)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
