// Historia clínica secuencial e inalterable (v2.7, T0.3 del plan de historia clínica; RF-26, DEF-052).
// Resolución 1995 de 1999: cada atención es un registro aparte con fecha, hora y quien atiende; lo cerrado no se
// modifica ni se borra (ni por la API ni directamente en la base) y se corrige con notas aclaratorias.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { iniciar, cerrar, llamar, token, sql } = require('../utilidades/api');
const { RAIZ } = require('../utilidades/bd');

const MARCA = 'ZZ val';
const T = {};
let mateo = null;     // deportista de la demostración con documento
let propio = null;    // el deportista vinculado a la cuenta jugador@ (#9)

test.before(async () => {
  await iniciar();
  for (const rol of ['administrador', 'entrenador', 'salud', 'jugador']) T[rol] = await token(rol);
  ({ rows: [{ id: mateo }] } = await sql(`SELECT id FROM jugadores WHERE nombre = 'Mateo Carrillo'`));
  ({ rows: [{ jugador_id: propio }] } = await sql(`SELECT jugador_id FROM usuarios WHERE email = 'jugador@dtdeportivo.com'`));
});
test.after(async () => {
  // Las valoraciones cerradas no se pueden borrar: la limpieza de la base de pruebas usa el modo de mantenimiento
  await sql(`DO $$ BEGIN
    PERFORM set_config('dt.mantenimiento', 'on', true);
    DELETE FROM notas_aclaratorias WHERE valoracion_id IN (SELECT id FROM valoraciones
      WHERE contenido->>'motivo_consulta' LIKE '${MARCA}%' OR jugador_id IN (SELECT id FROM jugadores WHERE nombre LIKE '${MARCA}%'));
    DELETE FROM valoraciones WHERE contenido->>'motivo_consulta' LIKE '${MARCA}%'
      OR jugador_id IN (SELECT id FROM jugadores WHERE nombre LIKE '${MARCA}%');
    DELETE FROM historias_clinicas WHERE jugador_id IN (SELECT id FROM jugadores WHERE nombre LIKE '${MARCA}%');
    DELETE FROM jugadores WHERE nombre LIKE '${MARCA}%';
  END $$`);
  await cerrar(__filename);
});

const contenido = (motivo, extra = {}) => ({ motivo_consulta: `${MARCA} ${motivo}`, ...extra });
async function crear(jugador_id, motivo, extra = {}, quien = 'salud') {
  return llamar('POST', '/api/valoraciones', T[quien], { jugador_id, tipo: 'control', contenido: contenido(motivo), ...extra });
}
async function cerrarValoracion(v) {
  return llamar('POST', `/api/valoraciones/${v.id}/cerrar`, T.salud, { version: v.version });
}

test('CP-HC-006 [RF-26] Cada atención es una valoración aparte; solo salud la registra y se necesita el documento', async () => {
  const a = await crear(mateo, 'primera', { tipo: 'inicial' });
  assert.equal(a.status, 201, JSON.stringify(a.datos));
  assert.equal(a.datos.estado, 'borrador');
  assert.equal(a.datos.tipo_nombre, 'Inicial');
  const b = await crear(mateo, 'segunda');
  assert.equal(b.status, 201);
  const lista = await llamar('GET', `/api/valoraciones?jugador_id=${mateo}`, T.salud);
  const mias = lista.datos.filter(v => v.contenido.motivo_consulta?.startsWith(MARCA));
  assert.equal(mias.length, 2, 'dos atenciones, dos registros: nada se sobrescribe');
  assert.equal(mias[0].id, b.datos.id, 'de la más reciente a la más antigua');

  // Res. 1995: la historia se identifica con el documento
  const { rows: [sinDoc] } = await sql(`INSERT INTO jugadores (nombre) VALUES ('${MARCA} sin documento') RETURNING id`);
  const r = await crear(sinDoc.id, 'sin documento');
  assert.equal(r.status, 400);
  assert.match(r.datos.error, /documento/);

  assert.equal((await crear(mateo, 'x', { tipo: 'registro_previo' })).status, 400, 'el tipo de la migración no se usa a mano');
  assert.equal((await llamar('POST', '/api/valoraciones', T.salud, { jugador_id: mateo, contenido: { diagnostico: 'x' } })).status, 400,
    'sección desconocida');
  for (const rol of ['administrador', 'entrenador']) {
    assert.equal((await llamar('GET', '/api/valoraciones', T[rol])).status, 403, `${rol} no ve la historia clínica`);
    assert.equal((await crear(mateo, 'x', {}, rol)).status, 403, `${rol} no registra valoraciones`);
  }
});

