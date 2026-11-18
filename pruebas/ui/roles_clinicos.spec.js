// Cada rol ve solo lo que le corresponde, en el navegador (v2.7, T0.7 del plan de historia clínica; RF-14, RNF-02).
const { test, expect } = require('@playwright/test');
const { paginaEn, entrar, desborde } = require('./ayuda');

test('CP-UI-HC-007 [RF-14][RNF-02] El entrenador (celular) ve la disponibilidad sin el tipo de lesión; salud (tableta) ve el detalle', async ({ browser }) => {
  const celular = await paginaEn(browser, 'celular');
  await entrar(celular, 'entrenador');
  await celular.goto('/lesiones');
  await expect(celular.getByText('Aquí ves la disponibilidad del plantel.', { exact: false })).toBeVisible();
  await expect(celular.getByRole('columnheader', { name: 'Retorno estimado' })).toBeAttached();
  await expect(celular.getByText('Esguince de tobillo')).toHaveCount(0);
  await expect(celular.getByRole('button', { name: /Registrar Lesión/i })).toHaveCount(0);
  expect(await desborde(celular)).toBeLessThanOrEqual(0);
  // En el inicio tampoco aparece el tipo de lesión, pero sí quién no está disponible
  await celular.goto('/');
  await expect(celular.getByText(/lleva \d+ días? lesionado/).first()).toBeVisible();
  await expect(celular.getByText(/esguince de tobillo/i)).toHaveCount(0);
  await celular.context().close();

  const tableta = await paginaEn(browser, 'tableta');
  await entrar(tableta, 'salud');
  await tableta.goto('/lesiones');
  await expect(tableta.getByText('Esguince de tobillo').first()).toBeVisible();
  await expect(tableta.getByRole('button', { name: /Registrar Lesión/i })).toBeVisible();
  await tableta.context().close();
});
