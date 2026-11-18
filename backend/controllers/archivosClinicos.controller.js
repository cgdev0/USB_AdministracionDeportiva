// Archivos clínicos protegidos (v2.7, T0.5 del plan de historia clínica; RNF-13, DEF-054).
// Consentimientos escaneados (Fase 2), fotos de postura (T3.4) y exámenes. Reglas:
//  - Se guardan en CLINICO_DIR, fuera de /uploads (que se sirve sin sesión), con un nombre aleatorio que nunca se
//    envía al navegador.
//  - Solo JPG, PNG o PDF de hasta 5 MB, reconocidos por su contenido (no por la extensión ni por lo que diga el
//    navegador): un archivo de texto renombrado como .jpg se rechaza.
//  - Los sube el personal de salud. Los descarga el personal de salud y el propio deportista (Res. 1995 de 1999,
//    art. 14). El administrador, el entrenador y el head coach no.
//  - No se modifican ni se borran (trigger de la base), como el resto de la historia clínica.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../config/db');
const { CLINICO_DIR } = require('../config/archivos');
const { responderError } = require('../utils/errores');
const { registrar, jugadorDeLaConsulta } = require('../utils/bitacora'); // v2.7 (T0.6): bitácora de accesos

const MAX_BYTES = 5 * 1024 * 1024;
const TIPOS = ['consentimiento', 'postura', 'examen', 'otro'];
const esSalud = (usuario) => usuario?.rol === 'personal_salud';

// Firma de los primeros bytes de cada formato permitido
function detectarFormato(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  return null;
}

const recibir = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } }).single('archivo');
exports.recibirArchivo = (req, res, next) => recibir(req, res, (err) => {
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'El archivo supera los 5 MB. Toma la foto con menor resolución o comprime el PDF.' });
  if (err) return next(err);
  return next();
});

const META = 'a.id, a.jugador_id, a.valoracion_id, a.tipo, a.nombre_original, a.mime, a.tamano, a.sha256, a.descripcion, a.subido_por, a.creado_en';

// POST /api/archivos-clinicos  (multipart: archivo, jugador_id, tipo, valoracion_id?, descripcion?)
exports.subir = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Adjunta el archivo (foto JPG o PNG, o documento PDF).' });
    const formato = detectarFormato(req.file.buffer);
    if (!formato) return res.status(400).json({ error: 'Solo se aceptan fotos JPG o PNG y documentos PDF.' });
    const { jugador_id, valoracion_id } = req.body;
    const tipo = req.body.tipo || 'otro';
    if (!TIPOS.includes(tipo)) return res.status(400).json({ error: 'El tipo de archivo no es válido.' });
    if (!/^[1-9]\d{0,9}$/.test(String(jugador_id || ''))) return res.status(400).json({ error: 'El deportista es obligatorio.' });
    const descripcion = typeof req.body.descripcion === 'string' ? req.body.descripcion.trim().slice(0, 200) || null : null;
    const nombreOriginal = path.basename(String(req.file.originalname || '')).replace(/[\u0000-\u001f]/g, '').slice(0, 200) || null;

    const { rows: [j] } = await db.query('SELECT id FROM jugadores WHERE id = $1', [jugador_id]);
    if (!j) return res.status(404).json({ error: 'Deportista no encontrado' });
    if (valoracion_id) {
      const { rows: [v] } = await db.query('SELECT jugador_id, estado FROM valoraciones WHERE id = $1', [valoracion_id]);
      if (!v || Number(v.jugador_id) !== Number(jugador_id)) return res.status(400).json({ error: 'La valoración no es de este deportista.' });
      if (v.estado === 'cerrada') return res.status(409).json({ error: 'La valoración está cerrada: no se le pueden agregar archivos.' });
    }

    const nombre = `${crypto.randomUUID()}.${formato.ext}`;
    const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    await fs.promises.mkdir(CLINICO_DIR, { recursive: true, mode: 0o700 });
    const ruta = path.join(CLINICO_DIR, nombre);
    await fs.promises.writeFile(ruta, req.file.buffer, { flag: 'wx', mode: 0o600 });
    try {
      const { rows: [a] } = await db.query(
        `INSERT INTO archivos_clinicos (jugador_id, valoracion_id, tipo, nombre_archivo, nombre_original, mime, tamano, sha256, descripcion, subido_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, jugador_id, valoracion_id, tipo, nombre_original, mime, tamano, sha256, descripcion, subido_por, creado_en`,
        [jugador_id, valoracion_id || null, tipo, nombre, nombreOriginal, formato.mime, req.file.size, sha256, descripcion, req.usuario.id]);
      await registrar(req, { accion: 'crear', recurso: 'archivo', recurso_id: a.id, jugador_id });
      res.status(201).json(a);
    } catch (err) {
      await fs.promises.unlink(ruta).catch(() => {}); // sin registro en la base, el archivo no se conserva
      throw err;
    }
  } catch (err) {
    responderError(res, err);
  }
};

