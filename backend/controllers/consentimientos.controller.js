// Consentimientos de la historia clínica (v2.9, T2.1 del plan de historia clínica; RF-27).
// Las reglas están en frontend/src/utils/consentimientos.js (las mismas que usa la pantalla):
//  1. firmado solo con la foto o el PDF del papel, que se guarda en la misma transacción;
//  2. el menor de edad firma por medio de su acudiente y se registra su asentimiento;
//  3. revocar crea un registro nuevo: nada se modifica ni se borra (lo impide también un trigger de la base);
//  4. el de investigación es independiente de los demás.
// Los registra el personal de salud. Los consulta el personal de salud y el propio deportista (Ley 1581: el
// titular tiene derecho a conocer lo que autorizó). Cada consulta y cada registro queda en la bitácora.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const db = require('../config/db');
const { responderError } = require('../utils/errores');
const { registrar } = require('../utils/bitacora');
const { datosDeQuienAtiende } = require('../utils/quienAtiende');
const { hoyLocal } = require('../utils/hoy');
const { revisarArchivo, guardarArchivo } = require('./archivosClinicos.controller');

const utilidad = (archivo) => import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', archivo)).href);
const reglas = utilidad('consentimientos.js');
const identificacion = utilidad('identificacion.js');
const avisos = utilidad('avisos.js'); // v2.9 (T2.6)
const { huella: huellaAviso } = require('../utils/autorizaciones');
const ID = /^[1-9]\d{0,9}$/;

const SELECT = `SELECT c.*, a.nombre_original AS archivo_nombre, a.mime AS archivo_mime
  FROM consentimientos c LEFT JOIN archivos_clinicos a ON a.id = c.archivo_id`;

const historialDe = async (jugadorId, cliente = db) =>
  (await cliente.query(`${SELECT} WHERE c.jugador_id = $1 ORDER BY c.registrado_en DESC, c.id DESC`, [jugadorId])).rows;

async function jugadorPorId(id) {
  const { rows: [j] } = await db.query(
    `SELECT id, nombre, tipo_documento, numero_documento, fecha_nacimiento, edad,
            acudiente_nombre, acudiente_tipo_documento, acudiente_numero_documento, acudiente_parentesco
       FROM jugadores WHERE id = $1`, [id]);
  return j || null;
}

// Dos dispositivos que registran a la vez el mismo tipo para el mismo deportista se esperan uno al otro
async function bloquear(cliente, jugadorId, tipo) {
  const { TIPOS_CONSENTIMIENTO } = await reglas;
  await cliente.query('SELECT pg_advisory_xact_lock($1, $2)', [Number(jugadorId), 1000 + TIPOS_CONSENTIMIENTO.findIndex(([t]) => t === tipo)]);
}

async function aceptacionPorPapel(cliente, req, jugadorId, consentimientoId, firmante) {
  const [{ avisoDeportista, textoCanonico }, { esMenorDeEdad }] = await Promise.all([avisos, identificacion]);
  const { rows: [j] } = await cliente.query('SELECT fecha_nacimiento, edad FROM jugadores WHERE id = $1', [jugadorId]);
  const aviso = avisoDeportista({ menor: esMenorDeEdad(j, hoyLocal()) });
  await cliente.query(
    `INSERT INTO aceptaciones (aviso, version, texto_sha256, via, jugador_id, aceptante_nombre, testigo_id, consentimiento_id, usuario_nombre, usuario_rol, ip)
     VALUES ('aviso_deportista', $1, $2, 'papel', $3, $4, $5, $6, $7, $8, $9)`,
    [aviso.version, huellaAviso(textoCanonico(aviso)), jugadorId, firmante || null, req.usuario.id, consentimientoId,
     req.usuario.nombre || null, req.usuario.rol, String(req.ip || '').slice(0, 64) || null]);
}

async function respuesta(jugadorId, id) {
  const { estadoActual } = await reglas;
  const historial = await historialDe(jugadorId);
  return { registro: historial.find(c => c.id === id), actual: estadoActual(historial), historial };
}

// GET /api/consentimientos?jugador_id=   (el deportista consulta los suyos sin indicar el id)
exports.listar = async (req, res) => {
  try {
    const propio = req.usuario.rol === 'jugador';
    const jugadorId = propio ? req.usuario.jugador_id : req.query.jugador_id;
    if (!ID.test(String(jugadorId || ''))) {
      return propio ? res.status(404).json({ error: 'Tu cuenta no está vinculada a un deportista.' })
        : res.status(400).json({ error: 'Indica el deportista.' });
    }
    const j = await jugadorPorId(jugadorId);
    if (!j) return res.status(404).json({ error: 'Deportista no encontrado' });
    const [{ estadoActual }, { esMenorDeEdad }] = await Promise.all([reglas, identificacion]);
    const historial = await historialDe(j.id);
    await registrar(req, { accion: 'listar', recurso: 'consentimiento', jugador_id: j.id });
    res.json({ jugador_id: j.id, menor: esMenorDeEdad(j, hoyLocal()), actual: estadoActual(historial), historial });
  } catch (err) {
    responderError(res, err);
  }
};

