// Inicio del personal de salud en el navegador (v2.8, T1.5 del plan de historia clínica; RF-26, RNF-04).
// Entra directo a su trabajo: sus pendientes van primero y cada aviso lleva directamente a su registro.
const path = require('path');
const { test, expect } = require('@playwright/test');
const { paginaEn, entrar, desborde, CUENTAS } = require('./ayuda');
const { credenciales, BD_PRUEBAS, RAIZ } = require('../utilidades/bd');
const { Client } = require(path.join(RAIZ, 'node_modules', 'pg'));

const MOTIVO = 'ZZ UI inicio: dolor lumbar después del gimnasio';

async function sql(texto, params) {
  const c = new Client(credenciales(BD_PRUEBAS));
  await c.connect();
  try { return await c.query(texto, params); } finally { await c.end(); }
}

// Un borrador propio para Mateo Carrillo; el plantel de demostración ya trae lesiones, restricciones y un control vencido
test.beforeAll(async ({ playwright }) => {
  const req = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  const [email, password] = CUENTAS.salud;
  const { access_token } = await (await req.post('/api/auth/login', { data: { email, password } })).json();
  const headers = { Authorization: `Bearer ${access_token}` };
  const mateo = (await (await req.get('/api/pacientes', { headers })).json()).find(p => p.numero_documento === '1090000015').id;
  await req.post('/api/valoraciones', { headers, data: { jugador_id: mateo, contenido: { motivo_consulta: MOTIVO } } });
  await req.dispose();
});
test.afterAll(async () => {
  await sql(`DO $$ BEGIN PERFORM set_config('dt.mantenimiento', 'on', true);
    DELETE FROM valoraciones WHERE contenido->>'motivo_consulta' = '${MOTIVO}'; END $$`);
});

test('CP-UI-SAL-012 [RF-26][RNF-04] Salud entra directo a sus pendientes y cada aviso del inicio lleva a su registro', async ({ browser }) => {
  const page = await paginaEn(browser, 'celular');
  await entrar(page, 'salud');
  await page.goto('/');
  const menu = page.locator('.menu-inferior');
  for (const nombre of ['Inicio', 'Pacientes', 'Lesiones', 'Salud']) await expect(menu.getByRole('link', { name: nombre })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Más' })).toBeVisible();

  // En el celular, los pendientes van antes que todo lo demás
  const pendientes = page.locator('.pendientes-salud');
  await expect(pendientes).toBeVisible();
  const [cajaPendientes, cajaPartido] = await Promise.all([pendientes.boundingBox(), page.locator('.ini-banner').boundingBox()]);
  expect(cajaPendientes.y).toBeLessThan(cajaPartido.y);
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  const ventana = page.locator('.modal-box');
  const volverAlInicio = async () => {
    await ventana.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await menu.getByRole('link', { name: 'Inicio' }).click();
    await expect(pendientes).toBeVisible();
  };

  // 1. Borrador sin cerrar → el borrador abierto en la ficha
  await pendientes.locator('.pend-item').filter({ hasText: 'Mateo Carrillo' }).filter({ hasText: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/pacientes\/\d+$/);
  await expect(ventana).toContainText('Valoración en borrador');
  await expect(ventana.getByLabel('Motivo de consulta')).toHaveValue(MOTIVO);
  await volverAlInicio();

  // 2. Lesión activa → la lesión con sus seguimientos
  await pendientes.locator('.pend-item').filter({ hasText: 'Esguince de tobillo' }).click();
  await expect(ventana).toContainText('Lesión: Esguince de tobillo');
  await expect(ventana).toContainText('Seguimientos');
  await expect(page.getByRole('tab', { name: /Historia/ })).toHaveAttribute('aria-selected', 'true');
  await volverAlInicio();

  // 3. Restricción → el control médico que la puso
  await pendientes.locator('.pend-item').filter({ hasText: 'Sin contacto en el scrum' }).click();
  await expect(ventana).toContainText('Apto con restricciones');
  await expect(ventana).toContainText('Sin contacto en el scrum por 5 días');
  await volverAlInicio();

  // 4. Control vencido → el formulario de control con el deportista ya elegido, listo para escribir
  // (Daniel también aparece en "Consentimientos sin firmar": se toma el de controles)
  await pendientes.locator('.pend-grupo').filter({ hasText: 'Controles médicos' }).locator('.pend-item').filter({ hasText: 'Daniel Rincón' }).click();
  await expect(page).toHaveURL(/\/salud\?jugador=\d+&registrar=control$/);
  const elegido = new URL(page.url()).searchParams.get('jugador');
  await expect(page.locator('#form-control select').first()).toHaveValue(elegido);
  await expect(page.locator('#control-tipo')).toBeFocused();
  await page.context().close();

  // Computador: tocar un dorsal del plantel abre la ficha clínica
  const pc = await paginaEn(browser, 'pc');
  await entrar(pc, 'salud');
  await pc.goto('/');
  await pc.locator('.ini-dorsal.no_disponible').first().click();
  await expect(pc).toHaveURL(/\/pacientes\/\d+$/);
  await expect(pc.locator('.ficha-cabecera h1')).toBeVisible();
  await pc.context().close();

  // El entrenador sigue con "Para revisar", sin los pendientes clínicos
  const entrenador = await paginaEn(browser, 'celular');
  await entrar(entrenador, 'entrenador');
  await entrenador.goto('/');
  await expect(entrenador.getByRole('heading', { name: 'Para revisar' })).toBeVisible();
  await expect(entrenador.locator('.pendientes-salud')).toHaveCount(0);
  await entrenador.context().close();
});
