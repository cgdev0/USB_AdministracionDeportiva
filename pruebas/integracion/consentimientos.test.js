// Consentimientos en la API (v2.9, T2.1 del plan de historia clínica; RF-27, RF-31, RNF-02, RNF-14).
// Las cuatro reglas: firmado con el papel, el menor por medio de su acudiente y con su asentimiento, revocar sin
// borrar y el de investigación independiente. Además, quién puede verlos y registrarlos, y la bitácora.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { iniciar, cerrar, llamar, llamarFormulario, descargar, token, sql, sqlMantenimiento, conDeclaracion } = require('../utilidades/api');

const T = {};
const ids = {};
const JPG = () => Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), crypto.randomBytes(200), Buffer.from([0xFF, 0xD9])]);
const PDF = Buffer.from('%PDF-1.4\n% Consentimiento firmado (prueba)\n%%EOF\n');
const TEMPORAL = 'ZZ consentimiento temporal';

function formulario(campos, archivo) {
  const f = new FormData();
  if (archivo) f.append('archivo', new Blob([archivo.contenido], { type: archivo.tipo }), archivo.nombre);
  for (const [k, v] of Object.entries(campos)) f.append(k, String(v));
  return f;
}
const conPapel = (campos, archivo = { contenido: JPG(), tipo: 'image/jpeg', nombre: 'consentimiento.jpg' }) =>
  llamarFormulario('/api/consentimientos', T.salud, formulario(campos, archivo));
const sinPapel = (campos, rol = 'salud') => llamar('POST', '/api/consentimientos', T[rol], campos);
const estado = async (jugadorId) => (await llamar('GET', `/api/consentimientos?jugador_id=${jugadorId}`, T.salud)).datos;

test.before(async () => {
  await iniciar();
  for (const rol of ['administrador', 'entrenador', 'head_coach', 'salud', 'jugador']) T[rol] = await token(rol);
  for (const [clave, documento] of [['mateo', '1090000015'], ['tomas', '1090000023'], ['julian', '1090000014']]) {
    ({ rows: [{ id: ids[clave] }] } = await sql('SELECT id FROM jugadores WHERE numero_documento = $1', [documento]));
  }
  ({ rows: [{ jugador_id: ids.propio }] } = await sql(`SELECT jugador_id FROM usuarios WHERE email = 'jugador@dtdeportivo.com'`));
  ({ rows: [{ ahora: ids.inicio }] } = await sql('SELECT now() AS ahora')); // la bitácora no se borra: se cuenta desde aquí
});
test.after(async () => {
  try {
    const usados = `jugador_id IN ($1, $2, $3, $4) OR jugador_id IN (SELECT id FROM jugadores WHERE nombre = '${TEMPORAL}')`;
    const params = [ids.mateo, ids.tomas, ids.julian, ids.propio];
    await sqlMantenimiento(`DELETE FROM consentimientos WHERE ${usados}`, params);
    await sqlMantenimiento(`DELETE FROM archivos_clinicos WHERE tipo = 'consentimiento' AND (${usados})`, params);
    await sqlMantenimiento(`DELETE FROM jugadores WHERE nombre = '${TEMPORAL}'`);
  } finally {
    await cerrar(__filename);
  }
});

test('CP-CON-001 [RF-27] Para quedar firmado hay que adjuntar el papel, que se guarda protegido con el consentimiento', async () => {
  // Sin el papel no queda firmado
  const sin = await sinPapel({ jugador_id: ids.mateo, tipo: 'atencion', estado: 'firmado' });
  assert.equal(sin.status, 400);
  assert.match(sin.datos.error, /adjunta la foto o el PDF del papel firmado/);
  assert.equal((await estado(ids.mateo)).actual.atencion.estado, 'pendiente');

  // Con la foto: firmado por el propio deportista (mayor de edad), con su documento y quien lo registró
  const r = await conPapel({ jugador_id: ids.mateo, tipo: 'atencion', estado: 'firmado', fecha: '2026-11-10' });
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  const c = r.datos.registro;
  assert.deepEqual([c.estado, c.fecha, c.firma_quien, c.firmante_nombre, c.firmante_numero_documento, c.asentimiento],
    ['firmado', '2026-11-10', 'deportista', 'Mateo Carrillo', '1090000015', null]);
  assert.ok(c.archivo_id && c.archivo_mime === 'image/jpeg' && c.version_formato);
  assert.ok(c.quien_atiende?.nombre, 'copia de los datos de quien lo registró');
  assert.equal(r.datos.actual.atencion.estado, 'firmado');
  ids.firmaMateo = c.id;
  // El papel queda como archivo clínico del deportista: lo abre salud, no el entrenador
  const { rows: [a] } = await sql('SELECT tipo, jugador_id FROM archivos_clinicos WHERE id = $1', [c.archivo_id]);
  assert.deepEqual([a.tipo, a.jugador_id], ['consentimiento', ids.mateo]);
  assert.equal((await descargar(`/api/archivos-clinicos/${c.archivo_id}`, T.salud)).status, 200);
  assert.equal((await descargar(`/api/archivos-clinicos/${c.archivo_id}`, T.entrenador)).status, 403);
  // Un archivo que no es foto ni PDF se rechaza y no se registra nada
  const falso = await conPapel({ jugador_id: ids.mateo, tipo: 'datos_personales', estado: 'firmado' },
    { contenido: Buffer.from('no soy una imagen'), tipo: 'image/jpeg', nombre: 'falso.jpg' });
  assert.equal(falso.status, 400);
  assert.equal((await estado(ids.mateo)).actual.datos_personales.estado, 'pendiente');
  // La base de datos tampoco acepta un firmado sin papel
  await assert.rejects(sql(`INSERT INTO consentimientos (jugador_id, tipo, estado, firma_quien, firmante_nombre) VALUES ($1, 'atencion', 'firmado', 'deportista', 'X')`, [ids.mateo]),
    /chk_consentimientos_firmado_con_archivo/);
});

