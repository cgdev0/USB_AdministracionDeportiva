import { useId } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import usarVentana from './usarVentana'

export default function ConfirmModal({ isOpen, ...props }) {
  if (!isOpen) return null
  return <Confirmacion {...props} />
}

// v2.8 (T1.6): ventana de confirmación accesible con teclado. Escape cancela (salvo mientras se confirma), Tab no se
// sale de la ventana y el foco vuelve a donde estaba. Si se abre sobre otra ventana, Escape cierra solo esta.
function Confirmacion({
  title = '¿Estás seguro?',
  message = 'Esta acción no se puede deshacer.',
  confirmText = 'Eliminar',
  cancelText = 'Cancelar',
  confirmVariant = 'danger', // 'danger' | 'primary' | 'warning'
  onConfirm,
  onCancel,
  loading = false
}) {
  const idTitulo = useId()
  const idMensaje = useId()
  const caja = usarVentana({ onCerrar: onCancel, puedeCerrar: !loading })

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel()
      }}
      style={{ zIndex: 9999 }}
    >
      <div className="modal-box" ref={caja} role="alertdialog" aria-modal="true" aria-labelledby={idTitulo} aria-describedby={idMensaje}
        tabIndex={-1} style={{ maxWidth: 440, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: confirmVariant === 'danger' ? 'var(--error-fondo)' : 'var(--info-fondo)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {confirmVariant === 'danger' ? (
              <Trash2 size={22} color="var(--danger, #ef4444)" />
            ) : (
              <AlertTriangle size={22} color="var(--accent, #3b82f6)" />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h3 id={idTitulo} style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              {title}
            </h3>
            <p id={idMensaje} style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {message}
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onCancel}
            disabled={loading}
            aria-label="Cerrar"
            title="Cerrar"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={loading}
            style={{ padding: '8px 16px', borderRadius: 8 }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={confirmVariant === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
            disabled={loading}
            style={{ padding: '8px 18px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {confirmVariant === 'danger' && <Trash2 size={15} />}
            {loading ? 'Procesando...' : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
