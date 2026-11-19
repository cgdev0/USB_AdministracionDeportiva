// Traduce los errores a respuestas HTTP sin exponer detalles internos (DEF-015, DEF-016, DEF-018).
// Los errores de datos de PostgreSQL se responden con 400/409 y un mensaje para el usuario;
// cualquier otro error se registra en la consola del servidor y se responde con un 500 genérico.

// Mensajes de las restricciones CHECK con nombre (database.sql y migración 004)
const RESTRICCIONES = {
  chk_jugadores_edad: 'La edad debe estar entre 0 y 100 años.',
  chk_jugadores_peso: 'El peso debe ser mayor que 0 y menor que 300 kg.',
  chk_jugadores_altura: 'La altura debe ser mayor que 0 y menor que 3 m.',
  chk_estadisticas_valores: 'Goles, asistencias y minutos no pueden ser negativos.',
  chk_evaluaciones_valores: 'Velocidad, resistencia y fuerza no pueden ser negativas.',
  chk_antropometria_valores: 'Las medidas antropométricas no pueden ser negativas y el peso y la estatura deben ser mayores que 0.',
  chk_evaluaciones_rugby_valores: 'Las pruebas físicas no pueden tener valores negativos.',
  partidos_tipo_check: 'El tipo de partido debe ser "liga" o "amistoso".',
  evaluaciones_tipo_check: 'El tipo de evaluación debe ser "inicial" o "final".',
  usuarios_rol_check: 'El rol no es válido.',
  jugadores_genero_check: 'El género debe ser "masculino" o "femenino".',
  jugadores_dorsal_check: 'El dorsal debe estar entre 0 y 99.',
  chk_convocatorias_hora: 'La hora de presentación debe tener el formato HH:MM.',
  chk_entrenamientos_hora: 'La hora debe tener el formato HH:MM.',
  chk_partidos_hora: 'La hora debe tener el formato HH:MM.',
  chk_convocados_rol: 'Cada convocado debe ser titular o suplente.',
  chk_convocados_confirmacion: 'La respuesta debe ser confirmado o no puede.',
  // v2.7: identificación del deportista (migración 011)
  chk_jugadores_tipo_documento: 'El tipo de documento no es válido.',
  chk_jugadores_documento_completo: 'El documento necesita el tipo y el número.',
  chk_jugadores_acudiente_tipo_documento: 'El tipo de documento del acudiente no es válido.',
  chk_jugadores_zona: 'La zona de residencia debe ser urbana o rural.',
  chk_jugadores_nacionalidad: 'La nacionalidad no es válida.',
  chk_jugadores_pertenencia_etnica: 'La pertenencia étnica no es válida.',
  chk_jugadores_discapacidad: 'El tipo de discapacidad no es válido.',
  // v2.7: datos de quien atiende (migración 012)
  chk_usuarios_profesion: 'La profesión no es válida.',
  chk_usuarios_vinculo: 'El vínculo debe ser profesional, practicante o estudiante.',
  chk_usuarios_supervisor_distinto: 'Una persona no puede supervisarse a sí misma.',
  // v2.7: historia clínica secuencial (migración 013). Los triggers responden con estos nombres.
  valoracion_cerrada: 'La valoración está cerrada: no se puede modificar ni borrar. Agrega una nota aclaratoria.',
  nota_aclaratoria_inalterable: 'Las notas aclaratorias no se modifican ni se borran.',
  chk_valoraciones_tipo: 'El tipo de valoración no es válido.',
  chk_notas_texto: 'Escribe la nota aclaratoria.',
  // v2.7 (T0.4): conservación de la historia clínica (migración 014)
  jugador_con_historia_clinica: 'Este deportista tiene historia clínica y no se puede eliminar: retíralo del plantel. Sus registros se conservan (Resolución 839 de 2017).',
  lesion_con_seguimiento: 'Esta lesión tiene seguimientos clínicos y no se puede eliminar.',
  // v2.7 (T0.5): archivos clínicos (migración 015)
  archivo_clinico_inalterable: 'Los archivos clínicos no se modifican ni se borran.',
  // v2.9 (T2.1): consentimientos
  consentimiento_inalterable: 'Los consentimientos no se modifican ni se borran: para retirarlo, regístralo como revocado.',
  chk_consentimientos_tipo: 'El tipo de consentimiento no es válido.',
  chk_consentimientos_estado: 'El estado del consentimiento no es válido.',
  chk_consentimientos_firma_quien: 'Quien firma debe ser el deportista o su acudiente.',
  chk_consentimientos_firmado_con_archivo: 'Para marcarlo como firmado, adjunta la foto o el PDF del papel firmado.',
  chk_consentimientos_firmado_con_firmante: 'Indica quién firma el consentimiento.',
  chk_consentimientos_revocado: 'Escribe el motivo de la revocación.',
  // v2.9 (T2.4): aceptaciones de los avisos de manejo de datos
  aceptacion_inalterable: 'Las aceptaciones no se modifican ni se borran.',
  carga_masiva_inalterable: 'El registro de las cargas masivas no se modifica ni se borra.',
  auditoria_inalterable: 'El registro de auditoría no se modifica ni se borra.',
  chk_aceptaciones_aviso: 'El aviso no es válido.',
  chk_aceptaciones_via: 'La forma de aceptación no es válida.',
  chk_aceptaciones_datos: 'Faltan datos de quién aceptó el aviso.',
  chk_archivos_tipo: 'El tipo de archivo no es válido.',
  chk_archivos_mime: 'Solo se aceptan fotos JPG o PNG y documentos PDF.',
  chk_archivos_tamano: 'El archivo supera los 5 MB.',
  // v2.7 (T0.6): bitácora (migración 016)
  bitacora_inalterable: 'La bitácora de accesos no se modifica ni se borra.',
};

