/**
 * Consentimientos de la historia clínica (v2.9, T2.1 del plan de historia clínica; RF-27).
 *
 * Fuente única: la usan la pantalla de consentimientos (T2.3) y la API (backend/controllers/consentimientos.controller.js),
 * así los mensajes son los mismos en las dos.
 *
 * Tres tipos separados, cada uno con su propio estado:
 *  - atención fisioterapéutica (Res. 1995 de 1999);
 *  - tratamiento de datos personales (Ley 1581 de 2012);
 *  - uso en investigación (Res. 8430 de 1993): opcional e independiente; negarlo no afecta la atención.
 *
 * Cada acto (firma, rechazo o revocación) es un registro aparte que no se modifica ni se borra. El estado de cada
 * tipo es el de su último registro; sin registros, "pendiente". Reglas:
 *  1. Para quedar firmado hay que adjuntar la foto o el PDF del papel firmado.
 *  2. Si el deportista es menor de edad, firma el acudiente (nombre y documento) y se registra el asentimiento del menor.
 *  3. Revocar no borra nada: crea un registro "revocado" con su motivo, y el historial se conserva.
 *  4. El de investigación es independiente: negarlo no cambia los demás.
 */
import { esMenorDeEdad, normalizarDocumento } from './identificacion.js'

export const TIPOS_CONSENTIMIENTO = [
  ['atencion', 'Atención fisioterapéutica'],
  ['datos_personales', 'Tratamiento de datos personales'],
  ['investigacion', 'Uso en investigación'],
]
export const ETIQUETA_TIPO_CONSENTIMIENTO = Object.fromEntries(TIPOS_CONSENTIMIENTO)
export const ESTADOS_CONSENTIMIENTO = { pendiente: 'Pendiente', firmado: 'Firmado', rechazado: 'Rechazado', revocado: 'Revocado' }
// Lo que se registra desde la pantalla; "revocado" tiene su propia acción y "pendiente" es la falta de registro
export const ESTADOS_REGISTRABLES = ['firmado', 'rechazado']

// Versión del formato impreso. Mientras el docente no apruebe los textos (T2.2), los formatos son borradores.
export const VERSION_FORMATO = 'borrador-2026-11'
export const MAX_MOTIVO = 500

export const MENSAJES = {
  tipo: 'El tipo de consentimiento no es válido.',
  estado: 'Registra el consentimiento como firmado o rechazado. Para retirar uno firmado, usa "Revocar".',
  archivo: 'Para marcarlo como firmado, adjunta la foto o el PDF del papel firmado.',
  firmaMenor: 'Es menor de edad: firma el acudiente.',
  firmaMayor: 'Es mayor de edad: firma el propio deportista.',
  firmanteNombre: 'Escribe el nombre del acudiente que firma.',
  documentoDeportista: 'Registra primero el documento del deportista: firma con su nombre y su documento.',
  asentimiento: 'Es menor de edad: registra si dio su asentimiento (sí o no).',
  asentimientoMayor: 'El asentimiento solo se registra cuando el deportista es menor de edad.',
  fecha: 'La fecha no es válida.',
  fechaFutura: 'La fecha no puede ser posterior a hoy.',
  motivoLargo: `El motivo admite hasta ${MAX_MOTIVO} caracteres.`,
  version: 'La versión del formato admite hasta 40 caracteres.',
  motivoRevocar: 'Escribe el motivo de la revocación.',
  revocarSoloFirmado: 'Solo se puede revocar el consentimiento firmado que está vigente.',
  rechazarFirmado: 'Este consentimiento está firmado: para retirarlo, revócalo con su motivo.',
  fechaAntesDeFirma: 'La revocación no puede tener una fecha anterior a la firma.',
}

const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())
const FECHA = /^\d{4}-\d{2}-\d{2}$/

// Sí o no, también como llega en un formulario con archivo ("true", "si", "no"…); vacío es null
export function aSiNo(v) {
  if (v === true || v === false) return v
  const t = texto(v).toLowerCase()
  if (['true', 'si', 'sí', '1'].includes(t)) return true
  if (['false', 'no', '0'].includes(t)) return false
  return null
}

function validarFecha(valor, hoy) {
  const f = texto(valor) || hoy
  if (!FECHA.test(f) || Number.isNaN(Date.parse(`${f}T00:00:00Z`))) return { ok: false, error: MENSAJES.fecha }
  if (f > hoy) return { ok: false, error: MENSAJES.fechaFutura }
  return { ok: true, fecha: f }
}

function validarMotivo(valor) {
  const m = texto(valor)
  if (m.length > MAX_MOTIVO) return { ok: false, error: MENSAJES.motivoLargo }
  return { ok: true, motivo: m || null }
}

/**
 * Valida un registro nuevo (firmado o rechazado) antes de guardarlo.
 *  - datos: lo que llega de la pantalla (tipo, estado, fecha, firma_quien, firmante_*, asentimiento, motivo, version_formato)
 *  - jugador: { nombre, tipo_documento, numero_documento, fecha_nacimiento, edad, acudiente_* }
 *  - hoy: 'YYYY-MM-DD' en hora de Colombia
 *  - conArchivo: si viene la foto o el PDF del papel
 * Devuelve { ok: true, registro } o { ok: false, error }.
 */
