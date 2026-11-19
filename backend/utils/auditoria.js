// Registro de auditoría (v2.9, T2.7 del plan de historia clínica; D13). Lo consulta solo el administrador.
// Quién hizo qué con las personas y las cuentas, cuándo y desde dónde. Nunca guarda contenido clínico: los accesos a
// la historia clínica tienen su propia bitácora (utils/bitacora.js). Como la bitácora, se escribe ANTES de responder:
// si no se puede registrar, la acción no se confirma (salvo los inicios de sesión fallidos, que no deben impedir
// responder al intento).
const db = require('../config/db');

const ipDe = (req) => String(req.ip || '').slice(0, 64) || null;

async function auditar(req, { accion, recurso, recurso_id = null, detalle = {} }, cliente = db) {
  const u = req.usuario || {};
  await cliente.query(
    `INSERT INTO auditoria (usuario_id, usuario_nombre, usuario_rol, accion, recurso, recurso_id, detalle, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [u.id || null, u.nombre || null, u.rol || null, accion, recurso, Number(recurso_id) || null, detalle, ipDe(req)]);
}

// Inicio de sesión fallido o bloqueado: sin sesión; se guarda el usuario que se intentó (no la contraseña)
async function auditarSesion(req, accion) {
  try {
    const intento = String(req.body?.email || '').trim().toLowerCase().slice(0, 150) || null;
    await auditar({ ip: req.ip }, { accion, recurso: 'sesion', detalle: { intento } });
  } catch {
    /* el intento se responde igual; el límite de intentos sigue funcionando */
  }
}

// Ajustes del sistema (interruptores que cambia el administrador)
async function leerAjuste(clave, porDefecto = null) {
  const { rows: [a] } = await db.query('SELECT valor FROM ajustes WHERE clave = $1', [clave]);
  return a ? a.valor : porDefecto;
}

module.exports = { auditar, auditarSesion, leerAjuste };
