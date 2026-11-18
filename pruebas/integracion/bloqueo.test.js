// Bloqueo por inactividad: desbloqueo con contraseña (v2.7, T0.8 del plan de historia clínica; RNF-01).
// La pantalla se prueba en pruebas/ui/bloqueo.spec.js (CP-UI-SAL-001) con el reloj simulado.
const test = require('node:test');
const assert = require('node:assert/strict');
const { iniciar, cerrar, llamar, token, sqlMantenimiento } = require('../utilidades/api');

const CLAVE = 'Prueba123!';
let email = null;
let sesion = null;

test.before(async () => {
  await iniciar();
  // Cuenta propia: los intentos fallidos no deben bloquear la cuenta de salud que usan otras pruebas
  email = `zz.bloqueo.${Date.now()}@test.com`;
  const admin = await token('administrador');
  await llamar('POST', '/api/usuarios', admin, { nombre: 'ZZ Bloqueo', email, password: CLAVE, rol: 'personal_salud', vinculo: 'practicante' });
  sesion = (await llamar('POST', '/api/auth/login', null, { email, password: CLAVE })).datos.access_token;
});
test.after(async () => {
  await sqlMantenimiento('DELETE FROM usuarios WHERE email = $1', [email]);
  await cerrar(__filename);
});

test('CP-AUT-010 [RNF-01] Desbloquear exige la contraseña de la sesión y frena a quien intenta adivinarla', async () => {
  assert.equal((await llamar('POST', '/api/auth/desbloquear', null, { password: CLAVE })).status, 401, 'sin sesión');
  assert.equal((await llamar('POST', '/api/auth/desbloquear', sesion, {})).status, 400, 'sin contraseña');
  const ok = await llamar('POST', '/api/auth/desbloquear', sesion, { password: CLAVE });
  assert.equal(ok.status, 200, JSON.stringify(ok.datos));

  const mal = await llamar('POST', '/api/auth/desbloquear', sesion, { password: 'otra' });
  assert.equal(mal.status, 401);
  assert.match(mal.datos.error, /no es correcta/);
  for (let i = 0; i < 4; i++) await llamar('POST', '/api/auth/desbloquear', sesion, { password: 'otra' });
  const frenado = await llamar('POST', '/api/auth/desbloquear', sesion, { password: CLAVE });
  assert.equal(frenado.status, 429, 'tras 5 fallos espera 15 minutos, aunque luego acierte');
  assert.match(frenado.datos.error, /Demasiados intentos/);
});
