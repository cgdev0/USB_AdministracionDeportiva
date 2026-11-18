// Datos de quien atiende (v2.7, T0.2 del plan de historia clínica): profesión, vínculo, registro profesional
// opcional (decisión D1: los primeros usuarios serán practicantes y estudiantes) y supervisor opcional (RF-26).
const test = require('node:test');
const assert = require('node:assert/strict');
const { iniciar, cerrar, llamar, token, sql } = require('../utilidades/api');

const CLAVE = 'Prueba123!';
const T = {};
const id = {};
const correo = (n) => `zz.prof.${n}.${Date.now()}@test.com`;

test.before(async () => {
  await iniciar();
  T.administrador = await token('administrador');
  T.salud = await token('salud');
});
test.after(async () => {
  await sql(`DELETE FROM controles_medicos WHERE tipo LIKE 'ZZ prof%'`);
  await sql(`UPDATE usuarios SET supervisor_id = NULL WHERE email LIKE 'zz.prof%'`);
  await sql(`DELETE FROM usuarios WHERE email LIKE 'zz.prof%'`);
  await cerrar(__filename);
});

async function crearUsuario(n, extra) {
  const email = correo(n);
  const r = await llamar('POST', '/api/usuarios', T.administrador, { nombre: `ZZ prof ${n}`, email, password: CLAVE, rol: 'personal_salud', ...extra });
  return { ...r, email };
}

test('CP-HC-005 [RF-26] Un practicante sin registro profesional atiende y queda identificado con su supervisor', async () => {
  const docente = await crearUsuario('docente', { profesion: 'fisioterapia', vinculo: 'profesional', registro_profesional: 'RETHUS-1234' });
  assert.equal(docente.status, 201, JSON.stringify(docente.datos));
  id.docente = docente.datos.id;

  // D1: el practicante no tiene registro profesional y se crea sin problema
  const practicante = await crearUsuario('practicante', { profesion: 'fisioterapia', vinculo: 'practicante', registro_profesional: '', supervisor_id: id.docente });
  assert.equal(practicante.status, 201, JSON.stringify(practicante.datos));
  id.practicante = practicante.datos.id;

  const lista = await llamar('GET', '/api/usuarios', T.administrador);
  const fila = lista.datos.find(u => u.id === id.practicante);
  assert.deepEqual([fila.profesion, fila.vinculo, fila.registro_profesional, fila.supervisor_nombre],
    ['fisioterapia', 'practicante', null, 'ZZ prof docente']);

  // La sesión del practicante dice con qué datos queda registrado
  const login = await llamar('POST', '/api/auth/login', null, { email: practicante.email, password: CLAVE });
  assert.equal(login.status, 200);
  assert.equal(login.datos.usuario.quien_atiende.descripcion, 'Practicante de fisioterapia · Supervisa: ZZ prof docente');
  const yo = await llamar('GET', '/api/auth/me', login.datos.access_token);
  assert.equal(yo.datos.quien_atiende.supervisor_id, id.docente);

  // Registra un control médico sin registro profesional, y el control muestra quién lo hizo
  const { rows: [jugador] } = await sql(`SELECT id FROM jugadores WHERE nombre = 'Mateo Carrillo'`);
  const control = await llamar('POST', '/api/salud/controles', login.datos.access_token, { jugador_id: jugador.id, tipo: 'ZZ prof control', aptitud: 'apto' });
  assert.equal(control.status, 201, JSON.stringify(control.datos));
  const controles = await llamar('GET', '/api/salud/controles', T.salud); // v2.7 (T0.7): solo salud
  assert.equal(controles.datos.find(c => c.id === control.datos.id).atendio, 'ZZ prof practicante · Practicante de fisioterapia · Supervisa: ZZ prof docente');

  // ── Reglas del supervisor y de los datos profesionales ──
  const otro = await crearUsuario('estudiante', { profesion: 'medicina', vinculo: 'estudiante' });
  assert.equal(otro.status, 201);
  // Un practicante o un estudiante no puede ser supervisor, ni alguien que no es de salud, ni uno mismo
  assert.equal((await crearUsuario('x1', { vinculo: 'practicante', supervisor_id: id.practicante })).status, 400);
  const { rows: [entrenador] } = await sql(`SELECT id FROM usuarios WHERE email = 'cesar_dt@dtdeportivo.com'`);
  assert.equal((await crearUsuario('x2', { vinculo: 'practicante', supervisor_id: entrenador.id })).status, 400);
  const yoMismo = await llamar('PUT', `/api/usuarios/${id.docente}`, T.administrador,
    { nombre: 'ZZ prof docente', email: (await sql('SELECT email FROM usuarios WHERE id = $1', [id.docente])).rows[0].email, rol: 'personal_salud', supervisor_id: id.docente });
  assert.equal(yoMismo.status, 400);
  assert.equal((await crearUsuario('x3', { vinculo: 'docente' })).status, 400, 'vínculo fuera de la lista');
  assert.equal((await crearUsuario('x4', { registro_profesional: '#' })).status, 400, 'registro inválido');

  // Editar sin enviar los datos profesionales los conserva; cambiar a otro rol los borra
  const { rows: [{ email }] } = await sql('SELECT email FROM usuarios WHERE id = $1', [id.practicante]);
  assert.equal((await llamar('PUT', `/api/usuarios/${id.practicante}`, T.administrador, { nombre: 'ZZ prof practicante', email, rol: 'personal_salud' })).status, 200);
  let { rows: [p] } = await sql('SELECT vinculo, supervisor_id FROM usuarios WHERE id = $1', [id.practicante]);
  assert.deepEqual([p.vinculo, p.supervisor_id], ['practicante', id.docente]);
  assert.equal((await llamar('PUT', `/api/usuarios/${otro.datos.id}`, T.administrador, { nombre: 'ZZ prof estudiante', email: otro.email, rol: 'entrenador' })).status, 200);
  ({ rows: [p] } = await sql('SELECT profesion, vinculo FROM usuarios WHERE id = $1', [otro.datos.id]));
  assert.deepEqual([p.profesion, p.vinculo], [null, null]);
});
