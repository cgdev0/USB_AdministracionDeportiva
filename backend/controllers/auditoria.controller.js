// Módulo de auditoría del administrador (v2.9, T2.7 del plan de historia clínica; D12 y D13).
// Solo el administrador. Reúne, sin contenido clínico:
//  - eventos: altas de personas, gestión de cuentas, retiros, eliminaciones, cargas masivas, inicios de sesión
//    fallidos y bloqueos, ajustes y exportaciones (tabla auditoria);
//  - cargas masivas, con su archivo, huella, resultado y declaración (cargas_masivas);
//  - aceptaciones de los avisos y declaraciones (aceptaciones);
//  - pendientes: personal que no ha aceptado su compromiso y deportistas a los que les falta su aceptación;
//  - ajustes, como exigir el consentimiento de atención para valorar (D2), que se enciende cuando el docente apruebe.
// Los accesos a la historia clínica están en /api/bitacora (vista general del administrador).
const path = require('path');
const { pathToFileURL } = require('url');
const db = require('../config/db');
const { responderError } = require('../utils/errores');
const { auditar } = require('../utils/auditoria');
const { COLUMNAS_AUTORIZACION, conAutorizacion } = require('../utils/autorizaciones');

const avisos = import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'avisos.js')).href);
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const AJUSTES = { exigir_consentimiento_atencion: 'boolean' };

// Filtros comunes: texto (persona), desde y hasta (fechas de Colombia, inclusive)
function filtros(req, params, { columnaFecha, columnasTexto }) {
  const cond = [];
  const { q, desde, hasta } = req.query;
  if (desde) {
    if (!FECHA.test(desde)) return { error: 'La fecha "desde" no es válida.' };
    params.push(desde); cond.push(`${columnaFecha} >= $${params.length}::date`);
  }
  if (hasta) {
    if (!FECHA.test(hasta)) return { error: 'La fecha "hasta" no es válida.' };
    params.push(hasta); cond.push(`${columnaFecha} < $${params.length}::date + 1`);
  }
  if (q && String(q).trim()) {
    params.push(`%${String(q).trim().slice(0, 100)}%`);
    cond.push(`(${columnasTexto.map(c => `${c} ILIKE $${params.length}`).join(' OR ')})`);
  }
  return { cond };
}
const donde = (cond) => (cond.length ? `WHERE ${cond.join(' AND ')}` : '');

async function consultarEventos(req) {
  const params = [];
  const f = filtros(req, params, { columnaFecha: 'a.creado_en', columnasTexto: ['a.usuario_nombre', "a.detalle::text"] });
  if (f.error) return f;
  for (const campo of ['accion', 'recurso']) {
    if (req.query[campo]) { params.push(String(req.query[campo])); f.cond.push(`a.${campo} = $${params.length}`); }
  }
  const { rows } = await db.query(`SELECT a.* FROM auditoria a ${donde(f.cond)} ORDER BY a.creado_en DESC, a.id DESC LIMIT 500`, params);
  return { rows };
}

async function consultarAceptaciones(req) {
  const params = [];
  const f = filtros(req, params, { columnaFecha: 'a.aceptado_en', columnasTexto: ['a.usuario_nombre', 'a.aceptante_nombre', 'j.nombre', 't.nombre'] });
  if (f.error) return f;
  for (const campo of ['aviso', 'via']) {
    if (req.query[campo]) { params.push(String(req.query[campo])); f.cond.push(`a.${campo} = $${params.length}`); }
  }
  const { rows } = await db.query(
    `SELECT a.id, a.aviso, a.version, a.texto_sha256, a.via, a.usuario_nombre, a.usuario_rol, a.aceptante_nombre, a.carga_id,
            a.consentimiento_id, a.ip, a.aceptado_en, j.id AS jugador_id, j.nombre AS jugador_nombre, t.nombre AS testigo_nombre
       FROM aceptaciones a LEFT JOIN jugadores j ON j.id = a.jugador_id LEFT JOIN usuarios t ON t.id = a.testigo_id
       ${donde(f.cond)} ORDER BY a.aceptado_en DESC, a.id DESC LIMIT 500`, params);
  return { rows };
}

