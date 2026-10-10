// Fechas en español a partir de 'YYYY-MM-DD' (o ISO), sin desfases por zona horaria.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function aFecha(valor) {
  if (!valor) return null
  if (valor instanceof Date) return valor
  const [a, m, d] = String(valor).slice(0, 10).split('-').map(Number)
  if (!a || !m || !d) return null
  return new Date(a, m - 1, d)
}

// "domingo 11 de octubre"
export function fechaLarga(valor) {
  const f = aFecha(valor)
  return f ? `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}` : ''
}

// "11 de octubre"
export function fechaCorta(valor) {
  const f = aFecha(valor)
  return f ? `${f.getDate()} de ${MESES[f.getMonth()]}` : ''
}

export function diaCorto(valor) {
  const f = aFecha(valor)
  return f ? DIAS_CORTOS[f.getDay()] : ''
}

export function numeroDia(valor) {
  const f = aFecha(valor)
  return f ? f.getDate() : ''
}

// "hoy", "mañana" o "domingo 11 de octubre"
export function fechaRelativa(valor) {
  const f = aFecha(valor)
  if (!f) return ''
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const dias = Math.round((f - hoy) / 86400000)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'mañana'
  return fechaLarga(f)
}

export function capitalizar(texto = '') {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : ''
}
