import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Calendar, MapPin, DollarSign, Edit, Trash2, UserPlus, Pencil, X } from 'lucide-react'
import { format } from 'date-fns'
import { useProductionStore } from '@/store/productionStore'
import { useAuthStore } from '@/store/authStore'
import { StatusBadge } from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ProductionFormModal from '@/components/modules/ProductionFormModal'
import ParticipantModal from '@/components/modules/ParticipantModal'
import ProductionSchedule from '@/components/modules/ProductionSchedule'
import ProductionFinance from '@/components/modules/ProductionFinance'
import { parseDate } from '@/utils/helpers'
import { can } from '@/utils/permissions'
import { DEPARTMENTS, GENRES, fmtBRL } from '@/utils/labels'
import styles from './ProductionDetail.module.css'

const DEPT_COLORS = {
  cast: 'var(--spotlight)',
  direction: 'var(--iris)',
  technical: 'var(--info)',
  production: 'var(--success)',
  administration: 'var(--text-muted)',
}

const STATUS_FLOW = [
  { key: 'development',    label: 'Desenvolvimento' },
  { key: 'pre_production', label: 'Pré-produção' },
  { key: 'rehearsal',      label: 'Ensaios' },
  { key: 'performance',    label: 'Em cartaz' },
  { key: 'archived',       label: 'Arquivada' },
]

const fmtDate = (d) => (d ? format(parseDate(d), 'dd/MM/yyyy') : null)

