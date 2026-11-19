/**
 * Formatos de consentimiento para imprimir y firmar a mano (v2.9, T2.2 del plan de historia clínica). 🩺
 *
 * ⚠ BORRADORES. Los textos los propone el equipo de desarrollo para que los revisen el docente de salud y la
 * universidad; no son definitivos ni constituyen asesoría jurídica. Lo que solo puede completar la universidad
 * (dirección, contacto de protección de datos, política de tratamiento, comité de ética) va entre corchetes:
 * "[Completar: …]". Al aprobarse, se quita la marca de borrador y se cambia VERSION_FORMATO
 * (frontend/src/utils/consentimientos.js), que queda guardada con cada consentimiento firmado.
 *
 * Cada formato cabe en una hoja carta (prueba CP-UI-CON-001).
 */

export const FORMATOS = [
  {
    tipo: 'atencion',
    titulo: 'Consentimiento informado para la valoración y la atención fisioterapéutica',
    normas: 'Ley 528 de 1999 (ejercicio de la fisioterapia) · Resolución 1995 de 1999 (historia clínica)',
    secciones: [
      ['En qué consiste', 'La valoración fisioterapéutica sirve para conocer el estado físico del deportista, prevenir lesiones y orientar su recuperación. Puede incluir una entrevista sobre el motivo de consulta y los antecedentes de salud; la medición de signos vitales, peso, talla y composición corporal; la evaluación de la postura, la movilidad, la fuerza y la longitud de los segmentos; y pruebas físicas y semiológicas. Con los hallazgos se propone un plan de ejercicio o de intervención.'],
      ['Quién la realiza', 'Profesionales de fisioterapia y estudiantes o practicantes del programa de Fisioterapia de la Universidad Simón Bolívar, bajo la supervisión de un docente. Cada registro de la historia clínica identifica a quien atendió.'],
      ['Beneficios y riesgos', 'Permite detectar a tiempo factores de riesgo de lesión y llevar un seguimiento ordenado. Las pruebas son de bajo riesgo: pueden causar cansancio, molestia o dolor muscular pasajero. Si hay dolor o malestar, la prueba se detiene en ese momento.'],
      ['Fotografías de la postura', 'Para evaluar la postura se pueden tomar fotografías con ropa deportiva. Se guardan en la historia clínica, protegidas, y solo las ven el personal de salud y el deportista.'],
      ['Confidencialidad', 'La historia clínica es reservada: solo la consultan el equipo de salud que atiende, el propio deportista y las autoridades en los casos que define la ley. El entrenador conoce únicamente la disponibilidad para entrenar (apto, con restricciones o lesionado), no el diagnóstico. Cada consulta de la historia queda registrada, y la historia se conserva por el tiempo que exige la ley.'],
      ['Derechos', 'Puedo hacer preguntas en todo momento, negarme a cualquier prueba y revocar este consentimiento cuando quiera, por escrito, sin ninguna sanción.'],
    ],
    decisiones: [
      ['Fotografías de la postura', 'Autorizo', 'No autorizo'],
      ['Valoración y atención fisioterapéutica', 'Acepto', 'No acepto'],
    ],
  },
  {
    tipo: 'datos_personales',
    titulo: 'Autorización para el tratamiento de datos personales',
    normas: 'Ley 1581 de 2012 · Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015)',
    secciones: [
      ['Responsable', 'Universidad Simón Bolívar, sede Cúcuta. [Completar: dirección, teléfono y correo del área encargada de la protección de datos personales].'],
      ['Datos que se tratan', 'Identificación y contacto; contacto de emergencia y acudiente; datos deportivos (equipo, entrenamientos, asistencia y rendimiento); y datos de salud: historia clínica fisioterapéutica, lesiones, controles, mediciones y fotografías de la postura.'],
      ['Datos sensibles', 'Los datos de salud, la pertenencia étnica y la discapacidad son datos sensibles. No estoy obligado(a) a autorizar su tratamiento ni a responder preguntas sobre ellos; registrar la pertenencia étnica y la discapacidad es voluntario.'],
      ['Para qué se usan', '(a) Prestar y registrar la atención en salud y conformar la historia clínica; (b) gestionar la participación deportiva: plantel, entrenamientos, asistencia, convocatorias y disponibilidad; (c) comunicarse con el deportista y, en una emergencia, con su contacto; (d) elaborar estadísticas internas que no identifican a las personas; y (e) cumplir obligaciones legales, como los reportes a las autoridades de salud que exija la ley.'],
      ['Quién accede', 'Cada persona ve solo lo necesario para su función: el equipo de salud, la historia clínica; el entrenador, los datos deportivos y la disponibilidad; el administrador, las cuentas de usuario. Cada acceso a la historia clínica queda registrado. Los datos no se venden ni se ceden a terceros.'],
      ['Menores de edad', 'Si el titular es menor de edad, autoriza su representante legal, teniendo en cuenta la opinión del menor y el respeto prevalente de sus derechos.'],
      ['Mis derechos', 'Conocer, actualizar y rectificar mis datos; pedir prueba de esta autorización; saber cómo se usan; presentar quejas ante la Superintendencia de Industria y Comercio; y revocar la autorización o pedir que se supriman mis datos, salvo los que la ley obliga a conservar, como la historia clínica. Los ejerzo ante el responsable, en el contacto indicado. La política de tratamiento de datos de la universidad se consulta en [Completar: enlace o lugar de consulta].'],
    ],
    decisiones: [
      ['Tratamiento de mis datos personales, incluidos los de salud, para las finalidades descritas', 'Autorizo', 'No autorizo'],
    ],
  },
  {
    tipo: 'investigacion',
    titulo: 'Consentimiento para el uso de datos en investigación',
    normas: 'Resolución 8430 de 1993 (normas para la investigación en salud)',
    secciones: [
      ['Qué se solicita', 'Autorizar que los datos de la valoración fisioterapéutica y de las mediciones se usen en investigaciones académicas de la Universidad Simón Bolívar sobre la salud y el rendimiento de los deportistas, por ejemplo, trabajos de grado y publicaciones.'],
      ['Cómo se usan', 'Solo se usan datos que ya se registran en la atención: no se harán pruebas adicionales sin pedir un consentimiento nuevo. Los datos se analizan sin nombre ni documento, y ningún resultado publicado permitirá identificarme. Cada estudio debe tener la aprobación del comité de ética de la universidad antes de usar los datos [Completar: nombre del comité].'],
      ['Riesgos y beneficios', 'Se espera que sea una investigación sin riesgo, porque no implica intervenciones. No recibo un beneficio directo ni pago; los resultados pueden mejorar la prevención y la atención de lesiones de otros deportistas.'],
      ['Participación voluntaria', 'Participar no tiene costo. Negarme no afecta la atención en salud ni mi participación deportiva. Puedo revocar esta autorización en cualquier momento; desde entonces mis datos no se incluirán en estudios nuevos. Puedo pedir información sobre los estudios que usen mis datos en [Completar: contacto del grupo o del comité de investigación].'],
      ['Menores de edad', 'Firma su representante legal y el menor da su asentimiento por separado. Si el menor no está de acuerdo, sus datos no se usan en investigación.'],
    ],
    decisiones: [
      ['Uso de mis datos, sin identificarme, en investigaciones aprobadas por el comité de ética', 'Acepto', 'No acepto'],
    ],
  },
  {
    tipo: 'asentimiento',
    titulo: 'Asentimiento del deportista menor de edad',
    normas: 'Para deportistas menores de 18 años · Resolución 8430 de 1993',
    soloMenores: true,
    secciones: [
      ['Para ti', 'Tu acudiente ya autorizó la valoración. Antes de empezar queremos que tú también estés de acuerdo, y que sepas que puedes preguntar lo que quieras.'],
      ['¿Qué vamos a hacer?', 'Hablar contigo sobre cómo te sientes y si has tenido lesiones; medir tu peso, tu estatura, tu pulso y tu presión; y revisar tu postura, tu movilidad y tu fuerza con algunos ejercicios. Puede que tomemos fotos de tu postura con ropa deportiva.'],
      ['¿Duele?', 'No debería. Algunas pruebas cansan o dejan una molestia que se pasa pronto. Si algo te duele o no te sientes cómodo(a), dilo y paramos.'],
      ['¿Quién lo sabrá?', 'Lo que nos cuentes queda en tu historia clínica, que es privada. Tu entrenador solo sabrá si puedes entrenar, no los detalles de tu salud.'],
      ['Investigación', 'Con tus datos, sin tu nombre, la universidad puede hacer estudios que ayuden a otros deportistas. También aquí puedes decir que no.'],
      ['Tú decides', 'Puedes decir que no, aunque tu acudiente haya dicho que sí, y cambiar de opinión después. Nadie se va a enojar contigo.'],
    ],
    decisiones: [
      ['¿Estás de acuerdo con la valoración y la atención?', 'Sí', 'No'],
      ['¿Estás de acuerdo con que tus datos se usen en investigación, sin tu nombre?', 'Sí', 'No'],
    ],
  },
]

export const TIPOS_FORMATO = FORMATOS.map(f => f.tipo)
export const formatoDe = (tipo) => FORMATOS.find(f => f.tipo === tipo) || null

// Separa el texto en partes normales y partes "[Completar: …]" para resaltarlas al imprimir
export function partesDelTexto(texto = '') {
  return String(texto).split(/(\[Completar:[^\]]*\])/g).filter(Boolean)
    .map(t => ({ texto: t, completar: t.startsWith('[Completar:') }))
}
