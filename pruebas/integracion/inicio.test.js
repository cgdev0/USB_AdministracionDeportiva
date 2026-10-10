// Pantalla de inicio: datos y alcance por rol (RF-18, RF-05)
// Usa el plantel de demostración (23 jugadores del entrenador, 3 lesionados, 2 con restricciones).
const test = require('node:test');
const assert = require('node:assert/strict');
const { iniciar, cerrar, llamar, token } = require('../utilidades/api');

const datos = {};
test.before(async () => {
  await iniciar();
  for (const rol of ['administrador', 'head_coach', 'entrenador', 'salud', 'jugador']) {
    const r = await llamar('GET', '/api/dashboard/inicio', await token(rol));
    assert.equal(r.status, 200, `${rol}: ${JSON.stringify(r.datos)}`);
    datos[rol] = r.datos;
  }
});
test.after(() => cerrar(__filename));

test('CP-INI-001 [RF-18] Disponibilidad del entrenador: 18 disponibles, 2 con restricciones y 3 no disponibles', () => {
  assert.deepEqual(datos.entrenador.resumen, { total: 23, disponibles: 18, restringidos: 2, no_disponibles: 3 });
});

test('CP-INI-002 [RF-18] Cada jugador tiene un estado coherente con su motivo', () => {
  for (const j of datos.entrenador.plantel) {
    if (j.estado === 'disponible') assert.equal(j.motivo, null, j.nombre);
    else assert.ok(j.motivo, `${j.nombre} debe explicar su estado`);
  }
});

test('CP-INI-003 [RF-18] Próximo partido y agenda de los próximos 7 días', () => {
  const d = datos.entrenador;
  assert.equal(d.proximo_partido.rival, 'Deportivo Sur');
  assert.equal(d.semana.length, 4);
  assert.equal(d.semana[0].clase, 'partido', 'el partido de mañana va primero');
});

test('CP-INI-004 [RF-18] Asistencia: 4 sesiones con conteos del plantel', () => {
  const a = datos.entrenador.asistencia;
  assert.equal(a.length, 4);
  assert.ok(a.every(s => s.registrados === 23 && s.presentes <= s.registrados));
});

test('CP-INI-005 [RF-18] Avisos para revisar: lesiones y restricciones del plantel', () => {
  const tipos = datos.entrenador.revisar.map(r => r.tipo);
  assert.equal(tipos.filter(t => t === 'lesion').length, 3);
  assert.equal(tipos.filter(t => t === 'restriccion').length, 2);
  assert.ok(!tipos.includes('control_vencido'), 'el entrenador no ve vencimientos de controles médicos');
});

test('CP-INI-006 [RNF-02] Solo salud y administración ven controles vencidos y antropometría pendiente', () => {
  for (const rol of ['administrador', 'salud']) {
    const tipos = datos[rol].revisar.map(r => r.tipo);
    assert.ok(tipos.includes('control_vencido') && tipos.includes('antropometria'), rol);
  }
});

test('CP-INI-007 [RF-05] El head coach ve el plantel de sus entrenadores', () => {
  assert.equal(datos.head_coach.resumen.total, 23);
});

test('CP-INI-008 [RF-05] El jugador solo se ve a sí mismo', () => {
  assert.equal(datos.jugador.plantel.length, 1);
  assert.equal(datos.jugador.plantel[0].dorsal, 9);
});

test('CP-INI-009 [RF-18] Máximos anotadores ordenados por anotaciones', () => {
  const a = datos.entrenador.anotadores;
  assert.ok(a.length > 0);
  for (let i = 1; i < a.length; i++) assert.ok(a[i - 1].anotaciones >= a[i].anotaciones);
});
