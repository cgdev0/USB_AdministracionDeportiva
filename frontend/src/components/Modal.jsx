import { useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import usarVentana from './usarVentana'

// v2.4 (DEF-048): la ventana se dibuja en <body> con un portal. Si se dibuja dentro de un contenedor con
// backdrop-filter o transform (como la barra superior en computador), position: fixed se mide contra ese
// contenedor y la ventana quedaba corrida hacia arriba, tapando los primeros avisos de la campanita.

// v2.8 (T1.6): ventana accesible con teclado (Escape cierra, Tab no se sale, el foco vuelve al botón que la abrió).
// Con `onEnviar`, Enter en un campo de una línea guarda, como en un formulario (en un texto largo, Enter es salto de línea).
const NO_ENVIAN = ['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color']
export default function Modal({ title, onClose, children, footer, onEnviar }) {
  const idTitulo = useId()
  const caja = usarVentana({ onCerrar: onClose })
  const alTeclear = (e) => {
    if (!onEnviar || e.key !== 'Enter' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing) return
    if (e.target.tagName !== 'INPUT' || NO_ENVIAN.includes(e.target.type)) return
    e.preventDefault()
    onEnviar()
  }
  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" ref={caja} role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1} onKeyDown={alTeclear}>
        <div className="modal-header">
          <h3 id={idTitulo}>{title}</h3>
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
