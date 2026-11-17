// Pruebas unitarias de cálculos (exactitud, métrica M-F3) y utilidades de formato.
// Los valores esperados se calcularon a mano con las fórmulas publicadas:
//   % grasa: Yuhasz modificada por Carter (6 pliegues), Faulkner y Durnin-Womersley + Siri
//   masa ósea: Rocha (diámetros biestiloideo y del fémur)   masa residual: Würch (24,1 % / 20,9 %)
//   somatotipo: Heath-Carter
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const RAIZ = path.resolve(__dirname, '..', '..');
const importar = (rel) => import(pathToFileURL(path.join(RAIZ, rel)).href);
const TOLERANCIA = 0.1;
const cerca = (obtenido, esperado, nombre) =>
  assert.ok(Math.abs(obtenido - esperado) <= TOLERANCIA, `${nombre}: obtenido ${obtenido}, esperado ${esperado} ± ${TOLERANCIA}`);

// Deportista de referencia: 80 kg, 1,80 m
const REFERENCIA = {
  peso: 80, estatura: 1.80,
  pliegue_biceps: 4.5, pliegue_triceps: 8, pliegue_subescapular: 9.5, pliegue_suprailiaco: 11,
  pliegue_supraespinal: 7.5, pliegue_abdominal: 12, pliegue_muslo_anterior: 10.5, pliegue_pierna_medial: 7,
  perimetro_brazo_contraido: 35, perimetro_pierna: 37.5,
  diametro_humero: 6.8, diametro_muneca: 5.8, diametro_femur: 9.6,
};

test('CP-UNI-001 [RF-17] IMC = peso / estatura²', async () => {
  const { calculateAnthropometry } = await importar('frontend/src/utils/anthropometry.js');
  cerca(calculateAnthropometry(REFERENCIA).imc, 24.69, 'IMC');
});

test('CP-UNI-002 [RF-17] % de grasa en hombre (Yuhasz, 6 pliegues)', async () => {
  const { calculateAnthropometry } = await importar('frontend/src/utils/anthropometry.js');
  // 0,1051 × 54,5 + 2,585 = 8,31
  cerca(calculateAnthropometry(REFERENCIA, 'masculino').porcentaje_grasa, 8.3, '% grasa');
});

test('CP-UNI-003 [RF-17] % de grasa en mujer (Yuhasz, 6 pliegues)', async () => {
  const { calculateAnthropometry } = await importar('frontend/src/utils/anthropometry.js');
  // 0,1548 × 54,5 + 3,580 = 12,02
  cerca(calculateAnthropometry(REFERENCIA, 'femenino').porcentaje_grasa, 12.0, '% grasa');
});

test('CP-UNI-004 [RF-17] Fraccionamiento en 4 componentes (Rocha, Würch, por diferencia)', async () => {
  const { calculateAnthropometry } = await importar('frontend/src/utils/anthropometry.js');
  const r = calculateAnthropometry(REFERENCIA, 'masculino');
  cerca(r.masa_grasa_kg, 6.64, 'masa grasa');
  // 3,02 × (1,80² × 0,058 × 0,096 × 400)^0,712 = 12,33
  cerca(r.masa_mineral_osea, 12.33, 'masa ósea (Rocha)');
  cerca(r.masa_residual_kg, 19.28, 'masa residual (Würch, 24,1 %)');
  // 80 − (6,64 + 12,33 + 19,28) = 41,75
  cerca(r.masa_muscular_esqueletica, 41.75, 'masa muscular (por diferencia)');
});

test('CP-UNI-005 [RF-17] Somatotipo Heath-Carter y coordenadas de la somatocarta', async () => {
  const { calculateAnthropometry } = await importar('frontend/src/utils/anthropometry.js');
  const r = calculateAnthropometry(REFERENCIA, 'masculino');
  cerca(r.endomorfia, 2.35, 'endomorfia');
  cerca(r.mesomorfia, 4.88, 'mesomorfia');
  cerca(r.ectomorfia, 2.0, 'ectomorfia');
  cerca(r.x_somatocarta, -0.35, 'X = ecto − endo');
  cerca(r.y_somatocarta, 5.41, 'Y = 2·meso − (endo + ecto)');
  cerca(r.sumatoria_pliegues, 70.0, 'suma de 8 pliegues');
});

