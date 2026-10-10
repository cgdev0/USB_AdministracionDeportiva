const db = require('../config/db');

const { responderError } = require('../utils/errores');
// Restringe los jugadores visibles según el rol (mismas reglas que /api/jugadores)
// y el deporte elegido. Devuelve condiciones SQL sobre el alias `j`.
function alcanceJugadores(usuario, disciplinaId, params) {
  const cond = [];
  if (usuario.rol === 'jugador') {
    params.push(usuario.jugador_id || 0);
    cond.push(`j.id = $${params.length}`);
  } else if (usuario.rol === 'entrenador') {
    params.push(usuario.id);
    cond.push(`j.entrenador_id = $${params.length}`);
  } else if (usuario.rol === 'head_coach') {
    params.push(usuario.id);
    cond.push(`j.entrenador_id IN (SELECT id FROM usuarios WHERE head_coach_id = $${params.length})`);
  }
  if (disciplinaId) {
    params.push(disciplinaId);
    cond.push(`j.disciplina_id = $${params.length}`);
  }
  return cond.length ? cond.join(' AND ') : 'TRUE';
}

function estadoDe(fila) {
  if (fila.lesion_id) return 'no_disponible';
  if (fila.aptitud === 'no_apto_temporal') return 'no_disponible';
  if (fila.aptitud === 'apto_restricciones') return 'restringido';
  return 'disponible';
}

