// Autorización de los deportistas y cargas masivas (v2.9, T2.6 del plan de historia clínica; RF-32, D10 y D11).
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { iniciar, cerrar, llamar, llamarFormulario, token, sql, sqlMantenimiento, conDeclaracion, declaracionDeCarga } = require('../utilidades/api');

const PRE = 'ZZ autoriza ';
const T = {};
const ids = {};
const documento = () => `3${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
const nacidoHace = (anios) => { const d = new Date(); d.setFullYear(d.getFullYear() - anios); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); };
const sha = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
const estadoEn = async (rol, id) => (await llamar('GET', `/api/jugadores/${id}`, T[rol])).datos.autorizacion;

test.before(async () => {
  await iniciar();
  for (const rol of ['administrador', 'entrenador', 'entrenador2', 'salud', 'jugador']) T[rol] = await token(rol);
  ({ rows: [{ id: ids.rugby }] } = await sql(`SELECT id FROM disciplinas WHERE nombre = 'Rugby'`));
});
test.after(async () => {
  try {
    const usados = `SELECT id FROM jugadores WHERE nombre LIKE '${PRE}%'`;
    await sqlMantenimiento(`DELETE FROM consentimientos WHERE jugador_id IN (${usados})`);
    await sqlMantenimiento(`DELETE FROM archivos_clinicos WHERE jugador_id IN (${usados})`);
    await sqlMantenimiento(`DELETE FROM aceptaciones WHERE jugador_id IN (${usados}) OR carga_id IN (SELECT id FROM cargas_masivas WHERE archivo_nombre LIKE 'zz-autoriza%')
                            OR usuario_id IN (SELECT id FROM usuarios WHERE email LIKE 'zz.autoriza%')`);
    await sqlMantenimiento(`DELETE FROM cargas_masivas WHERE archivo_nombre LIKE 'zz-autoriza%'`);
    await sqlMantenimiento(`DELETE FROM usuarios WHERE email LIKE 'zz.autoriza%'`);
    await sqlMantenimiento(`DELETE FROM jugadores WHERE nombre LIKE '${PRE}%'`);
  } finally {
    await cerrar(__filename);
  }
});

test('CP-AVI-007 [RF-32] Sin la declaración de quien registra no se guarda el deportista; con ella, queda pendiente su propia aceptación', async () => {
  const datos = { nombre: `${PRE}uno`, disciplina_id: ids.rugby, tipo_documento: 'CC', numero_documento: documento() };
  const sin = await llamar('POST', '/api/jugadores', T.entrenador, datos);
  assert.equal(sin.status, 400);
  assert.match(sin.datos.error, /Marca la declaración/);
  const vieja = await llamar('POST', '/api/jugadores', T.entrenador, { ...datos, declaracion: { acepto: true, version: 'borrador-2025-01' } });
  assert.equal(vieja.status, 409, 'texto de la declaración que ya no es el vigente');
  const { rows: [antes] } = await sql(`SELECT COUNT(*)::int AS n FROM jugadores WHERE nombre = $1`, [datos.nombre]);
  assert.equal(antes.n, 0, 'no se guardó nada');

  const r = await llamar('POST', '/api/jugadores', T.entrenador, conDeclaracion(datos));
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  ids.uno = r.datos.id;
  const { rows: [a] } = await sql(`SELECT a.*, u.email FROM aceptaciones a JOIN usuarios u ON u.id = a.usuario_id WHERE a.jugador_id = $1`, [ids.uno]);
  assert.deepEqual([a.aviso, a.via, a.email], ['declaracion_registro', 'registro', 'cesar_dt@dtdeportivo.com']);
  assert.match(a.texto_sha256, /^[0-9a-f]{64}$/);
  // Declarado por quien lo registró, pero el deportista aún no acepta: solo se avisa
  assert.equal(await estadoEn('entrenador', ids.uno), 'falta_propia');
  const paciente = (await llamar('GET', '/api/pacientes', T.salud)).datos.find(p => p.id === ids.uno);
  assert.equal(paciente.autorizacion, 'falta_propia');
  // Los deportistas de demostración (registrados antes) quedan exentos
  const { rows: [demo] } = await sql(`SELECT id FROM jugadores WHERE numero_documento = '1090000015'`);
  assert.equal(await estadoEn('administrador', demo.id), 'previa');
});

test('CP-AVI-008 [RF-32] Una carga masiva de deportistas exige la declaración y queda registrada con su archivo, su huella y su resultado', async () => {
  const filas = [
    { nombre: `${PRE}carga a`, deporte: 'Rugby', tipo_documento: 'CC', numero_documento: documento() },
    { nombre: `${PRE}carga b`, deporte: 'Rugby' },
    { nombre: '', deporte: 'Rugby' },
  ];
  const archivo = { nombre: 'zz-autoriza-deportistas.csv', sha256: sha('contenido del archivo de prueba') };
  const sin = await llamar('POST', '/api/jugadores/bulk', T.administrador, { deportistas: filas, archivo });
  assert.equal(sin.status, 400);
  assert.match(sin.datos.error, /declaración de la carga/);
  const { rows: [antes] } = await sql(`SELECT COUNT(*)::int AS n FROM jugadores WHERE nombre LIKE $1`, [`${PRE}carga%`]);
  assert.equal(antes.n, 0);

  const r = await llamar('POST', '/api/jugadores/bulk', T.administrador, conDeclaracion({ deportistas: filas, archivo }, 'carga'));
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  const { rows: [c] } = await sql('SELECT * FROM cargas_masivas WHERE id = $1', [r.datos.carga_id]);
  assert.deepEqual([c.tipo, c.archivo_nombre, c.archivo_sha256, c.filas_total, c.creadas, c.rechazadas, c.usuario_rol],
    ['deportistas', archivo.nombre, archivo.sha256, 3, 2, 1, 'administrador']);
  assert.deepEqual(c.detalle.creados.sort(), r.datos.insertados.map(d => d.id).sort());
  // La declaración de quien cargó y la de cada deportista creado apuntan a la carga
  const { rows } = await sql('SELECT jugador_id FROM aceptaciones WHERE carga_id = $1 ORDER BY jugador_id NULLS FIRST', [c.id]);
  assert.equal(rows.length, 3, 'la de la carga y una por deportista');
  assert.equal(rows[0].jugador_id, null);
  for (const d of r.datos.insertados) assert.equal(await estadoEn('administrador', d.id), 'falta_propia');
  // El registro de la carga no se modifica
  await assert.rejects(sql('UPDATE cargas_masivas SET creadas = 0 WHERE id = $1', [c.id]), /no se modifica ni se borra/);
});

test('CP-AVI-009 [RF-32] Una carga CSV de usuarios exige la declaración y guarda la huella del archivo recibido', async () => {
  const csv = `nombre,email,password,rol\n${PRE}usuario,zz.autoriza.csv@test.com,Prueba.2026!Csv,personal_salud\n${PRE}repetido,salud@dtdeportivo.com,Prueba.2026!Csv,personal_salud\n`;
  const formulario = (conDecl) => {
    const f = new FormData();
    f.append('archivo', new Blob([csv], { type: 'text/csv' }), 'zz-autoriza-usuarios.csv');
    if (conDecl) for (const [k, v] of Object.entries(declaracionDeCarga())) f.append(k, v);
    return f;
  };
  const sin = await llamarFormulario('/api/usuarios/csv', T.administrador, formulario(false));
  assert.equal(sin.status, 400);
  const r = await llamarFormulario('/api/usuarios/csv', T.administrador, formulario(true));
  assert.equal(r.status, 200, JSON.stringify(r.datos));
  assert.equal(r.datos.creados, 1);
  const { rows: [c] } = await sql('SELECT * FROM cargas_masivas WHERE id = $1', [r.datos.carga_id]);
  assert.deepEqual([c.tipo, c.archivo_sha256, c.filas_total, c.creadas, c.rechazadas], ['usuarios', sha(csv), 2, 1, 1]);
  assert.match(c.detalle.errores[0].error, /correo ya está registrado/);
});

test('CP-AVI-010 [RF-32] Crear la cuenta de un deportista con su ficha nueva exige la declaración; vincular a uno que ya existe, no', async () => {
  const cuenta = { nombre: `${PRE}cuenta`, password: 'Prueba.2026!Cta', rol: 'jugador', ficha: { disciplina_id: ids.rugby } };
  const sin = await llamar('POST', '/api/usuarios', T.administrador, { ...cuenta, email: 'zz.autoriza.cuenta@test.com' });
  assert.equal(sin.status, 400);
  assert.match(sin.datos.error, /Marca la declaración/);
  const con = await llamar('POST', '/api/usuarios', T.administrador, conDeclaracion({ ...cuenta, email: 'zz.autoriza.cuenta@test.com' }));
  assert.equal(con.status, 201, JSON.stringify(con.datos));
  assert.equal(await estadoEn('administrador', con.datos.jugador_id), 'falta_propia');
  // Vincular una cuenta a un deportista que ya está registrado no lo registra de nuevo
  const vinculo = await llamar('POST', '/api/usuarios', T.administrador,
    { nombre: `${PRE}vinculo`, email: 'zz.autoriza.vinculo@test.com', password: 'Prueba.2026!Cta', rol: 'jugador', jugador_id: ids.uno });
  assert.equal(vinculo.status, 201, JSON.stringify(vinculo.datos));
});

test('CP-AVI-011 [RF-32] En la tableta del profesional, el deportista acepta su aviso y el profesional queda como testigo', async () => {
  const ruta = `/api/avisos/deportista/${ids.uno}`;
  const { aviso, aceptado } = (await llamar('GET', ruta, T.entrenador)).datos;
  assert.deepEqual([aviso.aviso, aviso.menor, aceptado], ['aviso_deportista', false, null]);
  assert.equal((await llamar('POST', `${ruta}/aceptar`, T.entrenador, { version: aviso.version, acepto: true })).status, 400, 'sin nombre');
  assert.equal((await llamar('POST', `${ruta}/aceptar`, T.entrenador, { version: aviso.version, nombre: 'ZZ' })).status, 400, 'sin marcar');
  // Fuera de su alcance (otro entrenador) o sin ser personal, no
  assert.equal((await llamar('GET', ruta, T.entrenador2)).status, 404);
  assert.equal((await llamar('POST', `${ruta}/aceptar`, T.jugador, { version: aviso.version, acepto: true, nombre: 'X' })).status, 403);

  const r = await llamar('POST', `${ruta}/aceptar`, T.entrenador, { version: aviso.version, acepto: true, nombre: 'ZZ Autoriza Uno' });
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  const { rows: [a] } = await sql('SELECT a.*, u.email AS testigo FROM aceptaciones a JOIN usuarios u ON u.id = a.testigo_id WHERE a.id = $1', [r.datos.aceptado.id]);
  assert.deepEqual([a.via, a.aceptante_nombre, a.testigo, a.usuario_id], ['tableta', 'ZZ Autoriza Uno', 'cesar_dt@dtdeportivo.com', null]);
  assert.equal(await estadoEn('entrenador', ids.uno), 'completa');
  // Un menor de edad ve el aviso en lenguaje sencillo
  const menor = await llamar('POST', '/api/jugadores', T.entrenador, conDeclaracion({ nombre: `${PRE}menor`, disciplina_id: ids.rugby,
    fecha_nacimiento: nacidoHace(15), tipo_documento: 'TI', numero_documento: documento(), acudiente_nombre: 'ZZ Acudiente', acudiente_telefono: '3000000099' }));
  assert.equal(menor.status, 201, JSON.stringify(menor.datos));
  const avisoMenor = (await llamar('GET', `/api/avisos/deportista/${menor.datos.id}`, T.entrenador)).datos.aviso;
  assert.equal(avisoMenor.menor, true);
  assert.equal(avisoMenor.titulo, 'Tus datos en Administración Deportiva');
});

test('CP-AVI-012 [RF-32][RF-27] La autorización de datos firmada en papel cuenta como aceptación; un deportista sin historia se puede eliminar', async () => {
  const nuevo = await llamar('POST', '/api/jugadores', T.entrenador, conDeclaracion({ nombre: `${PRE}papel`, disciplina_id: ids.rugby, tipo_documento: 'CC', numero_documento: documento() }));
  assert.equal(nuevo.status, 201);
  const f = new FormData();
  f.append('archivo', new Blob([Buffer.from('%PDF-1.4\n% autorización\n%%EOF\n')], { type: 'application/pdf' }), 'datos.pdf');
  for (const [k, v] of Object.entries({ jugador_id: nuevo.datos.id, tipo: 'datos_personales', estado: 'firmado' })) f.append(k, String(v));
  const firma = await llamarFormulario('/api/consentimientos', T.salud, f);
  assert.equal(firma.status, 201, JSON.stringify(firma.datos));
  const { rows: [a] } = await sql(`SELECT * FROM aceptaciones WHERE jugador_id = $1 AND via = 'papel'`, [nuevo.datos.id]);
  assert.equal(a.consentimiento_id, firma.datos.registro.id);
  assert.equal(await estadoEn('administrador', nuevo.datos.id), 'completa');

  // Un deportista registrado por error, sin historia clínica, se puede eliminar (se lleva sus declaraciones)
  const error = await llamar('POST', '/api/jugadores', T.entrenador, conDeclaracion({ nombre: `${PRE}por error`, disciplina_id: ids.rugby }));
  assert.equal((await llamar('DELETE', `/api/jugadores/${error.datos.id}`, T.entrenador)).status, 200);
  const { rows: [quedan] } = await sql('SELECT COUNT(*)::int AS n FROM aceptaciones WHERE jugador_id = $1', [error.datos.id]);
  assert.equal(quedan.n, 0);
});
