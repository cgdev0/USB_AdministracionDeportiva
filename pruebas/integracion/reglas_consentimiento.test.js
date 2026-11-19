// Reglas que dependen del consentimiento (v2.9, T2.8 del plan de historia clínica; RF-27, D2 y D12).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { iniciar, cerrar, llamar, llamarFormulario, token, sql, sqlMantenimiento, conDeclaracion } = require('../utilidades/api');

const { filtrarParaExportacion } = require(path.join(__dirname, '..', '..', 'backend', 'utils', 'reglasConsentimiento'));
const PRE = 'ZZ reglas ';
const T = {};
const ids = {};
const PDF = Buffer.from('%PDF-1.4\n% consentimiento\n%%EOF\n');
const documento = () => `5${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
const nacidoHace = (anios) => { const d = new Date(); d.setFullYear(d.getFullYear() - anios); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); };

function firmar(jugador_id, tipo, extra = {}) {
  const f = new FormData();
  f.append('archivo', new Blob([PDF], { type: 'application/pdf' }), 'papel.pdf');
  for (const [k, v] of Object.entries({ jugador_id, tipo, estado: 'firmado', ...extra })) f.append(k, String(v));
  return llamarFormulario('/api/consentimientos', T.salud, f);
}
const regla = (valor) => llamar('PUT', '/api/auditoria/ajustes', T.administrador, { exigir_consentimiento_atencion: valor });
async function nuevo(nombre, extra = {}) {
  const r = await llamar('POST', '/api/jugadores', T.entrenador, conDeclaracion({ nombre: `${PRE}${nombre}`, tipo_documento: 'CC', numero_documento: documento(), ...extra }));
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  return r.datos.id;
}

test.before(async () => {
  await iniciar();
  for (const rol of ['administrador', 'entrenador', 'salud']) T[rol] = await token(rol);
});
test.after(async () => {
  try {
    await regla(false);
    const usados = `SELECT id FROM jugadores WHERE nombre LIKE '${PRE}%'`;
    await sqlMantenimiento(`DELETE FROM valoraciones WHERE jugador_id IN (${usados})`);
    await sqlMantenimiento(`DELETE FROM consentimientos WHERE jugador_id IN (${usados})`);
    await sqlMantenimiento(`DELETE FROM archivos_clinicos WHERE jugador_id IN (${usados})`);
    await sqlMantenimiento(`DELETE FROM aceptaciones WHERE jugador_id IN (${usados})`);
    await sqlMantenimiento(`DELETE FROM jugadores WHERE nombre LIKE '${PRE}%'`);
  } finally {
    await cerrar(__filename);
  }
});

test('CP-CON-007 [RF-27] Con la regla D2 encendida, sin el consentimiento de atención firmado no se inicia una valoración; apagada, sí', async () => {
  ids.atencion = await nuevo('atencion');
  const valorar = () => llamar('POST', '/api/valoraciones', T.salud, { jugador_id: ids.atencion, contenido: { motivo_consulta: `${PRE}control` } });
  // Apagada (como queda hasta que el docente apruebe los formatos): todo sigue igual
  assert.equal((await valorar()).status, 201);
  assert.equal((await llamar('GET', `/api/pacientes/${ids.atencion}`, T.salud)).datos.reglas.exigir_consentimiento_atencion, false);
  // Encendida
  await regla(true);
  const sin = await valorar();
  assert.deepEqual([sin.status, sin.datos.codigo], [409, 'FALTA_CONSENTIMIENTO_ATENCION']);
  assert.match(sin.datos.error, /Falta el consentimiento de atención/);
  assert.equal((await llamar('GET', `/api/pacientes/${ids.atencion}`, T.salud)).datos.reglas.exigir_consentimiento_atencion, true);
  // Firmado, sí; revocado, de nuevo no
  const firma = await firmar(ids.atencion, 'atencion');
  assert.equal(firma.status, 201);
  assert.equal((await valorar()).status, 201);
  await llamar('POST', `/api/consentimientos/${firma.datos.registro.id}/revocar`, T.salud, { motivo: 'Cambio de opinión' });
  assert.equal((await valorar()).status, 409);
  await regla(false);
  assert.equal((await valorar()).status, 201);
});

test('CP-CON-008 [RF-27] Sin la autorización de datos personales firmada y vigente, el deportista queda fuera de la exportación FHIR', async () => {
  const firmado = await nuevo('fhir firmado');
  const rechazo = await nuevo('fhir rechazo');
  const sinNada = await nuevo('fhir sin registro');
  const revocado = await nuevo('fhir revocado');
  await firmar(firmado, 'datos_personales');
  await llamar('POST', '/api/consentimientos', T.salud, { jugador_id: rechazo, tipo: 'datos_personales', estado: 'rechazado' });
  const r = await firmar(revocado, 'datos_personales');
  await llamar('POST', `/api/consentimientos/${r.datos.registro.id}/revocar`, T.salud, { motivo: 'Ya no autoriza' });
  // Con el de investigación firmado tampoco basta: se necesita el de datos personales
  await firmar(sinNada, 'investigacion');
  assert.deepEqual(await filtrarParaExportacion([firmado, rechazo, sinNada, revocado], 'fhir'), [firmado]);
});

test('CP-CON-009 [RF-27] Sin el consentimiento de investigación (y, si es menor, sin su asentimiento) queda fuera de la exportación para investigación', async () => {
  const mayor = await nuevo('inv mayor');
  const menorSi = await nuevo('inv menor si', { tipo_documento: 'TI', fecha_nacimiento: nacidoHace(15), acudiente_nombre: 'ZZ Acudiente', acudiente_telefono: '3000000077' });
  const menorNo = await nuevo('inv menor no', { tipo_documento: 'TI', fecha_nacimiento: nacidoHace(15), acudiente_nombre: 'ZZ Acudiente', acudiente_telefono: '3000000078' });
  const rechazo = await nuevo('inv rechazo');
  const acudiente = { firmante_nombre: 'ZZ Acudiente', firmante_tipo_documento: 'CC', firmante_numero_documento: '70000000' };
  assert.equal((await firmar(mayor, 'investigacion')).status, 201);
  assert.equal((await firmar(menorSi, 'investigacion', { ...acudiente, asentimiento: 'si' })).status, 201);
  assert.equal((await firmar(menorNo, 'investigacion', { ...acudiente, asentimiento: 'no' })).status, 201);
  await llamar('POST', '/api/consentimientos', T.salud, { jugador_id: rechazo, tipo: 'investigacion', estado: 'rechazado' });
  assert.deepEqual((await filtrarParaExportacion([mayor, menorSi, menorNo, rechazo], 'investigacion')).sort(), [mayor, menorSi].sort());
  // Ninguno firmó la autorización de datos: nadie sale en FHIR
  assert.deepEqual(await filtrarParaExportacion([mayor, menorSi], 'fhir'), []);
  // Un fin que no existe no exporta a nadie
  assert.deepEqual(await filtrarParaExportacion([mayor], 'otro'), []);
});

test('CP-CON-010 [RF-27][RF-32] Los datos de demostración traen consentimientos y aceptaciones en distintos estados, con su papel, sin repetirse', async () => {
  const fs = require('fs');
  const pool = require(path.join(__dirname, '..', '..', 'backend', 'config', 'db'));
  const { CLINICO_DIR } = require(path.join(__dirname, '..', '..', 'backend', 'config', 'archivos'));
  const { completarConsentimientos, EQUIPO } = require(path.join(__dirname, '..', '..', 'backend', 'config', 'datos_demo'));
  const c = await pool.connect();
  const antes = process.env.DEMO_SIN_CONSENTIMIENTOS;
  delete process.env.DEMO_SIN_CONSENTIMIENTOS; // en la base de pruebas el plantel empieza sin consentimientos
  try {
    await c.query('BEGIN');
    const { rows: [eq] } = await c.query('SELECT id FROM equipos WHERE nombre = $1', [EQUIPO]);
    assert.equal(await completarConsentimientos(c, eq.id), 10);
    assert.equal(await completarConsentimientos(c, eq.id), 0, 'no se repite');
    const { rows } = await c.query(
      `SELECT DISTINCT ON (j.dorsal, c.tipo) j.dorsal, c.tipo, c.estado, c.asentimiento, c.firma_quien, a.nombre_archivo
         FROM consentimientos c JOIN jugadores j ON j.id = c.jugador_id LEFT JOIN archivos_clinicos a ON a.id = c.archivo_id
        WHERE j.equipo_id = $1 ORDER BY j.dorsal, c.tipo, c.registrado_en DESC, c.id DESC`, [eq.id]);
    const de = (dorsal, tipo) => rows.find(r => r.dorsal === dorsal && r.tipo === tipo);
    assert.equal(de(10, 'atencion').estado, 'revocado');
    assert.equal(de(9, 'investigacion').estado, 'rechazado');
    assert.deepEqual([de(23, 'atencion').firma_quien, de(23, 'atencion').asentimiento, de(23, 'investigacion').asentimiento], ['acudiente', true, false]);
    assert.ok(fs.existsSync(path.join(CLINICO_DIR, de(2, 'atencion').nombre_archivo)), 'el papel de demostración existe');
    const { rows: acept } = await c.query(
      `SELECT j.dorsal, a.via FROM aceptaciones a JOIN jugadores j ON j.id = a.jugador_id WHERE j.equipo_id = $1 AND a.via <> 'cuenta' ORDER BY j.dorsal`, [eq.id]); // la cuenta de prueba (#9) acepta por su lado
    assert.deepEqual(acept.map(a => [a.dorsal, a.via]), [[2, 'papel'], [9, 'papel'], [15, 'tableta']]);
  } finally {
    // El ROLLBACK deshace las filas; los PDF de demostración se borran a mano para no dejar huérfanos
    const { rows: papeles } = await c.query(
      `SELECT nombre_archivo FROM archivos_clinicos WHERE descripcion LIKE 'Consentimiento de demostración%'`).catch(() => ({ rows: [] }));
    for (const p of papeles) await fs.promises.rm(path.join(CLINICO_DIR, p.nombre_archivo), { force: true });
    await c.query('ROLLBACK');
    c.release();
    process.env.DEMO_SIN_CONSENTIMIENTOS = antes;
  }
});
