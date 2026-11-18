import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search } from 'lucide-react'
import { useProductionStore } from '@/store/productionStore'
import { useAuthStore } from '@/store/authStore'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/Badge'
import ProductionTimeline from '@/components/modules/ProductionTimeline'
import ProductionFormModal from '@/components/modules/ProductionFormModal'
import { Flourish } from '@/components/ui/Ornament'
import { parseDate } from '@/utils/helpers'
import { can } from '@/utils/permissions'
import { GENRES } from '@/utils/labels'
import { Select } from '@/components/ui/Field'
import { useWorkStore } from '@/store/workStore'
import styles from './Productions.module.css'

const STATUS_FILTERS = [
  { label: 'Todas',          value: '' },
  { label: 'Desenvolvimento', value: 'development' },
  { label: 'Pré-Produção',   value: 'pre_production' },
  { label: 'Ensaios',        value: 'rehearsal' },
  { label: 'Em Cartaz',      value: 'performance' },
  { label: 'Arquivadas',     value: 'archived' },
]

export default function Productions() {
  const { user } = useAuthStore()
  const { productions, fetchProductions, createProduction, loading, error, clearError } = useProductionStore()

  const [search, setSearch]       = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatus] = useState('')
  const [view, setView]           = useState('grid')
  const [params, setParams]       = useSearchParams()
  const companyFilter             = params.get('company') ?? ''
  const { companies, fetchCompanies } = useWorkStore()
  const [showCreate, setCreate]   = useState(false)

  // Debounce search input — avoids API call on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    fetchProductions({ status: statusFilter || undefined, search: debouncedSearch || undefined, company_id: companyFilter || undefined })
  }, [statusFilter, debouncedSearch, companyFilter])

  useEffect(() => { fetchCompanies() }, [])

  const canCreate = can(user, 'PRODUCTION_WRITE')

  const handleCreate = async (data) => {
    const result = await createProduction(data)
    if (result) { setCreate(false); return true }
    return useProductionStore.getState().error ?? 'Erro ao criar produção. Verifique suas permissões.'
  }

  const openCreate = () => { clearError(); setCreate(true) }

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

        {companies.length > 0 && (
          <Select aria-label="Companhia" placeholder="Todas as companhias" value={companyFilter}
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(e) => setParams(e.target.value ? { company: e.target.value } : {})} />
        )}

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
                      {prod.genre && <span className={styles.genre}>{GENRES[prod.genre] ?? prod.genre}</span>}
                    </div>
                    <h2 className={styles.cardTitle}>{prod.title}</h2>
                    {prod.playwright && (
                      <p className={styles.cardPlaywright}>por {prod.playwright}</p>
                    )}
                    {prod.company && <p className={styles.cardCompany}>{prod.company.name}</p>}
                    <Flourish width={120} className={styles.cardFlourish} />
                    {prod.synopsis && (
                      <p className={styles.cardSynopsis}>{prod.synopsis}</p>
                    )}
                    <div className={styles.cardFooter}>
                      {prod.venue && <span className={styles.cardVenue}>{prod.venue}</span>}
                      {prod.first_performance_date && (
                        <span className={styles.cardDate}>
                          {parseDate(prod.first_performance_date).toLocaleDateString('pt-BR', {
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
      <ProductionFormModal
        open={showCreate}
        onClose={() => setCreate(false)}
        onSubmit={handleCreate}
        loading={loading}
      />
    </div>
  )
}

