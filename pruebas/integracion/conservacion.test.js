// Conservación de la historia clínica (v2.7, T0.4 del plan de historia clínica; RNF-14, DEF-053).
// Resolución 839 de 2017: la historia clínica se conserva mínimo 15 años. Un deportista con historia no se borra:
// se retira del plantel actual y conserva todos sus registros. Tampoco se borra una lesión con seguimientos.
const test = require('node:test');
const assert = require('node:assert/strict');
const { iniciar, cerrar, llamar, token, sql, sqlMantenimiento } = require('../utilidades/api');

const PRE = 'ZZ conserva ';
const T = {};
let serie = 0;
const documento = () => `6${String(Date.now()).slice(-7)}${String(++serie).padStart(2, '0')}`;

test.before(async () => {
  await iniciar();
  for (const rol of ['administrador', 'entrenador', 'salud', 'head_coach']) T[rol] = await token(rol);
});
test.after(async () => {
  await sqlMantenimiento(`DELETE FROM jugadores WHERE nombre LIKE '${PRE}%'`);
  await cerrar(__filename);
});

async function deportista(extra = {}, rol = 'administrador') {
  const r = await llamar('POST', '/api/jugadores', T[rol], { nombre: `${PRE}${++serie}`, tipo_documento: 'CC', numero_documento: documento(), ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  return r.datos.id;
}

test('CP-HC-011 [RNF-14] Un deportista con historia clínica no se borra: se retira, conserva todo y se puede reactivar', async () => {
  const id = await deportista({ dorsal: 66 });
  const control = await llamar('POST', '/api/salud/controles', T.salud, { jugador_id: id, tipo: 'Control de prueba', aptitud: 'apto' });
  assert.equal(control.status, 201);

  const borrar = await llamar('DELETE', `/api/jugadores/${id}`, T.administrador);
  assert.equal(borrar.status, 409, 'antes se borraba en cascada con su historia');
  assert.match(borrar.datos.error, /retíralo/);
  await assert.rejects(sql('DELETE FROM jugadores WHERE id = $1', [id]), /historia clínica/, 'ni directamente en la base');

  const retiro = await llamar('PATCH', `/api/jugadores/${id}/retirar`, T.administrador, { motivo: 'Se graduó' });
  assert.equal(retiro.status, 200, JSON.stringify(retiro.datos));
  assert.equal((await llamar('PATCH', `/api/jugadores/${id}/retirar`, T.administrador, {})).status, 409, 'ya estaba retirado');

  const actual = await llamar('GET', '/api/jugadores', T.administrador);
  assert.ok(!actual.datos.some(j => j.id === id), 'sale del plantel actual');
  const solo = await llamar('GET', '/api/jugadores?retirados=solo', T.administrador);
  const fila = solo.datos.find(j => j.id === id);
  assert.deepEqual([fila.activo, fila.motivo_retiro, fila.dorsal], [false, 'Se graduó', null], 'retirado y con el dorsal libre');
  assert.ok((await llamar('GET', '/api/jugadores?retirados=incluir', T.administrador)).datos.some(j => j.id === id));
  assert.equal((await llamar('GET', `/api/jugadores/${id}`, T.administrador)).status, 200, 'su ficha se sigue consultando');
  const { rows: [{ n }] } = await sql('SELECT COUNT(*)::int AS n FROM controles_medicos WHERE jugador_id = $1', [id]);
  assert.equal(n, 1, 'su historia se conserva');

  assert.equal((await llamar('PATCH', `/api/jugadores/${id}/reactivar`, T.administrador)).status, 200);
  assert.ok((await llamar('GET', '/api/jugadores', T.administrador)).datos.some(j => j.id === id), 'vuelve al plantel');
  assert.equal((await llamar('PATCH', `/api/jugadores/${id}/reactivar`, T.administrador)).status, 409);

  // Sin historia clínica (registro creado por error) sí se puede eliminar
  const error = await deportista();
  assert.equal((await llamar('DELETE', `/api/jugadores/${error}`, T.administrador)).status, 200);
});

test('CP-HC-012 [RNF-14] El retirado sale del plantel actual pero su historia sigue disponible para salud', async () => {
  const { rows: [{ id: equipo }] } = await sql(`SELECT id FROM equipos WHERE nombre = 'Unisimón Rugby (demo)'`);
  const id = await deportista({ equipo_id: equipo, dorsal: 77 }, 'entrenador');
  const lesion = await llamar('POST', '/api/lesiones', T.salud, { jugador_id: id, tipo: 'Esguince de prueba', fecha_inicio: '2026-10-01' });
  const seguimiento = await llamar('POST', '/api/salud/seguimientos-lesiones', T.salud, { lesion_id: lesion.datos.id, gravedad: 'leve', estado: 'en_recuperacion' });
  assert.equal(seguimiento.status, 201);
  // Una lesión con seguimientos no se borra (antes se llevaba sus seguimientos en cascada)
  assert.equal((await llamar('DELETE', `/api/lesiones/${lesion.datos.id}`, T.salud)).status, 409);
  await assert.rejects(sql('DELETE FROM lesiones WHERE id = $1', [lesion.datos.id]), /seguimientos/);

  const valoracion = await llamar('POST', '/api/valoraciones', T.salud, { jugador_id: id, contenido: { motivo_consulta: 'Control' } });
  assert.equal(valoracion.status, 201);

  const nomina = async () => (await llamar('GET', `/api/equipos/${equipo}`, T.administrador)).datos;
  const antes = await nomina();
  assert.ok(JSON.stringify(antes).includes(`${PRE}`), 'está en la nómina del equipo');
  assert.equal((await llamar('PATCH', `/api/jugadores/${id}/retirar`, T.entrenador, { motivo: 'Cambio de equipo' })).status, 200);

  assert.ok(!JSON.stringify(await nomina()).includes(`"id":${id},`), 'ya no está en la nómina');
  const inicio = await llamar('GET', '/api/dashboard/inicio', T.entrenador);
  assert.ok(!JSON.stringify(inicio.datos.plantel || inicio.datos).includes(`"id":${id},`), 'ni en el plantel del inicio');
  const hc = await llamar('GET', '/api/head-coach/jugadores', T.head_coach);
  assert.ok(hc.datos.every(j => j.id !== id && !('discapacidad' in j)), 'el head coach no lo ve, ni ve datos sensibles');

  // No se puede convocar
  const partido = inicio.datos.proximo_partido;
  const conv = await llamar('PUT', `/api/convocatorias/partido/${partido.id}`, T.entrenador, { convocados: [{ jugador_id: id, rol: 'titular' }] });
  assert.equal(conv.status, 400);
  assert.match(conv.datos.error, /retirado/);

  // El entrenador lo encuentra entre sus retirados y salud sigue viendo su historia
  assert.ok((await llamar('GET', '/api/jugadores?retirados=solo', T.entrenador)).datos.some(j => j.id === id));
  const historia = await llamar('GET', `/api/valoraciones?jugador_id=${id}`, T.salud);
  assert.equal(historia.datos.length, 1);
  await sqlMantenimiento('DELETE FROM valoraciones WHERE jugador_id = $1', [id]);
});
