/**
 * Identificación y contacto del deportista (v2.7, T0.1 del plan de historia clínica).
 *
 * Fuente única de las reglas: la usan los formularios (Deportistas, Usuarios, importación CSV) y el servidor
 * (backend/controllers/jugadores.controller.js y usuarios.controller.js la importan como anthropometry.js).
 * Así la pantalla y la API aceptan y rechazan exactamente lo mismo.
 *
 * - Tipos de documento: códigos de la guía FHIR del Resumen Digital de Atención (RDA) del MinSalud
 *   (ValueSet ColombianPersonIdentifierCodes). La Resolución 1995 de 1999 identifica la historia clínica
 *   con el documento de identidad.
 * - Pertenencia étnica y discapacidad son **datos sensibles** (Ley 1581 de 2012, art. 5): solo los registra
 *   y los ve el personal de salud, y el propio deportista los puede consultar.
 * - Un deportista menor de edad necesita acudiente (nombre y teléfono): firma los consentimientos (Fase 2).
 */

export const TIPOS_DOCUMENTO = [
  { codigo: 'CC', nombre: 'Cédula de ciudadanía', numerico: true },
  { codigo: 'TI', nombre: 'Tarjeta de identidad', numerico: true },
  { codigo: 'RC', nombre: 'Registro civil', numerico: true },
  { codigo: 'CE', nombre: 'Cédula de extranjería', numerico: false },
  { codigo: 'PA', nombre: 'Pasaporte', numerico: false },
  { codigo: 'PPT', nombre: 'Permiso por protección temporal', numerico: false },
  { codigo: 'PE', nombre: 'Permiso especial de permanencia', numerico: false },
]

export const ZONAS = [['urbana', 'Urbana'], ['rural', 'Rural']]

// Países más frecuentes en la sede Cúcuta (código ISO 3166-1, el que pide el perfil de paciente del RDA)
export const PAISES = [
  ['CO', 'Colombia'], ['VE', 'Venezuela'], ['EC', 'Ecuador'], ['PE', 'Perú'], ['BR', 'Brasil'], ['PA', 'Panamá'],
  ['MX', 'México'], ['AR', 'Argentina'], ['CL', 'Chile'], ['ES', 'España'], ['US', 'Estados Unidos'], ['OT', 'Otro país'],
]

// Categorías de pertenencia étnica del DANE
export const PERTENENCIAS_ETNICAS = [
  ['ninguna', 'Ninguna'],
  ['indigena', 'Indígena'],
  ['rom', 'Rom (gitano)'],
  ['raizal', 'Raizal del Archipiélago de San Andrés, Providencia y Santa Catalina'],
  ['palenquero', 'Palenquero de San Basilio'],
  ['afrocolombiano', 'Negro, mulato, afrocolombiano o afrodescendiente'],
]

// Categorías de discapacidad usadas en Colombia (registro de localización y caracterización)
export const DISCAPACIDADES = [
  ['ninguna', 'Ninguna'],
  ['fisica', 'Física'],
  ['auditiva', 'Auditiva'],
  ['visual', 'Visual'],
  ['sordoceguera', 'Sordoceguera'],
  ['intelectual', 'Intelectual'],
  ['psicosocial', 'Psicosocial (mental)'],
  ['multiple', 'Múltiple'],
]

export const PARENTESCOS = ['Madre', 'Padre', 'Hermano(a)', 'Abuelo(a)', 'Tío(a)', 'Pareja', 'Amigo(a)', 'Tutor legal']

// Campos que registran el administrador, el entrenador y el personal de salud
export const CAMPOS_IDENTIFICACION = [
  'tipo_documento', 'numero_documento', 'telefono', 'eps', 'municipio_residencia', 'zona_residencia', 'nacionalidad',
  'contacto_emergencia_nombre', 'contacto_emergencia_parentesco', 'contacto_emergencia_telefono',
  'acudiente_nombre', 'acudiente_tipo_documento', 'acudiente_numero_documento', 'acudiente_parentesco', 'acudiente_telefono',
]
// Datos sensibles: solo el personal de salud
export const CAMPOS_SENSIBLES = ['pertenencia_etnica', 'discapacidad']

