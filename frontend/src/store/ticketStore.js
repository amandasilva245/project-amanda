import { create } from 'zustand'
import api from '@/services/api'
import { getErrorMessage, stripEmpty } from '@/utils/helpers'

export const useTicketStore = create((set, get) => ({
  batches: [],
  summaries: {},
  orders: [],
  loading: false,
  error: null,

  fetchBatches: async () => {
    set({ loading: true, error: null })
    try {
      const res = await api.get('/api/v1/tickets/batches')
      set({ batches: res.data, loading: false })
      // Resumo (receita real, check-ins) por produção
      const ids = [...new Set(res.data.map((b) => b.production_id))]
      const entries = await Promise.all(ids.map(async (id) => {
        try { return [id, (await api.get(`/api/v1/tickets/summary/${id}`)).data] } catch { return [id, null] }
      }))
      set({ summaries: Object.fromEntries(entries) })
    } catch (err) {
      set({ error: getErrorMessage(err), loading: false })
    }
  },

  /** Pedidos da venda online (só para quem gerencia a bilheteria). */
  fetchOrders: async () => {
    try {
      const res = await api.get('/api/v1/tickets/orders')
      set({ orders: res.data })
    } catch {
      set({ orders: [] })
    }
  },

  saveBatch: async (id, data) => {
    try {
      if (id) await api.patch(`/api/v1/tickets/batches/${id}`, data)
      else await api.post('/api/v1/tickets/batches', stripEmpty(data))
      await get().fetchBatches()
      return true
    } catch (err) {
      return getErrorMessage(err)
    }
  },

  /** Devolve { tickets } ou { error }. */
  sell: async (data) => {
    try {
      const res = await api.post('/api/v1/tickets', stripEmpty(data))
      get().fetchBatches()
      return { tickets: res.data }
    } catch (err) {
      return { error: getErrorMessage(err) }
    }
  },

  listTickets: async (batchId) => {
    const res = await api.get(`/api/v1/tickets/batches/${batchId}/tickets`)
    return res.data
  },

  ticketAction: async (ticketId, action) => {
    try {
      const res = await api.post(`/api/v1/tickets/${ticketId}/${action}`)
      get().fetchBatches()
      return { ticket: res.data }
    } catch (err) {
      return { error: getErrorMessage(err) }
    }
  },

  checkIn: async (code) => {
    try {
      const res = await api.post('/api/v1/tickets/check-in', { code })
      get().fetchBatches()
      return { result: res.data }
    } catch (err) {
      return { error: getErrorMessage(err), status: err.response?.status }
    }
  },
}))
