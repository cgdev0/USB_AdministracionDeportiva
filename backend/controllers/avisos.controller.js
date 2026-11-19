// Avisos de manejo de datos (v2.9, T2.4 del plan de historia clínica; D9 y D10).
// Cada persona que entra tiene un aviso que aceptar:
//  - el personal (administrador, head coach, entrenador y salud): el compromiso de confidencialidad de su rol;
//  - el deportista: el aviso de privacidad (en lenguaje sencillo si es menor de edad).
// La aceptación guarda el aviso, su versión y la huella SHA-256 del texto exacto que se mostró. Si el texto cambia,
// cambia la versión y hay que aceptar de nuevo. Los textos están en frontend/src/utils/avisos.js.
// La T2.5 usa `pendienteDe` para que nadie del personal trabaje sin haber aceptado.
const crypto = require('crypto');
const path = require('path');
const { pathToFileURL } = require('url');
const db = require('../config/db');
const { responderError } = require('../utils/errores');
const { hoyLocal } = require('../utils/hoy');
const { recordar } = require('../utils/aceptadosRecientes');
const { puedeVerJugador } = require('../utils/alcance');

const utilidad = (archivo) => import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', archivo)).href);
const avisos = utilidad('avisos.js');
const identificacion = utilidad('identificacion.js');

const huella = (texto) => crypto.createHash('sha256').update(texto, 'utf8').digest('hex');

// El aviso que le corresponde a quien entra
async function avisoDe(usuario) {
  const m = await avisos;
  if (m.ROLES_PERSONAL.includes(usuario?.rol)) return m.compromisoPara(usuario.rol);
  if (usuario?.rol === 'jugador') {
    let menor = false;
    if (usuario.jugador_id) {
      const { rows: [j] } = await db.query('SELECT fecha_nacimiento, edad FROM jugadores WHERE id = $1', [usuario.jugador_id]);
      menor = !!j && (await identificacion).esMenorDeEdad(j, hoyLocal());
    }
    return m.avisoDeportista({ menor });
  }
  return null;
}

// ¿Ya aceptó la versión vigente? El personal, en su cuenta. El deportista, por cualquier camino: su cuenta, la
// tableta del profesional o la autorización de datos firmada en papel (T2.6).
async function aceptacionVigente(usuario, aviso) {
  const params = [usuario.id, aviso.aviso, aviso.version];
  let cond = 'usuario_id = $1 AND via = \'cuenta\'';
  if (aviso.aviso === 'aviso_deportista' && usuario.jugador_id) {
    params.push(usuario.jugador_id);
    cond = `(${cond} OR (jugador_id = $4 AND via IN ('cuenta', 'tableta', 'papel')))`;
  }
  const { rows: [a] } = await db.query(
    `SELECT id, aviso, version, via, aceptado_en FROM aceptaciones WHERE aviso = $2 AND version = $3 AND ${cond}
      ORDER BY aceptado_en DESC, id DESC LIMIT 1`, params);
  return a || null;
}

// El aviso que le falta aceptar a esta persona, o null si ya lo aceptó (o si su rol no tiene aviso)
async function pendienteDe(usuario) {
  const aviso = await avisoDe(usuario);
  if (!aviso) return null;
  return (await aceptacionVigente(usuario, aviso)) ? null : aviso;
}
exports.pendienteDe = pendienteDe;

// GET /api/avisos/mios  → { aviso, aceptado }
exports.mios = async (req, res) => {
  try {
    const aviso = await avisoDe(req.usuario);
    res.json({ aviso, aceptado: aviso ? await aceptacionVigente(req.usuario, aviso) : null });
  } catch (err) {
    responderError(res, err);
  }
};

