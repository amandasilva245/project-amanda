import { useLocation } from 'react-router-dom'
import { Bell, Search } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import styles from './TopBar.module.css'

const ROUTE_TITLES = {
  '/': 'Overview',
  '/productions': 'Productions',
  '/cast': 'Cast & Crew',
  '/finance': 'Finance',
  '/tickets': 'Tickets',
  '/insights': 'Insights',
  '/settings': 'Settings',
}

export default function TopBar() {
  const location = useLocation()
  const { user } = useAuthStore()

  const title = Object.entries(ROUTE_TITLES).find(
    ([path]) => path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(path)
  )?.[1] ?? 'Curtain'

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <h1 className={styles.title}>{title}</h1>
      </div>

      <div className={styles.right}>
        <button className={styles.iconBtn} aria-label="Search">
          <Search size={16} strokeWidth={1.75} />
        </button>
        <button className={styles.iconBtn} aria-label="Notifications">
          <Bell size={16} strokeWidth={1.75} />
          <span className={styles.notifDot} />
        </button>

        <div className={styles.divider} />

        <div className={styles.userPill}>
          <div className={styles.userAvatar}>
            {user?.full_name?.charAt(0) ?? '?'}
          </div>
        </div>
      </div>
    </header>
  )
}
