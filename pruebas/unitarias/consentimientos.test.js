// Reglas de los consentimientos (v2.9, T2.1 del plan de historia clínica; RF-27).
// Las mismas funciones que usan la pantalla y la API (frontend/src/utils/consentimientos.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const cargar = () => import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'consentimientos.js')).href);
const HOY = '2026-11-18';
const MAYOR = { nombre: 'Mateo Carrillo', tipo_documento: 'CC', numero_documento: '1090000015', fecha_nacimiento: '2001-05-02' };
const MENOR = { nombre: 'Tomás Ibarra', tipo_documento: 'TI', numero_documento: '1090000023', fecha_nacimiento: '2009-09-18',
  acudiente_nombre: 'María Ibarra', acudiente_tipo_documento: 'CC', acudiente_numero_documento: '60000000', acudiente_parentesco: 'Madre' };

test('CP-UNI-026 [RF-27] Firmado solo con el papel; el mayor de edad firma con su nombre y su documento', async () => {
  const { validarConsentimiento, MENSAJES, VERSION_FORMATO } = await cargar();
  const datos = { tipo: 'atencion', estado: 'firmado' };
  assert.deepEqual(validarConsentimiento(datos, MAYOR, HOY), { ok: false, error: MENSAJES.archivo });
  const r = validarConsentimiento(datos, MAYOR, HOY, { conArchivo: true });
  assert.equal(r.ok, true);
  assert.deepEqual(
    [r.registro.firma_quien, r.registro.firmante_nombre, r.registro.firmante_numero_documento, r.registro.asentimiento, r.registro.fecha, r.registro.version_formato],
    ['deportista', 'Mateo Carrillo', '1090000015', null, HOY, VERSION_FORMATO]);
  // Sin documento no hay con qué identificar al firmante
  assert.equal(validarConsentimiento(datos, { ...MAYOR, numero_documento: null }, HOY, { conArchivo: true }).error, MENSAJES.documentoDeportista);
  // El rechazo no necesita papel
  assert.equal(validarConsentimiento({ tipo: 'investigacion', estado: 'rechazado', motivo: 'No desea participar' }, MAYOR, HOY).ok, true);
});

test('CP-UNI-027 [RF-27] Si es menor de edad, firma el acudiente y se registra el asentimiento', async () => {
  const { validarConsentimiento, MENSAJES } = await cargar();
  const firmar = (extra) => validarConsentimiento({ tipo: 'atencion', estado: 'firmado', ...extra }, MENOR, HOY, { conArchivo: true });
  assert.equal(firmar({ firma_quien: 'deportista', asentimiento: 'si' }).error, MENSAJES.firmaMenor);
  assert.equal(firmar({}).error, MENSAJES.asentimiento, 'el asentimiento es obligatorio al firmar');
  // Por defecto firma el acudiente registrado en la identificación
  const r = firmar({ asentimiento: 'si' });
  assert.deepEqual([r.registro.firma_quien, r.registro.firmante_nombre, r.registro.firmante_numero_documento, r.registro.firmante_parentesco, r.registro.asentimiento],
    ['acudiente', 'María Ibarra', '60000000', 'Madre', true]);
  // Otro acudiente distinto del registrado, con su documento (con puntos) y el "no" del menor
  const otro = firmar({ firmante_nombre: 'Jorge Ibarra', firmante_tipo_documento: 'CC', firmante_numero_documento: '88.123.456', firmante_parentesco: 'Padre', asentimiento: 'no' });
  assert.deepEqual([otro.registro.firmante_nombre, otro.registro.firmante_numero_documento, otro.registro.asentimiento], ['Jorge Ibarra', '88123456', false]);
  // Sin acudiente registrado hay que escribirlo
  const sinAcudiente = { ...MENOR, acudiente_nombre: null, acudiente_tipo_documento: null, acudiente_numero_documento: null };
  assert.equal(validarConsentimiento({ tipo: 'atencion', estado: 'firmado', asentimiento: true }, sinAcudiente, HOY, { conArchivo: true }).error, MENSAJES.firmanteNombre);
  assert.match(validarConsentimiento({ tipo: 'atencion', estado: 'firmado', asentimiento: true, firmante_nombre: 'Jorge' }, sinAcudiente, HOY, { conArchivo: true }).error, /documento del acudiente/);
  // Un rechazo del acudiente no exige el asentimiento
  assert.equal(validarConsentimiento({ tipo: 'investigacion', estado: 'rechazado' }, MENOR, HOY).ok, true);
});

