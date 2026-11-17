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

  // Sem "loading" global: a página de detalhe não deve piscar o spinner ao salvar
  updateProduction: async (id, data) => {
    set({ error: null })
    try {
      const res = await api.patch(`/api/v1/productions/${id}`, stripEmpty(data))
      set((s) => ({
        productions: s.productions.map((p) => p.id === id ? res.data : p),
        // PATCH devolve a produção sem participantes: preserva os que já temos
        currentProduction: s.currentProduction?.id === id
          ? { ...s.currentProduction, ...res.data, participants: s.currentProduction.participants }
          : s.currentProduction,
      }))
      return res.data
    } catch (err) {
      set({ error: getErrorMessage(err) })
      return null
    }
  },

  deleteProduction: async (id) => {
    try {
      await api.delete(`/api/v1/productions/${id}`)
      set((s) => ({
        productions: s.productions.filter((p) => p.id !== id),
        currentProduction: s.currentProduction?.id === id ? null : s.currentProduction,
      }))
      return true
    } catch (err) {
      set({ error: getErrorMessage(err) })
      return false
    }
  },

  // Recarrega o detalhe sem acionar o spinner de página inteira
  refreshCurrent: async () => {
    const id = get().currentProduction?.id
    if (!id) return
    try {
      const res = await api.get(`/api/v1/productions/${id}`)
      set({ currentProduction: res.data })
    } catch { /* mantém o que já está na tela */ }
  },

  updateParticipant: async (productionId, participantId, data) => {
    try {
      await api.patch(`/api/v1/productions/${productionId}/participants/${participantId}`, data)
      await get().refreshCurrent()
      return true
    } catch (err) {
      set({ error: getErrorMessage(err) })
      return false
    }
  },

  removeParticipant: async (productionId, participantId) => {
    try {
      await api.delete(`/api/v1/productions/${productionId}/participants/${participantId}`)
      await get().refreshCurrent()
      return true
    } catch (err) {
      set({ error: getErrorMessage(err) })
      return false
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
