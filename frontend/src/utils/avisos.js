/**
 * Avisos de manejo de datos que se aceptan en el sistema (v2.9, T2.4 del plan de historia clínica; D9 y D10). 🩺
 *
 * ⚠ BORRADORES. Los propone el equipo de desarrollo para que los revisen el docente de salud y la universidad; no
 * son asesoría jurídica. Lo que solo puede completar la universidad va entre corchetes: "[Completar: …]".
 *
 * Fuente única: la usan la pantalla (aceptación al entrar, registro de deportistas, cargas masivas) y la API, que
 * guarda con cada aceptación la versión y la huella SHA-256 del texto exacto que se mostró. Si un texto cambia, se
 * cambia su versión y todos lo aceptan de nuevo.
 *
 *  - compromiso_personal: lo acepta todo el personal (administrador, head coach, entrenador y salud) antes de usar
 *    el sistema. Cada rol ve lo general y lo propio de su función.
 *  - aviso_deportista: el deportista sabe qué se hace con su información (versión sencilla para menores).
 *  - declaracion_registro y declaracion_carga: quien registra a un deportista, o carga un archivo con varios,
 *    declara que los informó y que autorizaron.
 */

export const VERSIONES_AVISO = {
  compromiso_personal: 'borrador-2026-11',
  aviso_deportista: 'borrador-2026-11',
  declaracion_registro: 'borrador-2026-11',
  declaracion_carga: 'borrador-2026-11',
}
export const TIPOS_AVISO = Object.keys(VERSIONES_AVISO)
export const ROLES_PERSONAL = ['administrador', 'head_coach', 'entrenador', 'personal_salud']

const COMPROMISO_GENERAL = [
  ['Uso según mi función', 'Uso los datos de los deportistas y del equipo solo para la función que tengo en el sistema y en el programa deportivo de la Universidad Simón Bolívar, nunca para fines personales, comerciales o distintos.'],
  ['Confidencialidad', 'No comparto, copio, fotografío ni divulgo datos fuera del sistema, salvo lo que exija mi función o la ley. La información de salud es reservada: quien no es del equipo de salud solo conoce la disponibilidad para entrenar.'],
  ['Protección de datos personales', 'Trato los datos según la Ley 1581 de 2012 y la política de tratamiento de datos de la universidad [Completar: enlace o lugar de consulta]: con la autorización del titular, solo para las finalidades informadas y con especial cuidado de los datos sensibles y de los menores de edad.'],
  ['Lineamientos del deporte y de la salud', 'Respeto los lineamientos del deporte en Colombia (Ley 181 de 1995) y las normas de salud que aplican a la información de los deportistas, en especial la reserva de la historia clínica (Resolución 1995 de 1999).'],
  ['Veracidad y registro de mis acciones', 'Lo que registro es veraz y completo. Cada acción queda registrada a mi nombre, con la fecha y la hora, y el administrador la puede auditar.'],
  ['Cuenta personal', 'Mi usuario y mi contraseña son personales: no los presto. Cierro la sesión en equipos compartidos y aviso al administrador si sospecho un uso indebido.'],
]
const COMPROMISO_ROL = {
  personal_salud: [
    ['Historia clínica', 'Registro cada atención en la historia clínica de forma secuencial, veraz y oportuna, y la mantengo en reserva (Resolución 1995 de 1999). Solo consulto la historia de los deportistas que atiendo.'],
    ['Ejercicio profesional y supervisión', 'Actúo dentro de mi formación (Ley 528 de 1999, ejercicio de la fisioterapia). Si soy practicante o estudiante, atiendo bajo la supervisión de un docente.'],
    ['Consentimientos', 'Antes de valorar verifico el consentimiento de atención; con menores de edad, el de su acudiente y el asentimiento del menor.'],
  ],
  entrenador: [
    ['Datos deportivos', 'Registro con cuidado la asistencia, las pruebas y el rendimiento, y al registrar a un deportista confirmo que él, o su acudiente, fue informado y autorizó el uso de sus datos.'],
  ],
  head_coach: [
    ['Supervisión', 'Consulto la información de los equipos que superviso solo para coordinar el trabajo deportivo.'],
  ],
  administrador: [
    ['Administración de cuentas', 'Gestiono cuentas, roles y cargas de datos, y no accedo al contenido clínico. Reviso la auditoría y desactivo a tiempo las cuentas que ya no deben tener acceso.'],
  ],
}
const CUMPLIMIENTO = ['Cumplimiento', 'Entiendo que incumplir este compromiso puede llevar a la suspensión de mi acceso y a las acciones que prevean la universidad y la ley.']

