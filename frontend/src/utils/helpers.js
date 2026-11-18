/**
 * Utilitários compartilhados (sem dependências novas).
 */

/**
 * Converte o erro de uma chamada da API em texto exibível.
 * O FastAPI devolve `detail` como string (erros de negócio) ou como lista de
 * objetos (erros de validação 422). Renderizar a lista diretamente no React
 * derrubava a tela ("Objects are not valid as a React child").
 */
// Nomes dos campos da API como aparecem nos formulários
const FIELD_LABELS = {
  email: 'E-mail', password: 'Senha', new_password: 'Nova senha', current_password: 'Senha atual',
  full_name: 'Nome completo', phone: 'Telefone', role: 'Perfil de acesso', title: 'Título',
  name: 'Nome', description: 'Descrição', amount: 'Valor', date: 'Data', category: 'Categoria',
  production_id: 'Produção', user_id: 'Pessoa', role_title: 'Função', start_time: 'Início',
  end_time: 'Término', total_seats: 'Capacidade', price: 'Preço', quantity: 'Quantidade',
  buyer_name: 'Nome do comprador', buyer_email: 'E-mail do comprador', budget: 'Orçamento',
  unit_cost: 'Custo unitário', fee: 'Cachê', duration_minutes: 'Duração', founded_year: 'Ano de fundação',
}

// Mensagens padrão de validação da API (em inglês) traduzidas pelo tipo do erro
function validationMessage(d) {
  const ctx = d?.ctx ?? {}
  switch (d?.type) {
    case 'missing': return 'campo obrigatório'
    case 'string_too_short': return `mínimo de ${ctx.min_length} caractere(s)`
    case 'string_too_long': return `máximo de ${ctx.max_length} caracteres`
    case 'greater_than': return `deve ser maior que ${ctx.gt}`
    case 'greater_than_equal': return `deve ser no mínimo ${ctx.ge}`
    case 'less_than': return `deve ser menor que ${ctx.lt}`
    case 'less_than_equal': return `deve ser no máximo ${ctx.le}`
    case 'int_parsing': case 'int_type': return 'informe um número inteiro'
    case 'float_parsing': case 'decimal_parsing': case 'float_type': return 'informe um número'
    case 'date_parsing': case 'date_from_datetime_parsing': return 'data inválida'
    case 'datetime_parsing': case 'datetime_from_date_parsing': return 'data e hora inválidas'
    case 'enum': case 'literal_error': return 'opção inválida'
    case 'uuid_parsing': return 'identificador inválido'
    case 'url_parsing': return 'endereço inválido'
    default:
      if (/email/i.test(d?.msg ?? '')) return 'e-mail inválido'
      return (d?.msg ?? '').replace(/^Value error,\s*/i, '')
  }
}

export function getErrorMessage(err, fallback = 'Ocorreu um erro inesperado.') {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((d) => {
        const path = Array.isArray(d?.loc) ? d.loc.filter((p) => p !== 'body' && p !== 'query') : []
        const key = path[path.length - 1]
        const field = key === undefined ? '' : (FIELD_LABELS[key] ?? String(key))
        const msg = validationMessage(d)
        return field ? `${field}: ${msg}` : msg
      })
      .filter(Boolean)
      .join(' · ')
  }
  if (err?.response?.status === 403) return 'Você não tem permissão para esta ação.'
  if (err?.message === 'Network Error') return 'Não foi possível conectar ao servidor.'
  return fallback
}

/**
 * Lê uma data "YYYY-MM-DD" como data local. `new Date('2026-12-01')` é
 * interpretado em UTC e, no Brasil (UTC-3), aparecia como 30/11.
 * Datas com horário (ISO completo) seguem o comportamento padrão.
 */
export function parseDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(value)
}

/** Remove campos com string vazia (a API rejeita "" em campos de data/número). */
export function stripEmpty(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => !(typeof v === 'string' && v.trim() === ''))
  )
}

/** Mesmas regras de senha validadas pela API. */
export function passwordProblem(pwd) {
  if (!pwd || pwd.length < 8) return 'A senha deve ter ao menos 8 caracteres.'
  if (!/[A-Z]/.test(pwd)) return 'A senha deve ter ao menos uma letra maiúscula.'
  if (!/\d/.test(pwd)) return 'A senha deve ter ao menos um número.'
  return null
}