// Guarda un registro (y su archivo, si viene) dentro de una transacción. `preparar(cliente)` revisa el estado
// actual ya bloqueado y devuelve las columnas a insertar, o { status, error } para cancelar.
async function guardar(req, res, { jugadorId, tipo, accion, preparar }) {
  const cliente = await db.connect();
  let ruta = null;
  try {
    await cliente.query('BEGIN');
    await bloquear(cliente, jugadorId, tipo);
    const fila = await preparar(cliente);
    if (fila.error) {
      await cliente.query('ROLLBACK');
      return res.status(fila.status).json({ error: fila.error });
    }
    if (req.file) {
      const { ETIQUETA_TIPO_CONSENTIMIENTO } = await reglas;
      const guardado = await guardarArchivo(cliente, req.file, { jugador_id: jugadorId, tipo: 'consentimiento',
        descripcion: `${fila.estado === 'revocado' ? 'Revocación' : 'Consentimiento'}: ${ETIQUETA_TIPO_CONSENTIMIENTO[tipo].toLowerCase()}`, subido_por: req.usuario.id });
      ruta = guardado.ruta;
      fila.archivo_id = guardado.archivo.id;
    }
    const columnas = { ...fila, jugador_id: jugadorId, registrado_por: req.usuario.id, quien_atiende: await datosDeQuienAtiende(cliente, req.usuario.id) };
    const nombres = Object.keys(columnas);
    const { rows: [nuevo] } = await cliente.query(
      `INSERT INTO consentimientos (${nombres.join(', ')}) VALUES (${nombres.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
      nombres.map(n => columnas[n]));
    await registrar(req, { accion, recurso: 'consentimiento', recurso_id: nuevo.id, jugador_id: jugadorId }, cliente);
    // v2.9 (T2.6): la autorización de datos personales firmada en papel cuenta como la aceptación del aviso de
    // privacidad por parte del deportista (o de su acudiente)
    if (tipo === 'datos_personales' && fila.estado === 'firmado') await aceptacionPorPapel(cliente, req, jugadorId, nuevo.id, fila.firmante_nombre);
    await cliente.query('COMMIT');
    res.status(201).json(await respuesta(jugadorId, nuevo.id));
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    if (ruta) await fs.promises.unlink(ruta).catch(() => {});
    responderError(res, err);
  } finally {
    cliente.release();
  }
}

// POST /api/consentimientos   (multipart: archivo, jugador_id, tipo, estado, fecha, firma_quien, firmante_*, asentimiento…)
exports.registrar = async (req, res) => {
  try {
    if (!ID.test(String(req.body.jugador_id || ''))) return res.status(400).json({ error: 'El deportista es obligatorio.' });
    const j = await jugadorPorId(req.body.jugador_id);
    if (!j) return res.status(404).json({ error: 'Deportista no encontrado' });
    if (req.file) {
      const revision = revisarArchivo(req.file);
      if (!revision.ok) return res.status(revision.status).json({ error: revision.error });
    }
    const { validarConsentimiento, estadoActual, MENSAJES } = await reglas;
    const v = validarConsentimiento(req.body, j, hoyLocal(), { conArchivo: !!req.file });
    if (!v.ok) return res.status(400).json({ error: v.error });
    return guardar(req, res, {
      jugadorId: j.id, tipo: v.registro.tipo, accion: 'crear',
      preparar: async (cliente) => {
        const actual = estadoActual(await historialDe(j.id, cliente))[v.registro.tipo];
        // Lo firmado no se "rechaza" después: se revoca, con su motivo
        if (v.registro.estado === 'rechazado' && actual.estado === 'firmado') return { status: 409, error: MENSAJES.rechazarFirmado };
        return { ...v.registro };
      },
    });
  } catch (err) {
    responderError(res, err);
  }
};

// POST /api/consentimientos/:id/revocar   (motivo, fecha?, archivo? con el papel de la revocación)
exports.revocar = async (req, res) => {
  try {
    const { rows: [c] } = await db.query('SELECT * FROM consentimientos WHERE id = $1', [req.params.id]);
    if (!c) return res.status(404).json({ error: 'Consentimiento no encontrado' });
    if (req.file) {
      const revision = revisarArchivo(req.file);
      if (!revision.ok) return res.status(revision.status).json({ error: revision.error });
    }
    const { validarRevocacion, estadoActual, MENSAJES } = await reglas;
    return guardar(req, res, {
      jugadorId: c.jugador_id, tipo: c.tipo, accion: 'revocar',
      preparar: async (cliente) => {
        // Solo el firmado que está vigente (el último registro de su tipo)
        const actual = estadoActual(await historialDe(c.jugador_id, cliente))[c.tipo];
        if (actual.id !== c.id || c.estado !== 'firmado') return { status: 409, error: MENSAJES.revocarSoloFirmado };
        const v = validarRevocacion(req.body, c, hoyLocal());
        if (!v.ok) return { status: 400, error: v.error };
        return { ...v.registro };
      },
    });
  } catch (err) {
    responderError(res, err);
  }
};

// v2.9 (T2.3): la ficha clínica trae los consentimientos en su misma consulta
exports.historialDe = historialDe;
