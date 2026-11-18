// Lista de pacientes en el navegador (v2.8, T1.3 del plan de historia clínica; RNF-04, RNF-06).
const { test, expect } = require('@playwright/test');
const { paginaEn, entrar, desborde } = require('./ayuda');

test('CP-UI-SAL-009 [RNF-04][RNF-06] En el celular, salud encuentra a un deportista por su documento en menos de 3 toques; en computador ve la tabla', async ({ browser }) => {
  const page = await paginaEn(browser, 'celular');
  await entrar(page, 'salud');
  await page.goto('/');
  let toques = 0;
  // 1. "Pacientes" está en el menú inferior
  await page.locator('.menu-inferior').getByRole('link', { name: 'Pacientes' }).click(); toques++;
  await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible();
  // 2. Buscar escribiendo el documento con puntos
  const buscar = page.getByLabel('Buscar paciente por nombre, documento o dorsal');
  await buscar.click(); toques++;
  await buscar.fill('1.090.000.015');
  const tarjetas = page.locator('.pacientes-tarjetas > li');
  await expect(tarjetas).toHaveCount(1);
  await expect(tarjetas.first()).toContainText('Mateo Carrillo');
  await expect(tarjetas.first()).toContainText('CC 1090000015');
  expect(toques, 'encontrado en menos de 3 toques').toBeLessThan(3);
  expect(await desborde(page)).toBeLessThanOrEqual(0);

  // Sin importar tildes, y por dorsal
  await buscar.fill('tomas');
  await expect(tarjetas.first()).toContainText('Tomás Ibarra');
  await expect(tarjetas.first()).toContainText('Menor de edad');
  await buscar.fill('#2');
  await expect(tarjetas.first()).toContainText('Pedro Ramírez');
  await expect(tarjetas.first()).toContainText('No disponible');
  // Filtro rápido: lesión activa
  await buscar.fill('');
  await page.getByRole('button', { name: /Lesión activa/ }).click();
  for (const nombre of ['Pedro Ramírez', 'Julián Duarte', 'Esteban Mora']) await expect(tarjetas.filter({ hasText: nombre })).toHaveCount(1);
  for (const t of await tarjetas.all()) await expect(t).toContainText('Lesión:');
  // 3. Al tocar un paciente se abre su ficha clínica (T1.4)
  await page.getByRole('button', { name: /Lesión activa/ }).click();
  await buscar.fill('1090000015');
  await tarjetas.first().getByRole('link').click();
  await expect(page).toHaveURL(/\/pacientes\/\d+$/);
  await expect(page.getByRole('heading', { level: 1, name: /Mateo Carrillo/ })).toBeVisible();
  await page.context().close();

  // Computador: tabla con columnas y acción "Abrir historia"
  const pc = await paginaEn(browser, 'pc');
  await entrar(pc, 'salud');
  await pc.goto('/pacientes');
  await expect(pc.getByRole('columnheader', { name: 'Disponibilidad' })).toBeVisible();
  await pc.getByLabel('Buscar paciente por nombre, documento o dorsal').fill('TOMÁS ibarra');
  await expect(pc.locator('.tabla-pacientes tbody tr')).toHaveCount(1);
  await expect(pc.getByRole('link', { name: 'Abrir la ficha de Tomás Ibarra' })).toBeVisible();
  await pc.context().close();
});