test('CP-HC-007 [RF-26] El borrador lo edita solo quien lo abrió, sin pisar cambios de otro dispositivo', async () => {
  const v = (await crear(mateo, 'borrador')).datos;
  const g = await llamar('PUT', `/api/valoraciones/${v.id}`, T.salud,
    { version: v.version, contenido: contenido('borrador', { antecedentes: { alergias: 'Penicilina' } }) });
  assert.equal(g.status, 200, JSON.stringify(g.datos));
  assert.equal(g.datos.version, v.version + 1);
  assert.equal(g.datos.contenido.antecedentes.alergias, 'Penicilina');

  const viejo = await llamar('PUT', `/api/valoraciones/${v.id}`, T.salud, { version: v.version, contenido: contenido('otro dispositivo') });
  assert.equal(viejo.status, 409, 'con una versión vieja no se guarda');
  assert.match(viejo.datos.error, /otro dispositivo/);

  // Otra persona de salud no puede cambiar el borrador ajeno
  const email = `zz.val.${Date.now()}@test.com`;
  await llamar('POST', '/api/usuarios', T.administrador, { nombre: `${MARCA} otra`, email, password: 'Prueba123!', rol: 'personal_salud' });
  const otra = (await llamar('POST', '/api/auth/login', null, { email, password: 'Prueba123!' })).datos.access_token;
  assert.equal((await llamar('PUT', `/api/valoraciones/${v.id}`, otra, { version: g.datos.version, contenido: contenido('ajeno') })).status, 403);
  assert.equal((await llamar('POST', `/api/valoraciones/${v.id}/cerrar`, otra, {})).status, 403);

  // Una valoración vacía no se cierra; un borrador se puede descartar
  const vacia = (await llamar('POST', '/api/valoraciones', T.salud, { jugador_id: mateo })).datos;
  assert.equal((await cerrarValoracion(vacia)).status, 400);
  assert.equal((await llamar('DELETE', `/api/valoraciones/${vacia.id}`, T.salud)).status, 200);
  assert.equal((await llamar('GET', `/api/valoraciones/${vacia.id}`, T.salud)).status, 404);
  await sql(`DO $$ BEGIN PERFORM set_config('dt.mantenimiento', 'on', true); DELETE FROM usuarios WHERE email = '${email}'; END $$`);
});

