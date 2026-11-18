// Archivos clínicos protegidos (v2.7, T0.5 del plan de historia clínica; RNF-13, DEF-054).
// Consentimientos escaneados y fotos de postura: fuera de /uploads (pública), solo JPG/PNG/PDF reconocidos por su
// contenido, hasta 5 MB, descarga con sesión y permiso, y sin modificarse ni borrarse.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { iniciar, cerrar, llamar, llamarFormulario, descargar, llamarCrudo, token, sql, sqlMantenimiento } = require('../utilidades/api');
const { ENV_PRUEBAS } = require('../utilidades/bd');

const PRE = 'ZZ archivo ';
const T = {};
let mateo = null;
let propio = null;
const subidos = {};

// Contenidos mínimos con la firma real de cada formato
const JPG = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), crypto.randomBytes(200), Buffer.from([0xFF, 0xD9])]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), crypto.randomBytes(120)]);
const PDF = Buffer.from('%PDF-1.4\n% Consentimiento firmado (prueba)\n%%EOF\n');

function formulario(contenido, nombre, tipoMime, campos = {}) {
  const f = new FormData();
  f.append('archivo', new Blob([contenido], { type: tipoMime }), nombre);
  for (const [k, v] of Object.entries(campos)) f.append(k, String(v));
  return f;
}
const subir = (rol, contenido, nombre, tipoMime, campos) =>
  llamarFormulario('/api/archivos-clinicos', T[rol], formulario(contenido, nombre, tipoMime, campos));

test.before(async () => {
  await iniciar();
  for (const rol of ['administrador', 'entrenador', 'head_coach', 'salud', 'jugador']) T[rol] = await token(rol);
  ({ rows: [{ id: mateo }] } = await sql(`SELECT id FROM jugadores WHERE nombre = 'Mateo Carrillo'`));
  ({ rows: [{ jugador_id: propio }] } = await sql(`SELECT jugador_id FROM usuarios WHERE email = 'jugador@dtdeportivo.com'`));
});
test.after(async () => {
  await sqlMantenimiento(`DELETE FROM archivos_clinicos WHERE descripcion LIKE '${PRE}%'
    OR jugador_id IN (SELECT id FROM jugadores WHERE nombre LIKE '${PRE}%')`);
  await sqlMantenimiento(`DELETE FROM valoraciones WHERE contenido->>'motivo_consulta' LIKE '${PRE}%'`);
  await sqlMantenimiento(`DELETE FROM jugadores WHERE nombre LIKE '${PRE}%'`);
  fs.rmSync(ENV_PRUEBAS.CLINICO_DIR, { recursive: true, force: true });
  await cerrar(__filename);
});

test('CP-HC-013 [RNF-13] Solo salud sube archivos clínicos: JPG, PNG o PDF reconocidos por su contenido, hasta 5 MB', async () => {
  const jpg = await subir('salud', JPG, 'postura frontal.jpg', 'image/jpeg', { jugador_id: mateo, tipo: 'postura', descripcion: `${PRE}foto` });
  assert.equal(jpg.status, 201, JSON.stringify(jpg.datos));
  assert.deepEqual([jpg.datos.mime, jpg.datos.tamano, jpg.datos.tipo], ['image/jpeg', JPG.length, 'postura']);
  assert.equal(jpg.datos.sha256, crypto.createHash('sha256').update(JPG).digest('hex'));
  assert.ok(!('nombre_archivo' in jpg.datos), 'el nombre en disco nunca se envía');
  subidos.jpg = jpg.datos.id;

  const pdf = await subir('salud', PDF, 'consentimiento.pdf', 'application/pdf', { jugador_id: propio, tipo: 'consentimiento', descripcion: `${PRE}pdf` });
  assert.equal(pdf.status, 201);
  subidos.pdf = pdf.datos.id;
  // El tipo se reconoce por el contenido, no por lo que dice el navegador
  const png = await subir('salud', PNG, 'foto.bin', 'application/octet-stream', { jugador_id: mateo, descripcion: `${PRE}png` });
  assert.equal(png.datos.mime, 'image/png');

  const falso = await subir('salud', Buffer.from('<script>alert(1)</script>'), 'foto.jpg', 'image/jpeg', { jugador_id: mateo });
  assert.equal(falso.status, 400, 'un texto renombrado como .jpg se rechaza');
  const grande = Buffer.concat([JPG.subarray(0, 4), Buffer.alloc(5 * 1024 * 1024)]);
  assert.equal((await subir('salud', grande, 'grande.jpg', 'image/jpeg', { jugador_id: mateo })).status, 413);
  assert.equal((await subir('salud', JPG, 'a.jpg', 'image/jpeg', { tipo: 'postura' })).status, 400, 'sin deportista');
  assert.equal((await subir('salud', JPG, 'a.jpg', 'image/jpeg', { jugador_id: mateo, tipo: 'selfie' })).status, 400);

  for (const rol of ['administrador', 'entrenador', 'head_coach', 'jugador']) {
    assert.equal((await subir(rol, JPG, 'a.jpg', 'image/jpeg', { jugador_id: mateo })).status, 403, `${rol} no sube archivos clínicos`);
  }
  const sinSesion = await llamarCrudo('POST', '/api/archivos-clinicos', { body: formulario(JPG, 'a.jpg', 'image/jpeg', { jugador_id: mateo }) });
  assert.equal(sinSesion.status, 401);
});

