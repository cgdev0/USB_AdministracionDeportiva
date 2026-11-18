// Lista de pacientes del personal de salud (v2.8, T1.3 del plan de historia clínica; RF-26, RNF-02).
const test = require('node:test');
const assert = require('node:assert/strict');
const { iniciar, cerrar, llamar, token, sql, sqlMantenimiento } = require('../utilidades/api');

const MARCA = 'ZZ paciente';
const T = {};

test.before(async () => {
  await iniciar();
  for (const rol of ['administrador', 'entrenador', 'head_coach', 'salud', 'jugador']) T[rol] = await token(rol);
});
test.after(async () => {
  await sqlMantenimiento(`DELETE FROM archivos_clinicos WHERE descripcion LIKE '${MARCA}%'`);
  await sqlMantenimiento(`DELETE FROM antropometria WHERE peso = 82.5 AND porcentaje_grasa = 14.2`);
  await sqlMantenimiento(`DELETE FROM valoraciones WHERE contenido->>'motivo_consulta' LIKE '${MARCA}%'`);
  await sqlMantenimiento(`DELETE FROM jugadores WHERE nombre LIKE '${MARCA}%'`);
  await cerrar(__filename);
});

const lista = async (query = '') => (await llamar('GET', `/api/pacientes${query}`, T.salud)).datos;
// El plantel base (seed) repite algunos nombres del plantel de demostración: se toma el que tiene documento
const de = (filas, nombre) => filas.find(p => p.nombre === nombre && p.numero_documento);

test('CP-HC-019 [RF-26][RNF-02] La lista de pacientes muestra disponibilidad y avisos, solo al personal de salud, y queda en la bitácora', async () => {
  // Una valoración cerrada con alergias y un borrador abierto para Mateo
  const { rows: [{ id: mateo }] } = await sql(`SELECT id FROM jugadores WHERE nombre = 'Mateo Carrillo'`);
  const cerrada = (await llamar('POST', '/api/valoraciones', T.salud, { jugador_id: mateo,
    contenido: { motivo_consulta: `${MARCA} control`, antecedentes: { alergias: 'Penicilina' } } })).datos;
  await llamar('POST', `/api/valoraciones/${cerrada.id}/cerrar`, T.salud, { version: cerrada.version });
  await llamar('POST', '/api/valoraciones', T.salud, { jugador_id: mateo, contenido: { motivo_consulta: `${MARCA} borrador` } });

  const filas = await lista();
  const m = de(filas, 'Mateo Carrillo');
  assert.equal(m.alergias, 'Penicilina', 'alergias de la última valoración cerrada');
  assert.ok(m.borradores >= 1 && m.ultima_valoracion, 'borrador sin cerrar y fecha de la última valoración');
  assert.equal(m.numero_documento, '1090000015');
  // Disponibilidad con la misma regla del inicio (plantel de demostración)
  const pedro = de(filas, 'Pedro Ramírez');
  assert.deepEqual([pedro.disponibilidad, pedro.lesion_activa, pedro.lesion_tipo], ['no_disponible', true, 'Esguince de tobillo']);
  assert.ok(pedro.retorno_estimado);
  assert.deepEqual([de(filas, 'Andrés Contreras').disponibilidad, de(filas, 'Andrés Contreras').restricciones], ['restringido', 'Sin contacto en el scrum por 5 días']);
  assert.equal(de(filas, 'Daniel Rincón').control_vencido, true);
  assert.equal(de(filas, 'Tomás Ibarra').menor, true);
  assert.equal(de(filas, 'Sebastián Peñaranda').disponibilidad, 'disponible');

  // Los retirados solo aparecen si se piden
  const { rows: [r] } = await sql(`INSERT INTO jugadores (nombre, activo) VALUES ('${MARCA} retirado', FALSE) RETURNING id`);
  assert.ok(!(await lista()).some(p => p.id === r.id));
  assert.ok((await lista('?retirados=incluir')).some(p => p.id === r.id && p.activo === false));

  // Solo el personal de salud (información clínica)
  for (const rol of ['administrador', 'entrenador', 'head_coach', 'jugador']) {
    assert.equal((await llamar('GET', '/api/pacientes', T[rol])).status, 403, rol);
  }
  const { rows: [b] } = await sql(`SELECT COUNT(*)::int AS n FROM bitacora_clinica WHERE recurso = 'paciente' AND accion = 'listar' AND usuario_rol = 'personal_salud'`);
  assert.ok(b.n >= 3, 'cada consulta queda en la bitácora');
});

