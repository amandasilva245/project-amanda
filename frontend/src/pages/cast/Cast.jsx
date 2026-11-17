import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, UserPlus, Users, Theater, Mail, Phone } from 'lucide-react'
import { useCastStore } from '@/store/castStore'
import { useProductionStore } from '@/store/productionStore'
import { useAuthStore } from '@/store/authStore'
import { passwordProblem } from '@/utils/helpers'
import Avatar from '@/components/ui/Avatar'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { StatusBadge } from '@/components/ui/Badge'
import styles from './Cast.module.css'

const ROLE_OPTIONS = [
  { value: 'actor',             label: 'Ator / Atriz' },
  { value: 'director',          label: 'Diretor(a)' },
  { value: 'technician',        label: 'Técnico(a)' },
  { value: 'producer',          label: 'Produtor(a)' },
  { value: 'financial_manager', label: 'Gestor(a) Financeiro' },
]

const DEPT_OPTIONS = [
  { value: 'cast',           label: 'Elenco' },
  { value: 'direction',      label: 'Direção' },
  { value: 'technical',      label: 'Técnico' },
  { value: 'production',     label: 'Produção' },
  { value: 'administration', label: 'Administração' },
]

const ROLE_COLORS = {
  actor: 'var(--spotlight)',
  director: 'var(--iris)',
  technician: 'var(--info)',
  producer: 'var(--success)',
  financial_manager: 'var(--text-muted)',
  admin: 'var(--error)',
}

const emptyForm = {
  full_name: '', email: '', password: '', role: 'actor', phone: '', bio: '',
}
const emptyAssign = {
  production_id: '', role_title: '', department: 'cast', character_name: '',
}

