import { useEffect } from 'react'
import { useProductionStore } from '@/store/productionStore'
import TaskPanel from '@/components/modules/TaskPanel'
import styles from '@/pages/companies/Companies.module.css'

export default function Tasks() {
  const { productions, fetchProductions } = useProductionStore()
  useEffect(() => { fetchProductions() }, [])
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className="overline">Produção</p>
          <h1 className={styles.title}>Tarefas</h1>
          <p className={styles.lead}>Atividades de cada montagem, com responsável, prazo e andamento.</p>
        </div>
      </div>
      <TaskPanel productions={productions} />
    </div>
  )
}
