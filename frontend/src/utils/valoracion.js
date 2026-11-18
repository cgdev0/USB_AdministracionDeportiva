/**
 * Valoraciones de la historia clínica (v2.7, T0.3 del plan de historia clínica).
 *
 * Fuente única: la usan la pantalla de Salud y la API (backend/controllers/valoraciones.controller.js).
 * Resolución 1995 de 1999: cada atención es un registro aparte, con fecha, hora y quien atiende. Una valoración
 * cerrada no se modifica: se corrige con notas aclaratorias.
 *
 * El contenido se guarda por secciones. En la v2.7 las secciones son el motivo de consulta, los antecedentes
 * (los mismos campos de la historia anterior) y las observaciones; la Fase 3 agrega las demás (postura, signos
 * vitales, pruebas, diagnóstico CIE-10…), cada una con su propia validación aquí.
 */

export const TIPOS_VALORACION = [
  ['inicial', 'Inicial'],
  ['control', 'Control'],
  ['pretemporada', 'Pretemporada'],
  ['post_lesion', 'Después de lesión'],
]
// 'registro_previo' solo lo usa la migración de las historias anteriores a la v2.7
export const ETIQUETA_TIPO = {
  ...Object.fromEntries(TIPOS_VALORACION),
  registro_previo: 'Antecedentes registrados antes de la v2.7',
}

export const CAMPOS_ANTECEDENTES = [
  ['personales', 'Antecedentes personales'],
  ['alergias', 'Alergias'],
  ['medicamentos', 'Medicamentos'],
  ['cirugias', 'Cirugías'],
  ['enfermedades', 'Enfermedades'],
  ['historial_deportivo', 'Historial deportivo'],
]

export const MAX_TEXTO = 4000
export const MENSAJE_VACIA = 'La valoración está vacía: registra al menos el motivo de consulta, un antecedente o una observación.'

const SECCIONES_TEXTO = ['motivo_consulta', 'observaciones']
const ETIQUETA_SECCION = { motivo_consulta: 'motivo de consulta', observaciones: 'observaciones' }
const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

function textoValido(valor, nombre) {
  if (valor === undefined || valor === null) return { ok: true, valor: null }
  if (typeof valor !== 'string') return { ok: false, error: `El campo "${nombre}" debe ser texto.` }
  const v = valor.trim()
  if (v.length > MAX_TEXTO) return { ok: false, error: `El campo "${nombre}" admite máximo ${MAX_TEXTO} caracteres.` }
  return { ok: true, valor: v || null }
}

// Valida y limpia el contenido: solo secciones conocidas, textos recortados y sin campos vacíos.
// Devuelve { ok, contenido } o { ok: false, error }.
export function normalizarContenido(contenido = {}) {
  if (!esObjeto(contenido)) return { ok: false, error: 'El contenido de la valoración no es válido.' }
  const limpio = {}
  for (const [seccion, valor] of Object.entries(contenido)) {
    if (SECCIONES_TEXTO.includes(seccion)) {
      const t = textoValido(valor, ETIQUETA_SECCION[seccion])
      if (!t.ok) return t
      if (t.valor) limpio[seccion] = t.valor
    } else if (seccion === 'antecedentes') {
      if (valor === null || valor === undefined) continue
      if (!esObjeto(valor)) return { ok: false, error: 'Los antecedentes no son válidos.' }
      const antecedentes = {}
      for (const [campo, texto] of Object.entries(valor)) {
        const def = CAMPOS_ANTECEDENTES.find(([c]) => c === campo)
        if (!def) return { ok: false, error: `Antecedente desconocido: ${campo}.` }
        const t = textoValido(texto, def[1])
        if (!t.ok) return t
        if (t.valor) antecedentes[campo] = t.valor
      }
      if (Object.keys(antecedentes).length) limpio.antecedentes = antecedentes
    } else {
      return { ok: false, error: `Sección desconocida: ${seccion}.` }
    }
  }
  return { ok: true, contenido: limpio }
}

export const contenidoVacio = (contenido = {}) => Object.keys(contenido).length === 0
