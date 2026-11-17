import { useEffect, useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import Button from '@/components/ui/Button'
import ScheduleList from './ScheduleList'
import ScheduleModal from './ScheduleModal'
import { useScheduleStore } from '@/store/scheduleStore'
import { useAuthStore } from '@/store/authStore'
import { can } from '@/utils/permissions'
import styles from './Schedule.module.css'

/** Aba "Agenda" da página da produção (RF15–RF17). */
export default function ProductionSchedule({ production }) {
  const user = useAuthStore((s) => s.user)
  const { events, loading, fetchEvents } = useScheduleStore()
  const [scope, setScope] = useState('upcoming')
  const [modal, setModal] = useState(null) // null | 'new' | evento

  useEffect(() => {
    const params = { production_id: production.id }
    if (scope === 'upcoming') {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      params.start = today.toISOString()
    }
    fetchEvents(params)
  }, [production.id, scope])

  return (
    <div className={styles.tabWrap}>
      <div className={styles.toolbar}>
        <div className={styles.segment} role="group" aria-label="Período">
          {[['upcoming', 'Próximos'], ['all', 'Todos, incluindo passados']].map(([key, label]) => (
            <button key={key} type="button" aria-pressed={scope === key}
              className={`${styles.segBtn} ${scope === key ? styles.segOn : ''}`} onClick={() => setScope(key)}>
              {label}
            </button>
          ))}
        </div>
        {can(user, 'SCHEDULE_WRITE') && (
          <Button variant="primary" size="sm" leftIcon={CalendarPlus} onClick={() => setModal('new')}>
            Novo evento
          </Button>
        )}
      </div>

      {loading && !events.length ? <p className={styles.muted}>Carregando agenda…</p> : (
        <ScheduleList events={events} onEdit={(ev) => setModal(ev)}
          emptyText={scope === 'upcoming' ? 'Nenhum evento futuro agendado.' : 'Nenhum evento registrado.'} />
      )}

      <ScheduleModal
        open={!!modal}
        event={modal === 'new' ? null : modal}
        production={production}
        onClose={() => setModal(null)}
      />
    </div>
  )
}
