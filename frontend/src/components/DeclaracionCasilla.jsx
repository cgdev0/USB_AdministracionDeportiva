// Declaración de quien registra (v2.9, T2.6 del plan de historia clínica; D10): sin marcarla no se guarda un
// deportista nuevo, ni uno por uno ni por carga masiva. El texto es el mismo que guarda la API con su huella.
import { useId } from 'react'
import { declaracionRegistro, declaracionCarga } from '../utils/avisos'

// Lo que se envía a la API junto con el registro
export const declaracionPara = (tipo = 'registro') => ({
  acepto: true,
  version: (tipo === 'carga' ? declaracionCarga() : declaracionRegistro()).version,
})
export const MENSAJE_DECLARACION = {
  registro: 'Marca la declaración: el deportista, o su acudiente si es menor de edad, fue informado y autorizó el registro de sus datos.',
  carga: 'Marca la declaración de la carga: cada persona del archivo fue informada y autorizó el registro de sus datos.',
}

// Huella SHA-256 de un texto (el archivo de una carga masiva), o null si el navegador no la calcula
export async function huellaTexto(texto) {
  try {
    const datos = new TextEncoder().encode(texto)
    const resumen = await crypto.subtle.digest('SHA-256', datos)
    return [...new Uint8Array(resumen)].map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

export default function DeclaracionCasilla({ tipo = 'registro', marcado, onCambio }) {
  const id = useId()
  const texto = (tipo === 'carga' ? declaracionCarga() : declaracionRegistro()).casilla
  return (
    <div className="declaracion" style={{ gridColumn: '1 / -1' }}>
      <label className="declaracion-casilla" htmlFor={id}>
        <input id={id} type="checkbox" checked={marcado} onChange={e => onCambio(e.target.checked)} />
        <span>{texto}</span>
      </label>
      <small className="ayuda-campo">Queda registrada a tu nombre, con la fecha y la hora.</small>
    </div>
  )
}
