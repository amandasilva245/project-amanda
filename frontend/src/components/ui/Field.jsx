import { useId } from 'react'
import inputStyles from './Input.module.css'
import styles from './Field.module.css'

export { styles as formStyles }

/** Select com o mesmo rótulo e acabamento do Input. options: [{ value, label }] */
export function Select({ label, options = [], placeholder, error, className, ...props }) {
  const id = useId()
  return (
    <div className={inputStyles.wrapper}>
      {label && <label className={inputStyles.label} htmlFor={id}>{label}</label>}
      <select id={id} className={`${styles.select} ${className ?? ''}`} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className={inputStyles.error}>{error}</p>}
    </div>
  )
}

export function Textarea({ label, className, ...props }) {
  const id = useId()
  return (
    <div className={inputStyles.wrapper}>
      {label && <label className={inputStyles.label} htmlFor={id}>{label}</label>}
      <textarea id={id} className={`${styles.textarea} ${className ?? ''}`} {...props} />
    </div>
  )
}

export function Checkbox({ label, ...props }) {
  return (
    <label className={styles.check}>
      <input type="checkbox" {...props} />
      {label}
    </label>
  )
}
