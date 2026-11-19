// Fuente única de la navegación: pestañas (PC), menú inferior y hoja "Más" (celular).
// `corto` es la etiqueta del menú inferior, donde el espacio es limitado.

export const MODULOS = [
  { ruta: '/',               etiqueta: 'Inicio',            corto: 'Inicio',       icono: 'fa-solid fa-house',
    roles: ['administrador', 'head_coach', 'entrenador', 'personal_salud', 'jugador'] },
  // v2.8 (T1.3): lista de pacientes del personal de salud (información clínica)
  { ruta: '/pacientes',      etiqueta: 'Pacientes',         corto: 'Pacientes',    icono: 'fa-solid fa-hospital-user',
    roles: ['personal_salud'], clinico: true },
  { ruta: '/head-coach',     etiqueta: 'Supervisión',       corto: 'Supervisión',  icono: 'fa-solid fa-binoculars',
    roles: ['head_coach'] },
  { ruta: '/equipos',        etiqueta: 'Equipos',           corto: 'Equipos',      icono: 'fa-solid fa-shield-halved',
    roles: ['administrador', 'head_coach', 'entrenador'] },
  { ruta: '/jugadores',      etiqueta: 'Deportistas',       corto: 'Deportistas',  icono: 'fa-solid fa-users',
    roles: ['administrador', 'head_coach', 'entrenador', 'personal_salud'] },
  { ruta: '/entrenamientos', etiqueta: 'Entrenamientos',    corto: 'Entrenos',     icono: 'fa-solid fa-stopwatch',
    roles: ['administrador', 'head_coach', 'entrenador', 'jugador'] },
  { ruta: '/asistencia',     etiqueta: 'Asistencia',        corto: 'Asistencia',   icono: 'fa-solid fa-clipboard-check',
    roles: ['administrador', 'head_coach', 'entrenador', 'jugador'] },
  { ruta: '/partidos',       etiqueta: 'Partidos',          corto: 'Partidos',     icono: 'fa-solid fa-trophy',
    roles: ['administrador', 'head_coach', 'entrenador', 'jugador'] },
  { ruta: '/estadisticas',   etiqueta: 'Estadísticas',      corto: 'Estadísticas', icono: 'fa-solid fa-chart-column',
    roles: ['administrador', 'head_coach', 'entrenador', 'jugador'],
    etiquetaPorRol: { jugador: 'Mis estadísticas' } },
  { ruta: '/lesiones',       etiqueta: 'Lesiones',          corto: 'Lesiones',     icono: 'fa-solid fa-kit-medical',
    roles: ['administrador', 'head_coach', 'entrenador', 'personal_salud', 'jugador'] },
  // v2.7 (T0.7): Salud y Antropometría son información clínica: el administrador ya no entra (Res. 1995, art. 14)
  // `clinico`: módulo de la historia clínica; el administrador no entra ni escribiendo la dirección
  { ruta: '/salud',          etiqueta: 'Salud y controles', corto: 'Salud',        icono: 'fa-solid fa-stethoscope',
    roles: ['personal_salud', 'jugador'], clinico: true },
  { ruta: '/evaluaciones',   etiqueta: 'Evaluaciones',      corto: 'Evaluaciones', icono: 'fa-solid fa-clipboard-list',
    roles: ['administrador', 'head_coach', 'entrenador', 'personal_salud', 'jugador'] },
  { ruta: '/antropometria',  etiqueta: 'Antropometría',     corto: 'Medidas',      icono: 'fa-solid fa-ruler-combined',
    roles: ['personal_salud', 'jugador'], clinico: true },
  { ruta: '/usuarios',       etiqueta: 'Usuarios',          corto: 'Usuarios',     icono: 'fa-solid fa-user-gear',
    roles: ['administrador'] },
  // v2.9 (T2.7): auditoría, exclusiva del administrador (altas, cargas, aceptaciones, cuentas y accesos)
  { ruta: '/auditoria',      etiqueta: 'Auditoría',         corto: 'Auditoría',    icono: 'fa-solid fa-user-shield',
    roles: ['administrador'] },
]

// Las 4 secciones del menú inferior para cada rol; el resto va en "Más".
export const MENU_INFERIOR = {
  administrador:  ['/', '/jugadores', '/asistencia', '/lesiones'],
  head_coach:     ['/', '/head-coach', '/jugadores', '/partidos'],
  entrenador:     ['/', '/jugadores', '/entrenamientos', '/asistencia'],
  personal_salud: ['/', '/pacientes', '/lesiones', '/salud'],
  jugador:        ['/', '/entrenamientos', '/salud', '/estadisticas'],
}

export const ROLES = {
  administrador:  'Administrador',
  head_coach:     'Head coach',
  entrenador:     'Entrenador',
  personal_salud: 'Personal de salud',
  jugador:        'Deportista',
}

export function modulosDelRol(rol) {
  return MODULOS
    .filter(m => m.roles.includes(rol))
    .map(m => ({ ...m, etiqueta: m.etiquetaPorRol?.[rol] || m.etiqueta }))
}

export function iniciales(nombre = '') {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase() || '?'
}

// Secciones del menú lateral (v2.0): el juego, el cuidado del deportista y la administración
export const GRUPOS = [
  { titulo: 'Competencia', rutas: ['/', '/head-coach', '/equipos', '/jugadores', '/entrenamientos', '/asistencia', '/partidos', '/estadisticas'] },
  // v2.9: Pacientes faltaba en el menú lateral del computador desde la v2.8 (DEF-062)
  { titulo: 'Salud y rendimiento', rutas: ['/pacientes', '/lesiones', '/salud', '/evaluaciones', '/antropometria'] },
  { titulo: 'Gestión', rutas: ['/usuarios', '/auditoria'] },
]