export default function ProductionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const {
    currentProduction: prod, fetchProductionById, loading, error,
    updateProduction, deleteProduction, updateParticipant, removeParticipant,
  } = useProductionStore()

  const [activeTab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [participantModal, setParticipantModal] = useState(null) // null | 'new' | participante
  const [removing, setRemoving] = useState(null)

  const canEdit = can(user, 'PRODUCTION_WRITE')
  const canDelete = can(user, 'PRODUCTION_DELETE')

  useEffect(() => {
    // Durante a animação de saída da página o id some da URL; sem esta
    // checagem era feita uma chamada para /productions/undefined (404).
    if (id) fetchProductionById(id)
  }, [id])

  if (!loading && error && (!prod || prod.id !== id)) {
    return (
      <div className={styles.page}>
        <Link to="/productions" className={styles.backLink}>
          <ArrowLeft size={14} strokeWidth={2} /> Todas as produções
        </Link>
        <p className={styles.scheduleEmpty}>{error}</p>
      </div>
    )
  }

  if (loading || !prod || prod.id !== id) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    )
  }

  const currentStep = STATUS_FLOW.findIndex((s) => s.key === prod.status)

  const deptGroups = (prod.participants ?? []).reduce((acc, p) => {
    const dept = p.department
    if (!acc[dept]) acc[dept] = []
    acc[dept].push(p)
    return acc
  }, {})

  const handleSave = async (data) => {
    setSaving(true)
    const ok = await updateProduction(prod.id, data)
    setSaving(false)
    if (ok) { setEditing(false); return true }
    return useProductionStore.getState().error
  }

  const handleDelete = async () => {
    setSaving(true)
    const ok = await deleteProduction(prod.id)
    setSaving(false)
    if (ok) navigate('/productions')
    else setActionError(useProductionStore.getState().error)
  }

  const handleRemove = async () => {
    setSaving(true)
    const ok = await removeParticipant(prod.id, removing.id)
    setSaving(false)
    if (ok) setRemoving(null)
    else setActionError(useProductionStore.getState().error)
  }

  const toggleFlag = async (m, field) => {
    await updateParticipant(prod.id, m.id, { [field]: !m[field] })
  }

  const tabs = [
    { key: 'overview', label: 'Visão geral' },
    { key: 'cast', label: 'Companhia' },
    { key: 'schedule', label: 'Agenda' },
    ...(can(user, 'FINANCE_WRITE') ? [{ key: 'finance', label: 'Financeiro' }] : []),
  ]

  return (
    <div className={styles.page}>
      {/* Back Nav */}
      <Link to="/productions" className={styles.backLink}>
        <ArrowLeft size={14} strokeWidth={2} />
        Todas as produções
      </Link>

      {/* Hero */}
      <motion.div
        className={styles.hero}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          className={styles.heroAccent}
          style={{ background: `linear-gradient(135deg, ${prod.color_accent ?? '#A9874A'}22, transparent)` }}
        />
        <div className={styles.heroContent}>
          <div className={styles.heroTop}>
            <StatusBadge status={prod.status} />
            {prod.genre && <span className={styles.heroGenre}>{GENRES[prod.genre] ?? prod.genre}</span>}
            {(canEdit || canDelete) && (
              <div className={styles.heroActions}>
                {canEdit && (
                  <Button variant="outline" size="sm" leftIcon={Edit} onClick={() => setEditing(true)}>
                    Editar
                  </Button>
                )}
                {canDelete && (
                  <Button variant="destructive" size="sm" leftIcon={Trash2}
                    onClick={() => { setActionError(null); setConfirmDelete(true) }}>
                    Excluir
                  </Button>
                )}
              </div>
            )}
          </div>
          <h1 className={styles.heroTitle}>{prod.title}</h1>
          {prod.playwright && (
            <p className={styles.heroPlaywright}>de {prod.playwright}</p>
          )}
          {prod.synopsis && (
            <p className={styles.heroSynopsis}>{prod.synopsis}</p>
          )}

          <div className={styles.heroMeta}>
            {prod.venue && (
              <span className={styles.metaItem}>
                <MapPin size={13} strokeWidth={1.75} />
                {prod.venue}
              </span>
            )}
            {prod.first_performance_date && (
              <span className={styles.metaItem}>
                <Calendar size={13} strokeWidth={1.75} />
                Estreia {fmtDate(prod.first_performance_date)}
              </span>
            )}
            {prod.budget_total != null && Number(prod.budget_total) > 0 && (
              <span className={styles.metaItem}>
                <DollarSign size={13} strokeWidth={1.75} />
                Orçamento: {fmtBRL(prod.budget_total, 0)}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Status Pipeline */}
      <div className={styles.pipeline}>
        {STATUS_FLOW.map((step, i) => {
          const isActive   = i === currentStep
          const isPast     = i < currentStep
          const isFuture   = i > currentStep
          return (
            <div key={step.key} className={styles.pipelineStep}>
              <div
                className={`${styles.pipelineDot}
                  ${isActive ? styles.dotActive : ''}
                  ${isPast   ? styles.dotPast   : ''}
                  ${isFuture ? styles.dotFuture : ''}`}
              />
              <span className={`${styles.pipelineLabel} ${isActive ? styles.labelActive : ''}`}>
                {step.label}
              </span>
              {i < STATUS_FLOW.length - 1 && (
                <div className={`${styles.pipelineConnector} ${isPast ? styles.connectorPast : ''}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className={styles.tabs} role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div className={styles.overviewGrid}>
          <div className={styles.infoCard}>
            <p className="overline">Detalhes</p>
            <div className={styles.infoRows}>
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Status</span>
                <StatusBadge status={prod.status} />
              </div>
              {prod.start_date && (
                <div className={styles.infoRow}>
                  <span className={styles.infoKey}>Início</span>
                  <span className={styles.infoVal}>{fmtDate(prod.start_date)}</span>
                </div>
              )}
              {prod.end_date && (
                <div className={styles.infoRow}>
                  <span className={styles.infoKey}>Encerramento</span>
                  <span className={styles.infoVal}>{fmtDate(prod.end_date)}</span>
                </div>
              )}
              {prod.venue_capacity && (
                <div className={styles.infoRow}>
                  <span className={styles.infoKey}>Capacidade</span>
                  <span className={styles.infoVal}>{prod.venue_capacity.toLocaleString('pt-BR')} lugares</span>
                </div>
              )}
              {prod.budget_total != null && Number(prod.budget_total) > 0 && (
                <div className={styles.infoRow}>
                  <span className={styles.infoKey}>Orçamento</span>
                  <span className={styles.infoVal}>{fmtBRL(prod.budget_total, 0)}</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.castPreview}>
            <p className="overline">Companhia — {prod.participants?.length ?? 0} participações</p>
            <div className={styles.castGrid}>
              {(prod.participants ?? []).slice(0, 8).map((p) => (
                <div key={p.id} className={styles.castItem}>
                  <Avatar name={p.user.full_name} src={p.user.avatar_url} size="sm" />
                  <div className={styles.castInfo}>
                    <span className={styles.castName}>{p.user.full_name}</span>
                    <span className={styles.castRole}>{p.role_title}</span>
                  </div>
                  {p.is_lead && (
                    <span className={styles.leadBadge}>Principal</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cast' && (
        <div className={styles.castDepts}>
          {canEdit && (
            <div className={styles.sectionHead}>
              <p className={styles.sectionHint}>
                Uma mesma pessoa pode acumular funções: adicione uma participação para cada uma.
              </p>
              <Button variant="primary" size="sm" leftIcon={UserPlus} onClick={() => setParticipantModal('new')}>
                Adicionar participante
              </Button>
            </div>
          )}
          {actionError && <p className={styles.actionError} role="alert">{actionError}</p>}
          {Object.keys(deptGroups).length === 0 && (
            <p className={styles.scheduleEmpty}>Ninguém foi escalado ainda.</p>
          )}
          {Object.entries(deptGroups).map(([dept, members]) => (
            <div key={dept} className={styles.deptGroup}>
              <div className={styles.deptHeader}>
                <div
                  className={styles.deptBar}
                  style={{ background: DEPT_COLORS[dept] ?? 'var(--text-muted)' }}
                />
                <p className={styles.deptName}>{DEPARTMENTS[dept] ?? dept}</p>
                <span className={styles.deptCount}>{members.length}</span>
              </div>
              <div className={styles.memberGrid}>
                {members.map((m) => (
                  <div key={m.id} className={styles.memberCard}>
                    <Avatar name={m.user.full_name} src={m.user.avatar_url} size="md" />
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>{m.user.full_name}</span>
                      <span className={styles.memberRole}>{m.role_title}</span>
                      {m.character_name && (
                        <span className={styles.memberChar}>como {m.character_name}</span>
                      )}
                      {canEdit && m.fee != null && (
                        <span className={styles.memberFee}>
                          Cachê {fmtBRL(m.fee)} · pago {fmtBRL(m.fee_paid ?? 0)}
                        </span>
                      )}
                      {canEdit && (
                        <div className={styles.memberFlags}>
                          <button type="button" className={`${styles.flag} ${m.is_lead ? styles.flagOn : ''}`}
                            aria-pressed={m.is_lead} onClick={() => toggleFlag(m, 'is_lead')}>
                            Principal
                          </button>
                          <button type="button" className={`${styles.flag} ${m.is_confirmed ? styles.flagOn : ''}`}
                            aria-pressed={m.is_confirmed} onClick={() => toggleFlag(m, 'is_confirmed')}>
                            Confirmado
                          </button>
                        </div>
                      )}
                    </div>
                    {!canEdit && m.is_confirmed && (
                      <span className={styles.confirmedDot} title="Confirmado" />
                    )}
                    {canEdit && (
                      <div className={styles.memberActions}>
                        <button type="button" className={styles.iconBtn} title="Editar participação"
                          aria-label={`Editar participação de ${m.user.full_name}`}
                          onClick={() => setParticipantModal(m)}>
                          <Pencil size={14} strokeWidth={1.75} />
                        </button>
                        <button type="button" className={`${styles.iconBtn} ${styles.iconDanger}`} title="Remover da produção"
                          aria-label={`Remover ${m.user.full_name} da produção`}
                          onClick={() => { setActionError(null); setRemoving(m) }}>
                          <X size={14} strokeWidth={2} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'schedule' && <ProductionSchedule production={prod} />}

      {activeTab === 'finance' && <ProductionFinance production={prod} />}

      <ProductionFormModal
        open={editing}
        initial={prod}
        onClose={() => setEditing(false)}
        onSubmit={handleSave}
        loading={saving}
      />

      <ParticipantModal
        open={!!participantModal}
        production={prod}
        participant={participantModal === 'new' ? null : participantModal}
        onClose={() => setParticipantModal(null)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir produção"
        message={`"${prod.title}" será excluída junto com elenco, agenda, lançamentos e ingressos. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir definitivamente"
        loading={saving}
        error={actionError}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={!!removing}
        title="Remover participante"
        message={removing ? `Remover ${removing.user.full_name} (${removing.role_title}) desta produção?` : ''}
        confirmLabel="Remover"
        loading={saving}
        error={actionError}
        onConfirm={handleRemove}
        onClose={() => setRemoving(null)}
      />
    </div>
  )
}
