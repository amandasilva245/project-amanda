import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search } from 'lucide-react'
import { useProductionStore } from '@/store/productionStore'
import { useAuthStore } from '@/store/authStore'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/Badge'
import ProductionTimeline from '@/components/modules/ProductionTimeline'
import Modal from '@/components/ui/Modal'
import { Flourish } from '@/components/ui/Ornament'
import styles from './Productions.module.css'

const STATUS_FILTERS = [
  { label: 'Todas',          value: '' },
  { label: 'Desenvolvimento', value: 'development' },
  { label: 'Pré-Produção',   value: 'pre_production' },
  { label: 'Ensaios',        value: 'rehearsal' },
  { label: 'Em Cartaz',      value: 'performance' },
  { label: 'Arquivadas',     value: 'archived' },
]

const WRITE_ROLES = ['admin', 'producer', 'director']

export default function Productions() {
  const { user } = useAuthStore()
  const { productions, fetchProductions, createProduction, loading, error, clearError } = useProductionStore()

  const [search, setSearch]       = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatus] = useState('')
  const [view, setView]           = useState('grid')
  const [showCreate, setCreate]   = useState(false)
  const [form, setForm]           = useState({ title: '', playwright: '', venue: '', status: 'development' })
  const [formError, setFormError] = useState(null)

  // Debounce search input â€” avoids API call on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    fetchProductions({ status: statusFilter || undefined, search: debouncedSearch || undefined })
  }, [statusFilter, debouncedSearch])

  const canCreate = WRITE_ROLES.includes(user?.role)

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError(null)
    if (!form.title.trim()) { setFormError('Título é obrigatório.'); return }
    const result = await createProduction(form)
    if (result) {
      // Success â€” close and reset
      setCreate(false)
      setForm({ title: '', playwright: '', venue: '', status: 'development' })
    } else {
      // Failure â€” keep modal open, show error from store
      setFormError(error ?? 'Erro ao criar produção. Verifique suas permissões.')
    }
  }

  const openCreate = () => { clearError(); setFormError(null); setCreate(true) }

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.header}>
        <div>
          <p className="overline">Palco</p>
          <h1 className={styles.title}>Produções</h1>
        </div>
        <div className={styles.actions}>
          {canCreate && (
            <Button variant="primary" leftIcon={Plus} onClick={openCreate}>
              Nova Produção
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <Input
          placeholder="Buscar produções…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={Search}
          wrapperClass={styles.searchInput}
        />

        <div className={styles.statusFilters}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              className={`${styles.filterBtn} ${statusFilter === f.value ? styles.active : ''}`}
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${view === 'grid' ? styles.active : ''}`}
            onClick={() => setView('grid')}
          >
            Grade
          </button>
          <button
            className={`${styles.viewBtn} ${view === 'timeline' ? styles.active : ''}`}
            onClick={() => setView('timeline')}
          >
            Linha do Tempo
          </button>
        </div>
      </div>

      {/* Timeline View */}
      {view === 'timeline' && (
        <div className={styles.timelineWrap}>
          <ProductionTimeline productions={productions} />
        </div>
      )}

      {/* Grid View */}
      {view === 'grid' && (
        <div className={styles.grid}>
          {productions.map((prod, i) => (
            <motion.div
              key={prod.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link to={`/productions/${prod.id}`} className={styles.card}>
                <div className={styles.cardInner}>
                  <div
                    className={styles.colorBar}
                    style={{ background: prod.color_accent ?? 'var(--spotlight)' }}
                  />
                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}>
                      <StatusBadge status={prod.status} />
                      {prod.genre && <span className={styles.genre}>{prod.genre}</span>}
                    </div>
                    <h2 className={styles.cardTitle}>{prod.title}</h2>
                    {prod.playwright && (
                      <p className={styles.cardPlaywright}>por {prod.playwright}</p>
                    )}
                    <Flourish width={120} className={styles.cardFlourish} />
                    {prod.synopsis && (
                      <p className={styles.cardSynopsis}>{prod.synopsis}</p>
                    )}
                    <div className={styles.cardFooter}>
                      {prod.venue && <span className={styles.cardVenue}>{prod.venue}</span>}
                      {prod.first_performance_date && (
                        <span className={styles.cardDate}>
                          {new Date(prod.first_performance_date).toLocaleDateString('pt-BR', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}

          {!loading && productions.length === 0 && (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Nenhuma produção encontrada</p>
              <p className={styles.emptyText}>
                {debouncedSearch ? 'Tente um termo diferente.' : 'Crie sua primeira produção para começar.'}
              </p>
              {canCreate && !debouncedSearch && (
                <Button variant="outline" leftIcon={Plus} onClick={openCreate}>
                  Nova Produção
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => { setCreate(false); setFormError(null) }}
        title="Nova Produção"
        description="Inicie uma nova jornada teatral."
        size="md"
      >
        <form onSubmit={handleCreate} className={styles.modalForm}>
          <Input
            label="Título *"
            placeholder="ex: Romeu e Julieta"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            error={formError && !form.title.trim() ? formError : undefined}
            autoFocus
          />
          <div className={styles.formRow}>
            <Input
              label="Dramaturgo / Autor"
              placeholder="Nome do autor"
              value={form.playwright}
              onChange={(e) => setForm({ ...form, playwright: e.target.value })}
            />
            <Input
              label="Local / Teatro"
              placeholder="Nome do teatro"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
            />
          </div>
          <div className={styles.formRow}>
            <Input
              label="Data de Início"
              type="date"
              value={form.start_date ?? ''}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
            <Input
              label="Data de Encerramento"
              type="date"
              value={form.end_date ?? ''}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>

          {formError && (
            <motion.p
              className={styles.formError}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {formError}
            </motion.p>
          )}

          <div className={styles.modalActions}>
            <Button variant="ghost" type="button" onClick={() => { setCreate(false); setFormError(null) }}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" loading={loading}>
              Criar Produção
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

