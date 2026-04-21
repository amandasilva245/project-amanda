import { create } from 'zustand'
import api from '@/services/api'

export const useFinanceStore = create((set) => ({
  globalInsights: null,
  transactions: [],
  loading: false,

  fetchGlobalInsights: async () => {
    try {
      const res = await api.get('/api/v1/finance/global')
      set({ globalInsights: res.data })
    } catch {
      set({ globalInsights: null })
    }
  },

  fetchTransactions: async (params = {}) => {
    try {
      const res = await api.get('/api/v1/finance/transactions', { params })
      set({ transactions: res.data })
    } catch {
      set({ transactions: [] })
    }
  },
}))
