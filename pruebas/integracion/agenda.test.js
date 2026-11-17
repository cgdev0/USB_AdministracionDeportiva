// Agenda por equipo (v1.7): cada entrenamiento y partido pertenece a un equipo, con hora y lugar (RF-10, RF-12, RF-05)
const test = require('node:test');
const assert = require('node:assert/strict');
const { iniciar, cerrar, llamar, token, sql } = require('../utilidades/api');
const { fechaEnDias, horaActual } = require('../utilidades/fechas');

const T = {};
let equipoDemo;

test.before(async () => {
  await iniciar();
  for (const rol of ['administrador', 'entrenador', 'entrenador2', 'jugador', 'head_coach', 'salud']) T[rol] = await token(rol);
  ({ rows: [{ id: equipoDemo }] } = await sql(`SELECT id FROM equipos WHERE nombre = 'Unisimón Rugby (demo)'`));
});
test.after(async () => {
  await sql(`DELETE FROM entrenamientos WHERE tipo LIKE 'ZZ agenda%'`);
  await sql(`DELETE FROM partidos WHERE rival LIKE 'ZZ agenda%'`);
  await cerrar(__filename);
});

const ve = async (t, ruta, campo, valor) => (await llamar('GET', ruta, t)).datos.some(x => x[campo] === valor);

test('CP-AGE-001 [RF-10] Un entrenamiento del equipo lo ven solo quienes tienen ese equipo en su alcance', async () => {
  const c = await llamar('POST', '/api/entrenamientos', T.entrenador, {
    fecha: fechaEnDias(14), tipo: 'ZZ agenda equipo', descripcion: 'x', equipo_id: equipoDemo, hora: '17:30', lugar: 'Cancha sintética' });
  assert.equal(c.status, 201, JSON.stringify(c.datos));
  assert.equal(c.datos.hora, '17:30');
  for (const rol of ['entrenador', 'jugador', 'head_coach', 'administrador', 'salud']) {
    assert.equal(await ve(T[rol], '/api/entrenamientos', 'tipo', 'ZZ agenda equipo'), true, `${rol} debe verlo`);
  }
  assert.equal(await ve(T.entrenador2, '/api/entrenamientos', 'tipo', 'ZZ agenda equipo'), false, 'otro entrenador no lo ve');
  assert.equal((await llamar('GET', `/api/entrenamientos/${c.datos.id}`, T.entrenador2)).status, 404);
  assert.equal((await llamar('DELETE', `/api/entrenamientos/${c.datos.id}`, T.entrenador2)).status, 404, 'ni lo puede borrar');
});

test('CP-AGE-002 [RF-10] Una actividad sin equipo es general y la ven todos', async () => {
  const c = await llamar('POST', '/api/entrenamientos', T.administrador, { fecha: fechaEnDias(15), tipo: 'ZZ agenda general' });
  assert.equal(c.status, 201);
  for (const rol of ['entrenador', 'entrenador2', 'jugador', 'head_coach']) {
    assert.equal(await ve(T[rol], '/api/entrenamientos', 'tipo', 'ZZ agenda general'), true, rol);
  }
});

test('CP-AGE-003 [RF-05] Un entrenador solo asigna equipos donde tiene deportistas', async () => {
  const r = await llamar('POST', '/api/partidos', T.entrenador2, { fecha: fechaEnDias(18), rival: 'ZZ agenda ajeno', tipo: 'amistoso', equipo_id: equipoDemo });
  assert.equal(r.status, 403);
  assert.match(r.datos.error, /equipos de tu deporte/);
  const bien = await llamar('POST', '/api/partidos', T.entrenador, { fecha: fechaEnDias(18), rival: 'ZZ agenda propio', tipo: 'amistoso', equipo_id: equipoDemo, hora: '15:00', lugar: 'Estadio' });
  assert.equal(bien.status, 201);
  assert.equal(await ve(T.entrenador2, '/api/partidos', 'rival', 'ZZ agenda propio'), false);
  assert.equal(await ve(T.jugador, '/api/partidos', 'rival', 'ZZ agenda propio'), true);
});

