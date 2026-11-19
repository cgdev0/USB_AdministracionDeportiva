// Avisos de manejo de datos y sus aceptaciones (v2.9, T2.4 del plan de historia clínica; RF-32, D9 y D10).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { iniciar, cerrar, llamar, llamarFormulario, token, aceptarAviso, sql, sqlMantenimiento, CUENTAS, declaracionDeCarga } = require('../utilidades/api');

const CLAVE = 'Prueba.2026!Avisos';
const NUEVOS = 'zz.avisos.%@test.com';

const T = {};
const avisos = () => import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'avisos.js')).href);

const correos = () => Object.values(CUENTAS).map(([email]) => email);
test.before(async () => {
  await iniciar();
  // Las otras pruebas aceptan los avisos al iniciar sesión: aquí se empieza sin ninguna aceptación
  await sqlMantenimiento('DELETE FROM aceptaciones WHERE usuario_id IN (SELECT id FROM usuarios WHERE email = ANY($1))', [correos()]);
  for (const rol of ['administrador', 'entrenador', 'head_coach', 'salud', 'jugador']) T[rol] = await token(rol, { aceptar: false });
});
test.after(async () => {
  await sqlMantenimiento(`DELETE FROM aceptaciones WHERE usuario_id IN (SELECT id FROM usuarios WHERE email = ANY($1) OR email LIKE $2)`, [correos(), NUEVOS]);
  await sqlMantenimiento('DELETE FROM usuarios WHERE email LIKE $1', [NUEVOS]);
  await cerrar(__filename);
});

test('CP-AVI-001 [RF-32] Cada persona recibe el aviso que le corresponde: el personal, su compromiso; el deportista, el aviso de privacidad', async () => {
  for (const rol of ['administrador', 'entrenador', 'head_coach', 'salud']) {
    const r = await llamar('GET', '/api/avisos/mios', T[rol]);
    assert.equal(r.status, 200);
    assert.equal(r.datos.aviso.aviso, 'compromiso_personal', rol);
    assert.equal(r.datos.aceptado, null, `${rol}: aún no lo acepta`);
  }
  const salud = (await llamar('GET', '/api/avisos/mios', T.salud)).datos.aviso;
  assert.ok(salud.secciones.some(([t]) => t === 'Historia clínica'), 'salud: responsabilidad clínica');
  const entrenador = (await llamar('GET', '/api/avisos/mios', T.entrenador)).datos.aviso;
  assert.ok(!entrenador.secciones.some(([t]) => t === 'Historia clínica'));
  const jugador = (await llamar('GET', '/api/avisos/mios', T.jugador)).datos.aviso;
  assert.deepEqual([jugador.aviso, jugador.menor], ['aviso_deportista', false]);
  assert.equal((await llamar('GET', '/api/avisos/mios')).status, 401, 'sin sesión');
  // El deportista que no ha aceptado su aviso tampoco consulta sus datos (T2.5)
  const propio = await llamar('GET', '/api/salud/controles', T.jugador);
  assert.deepEqual([propio.status, propio.datos.codigo], [403, 'ACEPTACION_PENDIENTE']);
  assert.match(propio.datos.error, /aviso de privacidad/);
});