async function consultarCargas(req) {
  const params = [];
  const f = filtros(req, params, { columnaFecha: 'c.creado_en', columnasTexto: ['c.usuario_nombre', 'c.archivo_nombre'] });
  if (f.error) return f;
  const { rows } = await db.query(
    `SELECT c.id, c.tipo, c.usuario_nombre, c.usuario_rol, c.archivo_nombre, c.archivo_sha256, c.filas_total, c.creadas,
            c.actualizadas, c.rechazadas, c.declaracion_version, c.ip, c.creado_en
       FROM cargas_masivas c ${donde(f.cond)} ORDER BY c.creado_en DESC, c.id DESC LIMIT 500`, params);
  return { rows };
}

const responder = (consulta) => async (req, res) => {
  try {
    const r = await consulta(req);
    if (r.error) return res.status(400).json({ error: r.error });
    res.json(r.rows);
  } catch (err) {
    responderError(res, err);
  }
};
exports.eventos = responder(consultarEventos);
exports.aceptaciones = responder(consultarAceptaciones);
exports.cargas = responder(consultarCargas);

// GET /api/auditoria/cargas/:id  (con los nombres de lo creado y la declaración de quien cargó)
exports.carga = async (req, res) => {
  try {
    const { rows: [c] } = await db.query('SELECT * FROM cargas_masivas WHERE id = $1', [req.params.id]);
    if (!c) return res.status(404).json({ error: 'Carga no encontrada' });
    const ids = (c.detalle?.creados || []).map(Number).filter(Number.isInteger);
    const tabla = c.tipo === 'usuarios' ? 'usuarios' : 'jugadores';
    const { rows: creados } = ids.length
      ? await db.query(`SELECT id, nombre FROM ${tabla} WHERE id = ANY($1) ORDER BY nombre`, [ids])
      : { rows: [] };
    const { rows: [declaracion] } = await db.query(
      `SELECT version, texto_sha256, usuario_nombre, aceptado_en FROM aceptaciones WHERE carga_id = $1 AND jugador_id IS NULL ORDER BY id LIMIT 1`, [c.id]);
    res.json({ ...c, creados, errores: c.detalle?.errores || [], declaracion: declaracion || null });
  } catch (err) {
    responderError(res, err);
  }
};

// GET /api/auditoria/pendientes  → { personal, deportistas }
exports.pendientes = async (_req, res) => {
  try {
    const { VERSIONES_AVISO, ROLES_PERSONAL } = await avisos;
    const { rows: personal } = await db.query(
      `SELECT u.id, u.nombre, u.email, u.rol, u.created_at FROM usuarios u
        WHERE u.activo AND u.rol = ANY($1) AND NOT EXISTS (
          SELECT 1 FROM aceptaciones a WHERE a.usuario_id = u.id AND a.aviso = 'compromiso_personal' AND a.version = $2 AND a.via = 'cuenta')
        ORDER BY u.nombre`, [ROLES_PERSONAL, VERSIONES_AVISO.compromiso_personal]);
    const { rows } = await db.query(
      `SELECT j.id, j.nombre, j.dorsal, d.nombre AS disciplina_nombre, ${COLUMNAS_AUTORIZACION}
         FROM jugadores j LEFT JOIN disciplinas d ON d.id = j.disciplina_id WHERE j.activo ORDER BY j.nombre`);
    const deportistas = (await Promise.all(rows.map(conAutorizacion))).filter(j => ['falta_propia', 'sin_declaracion'].includes(j.autorizacion));
    res.json({ personal, deportistas });
  } catch (err) {
    responderError(res, err);
  }
};