test('CP-CON-002 [RF-27] Si el deportista es menor, firma el acudiente y se registra el asentimiento', async () => {
  const base = { jugador_id: ids.tomas, tipo: 'atencion', estado: 'firmado' };
  assert.match((await conPapel({ ...base, firma_quien: 'deportista', asentimiento: 'si' })).datos.error, /firma el acudiente/);
  assert.match((await conPapel(base)).datos.error, /asentimiento/);
  // Con el acudiente registrado en su identificación y el asentimiento del menor
  const r = await conPapel({ ...base, asentimiento: 'si' }, { contenido: PDF, tipo: 'application/pdf', nombre: 'atencion-tomas.pdf' });
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  assert.deepEqual([r.datos.registro.firma_quien, r.datos.registro.firmante_nombre, r.datos.registro.firmante_parentesco, r.datos.registro.asentimiento],
    ['acudiente', 'María Ibarra (demo)', 'Madre', true]);
  // Investigación: el acudiente firma, pero el menor no da su asentimiento (queda registrado)
  const inv = await conPapel({ jugador_id: ids.tomas, tipo: 'investigacion', estado: 'firmado', asentimiento: 'no' });
  assert.equal(inv.status, 201);
  assert.equal(inv.datos.actual.investigacion.asentimiento, false);
  const lista = await estado(ids.tomas);
  assert.equal(lista.menor, true);
  // Para un mayor de edad no se registra asentimiento
  assert.match((await conPapel({ jugador_id: ids.mateo, tipo: 'datos_personales', estado: 'firmado', asentimiento: 'si' })).datos.error, /solo se registra cuando el deportista es menor/);
});

test('CP-CON-003 [RF-27][RNF-14] Revocar no borra: crea un registro nuevo con su motivo y el historial se conserva', async () => {
  // Lo firmado no se "rechaza": se revoca
  const rechazo = await sinPapel({ jugador_id: ids.mateo, tipo: 'atencion', estado: 'rechazado' });
  assert.equal(rechazo.status, 409);
  assert.match(rechazo.datos.error, /revócalo/);
  // La revocación pide el motivo
  assert.equal((await llamar('POST', `/api/consentimientos/${ids.firmaMateo}/revocar`, T.salud, {})).status, 400);
  const r = await llamar('POST', `/api/consentimientos/${ids.firmaMateo}/revocar`, T.salud, { motivo: 'Prefiere atenderse en su EPS' });
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  assert.deepEqual([r.datos.registro.estado, r.datos.registro.revoca_id, r.datos.registro.motivo], ['revocado', ids.firmaMateo, 'Prefiere atenderse en su EPS']);
  assert.equal(r.datos.actual.atencion.estado, 'revocado');
  // El firmado sigue en el historial, tal como estaba
  const atencion = r.datos.historial.filter(c => c.tipo === 'atencion');
  assert.deepEqual(atencion.map(c => c.estado), ['revocado', 'firmado']);
  // No se revoca dos veces, ni algo que ya no está vigente
  assert.equal((await llamar('POST', `/api/consentimientos/${ids.firmaMateo}/revocar`, T.salud, { motivo: 'otra vez' })).status, 409);
  assert.equal((await llamar('POST', '/api/consentimientos/999999/revocar', T.salud, { motivo: 'x' })).status, 404);
  // Ni la base de datos deja cambiarlo o borrarlo
  await assert.rejects(sql(`UPDATE consentimientos SET estado = 'firmado' WHERE id = $1`, [r.datos.registro.id]), /no se modifican ni se borran/);
  await assert.rejects(sql('DELETE FROM consentimientos WHERE id = $1', [ids.firmaMateo]), /no se modifican ni se borran/);
  // Se puede volver a firmar: queda como un registro más
  const otra = await conPapel({ jugador_id: ids.mateo, tipo: 'atencion', estado: 'firmado' });
  assert.equal(otra.status, 201);
  assert.deepEqual(otra.datos.historial.filter(c => c.tipo === 'atencion').map(c => c.estado), ['firmado', 'revocado', 'firmado']);
});

