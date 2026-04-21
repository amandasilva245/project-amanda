import { forwardRef } from 'react'
import { clsx } from 'clsx'
import styles from './Button.module.css'

const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    className,
    children,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      className={clsx(
        styles.btn,
        styles[variant],
        styles[size],
        loading && styles.loading,
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        LeftIcon && <LeftIcon size={14} strokeWidth={2} className={styles.icon} />
      )}
      {children && <span>{children}</span>}
      {!loading && RightIcon && (
        <RightIcon size={14} strokeWidth={2} className={styles.icon} />
      )}
    </button>
  )
})

export default Button
