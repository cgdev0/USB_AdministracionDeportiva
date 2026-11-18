// Identificación del deportista (v2.7, T0.1 del plan de historia clínica): documento, acudiente de los menores,
// datos sensibles solo para salud e importación por CSV (RF-25, RNF-02).
const test = require('node:test');
const assert = require('node:assert/strict');
const { iniciar, cerrar, llamar, token, sql, sqlMantenimiento } = require('../utilidades/api');

const PRE = 'ZZ ident ';
const T = {};
let rugby = null;
let serie = 0;
// Números de documento únicos en cada ejecución (10 dígitos)
const documento = () => `7${String(Date.now()).slice(-7)}${String(++serie).padStart(2, '0')}`;
// Fecha de nacimiento de alguien que cumplió `anios` hace unos meses (lejos del cumpleaños)
const nacidoHace = (anios) => { const d = new Date(); d.setFullYear(d.getFullYear() - anios); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); };

test.before(async () => {
  await iniciar();
  for (const rol of ['administrador', 'entrenador', 'salud', 'jugador']) T[rol] = await token(rol);
  ({ rows: [{ id: rugby }] } = await sql(`SELECT id FROM disciplinas WHERE nombre = 'Rugby'`));
});
test.after(async () => {
  await sql(`DELETE FROM usuarios WHERE email LIKE 'zz.ident%'`);
  await sqlMantenimiento(`DELETE FROM jugadores WHERE nombre LIKE $1`, [PRE + '%']);
  await cerrar(__filename);
});

async function crear(cuerpo, rol = 'administrador') {
  return llamar('POST', '/api/jugadores', T[rol], { nombre: `${PRE}${++serie}`, disciplina_id: rugby, ...cuerpo });
}

test('CP-HC-001 [RF-25] El deportista se identifica con tipo y número de documento, que no se repite', async () => {
  const numero = documento();
  const c = await crear({ tipo_documento: 'CC', numero_documento: `${numero.slice(0, 1)}.${numero.slice(1)}` });
  assert.equal(c.status, 201, JSON.stringify(c.datos));
  const ficha = await llamar('GET', `/api/jugadores/${c.datos.id}`, T.administrador);
  assert.equal(ficha.datos.tipo_documento, 'CC');
  assert.equal(ficha.datos.numero_documento, numero, 'se guarda sin puntos');

  const repetido = await crear({ tipo_documento: 'CC', numero_documento: numero });
  assert.equal(repetido.status, 409);
  assert.match(repetido.datos.error, /número de documento/);
  // Al cumplir 18 años la TI pasa a CC con el mismo número: tampoco se puede registrar dos veces
  assert.equal((await crear({ tipo_documento: 'TI', numero_documento: numero })).status, 409, 'mismo número con otro tipo');

  assert.equal((await crear({ tipo_documento: 'CC', numero_documento: 'ABC123' })).status, 400, 'la cédula solo lleva dígitos');
  assert.equal((await crear({ numero_documento: documento() })).status, 400, 'número sin tipo');
  assert.equal((await crear({})).status, 201, 'el documento se puede completar después');

  // Plantel de demostración: documentos ficticios y un menor de edad (#23) con acudiente
  const { rows: demo } = await sql(`SELECT dorsal, tipo_documento, numero_documento, acudiente_nombre,
      date_part('year', age(fecha_nacimiento))::int AS edad
    FROM jugadores WHERE equipo_id = (SELECT id FROM equipos WHERE nombre = 'Unisimón Rugby (demo)') AND nombre NOT LIKE 'ZZ%'`);
  assert.equal(demo.length, 23);
  assert.ok(demo.every(j => j.numero_documento), 'todos con documento');
  const menor = demo.find(j => j.dorsal === 23);
  assert.equal(menor.tipo_documento, 'TI');
  assert.ok(menor.edad < 18 && menor.acudiente_nombre, 'menor con acudiente');
});