test('CP-AVI-002 [RF-32] La aceptación queda registrada con la versión, la huella del texto exacto y la IP, una sola vez', async () => {
  const { compromisoPara, textoCanonico } = await avisos();
  const aviso = compromisoPara('personal_salud');
  const aceptar = (cuerpo) => llamar('POST', '/api/avisos/aceptar', T.salud, cuerpo);
  assert.equal((await aceptar({ aviso: aviso.aviso, version: aviso.version })).status, 400, 'sin marcar la casilla');
  assert.equal((await aceptar({ aviso: 'aviso_deportista', version: aviso.version, acepto: true })).status, 400, 'otro aviso');
  const vieja = await aceptar({ aviso: aviso.aviso, version: 'borrador-2025-01', acepto: true });
  assert.equal(vieja.status, 409, 'versión que ya no es la vigente');
  assert.match(vieja.datos.error, /El texto cambió/);

  const r = await aceptar({ aviso: aviso.aviso, version: aviso.version, acepto: true });
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  assert.equal(r.datos.nuevo, true);
  const { rows: [a] } = await sql('SELECT * FROM aceptaciones WHERE id = $1', [r.datos.aceptado.id]);
  assert.deepEqual([a.aviso, a.version, a.via, a.usuario_rol], ['compromiso_personal', aviso.version, 'cuenta', 'personal_salud']);
  assert.equal(a.texto_sha256, crypto.createHash('sha256').update(textoCanonico(aviso), 'utf8').digest('hex'), 'huella del texto que se mostró');
  assert.ok(a.ip && a.usuario_nombre);
  // Ya aceptado: aparece en "mios" y no se duplica
  assert.equal((await llamar('GET', '/api/avisos/mios', T.salud)).datos.aceptado.id, a.id);
  const otra = await aceptar({ aviso: aviso.aviso, version: aviso.version, acepto: true });
  assert.deepEqual([otra.status, otra.datos.nuevo], [200, false]);
  const { rows: [n] } = await sql(`SELECT COUNT(*)::int AS n FROM aceptaciones WHERE usuario_id = $1 AND aviso = 'compromiso_personal'`, [a.usuario_id]);
  assert.equal(n.n, 1);
});

test('CP-AVI-003 [RF-32] El deportista acepta el aviso de privacidad en su cuenta; las aceptaciones no se modifican ni se borran', async () => {
  const { avisoDeportista } = await avisos();
  const aviso = avisoDeportista();
  const r = await llamar('POST', '/api/avisos/aceptar', T.jugador, { aviso: aviso.aviso, version: aviso.version, acepto: true });
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  const { rows: [a] } = await sql('SELECT a.*, u.jugador_id AS propio FROM aceptaciones a JOIN usuarios u ON u.id = a.usuario_id WHERE a.id = $1', [r.datos.aceptado.id]);
  assert.equal(a.jugador_id, a.propio, 'queda ligada a su ficha de deportista');
  await assert.rejects(sql(`UPDATE aceptaciones SET version = 'otra' WHERE id = $1`, [a.id]), /no se modifican ni se borran/);
  await assert.rejects(sql('DELETE FROM aceptaciones WHERE id = $1', [a.id]), /no se modifican ni se borran/);
  // Cada camino exige sus datos: en la tableta, el testigo y el nombre de quien acepta
  await assert.rejects(sql(`INSERT INTO aceptaciones (aviso, version, texto_sha256, via, jugador_id) VALUES ('aviso_deportista', 'x', repeat('a', 64), 'tableta', $1)`, [a.jugador_id]),
    /chk_aceptaciones_datos/);
});

// ── T2.5: nadie del personal trabaja con datos sin aceptar su compromiso ──
test('CP-AVI-004 [RF-32][RNF-02] Sin aceptar el compromiso no se consulta ni se registra nada; la sesión y el aviso sí funcionan', async () => {
  for (const [metodo, ruta, cuerpo] of [['GET', '/api/jugadores'], ['GET', '/api/dashboard/inicio'], ['POST', '/api/entrenamientos', { tipo: 'Táctica', fecha: '2026-11-20' }]]) {
    const r = await llamar(metodo, ruta, T.entrenador, cuerpo);
    assert.deepEqual([r.status, r.datos.codigo], [403, 'ACEPTACION_PENDIENTE'], `${metodo} ${ruta}`);
    assert.match(r.datos.error, /compromiso de confidencialidad/);
  }
  assert.equal((await llamar('GET', '/api/dashboard/inicio', T.head_coach)).status, 403);
  // La sesión y el aviso no se bloquean: así se puede leer y aceptar
  assert.equal((await llamar('GET', '/api/auth/me', T.entrenador)).status, 200);
  assert.equal((await llamar('GET', '/api/avisos/mios', T.entrenador)).status, 200);
  // Sin sesión, la respuesta sigue siendo 401
  assert.equal((await llamar('GET', '/api/jugadores')).status, 401);
  // Al aceptar, trabaja de inmediato
  await aceptarAviso(T.entrenador);
  assert.equal((await llamar('GET', '/api/jugadores', T.entrenador)).status, 200);
});

