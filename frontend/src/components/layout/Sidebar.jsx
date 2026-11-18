import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Theater, Users, DollarSign,
  Ticket, BarChart3, Settings, LogOut, CalendarDays,
  Landmark, ListChecks, Shirt, BookOpen,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { ROLES } from '@/utils/permissions'
import { USER_ROLES } from '@/utils/labels'
import { Crest, Flourish } from '@/components/ui/Ornament'
import styles from './Sidebar.module.css'

const NAV_SECTIONS = [
  {
    id: 'overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Visão geral', exact: true },
    ],
  },
  {
    id: 'stage',
    label: 'Palco',
    items: [
      { to: '/productions', icon: Theater, label: 'Produções' },
      { to: '/agenda', icon: CalendarDays, label: 'Agenda' },
      { to: '/tasks', icon: ListChecks, label: 'Tarefas' },
      { to: '/resources', icon: Shirt, label: 'Recursos' },
    ],
  },
  {
    id: 'company',
    label: 'Companhia',
    items: [
      { to: '/companies', icon: Landmark, label: 'Companhias' },
      { to: '/cast', icon: Users, label: 'Elenco e equipe', roles: ROLES.PEOPLE_DIRECTORY },
    ],
  },
  {
    id: 'business',
    label: 'Negócios',
    items: [
      { to: '/finance', icon: DollarSign, label: 'Financeiro', roles: ROLES.FINANCE_GLOBAL },
      { to: '/tickets', icon: Ticket, label: 'Bilheteria', roles: ROLES.TICKETS_CHECKIN },
      { to: '/insights', icon: BarChart3, label: 'Indicadores', roles: ROLES.INSIGHTS },
    ],
  },
]

function NavItem({ item }) {
  const location = useLocation()
  const isActive = item.exact
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to)

  return (
    <NavLink
      to={item.to}
      className={`${styles.navItem} ${isActive ? styles.active : ''}`}
      end={item.exact}
    >
      <item.icon size={16} className={styles.navIcon} strokeWidth={1.75} />
      <span className={styles.navLabel}>{item.label}</span>
      {isActive && <span className={styles.activePip} />}
    </NavLink>
  )
}

export default function Sidebar() {
  const { user, logout } = useAuthStore()

  const filteredSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.roles || item.roles.includes(user?.role)
    ),
  })).filter((s) => s.items.length > 0)

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoMark}>
          <Crest size={34} className={styles.logoSymbol} />
        </div>
        <div className={styles.logoText}>
          <span className={styles.logoName}>Curtain</span>
          <span className={styles.logoTagline}>Gestão teatral</span>
        </div>
      </div>

      <Flourish width={150} className={styles.logoFlourish} />

      {/* Navigation */}
      <nav className={styles.nav}>
        {filteredSections.map((section) => (
          <div key={section.id} className={styles.navSection}>
            {section.label && (
              <p className={styles.sectionLabel}>{section.label}</p>
            )}
            {section.items.map((item) => (
              <NavItem key={item.to} item={item} />
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={styles.footer}>
        <NavLink to="/ajuda" className={styles.footerItem}>
          <BookOpen size={15} strokeWidth={1.75} />
          <span>Ajuda e manual</span>
        </NavLink>
        <NavLink to="/settings" className={styles.footerItem}>
          <Settings size={15} strokeWidth={1.75} />
          <span>Configurações</span>
        </NavLink>

        <div className={styles.footerDivider} />

        <div className={styles.userRow}>
          <div className={styles.userAvatar}>
            {user?.full_name?.charAt(0) ?? '?'}
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.full_name}</span>
            <span className={styles.userRole}>{USER_ROLES[user?.role] ?? user?.role}</span>
          </div>
          <button
            onClick={logout}
            className={styles.logoutBtn}
            aria-label="Sair"
            title="Sair"
          >
            <LogOut size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </aside>
  )
}
