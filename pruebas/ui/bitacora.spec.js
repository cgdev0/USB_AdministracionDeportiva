// Bitácora de accesos en el navegador (v2.7, T0.6 del plan de historia clínica; RF-31, RNF-04).
// Salud la consulta desde la tableta por deportista; el administrador, desde el computador, la vista general.
const { test, expect } = require('@playwright/test');
const { paginaEn, entrar, desborde } = require('./ayuda');

test('CP-UI-HC-006 [RF-31][RNF-04] Salud (tableta) ve los accesos a una historia y el administrador (computador) la bitácora general', async ({ browser }) => {
  const tableta = await paginaEn(browser, 'tableta');
  await entrar(tableta, 'salud');
  await tableta.goto('/salud');
  const opcion = tableta.locator('#val-jugador option', { hasText: 'Mateo Carrillo' });
  await tableta.locator('#val-jugador').selectOption(await opcion.getAttribute('value'));
  await tableta.getByRole('button', { name: 'Accesos a esta historia' }).click();
  const hoja = tableta.locator('.modal-box').first();
  await expect(hoja.getByRole('heading', { name: /Accesos a la historia de Mateo Carrillo/ })).toBeVisible();
  // Elegir al deportista ya consultó sus valoraciones: queda registrado con nombre y rol
  await expect(hoja.locator('.bitacora-lista li').first()).toContainText('Personal Salud (Personal de salud) consultó las valoraciones');
  expect(await desborde(tableta)).toBeLessThanOrEqual(0);
  await tableta.context().close();

  const pc = await paginaEn(browser, 'pc');
  await entrar(pc, 'administrador');
  await pc.goto('/usuarios');
  await pc.getByRole('button', { name: 'Bitácora clínica' }).click();
  const general = pc.locator('.modal-box').first();
  await expect(general.locator('.bitacora-lista li', { hasText: 'Mateo Carrillo' }).first()).toBeVisible();
  await general.getByLabel('Acción').selectOption('listar');
  await expect(general.locator('.bitacora-lista li').first()).toContainText('consultó');
  await general.getByLabel('Buscar por persona o deportista').fill('Mateo');
  await expect(general.locator('.bitacora-lista li').first()).toContainText('Mateo Carrillo');
  await pc.context().close();
});
