import { useEffect, useState } from 'react'
import api from '@/services/api'

// Modo do sistema (público): { demo, accounts }. Uma única busca por carga de página.
let cache = null
let pending = null

export function useSystemMode() {
  const [mode, setMode] = useState(cache ?? { demo: false, accounts: [] })
  useEffect(() => {
    if (cache) return
    pending ??= api.get('/api/v1/system/mode')
      .then((res) => (cache = res.data))
      .catch(() => (cache = { demo: false, accounts: [] }))
    let alive = true
    pending.then((m) => alive && setMode(m))
    return () => { alive = false }
  }, [])
  return mode
}