// POST /api/avisos/aceptar  { aviso, version, acepto: true }
exports.aceptar = async (req, res) => {
  try {
    const aviso = await avisoDe(req.usuario);
    if (!aviso) return res.status(400).json({ error: 'Tu cuenta no tiene avisos por aceptar.' });
    if (req.body?.acepto !== true) return res.status(400).json({ error: 'Marca la casilla para aceptar.' });
    if (req.body.aviso !== aviso.aviso) return res.status(400).json({ error: 'Ese aviso no es el que te corresponde.' });
    // Se acepta lo que se leyó: si el texto cambió mientras tanto, hay que leerlo de nuevo
    if (req.body.version !== aviso.version) return res.status(409).json({ error: 'El texto cambió: léelo de nuevo y acéptalo.' });
    const previa = await aceptacionVigente(req.usuario, aviso);
    if (previa) return res.json({ aceptado: previa, nuevo: false });
    const { textoCanonico } = await avisos;
    const { rows: [u] } = await db.query('SELECT nombre, rol, jugador_id FROM usuarios WHERE id = $1', [req.usuario.id]);
    const { rows: [a] } = await db.query(
      `INSERT INTO aceptaciones (aviso, version, texto_sha256, via, usuario_id, usuario_nombre, usuario_rol, jugador_id, aceptante_nombre, ip)
       VALUES ($1, $2, $3, 'cuenta', $4, $5, $6, $7, $5, $8)
       RETURNING id, aviso, version, via, texto_sha256, aceptado_en`,
      [aviso.aviso, aviso.version, huella(textoCanonico(aviso)), req.usuario.id, u?.nombre || req.usuario.nombre, u?.rol || req.usuario.rol,
       u?.rol === 'jugador' ? u.jugador_id : null, String(req.ip || '').slice(0, 64) || null]);
    recordar(req.usuario.id); // desde ya puede trabajar (T2.5)
    res.status(201).json({ aceptado: a, nuevo: true });
  } catch (err) {
    responderError(res, err);
  }
};

exports.huella = huella;

// ── T2.6: el deportista acepta su aviso en la tableta del profesional, que queda como testigo ──
// Lo usa el personal con los deportistas de su alcance (el entrenador, los suyos). El texto es el que ve el
// deportista (en lenguaje sencillo si es menor), y queda su huella.
const ROLES_TESTIGO = ['administrador', 'head_coach', 'entrenador', 'personal_salud'];
async function deportistaDelAlcance(req, res) {
  if (!ROLES_TESTIGO.includes(req.usuario?.rol)) { res.status(403).json({ error: 'Solo el personal registra la aceptación de un deportista.' }); return null; }
  const id = Number(req.params.jugador_id);
  if (!(await puedeVerJugador(db, req.usuario, id))) { res.status(404).json({ error: 'Deportista no encontrado o fuera de tu alcance.' }); return null; }
  const { rows: [j] } = await db.query('SELECT id, nombre, fecha_nacimiento, edad FROM jugadores WHERE id = $1', [id]);
  const menor = (await identificacion).esMenorDeEdad(j, hoyLocal());
  return { jugador: j, aviso: (await avisos).avisoDeportista({ menor }) };
}

// GET /api/avisos/deportista/:jugador_id  → { aviso, aceptado }
exports.delDeportista = async (req, res) => {
  try {
    const d = await deportistaDelAlcance(req, res);
    if (!d) return;
    const { rows: [a] } = await db.query(
      `SELECT id, via, aceptante_nombre, aceptado_en FROM aceptaciones
        WHERE jugador_id = $1 AND aviso = 'aviso_deportista' AND version = $2 AND via IN ('cuenta', 'tableta', 'papel')
        ORDER BY aceptado_en DESC, id DESC LIMIT 1`, [d.jugador.id, d.aviso.version]);
    res.json({ aviso: d.aviso, aceptado: a || null });
  } catch (err) {
    responderError(res, err);
  }
};

// POST /api/avisos/deportista/:jugador_id/aceptar  { version, acepto: true, nombre }
exports.aceptarEnTableta = async (req, res) => {
  try {
    const d = await deportistaDelAlcance(req, res);
    if (!d) return;
    if (req.body?.acepto !== true) return res.status(400).json({ error: 'El deportista debe marcar la casilla para aceptar.' });
    const nombre = String(req.body.nombre || '').trim();
    if (!nombre) return res.status(400).json({ error: 'Escribe el nombre de quien acepta.' });
    if (nombre.length > 150) return res.status(400).json({ error: 'El nombre admite hasta 150 caracteres.' });
    if (req.body.version !== d.aviso.version) return res.status(409).json({ error: 'El texto cambió: muéstralo de nuevo y que lo acepte.' });
    const { textoCanonico } = await avisos;
    const { rows: [a] } = await db.query(
      `INSERT INTO aceptaciones (aviso, version, texto_sha256, via, jugador_id, aceptante_nombre, testigo_id, usuario_nombre, usuario_rol, ip)
       VALUES ('aviso_deportista', $1, $2, 'tableta', $3, $4, $5, $6, $7, $8)
       RETURNING id, via, aceptante_nombre, aceptado_en`,
      [d.aviso.version, huella(textoCanonico(d.aviso)), d.jugador.id, nombre, req.usuario.id, req.usuario.nombre || null,
       req.usuario.rol, String(req.ip || '').slice(0, 64) || null]);
    res.status(201).json({ aceptado: a });
  } catch (err) {
    responderError(res, err);
  }
};
