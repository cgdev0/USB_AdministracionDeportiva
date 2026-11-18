// Bitácora de accesos a la historia clínica (v2.7, T0.6 del plan de historia clínica; RF-31).
// Quién vio, registró, cambió o descargó cada dato clínico y cuándo. Se consulta por deportista (salud), la propia
// (deportista) o completa (administrador, sin contenido clínico). No se modifica ni se borra.
const test = require('node:test');
const assert = require('node:assert/strict');
const { iniciar, cerrar, llamar, llamarFormulario, descargar, token, sql, sqlMantenimiento } = require('../utilidades/api');

const MARCA = 'ZZ bitacora';
const T = {};
let mateo = null;
let propio = null;
const ids = {};

test.before(async () => {
  await iniciar();
  for (const rol of ['administrador', 'entrenador', 'head_coach', 'salud', 'jugador']) T[rol] = await token(rol);
  ({ rows: [{ id: mateo }] } = await sql(`SELECT id FROM jugadores WHERE nombre = 'Mateo Carrillo'`));
  ({ rows: [{ jugador_id: propio }] } = await sql(`SELECT jugador_id FROM usuarios WHERE email = 'jugador@dtdeportivo.com'`));
});
test.after(async () => {
  await sqlMantenimiento(`DELETE FROM archivos_clinicos WHERE descripcion LIKE '${MARCA}%'`);
  await sqlMantenimiento(`DELETE FROM notas_aclaratorias WHERE valoracion_id IN (SELECT id FROM valoraciones WHERE contenido->>'motivo_consulta' LIKE '${MARCA}%')`);
  await sqlMantenimiento(`DELETE FROM valoraciones WHERE contenido->>'motivo_consulta' LIKE '${MARCA}%'`);
  await cerrar(__filename);
});

const accesos = async (rol, query = '') => llamar('GET', `/api/bitacora${query}`, T[rol]);

test('CP-HC-016 [RF-31] Cada acceso a la historia clínica queda en la bitácora: quién, qué y cuándo', async () => {
  // Salud abre, cierra y corrige una valoración, y sube y descarga un archivo
  const v = (await llamar('POST', '/api/valoraciones', T.salud, { jugador_id: mateo, contenido: { motivo_consulta: `${MARCA} control` } })).datos;
  ids.valoracion = v.id;
  await llamar('GET', `/api/valoraciones/${v.id}`, T.salud);
  await llamar('POST', `/api/valoraciones/${v.id}/cerrar`, T.salud, { version: v.version });
  await llamar('POST', `/api/valoraciones/${v.id}/notas`, T.salud, { texto: 'Aclaración' });
  const f = new FormData();
  f.append('archivo', new Blob([Buffer.from('%PDF-1.4\n%%EOF\n')], { type: 'application/pdf' }), 'examen.pdf');
  f.append('jugador_id', String(mateo));
  f.append('descripcion', `${MARCA} examen`);
  const archivo = (await llamarFormulario('/api/archivos-clinicos', T.salud, f)).datos;
  assert.equal((await descargar(`/api/archivos-clinicos/${archivo.id}`, T.salud)).status, 200);
  // El entrenador consulta las lesiones de su plantel
  await llamar('GET', '/api/lesiones', T.entrenador);

  const historia = await accesos('salud', `?jugador_id=${mateo}`);
  assert.equal(historia.status, 200);
  const acciones = historia.datos.filter(e => e.creado_en).map(e => `${e.accion}:${e.recurso}:${e.recurso_id ?? ''}`);
  for (const esperado of [`crear:valoracion:${v.id}`, `ver:valoracion:${v.id}`, `cerrar:valoracion:${v.id}`, `descargar:archivo:${archivo.id}`, `crear:archivo:${archivo.id}`]) {
    assert.ok(acciones.includes(esperado), `falta ${esperado}`);
  }
  assert.ok(acciones.some(a => a.startsWith('crear:nota:')));
  const fila = historia.datos.find(e => e.accion === 'cerrar');
  assert.deepEqual([fila.usuario_nombre, fila.usuario_rol, fila.jugador_nombre], ['Personal Salud', 'personal_salud', 'Mateo Carrillo']);
  assert.ok(!('contenido' in fila) && !('texto' in fila) && !('ip' in fila), 'sin contenido clínico (y salud no ve la IP)');
  assert.ok(historia.datos.every(e => e.jugador_id === mateo), 'solo la historia pedida');
  assert.equal((await accesos('salud')).status, 400, 'salud consulta la bitácora por deportista');

  // El administrador ve la vista general (con IP) y filtra; el entrenador también quedó registrado
  const general = await accesos('administrador', '?accion=listar');
  assert.equal(general.status, 200);
  assert.ok(general.datos.every(e => e.accion === 'listar') && general.datos.some(e => e.usuario_rol === 'entrenador' && e.recurso === 'lesion'));
  assert.ok('ip' in general.datos[0]);
  for (const rol of ['entrenador', 'head_coach']) assert.equal((await accesos(rol)).status, 403, `${rol} no ve la bitácora`);

  // El deportista ve quién consultó su propia historia, y nada de otros
  const delPropio = (await llamar('POST', '/api/valoraciones', T.salud, { jugador_id: propio, contenido: { motivo_consulta: `${MARCA} propio` } })).datos;
  await llamar('GET', `/api/valoraciones/${delPropio.id}`, T.salud);
  const mia = await accesos('jugador', `?jugador_id=${mateo}`);
  assert.equal(mia.status, 200);
  assert.ok(mia.datos.length >= 2 && mia.datos.every(e => e.jugador_id === propio), 'aunque pida otra, ve solo la suya');
});

test('CP-HC-017 [RF-31] La bitácora no se modifica ni se borra, y consultarla no deja registro', async () => {
  await assert.rejects(sql(`UPDATE bitacora_clinica SET usuario_nombre = 'otro' WHERE jugador_id = $1`, [mateo]), /no se modifica ni se borra/);
  await assert.rejects(sql('DELETE FROM bitacora_clinica WHERE jugador_id = $1', [mateo]), /no se modifica ni se borra/);
  assert.equal((await llamar('DELETE', '/api/bitacora/1', T.administrador)).status, 404, 'no hay ruta para borrar');

  const contar = async () => (await sql('SELECT COUNT(*)::int AS n FROM bitacora_clinica')).rows[0].n;
  const antes = await contar();
  await accesos('administrador');
  await accesos('salud', `?jugador_id=${mateo}`);
  assert.equal(await contar(), antes, 'leer la bitácora no se registra');
  await llamar('GET', `/api/valoraciones/${ids.valoracion}`, T.salud);
  assert.equal(await contar(), antes + 1, 'abrir una valoración, sí');
});
