import { create } from 'zustand'
import api from '@/services/api'

export const useCastStore = create((set) => ({
  members: [],
  loading: false,
  error: null,

  fetchMembers: async () => {
    set({ loading: true, error: null })
    try {
      const res = await api.get('/api/v1/auth/users')
      set({ members: res.data, loading: false })
    } catch (err) {
      set({ error: err.response?.data?.detail ?? err.message, loading: false })
    }
  },

  createMember: async (data) => {
    set({ loading: true, error: null })
    try {
      const res = await api.post('/api/v1/auth/users', data)
      set((s) => ({ members: [res.data, ...s.members], loading: false }))
      return res.data
    } catch (err) {
      const msg = err.response?.data?.detail ?? err.message
      set({ error: msg, loading: false })
      return null
    }
  },

  assignToProduction: async (productionId, data) => {
    try {
      const res = await api.post(`/api/v1/productions/${productionId}/participants`, data)
      return res.data
    } catch (err) {
      set({ error: err.response?.data?.detail ?? err.message })
      return null
    }
  },

  clearError: () => set({ error: null }),
}))