// Restricciones que protegen la historia clínica: responden 409 (conflicto con el estado del registro), no 400
const CONFLICTOS = new Set(['valoracion_cerrada', 'nota_aclaratoria_inalterable', 'jugador_con_historia_clinica', 'lesion_con_seguimiento', 'archivo_clinico_inalterable', 'bitacora_inalterable', 'consentimiento_inalterable', 'aceptacion_inalterable', 'carga_masiva_inalterable', 'auditoria_inalterable']);

// Mensajes de los índices únicos con nombre (23505). No dicen quién tiene el dato, para no revelar
// deportistas que están fuera del alcance de quien guarda.
const UNICOS = {
  uq_jugadores_documento: 'Ya hay un deportista registrado con ese número de documento.',
};

const POR_CODIGO = {
  '22P02': [400, 'Uno de los valores no tiene el formato esperado (por ejemplo, se esperaba un número).'],
  '22007': [400, 'La fecha no es válida. Usa el formato AAAA-MM-DD.'],
  '22008': [400, 'La fecha no es válida. Usa el formato AAAA-MM-DD.'],
  '22003': [400, 'Un valor numérico está fuera del rango permitido.'],
  '22001': [400, 'Un texto supera la longitud máxima permitida.'],
  '23502': [400, 'Falta un dato obligatorio.'],
  '23503': [400, 'El registro relacionado no existe (por ejemplo, el jugador, equipo o entrenamiento indicado).'],
  '23505': [409, 'Ya existe un registro con esos datos.'],
  '23514': [400, 'Uno de los valores no está permitido.'],
};

const MENSAJE_500 = 'Ocurrió un error interno. Intenta de nuevo y, si se repite, avisa al administrador.';

function responderError(res, err) {
  const conocido = POR_CODIGO[err && err.code];
  if (conocido) {
    let [status, mensaje] = conocido;
    if (err.code === '23514' && RESTRICCIONES[err.constraint]) mensaje = RESTRICCIONES[err.constraint];
    if (err.code === '23514' && CONFLICTOS.has(err.constraint)) status = 409;
    if (err.code === '23505' && UNICOS[err.constraint]) mensaje = UNICOS[err.constraint];
    if (err.code === '23502' && err.column) mensaje = `Falta un dato obligatorio: ${err.column}.`;
    // Al eliminar, la llave foránea se viola porque otros registros dependen del que se borra
    if (err.code === '23503' && res.req && res.req.method === 'DELETE') {
      status = 409;
      mensaje = 'No se puede eliminar porque hay otros registros que dependen de este.';
    }
    return res.status(status).json({ error: mensaje });
  }
  const req = res.req || {};
  console.error(`[500] ${req.method || ''} ${req.originalUrl || ''}`, err);
  return res.status(500).json({ error: MENSAJE_500 });
}

// Último middleware de la API: cuerpo JSON inválido, archivos demasiado grandes y errores no capturados
function manejadorFinal(err, _req, res, next) {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La petición es demasiado grande.' });
  if (err.name === 'MulterError') return res.status(400).json({ error: 'El archivo no es válido o supera el tamaño permitido.' });
  // Errores propios con estado 4xx y mensaje pensado para el usuario (por ejemplo, formato de imagen)
  if (err.status >= 400 && err.status < 500 && !err.type) return res.status(err.status).json({ error: err.message });
  return responderError(res, err);
}

// Rechaza identificadores de ruta que no sean enteros positivos antes de llegar a la base
function validarId(req, res, next, valor) {
  if (!/^[1-9]\d{0,9}$/.test(valor) || Number(valor) > 2147483647) {
    return res.status(400).json({ error: 'El identificador debe ser un número entero positivo.' });
  }
  next();
}

module.exports = { responderError, manejadorFinal, validarId, MENSAJE_500 };