test('CP-CON-004 [RF-27] El de investigación es independiente: negarlo no cambia la atención ni los datos personales', async () => {
  const antes = (await estado(ids.mateo)).actual;
  const r = await sinPapel({ jugador_id: ids.mateo, tipo: 'investigacion', estado: 'rechazado', motivo: 'No desea participar en estudios' });
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  assert.deepEqual([r.datos.actual.investigacion.estado, r.datos.actual.atencion.estado, r.datos.actual.datos_personales.estado],
    ['rechazado', antes.atencion.estado, antes.datos_personales.estado]);
  assert.equal(r.datos.actual.atencion.estado, 'firmado', 'la atención sigue firmada');
  // Y un deportista sin ningún registro tiene los tres pendientes
  assert.deepEqual(Object.values((await estado(ids.julian)).actual).map(c => c.estado), ['pendiente', 'pendiente', 'pendiente']);
});

test('CP-CON-005 [RF-27][RNF-02] Los registra el personal de salud; el deportista consulta solo los suyos; los demás no entran', async () => {
  for (const rol of ['administrador', 'entrenador', 'head_coach']) {
    assert.equal((await llamar('GET', `/api/consentimientos?jugador_id=${ids.mateo}`, T[rol])).status, 403, `${rol} consulta`);
    assert.equal((await sinPapel({ jugador_id: ids.mateo, tipo: 'investigacion', estado: 'rechazado' }, rol)).status, 403, `${rol} registra`);
  }
  // El deportista: los suyos, aunque pida los de otro; no registra
  await sinPapel({ jugador_id: ids.propio, tipo: 'datos_personales', estado: 'rechazado' });
  const propio = await llamar('GET', `/api/consentimientos?jugador_id=${ids.mateo}`, T.jugador);
  assert.equal(propio.status, 200);
  assert.equal(propio.datos.jugador_id, ids.propio);
  assert.equal(propio.datos.actual.datos_personales.estado, 'rechazado');
  assert.equal((await sinPapel({ jugador_id: ids.propio, tipo: 'atencion', estado: 'rechazado' }, 'jugador')).status, 403);
  // Salud debe indicar el deportista
  assert.equal((await llamar('GET', '/api/consentimientos', T.salud)).status, 400);
  assert.equal((await llamar('GET', '/api/consentimientos?jugador_id=999999', T.salud)).status, 404);
});

test('CP-CON-006 [RF-31][RNF-14] Cada consulta, registro y revocación queda en la bitácora, y quien tiene consentimientos no se elimina', async () => {
  const { rows } = await sql(`SELECT accion, COUNT(*)::int AS n FROM bitacora_clinica
    WHERE recurso = 'consentimiento' AND jugador_id = $1 AND creado_en >= $2 GROUP BY accion`, [ids.mateo, ids.inicio]);
  const por = Object.fromEntries(rows.map(r => [r.accion, r.n]));
  assert.ok(por.listar >= 1 && por.crear >= 3 && por.revocar === 1, JSON.stringify(por));
  // Un deportista con solo un rechazo registrado ya tiene historia clínica: se retira, no se elimina
  const entrenador = T.entrenador;
  const nuevo = await llamar('POST', '/api/jugadores', entrenador, conDeclaracion({ nombre: TEMPORAL, tipo_documento: 'CC', numero_documento: `4${String(Date.now()).slice(-9)}` }));
  assert.equal(nuevo.status, 201, JSON.stringify(nuevo.datos));
  await sinPapel({ jugador_id: nuevo.datos.id, tipo: 'investigacion', estado: 'rechazado' });
  const borrar = await llamar('DELETE', `/api/jugadores/${nuevo.datos.id}`, entrenador);
  assert.equal(borrar.status, 409);
  assert.match(borrar.datos.error, /historia clínica/);
});
