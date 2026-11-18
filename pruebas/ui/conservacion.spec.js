// Conservación de la historia clínica en el navegador (v2.7, T0.4 del plan de historia clínica; RNF-14, RNF-04).
// Desde el celular: eliminar a un deportista con historia clínica no se permite y se ofrece retirarlo; el retirado
// queda en la pestaña "Retirados" y se puede reactivar.
const path = require('path');
const { test, expect } = require('@playwright/test');
const { paginaEn, entrar, desborde, CUENTAS } = require('./ayuda');
const { credenciales, BD_PRUEBAS, RAIZ } = require('../utilidades/bd');
const { Client } = require(path.join(RAIZ, 'node_modules', 'pg'));

const NOMBRE = 'ZZ UI Con historia';

async function tokenDe(page, rol) {
  const [email, password] = CUENTAS[rol];
  const r = await page.request.post('/api/auth/login', { data: { email, password } });
  return { Authorization: `Bearer ${(await r.json()).access_token}` };
}

test.afterAll(async () => {
  const c = new Client(credenciales(BD_PRUEBAS));
  await c.connect();
  await c.query(`DO $$ BEGIN PERFORM set_config('dt.mantenimiento', 'on', true);
    DELETE FROM jugadores WHERE nombre = '${NOMBRE}'; END $$`);
  await c.end();
});

test('CP-UI-HC-005 [RNF-14][RNF-04] En el celular, un deportista con historia no se elimina: se retira y se reactiva', async ({ browser }) => {
  const page = await paginaEn(browser, 'celular');
  // Deportista del entrenador con un control médico (historia clínica)
  const entrenador = await tokenDe(page, 'entrenador');
  const deportes = await (await page.request.get('/api/disciplinas', { headers: entrenador })).json();
  const rugby = deportes.find(d => d.nombre === 'Rugby').id;
  const creado = await page.request.post('/api/jugadores', { headers: entrenador,
    data: { nombre: NOMBRE, disciplina_id: rugby, tipo_documento: 'CC', numero_documento: `5${String(Date.now()).slice(-9)}` } });
  const { id } = await creado.json();
  await page.request.post('/api/salud/controles', { headers: await tokenDe(page, 'salud'),
    data: { jugador_id: id, tipo: 'Control UI', aptitud: 'apto' } });

  await entrar(page, 'entrenador');
  await page.goto('/jugadores');
  await page.getByPlaceholder('Buscar por nombre, documento, dorsal, posición o equipo').fill(NOMBRE);
  await page.getByRole('button', { name: `Ficha de ${NOMBRE}` }).first().click();
  await page.locator('.modal-box').first().getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('button', { name: 'Sí, Eliminar' }).click();

  // No se borra: se ofrece retirarlo y se explica por qué
  const hoja = page.locator('.modal-box').first();
  await expect(hoja.getByText(/tiene historia clínica y no se puede eliminar/)).toBeVisible();
  await hoja.getByLabel('Motivo (opcional)').fill('Terminó la temporada');
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  await hoja.getByRole('button', { name: 'Retirar del plantel' }).click();
  await expect(page.getByText(`${NOMBRE} salió del plantel. Su historia se conserva.`)).toBeVisible();
  await expect(page.getByRole('button', { name: `Ficha de ${NOMBRE}` })).toHaveCount(0);

  // Está en la pestaña de retirados, con su motivo, y se puede reactivar
  await page.getByRole('button', { name: /^Retirados/ }).click();
  await page.getByRole('button', { name: `Ficha de ${NOMBRE}` }).first().click();
  const ficha = page.locator('.modal-box').first();
  await expect(ficha.getByText(/Retirado .*Terminó la temporada/)).toBeVisible();
  await ficha.getByRole('button', { name: 'Reactivar' }).click();
  await expect(page.getByText(`${NOMBRE} volvió al plantel.`, { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /^Plantel actual/ }).click();
  await expect(page.getByRole('button', { name: `Ficha de ${NOMBRE}` })).toHaveCount(1);
  await page.context().close();
});