test('CP-HC-020 [RF-26][RF-31][RNF-02] La ficha clínica trae en una sola consulta la identificación, el estado y todos los registros del deportista', async () => {
  const pedro = de(await lista(), 'Pedro Ramírez').id;
  // Registros de cada tipo: valoración cerrada con antecedentes, medición y archivo clínico
  const v = (await llamar('POST', '/api/valoraciones', T.salud, { jugador_id: pedro, tipo: 'post_lesion',
    contenido: { motivo_consulta: `${MARCA} tobillo`, antecedentes: { alergias: 'AINES', cirugias: 'Menisco 2024' } } })).datos;
  await llamar('POST', `/api/valoraciones/${v.id}/cerrar`, T.salud, { version: v.version });
  await sql(`INSERT INTO antropometria (jugador_id, fecha, peso, estatura, imc, porcentaje_grasa) VALUES ($1, CURRENT_DATE, 82.5, 1.78, 26.0, 14.2)`, [pedro]);
  await sql(`INSERT INTO archivos_clinicos (jugador_id, tipo, nombre_archivo, nombre_original, mime, tamano, sha256, descripcion, subido_por)
             SELECT $1, 'examen', 'zz-ficha.pdf', 'resonancia.pdf', 'application/pdf', 1024, repeat('a', 64), '${MARCA} examen', id FROM usuarios WHERE rol = 'personal_salud' LIMIT 1`, [pedro]);

  const r = await llamar('GET', `/api/pacientes/${pedro}`, T.salud);
  assert.equal(r.status, 200);
  const { paciente: p, valoraciones, controles, lesiones, mediciones, archivos } = r.datos;
  // Encabezado: identificación completa (con los datos sensibles, solo para salud) y estado
  assert.equal(p.numero_documento, '1090000002');
  for (const campo of ['eps', 'contacto_emergencia_telefono', 'acudiente_nombre', 'pertenencia_etnica', 'discapacidad']) assert.ok(campo in p, campo);
  assert.deepEqual([p.disponibilidad, p.lesion_tipo, p.alergias], ['no_disponible', 'Esguince de tobillo', 'AINES']);
  assert.match(p.lesion_desde, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(p.antecedentes.cirugias, 'Menisco 2024', 'antecedentes de la última valoración cerrada');
  // Línea de tiempo: cada tipo de registro, con quien atendió
  const val = valoraciones.find(x => x.id === v.id);
  assert.deepEqual([val.estado, val.tipo_nombre], ['cerrada', 'Después de lesión']);
  assert.ok(val.atendio);
  assert.ok(controles.length >= 1 && controles[0].atendio && controles[0].aptitud);
  const esguince = lesiones.find(l => l.tipo === 'Esguince de tobillo');
  assert.equal(esguince.activa, true);
  assert.ok(esguince.seguimientos.length >= 1 && esguince.seguimientos[0].atendio && esguince.seguimientos[0].fecha_retorno_estimada);
  assert.equal(Number(mediciones[0].peso), 82.5);
  assert.deepEqual([archivos[0].nombre_original, archivos[0].tipo], ['resonancia.pdf', 'examen']);
  assert.ok(!('nombre_archivo' in archivos[0]), 'no expone el nombre interno del archivo');

  // Una sola entrada en la bitácora por abrir la ficha
  const { rows: [b] } = await sql(`SELECT COUNT(*)::int AS n FROM bitacora_clinica WHERE recurso = 'paciente' AND accion = 'ver' AND jugador_id = $1`, [pedro]);
  assert.equal(b.n, 1);
  // Inexistente, inválido y roles sin acceso
  assert.equal((await llamar('GET', '/api/pacientes/999999', T.salud)).status, 404);
  assert.equal((await llamar('GET', '/api/pacientes/abc', T.salud)).status, 400);
  for (const rol of ['administrador', 'entrenador', 'head_coach', 'jugador']) {
    assert.equal((await llamar('GET', `/api/pacientes/${pedro}`, T[rol])).status, 403, rol);
  }
});