test('CP-AGE-004 [RNF-03] Hora con formato inválido devuelve 400', async () => {
  const r = await llamar('POST', '/api/entrenamientos', T.entrenador, { fecha: fechaEnDias(16), tipo: 'ZZ agenda hora', hora: '25:99' });
  assert.equal(r.status, 400);
  assert.match(r.datos.error, /HH:MM/);
});

test('CP-AGE-005 [RF-10] Editar sin enviar equipo, hora ni lugar los conserva', async () => {
  const fecha = fechaEnDias(17);
  const c = await llamar('POST', '/api/entrenamientos', T.entrenador, { fecha, tipo: 'ZZ agenda editar', equipo_id: equipoDemo, hora: '06:00', lugar: 'Gimnasio' });
  const u = await llamar('PUT', `/api/entrenamientos/${c.datos.id}`, T.entrenador, { fecha, tipo: 'ZZ agenda editado', descripcion: 'cambio' });
  assert.equal(u.status, 200);
  const e = (await llamar('GET', `/api/entrenamientos/${c.datos.id}`, T.entrenador)).datos;
  assert.deepEqual([e.equipo_id, e.hora, e.lugar, e.equipo_nombre], [equipoDemo, '06:00', 'Gimnasio', 'Unisimón Rugby (demo)']);
});

test('CP-AGE-006 [RF-18] "Esta semana" muestra lugar y hora, y otro entrenador no ve la agenda del equipo', async () => {
  const semana = (await llamar('GET', '/api/dashboard/inicio', T.entrenador)).datos.semana;
  const tactica = semana.find(s => s.titulo.startsWith('Táctica'));
  assert.ok(tactica, 'el entrenamiento de la demostración está en la semana');
  assert.equal(tactica.detalle, 'Cancha sintética · 17:30');
  const ajena = (await llamar('GET', '/api/dashboard/inicio', T.entrenador2)).datos;
  assert.ok(!ajena.semana.some(s => s.titulo.startsWith('Táctica')), 'otro entrenador no ve la agenda del plantel de Cesar');
  assert.notEqual(ajena.proximo_partido?.rival, 'Deportivo Sur', 'ni su próximo partido');
});

// ── v2.6: sin fechas pasadas y solo horas disponibles ─────────────
test('CP-AGE-007 [RF-10] [RF-12] No se programa en una fecha pasada ni a una hora fuera de las disponibles', async () => {
  const ayer = await llamar('POST', '/api/entrenamientos', T.entrenador, { fecha: fechaEnDias(-1), tipo: 'ZZ agenda pasado', equipo_id: equipoDemo });
  assert.equal(ayer.status, 400);
  assert.match(ayer.datos.error, /fecha pasada/);
  const partido = await llamar('POST', '/api/partidos', T.administrador, { fecha: fechaEnDias(-7), rival: 'ZZ agenda pasado', tipo: 'liga', equipo_id: equipoDemo });
  assert.equal(partido.status, 400, 'tampoco un partido');
  for (const hora of ['17:15', '05:30', '22:30']) {
    const r = await llamar('POST', '/api/entrenamientos', T.entrenador, { fecha: fechaEnDias(19), tipo: 'ZZ agenda hora rara', equipo_id: equipoDemo, hora });
    assert.equal(r.status, 400, hora);
    assert.match(r.datos.error, /horas disponibles/, hora);
  }
  // Hoy, a una hora que ya pasó (solo se puede comprobar después de las 6:30 a. m.)
  const ahora = horaActual();
  if (ahora >= '06:30') {
    const r = await llamar('POST', '/api/entrenamientos', T.entrenador, { fecha: fechaEnDias(0), tipo: 'ZZ agenda hoy', equipo_id: equipoDemo, hora: '06:00' });
    assert.equal(r.status, 400);
    assert.match(r.datos.error, /ya pasó/);
  }
});

