import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, ListChecks } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'
import styles from './TopBar.module.css'

const ROUTE_TITLES = {
  '/': 'Visão geral',
  '/productions': 'Produções',
  '/agenda': 'Agenda',
  '/tasks': 'Tarefas',
  '/resources': 'Recursos',
  '/companies': 'Companhias',
  '/cast': 'Elenco e equipe',
  '/finance': 'Financeiro',
  '/tickets': 'Bilheteria',
  '/insights': 'Indicadores',
  '/settings': 'Configurações',
  '/ajuda': 'Ajuda e manual',
}

export default function TopBar() {
  const location = useLocation()
  const { user } = useAuthStore()
  const [openTasks, setOpenTasks] = useState(0)

  const title = Object.entries(ROUTE_TITLES).find(
    ([path]) => path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(path)
  )?.[1] ?? 'Curtain'

  // Tarefas abertas atribuídas a quem está logado (atualiza ao trocar de página)
  useEffect(() => {
    let alive = true
    api.get('/api/v1/tasks', { params: { mine: true } })
      .then((res) => alive && setOpenTasks(res.data.filter((t) => t.status !== 'done').length))
      .catch(() => alive && setOpenTasks(0))
    return () => { alive = false }
  }, [location.pathname])

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <h1 className={styles.title}>{title}</h1>
      </div>

      <div className={styles.right}>
        <Link to="/ajuda" className={styles.iconBtn} aria-label="Ajuda e manual" title="Ajuda e manual">
          <BookOpen size={16} strokeWidth={1.75} />
        </Link>
        <Link to="/tasks" className={styles.iconBtn}
          aria-label={openTasks ? `${openTasks} tarefas abertas para você` : 'Minhas tarefas'}
          title={openTasks ? `${openTasks} tarefas abertas para você` : 'Minhas tarefas'}>
          <ListChecks size={16} strokeWidth={1.75} />
          {openTasks > 0 && <span className={styles.notifCount}>{openTasks > 9 ? '9+' : openTasks}</span>}
        </Link>

        <div className={styles.divider} />

        <Link to="/settings" className={styles.userPill} aria-label="Meu perfil" title={user?.full_name}>
          <div className={styles.userAvatar}>
            {user?.full_name?.charAt(0) ?? '?'}
          </div>
        </Link>
      </div>
    </header>
  )
}