export const MENSAJE_ACUDIENTE = 'Es menor de edad: escribe el nombre y el teléfono del acudiente.'
export const MENSAJE_SOLO_SALUD = 'La pertenencia étnica y la discapacidad son datos sensibles: solo las registra el personal de salud.'

const LARGO = {
  telefono: 20, eps: 100, municipio_residencia: 100,
  contacto_emergencia_nombre: 100, contacto_emergencia_parentesco: 40, contacto_emergencia_telefono: 20,
  acudiente_nombre: 100, acudiente_parentesco: 40, acudiente_telefono: 20,
}
const ETIQUETA = {
  telefono: 'teléfono', eps: 'EPS', municipio_residencia: 'municipio', contacto_emergencia_nombre: 'nombre del contacto de emergencia',
  contacto_emergencia_parentesco: 'parentesco del contacto de emergencia', contacto_emergencia_telefono: 'teléfono del contacto de emergencia',
  acudiente_nombre: 'nombre del acudiente', acudiente_parentesco: 'parentesco del acudiente', acudiente_telefono: 'teléfono del acudiente',
}

const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())
const tiene = (obj, campo) => Object.prototype.hasOwnProperty.call(obj, campo)

export const tipoDocumento = (codigo) => TIPOS_DOCUMENTO.find(t => t.codigo === codigo) || null

// Quita puntos, espacios y guiones: "1.090.123.456" → "1090123456"
export const limpiarNumeroDocumento = (v) => texto(v).toUpperCase().replace(/[\s.\-]/g, '')

// Valida el par tipo + número. Los dos vacíos es válido (el documento se puede completar después).
export function normalizarDocumento(tipo, numero, quien = '') {
  const t = texto(tipo).toUpperCase()
  const n = limpiarNumeroDocumento(numero)
  if (!t && !n) return { ok: true, tipo: null, numero: null }
  const de = quien ? ` ${quien}` : ''
  if (!t) return { ok: false, error: `Elige el tipo de documento${de}.` }
  const def = tipoDocumento(t)
  if (!def) return { ok: false, error: `El tipo de documento${de} no es válido.` }
  if (!n) return { ok: false, error: `Escribe el número de documento${de}.` }
  if (def.numerico && !/^\d{3,11}$/.test(n)) {
    return { ok: false, error: `El número de ${def.nombre.toLowerCase()}${de} solo lleva dígitos (de 3 a 11).` }
  }
  if (!def.numerico && !/^[A-Z0-9]{3,16}$/.test(n)) {
    return { ok: false, error: `El número de ${def.nombre.toLowerCase()}${de} solo lleva letras y números (de 3 a 16).` }
  }
  return { ok: true, tipo: t, numero: n }
}

// Teléfono: se aceptan espacios, guiones y paréntesis; se guarda con dígitos y un + inicial opcional
export function normalizarTelefono(v) {
  const t = texto(v)
  if (!t) return { ok: true, valor: null }
  const limpio = t.replace(/[\s\-().]/g, '')
  if (!/^\+?\d{7,15}$/.test(limpio)) return { ok: false }
  return { ok: true, valor: limpio }
}

// Edad cumplida a partir de 'YYYY-MM-DD' (sin zona horaria). `hoy` también es 'YYYY-MM-DD'.
export function edadCumplida(fechaNacimiento, hoy) {
  const [a, m, d] = String(fechaNacimiento).slice(0, 10).split('-').map(Number)
  const [ha, hm, hd] = String(hoy).slice(0, 10).split('-').map(Number)
  if (!a || !ha) return null
  let edad = ha - a
  if (hm < m || (hm === m && hd < d)) edad -= 1
  return edad
}

// ¿Es menor de edad? Con fecha de nacimiento se calcula; si solo hay edad registrada, se usa esa.
export function esMenorDeEdad({ fecha_nacimiento, edad } = {}, hoy) {
  if (fecha_nacimiento) {
    const e = edadCumplida(fecha_nacimiento, hoy)
    return e !== null && e < 18
  }
  if (edad !== undefined && edad !== null && edad !== '' && Number.isFinite(Number(edad))) return Number(edad) < 18
  return false
}

