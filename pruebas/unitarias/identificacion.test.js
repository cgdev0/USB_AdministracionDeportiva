// Pruebas unitarias de las reglas de identificación del deportista (v2.7, T0.1 del plan de historia clínica).
// El mismo archivo (frontend/src/utils/identificacion.js) lo usan los formularios y la API.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const RAIZ = path.resolve(__dirname, '..', '..');
const modulo = import(pathToFileURL(path.join(RAIZ, 'frontend', 'src', 'utils', 'identificacion.js')).href);

test('CP-UNI-021 [RF-25] Documento: tipos del RDA, solo dígitos en CC/TI/RC y limpieza de puntos y espacios', async () => {
  const { normalizarDocumento, TIPOS_DOCUMENTO } = await modulo;
  assert.deepEqual(TIPOS_DOCUMENTO.map(t => t.codigo), ['CC', 'TI', 'RC', 'CE', 'PA', 'PPT', 'PE']);
  assert.deepEqual(normalizarDocumento('cc', '1.090.123.456'), { ok: true, tipo: 'CC', numero: '1090123456' });
  assert.deepEqual(normalizarDocumento('PA', 'ab 12-3456'), { ok: true, tipo: 'PA', numero: 'AB123456' });
  assert.deepEqual(normalizarDocumento('', ''), { ok: true, tipo: null, numero: null }, 'el documento se puede dejar para después');
  assert.equal(normalizarDocumento('CC', 'AB123').ok, false, 'la cédula solo lleva dígitos');
  assert.equal(normalizarDocumento('TI', '12').ok, false, 'muy corto');
  assert.equal(normalizarDocumento('CC', '').ok, false, 'tipo sin número');
  assert.equal(normalizarDocumento('', '1090').ok, false, 'número sin tipo');
  assert.equal(normalizarDocumento('XX', '1090').ok, false, 'tipo que no existe');
});

test('CP-UNI-022 [RF-25] Menor de edad: se calcula con la fecha de nacimiento o, si no hay, con la edad registrada', async () => {
  const { esMenorDeEdad, faltaAcudiente, edadCumplida } = await modulo;
  const hoy = '2026-11-17';
  assert.equal(edadCumplida('2008-11-17', hoy), 18, 'cumple 18 hoy');
  assert.equal(edadCumplida('2008-11-18', hoy), 17, 'cumple 18 mañana');
  assert.equal(esMenorDeEdad({ fecha_nacimiento: '2008-11-18' }, hoy), true);
  assert.equal(esMenorDeEdad({ fecha_nacimiento: '2008-11-17' }, hoy), false);
  assert.equal(esMenorDeEdad({ edad: 16 }, hoy), true, 'sin fecha usa la edad');
  assert.equal(esMenorDeEdad({ fecha_nacimiento: '2000-01-01', edad: 16 }, hoy), false, 'la fecha manda sobre la edad');
  assert.equal(esMenorDeEdad({}, hoy), false, 'sin datos no se asume menor');
  assert.equal(faltaAcudiente({ edad: 16, acudiente_nombre: 'Ana' }, hoy), true, 'falta el teléfono');
  assert.equal(faltaAcudiente({ edad: 16, acudiente_nombre: 'Ana', acudiente_telefono: '3000000000' }, hoy), false);
  assert.equal(faltaAcudiente({ edad: 22 }, hoy), false, 'un adulto no necesita acudiente');
});

test('CP-UNI-023 [RF-25] Solo el personal de salud registra pertenencia étnica y discapacidad (datos sensibles)', async () => {
  const { normalizarIdentificacion } = await modulo;
  const sinPermiso = normalizarIdentificacion({ discapacidad: 'visual' });
  assert.equal(sinPermiso.ok, false);
  assert.equal(sinPermiso.status, 403);
  const salud = normalizarIdentificacion({ discapacidad: 'visual', pertenencia_etnica: 'indigena' }, { sensibles: true });
  assert.deepEqual(salud, { ok: true, cambios: { pertenencia_etnica: 'indigena', discapacidad: 'visual' } });
  assert.equal(normalizarIdentificacion({ discapacidad: 'otra' }, { sensibles: true }).ok, false, 'valor fuera de la lista');
});

test('CP-UNI-024 [RF-25] Identificación por partes: solo cambia lo que llega, con teléfonos, zona y nacionalidad validados', async () => {
  const { normalizarIdentificacion } = await modulo;
  assert.deepEqual(normalizarIdentificacion({ telefono: '(300) 123-4567', zona_residencia: 'Rural', nacionalidad: 've' }),
    { ok: true, cambios: { telefono: '3001234567', zona_residencia: 'rural', nacionalidad: 'VE' } });
  assert.deepEqual(normalizarIdentificacion({ eps: '  ', acudiente_nombre: '' }), { ok: true, cambios: { eps: null, acudiente_nombre: null } },
    'un campo vacío se borra');
  assert.equal(normalizarIdentificacion({ telefono: '123' }).ok, false, 'teléfono muy corto');
  assert.equal(normalizarIdentificacion({ zona_residencia: 'centro' }).ok, false);
  assert.equal(normalizarIdentificacion({ acudiente_tipo_documento: 'CC' }).ok, false, 'documento del acudiente sin número');
  assert.equal(normalizarIdentificacion({ eps: 'x'.repeat(101) }).ok, false, 'texto demasiado largo');
  assert.deepEqual(normalizarIdentificacion({}), { ok: true, cambios: {} });
});

// ── T0.2: datos de quien atiende (frontend/src/utils/profesionales.js) ──
const profesionales = import(pathToFileURL(path.join(RAIZ, 'frontend', 'src', 'utils', 'profesionales.js')).href);

test('CP-UNI-025 [RF-26] Quien atiende: registro profesional opcional y descripción con vínculo y supervisor', async () => {
  const { normalizarDatosProfesionales, descripcionQuienAtiende } = await profesionales;
  // D1: un practicante se registra sin registro profesional
  assert.deepEqual(normalizarDatosProfesionales({ profesion: 'fisioterapia', vinculo: 'practicante', registro_profesional: '', supervisor_id: '' }),
    { ok: true, cambios: { profesion: 'fisioterapia', vinculo: 'practicante', registro_profesional: null, supervisor_id: null } });
  assert.equal(normalizarDatosProfesionales({ vinculo: 'docente' }).ok, false);
  assert.equal(normalizarDatosProfesionales({ profesion: 'odontologia' }).ok, false);
  assert.equal(normalizarDatosProfesionales({ registro_profesional: 'R' }).ok, false, 'registro muy corto');
  assert.equal(normalizarDatosProfesionales({ supervisor_id: 'abc' }).ok, false);
  assert.deepEqual(normalizarDatosProfesionales({ supervisor_id: '7' }), { ok: true, cambios: { supervisor_id: 7 } });

  assert.equal(descripcionQuienAtiende({ profesion: 'fisioterapia', vinculo: 'practicante', supervisor_nombre: 'Ana Ruiz' }),
    'Practicante de fisioterapia · Supervisa: Ana Ruiz');
  assert.equal(descripcionQuienAtiende({ profesion: 'fisioterapia', vinculo: 'profesional', registro_profesional: '12345' }),
    'Fisioterapeuta · Registro 12345');
  assert.equal(descripcionQuienAtiende({ profesion: 'nutricion', vinculo: 'estudiante' }), 'Estudiante de nutrición y dietética');
  assert.equal(descripcionQuienAtiende({ profesion: 'otra', vinculo: 'practicante' }), 'Practicante del área de salud');
  assert.equal(descripcionQuienAtiende({}), 'Personal de salud', 'sin datos todavía');
});
