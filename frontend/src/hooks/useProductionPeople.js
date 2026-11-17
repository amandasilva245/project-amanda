import { useEffect, useState } from 'react'
import api from '@/services/api'

/** Pessoas que participam de uma produção (para escolher responsáveis). */
export default function useProductionPeople(productionId) {
  const [people, setPeople] = useState([])
  useEffect(() => {
    if (!productionId) { setPeople([]); return }
    let alive = true
    api.get(`/api/v1/productions/${productionId}`)
      .then((res) => {
        if (!alive) return
        const seen = new Map()
        ;(res.data.participants ?? []).forEach((p) => {
          if (!seen.has(p.user.id)) seen.set(p.user.id, { value: p.user.id, label: `${p.user.full_name} · ${p.role_title}` })
        })
        setPeople([...seen.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')))
      })
      .catch(() => alive && setPeople([]))
    return () => { alive = false }
  }, [productionId])
  return people
}