test('CP-UNI-028 [RF-27] Datos inválidos: asentimiento de un mayor, fechas, tipo y estado', async () => {
  const { validarConsentimiento, MENSAJES } = await cargar();
  const v = (datos, jugador = MAYOR) => validarConsentimiento({ tipo: 'atencion', estado: 'firmado', ...datos }, jugador, HOY, { conArchivo: true }).error;
  assert.equal(v({ asentimiento: true }), MENSAJES.asentimientoMayor);
  assert.equal(v({ fecha: '2026-11-19' }), MENSAJES.fechaFutura);
  assert.equal(v({ fecha: '18/11/2026' }), MENSAJES.fecha);
  assert.equal(v({ tipo: 'cirugia' }), MENSAJES.tipo);
  assert.equal(v({ estado: 'revocado' }), MENSAJES.estado, 'revocar tiene su propia acción');
  assert.equal(v({ estado: 'pendiente' }), MENSAJES.estado, 'pendiente es no tener registro');
  assert.equal(v({ motivo: 'x'.repeat(501) }), MENSAJES.motivoLargo);
  assert.equal(validarConsentimiento({ tipo: 'atencion', estado: 'firmado', fecha: '2026-11-01' }, MAYOR, HOY, { conArchivo: true }).registro.fecha, '2026-11-01');
});

test('CP-UNI-029 [RF-27] Revocar: solo lo firmado, con motivo y sin fecha anterior a la firma', async () => {
  const { validarRevocacion, MENSAJES } = await cargar();
  const firmado = { id: 7, tipo: 'atencion', estado: 'firmado', fecha: '2026-11-10' };
  assert.equal(validarRevocacion({ motivo: 'Ya no desea atención' }, { ...firmado, estado: 'rechazado' }, HOY).error, MENSAJES.revocarSoloFirmado);
  assert.equal(validarRevocacion({ motivo: '  ' }, firmado, HOY).error, MENSAJES.motivoRevocar);
  assert.equal(validarRevocacion({ motivo: 'Cambio de opinión', fecha: '2026-11-09' }, firmado, HOY).error, MENSAJES.fechaAntesDeFirma);
  assert.deepEqual(validarRevocacion({ motivo: 'Cambio de opinión' }, firmado, HOY).registro,
    { tipo: 'atencion', estado: 'revocado', fecha: HOY, motivo: 'Cambio de opinión', revoca_id: 7 });
});

test('CP-UNI-030 [RF-27] El estado de cada tipo es su último registro, y el de investigación de un menor exige su asentimiento', async () => {
  const { estadoActual, autoriza } = await cargar();
  const vacio = estadoActual([]);
  assert.deepEqual(Object.values(vacio).map(c => c.estado), ['pendiente', 'pendiente', 'pendiente']);
  // Del más reciente al más antiguo
  const historial = [
    { id: 3, tipo: 'atencion', estado: 'revocado' },
    { id: 2, tipo: 'investigacion', estado: 'firmado', asentimiento: false },
    { id: 1, tipo: 'atencion', estado: 'firmado' },
  ];
  const actual = estadoActual(historial);
  assert.deepEqual([actual.atencion.id, actual.atencion.estado, actual.datos_personales.estado], [3, 'revocado', 'pendiente']);
  assert.equal(autoriza(actual.atencion), false, 'revocado ya no autoriza');
  assert.equal(autoriza(actual.investigacion), false, 'sin el asentimiento del menor, la investigación no queda autorizada');
  assert.equal(autoriza({ tipo: 'investigacion', estado: 'firmado', asentimiento: null }), true, 'mayor de edad');
  assert.equal(autoriza(estadoActual([historial[2]]).atencion), true);
});

test('CP-UNI-033 [RF-27] Para salir en una exportación: FHIR con la autorización de datos; investigación con su consentimiento y el asentimiento del menor', async () => {
  const { estadoActual, exportable } = await cargar();
  const firmados = estadoActual([
    { id: 2, tipo: 'investigacion', estado: 'firmado', asentimiento: null },
    { id: 1, tipo: 'datos_personales', estado: 'firmado' },
  ]);
  assert.deepEqual([exportable(firmados, 'fhir'), exportable(firmados, 'investigacion'), exportable(firmados, 'otro')], [true, true, false]);
  const menorSinAsentimiento = estadoActual([{ id: 3, tipo: 'investigacion', estado: 'firmado', asentimiento: false }]);
  assert.equal(exportable(menorSinAsentimiento, 'investigacion'), false);
  assert.equal(exportable(estadoActual([]), 'fhir'), false, 'sin registro, pendiente');
  assert.equal(exportable(estadoActual([{ id: 4, tipo: 'datos_personales', estado: 'revocado' }]), 'fhir'), false);
});
