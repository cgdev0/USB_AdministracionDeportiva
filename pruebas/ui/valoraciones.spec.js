// Historia clínica por valoraciones en el navegador (v2.7, T0.3 del plan de historia clínica; RF-26, RNF-04).
// El personal de salud, desde el celular, abre una valoración, guarda el borrador, la cierra y firma, agrega una
// nota aclaratoria y verifica que no haya cambiado.
const path = require('path');
const { test, expect } = require('@playwright/test');
const { paginaEn, entrar, desborde } = require('./ayuda');
const { credenciales, BD_PRUEBAS, RAIZ } = require('../utilidades/bd');
const { Client } = require(path.join(RAIZ, 'node_modules', 'pg'));

const MOTIVO = 'ZZ UI valoración: dolor en la rodilla derecha al aterrizar';

test.afterAll(async () => {
  // Lo cerrado no se borra por la app: la limpieza de la base de pruebas usa el modo de mantenimiento
  const c = new Client(credenciales(BD_PRUEBAS));
  await c.connect();
  await c.query(`DO $$ BEGIN PERFORM set_config('dt.mantenimiento', 'on', true);
    DELETE FROM notas_aclaratorias WHERE valoracion_id IN (SELECT id FROM valoraciones WHERE contenido->>'motivo_consulta' LIKE 'ZZ UI%');
    DELETE FROM valoraciones WHERE contenido->>'motivo_consulta' LIKE 'ZZ UI%'; END $$`);
  await c.end();
});

test('CP-UI-HC-004 [RF-26][RNF-04] En el celular, salud registra una valoración, la cierra y la corrige con una nota', async ({ browser }) => {
  const page = await paginaEn(browser, 'celular');
  await entrar(page, 'salud');
  await page.goto('/salud');
  await expect(page.getByText('Registras como')).toBeVisible();

  const opcion = page.locator('#val-jugador option', { hasText: 'Mateo Carrillo' });
  await page.locator('#val-jugador').selectOption(await opcion.getAttribute('value'));
  await page.getByRole('button', { name: 'Nueva valoración' }).click();

  const hoja = page.locator('.modal-box').first();
  await hoja.getByRole('button', { name: 'Inicial' }).click();
  await expect(hoja.getByRole('button', { name: 'Inicial' })).toHaveAttribute('aria-pressed', 'true');
  await hoja.getByLabel('Motivo de consulta').fill(MOTIVO);
  await hoja.getByLabel('Alergias').fill('Ninguna conocida');
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  await hoja.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByText('Borrador guardado')).toBeVisible();

  // Cerrar pide confirmación: después ya no se puede modificar
  await hoja.getByRole('button', { name: 'Cerrar y firmar' }).click();
  await page.getByRole('button', { name: 'Sí, cerrar y firmar' }).click();
  await expect(page.getByText('Valoración cerrada y firmada')).toBeVisible();

  const detalle = page.locator('.modal-box').first();
  await expect(detalle.locator('.valoracion-firma')).toContainText('Personal Salud · Fisioterapeuta');
  await expect(detalle.getByText(MOTIVO)).toBeVisible();
  await expect(detalle.getByRole('button', { name: 'Cerrar y firmar' })).toHaveCount(0);

  await detalle.getByLabel('Nueva nota aclaratoria').fill('ZZ UI nota: el dolor es en la rodilla izquierda, no en la derecha.');
  await detalle.getByRole('button', { name: 'Agregar nota' }).click();
  await expect(detalle.locator('.valoracion-notas')).toContainText('rodilla izquierda');
  await expect(detalle.getByText(MOTIVO)).toBeVisible(); // el original no cambia

  await detalle.getByRole('button', { name: 'Verificar integridad' }).click();
  await expect(detalle.getByText('La valoración no ha cambiado desde que se cerró.')).toBeVisible();
  expect(await desborde(page)).toBeLessThanOrEqual(0);

  await page.keyboard.press('Escape'); // v2.8 (T1.6): Escape cierra la ventana
  await expect(page.locator('.modal-box')).toHaveCount(0);
  await expect(page.locator('.valoracion-item', { hasText: 'Inicial' }).first()).toContainText('Cerrada');
  await page.context().close();
});