test('CP-HC-008 [RF-26] Cerrar firma la valoración: queda quien atiende y un código de integridad, y ya no cambia', async () => {
  const v = (await crear(mateo, 'para cerrar', { contenido: contenido('para cerrar', { observaciones: 'Sin hallazgos' }) })).datos;
  const c = await cerrarValoracion(v);
  assert.equal(c.status, 200, JSON.stringify(c.datos));
  assert.equal(c.datos.estado, 'cerrada');
  assert.match(c.datos.hash_cierre, /^[0-9a-f]{64}$/);
  assert.equal(c.datos.quien_atiende.nombre, 'Personal Salud');
  assert.equal(c.datos.quien_atiende.descripcion, 'Fisioterapeuta', 'copia de los datos de quien atiende (T0.2)');
  assert.equal(c.datos.atendio, 'Personal Salud · Fisioterapeuta');

  const cambio = await llamar('PUT', `/api/valoraciones/${v.id}`, T.salud, { version: c.datos.version, contenido: contenido('cambiada') });
  assert.equal(cambio.status, 409);
  assert.match(cambio.datos.error, /nota aclaratoria/);
  assert.equal((await llamar('DELETE', `/api/valoraciones/${v.id}`, T.salud)).status, 409, 'lo cerrado no se borra');
  assert.equal((await cerrarValoracion(c.datos)).status, 409, 'no se cierra dos veces');

  // Las correcciones van como notas aclaratorias
  const borrador = (await crear(mateo, 'aún abierta')).datos;
  assert.equal((await llamar('POST', `/api/valoraciones/${borrador.id}/notas`, T.salud, { texto: 'x' })).status, 409);
  const nota = await llamar('POST', `/api/valoraciones/${v.id}/notas`, T.salud, { texto: 'Faltó registrar: alergia al ibuprofeno.' });
  assert.equal(nota.status, 201, JSON.stringify(nota.datos));
  assert.equal(nota.datos.quien_atiende.descripcion, 'Fisioterapeuta');
  const detalle = await llamar('GET', `/api/valoraciones/${v.id}`, T.salud);
  assert.equal(detalle.datos.notas.length, 1);
  assert.equal(detalle.datos.contenido.observaciones, 'Sin hallazgos', 'el original no cambia');

  const integridad = await llamar('GET', `/api/valoraciones/${v.id}/integridad`, T.salud);
  assert.equal(integridad.datos.integra, true, JSON.stringify(integridad.datos));
});

test('CP-HC-009 [RF-26] La base de datos misma impide alterar lo cerrado, y el código de integridad detecta cambios', async () => {
  const v = (await crear(mateo, 'protegida')).datos;
  await cerrarValoracion(v);
  await assert.rejects(sql(`UPDATE valoraciones SET contenido = '{"motivo_consulta":"alterada"}' WHERE id = $1`, [v.id]), /está cerrada/);
  await assert.rejects(sql('DELETE FROM valoraciones WHERE id = $1', [v.id]), /está cerrada/);
  await llamar('POST', `/api/valoraciones/${v.id}/notas`, T.salud, { texto: 'Nota original' });
  await assert.rejects(sql(`UPDATE notas_aclaratorias SET texto = 'cambiada' WHERE valoracion_id = $1`, [v.id]), /no se modifican/);
  await assert.rejects(sql('DELETE FROM notas_aclaratorias WHERE valoracion_id = $1', [v.id]), /no se modifican/);

  // Si alguien la altera saltándose la protección (mantenimiento), la verificación lo detecta
  await sql(`DO $$ BEGIN PERFORM set_config('dt.mantenimiento', 'on', true);
    UPDATE valoraciones SET contenido = '{"motivo_consulta":"${MARCA} alterada a escondidas"}' WHERE id = ${Number(v.id)}; END $$`);
  const r = await llamar('GET', `/api/valoraciones/${v.id}/integridad`, T.salud);
  assert.equal(r.datos.integra, false);
  assert.match(r.datos.mensaje, /cambió después de cerrarse/);
});

