const db = require('../config/db');

const { responderError } = require('../utils/errores');
exports.resumen = async (req, res) => {
  try {
    const [entrenadores, jugadores, equipos, partidos] = await Promise.all([
      db.query("SELECT id, nombre, email FROM usuarios WHERE rol='entrenador' AND head_coach_id=$1 ORDER BY nombre", [req.usuario.id]),
      db.query(`SELECT j.id, j.nombre, j.dorsal, j.posicion, j.edad, e.nombre AS equipo_nombre, u.nombre AS entrenador_nombre
        FROM jugadores j JOIN usuarios u ON u.id=j.entrenador_id
        LEFT JOIN equipos e ON e.id=j.equipo_id WHERE u.head_coach_id=$1 ORDER BY j.nombre`, [req.usuario.id]),
      db.query("SELECT COUNT(DISTINCT j.equipo_id)::int AS total FROM jugadores j JOIN usuarios u ON u.id=j.entrenador_id WHERE u.head_coach_id=$1", [req.usuario.id]),
      db.query('SELECT COUNT(*)::int AS total FROM partidos WHERE fecha >= CURRENT_DATE')
    ]);
    res.json({ entrenadores: entrenadores.rows, jugadores: jugadores.rows, total_equipos: equipos.rows[0]?.total || 0, proximos_partidos: partidos.rows[0]?.total || 0 });
  } catch (err) { responderError(res, err); }
};
exports.entrenadores = async (req, res) => {
  try { const { rows } = await db.query("SELECT id,nombre,email FROM usuarios WHERE rol='entrenador' AND head_coach_id=$1 ORDER BY nombre", [req.usuario.id]); res.json(rows); }
  catch (err) { responderError(res, err); }
};
exports.jugadores = async (req, res) => {
  try { const { rows } = await db.query(`SELECT j.*, e.nombre AS equipo_nombre, u.nombre AS entrenador_nombre FROM jugadores j JOIN usuarios u ON u.id=j.entrenador_id LEFT JOIN equipos e ON e.id=j.equipo_id WHERE u.head_coach_id=$1 ORDER BY j.nombre`, [req.usuario.id]); res.json(rows); }
  catch (err) { responderError(res, err); }
};
