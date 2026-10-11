// Avisos del entrenador al equipo (v1.7): reemplazan los mensajes que se pierden en el grupo de WhatsApp.
// El entrenador elige un equipo (o todos sus deportistas); cada destinatario recibe un aviso en la campanita
// y el comunicado queda en el inicio. El administrador puede escribir a un equipo o a todo el sistema.
const db = require('../config/db');
const { responderError } = require('../utils/errores');
const { condicionAlcance, puedeUsarEquipo } = require('../utils/alcance');
const { notificarUsuarios } = require('../utils/notificar');

// GET /api/comunicados → los últimos 20 que recibió o escribió el usuario
exports.listar = async (req, res) => {
  try {
    const esAdmin = req.usuario.rol === 'administrador';
    const { rows } = await db.query(`
      SELECT c.id, c.titulo, c.mensaje, c.creado_en, c.equipo_id, eq.nombre AS equipo_nombre,
             u.nombre AS autor, c.autor_id = $1 AS propio,
             (SELECT COUNT(*)::int FROM comunicado_destinatarios d WHERE d.comunicado_id = c.id) AS destinatarios
      FROM comunicados c
      LEFT JOIN usuarios u ON u.id = c.autor_id
      LEFT JOIN equipos eq ON eq.id = c.equipo_id
      WHERE ${esAdmin ? 'TRUE' : 'c.autor_id = $1 OR EXISTS (SELECT 1 FROM comunicado_destinatarios d WHERE d.comunicado_id = c.id AND d.usuario_id = $1)'}
      ORDER BY c.creado_en DESC, c.id DESC LIMIT 20`, [req.usuario.id]);
    res.json(rows);
  } catch (err) { responderError(res, err); }
};

// POST /api/comunicados   { titulo, mensaje, equipo_id }
exports.crear = async (req, res) => {
  const titulo = typeof req.body?.titulo === 'string' ? req.body.titulo.trim() : '';
  const mensaje = typeof req.body?.mensaje === 'string' ? req.body.mensaje.trim() : '';
  const equipoId = req.body?.equipo_id ? Number(req.body.equipo_id) : null;
  if (!titulo || !mensaje) return res.status(400).json({ error: 'Escribe el título y el mensaje del aviso.' });
  if (titulo.length > 120) return res.status(400).json({ error: 'El título puede tener hasta 120 caracteres.' });
  if (equipoId !== null && (!Number.isInteger(equipoId) || equipoId < 1)) return res.status(400).json({ error: 'El equipo indicado no es válido.' });

  const cliente = await db.connect();
  try {
    if (!(await puedeUsarEquipo(cliente, req.usuario, equipoId))) {
      return res.status(403).json({ error: 'Solo puedes escribir a equipos donde tienes deportistas.' });
    }
    // Destinatarios: cuentas de los deportistas del equipo (o de todo el alcance); el administrador sin equipo escribe a todos
    let destinatarios;
    if (equipoId) {
      ({ rows: destinatarios } = await cliente.query(
        `SELECT u.id FROM usuarios u JOIN jugadores j ON j.id = u.jugador_id WHERE j.equipo_id = $1 AND u.activo`, [equipoId]));
    } else if (req.usuario.rol === 'administrador') {
      ({ rows: destinatarios } = await cliente.query('SELECT id FROM usuarios WHERE activo AND id <> $1', [req.usuario.id]));
    } else {
      const params = [];
      const cond = condicionAlcance(req.usuario, params, 'j');
      ({ rows: destinatarios } = await cliente.query(
        `SELECT u.id FROM usuarios u JOIN jugadores j ON j.id = u.jugador_id WHERE u.activo AND ${cond}`, params));
    }

    await cliente.query('BEGIN');
    const { rows: [c] } = await cliente.query(
      'INSERT INTO comunicados (autor_id, equipo_id, titulo, mensaje) VALUES ($1, $2, $3, $4) RETURNING id, creado_en',
      [req.usuario.id, equipoId, titulo, mensaje]);
    const ids = destinatarios.map(d => d.id);
    for (const id of ids) {
      await cliente.query('INSERT INTO comunicado_destinatarios (comunicado_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [c.id, id]);
    }
    await notificarUsuarios(cliente, ids, {
      titulo: `${req.usuario.rol === 'administrador' ? 'Aviso de la administración' : 'Aviso del entrenador'}: ${titulo}`, mensaje: mensaje.length > 180 ? `${mensaje.slice(0, 177)}…` : mensaje,
      tipo: 'comunicado', enlace: '/',
    });
    await cliente.query('COMMIT');
    res.status(201).json({ id: c.id, creado_en: c.creado_en, destinatarios: ids.length });
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    responderError(res, err);
  } finally {
    cliente.release();
  }
};

// DELETE /api/comunicados/:id → el autor o el administrador
exports.eliminar = async (req, res) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM comunicados WHERE id = $1 AND ($2 = 'administrador' OR autor_id = $3)`,
      [req.params.id, req.usuario.rol, req.usuario.id]);
    if (!rowCount) return res.status(404).json({ error: 'Aviso no encontrado' });
    res.json({ ok: true });
  } catch (err) { responderError(res, err); }
};
