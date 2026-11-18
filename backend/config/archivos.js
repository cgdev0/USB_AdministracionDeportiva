// Carpeta de archivos subidos (fotos de deportistas y logos). En Railway apunta a un volumen
// (UPLOADS_DIR=/data/uploads) para que los archivos no se pierdan en cada despliegue.
const path = require('path');
require('dotenv').config();

const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', 'uploads');

// v2.7 (T0.5): los archivos clínicos (consentimientos escaneados, fotos de postura, exámenes) van en otra carpeta,
// FUERA de UPLOADS_DIR, porque /uploads se sirve sin iniciar sesión. Por defecto queda junto a UPLOADS_DIR
// (en Railway: /data/clinico, en el mismo volumen). Solo se descargan por /api/archivos-clinicos con permiso.
const CLINICO_DIR = process.env.CLINICO_DIR
  ? path.resolve(process.env.CLINICO_DIR)
  : path.join(path.dirname(UPLOADS_DIR), 'clinico');

module.exports = { UPLOADS_DIR, CLINICO_DIR };
