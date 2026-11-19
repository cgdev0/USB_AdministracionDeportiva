// Módulo de auditoría del administrador en el navegador (v2.9, T2.7 del plan de historia clínica; RF-33, RNF-04).
const path = require('path');
const { test, expect } = require('@playwright/test');
const { paginaEn, entrar, desborde, CUENTAS, declaracion } = require('./ayuda');
const { credenciales, BD_PRUEBAS, RAIZ } = require('../utilidades/bd');
const { Client } = require(path.join(RAIZ, 'node_modules', 'pg'));

const PRE = 'ZZ UI auditoria';
async function sql(texto, params) {
  const c = new Client(credenciales(BD_PRUEBAS));
  await c.connect();
  try { return await c.query(texto, params); } finally { await c.end(); }
}

test.beforeAll(async ({ playwright }) => {
  const req = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  const [email, password] = CUENTAS.administrador;
  const { access_token } = await (await req.post('/api/auth/login', { data: { email, password } })).json();
  const headers = { Authorization: `Bearer ${access_token}` };
  expect((await req.post('/api/usuarios', { headers, data: { nombre: `${PRE} cuenta`, email: 'zz.ui.auditoria@test.com', password: 'Prueba.2026!Aud', rol: 'entrenador' } })).status()).toBe(201);
  const carga = await req.post('/api/jugadores/bulk', { headers, data: { deportistas: [{ nombre: `${PRE} cargado`, deporte: 'Rugby' }],
    archivo: { nombre: 'zz-ui-auditoria.csv', sha256: 'b'.repeat(64) }, declaracion: await declaracion('carga') } });
  expect(carga.status()).toBe(201);
  await req.dispose();
});
test.afterAll(async () => {
  await sql(`DO $$ BEGIN PERFORM set_config('dt.mantenimiento', 'on', true);
    DELETE FROM aceptaciones WHERE jugador_id IN (SELECT id FROM jugadores WHERE nombre LIKE '${PRE}%')
      OR carga_id IN (SELECT id FROM cargas_masivas WHERE archivo_nombre = 'zz-ui-auditoria.csv');
    DELETE FROM cargas_masivas WHERE archivo_nombre = 'zz-ui-auditoria.csv';
    DELETE FROM jugadores WHERE nombre LIKE '${PRE}%';
    DELETE FROM usuarios WHERE email = 'zz.ui.auditoria@test.com';
    UPDATE ajustes SET valor = 'false'::jsonb WHERE clave = 'exigir_consentimiento_atencion'; END $$`);
});

test('CP-UI-AUD-001 [RF-33][RNF-04] El administrador revisa la actividad, las cargas, los pendientes y los ajustes; nadie más entra', async ({ browser }) => {
  const page = await paginaEn(browser, 'pc');
  await entrar(page, 'administrador');
  await page.goto('/');
  await page.getByRole('link', { name: 'Auditoría' }).first().click();
  await expect(page.getByRole('heading', { name: 'Auditoría' })).toBeVisible();

  // Actividad, con filtros
  const lista = page.locator('.aud-lista');
  await expect(lista).toContainText(`creó la cuenta de ${PRE} cuenta (Entrenador)`);
  await page.getByLabel('Acción').selectOption('importar');
  await expect(lista).toContainText('cargó zz-ui-auditoria.csv (deportistas): 1 creados, 0 rechazados');
  await expect(lista).not.toContainText('creó la cuenta de');
  // Exportar
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  expect((await descarga).suggestedFilename()).toBe('auditoria-eventos.csv');

  // Cargas masivas: el detalle
  await page.getByRole('tab', { name: 'Cargas masivas' }).click();
  await page.getByRole('button', { name: 'Ver la carga zz-ui-auditoria.csv' }).click();
  const detalle = page.getByRole('dialog', { name: 'Carga masiva: zz-ui-auditoria.csv' });
  await expect(detalle).toContainText(`${PRE} cargado`);
  await expect(detalle).toContainText('b'.repeat(64));
  await expect(detalle).toContainText('Aceptada por');
  await page.keyboard.press('Escape');

  // Pendientes y aceptaciones
  await page.getByRole('tab', { name: 'Pendientes' }).click();
  await expect(page.locator('.aud-pendientes')).toContainText(`${PRE} cuenta`);
  await expect(page.locator('.aud-pendientes')).toContainText(`${PRE} cargado`);
  await page.getByRole('tab', { name: 'Aceptaciones' }).click();
  await expect(lista).toContainText('aceptó la declaración de una carga en una carga masiva');
  await page.getByRole('tab', { name: 'Historia clínica' }).click();
  await expect(page.getByText(/Cada vez que alguien consulta, registra, cambia o descarga un dato clínico/)).toBeVisible();

  // Ajuste de la regla D2: apagado; se enciende con confirmación y queda registrado
  await page.getByRole('tab', { name: 'Ajustes' }).click();
  const ajuste = page.locator('.aud-ajustes > li').first();
  await expect(ajuste).toContainText('Apagado');
  await ajuste.getByRole('button', { name: 'Encender' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, encender' }).click();
  await expect(ajuste).toContainText('Encendido');
  await ajuste.getByRole('button', { name: 'Apagar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, apagar' }).click();
  await expect(ajuste).toContainText('Apagado');
  await page.getByRole('tab', { name: 'Actividad' }).click();
  await page.getByLabel('Acción').selectOption('ajuste');
  await expect(lista).toContainText('encendido → apagado');
  await page.context().close();

  // En el celular de 360 px, sin desplazamiento lateral
  const cel = await paginaEn(browser, 'celular360');
  await entrar(cel, 'administrador');
  await cel.goto('/auditoria');
  await expect(cel.locator('.aud-lista')).toBeVisible();
  expect(await desborde(cel)).toBeLessThanOrEqual(0);
  await cel.context().close();

  // Nadie más entra; y el personal de salud tiene Pacientes en el menú lateral (DEF-062)
  const salud = await paginaEn(browser, 'pc');
  await entrar(salud, 'salud');
  await salud.goto('/auditoria');
  await expect(salud).toHaveURL(/\/$/);
  await expect(salud.locator('nav').getByRole('link', { name: 'Pacientes' }).first()).toBeVisible();
  await salud.context().close();
});
