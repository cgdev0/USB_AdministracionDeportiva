// Módulo de auditoría del administrador (v2.9, T2.7 del plan de historia clínica; RF-33, D12 y D13).
const test = require('node:test');
const assert = require('node:assert/strict');
const { iniciar, cerrar, llamar, llamarCrudo, token, aceptarAviso, sql, sqlMantenimiento, conDeclaracion } = require('../utilidades/api');

const T = {};
const ids = {};
const PRE = 'ZZ auditoria ';
const CLAVE = 'Prueba.2026!Audit';
const eventos = async (query = '') => (await llamar('GET', `/api/auditoria/eventos${query}`, T.administrador)).datos;

test.before(async () => {
  await iniciar();
  for (const rol of ['administrador', 'entrenador', 'head_coach', 'salud', 'jugador']) T[rol] = await token(rol);
  ({ rows: [{ ahora: ids.inicio }] } = await sql('SELECT now() AS ahora'));
});
test.after(async () => {
  try {
    await sqlMantenimiento(`DELETE FROM aceptaciones WHERE usuario_id IN (SELECT id FROM usuarios WHERE email LIKE 'zz.auditoria%')
      OR jugador_id IN (SELECT id FROM jugadores WHERE nombre LIKE '${PRE}%')`);
    await sqlMantenimiento(`DELETE FROM usuarios WHERE email LIKE 'zz.auditoria%'`);
    await sqlMantenimiento(`DELETE FROM jugadores WHERE nombre LIKE '${PRE}%'`);
    await sqlMantenimiento(`UPDATE ajustes SET valor = 'false'::jsonb WHERE clave = 'exigir_consentimiento_atencion'`);
  } finally {
    await cerrar(__filename);
  }
});

test('CP-AUD-001 [RF-33][RNF-02] La auditoría es exclusiva del administrador: ningún otro rol entra, ni por la API', async () => {
  const rutas = ['eventos', 'aceptaciones', 'cargas', 'pendientes', 'ajustes', 'exportar?fuente=eventos'];
  for (const r of rutas) assert.equal((await llamar('GET', `/api/auditoria/${r}`, T.administrador)).status, 200, r);
  for (const rol of ['entrenador', 'head_coach', 'salud', 'jugador']) {
    for (const r of rutas) assert.equal((await llamar('GET', `/api/auditoria/${r}`, T[rol])).status, 403, `${rol} ${r}`);
    assert.equal((await llamar('PUT', '/api/auditoria/ajustes', T[rol], { exigir_consentimiento_atencion: true })).status, 403, rol);
  }
  assert.equal((await llamar('GET', '/api/auditoria/eventos')).status, 401);
});