export function faltaAcudiente(registro, hoy) {
  return esMenorDeEdad(registro, hoy) && (!texto(registro.acudiente_nombre) || !texto(registro.acudiente_telefono))
}

/**
 * Normaliza los campos de identificación que vengan en `datos` (solo los presentes: sirve para crear y para
 * actualizar por partes). Devuelve { ok, cambios } o { ok: false, error, status }.
 * - `sensibles`: si quien guarda puede registrar pertenencia étnica y discapacidad (personal de salud).
 * El documento se valida en pareja: si viene el tipo o el número, deben venir los dos.
 */
export function normalizarIdentificacion(datos = {}, { sensibles = false } = {}) {
  const cambios = {}
  const fallo = (error, status = 400) => ({ ok: false, error, status })

  if (tiene(datos, 'tipo_documento') || tiene(datos, 'numero_documento')) {
    const doc = normalizarDocumento(datos.tipo_documento, datos.numero_documento)
    if (!doc.ok) return fallo(doc.error)
    cambios.tipo_documento = doc.tipo
    cambios.numero_documento = doc.numero
  }
  if (tiene(datos, 'acudiente_tipo_documento') || tiene(datos, 'acudiente_numero_documento')) {
    const doc = normalizarDocumento(datos.acudiente_tipo_documento, datos.acudiente_numero_documento, 'del acudiente')
    if (!doc.ok) return fallo(doc.error)
    cambios.acudiente_tipo_documento = doc.tipo
    cambios.acudiente_numero_documento = doc.numero
  }
  for (const campo of ['telefono', 'contacto_emergencia_telefono', 'acudiente_telefono']) {
    if (!tiene(datos, campo)) continue
    const tel = normalizarTelefono(datos[campo])
    if (!tel.ok) return fallo(`El ${ETIQUETA[campo]} no es válido: escribe de 7 a 15 dígitos.`)
    cambios[campo] = tel.valor
  }
  for (const campo of ['eps', 'municipio_residencia', 'contacto_emergencia_nombre', 'contacto_emergencia_parentesco', 'acudiente_nombre', 'acudiente_parentesco']) {
    if (!tiene(datos, campo)) continue
    const v = texto(datos[campo])
    if (v.length > LARGO[campo]) return fallo(`El ${ETIQUETA[campo]} admite máximo ${LARGO[campo]} caracteres.`)
    cambios[campo] = v || null
  }
  if (tiene(datos, 'zona_residencia')) {
    const v = texto(datos.zona_residencia).toLowerCase()
    if (v && !ZONAS.some(([c]) => c === v)) return fallo('La zona de residencia debe ser urbana o rural.')
    cambios.zona_residencia = v || null
  }
  if (tiene(datos, 'nacionalidad')) {
    const v = texto(datos.nacionalidad).toUpperCase()
    if (v && !PAISES.some(([c]) => c === v)) return fallo('La nacionalidad no es válida.')
    cambios.nacionalidad = v || null
  }

  const sensiblesPresentes = CAMPOS_SENSIBLES.filter(c => tiene(datos, c))
  if (sensiblesPresentes.length && !sensibles) return fallo(MENSAJE_SOLO_SALUD, 403)
  if (tiene(datos, 'pertenencia_etnica')) {
    const v = texto(datos.pertenencia_etnica)
    if (v && !PERTENENCIAS_ETNICAS.some(([c]) => c === v)) return fallo('La pertenencia étnica no es válida.')
    cambios.pertenencia_etnica = v || null
  }
  if (tiene(datos, 'discapacidad')) {
    const v = texto(datos.discapacidad)
    if (v && !DISCAPACIDADES.some(([c]) => c === v)) return fallo('El tipo de discapacidad no es válido.')
    cambios.discapacidad = v || null
  }
  return { ok: true, cambios }
}

// "CC 1090123456" para mostrar
export function documentoLegible(tipo, numero) {
  if (!numero) return ''
  return tipo ? `${tipo} ${numero}` : String(numero)
}
