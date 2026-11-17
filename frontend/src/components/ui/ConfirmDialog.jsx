import Modal from './Modal'
import Button from './Button'
import styles from './Field.module.css'

/** Confirmação para ações destrutivas (excluir, remover, cancelar). */
export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmar', onConfirm, onClose, loading = false, error,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className={styles.form}>
        <div className={styles.confirmText}>{message}</div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <Button variant="ghost" type="button" onClick={onClose}>Voltar</Button>
          <Button variant="destructive" type="button" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
