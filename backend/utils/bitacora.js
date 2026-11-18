// Bitácora de accesos a la historia clínica (v2.7, T0.6 del plan de historia clínica; RF-31).
// Cada ruta clínica llama a `registrar` ANTES de responder: si el registro falla, la consulta tampoco se entrega
// (ningún acceso queda sin rastro). Guarda quién (con copia de su nombre y su rol), qué acción, sobre qué registro,
// de qué deportista y cuándo. Nunca guarda contenido clínico.
const db = require('../config/db');

async function registrar(req, { accion, recurso, recurso_id = null, jugador_id = null }, cliente = db) {
  const u = req.usuario || {};
  await cliente.query(
    `INSERT INTO bitacora_clinica (usuario_id, usuario_nombre, usuario_rol, jugador_id, accion, recurso, recurso_id, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [u.id || null, u.nombre || null, u.rol || null, Number(jugador_id) || null, accion, recurso,
     Number(recurso_id) || null, String(req.ip || '').slice(0, 64) || null]);
}

// El deportista de una consulta de lista: el filtro pedido o, si es el propio deportista, él mismo
const jugadorDeLaConsulta = (req) =>
  req.query?.jugador_id || (req.usuario?.rol === 'jugador' ? req.usuario.jugador_id : null);

module.exports = { registrar, jugadorDeLaConsulta };