// GET /api/auditoria/exportar?fuente=eventos|aceptaciones|cargas  → CSV (la exportación también queda registrada)
const COLUMNAS_CSV = {
  eventos: ['creado_en', 'usuario_nombre', 'usuario_rol', 'accion', 'recurso', 'recurso_id', 'detalle', 'ip'],
  aceptaciones: ['aceptado_en', 'aviso', 'version', 'via', 'usuario_nombre', 'usuario_rol', 'aceptante_nombre', 'jugador_nombre', 'testigo_nombre', 'texto_sha256', 'ip'],
  cargas: ['creado_en', 'tipo', 'usuario_nombre', 'archivo_nombre', 'archivo_sha256', 'filas_total', 'creadas', 'rechazadas', 'declaracion_version', 'ip'],
};
const CONSULTAS = { eventos: consultarEventos, aceptaciones: consultarAceptaciones, cargas: consultarCargas };
function celda(v) {
  if (v === null || v === undefined) return '';
  const t = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
  // Evita que una hoja de cálculo interprete fórmulas (=, +, -, @)
  const seguro = /^[=+\-@]/.test(t) ? `'${t}` : t;
  return /[",;\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}
exports.exportar = async (req, res) => {
  try {
    const fuente = String(req.query.fuente || 'eventos');
    if (!CONSULTAS[fuente]) return res.status(400).json({ error: 'La fuente no es válida.' });
    const r = await CONSULTAS[fuente](req);
    if (r.error) return res.status(400).json({ error: r.error });
    await auditar(req, { accion: 'exportar', recurso: 'auditoria', detalle: { fuente, filas: r.rows.length, filtros: req.query } });
    const columnas = COLUMNAS_CSV[fuente];
    const csv = [columnas.join(','), ...r.rows.map(f => columnas.map(c => celda(f[c])).join(','))].join('\r\n');
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="auditoria-${fuente}.csv"`);
    res.set('Cache-Control', 'no-store');
    res.send(`﻿${csv}`);
  } catch (err) {
    responderError(res, err);
  }
};

// GET /api/auditoria/ajustes  · PUT /api/auditoria/ajustes { clave: valor }
async function leerAjustes() {
  const { rows } = await db.query(
    `SELECT a.clave, a.valor, a.actualizado_en, u.nombre AS actualizado_por FROM ajustes a LEFT JOIN usuarios u ON u.id = a.actualizado_por
      WHERE a.clave = ANY($1)`, [Object.keys(AJUSTES)]);
  return Object.fromEntries(rows.map(r => [r.clave, { valor: r.valor, actualizado_en: r.actualizado_en, actualizado_por: r.actualizado_por }]));
}
exports.ajustes = async (_req, res) => {
  try {
    res.json(await leerAjustes());
  } catch (err) {
    responderError(res, err);
  }
};
exports.cambiarAjustes = async (req, res) => {
  const entradas = Object.entries(req.body || {});
  if (!entradas.length) return res.status(400).json({ error: 'Indica el ajuste que quieres cambiar.' });
  for (const [clave, valor] of entradas) {
    if (!AJUSTES[clave]) return res.status(400).json({ error: `El ajuste "${clave}" no existe.` });
    if (typeof valor !== AJUSTES[clave]) return res.status(400).json({ error: `El valor de "${clave}" no es válido.` });
  }
  const cliente = await db.connect();
  try {
    await cliente.query('BEGIN');
    for (const [clave, valor] of entradas) {
      const { rows: [antes] } = await cliente.query('SELECT valor FROM ajustes WHERE clave = $1 FOR UPDATE', [clave]);
      await cliente.query(
        `INSERT INTO ajustes (clave, valor, actualizado_por, actualizado_en) VALUES ($1, $2, $3, now())
         ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_por = EXCLUDED.actualizado_por, actualizado_en = now()`,
        [clave, JSON.stringify(valor), req.usuario.id]);
      await auditar(req, { accion: 'ajuste', recurso: 'ajuste', detalle: { clave, antes: antes ? antes.valor : null, despues: valor } }, cliente);
    }
    await cliente.query('COMMIT');
    res.json(await leerAjustes());
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    responderError(res, err);
  } finally {
    cliente.release();
  }
};