test('CP-HC-010 [RF-26] Las historias anteriores se migran como valoración cerrada y el deportista ve solo las suyas cerradas', async () => {
  // Una historia de la versión anterior (tabla vieja) se convierte en la primera valoración, cerrada y con su autor
  const { rows: [j] } = await sql(`INSERT INTO jugadores (nombre, tipo_documento, numero_documento) VALUES ('${MARCA} migrado', 'CC', '9${String(Date.now()).slice(-8)}') RETURNING id`);
  const { rows: [salud] } = await sql(`SELECT id FROM usuarios WHERE email = 'salud@dtdeportivo.com'`);
  await sql(`INSERT INTO historias_clinicas (jugador_id, alergias, observaciones, actualizado_por) VALUES ($1, 'Polen', '', $2)`, [j.id, salud.id]);
  await sql(fs.readFileSync(path.join(RAIZ, 'backend', 'migrations', '013_valoraciones.sql'), 'utf8'));
  await sql(fs.readFileSync(path.join(RAIZ, 'backend', 'migrations', '013_valoraciones.sql'), 'utf8')); // se puede repetir
  const lista = await llamar('GET', `/api/valoraciones?jugador_id=${j.id}`, T.salud);
  assert.equal(lista.datos.length, 1, 'una sola vez aunque la migración se repita');
  const m = lista.datos[0];
  assert.deepEqual([m.tipo, m.estado, m.origen, m.contenido], ['registro_previo', 'cerrada', 'migrada', { antecedentes: { alergias: 'Polen' } }]);
  assert.equal(m.tipo_nombre, 'Antecedentes registrados antes de la v2.7');
  const integridad = await llamar('GET', `/api/valoraciones/${m.id}/integridad`, T.salud);
  assert.equal(integridad.datos.integra, null);
  assert.match(integridad.datos.mensaje, /migrado/);
  assert.equal((await llamar('POST', '/api/salud/historias', T.salud, { jugador_id: j.id, alergias: 'x' })).status, 410);

  // Art. 14: el deportista consulta sus valoraciones cerradas, no los borradores ni las de otros
  const cerrada = (await crear(propio, 'del propio deportista')).datos;
  await cerrarValoracion(cerrada);
  const borrador = (await crear(propio, 'borrador del propio')).datos;
  const vistas = await llamar('GET', '/api/valoraciones', T.jugador);
  assert.equal(vistas.status, 200);
  assert.ok(vistas.datos.length >= 1 && vistas.datos.every(v => v.jugador_id === propio && v.estado === 'cerrada'));
  assert.equal((await llamar('GET', `/api/valoraciones/${borrador.id}`, T.jugador)).status, 404);
  assert.equal((await llamar('GET', `/api/valoraciones/${m.id}`, T.jugador)).status, 404, 'la de otro deportista');
  assert.equal((await llamar('POST', '/api/valoraciones', T.jugador, { jugador_id: propio })).status, 403);
  assert.equal((await llamar('GET', `/api/valoraciones/${cerrada.id}/integridad`, T.jugador)).status, 403);
});

test('CP-HC-018 [RF-26] Dos dispositivos con la misma cuenta: el segundo recibe el aviso y elige qué versión conservar', async () => {
  // La misma persona con la sesión abierta en el celular y en la tableta
  const [celular, tableta] = [await token('salud'), await token('salud')];
  const v = (await crear(mateo, 'dos dispositivos')).datos;
  const guardar = (t, version, motivo) => llamar('PUT', `/api/valoraciones/${v.id}`, t, { version, contenido: contenido(motivo) });

  const enCelular = await guardar(celular, v.version, 'desde el celular');
  assert.equal(enCelular.status, 200);
  const enTableta = await guardar(tableta, v.version, 'desde la tableta');
  assert.equal(enTableta.status, 409, 'con la versión vieja no pisa lo del celular');
  assert.match(enTableta.datos.error, /otro dispositivo/);

  // "Usar la versión guardada": la tableta lee la última versión y ve lo del celular
  const ultima = await llamar('GET', `/api/valoraciones/${v.id}`, tableta);
  assert.equal(ultima.datos.contenido.motivo_consulta, `${MARCA} desde el celular`);
  // "Guardar la mía encima": con la versión nueva sí guarda
  const encima = await guardar(tableta, ultima.datos.version, 'la tableta encima');
  assert.equal(encima.status, 200);
  // Y ahora es el celular el que queda desactualizado
  assert.equal((await guardar(celular, enCelular.datos.version, 'otra vez celular')).status, 409);
  assert.equal((await llamar('POST', `/api/valoraciones/${v.id}/cerrar`, celular, { version: enCelular.datos.version })).status, 409,
    'tampoco se cierra con una versión vieja');

  // Si se cierra en un dispositivo, el otro ya no puede guardar el borrador
  assert.equal((await llamar('POST', `/api/valoraciones/${v.id}/cerrar`, tableta, { version: encima.datos.version })).status, 200);
  const tarde = await guardar(celular, encima.datos.version, 'muy tarde');
  assert.equal(tarde.status, 409);
  assert.match(tarde.datos.error, /cerrada/);
});
