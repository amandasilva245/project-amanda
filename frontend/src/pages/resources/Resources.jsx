import { useEffect } from 'react'
import { useProductionStore } from '@/store/productionStore'
import ResourcePanel from '@/components/modules/ResourcePanel'
import styles from '@/pages/companies/Companies.module.css'

export default function Resources() {
  const { productions, fetchProductions } = useProductionStore()
  useEffect(() => { fetchProductions() }, [])
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className="overline">Bastidores</p>
          <h1 className={styles.title}>Recursos</h1>
          <p className={styles.lead}>Figurinos, cenários, equipamentos e objetos de cena de cada produção.</p>
        </div>
      </div>
      <ResourcePanel productions={productions} />
    </div>
  )
}
