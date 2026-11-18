// Consulta de la bitácora de accesos (v2.7, T0.6 del plan de historia clínica; RF-31).
//  - Personal de salud: los accesos a la historia de un deportista ("Accesos a esta historia").
//  - Deportista: quién ha consultado su propia historia (derecho del titular a conocer el uso de sus datos, Ley 1581).
//  - Administrador: la vista general para auditoría, con filtros. Solo quién, qué y cuándo, sin contenido clínico.
// Consultar la bitácora no se registra en ella.
const db = require('../config/db');
const { responderError } = require('../utils/errores');

const ID = /^[1-9]\d{0,9}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/bitacora?jugador_id=&usuario_id=&accion=&desde=&hasta=
exports.listar = async (req, res) => {
  try {
    const { rol } = req.usuario;
    const { jugador_id, usuario_id, accion, desde, hasta } = req.query;
    const params = [];
    const cond = [];
    const agregar = (sqlTexto, valor) => { params.push(valor); cond.push(sqlTexto.replace('?', `$${params.length}`)); };

    if (rol === 'jugador') {
      agregar('b.jugador_id = ?', req.usuario.jugador_id || 0);
    } else if (rol === 'personal_salud') {
      if (!ID.test(String(jugador_id || ''))) return res.status(400).json({ error: 'Elige el deportista cuya historia quieres revisar.' });
      agregar('b.jugador_id = ?', jugador_id);
    } else if (jugador_id) {
      if (!ID.test(String(jugador_id))) return res.status(400).json({ error: 'El deportista no es válido.' });
      agregar('b.jugador_id = ?', jugador_id);
    }
    if (rol === 'administrador') {
      if (usuario_id) {
        if (!ID.test(String(usuario_id))) return res.status(400).json({ error: 'El usuario no es válido.' });
        agregar('b.usuario_id = ?', usuario_id);
      }
      if (accion) agregar('b.accion = ?', String(accion));
    }
    if (desde) { if (!FECHA.test(desde)) return res.status(400).json({ error: 'La fecha "desde" no es válida.' }); agregar('b.creado_en >= ?::date', desde); }
    if (hasta) { if (!FECHA.test(hasta)) return res.status(400).json({ error: 'La fecha "hasta" no es válida.' }); agregar(`b.creado_en < (?::date + 1)`, hasta); }

    const { rows } = await db.query(
      `SELECT b.id, b.creado_en, b.usuario_id, b.usuario_nombre, b.usuario_rol, b.jugador_id, j.nombre AS jugador_nombre,
              b.accion, b.recurso, b.recurso_id${rol === 'administrador' ? ', b.ip' : ''}
         FROM bitacora_clinica b LEFT JOIN jugadores j ON j.id = b.jugador_id
        ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''}
        ORDER BY b.creado_en DESC, b.id DESC LIMIT 300`, params);
    res.json(rows);
  } catch (err) {
    responderError(res, err);
  }
};
