import { create } from 'zustand'
import api from '@/services/api'
import { getErrorMessage, stripEmpty } from '@/utils/helpers'

export const useFinanceStore = create((set, get) => ({
  globalInsights: null,
  transactions: [],
  txQuery: {},
  loading: false,
  error: null,

  fetchGlobalInsights: async () => {
    try {
      const res = await api.get('/api/v1/finance/global')
      set({ globalInsights: res.data })
    } catch (err) {
      set({ globalInsights: null, error: getErrorMessage(err) })
    }
  },

  fetchTransactions: async (params = {}) => {
    set({ loading: true, txQuery: params })
    try {
      const res = await api.get('/api/v1/finance/transactions', { params: { limit: 500, ...params } })
      set({ transactions: res.data, loading: false })
    } catch (err) {
      set({ transactions: [], loading: false, error: getErrorMessage(err) })
    }
  },

  /** Recarrega lista e totais depois de qualquer alteração. */
  refresh: async () => {
    await Promise.all([get().fetchTransactions(get().txQuery), get().fetchGlobalInsights()])
  },

  /** Cria (id = null) ou edita. Devolve true ou a mensagem de erro. */
  saveTransaction: async (id, data) => {
    try {
      if (id) await api.patch(`/api/v1/finance/transactions/${id}`, data)
      else await api.post('/api/v1/finance/transactions', stripEmpty(data))
      await get().refresh()
      return true
    } catch (err) {
      return getErrorMessage(err)
    }
  },

  // Otimista: a caixa responde na hora e volta atrás se a API recusar
  setReconciled: async (id, value) => {
    const mark = (v) => set((s) => ({
      transactions: s.transactions.map((t) => (t.id === id ? { ...t, is_reconciled: v } : t)),
    }))
    mark(value)
    try {
      await api.patch(`/api/v1/finance/transactions/${id}`, { is_reconciled: value })
      return true
    } catch (err) {
      mark(!value)
      set({ error: getErrorMessage(err) })
      return false
    }
  },

  deleteTransaction: async (id) => {
    try {
      await api.delete(`/api/v1/finance/transactions/${id}`)
      await get().refresh()
      return true
    } catch (err) {
      return getErrorMessage(err)
    }
  },

  clearError: () => set({ error: null }),
}))
