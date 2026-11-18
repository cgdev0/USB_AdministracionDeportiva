// Cada rol ve solo lo que le corresponde (v2.7, T0.7 del plan de historia clínica; RF-04, RF-05, RNF-02).
// Matriz acordada con el docente de salud: el entrenador maneja la condición física, no la rehabilitación; el
// administrador gestiona cuentas, no es parte del equipo de salud (Res. 1995 de 1999, art. 14); la disponibilidad
// (apto, restricciones, retorno) sí la ven el entrenador, el head coach y el administrador.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { iniciar, cerrar, llamar, token, sql, sqlMantenimiento } = require('../utilidades/api');
const { RAIZ } = require('../utilidades/bd');

const MARCA = 'ZZ rol';
const T = {};
let mateo = null;
let propio = null;
const ids = {};

test.before(async () => {
  await iniciar();
  for (const rol of ['administrador', 'head_coach', 'entrenador', 'salud', 'jugador']) T[rol] = await token(rol);
  ({ rows: [{ id: mateo }] } = await sql(`SELECT id FROM jugadores WHERE nombre = 'Mateo Carrillo'`));
  ({ rows: [{ jugador_id: propio }] } = await sql(`SELECT jugador_id FROM usuarios WHERE email = 'jugador@dtdeportivo.com'`));
});
test.after(async () => {
  await sqlMantenimiento(`DELETE FROM lesiones WHERE tipo LIKE '${MARCA}%'`);
  await sqlMantenimiento(`DELETE FROM antropometria WHERE categoria = '${MARCA}'`);
  await sqlMantenimiento(`DELETE FROM evaluaciones_rugby WHERE jugador_id = $1 AND fecha = '2026-10-02'`, [mateo]);
  await cerrar(__filename);
});

const estado = async (metodo, ruta, rol, cuerpo) => (await llamar(metodo, ruta, T[rol], cuerpo)).status;

test('CP-ROL-010 [RNF-02] El administrador no accede a la información clínica (sí a sus notificaciones)', async () => {
  for (const ruta of ['/api/salud/historias', '/api/salud/controles', '/api/salud/seguimientos-lesiones',
    '/api/valoraciones', '/api/archivos-clinicos', `/api/antropometria/jugador/${mateo}`]) {
    assert.equal(await estado('GET', ruta, 'administrador'), 403, ruta);
  }
  assert.equal(await estado('POST', '/api/salud/controles', 'administrador', { jugador_id: mateo, tipo: `${MARCA} control` }), 403);
  assert.equal(await estado('GET', '/api/salud/notificaciones', 'administrador'), 200, 'la campanita no es información clínica');
});

test('CP-ROL-011 [RF-14] Solo el personal de salud registra, edita o elimina lesiones', async () => {
  const datos = { jugador_id: mateo, tipo: `${MARCA} desgarro`, descripcion: 'Isquiotibial derecho', fecha_inicio: '2026-11-01' };
  for (const rol of ['administrador', 'entrenador', 'head_coach', 'jugador']) {
    assert.equal(await estado('POST', '/api/lesiones', rol, datos), 403, rol);
  }
  const r = await llamar('POST', '/api/lesiones', T.salud, datos);
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  ids.lesion = r.datos.id;
  await llamar('POST', '/api/salud/seguimientos-lesiones', T.salud, { lesion_id: ids.lesion, estado: 'en_recuperacion', fecha_retorno_estimada: '2026-12-15' });
  assert.equal(await estado('PUT', `/api/lesiones/${ids.lesion}`, 'administrador', { ...datos, fecha_fin: '2026-11-20' }), 403);
  assert.equal(await estado('DELETE', `/api/lesiones/${ids.lesion}`, 'administrador'), 403);
});

test('CP-ROL-012 [RF-14][RNF-02] El entrenador, el head coach y el administrador ven la disponibilidad, no el tipo de lesión', async () => {
  for (const rol of ['entrenador', 'head_coach', 'administrador']) {
    const lista = await llamar('GET', '/api/lesiones', T[rol]);
    const l = lista.datos.find(x => x.id === ids.lesion);
    assert.ok(l, `${rol} ve la lesión de su plantel`);
    assert.ok(!('tipo' in l) && !('descripcion' in l), `${rol} no recibe el tipo ni la descripción`);
    assert.deepEqual([l.estado_seguimiento, l.fecha_retorno_estimada], ['en_recuperacion', '2026-12-15'], `${rol} ve estado y retorno`);
    const una = await llamar('GET', `/api/lesiones/${ids.lesion}`, T[rol]);
    assert.ok(una.status === 200 && !('tipo' in una.datos), `${rol}: tampoco en el detalle`);
  }
  const salud = await llamar('GET', `/api/lesiones/${ids.lesion}`, T.salud);
  assert.deepEqual([salud.datos.tipo, salud.datos.descripcion], [`${MARCA} desgarro`, 'Isquiotibial derecho']);
  // El deportista ve el detalle de las suyas
  const suya = await llamar('POST', '/api/lesiones', T.salud, { jugador_id: propio, tipo: `${MARCA} esguince`, fecha_inicio: '2026-11-02' });
  const vista = await llamar('GET', `/api/lesiones/${suya.datos.id}`, T.jugador);
  assert.equal(vista.datos.tipo, `${MARCA} esguince`);
});

