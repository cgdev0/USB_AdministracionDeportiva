// Bloqueo por inactividad en el navegador (v2.7, T0.8 del plan de historia clínica; RNF-02, RNF-04).
// Con el reloj simulado de Playwright: no hay que esperar 15 minutos de verdad.
const path = require('path');
const { test, expect } = require('@playwright/test');
const { paginaEn, entrar, CUENTAS } = require('./ayuda');
const { credenciales, BD_PRUEBAS, RAIZ } = require('../utilidades/bd');
const { Client } = require(path.join(RAIZ, 'node_modules', 'pg'));

// v2.8 (T1.2): el borrador se guarda solo, así que estas pruebas dejan borradores: se limpian al final
test.afterAll(async () => {
  const c = new Client(credenciales(BD_PRUEBAS));
  await c.connect();
  await c.query(`DO $$ BEGIN PERFORM set_config('dt.mantenimiento', 'on', true);
    DELETE FROM valoraciones WHERE contenido->>'motivo_consulta' LIKE 'ZZ bloqueo%'; END $$`);
  await c.end();
});

test('CP-UI-SAL-001 [RNF-02] En la tableta, a los 15 minutos sin uso se bloquea y tapa todo, recargar no lo quita, y el aviso permite seguir', async ({ browser }) => {
  const page = await paginaEn(browser, 'tableta');
  await page.clock.install();
  await entrar(page, 'salud');
  await page.goto('/salud');

  // Empieza una valoración y escribe algo
  const opcion = page.locator('#val-jugador option', { hasText: 'Mateo Carrillo' });
  await page.locator('#val-jugador').selectOption(await opcion.getAttribute('value'));
  await page.getByRole('button', { name: 'Nueva valoración' }).click();
  await page.getByLabel('Motivo de consulta').fill('ZZ bloqueo: lo escrito no se pierde');

  // A los 14 minutos sin tocar nada avisa; "Sigo aquí" reinicia la cuenta
  await page.clock.fastForward('14:05');
  const aviso = page.getByRole('alertdialog');
  await expect(aviso).toContainText('se bloqueará en 1 minuto');
  await aviso.getByRole('button', { name: 'Sigo aquí' }).click();
  await expect(aviso).toHaveCount(0);
  await page.clock.fastForward('10:00');
  await expect(page.getByRole('heading', { name: 'Pantalla bloqueada' })).toHaveCount(0, { timeout: 2000 });

  // Sin tocar la pantalla 15 minutos: se bloquea y tapa todo
  await page.clock.fastForward('15:05');
  const bloqueo = page.getByRole('dialog', { name: 'Pantalla bloqueada' });
  await expect(bloqueo).toBeVisible();
  expect(await page.evaluate(() => document.getElementById('root').inert), 'la página queda inerte').toBe(true);

  // Recargar no lo quita
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Pantalla bloqueada' })).toBeVisible();

  // Contraseña equivocada y luego la correcta
  await page.getByLabel('Tu contraseña').fill('equivocada');
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.getByRole('alert')).toContainText('no es correcta');
  await page.getByLabel('Tu contraseña').fill(CUENTAS.salud[1]);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.getByRole('heading', { name: 'Pantalla bloqueada' })).toHaveCount(0);
  await page.context().close();
});

test('CP-UI-SAL-002 [RNF-02] Sin recargar, al desbloquear sigue lo que estaba escrito; el entrenador no tiene bloqueo', async ({ browser }) => {
  const page = await paginaEn(browser, 'celular');
  await page.clock.install();
  await entrar(page, 'salud');
  await page.goto('/salud');
  const opcion = page.locator('#val-jugador option', { hasText: 'Mateo Carrillo' });
  await page.locator('#val-jugador').selectOption(await opcion.getAttribute('value'));
  await page.getByRole('button', { name: 'Nueva valoración' }).click();
  await page.getByLabel('Motivo de consulta').fill('ZZ bloqueo: sigue aquí');
  await page.clock.fastForward('15:30');
  await page.getByLabel('Tu contraseña').fill(CUENTAS.salud[1]);
  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.getByLabel('Motivo de consulta')).toHaveValue('ZZ bloqueo: sigue aquí');
  await page.context().close();

  const entrenador = await paginaEn(browser, 'celular');
  await entrenador.clock.install();
  await entrar(entrenador, 'entrenador');
  await entrenador.goto('/');
  await entrenador.clock.fastForward('20:00');
  await expect(entrenador.getByRole('heading', { name: 'Pantalla bloqueada' })).toHaveCount(0);
  await entrenador.context().close();
});
