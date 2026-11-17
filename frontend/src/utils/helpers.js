/**
 * Utilitários compartilhados (sem dependências novas).
 */

/**
 * Converte o erro de uma chamada da API em texto exibível.
 * O FastAPI devolve `detail` como string (erros de negócio) ou como lista de
 * objetos (erros de validação 422). Renderizar a lista diretamente no React
 * derrubava a tela ("Objects are not valid as a React child").
 */
export function getErrorMessage(err, fallback = 'Ocorreu um erro inesperado.') {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((d) => {
        const field = Array.isArray(d?.loc) ? d.loc.filter((p) => p !== 'body').join('.') : ''
        const msg = (d?.msg ?? '').replace(/^Value error,\s*/i, '')
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
