// Pacientes del personal de salud (v2.8, plan de historia clínica). Solo el personal de salud (información clínica);
// cada consulta queda en la bitácora.
// - Lista (T1.3): lo necesario para encontrar a un deportista en segundos y ver de un vistazo qué atender: documento,
//   deporte y equipo, disponibilidad (lesión activa, aptitud del último control), control vencido, borradores sin
//   cerrar, alergias (de la última valoración cerrada) y fecha de la última valoración.
// - Ficha clínica (T1.4): todo lo clínico del deportista en una sola consulta (una sola entrada en la bitácora):
//   identificación completa, estado, antecedentes de la última valoración cerrada, y sus valoraciones, controles,
//   lesiones con seguimientos, mediciones antropométricas y archivos clínicos.
const db = require('../config/db');
const { responderError } = require('../utils/errores');
const { registrar } = require('../utils/bitacora');
const { columnasQuienAtiende, conQuienAtiende } = require('../utils/quienAtiende');
const { SELECT_VALORACIONES, presentarValoraciones } = require('./valoraciones.controller');

const QA = columnasQuienAtiende('pr');

// Disponibilidad con la misma regla del inicio (inicio.controller.js)
function disponibilidad(f) {
  if (f.lesion_activa || f.aptitud === 'no_apto_temporal') return 'no_disponible';
  if (f.aptitud === 'apto_restricciones') return 'restringido';
  return 'disponible';
}
const conEstado = (f) => ({ ...f, disponibilidad: disponibilidad(f), menor: f.edad !== null && f.edad < 18 });

const BASICAS = 'j.id, j.nombre, j.dorsal, j.foto_url, j.tipo_documento, j.numero_documento, j.genero, j.activo';
// Identificación completa (T0.1), con los datos sensibles: solo llega aquí el personal de salud
const IDENTIFICACION = `${BASICAS}, j.fecha_nacimiento, j.posicion, j.telefono, j.eps, j.municipio_residencia, j.zona_residencia,
  j.nacionalidad, j.pertenencia_etnica, j.discapacidad, j.contacto_emergencia_nombre, j.contacto_emergencia_parentesco,
  j.contacto_emergencia_telefono, j.acudiente_nombre, j.acudiente_tipo_documento, j.acudiente_numero_documento,
  j.acudiente_parentesco, j.acudiente_telefono, j.retirado_en, j.motivo_retiro,
  les.fecha_inicio AS lesion_desde, ctl.fecha AS control_fecha, ctl.proxima_fecha AS control_proxima, ult.antecedentes`;

const consulta = (columnas, donde) => `
  SELECT ${columnas},
         COALESCE(date_part('year', age(j.fecha_nacimiento))::int, j.edad) AS edad,
         COALESCE(j.disciplina_id, eq.disciplina_id) AS disciplina_id, d.nombre AS disciplina_nombre,
         j.equipo_id, eq.nombre AS equipo_nombre,
         les.id IS NOT NULL AS lesion_activa, les.tipo AS lesion_tipo, seg.fecha_retorno_estimada AS retorno_estimado,
         ctl.aptitud, ctl.restricciones, COALESCE(ctl.proxima_fecha < CURRENT_DATE, FALSE) AS control_vencido,
         (SELECT COUNT(*)::int FROM valoraciones vb WHERE vb.jugador_id = j.id AND vb.estado = 'borrador') AS borradores,
         ult.fecha_hora AS ultima_valoracion, ult.antecedentes->>'alergias' AS alergias
    FROM jugadores j
    LEFT JOIN equipos eq ON eq.id = j.equipo_id
    LEFT JOIN disciplinas d ON d.id = COALESCE(j.disciplina_id, eq.disciplina_id)
    LEFT JOIN LATERAL (
      SELECT l.id, l.tipo, l.fecha_inicio FROM lesiones l
       WHERE l.jugador_id = j.id AND l.fecha_inicio <= CURRENT_DATE AND (l.fecha_fin IS NULL OR l.fecha_fin >= CURRENT_DATE)
       ORDER BY l.fecha_inicio DESC, l.id DESC LIMIT 1) les ON TRUE
    LEFT JOIN LATERAL (
      SELECT s.fecha_retorno_estimada FROM seguimiento_lesiones s
       WHERE s.lesion_id = les.id ORDER BY s.fecha_seguimiento DESC, s.id DESC LIMIT 1) seg ON TRUE
    LEFT JOIN LATERAL (
      SELECT c.fecha, c.aptitud, c.restricciones, c.proxima_fecha FROM controles_medicos c
       WHERE c.jugador_id = j.id ORDER BY c.fecha DESC, c.id DESC LIMIT 1) ctl ON TRUE
    LEFT JOIN LATERAL (
      SELECT v.fecha_hora, v.contenido->'antecedentes' AS antecedentes FROM valoraciones v
       WHERE v.jugador_id = j.id AND v.estado = 'cerrada' ORDER BY v.fecha_hora DESC, v.id DESC LIMIT 1) ult ON TRUE
   WHERE ${donde}`;