test('CP-HC-002 [RF-25] Un menor de edad necesita acudiente (nombre y teléfono)', async () => {
  const menor = { fecha_nacimiento: nacidoHace(16) };
  const sinAcudiente = await crear(menor);
  assert.equal(sinAcudiente.status, 400);
  assert.match(sinAcudiente.datos.error, /acudiente/);
  assert.equal((await crear({ ...menor, acudiente_nombre: 'Ana Pérez' })).status, 400, 'falta el teléfono');
  const ok = await crear({ ...menor, acudiente_nombre: 'Ana Pérez', acudiente_telefono: '300 000 0000', acudiente_parentesco: 'Madre' });
  assert.equal(ok.status, 201, JSON.stringify(ok.datos));
  assert.equal((await crear({ edad: 15 })).status, 400, 'sin fecha, con la edad registrada');
  assert.equal((await crear({ fecha_nacimiento: nacidoHace(20) })).status, 201, 'un adulto no necesita acudiente');

  // Un menor registrado antes de la v2.7 sin acudiente: asignarle dorsal o equipo no queda bloqueado…
  const { rows: [antiguo] } = await sql(
    `INSERT INTO jugadores (nombre, fecha_nacimiento, disciplina_id) VALUES ($1, $2, $3) RETURNING id`,
    [`${PRE}antiguo`, nacidoHace(16), rugby]);
  assert.equal((await llamar('PUT', `/api/jugadores/${antiguo.id}`, T.administrador, { dorsal: 77 })).status, 200);
  // …pero al editar sus datos con el formulario completo sí se pide el acudiente
  const formulario = await llamar('PUT', `/api/jugadores/${antiguo.id}`, T.administrador, { nombre: `${PRE}antiguo`, acudiente_nombre: '', acudiente_telefono: '' });
  assert.equal(formulario.status, 400);

  // Crear la cuenta de un deportista menor también pide el acudiente y el documento no se repite
  const base = { nombre: `${PRE}cuenta`, password: 'Prueba123!', rol: 'jugador' };
  const cuenta = await llamar('POST', '/api/usuarios', T.administrador,
    { ...base, email: `zz.ident.${Date.now()}@test.com`, ficha: { disciplina_id: rugby, fecha_nacimiento: nacidoHace(16), tipo_documento: 'TI', numero_documento: documento() } });
  assert.equal(cuenta.status, 400);
  assert.match(cuenta.datos.error, /acudiente/);
  const numero = documento();
  const conAcudiente = await llamar('POST', '/api/usuarios', T.administrador, { ...base, email: `zz.ident.a${Date.now()}@test.com`,
    ficha: { disciplina_id: rugby, fecha_nacimiento: nacidoHace(16), tipo_documento: 'TI', numero_documento: numero, acudiente_nombre: 'Luis Pérez', acudiente_telefono: '3000000000' } });
  assert.equal(conAcudiente.status, 201, JSON.stringify(conAcudiente.datos));
  const repetida = await llamar('POST', '/api/usuarios', T.administrador, { ...base, email: `zz.ident.b${Date.now()}@test.com`,
    ficha: { disciplina_id: rugby, tipo_documento: 'CC', numero_documento: numero } });
  assert.equal(repetida.status, 409);
  assert.match(repetida.datos.error, /documento/, 'el mensaje habla del documento, no del email');
});