const AVISO_DEPORTISTA = [
  ['Quién', 'La Universidad Simón Bolívar, sede Cúcuta, guarda y usa tus datos en este sistema. Para cualquier solicitud: [Completar: contacto del área de protección de datos personales].'],
  ['Qué datos', 'Tu identificación y contacto, tu contacto de emergencia y tu acudiente, tus datos deportivos (equipo, entrenamientos, asistencia y rendimiento) y, si te atiende el equipo de salud, tu historia clínica.'],
  ['Para qué', 'Para gestionar tu participación deportiva, atender y hacer seguimiento a tu salud, comunicarnos contigo y, en una emergencia, con tu contacto, y hacer estadísticas que no te identifican.'],
  ['Quién los ve', 'Cada persona ve solo lo de su función. Tu entrenador sabe si puedes entrenar, no tu diagnóstico. Cada consulta de tu historia clínica queda registrada y la puedes ver en tu cuenta.'],
  ['Datos sensibles', 'Los datos de salud, la pertenencia étnica y la discapacidad son sensibles: no estás obligado a darlos, y los de salud solo los ve el equipo de salud.'],
  ['Tus derechos', 'Conocer, actualizar y corregir tus datos; saber cómo se usan; revocar tu autorización o pedir que se borren, salvo los que la ley obliga a conservar, como la historia clínica; y quejarte ante la Superintendencia de Industria y Comercio (Ley 1581 de 2012).'],
]
const AVISO_MENOR = [
  ['Tus datos', 'La universidad guarda en este sistema tus datos: quién eres, tu contacto y el de tu acudiente, cómo te va en el deporte y, si te atiende el equipo de salud, lo que tiene que ver con tu salud. Tu acudiente ya autorizó que se guarden.'],
  ['Para qué', 'Para organizar los entrenamientos y los partidos, cuidar tu salud y avisarle a tu acudiente si pasa algo.'],
  ['Quién los ve', 'Cada persona ve solo lo que necesita. Tu entrenador sabe si puedes entrenar, pero no los detalles de tu salud. Puedes ver en tu cuenta quién consultó tu historia.'],
  ['Puedes preguntar', 'Si algo no te gusta o quieres corregir un dato, díselo a tu acudiente o al equipo de salud. Tu opinión cuenta.'],
]

/** Compromiso del personal para un rol: lo general, lo de su rol y el cumplimiento. */
export function compromisoPara(rol) {
  return {
    aviso: 'compromiso_personal',
    version: VERSIONES_AVISO.compromiso_personal,
    titulo: 'Compromiso de confidencialidad y manejo de datos',
    intro: 'En Administración Deportiva trabajas con datos personales de deportistas, muchos de ellos menores de edad, y del equipo de la universidad. Antes de continuar, lee y acepta este compromiso.',
    secciones: [...COMPROMISO_GENERAL, ...(COMPROMISO_ROL[rol] || []), CUMPLIMIENTO],
    casilla: 'Leí este compromiso y lo acepto. Entiendo que mis acciones en el sistema quedan registradas.',
  }
}

/** Aviso de privacidad del deportista; con `menor`, en lenguaje sencillo. */
export function avisoDeportista({ menor = false } = {}) {
  return {
    aviso: 'aviso_deportista',
    version: VERSIONES_AVISO.aviso_deportista,
    titulo: menor ? 'Tus datos en Administración Deportiva' : 'Aviso de privacidad: tus datos en Administración Deportiva',
    intro: menor
      ? 'Antes de seguir, queremos contarte qué hacemos con tu información.'
      : 'Antes de seguir, lee cómo se guarda y se usa tu información en este sistema.',
    secciones: menor ? AVISO_MENOR : AVISO_DEPORTISTA,
    casilla: menor
      ? 'Leí esto y entiendo que mis datos se guardan y se usan como dice aquí.'
      : 'Leí el aviso y entiendo que mis datos se guardan y se usan como dice aquí.',
    menor,
  }
}

/** Declaración de quien registra a un deportista uno por uno. */
export function declaracionRegistro() {
  return {
    aviso: 'declaracion_registro',
    version: VERSIONES_AVISO.declaracion_registro,
    titulo: 'Declaración de quien registra',
    secciones: [],
    casilla: 'Declaro que informé al deportista, o a su acudiente si es menor de edad, sobre el aviso de privacidad, y que autorizó el registro y el uso de sus datos en el sistema.',
  }
}

/** Declaración de quien carga un archivo con varias personas. */
export function declaracionCarga() {
  return {
    aviso: 'declaracion_carga',
    version: VERSIONES_AVISO.declaracion_carga,
    titulo: 'Declaración de la carga masiva',
    secciones: [],
    casilla: 'Declaro que cada persona de este archivo, o su acudiente si es menor de edad, fue informada sobre el aviso de privacidad y autorizó el registro y el uso de sus datos. Entiendo que cada una deberá aceptar el aviso por su cuenta y que esta carga queda registrada a mi nombre.',
  }
}

/**
 * Texto exacto de un aviso, en una sola cadena: con él se calcula la huella SHA-256 que se guarda con cada
 * aceptación (prueba de qué texto se aceptó, aunque después cambie).
 */
export function textoCanonico(aviso) {
  return [aviso.titulo, aviso.intro, ...aviso.secciones.map(([t, x]) => `${t}: ${x}`), aviso.casilla, `Versión: ${aviso.version}`]
    .filter(Boolean).join('\n')
}

// Separa el texto en partes normales y partes "[Completar: …]" para resaltarlas mientras sean borradores
export function partesAviso(texto = '') {
  return String(texto).split(/(\[Completar:[^\]]*\])/g).filter(Boolean)
    .map(t => ({ texto: t, completar: t.startsWith('[Completar:') }))
}
