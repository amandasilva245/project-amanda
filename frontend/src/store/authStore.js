import { create } from 'zustand'
import api from '@/services/api'

export const useAuthStore = create((set) => ({
  user: null,
  loading: false,
  error: null,

  initFromStorage: async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    try {
      const res = await api.get('/api/v1/auth/me')
      set({ user: res.data })
    } catch {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
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
      const msg = err.response?.data?.detail ?? 'Invalid credentials'
      set({ error: msg, loading: false })
      return false
    }
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, error: null })
  },
}))
