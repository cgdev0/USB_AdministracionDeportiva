// Valoraciones de la historia clínica (v2.7, T0.3 del plan de historia clínica).
// Resolución 1995 de 1999: la historia es secuencial (cada atención es un registro aparte, con fecha, hora y quien
// atiende) y no se altera. Ciclo de una valoración:
//   borrador  → la edita solo quien la abrió (con número de versión para no pisar cambios de otro dispositivo)
//   cerrada   → no se modifica ni se borra (lo impide también un trigger de la base); se corrige con notas aclaratorias
// Al cerrar se guarda una copia de los datos de quien atiende (T0.2) y un código de integridad SHA-256.
// Acceso (art. 14): el personal de salud y el propio deportista (solo sus valoraciones cerradas).
const crypto = require('crypto');
const path = require('path');
const { pathToFileURL } = require('url');
const db = require('../config/db');
const { responderError } = require('../utils/errores');
const { columnasQuienAtiende, conQuienAtiende, datosDeQuienAtiende } = require('../utils/quienAtiende');
const { registrar, jugadorDeLaConsulta } = require('../utils/bitacora'); // v2.7 (T0.6): bitácora de accesos

const modulo = import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'valoracion.js')).href);
const QA = columnasQuienAtiende('pr');
const esSalud = (usuario) => usuario?.rol === 'personal_salud';

const SELECT = `SELECT v.*, j.nombre AS jugador_nombre, j.dorsal AS jugador_dorsal, j.disciplina_id,
    j.tipo_documento AS jugador_tipo_documento, j.numero_documento AS jugador_numero_documento, ${QA.columnas}
  FROM valoraciones v JOIN jugadores j ON j.id = v.jugador_id
  LEFT JOIN usuarios pr ON pr.id = v.profesional_id ${QA.join}`;

// ── Código de integridad ──────────────────────────────────────
// JSON con las claves ordenadas: el mismo contenido siempre da el mismo texto, sin importar el orden de JSONB
function canonico(valor) {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor === undefined ? null : valor);
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;
  return `{${Object.keys(valor).sort().filter(k => valor[k] !== undefined)
    .map(k => `${JSON.stringify(k)}:${canonico(valor[k])}`).join(',')}}`;
}
const iso = (fecha) => (fecha ? new Date(fecha).toISOString() : null);
// Lo que se firma: qué registro es, de quién, qué dice, quién atendió y cuándo se cerró
function huella(v) {
  return crypto.createHash('sha256').update(canonico({
    id: v.id, jugador_id: v.jugador_id, tipo: v.tipo, fecha_hora: iso(v.fecha_hora),
    contenido: v.contenido, quien_atiende: v.quien_atiende, cerrada_en: iso(v.cerrada_en),
  })).digest('hex');
}

// ── Lectura ──────────────────────────────────────────────────
function condicionLectura(usuario, params) {
  if (esSalud(usuario)) return 'TRUE';
  if (usuario?.rol === 'jugador') {
    params.push(usuario.jugador_id || 0);
    return `v.jugador_id = $${params.length} AND v.estado = 'cerrada'`;
  }
  return 'FALSE';
}

// Texto de quién atendió: la copia guardada al cerrar o, en un borrador, los datos actuales del profesional
async function presentar(filas) {
  const { ETIQUETA_TIPO } = await modulo;
  return (await conQuienAtiende(filas)).map(v => ({
    ...v,
    tipo_nombre: ETIQUETA_TIPO[v.tipo] || v.tipo,
    atendio: v.quien_atiende ? [v.quien_atiende.nombre, v.quien_atiende.descripcion].filter(Boolean).join(' · ') : v.atendio,
  }));
}

async function buscar(id, usuario) {
  const params = [id];
  const cond = condicionLectura(usuario, params);
  const { rows } = await db.query(`${SELECT} WHERE v.id = $1 AND ${cond}`, params);
  return rows[0] ? (await presentar(rows))[0] : null;
}

// GET /api/valoraciones?jugador_id=
exports.listar = async (req, res) => {
  try {
    const params = [];
    const condiciones = [condicionLectura(req.usuario, params)];
    if (req.query.jugador_id) {
      if (!/^[1-9]\d{0,9}$/.test(String(req.query.jugador_id))) return res.status(400).json({ error: 'El deportista no es válido.' });
      params.push(req.query.jugador_id);
      condiciones.push(`v.jugador_id = $${params.length}`);
    }
    const { rows } = await db.query(
      `${SELECT} WHERE ${condiciones.join(' AND ')} ORDER BY v.fecha_hora DESC, v.id DESC LIMIT 300`, params);
    await registrar(req, { accion: 'listar', recurso: 'valoracion', jugador_id: jugadorDeLaConsulta(req) });
    res.json(await presentar(rows));
  } catch (err) {
    responderError(res, err);
  }
};