// GET /api/dashboard/inicio?disciplina_id=
// Todo lo que muestra la pantalla de inicio en una sola llamada.
exports.getInicio = async (req, res) => {
  const usuario = req.usuario;
  const disciplinaId = req.query.disciplina_id && req.query.disciplina_id !== 'todos'
    ? parseInt(req.query.disciplina_id, 10) || null
    : null;
  const veSalud = ['administrador', 'personal_salud', 'jugador'].includes(usuario.rol);

  try {
    // 1. Plantel con su estado
    const p1 = [];
    const { rows: plantelFilas } = await db.query(`
      SELECT j.id, j.nombre, j.dorsal, j.posicion, j.foto_url,
             les.id AS lesion_id, les.tipo AS lesion_tipo, les.fecha_inicio::text AS lesion_inicio,
             (CURRENT_DATE - les.fecha_inicio) AS dias_lesion,
             seg.fecha_retorno_estimada::text AS retorno_estimado,
             ctl.aptitud, ctl.restricciones, ctl.proxima_fecha::text AS proximo_control,
             (ctl.proxima_fecha < CURRENT_DATE) AS control_vencido
      FROM jugadores j
      LEFT JOIN LATERAL (
        SELECT l.id, l.tipo, l.fecha_inicio FROM lesiones l
        WHERE l.jugador_id = j.id AND l.fecha_inicio <= CURRENT_DATE
          AND (l.fecha_fin IS NULL OR l.fecha_fin >= CURRENT_DATE)
        ORDER BY l.fecha_inicio DESC, l.id DESC LIMIT 1
      ) les ON TRUE
      LEFT JOIN LATERAL (
        SELECT s.fecha_retorno_estimada FROM seguimiento_lesiones s
        WHERE s.lesion_id = les.id ORDER BY s.fecha_seguimiento DESC, s.id DESC LIMIT 1
      ) seg ON TRUE
      LEFT JOIN LATERAL (
        SELECT c.aptitud, c.restricciones, c.proxima_fecha FROM controles_medicos c
        WHERE c.jugador_id = j.id ORDER BY c.fecha DESC, c.id DESC LIMIT 1
      ) ctl ON TRUE
      WHERE ${alcanceJugadores(usuario, disciplinaId, p1)}
      ORDER BY j.dorsal NULLS LAST, j.nombre`, p1);

    const plantel = plantelFilas.map(f => ({
      id: f.id, nombre: f.nombre, dorsal: f.dorsal, posicion: f.posicion, foto_url: f.foto_url,
      estado: estadoDe(f),
      motivo: f.lesion_id ? `Lesión: ${f.lesion_tipo || 'sin tipo registrado'}`
        : f.aptitud === 'no_apto_temporal' ? 'No apto temporalmente'
        : f.aptitud === 'apto_restricciones' ? (f.restricciones || 'Apto con restricciones') : null,
    }));
    const resumen = {
      total: plantel.length,
      disponibles: plantel.filter(j => j.estado === 'disponible').length,
      restringidos: plantel.filter(j => j.estado === 'restringido').length,
      no_disponibles: plantel.filter(j => j.estado === 'no_disponible').length,
    };

    // 2. Para revisar
    const revisar = [];
    for (const f of plantelFilas) {
      if (f.lesion_id) {
        revisar.push({
          tipo: 'lesion', jugador_id: f.id, nombre: f.nombre, dorsal: f.dorsal,
          dias: Number(f.dias_lesion), lesion: f.lesion_tipo, retorno_estimado: f.retorno_estimado,
        });
      } else if (f.aptitud === 'apto_restricciones') {
        revisar.push({ tipo: 'restriccion', jugador_id: f.id, nombre: f.nombre, dorsal: f.dorsal, restricciones: f.restricciones });
      } else if (f.aptitud === 'no_apto_temporal') {
        revisar.push({ tipo: 'no_apto', jugador_id: f.id, nombre: f.nombre, dorsal: f.dorsal });
      }
      if (veSalud && f.control_vencido) {
        revisar.push({ tipo: 'control_vencido', jugador_id: f.id, nombre: f.nombre, dorsal: f.dorsal, fecha: f.proximo_control });
      }
    }
    if (['administrador', 'personal_salud'].includes(usuario.rol) && plantel.length) {
      const p2 = [];
      const { rows: [sinAntro] } = await db.query(`
        SELECT COUNT(*)::int AS total FROM jugadores j
        WHERE ${alcanceJugadores(usuario, disciplinaId, p2)}
          AND NOT EXISTS (
            SELECT 1 FROM antropometria a WHERE a.jugador_id = j.id
              AND a.fecha >= make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int,
                                       CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) <= 6 THEN 1 ELSE 7 END, 1)
          )`, p2);
      if (sinAntro.total > 0) revisar.push({ tipo: 'antropometria', total: sinAntro.total });
    }

    // 3. Próximo partido y agenda de los próximos 7 días
    const { rows: [proximo] } = await db.query(
      `SELECT id, fecha::text AS fecha, rival, tipo, resultado FROM partidos
       WHERE fecha >= CURRENT_DATE ORDER BY fecha ASC, id ASC LIMIT 1`);
    const { rows: partidos } = await db.query(
      `SELECT id, fecha::text AS fecha, rival, tipo FROM partidos
       WHERE fecha BETWEEN CURRENT_DATE AND CURRENT_DATE + 6 ORDER BY fecha, id`);
    const { rows: entrenos } = await db.query(
      `SELECT id, fecha::text AS fecha, tipo, descripcion FROM entrenamientos
       WHERE fecha BETWEEN CURRENT_DATE AND CURRENT_DATE + 6 ORDER BY fecha, id`);
    const semana = [
      ...partidos.map(p => ({ clase: 'partido', id: p.id, fecha: p.fecha, titulo: `Unisimón vs. ${p.rival}`, etiqueta: p.tipo === 'liga' ? 'Liga' : 'Amistoso' })),
      ...entrenos.map(e => ({ clase: 'entrenamiento', id: e.id, fecha: e.fecha, titulo: e.tipo, detalle: e.descripcion })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.clase === 'partido' ? -1 : 1));

    // 4. Asistencia de las últimas 4 sesiones (solo jugadores del alcance)
    const p3 = [];
    const alcance3 = alcanceJugadores(usuario, disciplinaId, p3);
    const { rows: asistencia } = await db.query(`
      SELECT e.id, e.fecha::text AS fecha, e.tipo,
             COUNT(ae.id) FILTER (WHERE ae.asistencia)::int AS presentes,
             COUNT(ae.id)::int AS registrados
      FROM entrenamientos e
      LEFT JOIN asistencia_entrenamiento ae ON ae.entrenamiento_id = e.id
        AND ae.jugador_id IN (SELECT j.id FROM jugadores j WHERE ${alcance3})
      WHERE e.fecha <= CURRENT_DATE
      GROUP BY e.id ORDER BY e.fecha DESC, e.id DESC LIMIT 4`, p3);

    // 5. Máximos anotadores
    const p4 = [];
    const { rows: anotadores } = await db.query(`
      SELECT j.id, j.nombre, j.dorsal,
             COALESCE(SUM(es.goles), 0)::int AS anotaciones,
             COALESCE(SUM(es.asistencias), 0)::int AS asistencias
      FROM estadisticas_jugador es JOIN jugadores j ON j.id = es.jugador_id
      WHERE ${alcanceJugadores(usuario, disciplinaId, p4)}
      GROUP BY j.id, j.nombre, j.dorsal
      HAVING COALESCE(SUM(es.goles), 0) + COALESCE(SUM(es.asistencias), 0) > 0
      ORDER BY anotaciones DESC, asistencias DESC, j.nombre LIMIT 5`, p4);

    res.json({ proximo_partido: proximo || null, plantel, resumen, revisar, semana, asistencia, anotadores });
  } catch (err) {
    responderError(res, err);
  }
};
