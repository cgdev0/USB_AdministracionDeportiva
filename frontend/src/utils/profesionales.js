/**
 * Datos de quien atiende en el área de salud (v2.7, T0.2 del plan de historia clínica).
 *
 * Fuente única: la usan el formulario de Usuarios, la API (usuarios, sesión y controles médicos) y, desde la T0.3,
 * el cierre de cada valoración, que guarda una copia de estos datos.
 *
 * Decisión D1: el registro profesional (RETHUS o tarjeta profesional) es **opcional**. Los primeros en usar el
 * sistema serán practicantes de fisioterapia y estudiantes del área de salud, que todavía no lo tienen.
 * Pueden tener un docente o profesional que los supervisa (también opcional; relación docencia-servicio).
 */

// [valor, nombre de la profesión, nombre de quien la ejerce]
export const PROFESIONES = [
  ['fisioterapia', 'Fisioterapia', 'Fisioterapeuta'],
  ['medicina', 'Medicina', 'Médico(a)'],
  ['enfermeria', 'Enfermería', 'Enfermero(a)'],
  ['nutricion', 'Nutrición y dietética', 'Nutricionista'],
  ['psicologia', 'Psicología', 'Psicólogo(a)'],
  ['otra', 'Otra profesión de la salud', 'Profesional de la salud'],
]

export const VINCULOS = [
  ['profesional', 'Profesional'],
  ['practicante', 'Practicante'],
  ['estudiante', 'Estudiante'],
]

export const CAMPOS_PROFESIONALES = ['profesion', 'vinculo', 'registro_profesional', 'supervisor_id']

const texto = (v) => (v === undefined || v === null ? '' : String(v).trim())
const tiene = (obj, campo) => Object.prototype.hasOwnProperty.call(obj, campo)

// Valida los campos presentes en `datos`. Devuelve { ok, cambios } o { ok: false, error }.
// La regla de quién puede ser supervisor (otro usuario de salud, no practicante ni estudiante) la revisa la API.
export function normalizarDatosProfesionales(datos = {}) {
  const cambios = {}
  if (tiene(datos, 'profesion')) {
    const v = texto(datos.profesion)
    if (v && !PROFESIONES.some(([c]) => c === v)) return { ok: false, error: 'La profesión no es válida.' }
    cambios.profesion = v || null
  }
  if (tiene(datos, 'vinculo')) {
    const v = texto(datos.vinculo)
    if (v && !VINCULOS.some(([c]) => c === v)) return { ok: false, error: 'El vínculo debe ser profesional, practicante o estudiante.' }
    cambios.vinculo = v || null
  }
  if (tiene(datos, 'registro_profesional')) {
    const v = texto(datos.registro_profesional)
    if (v && !/^[A-Za-z0-9.\- ]{3,30}$/.test(v)) {
      return { ok: false, error: 'El registro profesional solo lleva letras, números, puntos o guiones (de 3 a 30).' }
    }
    cambios.registro_profesional = v || null
  }
  if (tiene(datos, 'supervisor_id')) {
    const v = texto(datos.supervisor_id)
    if (v && !/^[1-9]\d{0,9}$/.test(v)) return { ok: false, error: 'El supervisor no es válido.' }
    cambios.supervisor_id = v ? Number(v) : null
  }
  return { ok: true, cambios }
}

// "Practicante de fisioterapia · Supervisa: Ana Pérez" · "Fisioterapeuta · Registro 12345" · "Personal de salud"
export function descripcionQuienAtiende({ profesion, vinculo, registro_profesional, supervisor_nombre } = {}) {
  const p = PROFESIONES.find(([c]) => c === profesion)
  let base
  if (vinculo === 'practicante' || vinculo === 'estudiante') {
    const quien = vinculo === 'practicante' ? 'Practicante' : 'Estudiante'
    base = p && p[0] !== 'otra' ? `${quien} de ${p[1].toLowerCase()}` : `${quien} del área de salud`
  } else {
    base = p ? p[2] : 'Personal de salud'
  }
  return [base, registro_profesional ? `Registro ${registro_profesional}` : null, supervisor_nombre ? `Supervisa: ${supervisor_nombre}` : null]
    .filter(Boolean).join(' · ')
}