// GET /api/valoraciones/:id (con sus notas aclaratorias)
exports.obtener = async (req, res) => {
  try {
    const v = await buscar(req.params.id, req.usuario);
    if (!v) return res.status(404).json({ error: 'Valoración no encontrada' });
    await registrar(req, { accion: 'ver', recurso: 'valoracion', recurso_id: v.id, jugador_id: v.jugador_id });
    const { rows: notas } = await db.query(
      'SELECT id, texto, profesional_id, quien_atiende, creada_en FROM notas_aclaratorias WHERE valoracion_id = $1 ORDER BY creada_en, id',
      [v.id]);
    res.json({ ...v, notas });
  } catch (err) {
    responderError(res, err);
  }
};

// ── Escritura (solo personal de salud) ─────────────────────────
async function validarTipo(tipo) {
  const { TIPOS_VALORACION } = await modulo;
  return TIPOS_VALORACION.some(([t]) => t === tipo);
}

// POST /api/valoraciones
exports.crear = async (req, res) => {
  const { jugador_id } = req.body;
  const tipo = req.body.tipo || 'control';
  try {
    if (!jugador_id) return res.status(400).json({ error: 'El deportista es obligatorio.' });
    if (!(await validarTipo(tipo))) return res.status(400).json({ error: 'El tipo de valoración no es válido.' });
    const { normalizarContenido } = await modulo;
    const c = normalizarContenido(req.body.contenido || {});
    if (!c.ok) return res.status(400).json({ error: c.error });
    const { rows: [j] } = await db.query('SELECT id, numero_documento FROM jugadores WHERE id = $1', [jugador_id]);
    if (!j) return res.status(404).json({ error: 'Deportista no encontrado' });
    // Res. 1995 de 1999: la historia clínica se identifica con el documento de identidad (T0.1)
    if (!j.numero_documento) {
      return res.status(400).json({ error: 'Para abrir una valoración, registra primero el documento de identidad del deportista.' });
    }
    const { rows: [nueva] } = await db.query(
      `INSERT INTO valoraciones (jugador_id, profesional_id, tipo, contenido) VALUES ($1, $2, $3, $4) RETURNING id`,
      [jugador_id, req.usuario.id, tipo, c.contenido]);
    await registrar(req, { accion: 'crear', recurso: 'valoracion', recurso_id: nueva.id, jugador_id });
    res.status(201).json(await buscar(nueva.id, req.usuario));
  } catch (err) {
    responderError(res, err);
  }
};

// Revisa que la valoración exista, esté en borrador y sea de quien la quiere cambiar
async function borradorPropio(id, usuario) {
  const { rows: [v] } = await db.query('SELECT * FROM valoraciones WHERE id = $1', [id]);
  if (!v) return { status: 404, error: 'Valoración no encontrada' };
  if (v.estado === 'cerrada') {
    return { status: 409, error: 'La valoración está cerrada: no se puede modificar. Agrega una nota aclaratoria.' };
  }
  if (Number(v.profesional_id) !== Number(usuario.id)) {
    return { status: 403, error: 'Solo quien abrió la valoración puede cambiarla mientras está en borrador.' };
  }
  return { v };
}

// PUT /api/valoraciones/:id  (guardar borrador)
exports.guardar = async (req, res) => {
  try {
    const r = await borradorPropio(req.params.id, req.usuario);
    if (r.error) return res.status(r.status).json({ error: r.error });
    const version = Number(req.body.version);
    if (!Number.isInteger(version)) return res.status(400).json({ error: 'Falta la versión de la valoración que se está editando.' });
    const tipo = req.body.tipo || r.v.tipo;
    if (!(await validarTipo(tipo))) return res.status(400).json({ error: 'El tipo de valoración no es válido.' });
    const { normalizarContenido } = await modulo;
    const c = normalizarContenido(req.body.contenido ?? r.v.contenido);
    if (!c.ok) return res.status(400).json({ error: c.error });
    const { rowCount } = await db.query(
      `UPDATE valoraciones SET tipo = $1, contenido = $2, version = version + 1, actualizado_en = now()
       WHERE id = $3 AND version = $4 AND estado = 'borrador'`,
      [tipo, c.contenido, req.params.id, version]);
    if (!rowCount) {
      return res.status(409).json({ error: 'La valoración cambió en otro dispositivo. Recárgala para ver la última versión antes de seguir.' });
    }
    await registrar(req, { accion: 'editar', recurso: 'valoracion', recurso_id: r.v.id, jugador_id: r.v.jugador_id });
    res.json(await buscar(req.params.id, req.usuario));
  } catch (err) {
    responderError(res, err);
  }
};