test('CP-UNI-006 [RF-17] Estatura en centímetros da el mismo resultado que en metros', async () => {
  const { calculateAnthropometry } = await importar('frontend/src/utils/anthropometry.js');
  const enCm = calculateAnthropometry({ ...REFERENCIA, estatura: 180 }, 'masculino');
  cerca(enCm.imc, 24.69, 'IMC con estatura en cm');
  cerca(enCm.endomorfia, 2.35, 'endomorfia con estatura en cm');
});

test('CP-UNI-007 [RF-17] Sin datos no falla y devuelve valores vacíos', async () => {
  const { calculateAnthropometry } = await importar('frontend/src/utils/anthropometry.js');
  const r = calculateAnthropometry({});
  assert.equal(r.imc, null);
  assert.equal(r.porcentaje_grasa, null);
  assert.equal(r.masa_muscular_esqueletica, null);
});

test('CP-UNI-017 [RF-17] DEF-049: la masa ósea de Rocha usa el diámetro de la muñeca, no el del húmero', async () => {
  const { calculateAnthropometry } = await importar('frontend/src/utils/anthropometry.js');
  const otroHumero = calculateAnthropometry({ ...REFERENCIA, diametro_humero: 7.5 }, 'masculino');
  cerca(otroHumero.masa_mineral_osea, 12.33, 'el húmero no cambia la masa ósea');
  const sinMuneca = calculateAnthropometry({ ...REFERENCIA, diametro_muneca: '' }, 'masculino');
  assert.equal(sinMuneca.masa_mineral_osea, null, 'sin muñeca no se estima (antes: 14,5 % del peso)');
  assert.equal(sinMuneca.masa_muscular_esqueletica, null, 'sin masa ósea no hay masa muscular por diferencia');
});

test('CP-UNI-018 [RF-17] DEF-050: sin diámetros o sin brazo contraído no se inventa la mesomorfia', async () => {
  const { calculateAnthropometry } = await importar('frontend/src/utils/anthropometry.js');
  const sinDiametros = calculateAnthropometry({ ...REFERENCIA, diametro_humero: '', diametro_femur: '' }, 'masculino');
  assert.equal(sinDiametros.mesomorfia, null, 'antes usaba 6,8 y 9,5 cm por defecto');
  assert.equal(sinDiametros.x_somatocarta, null, 'sin somatotipo completo no hay punto en la somatocarta');
  cerca(sinDiametros.endomorfia, 2.35, 'la endomorfia sí se calcula');
  const relajado = { ...REFERENCIA, perimetro_brazo_contraido: '', perimetro_brazo_relajado: 33 };
  assert.equal(calculateAnthropometry(relajado, 'masculino').mesomorfia, null, 'el brazo relajado no reemplaza al contraído');
  assert.equal(calculateAnthropometry({ peso: 80, estatura: 1.8 }).endomorfia, null, 'sin pliegues no hay endomorfia (antes: 0,1)');
});

