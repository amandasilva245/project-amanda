import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Theater, Users, DollarSign,
  Ticket, BarChart3, Settings, LogOut, ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { Crest, Flourish } from '@/components/ui/Ornament'
import styles from './Sidebar.module.css'

const NAV_SECTIONS = [
  {
    id: 'overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Overview', exact: true },
    ],
  },
  {
    id: 'stage',
    label: 'Stage',
    items: [
      { to: '/productions', icon: Theater, label: 'Productions' },
    ],
  },
  {
    id: 'company',
    label: 'Company',
    items: [
      { to: '/cast', icon: Users, label: 'Cast & Crew' },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    items: [
      { to: '/finance', icon: DollarSign, label: 'Financeiro', roles: ['admin', 'producer', 'financial_manager'] },
      { to: '/tickets', icon: Ticket, label: 'Tickets' },
      { to: '/insights', icon: BarChart3, label: 'Insights', roles: ['admin', 'producer', 'financial_manager', 'director'] },
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
          <span className={styles.logoTagline}>Operations</span>
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
            <span className={styles.userRole}>{user?.role?.replace('_', ' ')}</span>
          </div>
          <button
            onClick={logout}
            className={styles.logoutBtn}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </aside>
  )
}
