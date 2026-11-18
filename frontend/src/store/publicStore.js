import { create } from 'zustand'
import api from '@/services/api'
import { getErrorMessage } from '@/utils/helpers'

/** Venda online (fase 8): vitrine, pedido e acompanhamento. Sem login. */
export const usePublicStore = create((set) => ({
  status: null,
  events: [],
  loading: false,
  error: null,

  fetchVitrine: async () => {
    set({ loading: true, error: null })
    try {
      const [st, ev] = await Promise.all([api.get('/api/v1/public/status'), api.get('/api/v1/public/events')])
      set({ status: st.data, events: ev.data, loading: false })
    } catch (err) {
      set({ loading: false, error: getErrorMessage(err, 'Não foi possível carregar as sessões.') })
    }
  },

  /** Cria o pedido. Devolve { ok, data } ou { ok:false, error }. */
  createOrder: async (payload) => {
    try {
      const res = await api.post('/api/v1/public/orders', payload)
      return { ok: true, data: res.data }
    } catch (err) {
      return { ok: false, error: getErrorMessage(err, 'Não foi possível iniciar a compra.') }
    }
  },

  getOrder: async (id, token) => {
    try {
      const res = await api.get(`/api/v1/public/orders/${id}`, { params: { t: token } })
      return { ok: true, data: res.data }
    } catch (err) {
      return { ok: false, error: getErrorMessage(err, 'Pedido não encontrado.') }
    }
  },

  refreshOrder: async (id, token) => {
    try {
      const res = await api.post(`/api/v1/public/orders/${id}/refresh`, { token })
      return { ok: true, data: res.data }
    } catch (err) {
      return { ok: false, error: getErrorMessage(err, 'Não foi possível conferir o pagamento agora.') }
    }
  },
}))
