import { create } from 'zustand'
import api from '@/services/api'
import { getErrorMessage, stripEmpty } from '@/utils/helpers'

export const useProductionStore = create((set, get) => ({
  productions: [],
  currentProduction: null,
  metrics: null,
  loading: false,
  error: null,

  fetchProductions: async ({ status, search } = {}) => {
    set({ loading: true, error: null })
    try {
      const params = {}
      if (status) params.status = status
      if (search)  params.search = search
      const res = await api.get('/api/v1/productions', { params })
      set({ productions: res.data.items ?? res.data, loading: false })
    } catch (err) {
      set({ error: getErrorMessage(err), loading: false })
    }
  },

  fetchProductionById: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await api.get(`/api/v1/productions/${id}`)
      set({ currentProduction: res.data, loading: false })
    } catch (err) {
      set({ error: getErrorMessage(err), loading: false })
    }
  },

  createProduction: async (data) => {
    set({ loading: true, error: null })
    try {
      const res = await api.post('/api/v1/productions', stripEmpty(data))
      // Optimistic prepend + server sync to ensure consistency
      set((s) => ({ productions: [res.data, ...s.productions], loading: false }))
      // Refresh from server in background
      get().fetchProductions()
      return res.data
    } catch (err) {
      const msg = getErrorMessage(err)
      set({ error: msg, loading: false })
      return null
    }
  },

  updateProduction: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const res = await api.patch(`/api/v1/productions/${id}`, stripEmpty(data))
      set((s) => ({
        productions: s.productions.map((p) => p.id === id ? res.data : p),
        currentProduction: s.currentProduction?.id === id ? res.data : s.currentProduction,
        loading: false,
      }))
      return res.data
    } catch (err) {
      set({ error: getErrorMessage(err), loading: false })
      return null
    }
  },

  fetchMetrics: async () => {
    try {
      const res = await api.get('/api/v1/insights/dashboard')
      set({ metrics: res.data })
    } catch {
      // Non-critical
    }
  },

  clearError: () => set({ error: null }),
}))
