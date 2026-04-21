import { create } from 'zustand'
import api from '@/services/api'

export const useInsightStore = create((set) => ({
  metrics: null,
  occupancyTrends: [],

  fetchMetrics: async () => {
    try {
      const res = await api.get('/api/v1/insights/dashboard')
      set({ metrics: res.data })
    } catch {
      set({ metrics: null })
    }
  },

  fetchOccupancyTrends: async () => {
    try {
      const res = await api.get('/api/v1/insights/occupancy-trends')
      set({ occupancyTrends: res.data })
    } catch {
      set({ occupancyTrends: [] })
    }
  },
}))
