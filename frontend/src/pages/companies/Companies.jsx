import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, User, MapPin, Mail, Phone, Globe, Landmark } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Textarea, formStyles as f } from '@/components/ui/Field'
import { useWorkStore } from '@/store/workStore'
import { useAuthStore } from '@/store/authStore'
import { can } from '@/utils/permissions'
import styles from './Companies.module.css'

const EMPTY = { name: '', description: '', responsible_name: '', email: '', phone: '', city: '', founded_year: '', website: '' }

function CompanyModal({ open, onClose, company }) {
  const saveCompany = useWorkStore((s) => s.saveCompany)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(company ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, company[k] == null ? '' : String(company[k])])) : EMPTY)
  }, [open, company])

  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (form.name.trim().length < 2) return setError('Informe o nome da companhia.')
    const year = form.founded_year ? Number(form.founded_year) : null
    if (year && (year < 1500 || year > new Date().getFullYear())) return setError('Ano de fundação inválido.')
    const data = { ...form, name: form.name.trim(), founded_year: year }
    if (company) Object.keys(data).forEach((k) => { if (data[k] === '') data[k] = null })
    setSaving(true)
    const ok = await saveCompany(company?.id, data)
    setSaving(false)
    if (ok === true) onClose(); else setError(ok)
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={company ? 'Editar companhia' : 'Nova companhia'}
      description="Grupo teatral responsável pelas produções.">
      <form className={f.form} onSubmit={submit} noValidate>
        <Input label="Nome *" placeholder="ex: Cia. Lanterna Mágica" value={form.name} onChange={set('name')} autoFocus />
        <Textarea label="Apresentação" rows={3} value={form.description} onChange={set('description')} />
        <div className={f.row}>
          <Input label="Responsável" value={form.responsible_name} onChange={set('responsible_name')} />
          <Input label="Cidade" value={form.city} onChange={set('city')} />
        </div>
        <div className={f.row3}>
          <Input label="E-mail" type="email" value={form.email} onChange={set('email')} />
          <Input label="Telefone" value={form.phone} onChange={set('phone')} />
          <Input label="Fundação (ano)" type="number" value={form.founded_year} onChange={set('founded_year')} />
        </div>
        <Input label="Site" value={form.website} onChange={set('website')} />
        {error && <p className={f.error} role="alert">{error}</p>}
        <div className={f.actions}>
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" loading={saving}>{company ? 'Salvar' : 'Cadastrar companhia'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Companies() {
  const user = useAuthStore((s) => s.user)
  const { companies, fetchCompanies, deleteCompany } = useWorkStore()
  const [modal, setModal] = useState(null)
  const [removing, setRemoving] = useState(null)
  const canWrite = can(user, 'COMPANY_WRITE')

  useEffect(() => { fetchCompanies() }, [])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className="overline">Organização</p>
          <h1 className={styles.title}>Companhias</h1>
          <p className={styles.lead}>Os grupos teatrais e as produções de cada um.</p>
        </div>
        {canWrite && <Button variant="primary" leftIcon={Plus} onClick={() => setModal('new')}>Nova companhia</Button>}
      </div>

      {companies.length === 0 && <p className={styles.empty}>Nenhuma companhia cadastrada.</p>}

      <div className={styles.grid}>
        {companies.map((c) => (
          <article key={c.id} className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <h2 className={styles.name}>{c.name}</h2>
                {c.founded_year && <p className={styles.since}>Desde {c.founded_year}</p>}
              </div>
              {canWrite && (
                <span className={styles.actions}>
                  <Button size="sm" variant="ghost" leftIcon={Pencil} aria-label={`Editar ${c.name}`} onClick={() => setModal(c)} />
                  <Button size="sm" variant="ghost" leftIcon={Trash2} aria-label={`Excluir ${c.name}`} onClick={() => setRemoving(c)} />
                </span>
              )}
            </div>
            {c.description && <p className={styles.desc}>{c.description}</p>}
            <dl className={styles.facts}>
              {c.responsible_name && <div><User size={14} aria-hidden="true" /><dt className="sr-only">Responsável</dt><dd>{c.responsible_name}</dd></div>}
              {c.city && <div><MapPin size={14} aria-hidden="true" /><dt className="sr-only">Cidade</dt><dd>{c.city}</dd></div>}
              {c.email && <div><Mail size={14} aria-hidden="true" /><dt className="sr-only">E-mail</dt><dd>{c.email}</dd></div>}
              {c.phone && <div><Phone size={14} aria-hidden="true" /><dt className="sr-only">Telefone</dt><dd>{c.phone}</dd></div>}
              {c.website && <div><Globe size={14} aria-hidden="true" /><dt className="sr-only">Site</dt><dd>{c.website}</dd></div>}
            </dl>
            <div className={styles.footer}>
              <span className={styles.count}><strong>{c.production_count}</strong>{c.production_count === 1 ? 'produção' : 'produções'}</span>
              {c.production_count > 0 && (
                <Link className={styles.link} to={`/productions?company=${c.id}`}><Landmark size={13} aria-hidden="true" /> Ver produções</Link>
              )}
            </div>
          </article>
        ))}
      </div>

      <CompanyModal open={!!modal} onClose={() => setModal(null)} company={modal === 'new' ? null : modal} />
      <ConfirmDialog open={!!removing} title="Excluir companhia" confirmLabel="Excluir"
        message={removing ? `Excluir “${removing.name}”? As produções continuam cadastradas, apenas sem companhia.` : ''}
        onClose={() => setRemoving(null)}
        onConfirm={async () => { await deleteCompany(removing.id); setRemoving(null) }} />
    </div>
  )
}
