import { clsx } from 'clsx'
import styles from './Avatar.module.css'

const SIZE_MAP = { xs: 24, sm: 32, md: 40, lg: 52, xl: 68 }

export default function Avatar({ name, src, size = 'md', className }) {
  const initials = name
    ? name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <div
      className={clsx(styles.avatar, styles[size], className)}
      style={{ '--sz': `${SIZE_MAP[size]}px` }}
      aria-label={name}
      title={name}
    >
      {src ? (
        <img src={src} alt={name} className={styles.img} />
      ) : (
        <span className={styles.initials}>{initials}</span>
      )}
    </div>
  )
}

export function AvatarGroup({ users = [], max = 4, size = 'sm' }) {
  const visible = users.slice(0, max)
  const overflow = users.length - max

  return (
    <div className={styles.group}>
      {visible.map((u, i) => (
        <Avatar
          key={u.id ?? i}
          name={u.full_name ?? u.name}
          src={u.avatar_url}
          size={size}
          className={styles.groupItem}
          style={{ zIndex: visible.length - i }}
        />
      ))}
      {overflow > 0 && (
        <div className={clsx(styles.avatar, styles[size], styles.overflow)}>
          <span className={styles.initials}>+{overflow}</span>
        </div>
      )}
    </div>
  )
}
