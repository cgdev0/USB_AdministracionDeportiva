// Piezas del paciente que comparten la lista de pacientes (T1.3) y la ficha clínica (T1.4): foto, disponibilidad
// y avisos. Así un aviso se ve igual en las dos pantallas.
import { formatImageUrl } from '../../utils/image'
import { fechaCorta } from '../../utils/fechas'

// "Ninguna", "No", "Niega"… no son alergias
export const sinAlergias = (t) => !t || /^(ninguna?s?|no|niega|negativo|n\/?a|sin alergias?)\.?$/i.test(String(t).trim())
export const documentoDe = (p) => (p.numero_documento ? `${p.tipo_documento} ${p.numero_documento}` : 'Sin documento')

export const DISPONIBILIDAD = {
  disponible: ['badge-green', 'fa-circle-check', 'Disponible'],
  restringido: ['badge-orange', 'fa-triangle-exclamation', 'Con restricciones'],
  no_disponible: ['badge-red', 'fa-circle-xmark', 'No disponible'],
}

// [tono, icono, texto]; el orden es el de importancia clínica
export function avisosDe(p) {
  const lista = []
  if (!sinAlergias(p.alergias)) lista.push(['alerta', 'fa-triangle-exclamation', `Alergias: ${p.alergias}`])
  if (p.lesion_activa) lista.push(['alerta', 'fa-kit-medical', `Lesión: ${p.lesion_tipo || 'sin tipo'}${p.retorno_estimado ? ` · retorno ${fechaCorta(p.retorno_estimado)}` : ''}`])
  if (p.aptitud === 'no_apto_temporal') lista.push(['alerta', 'fa-ban', 'No apto temporalmente'])
  if (p.aptitud === 'apto_restricciones' && p.restricciones) lista.push(['aviso', 'fa-hand', p.restricciones])
  if (p.borradores > 0) lista.push(['aviso', 'fa-pen', p.borradores === 1 ? 'Borrador sin cerrar' : `${p.borradores} borradores sin cerrar`])
  if (p.control_vencido) lista.push(['aviso', 'fa-calendar-xmark', 'Control vencido'])
  if (!p.numero_documento) lista.push(['aviso', 'fa-id-card', 'Sin documento: no se puede abrir una valoración'])
  if (p.menor) lista.push(['info', 'fa-user-shield', 'Menor de edad'])
  if (p.activo === false) lista.push(['info', 'fa-user-minus', 'Retirado'])
  return lista
}

export function Avisos({ paciente, id }) {
  const lista = avisosDe(paciente)
  if (!lista.length) return null
  return (
    <ul className="paciente-avisos" aria-label="Avisos" id={id}>
      {lista.map(([tono, icono, texto]) => (
        <li key={texto} className={`paciente-aviso tono-${tono}`}><i className={`fa-solid ${icono}`} aria-hidden="true"></i> {texto}</li>
      ))}
    </ul>
  )
}

export function Disponibilidad({ valor }) {
  const [clase, icono, texto] = DISPONIBILIDAD[valor] || DISPONIBILIDAD.disponible
  return <span className={`badge ${clase}`}><i className={`fa-solid ${icono}`} aria-hidden="true"></i> {texto}</span>
}

export function Foto({ paciente, className = '' }) {
  return paciente.foto_url
    ? <img className={`paciente-foto ${className}`} src={formatImageUrl(paciente.foto_url)} alt="" referrerPolicy="no-referrer" />
    : <span className={`paciente-foto paciente-foto-vacia ${className}`} aria-hidden="true"><i className="fa-solid fa-user"></i></span>
}