// Quién puede ver los archivos de un deportista: salud (todos) y el propio deportista (los suyos)
function condicionLectura(usuario, params) {
  if (esSalud(usuario)) return 'TRUE';
  if (usuario?.rol === 'jugador') {
    params.push(usuario.jugador_id || 0);
    return `a.jugador_id = $${params.length}`;
  }
  return 'FALSE';
}

// GET /api/archivos-clinicos?jugador_id=&valoracion_id=
exports.listar = async (req, res) => {
  try {
    const params = [];
    const cond = [condicionLectura(req.usuario, params)];
    for (const campo of ['jugador_id', 'valoracion_id']) {
      if (!req.query[campo]) continue;
      if (!/^[1-9]\d{0,9}$/.test(String(req.query[campo]))) return res.status(400).json({ error: 'El filtro no es válido.' });
      params.push(req.query[campo]);
      cond.push(`a.${campo} = $${params.length}`);
    }
    const { rows } = await db.query(`SELECT ${META} FROM archivos_clinicos a WHERE ${cond.join(' AND ')} ORDER BY a.creado_en DESC, a.id DESC LIMIT 300`, params);
    await registrar(req, { accion: 'listar', recurso: 'archivo', jugador_id: jugadorDeLaConsulta(req) });
    res.json(rows);
  } catch (err) {
    responderError(res, err);
  }
};

// GET /api/archivos-clinicos/:id  (el archivo; nunca se guarda en caché ni se adivina su tipo)
exports.descargar = async (req, res) => {
  try {
    const params = [req.params.id];
    const cond = condicionLectura(req.usuario, params);
    const { rows: [a] } = await db.query(`SELECT a.id, a.jugador_id, a.nombre_archivo, a.mime FROM archivos_clinicos a WHERE a.id = $1 AND ${cond}`, params);
    if (!a) return res.status(404).json({ error: 'Archivo no encontrado' });
    const ruta = path.join(CLINICO_DIR, a.nombre_archivo);
    try {
      await fs.promises.access(ruta, fs.constants.R_OK);
    } catch {
      // Por ejemplo, si el servidor se desplegó sin volumen persistente (ver docs del despliegue)
      return res.status(410).json({ error: 'El archivo ya no está disponible en el servidor. Avisa al administrador.' });
    }
    await registrar(req, { accion: 'descargar', recurso: 'archivo', recurso_id: a.id, jugador_id: a.jugador_id });
    const ext = a.mime === 'application/pdf' ? 'pdf' : a.mime === 'image/png' ? 'png' : 'jpg';
    res.set({
      'Content-Type': a.mime,
      'Content-Disposition': `inline; filename="archivo-clinico-${a.id}.${ext}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    res.sendFile(a.nombre_archivo, { root: CLINICO_DIR, dotfiles: 'deny', cacheControl: false, etag: false, lastModified: false });
  } catch (err) {
    responderError(res, err);
  }
};
