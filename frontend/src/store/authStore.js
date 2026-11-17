import { create } from 'zustand'
import api from '@/services/api'
import { getErrorMessage } from '@/utils/helpers'

const hasStoredToken = () => {
  try { return !!localStorage.getItem('access_token') } catch { return false }
}

export const useAuthStore = create((set) => ({
  user: null,
  // true enquanto o token salvo ainda está sendo validado em /auth/me;
  // evita que um F5 numa rota interna redirecione para /login e depois para /
  initializing: hasStoredToken(),
  loading: false,
  error: null,

  initFromStorage: async () => {
    const token = localStorage.getItem('access_token')
    if (!token) { set({ initializing: false }); return }
    try {
      const res = await api.get('/api/v1/auth/me')
      set({ user: res.data, initializing: false })
    } catch {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      set({ user: null, initializing: false })
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const res = await api.post('/api/v1/auth/login', { email, password })
      const { access_token, refresh_token, user } = res.data
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('refresh_token', refresh_token)
      set({ user, loading: false })
      return true
    } catch (err) {
      const msg = err.response?.status === 401
        ? 'E-mail ou senha incorretos.'
        : getErrorMessage(err, 'Não foi possível entrar.')
      set({ error: msg, loading: false })
      return false
    }
  },

  // Atualiza o usuário em memória (ex.: após salvar o perfil)
  setUser: (user) => set({ user }),

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, error: null })
  },
}))