// POST /api/valoraciones/:id/cerrar  (firmar: desde aquí no se modifica)
exports.cerrar = async (req, res) => {
  try {
    const r = await borradorPropio(req.params.id, req.usuario);
    if (r.error) return res.status(r.status).json({ error: r.error });
    const { contenidoVacio, MENSAJE_VACIA } = await modulo;
    if (contenidoVacio(r.v.contenido)) return res.status(400).json({ error: MENSAJE_VACIA });
    if (req.body?.version !== undefined && Number(req.body.version) !== Number(r.v.version)) {
      return res.status(409).json({ error: 'La valoración cambió en otro dispositivo. Recárgala antes de cerrarla.' });
    }
    // Copia de los datos de quien atiende (T0.2): no cambia si después se edita la cuenta o termina la práctica
    const quien_atiende = await datosDeQuienAtiende(db, req.usuario.id);
    const cerrada_en = new Date().toISOString();
    const hash_cierre = huella({ ...r.v, quien_atiende, cerrada_en });
    const { rowCount } = await db.query(
      `UPDATE valoraciones SET estado = 'cerrada', cerrada_en = $1, quien_atiende = $2, hash_cierre = $3, actualizado_en = now()
       WHERE id = $4 AND estado = 'borrador' AND version = $5`,
      [cerrada_en, quien_atiende, hash_cierre, r.v.id, r.v.version]);
    if (!rowCount) return res.status(409).json({ error: 'La valoración cambió mientras se cerraba. Recárgala e inténtalo de nuevo.' });
    await registrar(req, { accion: 'cerrar', recurso: 'valoracion', recurso_id: r.v.id, jugador_id: r.v.jugador_id });
    res.json(await buscar(r.v.id, req.usuario));
  } catch (err) {
    responderError(res, err);
  }
};

// DELETE /api/valoraciones/:id  (descartar un borrador; lo cerrado nunca se borra)
exports.descartar = async (req, res) => {
  try {
    const r = await borradorPropio(req.params.id, req.usuario);
    if (r.error) return res.status(r.status).json({ error: r.error });
    await db.query(`DELETE FROM valoraciones WHERE id = $1 AND estado = 'borrador'`, [r.v.id]);
    await registrar(req, { accion: 'descartar', recurso: 'valoracion', recurso_id: r.v.id, jugador_id: r.v.jugador_id });
    res.json({ message: 'Borrador descartado' });
  } catch (err) {
    responderError(res, err);
  }
};

// POST /api/valoraciones/:id/notas  (única forma de corregir o completar una valoración cerrada)
exports.agregarNota = async (req, res) => {
  try {
    const { MAX_TEXTO } = await modulo;
    const texto = typeof req.body.texto === 'string' ? req.body.texto.trim() : '';
    if (!texto) return res.status(400).json({ error: 'Escribe la nota aclaratoria.' });
    if (texto.length > MAX_TEXTO) return res.status(400).json({ error: `La nota admite máximo ${MAX_TEXTO} caracteres.` });
    const { rows: [v] } = await db.query('SELECT id, estado, jugador_id FROM valoraciones WHERE id = $1', [req.params.id]);
    if (!v) return res.status(404).json({ error: 'Valoración no encontrada' });
    if (v.estado !== 'cerrada') {
      return res.status(409).json({ error: 'La valoración sigue en borrador: corrígela directamente. Las notas aclaratorias son para valoraciones cerradas.' });
    }
    const quien_atiende = await datosDeQuienAtiende(db, req.usuario.id);
    const { rows: [nota] } = await db.query(
      `INSERT INTO notas_aclaratorias (valoracion_id, texto, profesional_id, quien_atiende) VALUES ($1, $2, $3, $4)
       RETURNING id, texto, profesional_id, quien_atiende, creada_en`,
      [v.id, texto, req.usuario.id, quien_atiende]);
    await registrar(req, { accion: 'crear', recurso: 'nota', recurso_id: nota.id, jugador_id: v.jugador_id });
    res.status(201).json(nota);
  } catch (err) {
    responderError(res, err);
  }
};

// GET /api/valoraciones/:id/integridad  (¿alguien cambió la valoración después de cerrarla?)
exports.integridad = async (req, res) => {
  try {
    const { rows: [v] } = await db.query('SELECT * FROM valoraciones WHERE id = $1', [req.params.id]);
    if (!v) return res.status(404).json({ error: 'Valoración no encontrada' });
    await registrar(req, { accion: 'verificar', recurso: 'valoracion', recurso_id: v.id, jugador_id: v.jugador_id });
    if (v.estado !== 'cerrada') return res.json({ integra: null, mensaje: 'La valoración sigue en borrador: todavía no tiene código de integridad.' });
    if (!v.hash_cierre) {
      return res.json({ integra: null, mensaje: 'Registro migrado de la versión anterior: se registró antes de que existiera el código de integridad.' });
    }
    const calculado = huella(v);
    const integra = calculado === v.hash_cierre.trim();
    res.json({
      integra,
      hash_guardado: v.hash_cierre.trim(),
      hash_calculado: calculado,
      mensaje: integra ? 'La valoración no ha cambiado desde que se cerró.' : 'La valoración cambió después de cerrarse: el contenido no coincide con su código de integridad.',
    });
  } catch (err) {
    responderError(res, err);
  }
};

module.exports.huella = huella;