export default function Cast() {
  const { members, loading, error, fetchMembers, createMember, assignToProduction, clearError } = useCastStore()
  const { productions, fetchProductions } = useProductionStore()
  // Cadastrar pessoas é exclusivo do admin na API (POST /auth/users)
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin')
  // Pessoa já criada quando o vínculo à produção falha: evita recriá-la (409)
  const [createdMember, setCreatedMember] = useState(null)

  const [search, setSearch]       = useState('')
  const [activeTab, setActiveTab] = useState('people')
  const [showAdd, setShowAdd]     = useState(false)
  const [step, setStep]           = useState(1)
  const [form, setForm]           = useState(emptyForm)
  const [assign, setAssign]       = useState(emptyAssign)
  const [formError, setFormError] = useState(null)

  useEffect(() => {
    fetchMembers()
    fetchProductions()
  }, [])

  const filtered = members.filter((m) =>
    !search ||
    m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase())
  )

  const resetAndClose = () => {
    setShowAdd(false)
    setStep(1)
    setForm(emptyForm)
    setAssign(emptyAssign)
    setFormError(null)
    setCreatedMember(null)
    clearError()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)

    if (step === 1) {
      if (!form.full_name.trim()) { setFormError('Nome completo é obrigatório.'); return }
      if (!form.email.trim())     { setFormError('E-mail é obrigatório.'); return }
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) { setFormError('Informe um e-mail válido.'); return }
      const pwdErr = passwordProblem(form.password)
      if (pwdErr) { setFormError(pwdErr); return }
      setStep(2)
      return
    }

    // Step 2: create member, then optionally assign
    const member = createdMember ?? await createMember({
      full_name: form.full_name,
      email:     form.email,
      password:  form.password,
      role:      form.role,
      phone:     form.phone  || undefined,
      bio:       form.bio    || undefined,
    })

    if (!member) {
      setFormError(useCastStore.getState().error ?? 'Erro ao cadastrar. Verifique os dados.')
      return
    }
    setCreatedMember(member)

    if (assign.production_id && !assign.role_title.trim()) {
      setFormError('Informe a função na produção ou deixe "Não vincular agora".')
      return
    }

    if (assign.production_id && assign.role_title.trim()) {
      const ok = await assignToProduction(assign.production_id, {
        user_id:        member.id,
        role_title:     assign.role_title,
        department:     assign.department,
        character_name: assign.character_name || undefined,
      })
      if (!ok) {
        setFormError(
          `${member.full_name} foi cadastrado(a), mas o vínculo à produção falhou: ` +
          (useCastStore.getState().error ?? 'tente novamente.')
        )
        return
      }
    }

    resetAndClose()
    fetchProductions() // refresh productions to update participant counts
  }

  // For "By Production" tab: show basic production cards with link to detail
  const productionsWithMembers = productions.filter((p) => {
    if (!activeTab) return true
    return true // show all in by-production view; participant details are in production detail
  })

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <p className="overline">Companhia</p>
          <h1 className={styles.title}>Elenco & Equipe</h1>
        </div>
        <div className={styles.headerActions}>
          {activeTab === 'people' && (
            <p className={styles.count}>{filtered.length} pessoa{filtered.length !== 1 ? 's' : ''}</p>
          )}
          {isAdmin && (
            <Button variant="primary" leftIcon={UserPlus} onClick={() => { resetAndClose(); setShowAdd(true) }}>
              Adicionar Pessoa
            </Button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <Input
          placeholder={activeTab === 'people' ? 'Buscar por nome ou e-mail…' : 'Buscar produções…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={Search}
          wrapperClass={styles.search}
        />
        <div className={styles.tabs}>
          {[
            { key: 'people',     label: 'Pessoas',          icon: Users   },
            { key: 'by_prod',    label: 'Por Produção',     icon: Theater },
          ].map((t) => (
            <button
              key={t.key}
              className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              <t.icon size={14} strokeWidth={1.75} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── People Tab ── */}
      {activeTab === 'people' && (
        <div className={styles.grid}>
          {filtered.map((m, i) => (
            <motion.div
              key={m.id}
              className={styles.card}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className={styles.cardTop}>
                <Avatar name={m.full_name} src={m.avatar_url} size="lg" />
                <div className={styles.info}>
                  <p className={styles.name}>{m.full_name}</p>
                  <span
                    className={styles.roleBadge}
                    style={{ color: ROLE_COLORS[m.role] ?? 'var(--text-muted)' }}
                  >
                    {ROLE_OPTIONS.find((r) => r.value === m.role)?.label ?? m.role}
                  </span>
                </div>
              </div>

              <div className={styles.contactList}>
                {m.email && (
                  <span className={styles.contactItem}>
                    <Mail size={11} strokeWidth={2} />
                    <span className={styles.contactText}>{m.email}</span>
                  </span>
                )}
                {m.phone && (
                  <span className={styles.contactItem}>
                    <Phone size={11} strokeWidth={2} />
                    <span className={styles.contactText}>{m.phone}</span>
                  </span>
                )}
              </div>

              {m.bio && <p className={styles.bio}>{m.bio}</p>}

              {!m.is_active && (
                <span className={styles.inactiveBadge}>Inativo</span>
              )}
            </motion.div>
          ))}

          {!loading && filtered.length === 0 && (
            <div className={styles.empty}>
              <Users size={32} strokeWidth={1} style={{ color: 'var(--text-disabled)' }} />
              <p className={styles.emptyTitle}>
                {error
                  ? error
                  : search ? 'Nenhuma pessoa encontrada.' : 'Nenhum membro cadastrado ainda.'}
              </p>
              {!search && !error && isAdmin && (
                <Button variant="outline" leftIcon={UserPlus} onClick={() => { resetAndClose(); setShowAdd(true) }}>
                  Adicionar Primeiro Membro
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── By Production Tab ── */}
      {activeTab === 'by_prod' && (
        <div className={styles.prodGroups}>
          {productions
            .filter((p) => !search || p.title.toLowerCase().includes(search.toLowerCase()))
            .map((prod) => (
              <motion.div
                key={prod.id}
                className={styles.prodGroup}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className={styles.prodGroupHeader}>
                  <div
                    className={styles.prodAccent}
                    style={{ background: prod.color_accent ?? 'var(--spotlight)' }}
                  />
                  <div className={styles.prodGroupInfo}>
                    <h3 className={styles.prodGroupTitle}>{prod.title}</h3>
                    {prod.playwright && (
                      <p className={styles.prodGroupSub}>por {prod.playwright}</p>
                    )}
                  </div>
                  <StatusBadge status={prod.status} />
                </div>
                <div className={styles.prodGroupFooter}>
                  {prod.venue && <span className={styles.prodGroupVenue}>{prod.venue}</span>}
                  <Link
                    to={`/productions/${prod.id}`}
                    className={styles.prodGroupLink}
                  >
                    Ver elenco completo →
                  </Link>
                </div>
              </motion.div>
            ))}

          {productions.length === 0 && (
            <div className={styles.empty}>
              <Theater size={32} strokeWidth={1} style={{ color: 'var(--text-disabled)' }} />
              <p className={styles.emptyTitle}>Nenhuma produção cadastrada.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Add Person Modal ── */}
      <Modal
        open={showAdd}
        onClose={resetAndClose}
        title={step === 1 ? 'Nova Pessoa' : 'Atribuir à Produção'}
        description={
          step === 1
            ? 'Cadastrar novo membro da equipe ou elenco.'
            : 'Opcional: vincular à uma produção já neste cadastro.'
        }
        size="md"
      >
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          {/* Step 1: Personal info */}
          {step === 1 && (
            <>
              <Input
                label="Nome Completo *"
                placeholder="Nome do artista ou técnico"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                autoFocus
              />

              <div className={styles.formRow}>
                <Input
                  label="E-mail *"
                  type="email"
                  placeholder="contato@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <Input
                  label="Senha *"
                  type="password"
                  placeholder="Senha de acesso ao sistema"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Função / Cargo *</label>
                  <select
                    className={styles.select}
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Telefone"
                  type="tel"
                  placeholder="+55 11 99999-0000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Bio / Notas</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Experiência, observações relevantes…"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Step 2: Optional production assignment */}
          {step === 2 && (
            <>
              <div className={styles.stepSummary}>
                <Avatar name={form.full_name} size="sm" />
                <div>
                  <p className={styles.stepName}>{form.full_name}</p>
                  <p className={styles.stepRole}>
                    {ROLE_OPTIONS.find((r) => r.value === form.role)?.label ?? form.role}
                  </p>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Produção (opcional)</label>
                <select
                  className={styles.select}
                  value={assign.production_id}
                  onChange={(e) => setAssign({ ...assign, production_id: e.target.value })}
                >
                  <option value="">— Não vincular agora —</option>
                  {productions.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              {assign.production_id && (
                <>
                  <div className={styles.formRow}>
                    <Input
                      label="Papel / Título na Produção *"
                      placeholder="ex: Hamlet, Diretor de Arte"
                      value={assign.role_title}
                      onChange={(e) => setAssign({ ...assign, role_title: e.target.value })}
                    />
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Departamento</label>
                      <select
                        className={styles.select}
                        value={assign.department}
                        onChange={(e) => setAssign({ ...assign, department: e.target.value })}
                      >
                        {DEPT_OPTIONS.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Input
                    label="Nome do Personagem (se ator)"
                    placeholder="ex: Hamlet, Ofélia"
                    value={assign.character_name}
                    onChange={(e) => setAssign({ ...assign, character_name: e.target.value })}
                  />
                </>
              )}
            </>
          )}

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
            {step === 2 && (
              <Button variant="ghost" type="button" onClick={() => setStep(1)}>
                ← Voltar
              </Button>
            )}
            <Button variant="ghost" type="button" onClick={resetAndClose}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" loading={loading}>
              {step === 1 ? 'Próximo →' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