test('CP-AUD-002 [RF-33] Las altas, los cambios de rol, las claves, las desactivaciones y los retiros quedan registrados', async () => {
  const u = await llamar('POST', '/api/usuarios', T.administrador, { nombre: `${PRE}usuario`, email: 'zz.auditoria.uno@test.com', password: CLAVE, rol: 'entrenador' });
  assert.equal(u.status, 201);
  const id = u.datos.id;
  await llamar('PUT', `/api/usuarios/${id}`, T.administrador, { nombre: `${PRE}usuario`, email: 'zz.auditoria.uno@test.com', rol: 'head_coach' });
  await llamar('PUT', `/api/usuarios/${id}/reset`, T.administrador, { password: 'Otra.Clave.2026!' });
  await llamar('DELETE', `/api/usuarios/${id}`, T.administrador);
  await llamar('PATCH', `/api/usuarios/${id}/activar`, T.administrador);
  const deUsuario = (await eventos('?recurso=usuario')).filter(e => e.recurso_id === id).reverse();
  assert.deepEqual(deUsuario.map(e => e.accion), ['crear', 'cambiar_rol', 'restablecer_clave', 'desactivar', 'activar']);
  assert.deepEqual(deUsuario[1].detalle.cambios.rol, { antes: 'entrenador', despues: 'head_coach' });
  assert.ok(deUsuario.every(e => e.usuario_rol === 'administrador' && e.usuario_nombre && e.ip));
  assert.ok(!JSON.stringify(deUsuario).includes('Otra.Clave'), 'nunca guarda contraseñas');

  // Deportistas: alta, retiro, reactivación y eliminación (por el entrenador)
  const j = await llamar('POST', '/api/jugadores', T.entrenador, conDeclaracion({ nombre: `${PRE}deportista` }));
  await llamar('PATCH', `/api/jugadores/${j.datos.id}/retirar`, T.entrenador, { motivo: 'Se graduó' });
  await llamar('PATCH', `/api/jugadores/${j.datos.id}/reactivar`, T.entrenador);
  await llamar('DELETE', `/api/jugadores/${j.datos.id}`, T.entrenador);
  const deDeportista = (await eventos('?recurso=deportista')).filter(e => e.recurso_id === j.datos.id).reverse();
  assert.deepEqual(deDeportista.map(e => e.accion), ['crear', 'retirar', 'reactivar', 'eliminar']);
  assert.deepEqual([deDeportista[0].usuario_rol, deDeportista[1].detalle.motivo, deDeportista[3].detalle.nombre], ['entrenador', 'Se graduó', `${PRE}deportista`]);
  // Filtro por persona (texto) y por acción
  assert.ok((await eventos(`?q=${encodeURIComponent(PRE + 'deportista')}&accion=eliminar`)).some(e => e.recurso_id === j.datos.id));
});

test('CP-AUD-003 [RF-33] Cada carga masiva aparece con su archivo, su huella, su resultado, lo creado y la declaración', async () => {
  const r = await llamar('POST', '/api/jugadores/bulk', T.administrador, conDeclaracion({
    deportistas: [{ nombre: `${PRE}carga uno`, deporte: 'Rugby' }, { nombre: '' }],
    archivo: { nombre: 'zz-auditoria.csv', sha256: 'a'.repeat(64) } }, 'carga'));
  assert.equal(r.status, 201);
  const lista = (await llamar('GET', '/api/auditoria/cargas', T.administrador)).datos;
  const c = lista.find(x => x.id === r.datos.carga_id);
  assert.deepEqual([c.tipo, c.archivo_nombre, c.creadas, c.rechazadas], ['deportistas', 'zz-auditoria.csv', 1, 1]);
  const detalle = (await llamar('GET', `/api/auditoria/cargas/${c.id}`, T.administrador)).datos;
  assert.deepEqual(detalle.creados.map(x => x.nombre), [`${PRE}carga uno`]);
  assert.equal(detalle.errores[0].error, 'Nombre vacío');
  assert.ok(detalle.declaracion.version && detalle.declaracion.usuario_nombre);
  assert.ok((await eventos('?accion=importar')).some(e => e.recurso_id === c.id), 'también como evento');
  assert.equal((await llamar('GET', '/api/auditoria/cargas/999999', T.administrador)).status, 404);
});

test('CP-AUD-004 [RF-33][RF-32] Aceptaciones y pendientes: quién no ha aceptado su compromiso y a qué deportistas les falta la suya', async () => {
  const u = await llamar('POST', '/api/usuarios', T.administrador, { nombre: `${PRE}pendiente`, email: 'zz.auditoria.pend@test.com', password: CLAVE, rol: 'personal_salud' });
  const j = await llamar('POST', '/api/jugadores', T.entrenador, conDeclaracion({ nombre: `${PRE}sin aceptar` }));
  let p = (await llamar('GET', '/api/auditoria/pendientes', T.administrador)).datos;
  assert.ok(p.personal.some(x => x.id === u.datos.id), 'personal nuevo, pendiente');
  assert.ok(!p.personal.some(x => x.email === 'admin1@dtdeportivo.com'), 'quien ya aceptó no aparece');
  assert.equal(p.deportistas.find(x => x.id === j.datos.id).autorizacion, 'falta_propia');
  assert.ok(!p.deportistas.some(x => x.autorizacion === 'previa'), 'los de demostración no');
  // Al aceptar, sale de pendientes y la aceptación aparece en la lista (filtrable por vía)
  await aceptarAviso(await token('salud', { aceptar: false, credenciales: ['zz.auditoria.pend@test.com', CLAVE] }));
  p = (await llamar('GET', '/api/auditoria/pendientes', T.administrador)).datos;
  assert.ok(!p.personal.some(x => x.id === u.datos.id));
  const acept = (await llamar('GET', '/api/auditoria/aceptaciones?via=cuenta&q=ZZ%20auditoria', T.administrador)).datos;
  assert.equal(acept[0].aviso, 'compromiso_personal');
  const decl = (await llamar('GET', '/api/auditoria/aceptaciones?via=registro', T.administrador)).datos;
  assert.ok(decl.some(a => a.jugador_id === j.datos.id && a.usuario_rol === 'entrenador'));
});

