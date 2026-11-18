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

export const USER_ROLES = {
  admin: 'Administrador(a)',
  producer: 'Produtor(a)',
  financial_manager: 'Gestor(a) financeiro(a)',
  director: 'Diretor(a)',
  technician: 'Técnico(a)',
  actor: 'Ator / Atriz',
}

export const RESOURCE_TYPES = {
  costume: 'Figurino',
  set: 'Cenário',
  equipment: 'Equipamento',
  prop: 'Objeto de cena',
  other: 'Outro',
}

export const RESOURCE_STATUS = {
  planned: 'Previsto',
  in_progress: 'Em confecção',
  available: 'Disponível',
  in_use: 'Em uso',
  maintenance: 'Em manutenção',
}

export const TASK_STATUS = {
  todo: 'A fazer',
  in_progress: 'Em andamento',
  done: 'Concluída',
}

export const TASK_PRIORITY = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}

export const options = {
  resourceTypes: toOptions(RESOURCE_TYPES),
  resourceStatus: toOptions(RESOURCE_STATUS),
  taskStatus: toOptions(TASK_STATUS),
  taskPriority: toOptions(TASK_PRIORITY),
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

/** "2026-11-20" → "20/11/2026" sem conversão de fuso. */
export const fmtDay = (d) => (d ? d.split('-').reverse().join('/') : '—')

/** 95 → "1h35" */
export const fmtDuration = (min) => {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`
}
