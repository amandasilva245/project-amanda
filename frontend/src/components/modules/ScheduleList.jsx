import { useState } from 'react'
import { format, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock, MapPin, Pencil, Ban, RotateCcw, CalendarX } from 'lucide-react'
import Badge, { StatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Input from '@/components/ui/Input'
import { useScheduleStore } from '@/store/scheduleStore'
import { useAuthStore } from '@/store/authStore'
import { can } from '@/utils/permissions'
import { SCHEDULE_TYPES } from '@/utils/labels'
import styles from './Schedule.module.css'

const TYPE_VARIANT = {
  rehearsal: 'warning', dress_rehearsal: 'warning', performance: 'success',
  meeting: 'iris', workshop: 'neutral', tech_run: 'neutral',
}

/** Lista de eventos agrupada por dia, com presença e ações. */
export default function ScheduleList({ events, onEdit, showProduction = false, emptyText = 'Nenhum evento no período.' }) {
  const user = useAuthStore((s) => s.user)
  const { cancelEvent, restoreEvent, setAttendance, error } = useScheduleStore()
  const canWrite = can(user, 'SCHEDULE_WRITE')
  const [cancelling, setCancelling] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  if (!events.length) {
    return (
      <div className={styles.empty}>
        <CalendarX size={30} strokeWidth={1} />
        <p>{emptyText}</p>
      </div>
    )
  }

  const days = []
  events.forEach((ev) => {
    const d = new Date(ev.start_time)
    const last = days[days.length - 1]
    if (last && isSameDay(last.date, d)) last.items.push(ev)
    else days.push({ date: d, items: [ev] })
  })

  const confirmCancel = async () => {
    setBusy(true)
    const ok = await cancelEvent(cancelling.id, reason)
    setBusy(false)
    if (ok) { setCancelling(null); setReason('') }
  }

  return (
    <div className={styles.days}>
      {error && <p className={styles.errorLine} role="alert">{error}</p>}
      {days.map((day) => (
        <section key={day.date.toISOString()} className={styles.day}>
          <h3 className={styles.dayTitle}>
            <span className={styles.dayNum}>{format(day.date, 'dd')}</span>
            <span className={styles.dayName}>{format(day.date, "EEEE · MMMM 'de' yyyy", { locale: ptBR })}</span>
          </h3>
          <div className={styles.dayItems}>
            {day.items.map((ev) => {
              const mine = ev.attendees.find((a) => a.user.id === user?.id)
              return (
                <article key={ev.id} className={`${styles.event} ${ev.is_cancelled ? styles.cancelled : ''}`}
                  style={{ '--accent': ev.production?.color_accent ?? 'var(--gold)' }}>
                  <div className={styles.eventMain}>
                    <div className={styles.eventTop}>
                      <Badge variant={TYPE_VARIANT[ev.type] ?? 'neutral'}>{SCHEDULE_TYPES[ev.type] ?? ev.type}</Badge>
                      {ev.is_cancelled && <Badge variant="error">Cancelado</Badge>}
                      {showProduction && <span className={styles.eventProd}>{ev.production?.title}</span>}
                    </div>
                    <h4 className={styles.eventTitle}>{ev.title}</h4>
                    <div className={styles.eventMeta}>
                      <span><Clock size={12} strokeWidth={1.75} />
                        {format(new Date(ev.start_time), 'HH:mm')}–{format(new Date(ev.end_time), 'HH:mm')}
                      </span>
                      {ev.location && <span><MapPin size={12} strokeWidth={1.75} />{ev.location}</span>}
                    </div>
                    {ev.description && <p className={styles.eventDesc}>{ev.description}</p>}
                    {canWrite && ev.notes && <p className={styles.eventDesc}><strong>Notas internas:</strong> {ev.notes}</p>}
                    {ev.is_cancelled && ev.cancel_reason && (
                      <p className={styles.eventDesc}>Motivo: {ev.cancel_reason}</p>
                    )}

                    {ev.attendees.length > 0 && (
                      <ul className={styles.attendees} aria-label="Convidados e presença">
                        {ev.attendees.map((a) => (
                          <li key={a.user.id} className={styles.attendee}>
                            <span>{a.user.full_name}</span>
                            {canWrite && !ev.is_cancelled ? (
                              <select className={styles.miniSelect} value={a.status}
                                aria-label={`Presença de ${a.user.full_name}`}
                                onChange={(e) => setAttendance(ev.id, a.user.id, e.target.value)}>
                                <option value="invited">Convidado</option>
                                <option value="confirmed">Confirmado</option>
                                <option value="absent">Ausente</option>
                              </select>
                            ) : (
                              <StatusBadge status={a.status} />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {mine && !canWrite && !ev.is_cancelled && (
                      <div className={styles.myRsvp}>
                        <Button size="sm" variant={mine.status === 'confirmed' ? 'primary' : 'outline'}
                          onClick={() => setAttendance(ev.id, user.id, 'confirmed')}>
                          Vou participar
                        </Button>
                        <Button size="sm" variant={mine.status === 'absent' ? 'destructive' : 'ghost'}
                          onClick={() => setAttendance(ev.id, user.id, 'absent')}>
                          Não poderei ir
                        </Button>
                      </div>
                    )}
                  </div>

                  {canWrite && (
                    <div className={styles.eventActions}>
                      {!ev.is_cancelled && (
                        <>
                          <button type="button" className={styles.iconBtn} onClick={() => onEdit?.(ev)}
                            title="Editar" aria-label={`Editar ${ev.title}`}>
                            <Pencil size={14} strokeWidth={1.75} />
                          </button>
                          <button type="button" className={`${styles.iconBtn} ${styles.iconDanger}`}
                            onClick={() => setCancelling(ev)} title="Cancelar evento" aria-label={`Cancelar ${ev.title}`}>
                            <Ban size={14} strokeWidth={1.75} />
                          </button>
                        </>
                      )}
                      {ev.is_cancelled && (
                        <button type="button" className={styles.iconBtn} onClick={() => restoreEvent(ev.id)}
                          title="Reativar" aria-label={`Reativar ${ev.title}`}>
                          <RotateCcw size={14} strokeWidth={1.75} />
                        </button>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      ))}

      <ConfirmDialog
        open={!!cancelling}
        title="Cancelar evento"
        message={
          <>
            “{cancelling?.title}” continuará no histórico, marcado como cancelado.
            <span className={styles.reasonField}>
              <Input label="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} />
            </span>
          </>
        }
        confirmLabel="Cancelar evento"
        loading={busy}
        onConfirm={confirmCancel}
        onClose={() => { setCancelling(null); setReason('') }}
      />
    </div>
  )
}