test('CP-ROL-013 [RF-18][RNF-02] En el inicio, el tipo de lesión solo lo ve el personal de salud', async () => {
  const inicio = async (rol, q = '') => JSON.stringify((await llamar('GET', `/api/dashboard/inicio${q}`, T[rol])).datos);
  // Lesiones del plantel de demostración: "Esguince de tobillo", "Desgarro de isquiotibial", "Contusión de hombro"
  assert.match(await inicio('salud'), /Esguince de tobillo/);
  for (const rol of ['entrenador', 'administrador', 'head_coach']) {
    const texto = await inicio(rol);
    assert.ok(!/Esguince de tobillo|Desgarro de isquiotibial/.test(texto), `${rol} no ve el tipo`);
    assert.match(texto, /Lesionado/, `${rol} sí ve que no está disponible`);
  }
  // Ni cuando el entrenador abre el inicio "como lo ve el deportista"
  const { rows: [pedro] } = await sql(`SELECT id FROM jugadores WHERE nombre = 'Pedro Ramírez'`);
  assert.ok(!/Esguince de tobillo/.test(await inicio('entrenador', `?jugador_id=${pedro.id}`)));
});

test('CP-ROL-014 [RF-17] La antropometría la registra solo el personal de salud', async () => {
  const medida = { jugador_id: mateo, fecha: '2026-11-05', peso: 80, estatura: 1.8, categoria: MARCA };
  for (const rol of ['administrador', 'entrenador', 'head_coach', 'jugador']) {
    assert.equal(await estado('POST', '/api/antropometria', rol, medida), 403, rol);
  }
  const r = await llamar('POST', '/api/antropometria', T.salud, medida);
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  assert.equal(await estado('PUT', `/api/antropometria/${r.datos.id}`, 'entrenador', medida), 403);
  assert.equal(await estado('DELETE', `/api/antropometria/${r.datos.id}`, 'entrenador'), 403);
});

test('CP-ROL-015 [RF-08][RNF-02] La ficha del deportista no le muestra la antropometría al entrenador ni al administrador', async () => {
  for (const rol of ['entrenador', 'administrador']) {
    const ficha = await llamar('GET', `/api/jugadores/${mateo}`, T[rol]);
    assert.equal(ficha.status, 200);
    assert.ok(!('ultima_antropometria' in ficha.datos), rol);
    assert.ok('ultima_evaluacion' in ficha.datos, `${rol} sí ve la última prueba física`);
  }
  const salud = await llamar('GET', `/api/jugadores/${mateo}`, T.salud);
  assert.equal(salud.datos.ultima_antropometria?.categoria, MARCA);
});

test('CP-ROL-016 [RF-16] Las pruebas de condición física las registra el entrenador y salud las consulta', async () => {
  const prueba = { jugador_id: mateo, fecha: '2026-10-02', sprint_30m: 4.5, peso: 80 };
  assert.equal(await estado('POST', '/api/evaluaciones', 'salud', prueba), 403, 'salud no registra pruebas físicas');
  const r = await llamar('POST', '/api/evaluaciones', T.entrenador, prueba);
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  const vistas = await llamar('GET', '/api/evaluaciones', T.salud);
  assert.ok(vistas.datos.some(e => e.jugador_id === mateo && String(e.fecha).startsWith('2026-10-02')), 'salud la consulta');
});

test('CP-ROL-017 [RF-04] El menú del administrador no tiene Salud ni Antropometría; el de salud sí', async () => {
  const { MODULOS } = await import(pathToFileURL(path.join(RAIZ, 'frontend', 'src', 'config', 'navegacion.js')).href);
  const rutas = (rol) => MODULOS.filter(m => m.roles.includes(rol)).map(m => m.ruta);
  assert.ok(!rutas('administrador').includes('/salud') && !rutas('administrador').includes('/antropometria'));
  assert.ok(rutas('administrador').includes('/lesiones'), 'el administrador ve la disponibilidad en Lesiones');
  assert.ok(rutas('personal_salud').includes('/salud') && rutas('personal_salud').includes('/antropometria'));
  assert.ok(!rutas('entrenador').includes('/salud') && !rutas('entrenador').includes('/antropometria'));
});
