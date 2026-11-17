import { create } from 'zustand'
import api from '@/services/api'
import { getErrorMessage } from '@/utils/helpers'

export const useScheduleStore = create((set, get) => ({
  events: [],
  loading: false,
  error: null,
  lastQuery: {},

  fetchEvents: async (params = {}) => {
    set({ loading: true, error: null, lastQuery: params })
    try {
      const res = await api.get('/api/v1/schedules', { params, paramsSerializer: { indexes: null } })
      set({ events: res.data, loading: false })
    } catch (err) {
      set({ error: getErrorMessage(err), loading: false })
    }
  },

  reload: () => get().fetchEvents(get().lastQuery),

  /**
   * Salva (cria ou edita). Devolve { ok: true } | { conflicts: [...] } | { error }.
   * Com force=true, mantém o evento mesmo havendo conflito de horário.
   */
  saveEvent: async (id, data, force = false) => {
    try {
      const params = force ? { allow_conflicts: true } : {}
      if (id) await api.patch(`/api/v1/schedules/${id}`, data, { params })
      else await api.post('/api/v1/schedules', data, { params })
      await get().reload()
      return { ok: true }
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.conflicts) {
        return { conflicts: err.response.data.conflicts }
      }
      return { error: getErrorMessage(err) }
    }
  },

  cancelEvent: async (id, reason) => {
    try {
      await api.post(`/api/v1/schedules/${id}/cancel`, { reason: reason || null })
      await get().reload()
      return true
    } catch (err) {
      set({ error: getErrorMessage(err) })
      return false
    }
  },

  restoreEvent: async (id) => {
    try {
      await api.post(`/api/v1/schedules/${id}/restore`)
      await get().reload()
      return true
    } catch (err) {
      set({ error: getErrorMessage(err) })
      return false
    }
  },

  setAttendance: async (id, userId, status) => {
    try {
      const res = await api.patch(`/api/v1/schedules/${id}/attendance/${userId}`, { status })
      set((s) => ({ events: s.events.map((e) => (e.id === id ? res.data : e)) }))
      return true
    } catch (err) {
      set({ error: getErrorMessage(err) })
      return false
    }
  },
}))
