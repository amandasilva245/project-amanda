import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── Renovação automática da sessão (RF03) ─────────────────────────────────
// O token de acesso dura 60 min. Ao receber 401, tentamos UMA vez trocar o
// refresh token por um novo par e repetimos a chamada original. Chamadas
// simultâneas esperam a mesma renovação.
let refreshing = null

function clearSession() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  if (window.location.pathname !== '/login') window.location.href = '/login'
}

async function renewTokens() {
  const refresh = localStorage.getItem('refresh_token')
  if (!refresh) throw new Error('sem refresh token')
  // axios "cru" para não entrar de novo neste interceptor
  const res = await axios.post(
    `${api.defaults.baseURL}/api/v1/auth/refresh`,
    { refresh_token: refresh },
    { headers: { 'Content-Type': 'application/json' } },
  )
  localStorage.setItem('access_token', res.data.access_token)
  localStorage.setItem('refresh_token', res.data.refresh_token)
  return res.data.access_token
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config ?? {}
    const url = original.url ?? ''
    // 401 no próprio login = senha errada: não renovar nem recarregar a página
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/refresh')

    if (err.response?.status === 401 && !isAuthCall) {
      if (original._retried) { clearSession(); return Promise.reject(err) }
      try {
        refreshing = refreshing ?? renewTokens().finally(() => { refreshing = null })
        const token = await refreshing
        original._retried = true
        original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${token}` }
        return api(original)
      } catch {
        clearSession()
      }
    }
    return Promise.reject(err)
  }
)

export default api
