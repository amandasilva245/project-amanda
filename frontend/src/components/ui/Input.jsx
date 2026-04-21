import { forwardRef } from 'react'
import { clsx } from 'clsx'
import styles from './Input.module.css'

const Input = forwardRef(function Input(
  { label, error, hint, leftIcon: LeftIcon, rightElement, className, wrapperClass, ...props },
  ref
) {
  return (
    <div className={clsx(styles.wrapper, wrapperClass)}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={clsx(styles.inputWrap, error && styles.hasError)}>
        {LeftIcon && (
          <span className={styles.leftIcon}>
            <LeftIcon size={15} strokeWidth={1.75} />
          </span>
        )}
        <input
          ref={ref}
          className={clsx(styles.input, LeftIcon && styles.withLeft, rightElement && styles.withRight, className)}
          {...props}
        />
        {rightElement && <span className={styles.rightEl}>{rightElement}</span>}
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {!error && hint && <p className={styles.hint}>{hint}</p>}
    </div>
  )
})

export default Input
