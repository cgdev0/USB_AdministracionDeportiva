// Autorización de los deportistas y registro de las cargas masivas (v2.9, T2.6 del plan de historia clínica; D10).
// Quien registra a un deportista (uno por uno, con su cuenta o por carga masiva) declara que lo informó y que
// autorizó el registro y el uso de sus datos. Sin esa declaración no se guarda. Cada declaración queda en la tabla
// aceptaciones; cada carga masiva, en cargas_masivas (archivo, huella y resultado). Los textos están en
// frontend/src/utils/avisos.js (los mismos que ve la pantalla).
const crypto = require('crypto');
const path = require('path');
const { pathToFileURL } = require('url');

const avisos = import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'avisos.js')).href);
const huella = (texto) => crypto.createHash('sha256').update(texto, 'utf8').digest('hex');
const ipDe = (req) => String(req.ip || '').slice(0, 64) || null;

const MENSAJES = {
  declaracion_registro: 'Marca la declaración: el deportista, o su acudiente si es menor de edad, fue informado y autorizó el registro de sus datos.',
  declaracion_carga: 'Marca la declaración de la carga: cada persona del archivo, o su acudiente si es menor de edad, fue informada y autorizó el registro de sus datos.',
  version: 'El texto de la declaración cambió: léelo de nuevo y márcalo.',
};

/**
 * Revisa la declaración que llega de la pantalla. Acepta { acepto: true, version } o, en un formulario con archivo,
 * los campos sueltos declaracion_acepto y declaracion_version.
 * Devuelve { ok: true, aviso, sha } o { ok: false, status, error }.
 */
async function revisarDeclaracion(cuerpo, tipo) {
  const m = await avisos;
  const aviso = tipo === 'declaracion_carga' ? m.declaracionCarga() : m.declaracionRegistro();
  const d = cuerpo?.declaracion || { acepto: cuerpo?.declaracion_acepto, version: cuerpo?.declaracion_version };
  if (!(d?.acepto === true || d?.acepto === 'true')) return { ok: false, status: 400, error: MENSAJES[tipo] };
  if (d.version !== aviso.version) return { ok: false, status: 409, error: MENSAJES.version };
  return { ok: true, aviso, sha: huella(m.textoCanonico(aviso)) };
}

// Guarda la declaración: de un deportista (registro uno por uno) o de una carga (con o sin el deportista creado)
async function registrarDeclaracion(cliente, req, revision, { jugadorId = null, cargaId = null } = {}) {
  await cliente.query(
    `INSERT INTO aceptaciones (aviso, version, texto_sha256, via, usuario_id, usuario_nombre, usuario_rol, jugador_id, carga_id, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [revision.aviso.aviso, revision.aviso.version, revision.sha, cargaId ? 'carga' : 'registro', req.usuario.id,
     req.usuario.nombre || null, req.usuario.rol || null, jugadorId, cargaId, ipDe(req)]);
}

// Registra una carga masiva con su resultado y la declaración de quien la hizo. Devuelve el id de la carga.
async function registrarCarga(cliente, req, revision, { tipo, archivoNombre = null, archivoSha = null, filasTotal = 0, creadas = 0, actualizadas = 0, rechazadas = 0, detalle = {} }) {
  const sha = /^[0-9a-f]{64}$/.test(String(archivoSha || '')) ? archivoSha : null;
  const { rows: [carga] } = await cliente.query(
    `INSERT INTO cargas_masivas (tipo, usuario_id, usuario_nombre, usuario_rol, archivo_nombre, archivo_sha256, filas_total, creadas,
                                 actualizadas, rechazadas, detalle, declaracion_version, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
    [tipo, req.usuario.id, req.usuario.nombre || null, req.usuario.rol || null, archivoNombre ? String(archivoNombre).slice(0, 200) : null, sha,
     filasTotal, creadas, actualizadas, rechazadas, detalle, revision.aviso.version, ipDe(req)]);
  await registrarDeclaracion(cliente, req, revision, { cargaId: carga.id });
  return carga.id;
}

// ── Estado de la autorización de un deportista ──
// Columnas para una consulta que tiene la tabla de jugadores con el alias `j`
const COLUMNAS_AUTORIZACION = `j.autorizacion_previa,
  EXISTS (SELECT 1 FROM aceptaciones ad WHERE ad.jugador_id = j.id AND ad.via IN ('registro', 'carga')) AS autorizacion_declarada,
  (SELECT ap.version FROM aceptaciones ap WHERE ap.jugador_id = j.id AND ap.aviso = 'aviso_deportista' AND ap.via IN ('cuenta', 'tableta', 'papel')
    ORDER BY ap.aceptado_en DESC, ap.id DESC LIMIT 1) AS aceptacion_version`;

/**
 * completa         declarada (o de antes) y el deportista aceptó la versión vigente del aviso
 * falta_propia     quien lo registró lo declaró, pero el deportista aún no acepta (o aceptó un texto anterior)
 * previa           registrado antes de las autorizaciones (datos de demostración, D11)
 * sin_declaracion  registrado sin la declaración (no debería pasar desde la v2.9)
 */
async function conAutorizacion(fila) {
  const { VERSIONES_AVISO } = await avisos;
  const { autorizacion_previa: previa, autorizacion_declarada: declarada, aceptacion_version: version, ...resto } = fila;
  const propia = version === VERSIONES_AVISO.aviso_deportista;
  const autorizacion = propia && (declarada || previa) ? 'completa' : previa ? 'previa' : !declarada ? 'sin_declaracion' : 'falta_propia';
  return { ...resto, autorizacion };
}

module.exports = { revisarDeclaracion, registrarDeclaracion, registrarCarga, COLUMNAS_AUTORIZACION, conAutorizacion, huella, MENSAJES };