test('CP-HC-014 [RNF-13] El archivo solo se descarga con sesión y permiso, nunca por /uploads', async () => {
  const ok = await descargar(`/api/archivos-clinicos/${subidos.jpg}`, T.salud);
  assert.equal(ok.status, 200);
  assert.ok(ok.buffer.equals(JPG), 'llega idéntico');
  assert.equal(ok.headers.get('content-type'), 'image/jpeg');
  assert.match(ok.headers.get('cache-control'), /no-store/);
  assert.equal(ok.headers.get('x-content-type-options'), 'nosniff');

  assert.equal((await descargar(`/api/archivos-clinicos/${subidos.jpg}`, null)).status, 401, 'sin sesión');
  for (const rol of ['administrador', 'entrenador', 'head_coach']) {
    assert.equal((await descargar(`/api/archivos-clinicos/${subidos.jpg}`, T[rol])).status, 403, `${rol} no descarga archivos clínicos`);
  }
  // El deportista descarga los suyos, no los de otros
  assert.equal((await descargar(`/api/archivos-clinicos/${subidos.pdf}`, T.jugador)).status, 200);
  assert.equal((await descargar(`/api/archivos-clinicos/${subidos.jpg}`, T.jugador)).status, 404);
  const lista = await llamar('GET', '/api/archivos-clinicos', T.jugador);
  assert.ok(lista.datos.length >= 1 && lista.datos.every(a => a.jugador_id === propio));
  const deMateo = await llamar('GET', `/api/archivos-clinicos?jugador_id=${mateo}`, T.salud);
  assert.ok(deMateo.datos.some(a => a.id === subidos.jpg));

  // Fuera de la carpeta pública: ni por su nombre en disco ni por /uploads/clinico
  const { rows: [{ nombre_archivo }] } = await sql('SELECT nombre_archivo FROM archivos_clinicos WHERE id = $1', [subidos.jpg]);
  assert.ok(fs.existsSync(path.join(ENV_PRUEBAS.CLINICO_DIR, nombre_archivo)), 'guardado en CLINICO_DIR');
  assert.equal((await descargar(`/uploads/${nombre_archivo}`, null)).status, 404);
  assert.equal((await descargar(`/uploads/clinico/${nombre_archivo}`, null)).status, 404);
});

test('CP-HC-015 [RNF-13] Los archivos clínicos no se modifican ni se borran, y cuentan como historia clínica', async () => {
  await assert.rejects(sql('DELETE FROM archivos_clinicos WHERE id = $1', [subidos.jpg]), /no se modifican ni se borran/);
  await assert.rejects(sql(`UPDATE archivos_clinicos SET descripcion = 'cambiada' WHERE id = $1`, [subidos.jpg]), /no se modifican/);

  // Un deportista que solo tiene un archivo clínico tampoco se puede eliminar (regla de la T0.4)
  const { rows: [j] } = await sql(`INSERT INTO jugadores (nombre) VALUES ('${PRE}con archivo') RETURNING id`);
  assert.equal((await subir('salud', PDF, 'examen.pdf', 'application/pdf', { jugador_id: j.id, tipo: 'examen' })).status, 201);
  assert.equal((await llamar('DELETE', `/api/jugadores/${j.id}`, T.administrador)).status, 409);

  // Se adjuntan a una valoración en borrador del mismo deportista; a una cerrada o ajena, no
  const v = (await llamar('POST', '/api/valoraciones', T.salud, { jugador_id: mateo, contenido: { motivo_consulta: `${PRE}postura` } })).datos;
  const adjunto = await subir('salud', JPG, 'lateral.jpg', 'image/jpeg', { jugador_id: mateo, valoracion_id: v.id, tipo: 'postura', descripcion: `${PRE}adjunto` });
  assert.equal(adjunto.status, 201, JSON.stringify(adjunto.datos));
  assert.equal((await subir('salud', JPG, 'x.jpg', 'image/jpeg', { jugador_id: propio, valoracion_id: v.id })).status, 400, 'valoración de otro deportista');
  await llamar('POST', `/api/valoraciones/${v.id}/cerrar`, T.salud, { version: v.version });
  assert.equal((await subir('salud', JPG, 'y.jpg', 'image/jpeg', { jugador_id: mateo, valoracion_id: v.id })).status, 409, 'valoración cerrada');
  const deLaValoracion = await llamar('GET', `/api/archivos-clinicos?valoracion_id=${v.id}`, T.salud);
  assert.equal(deLaValoracion.datos.length, 1);
});
