const db = require('../config/db');

const { responderError } = require('../utils/errores');
const { registrar, jugadorDeLaConsulta } = require('../utils/bitacora'); // v2.7 (T0.6): bitácora de accesos
// Restringe las lesiones visibles según el rol: el jugador ve las propias,
// el entrenador las de sus deportistas y el head coach las de sus entrenadores.
function filtroPorRol(usuario, params) {
  if (usuario?.rol === 'jugador') {
    params.push(usuario.jugador_id);
    return `l.jugador_id = $${params.length}`;
  }
  if (usuario?.rol === 'entrenador') {
    params.push(usuario.id);
    return `j.entrenador_id = $${params.length}`;
  }
  if (usuario?.rol === 'head_coach') {
    params.push(usuario.id);
    return `j.entrenador_id IN (SELECT id FROM usuarios WHERE head_coach_id = $${params.length})`;
  }
  return null;
}

// v2.7 (T0.7): el detalle clínico (tipo y descripción) solo lo ven el personal de salud y el propio deportista.
// Los demás roles reciben la disponibilidad: desde cuándo, hasta cuándo, estado del seguimiento y retorno estimado.
const veDetalleClinico = (usuario) => ['personal_salud', 'jugador'].includes(usuario?.rol);
const SEGUIMIENTO = `LEFT JOIN LATERAL (SELECT s.estado, s.fecha_retorno_estimada FROM seguimiento_lesiones s
  WHERE s.lesion_id = l.id ORDER BY s.fecha_seguimiento DESC, s.id DESC LIMIT 1) seg ON TRUE`;
const columnas = (usuario) => (veDetalleClinico(usuario)
  ? 'l.*'
  : 'l.id, l.jugador_id, l.fecha_inicio, l.fecha_fin') +
  ', j.nombre AS jugador_nombre, j.dorsal AS jugador_dorsal, j.disciplina_id, seg.estado AS estado_seguimiento, seg.fecha_retorno_estimada::text AS fecha_retorno_estimada';

exports.getAll = async (req, res) => {
  try {
    if (req.usuario?.rol === 'jugador' && !req.usuario.jugador_id) return res.json([]);
    let query = `SELECT ${columnas(req.usuario)} FROM lesiones l JOIN jugadores j ON l.jugador_id = j.id ${SEGUIMIENTO}`;
    const params = [];
    const filtro = filtroPorRol(req.usuario, params);
    if (filtro) query += ` WHERE ${filtro}`;
    query += ' ORDER BY l.fecha_inicio DESC';
    const { rows } = await db.query(query, params);
    await registrar(req, { accion: 'listar', recurso: 'lesion', jugador_id: jugadorDeLaConsulta(req) });
    res.json(rows);
  } catch (err) {
    responderError(res, err);
  }
};

exports.getOne = async (req, res) => {
  try {
    if (req.usuario?.rol === 'jugador' && !req.usuario.jugador_id) {
      return res.status(404).json({ error: 'Lesión no encontrada' });
    }
    const params = [req.params.id];
    let query = `SELECT ${columnas(req.usuario)} FROM lesiones l JOIN jugadores j ON l.jugador_id = j.id ${SEGUIMIENTO} WHERE l.id = $1`;
    const filtro = filtroPorRol(req.usuario, params);
    if (filtro) query += ` AND ${filtro}`;
    const { rows } = await db.query(query, params);
    if (!rows.length) return res.status(404).json({ error: 'Lesión no encontrada' });
    await registrar(req, { accion: 'ver', recurso: 'lesion', recurso_id: rows[0].id, jugador_id: rows[0].jugador_id });
    res.json(rows[0]);
  } catch (err) {
    responderError(res, err);
  }
};

exports.create = async (req, res) => {
  const { jugador_id, tipo, descripcion, fecha_inicio, fecha_fin } = req.body;
  if (!jugador_id || !fecha_inicio) return res.status(400).json({ error: 'jugador_id y fecha_inicio son obligatorios' });
  try {
    const { rows } = await db.query(
      'INSERT INTO lesiones (jugador_id, tipo, descripcion, fecha_inicio, fecha_fin) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [jugador_id, tipo, descripcion, fecha_inicio, fecha_fin || null]
    );
    await registrar(req, { accion: 'crear', recurso: 'lesion', recurso_id: rows[0].id, jugador_id });
    res.status(201).json({ id: rows[0].id, jugador_id, tipo, descripcion, fecha_inicio, fecha_fin });
  } catch (err) {
    responderError(res, err);
  }
};

exports.update = async (req, res) => {
  const { jugador_id, tipo, descripcion, fecha_inicio, fecha_fin } = req.body;
  try {
    const { rowCount } = await db.query(
      'UPDATE lesiones SET jugador_id=$1, tipo=$2, descripcion=$3, fecha_inicio=$4, fecha_fin=$5 WHERE id=$6',
      [jugador_id, tipo, descripcion, fecha_inicio, fecha_fin || null, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Lesión no encontrada' });
    await registrar(req, { accion: 'editar', recurso: 'lesion', recurso_id: req.params.id, jugador_id });
    res.json({ message: 'Lesión actualizada correctamente' });
  } catch (err) {
    responderError(res, err);
  }
};

exports.remove = async (req, res) => {
  try {
    const { rows } = await db.query('DELETE FROM lesiones WHERE id = $1 RETURNING jugador_id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Lesión no encontrada' });
    await registrar(req, { accion: 'eliminar', recurso: 'lesion', recurso_id: req.params.id, jugador_id: rows[0].jugador_id });
    res.json({ message: 'Lesión eliminada correctamente' });
  } catch (err) {
    responderError(res, err);
  }
};
