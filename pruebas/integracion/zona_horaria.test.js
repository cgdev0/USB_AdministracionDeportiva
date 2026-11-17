// v2.2 (DEF-045): la app calcula "hoy" y "mañana" en hora de Colombia aunque el servidor esté en UTC
const test = require('node:test');
const assert = require('node:assert/strict');
const { iniciar, cerrar, sql } = require('../utilidades/api');
const { hoyLocal } = require('../../backend/utils/hoy');

test.before(async () => { await iniciar(); });
test.after(async () => { await cerrar(__filename); });

test('CP-ZON-001 [RNF-11] [DEF-045] La base de datos trabaja en la zona horaria de la app (America/Bogota)', async () => {
  const { rows: [r] } = await sql(`SELECT current_setting('TimeZone') AS zona, CURRENT_DATE::text AS hoy`);
  assert.equal(r.zona, 'America/Bogota');
  assert.equal(process.env.TZ, 'America/Bogota');
  assert.equal(r.hoy, hoyLocal(), 'la fecha de hoy coincide entre Node y PostgreSQL');
});

test('CP-ZON-002 [RNF-11] [DEF-045] "Hoy" usa la fecha local y no la UTC (9 p. m. en Colombia sigue siendo el mismo día)', () => {
  // 6 de noviembre 02:00 UTC = 5 de noviembre 9:00 p. m. en Colombia
  assert.equal(hoyLocal(new Date('2026-11-06T02:00:00Z')), '2026-11-05');
  assert.equal(new Date('2026-11-06T02:00:00Z').toISOString().slice(0, 10), '2026-11-06', 'así fallaba antes');
});
