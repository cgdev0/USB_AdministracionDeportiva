// Comportamiento de teclado de las ventanas (v2.8, T1.6 del plan de historia clínica; RNF-06).
// - Escape cierra la ventana de arriba (si hay una confirmación sobre otra ventana, solo la confirmación).
// - Tab y Mayús+Tab recorren solo los controles de la ventana abierta, sin salirse a la página de atrás.
// - Al abrir, el foco entra a la ventana; al cerrar, vuelve al botón que la abrió.
// Mientras la pantalla está bloqueada por inactividad (T0.8), Escape no cierra nada de lo que hay detrás.
import { useEffect, useRef, useState } from 'react'

const abiertas = [] // pila de ventanas abiertas: la última es la de arriba
const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

export default function usarVentana({ onCerrar, puedeCerrar = true }) {
  const caja = useRef(null)
  // Quién abrió la ventana: se toma al dibujarla, antes de que un campo con autoFocus se lleve el foco
  const [origen] = useState(() => (typeof document !== 'undefined' ? document.activeElement : null))
  const cerrar = useRef(onCerrar)
  cerrar.current = puedeCerrar ? onCerrar : null

  useEffect(() => {
    const yo = {}
    abiertas.push(yo)
    // El foco entra a la ventana, salvo que un campo ya lo haya tomado (autoFocus)
    if (caja.current && !caja.current.contains(document.activeElement)) caja.current.focus({ preventScroll: true })

    const tecla = (e) => {
      if (abiertas[abiertas.length - 1] !== yo || document.querySelector('.bloqueo-inactividad')) return
      if (e.key === 'Escape') {
        if (cerrar.current) { e.preventDefault(); cerrar.current() }
        return
      }
      if (e.key !== 'Tab' || !caja.current) return
      const lista = [...caja.current.querySelectorAll(ENFOCABLES)].filter(el => el.offsetParent !== null || el === document.activeElement)
      if (!lista.length) return
      const [primero, ultimo] = [lista[0], lista[lista.length - 1]]
      const dentro = caja.current.contains(document.activeElement)
      if (e.shiftKey && (document.activeElement === primero || !dentro)) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && (document.activeElement === ultimo || !dentro)) { e.preventDefault(); primero.focus() }
    }
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('keydown', tecla)
      abiertas.splice(abiertas.indexOf(yo), 1)
      // Devolver el foco a quien abrió la ventana, si sigue en la página y nadie más lo tomó
      const enCuerpo = !document.activeElement || document.activeElement === document.body || caja.current?.contains(document.activeElement)
      if (enCuerpo && origen && origen.isConnected && typeof origen.focus === 'function') origen.focus({ preventScroll: true })
    }
  }, [])

  return caja
}