export function validarConsentimiento(datos = {}, jugador = {}, hoy, { conArchivo = false } = {}) {
  const tipo = texto(datos.tipo)
  if (!ETIQUETA_TIPO_CONSENTIMIENTO[tipo]) return { ok: false, error: MENSAJES.tipo }
  const estado = texto(datos.estado)
  if (!ESTADOS_REGISTRABLES.includes(estado)) return { ok: false, error: MENSAJES.estado }
  // Regla 1: firmado, con el papel
  if (estado === 'firmado' && !conArchivo) return { ok: false, error: MENSAJES.archivo }
  const f = validarFecha(datos.fecha, hoy)
  if (!f.ok) return f
  const m = validarMotivo(datos.motivo)
  if (!m.ok) return m
  const version = texto(datos.version_formato) || VERSION_FORMATO
  if (version.length > 40) return { ok: false, error: MENSAJES.version }

  // Regla 2: quién firma. El menor de edad, por medio de su acudiente; el mayor, él mismo.
  const menor = esMenorDeEdad(jugador, hoy)
  const quien = texto(datos.firma_quien) || (menor ? 'acudiente' : 'deportista')
  if (menor && quien !== 'acudiente') return { ok: false, error: MENSAJES.firmaMenor }
  if (!menor && quien !== 'deportista') return { ok: false, error: MENSAJES.firmaMayor }
  let firmante
  if (quien === 'deportista') {
    if (!texto(jugador.numero_documento)) return { ok: false, error: MENSAJES.documentoDeportista }
    firmante = { firmante_nombre: texto(jugador.nombre), firmante_tipo_documento: jugador.tipo_documento, firmante_numero_documento: jugador.numero_documento, firmante_parentesco: null }
  } else {
    // Por defecto, el acudiente registrado en la identificación del deportista (T0.1)
    const de = (campo) => (datos[`firmante_${campo}`] !== undefined && texto(datos[`firmante_${campo}`]) !== '' ? datos[`firmante_${campo}`] : jugador[`acudiente_${campo}`])
    const nombre = texto(de('nombre'))
    if (!nombre) return { ok: false, error: MENSAJES.firmanteNombre }
    if (nombre.length > 150) return { ok: false, error: MENSAJES.firmanteNombre }
    const doc = normalizarDocumento(de('tipo_documento'), de('numero_documento'), 'del acudiente')
    if (!doc.ok) return doc
    if (!doc.numero) return { ok: false, error: 'Escribe el tipo y el número de documento del acudiente que firma.' }
    firmante = { firmante_nombre: nombre, firmante_tipo_documento: doc.tipo, firmante_numero_documento: doc.numero, firmante_parentesco: texto(de('parentesco')).slice(0, 40) || null }
  }

  // El asentimiento del menor: obligatorio al firmar, nunca para un mayor de edad
  const asentimiento = aSiNo(datos.asentimiento)
  if (!menor && asentimiento !== null) return { ok: false, error: MENSAJES.asentimientoMayor }
  if (menor && estado === 'firmado' && asentimiento === null) return { ok: false, error: MENSAJES.asentimiento }

  return {
    ok: true,
    registro: { tipo, estado, fecha: f.fecha, firma_quien: quien, ...firmante, asentimiento, motivo: m.motivo, version_formato: version },
  }
}

/** Valida una revocación: motivo obligatorio y fecha no posterior a hoy ni anterior a la firma. */
export function validarRevocacion(datos = {}, revocado = {}, hoy) {
  if (revocado.estado !== 'firmado') return { ok: false, error: MENSAJES.revocarSoloFirmado }
  const motivo = texto(datos.motivo)
  if (!motivo) return { ok: false, error: MENSAJES.motivoRevocar }
  if (motivo.length > MAX_MOTIVO) return { ok: false, error: MENSAJES.motivoLargo }
  const f = validarFecha(datos.fecha, hoy)
  if (!f.ok) return f
  if (revocado.fecha && f.fecha < String(revocado.fecha).slice(0, 10)) return { ok: false, error: MENSAJES.fechaAntesDeFirma }
  return { ok: true, registro: { tipo: revocado.tipo, estado: 'revocado', fecha: f.fecha, motivo, revoca_id: revocado.id } }
}

/**
 * Estado de cada tipo a partir del historial (del más reciente al más antiguo): el de su último registro, o
 * "pendiente" si no tiene ninguno. Devuelve { atencion: {...}, datos_personales: {...}, investigacion: {...} }.
 */
export function estadoActual(historial = []) {
  return Object.fromEntries(TIPOS_CONSENTIMIENTO.map(([tipo]) => {
    const ultimo = historial.find(c => c.tipo === tipo)
    return [tipo, ultimo ? { ...ultimo } : { tipo, estado: 'pendiente', id: null }]
  }))
}

/**
 * ¿Puede este deportista salir en una exportación? (v2.9, T2.8; se usa en la Fase 4)
 *  - fhir: con la autorización de datos personales firmada y vigente (Ley 1581 de 2012).
 *  - investigacion: con el consentimiento de investigación firmado y, si es menor, con su asentimiento (Res. 8430).
 * `actual` es el resultado de estadoActual(historial).
 */
export function exportable(actual = {}, fin) {
  if (fin === 'fhir') return autoriza(actual.datos_personales)
  if (fin === 'investigacion') return autoriza(actual.investigacion)
  return false
}
export const MENSAJE_FALTA_ATENCION = 'Falta el consentimiento de atención: regístralo firmado antes de iniciar una valoración.'

/**
 * ¿Autoriza lo que firmó? Solo si está firmado y vigente. Para investigación con un menor, además, el menor debe
 * haber dado su asentimiento (Res. 8430 de 1993, arts. 25 y 26). Lo usan las reglas de la T2.8.
 */
export function autoriza(actual) {
  if (!actual || actual.estado !== 'firmado') return false
  if (actual.tipo === 'investigacion' && actual.asentimiento === false) return false
  return true
}