test('CP-AVI-005 [RF-32] Todo usuario nuevo, creado uno por uno o por carga CSV, acepta su compromiso antes de trabajar', async () => {
  await aceptarAviso(T.administrador);
  const uno = await llamar('POST', '/api/usuarios', T.administrador, { nombre: 'ZZ Avisos Individual', email: 'zz.avisos.uno@test.com', password: CLAVE, rol: 'entrenador' });
  assert.equal(uno.status, 201, JSON.stringify(uno.datos));
  const f = new FormData();
  f.append('archivo', new Blob([`nombre,email,password,rol\nZZ Avisos Carga,zz.avisos.csv@test.com,${CLAVE},personal_salud\n`], { type: 'text/csv' }), 'usuarios.csv');
  for (const [k, v] of Object.entries(declaracionDeCarga())) f.append(k, v); // v2.9 (T2.6)
  const csv = await llamarFormulario('/api/usuarios/csv', T.administrador, f);
  assert.equal(csv.datos.creados, 1, JSON.stringify(csv.datos));
  for (const [email, rol] of [['zz.avisos.uno@test.com', 'entrenador'], ['zz.avisos.csv@test.com', 'personal_salud']]) {
    const tk = await token(rol, { aceptar: false, credenciales: [email, CLAVE] });
    assert.equal((await llamar('GET', '/api/jugadores', tk)).status, 403, `${email} antes de aceptar`);
    await aceptarAviso(tk);
    assert.equal((await llamar('GET', '/api/jugadores', tk)).status, 200, `${email} después de aceptar`);
  }
  const { rows } = await sql(`SELECT u.email, a.usuario_rol FROM aceptaciones a JOIN usuarios u ON u.id = a.usuario_id WHERE u.email LIKE $1 ORDER BY u.email`, [NUEVOS]);
  assert.deepEqual(rows.map(r => [r.email, r.usuario_rol]), [['zz.avisos.csv@test.com', 'personal_salud'], ['zz.avisos.uno@test.com', 'entrenador']]);
});

test('CP-AVI-006 [RF-32] Si el texto cambia de versión, hay que aceptarlo de nuevo', async () => {
  const nuevo = await llamar('POST', '/api/usuarios', T.administrador, { nombre: 'ZZ Avisos Versión', email: 'zz.avisos.version@test.com', password: CLAVE, rol: 'head_coach' });
  assert.equal(nuevo.status, 201);
  // Aceptó una versión anterior del compromiso: la vigente sigue pendiente
  await sql(`INSERT INTO aceptaciones (aviso, version, texto_sha256, via, usuario_id, usuario_nombre, usuario_rol)
             VALUES ('compromiso_personal', 'borrador-2025-01', repeat('b', 64), 'cuenta', $1, 'ZZ Avisos Versión', 'head_coach')`, [nuevo.datos.id]);
  const tk = await token('head_coach', { aceptar: false, credenciales: ['zz.avisos.version@test.com', CLAVE] });
  const mios = (await llamar('GET', '/api/avisos/mios', tk)).datos;
  assert.equal(mios.aceptado, null);
  assert.notEqual(mios.aviso.version, 'borrador-2025-01');
  assert.equal((await llamar('GET', '/api/jugadores', tk)).status, 403);
  await aceptarAviso(tk);
  assert.equal((await llamar('GET', '/api/jugadores', tk)).status, 200);
});
