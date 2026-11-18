import { create } from 'zustand'
import api from '@/services/api'
import { getErrorMessage, stripEmpty } from '@/utils/helpers'

/** Companhias, recursos e tarefas. Cada ação devolve true ou a mensagem de erro. */
export const useWorkStore = create((set, get) => ({
  companies: [],
  resources: [],
  tasks: [],
  resourceQuery: {},
  taskQuery: {},
  loading: false,
  error: null,

  fetchCompanies: async () => {
    try {
      const res = await api.get('/api/v1/companies')
      set({ companies: res.data })
    } catch (err) {
      set({ error: getErrorMessage(err) })
    }
  },

  saveCompany: async (id, data) => {
    try {
      if (id) await api.patch(`/api/v1/companies/${id}`, data)
      else await api.post('/api/v1/companies', stripEmpty(data))
      await get().fetchCompanies()
      return true
    } catch (err) {
      return getErrorMessage(err)
    }
  },

  deleteCompany: async (id) => {
    try {
      await api.delete(`/api/v1/companies/${id}`)
      await get().fetchCompanies()
      return true
    } catch (err) {
      return getErrorMessage(err)
    }
  },

  fetchResources: async (params = get().resourceQuery) => {
    set({ loading: true, resourceQuery: params, error: null })
    try {
      const res = await api.get('/api/v1/resources', { params: stripEmpty(params) })
      set({ resources: res.data, loading: false })
    } catch (err) {
      set({ resources: [], loading: false, error: getErrorMessage(err) })
    }
  },

  saveResource: async (id, data) => {
    try {
      if (id) await api.patch(`/api/v1/resources/${id}`, data)
      else await api.post('/api/v1/resources', data)
      await get().fetchResources()
      return true
    } catch (err) {
      return getErrorMessage(err)
    }
  },

  deleteResource: async (id) => {
    try {
      await api.delete(`/api/v1/resources/${id}`)
      await get().fetchResources()
      return true
    } catch (err) {
      return getErrorMessage(err)
    }
  },

  fetchTasks: async (params = get().taskQuery) => {
    set({ loading: true, taskQuery: params, error: null })
    try {
      const res = await api.get('/api/v1/tasks', { params: stripEmpty(params) })
      set({ tasks: res.data, loading: false })
    } catch (err) {
      set({ tasks: [], loading: false, error: getErrorMessage(err) })
    }
  },

  saveTask: async (id, data) => {
    try {
      if (id) await api.patch(`/api/v1/tasks/${id}`, data)
      else await api.post('/api/v1/tasks', data)
      await get().fetchTasks()
      return true
    } catch (err) {
      return getErrorMessage(err)
    }
  },

  // Otimista: o andamento muda na hora e volta se a API recusar
  setTaskStatus: async (id, status) => {
    const prev = get().tasks
    set({ tasks: prev.map((t) => (t.id === id ? { ...t, status } : t)) })
    try {
      await api.patch(`/api/v1/tasks/${id}`, { status })
      await get().fetchTasks()
      return true
    } catch (err) {
      set({ tasks: prev, error: getErrorMessage(err) })
      return false
    }
  },

  deleteTask: async (id) => {
    try {
      await api.delete(`/api/v1/tasks/${id}`)
      await get().fetchTasks()
      return true
    } catch (err) {
      return getErrorMessage(err)
    }
  },
}))
