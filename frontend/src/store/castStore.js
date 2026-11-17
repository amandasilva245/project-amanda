import { create } from 'zustand'
import api from '@/services/api'
import { getErrorMessage, stripEmpty } from '@/utils/helpers'

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
      set({ error: getErrorMessage(err), loading: false })
    }
  },

  createMember: async (data) => {
    set({ loading: true, error: null })
    try {
      const res = await api.post('/api/v1/auth/users', stripEmpty(data))
      set((s) => ({ members: [res.data, ...s.members], loading: false }))
      return res.data
    } catch (err) {
      const msg = getErrorMessage(err)
      set({ error: msg, loading: false })
      return null
    }
  },

  assignToProduction: async (productionId, data) => {
    try {
      const res = await api.post(`/api/v1/productions/${productionId}/participants`, stripEmpty(data))
      return res.data
    } catch (err) {
      set({ error: getErrorMessage(err) })
      return null
    }
  },

  clearError: () => set({ error: null }),
}))