test('CP-UNI-019 [RF-17] DEF-051: % de grasa con pliegues incompletos usa la ecuación que corresponde', async () => {
  const { calculateAnthropometry } = await importar('frontend/src/utils/anthropometry.js');
  // Faltan muslo y pierna: no se suma un Σ6 incompleto; Faulkner = 5,783 + 0,153 × 37 = 11,44
  const faulkner = calculateAnthropometry({ peso: 80, estatura: 1.8, pliegue_triceps: 8, pliegue_subescapular: 9.5, pliegue_supraespinal: 7.5, pliegue_abdominal: 12 });
  cerca(faulkner.porcentaje_grasa, 11.4, 'Faulkner');
  // Solo tríceps, subescapular y supraespinal: la estimación "3 pliegues" sin respaldo ya no existe
  assert.equal(calculateAnthropometry({ pliegue_triceps: 8, pliegue_subescapular: 9.5, pliegue_supraespinal: 7.5 }).porcentaje_grasa, null);
  // Durnin-Womersley (bíceps, tríceps, subescapular, cresta ilíaca = 33 mm) con coeficientes por edad + Siri
  const dw = { pliegue_biceps: 4.5, pliegue_triceps: 8, pliegue_subescapular: 9.5, pliegue_suprailiaco: 11 };
  cerca(calculateAnthropometry(dw, 'masculino', 25).porcentaje_grasa, 13.9, 'hombre de 25 años');
  cerca(calculateAnthropometry(dw, 'masculino', 45).porcentaje_grasa, 18.9, 'hombre de 45 años');
  cerca(calculateAnthropometry(dw, 'masculino').porcentaje_grasa, 15.4, 'hombre, edad desconocida (ecuación general)');
  cerca(calculateAnthropometry(dw, 'femenino', 25).porcentaje_grasa, 21.0, 'mujer de 25 años');
});

test('CP-UNI-020 [RF-17] El backend y la pantalla calculan con la misma fórmula', async () => {
  const { calculateAnthropometry } = await importar('frontend/src/utils/anthropometry.js');
  const { calcularAntropometria } = require(path.join(RAIZ, 'backend/controllers/antropometria.controller.js'));
  const pantalla = calculateAnthropometry(REFERENCIA, 'masculino');
  const servidor = await calcularAntropometria(REFERENCIA, 'masculino');
  for (const campo of ['imc', 'porcentaje_grasa', 'masa_mineral_osea', 'masa_muscular_esqueletica', 'endomorfia', 'mesomorfia', 'ectomorfia', 'x_somatocarta', 'y_somatocarta']) {
    assert.equal(servidor[campo], pantalla[campo], campo);
  }
  // Un valor medido directamente por el profesional tiene prioridad sobre el calculado
  cerca((await calcularAntropometria({ ...REFERENCIA, porcentaje_grasa: 10 }, 'masculino')).porcentaje_grasa, 10, '% grasa manual');
});

test('CP-UNI-008 [RF-09] Formato "#dorsal nombre" y orden por dorsal', async () => {
  const { nombreConDorsal, etiquetaJugador, ordenarPorDorsal } = await importar('frontend/src/utils/jugador.js');
  assert.equal(nombreConDorsal('Ana Pérez', 7), '#7 Ana Pérez');
  assert.equal(nombreConDorsal('Ana Pérez', 0), '#0 Ana Pérez', 'el dorsal 0 es válido');
  assert.equal(nombreConDorsal('Ana Pérez', null), 'Ana Pérez');
  assert.equal(etiquetaJugador({ nombre: 'Luis', dorsal: 10 }), '#10 Luis');
  const orden = [{ nombre: 'C', dorsal: null }, { nombre: 'B', dorsal: 10 }, { nombre: 'A', dorsal: 2 }].sort(ordenarPorDorsal);
  assert.deepEqual(orden.map(j => j.nombre), ['A', 'B', 'C'], 'sin dorsal va al final');
});

test('CP-UNI-009 [RF-18] Fechas en español sin desfase de zona horaria', async () => {
  const { fechaLarga, fechaCorta, diaCorto, numeroDia } = await importar('frontend/src/utils/fechas.js');
  assert.equal(fechaLarga('2026-10-11'), 'domingo 11 de octubre');
  assert.equal(fechaCorta('2026-10-11'), '11 de octubre');
  assert.equal(diaCorto('2026-10-14'), 'mié');
  assert.equal(numeroDia('2026-12-01'), 1);
  assert.equal(fechaLarga(null), '');
});
