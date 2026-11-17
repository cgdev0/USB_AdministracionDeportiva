import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// v2.4 (DEF-048): la ventana se dibuja en <body> con un portal. Si se dibuja dentro de un contenedor con
// backdrop-filter o transform (como la barra superior en computador), position: fixed se mide contra ese
// contenedor y la ventana quedaba corrida hacia arriba, tapando los primeros avisos de la campanita.

export default function Modal({ title, onClose, children, footer }) {
  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar" title="Cerrar">
            <X size={16} />
          </button>
        </div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