// GET /api/pacientes?retirados=incluir
exports.listar = async (req, res) => {
  try {
    const conRetirados = req.query.retirados === 'incluir';
    const { rows } = await db.query(`${consulta(BASICAS, conRetirados ? 'TRUE' : 'j.activo')} ORDER BY j.nombre`);
    await registrar(req, { accion: 'listar', recurso: 'paciente' });
    res.json(rows.map(({ antecedentes, ...f }) => conEstado(f)));
  } catch (err) {
    responderError(res, err);
  }
};

// GET /api/pacientes/:id  (ficha clínica)
exports.ficha = async (req, res) => {
  try {
    const { rows: [p] } = await db.query(consulta(IDENTIFICACION, 'j.id = $1'), [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Deportista no encontrado' });
    const id = p.id;
    const [valoraciones, controles, lesiones, seguimientos, mediciones, archivos] = await Promise.all([
      db.query(`${SELECT_VALORACIONES} WHERE v.jugador_id = $1 ORDER BY v.fecha_hora DESC, v.id DESC`, [id]),
      db.query(`SELECT c.id, c.fecha, c.proxima_fecha, c.tipo, c.resultado, c.restricciones, c.aptitud, c.created_at, ${QA.columnas}
                  FROM controles_medicos c LEFT JOIN usuarios pr ON pr.id = c.profesional_id ${QA.join}
                 WHERE c.jugador_id = $1 ORDER BY c.fecha DESC, c.id DESC`, [id]),
      db.query(`SELECT l.id, l.tipo, l.descripcion, l.fecha_inicio, l.fecha_fin,
                       (l.fecha_inicio <= CURRENT_DATE AND (l.fecha_fin IS NULL OR l.fecha_fin >= CURRENT_DATE)) AS activa
                  FROM lesiones l WHERE l.jugador_id = $1 ORDER BY l.fecha_inicio DESC, l.id DESC`, [id]),
      db.query(`SELECT s.id, s.lesion_id, s.zona_corporal, s.gravedad, s.diagnostico, s.tratamiento, s.evolucion, s.fecha_seguimiento,
                       s.fecha_retorno_estimada, s.fecha_retorno_real, s.estado, ${QA.columnas}
                  FROM seguimiento_lesiones s JOIN lesiones l ON l.id = s.lesion_id
                  LEFT JOIN usuarios pr ON pr.id = s.profesional_id ${QA.join}
                 WHERE l.jugador_id = $1 ORDER BY s.fecha_seguimiento DESC, s.id DESC`, [id]),
      db.query(`SELECT a.id, a.fecha, a.peso, a.estatura, a.imc, a.porcentaje_grasa, a.masa_muscular_esqueletica, a.masa_mineral_osea,
                       a.sumatoria_pliegues, a.endomorfia, a.mesomorfia, a.ectomorfia
                  FROM antropometria a WHERE a.jugador_id = $1 ORDER BY a.fecha DESC, a.id DESC`, [id]),
      db.query(`SELECT a.id, a.valoracion_id, a.tipo, a.nombre_original, a.mime, a.tamano, a.descripcion, a.creado_en, u.nombre AS subido_por_nombre
                  FROM archivos_clinicos a LEFT JOIN usuarios u ON u.id = a.subido_por
                 WHERE a.jugador_id = $1 ORDER BY a.creado_en DESC, a.id DESC`, [id]),
    ]);
    await registrar(req, { accion: 'ver', recurso: 'paciente', jugador_id: id });
    const segs = await conQuienAtiende(seguimientos.rows);
    res.json({
      paciente: conEstado(p),
      valoraciones: await presentarValoraciones(valoraciones.rows),
      controles: await conQuienAtiende(controles.rows),
      lesiones: lesiones.rows.map(l => ({ ...l, seguimientos: segs.filter(s => s.lesion_id === l.id) })),
      mediciones: mediciones.rows,
      archivos: archivos.rows,
    });
  } catch (err) {
    responderError(res, err);
  }
};
