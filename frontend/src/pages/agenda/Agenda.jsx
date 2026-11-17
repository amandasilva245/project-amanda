import { useEffect, useMemo, useState } from 'react'
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarPlus } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Select, Checkbox } from '@/components/ui/Field'
import ScheduleList from '@/components/modules/ScheduleList'
import ScheduleModal from '@/components/modules/ScheduleModal'
import { useScheduleStore } from '@/store/scheduleStore'
import { useProductionStore } from '@/store/productionStore'
import { useAuthStore } from '@/store/authStore'
import { can } from '@/utils/permissions'
import { Flourish } from '@/components/ui/Ornament'
import styles from './Agenda.module.css'

/** Agenda geral: todas as produções, por mês, com filtro por produção e pessoa. */
export default function Agenda() {
  const user = useAuthStore((s) => s.user)
  const { events, loading, error, fetchEvents } = useScheduleStore()
  const { productions, fetchProductions } = useProductionStore()
  const canWrite = can(user, 'SCHEDULE_WRITE')

  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [productionId, setProductionId] = useState('')
  const [onlyMine, setOnlyMine] = useState(!canWrite)
  const [showCancelled, setShowCancelled] = useState(true)
  const [modal, setModal] = useState(null)

  useEffect(() => { fetchProductions() }, [])

  useEffect(() => {
    const params = {
      start: startOfMonth(month).toISOString(),
      end: endOfMonth(month).toISOString(),
      include_cancelled: showCancelled,
    }
    if (productionId) params.production_id = productionId
    if (onlyMine && user) params.user_id = user.id
    fetchEvents(params)
  }, [month, productionId, onlyMine, showCancelled, user?.id])

  const productionOptions = useMemo(
    () => productions.map((p) => ({ value: p.id, label: p.title })),
    [productions],
  )

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className="overline">Palco</p>
          <h1 className={styles.title}>Agenda</h1>
        </div>
        {canWrite && (
          <Button variant="primary" leftIcon={CalendarPlus} onClick={() => setModal('new')}>
            Novo evento
          </Button>
        )}
      </header>

      <div className={styles.toolbar}>
        <div className={styles.monthNav}>
          <button type="button" className={styles.navBtn} aria-label="Mês anterior" onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeft size={16} />
          </button>
          <span className={styles.monthLabel}>{format(month, "MMMM 'de' yyyy", { locale: ptBR })}</span>
          <button type="button" className={styles.navBtn} aria-label="Próximo mês" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight size={16} />
          </button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>Hoje</Button>
        </div>
        <div className={styles.filters}>
          <div className={styles.prodFilter}>
            <Select aria-label="Filtrar por produção" placeholder="Todas as produções" options={productionOptions}
              value={productionId} onChange={(e) => setProductionId(e.target.value)} />
          </div>
          <Checkbox label="Só a minha agenda" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
          <Checkbox label="Mostrar cancelados" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
        </div>
      </div>

      <Flourish className={styles.flourish} />

      {error && <p className={styles.error} role="alert">{error}</p>}
      {loading && !events.length ? <p className={styles.muted}>Carregando…</p> : (
        <ScheduleList events={events} showProduction onEdit={(ev) => setModal(ev)}
          emptyText="Nenhum evento neste mês." />
      )}

      <ScheduleModal
        open={!!modal}
        event={modal === 'new' ? null : modal}
        productions={productions}
        onClose={() => setModal(null)}
      />
    </div>
  )
}
