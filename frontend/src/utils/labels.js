/** Rótulos em português dos enums da API (fonte: backend/app/models). */

const toOptions = (map) => Object.entries(map).map(([value, label]) => ({ value, label }))

export const PRODUCTION_STATUS = {
  development: 'Desenvolvimento',
  pre_production: 'Pré-produção',
  rehearsal: 'Ensaios',
  performance: 'Em cartaz',
  archived: 'Arquivada',
}

export const GENRES = {
  drama: 'Drama',
  comedy: 'Comédia',
  musical: 'Musical',
  opera: 'Ópera',
  dance: 'Dança',
  experimental: 'Experimental',
  children: 'Infantil',
  other: 'Outro',
}

export const DEPARTMENTS = {
  cast: 'Elenco',
  direction: 'Direção',
  technical: 'Técnico',
  production: 'Produção',
  administration: 'Administração',
}

export const SCHEDULE_TYPES = {
  rehearsal: 'Ensaio',
  performance: 'Apresentação',
  meeting: 'Reunião',
  workshop: 'Workshop',
  tech_run: 'Passagem técnica',
  dress_rehearsal: 'Ensaio geral',
}

export const ATTENDANCE = {
  invited: 'Convidado',
  confirmed: 'Confirmado',
  absent: 'Ausente',
}

export const INCOME_CATEGORIES = {
  ticket_sales: 'Bilheteria',
  sponsorship: 'Patrocínio',
  grant: 'Edital / Fomento',
  donation: 'Doação',
  merchandise: 'Produtos',
}

export const EXPENSE_CATEGORIES = {
  personnel: 'Pessoal / Cachês',
  venue: 'Espaço',
  marketing: 'Divulgação',
  costumes: 'Figurino',
  sets: 'Cenografia',
  equipment: 'Equipamentos',
  administration: 'Administrativo',
  other: 'Outros',
}

export const CATEGORIES = { ...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES }

export const BATCH_STATUS = {
  on_sale: 'À venda',
  sold_out: 'Esgotado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
}

export const TICKET_STATUS = {
  reserved: 'Reservado',
  confirmed: 'Confirmado',
  used: 'Utilizado',
  cancelled: 'Cancelado',
}

export const options = {
  productionStatus: toOptions(PRODUCTION_STATUS),
  genres: toOptions(GENRES),
  departments: toOptions(DEPARTMENTS),
  scheduleTypes: toOptions(SCHEDULE_TYPES),
  attendance: toOptions(ATTENDANCE),
  income: toOptions(INCOME_CATEGORIES),
  expense: toOptions(EXPENSE_CATEGORIES),
}

/** Converte "YYYY-MM-DDTHH:mm" (input datetime-local) em ISO com fuso local. */
export function localInputToISO(value) {
  if (!value) return null
  return new Date(value).toISOString()
}

/** ISO → valor para input datetime-local, no fuso do navegador. */
export function isoToLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const fmtBRL = (v, digits = 2) =>
  v == null || v === ''
    ? '—'
    : new Intl.NumberFormat('pt-BR', {
        style: 'currency', currency: 'BRL', minimumFractionDigits: digits, maximumFractionDigits: digits,
      }).format(Number(v))