test('CP-HC-003 [RF-25][RNF-02] Pertenencia étnica y discapacidad: las registra y las ve solo salud (y el propio deportista)', async () => {
  const c = await crear({ tipo_documento: 'CC', numero_documento: documento() }, 'entrenador');
  assert.equal(c.status, 201, JSON.stringify(c.datos));
  const id = c.datos.id;

  const entrenador = await llamar('PATCH', `/api/jugadores/${id}/identificacion`, T.entrenador, { discapacidad: 'visual' });
  assert.equal(entrenador.status, 403, 'el entrenador no registra datos sensibles');
  assert.equal((await crear({ pertenencia_etnica: 'indigena' })).status, 403, 'ni el administrador al crear');

  const salud = await llamar('PATCH', `/api/jugadores/${id}/identificacion`, T.salud,
    { pertenencia_etnica: 'afrocolombiano', discapacidad: 'ninguna', eps: 'Nueva EPS', contacto_emergencia_nombre: 'Rosa', contacto_emergencia_telefono: '3110000000' });
  assert.equal(salud.status, 200, JSON.stringify(salud.datos));
  assert.equal((await llamar('PATCH', `/api/jugadores/${id}/identificacion`, T.salud, { dorsal: 5 })).status, 400,
    'por esta ruta no se cambia el dorsal');
  assert.equal((await llamar('PATCH', `/api/jugadores/${id}/identificacion`, T.jugador, { eps: 'Sura' })).status, 403);

  const vistaSalud = await llamar('GET', `/api/jugadores/${id}`, T.salud);
  assert.equal(vistaSalud.datos.pertenencia_etnica, 'afrocolombiano');
  assert.equal(vistaSalud.datos.eps, 'Nueva EPS');
  for (const rol of ['entrenador', 'administrador']) {
    const vista = await llamar('GET', `/api/jugadores/${id}`, T[rol]);
    assert.equal(vista.status, 200);
    assert.ok(!('pertenencia_etnica' in vista.datos) && !('discapacidad' in vista.datos), `${rol} no recibe datos sensibles`);
    assert.equal(vista.datos.contacto_emergencia_telefono, '3110000000', `${rol} sí ve el contacto de emergencia`);
    const lista = await llamar('GET', '/api/jugadores', T[rol]);
    assert.ok(lista.datos.every(j => !('discapacidad' in j)), `${rol}: tampoco en el listado`);
  }
  const propio = await llamar('GET', '/api/jugadores', T.jugador);
  assert.ok('discapacidad' in propio.datos[0], 'el deportista ve sus propios datos');
});

test('CP-HC-004 [RF-25] Importación por CSV: documento, fecha de nacimiento y acudiente; las filas inválidas no entran', async () => {
  const existente = documento();
  await crear({ tipo_documento: 'CC', numero_documento: existente });
  const nuevo = documento();
  const r = await llamar('POST', '/api/jugadores/bulk', T.administrador, { deportistas: [
    { nombre: `${PRE}csv bien`, deporte: 'Rugby', tipo_documento: 'CC', numero_documento: nuevo, telefono: '3000000001', eps: 'Sura' },
    { nombre: `${PRE}csv repetido en archivo`, deporte: 'Rugby', tipo_documento: 'CC', numero_documento: nuevo },
    { nombre: `${PRE}csv ya registrado`, deporte: 'Rugby', tipo_documento: 'CC', numero_documento: existente },
    { nombre: `${PRE}csv menor`, deporte: 'Rugby', fecha_nacimiento: nacidoHace(15) },
    { nombre: `${PRE}csv menor con acudiente`, deporte: 'Rugby', tipo_documento: 'TI', numero_documento: documento(),
      fecha_nacimiento: nacidoHace(15), acudiente_nombre: 'Marta', acudiente_telefono: '3000000002' },
    { nombre: `${PRE}csv fecha mala`, deporte: 'Rugby', fecha_nacimiento: '15/03/2004' },
    { nombre: `${PRE}csv cedula mala`, deporte: 'Rugby', tipo_documento: 'CC', numero_documento: 'X1' },
  ] });
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  assert.equal(r.datos.total, 2, JSON.stringify(r.datos.errores));
  assert.deepEqual(r.datos.errores.map(e => e.fila), [2, 3, 4, 6, 7]);
  const { rows } = await sql(`SELECT nombre, telefono, eps, acudiente_nombre FROM jugadores WHERE numero_documento = $1`, [nuevo]);
  assert.equal(rows[0].eps, 'Sura');
  assert.equal(rows[0].telefono, '3000000001');
});
