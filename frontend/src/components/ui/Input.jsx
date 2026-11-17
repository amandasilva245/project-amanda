import { forwardRef, useId } from 'react'
import { clsx } from 'clsx'
import styles from './Input.module.css'

const Input = forwardRef(function Input(
  { label, error, hint, leftIcon: LeftIcon, rightElement, className, wrapperClass, id, ...props },
  ref
) {
  // Liga o rótulo ao campo (leitores de tela e clique no rótulo)
  const autoId = useId()
  const inputId = id ?? autoId
  const msgId = `${inputId}-msg`
  return (
    <div className={clsx(styles.wrapper, wrapperClass)}>
      {label && <label className={styles.label} htmlFor={inputId}>{label}</label>}
      <div className={clsx(styles.inputWrap, error && styles.hasError)}>
        {LeftIcon && (
          <span className={styles.leftIcon}>
            <LeftIcon size={15} strokeWidth={1.75} />
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? msgId : undefined}
          className={clsx(styles.input, LeftIcon && styles.withLeft, rightElement && styles.withRight, className)}
          {...props}
        />
        {rightElement && <span className={styles.rightEl}>{rightElement}</span>}
      </div>
      {error && <p id={msgId} className={styles.error}>{error}</p>}
      {!error && hint && <p id={msgId} className={styles.hint}>{hint}</p>}
    </div>
  )
})

export default Input