test('CP-AUD-005 [RF-33][RNF-01] Los inicios de sesión fallidos y los bloqueos quedan registrados, sin la contraseña', async () => {
  const intento = 'zz.auditoria.nadie@test.com';
  for (let i = 0; i < 5; i++) assert.equal((await llamar('POST', '/api/auth/login', null, { email: intento, password: 'Adivina123!' })).status, 401);
  assert.equal((await llamar('POST', '/api/auth/login', null, { email: intento, password: 'Adivina123!' })).status, 429);
  const sesion = (await eventos('?recurso=sesion')).filter(e => e.detalle.intento === intento);
  assert.equal(sesion.filter(e => e.accion === 'sesion_fallida').length, 5);
  assert.equal(sesion.filter(e => e.accion === 'sesion_bloqueada').length, 1);
  assert.ok(!JSON.stringify(sesion).includes('Adivina123!'));
});

test('CP-AUD-006 [RF-33] El ajuste de la regla D2 empieza apagado y su cambio queda registrado; la auditoría se exporta y no se modifica', async () => {
  const antes = (await llamar('GET', '/api/auditoria/ajustes', T.administrador)).datos;
  assert.equal(antes.exigir_consentimiento_atencion.valor, false, 'apagado hasta que el docente apruebe los formatos (D12)');
  assert.equal((await llamar('PUT', '/api/auditoria/ajustes', T.administrador, { exigir_consentimiento_atencion: 'si' })).status, 400);
  assert.equal((await llamar('PUT', '/api/auditoria/ajustes', T.administrador, { otro: true })).status, 400);
  const r = await llamar('PUT', '/api/auditoria/ajustes', T.administrador, { exigir_consentimiento_atencion: true });
  assert.equal(r.datos.exigir_consentimiento_atencion.valor, true);
  await llamar('PUT', '/api/auditoria/ajustes', T.administrador, { exigir_consentimiento_atencion: false });
  const ajustes = (await eventos('?accion=ajuste')).slice(0, 2).reverse();
  assert.deepEqual(ajustes.map(e => [e.detalle.antes, e.detalle.despues]), [[false, true], [true, false]]);

  // Exportar a CSV: con encabezado y queda registrado
  const csv = await llamarCrudo('GET', '/api/auditoria/exportar?fuente=eventos&accion=ajuste', { headers: { Authorization: `Bearer ${T.administrador}` } });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.ok((await eventos('?accion=exportar')).some(e => e.detalle.fuente === 'eventos'));
  assert.equal((await llamar('GET', '/api/auditoria/exportar?fuente=otra', T.administrador)).status, 400);
  // No se modifica ni se borra
  const { rows: [e] } = await sql('SELECT id FROM auditoria ORDER BY id DESC LIMIT 1');
  await assert.rejects(sql(`UPDATE auditoria SET accion = 'crear' WHERE id = $1`, [e.id]), /no se modifica ni se borra/);
  await assert.rejects(sql('DELETE FROM auditoria WHERE id = $1', [e.id]), /no se modifica ni se borra/);
});
