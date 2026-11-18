// Estado del guardado (v2.8, T1.1 del plan de historia clínica): "Guardado hace 5 s", "Guardando…", "Sin conexión".
// Lo usa el guardado automático del borrador (T1.2). Se anuncia a lectores de pantalla sin interrumpir.
//   estado: 'guardado' | 'guardando' | 'sin_conexion' | 'error' | 'sin_guardar'
import { useEffect, useState } from 'react'

export function haceCuanto(fecha, ahora = Date.now()) {
  const s = Math.max(0, Math.round((ahora - new Date(fecha).getTime()) / 1000))
  if (s < 10) return 'hace un momento'
  if (s < 60) return `hace ${s} s`
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  return `a las ${new Date(fecha).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`
}

const TEXTO = {
  guardando: ['fa-spinner fa-spin', 'Guardando…'],
  sin_conexion: ['fa-wifi', 'Sin conexión: se guardará cuando vuelva la señal. No cierres esta pantalla.'],
  error: ['fa-triangle-exclamation', 'No se pudo guardar. Se intentará de nuevo.'],
  sin_guardar: ['fa-pen', 'Cambios sin guardar'],
}

export default function EstadoGuardado({ estado, guardadoEn }) {
  const [, refrescar] = useState(0)
  useEffect(() => {
    if (estado !== 'guardado') return undefined
    const t = setInterval(() => refrescar(n => n + 1), 5000)
    return () => clearInterval(t)
  }, [estado])

  if (!estado) return null // aún no hay nada que guardar
  const [icono, texto] = estado === 'guardado'
    ? ['fa-circle-check', `Guardado ${guardadoEn ? haceCuanto(guardadoEn) : ''}`.trim()]
    : TEXTO[estado] || TEXTO.sin_guardar
  return (
    <p className={`estado-guardado guardado-${estado}`} role="status" aria-live="polite">
      <i className={`fa-solid ${icono}`} aria-hidden="true"></i> {texto}
    </p>
  )
}