test('CP-AGE-008 [RF-10] Dos actividades del mismo equipo no ocupan la misma hora; el sistema la muestra como ocupada', async () => {
  const fecha = fechaEnDias(20);
  const e = await llamar('POST', '/api/entrenamientos', T.entrenador, { fecha, tipo: 'ZZ agenda choque', equipo_id: equipoDemo, hora: '17:30' });
  assert.equal(e.status, 201, JSON.stringify(e.datos));
  const choque = await llamar('POST', '/api/partidos', T.entrenador, { fecha, rival: 'ZZ agenda choque', tipo: 'amistoso', equipo_id: equipoDemo, hora: '17:30' });
  assert.equal(choque.status, 409);
  assert.match(choque.datos.error, /otra actividad a esa hora/);
  const d = (await llamar('GET', `/api/partidos/horas-disponibles?fecha=${fecha}&equipo_id=${equipoDemo}`, T.entrenador)).datos;
  assert.equal(d.horas.length, 33, 'de 6:00 a 22:00 cada 30 minutos');
  assert.deepEqual(d.horas.find(h => h.hora === '17:30'), { hora: '17:30', disponible: false, motivo: 'ocupada' });
  assert.equal(d.horas.find(h => h.hora === '18:00').disponible, true);
  // Al editar ese mismo entrenamiento su hora no cuenta como ocupada
  const propia = (await llamar('GET', `/api/entrenamientos/horas-disponibles?fecha=${fecha}&equipo_id=${equipoDemo}&id=${e.datos.id}`, T.entrenador)).datos;
  assert.equal(propia.horas.find(h => h.hora === '17:30').disponible, true);
  const otra = await llamar('POST', '/api/partidos', T.entrenador, { fecha, rival: 'ZZ agenda choque', tipo: 'amistoso', equipo_id: equipoDemo, hora: '18:00' });
  assert.equal(otra.status, 201, 'otra hora del mismo día sí se puede');
});

test('CP-AGE-009 [RF-12] Un partido ya jugado se puede editar (resultado) si no se cambia su fecha', async () => {
  const { rows: [p] } = await sql(`INSERT INTO partidos (fecha, rival, tipo, equipo_id, hora) VALUES (CURRENT_DATE - 3, 'ZZ agenda jugado', 'liga', $1, '15:00') RETURNING id, fecha`, [equipoDemo]);
  const u = await llamar('PUT', `/api/partidos/${p.id}`, T.entrenador, { fecha: p.fecha, rival: 'ZZ agenda jugado', tipo: 'liga', resultado: '21-14' });
  assert.equal(u.status, 200, JSON.stringify(u.datos));
  const mover = await llamar('PUT', `/api/partidos/${p.id}`, T.entrenador, { fecha: fechaEnDias(-5), rival: 'ZZ agenda jugado', tipo: 'liga' });
  assert.equal(mover.status, 400, 'no se puede mover a otra fecha pasada');
});

test('CP-AGE-010 [RF-10] Horas disponibles: un día pasado no ofrece horas y solo consultan quienes programan', async () => {
  const pasado = (await llamar('GET', `/api/entrenamientos/horas-disponibles?fecha=${fechaEnDias(-2)}&equipo_id=${equipoDemo}`, T.administrador)).datos;
  assert.equal(pasado.pasada, true);
  assert.ok(pasado.horas.every(h => !h.disponible && h.motivo === 'pasada'));
  assert.equal((await llamar('GET', `/api/entrenamientos/horas-disponibles?fecha=${fechaEnDias(3)}`, T.jugador)).status, 403);
  assert.equal((await llamar('GET', '/api/entrenamientos/horas-disponibles?fecha=mañana', T.entrenador)).status, 400);
});
