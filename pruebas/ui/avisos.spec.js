// Aceptar el aviso de manejo de datos antes de entrar (v2.9, T2.5 del plan de historia clínica; RF-32, RNF-04).
// Las cuentas de prueba ya lo aceptaron (preparar.js); aquí se crean cuentas nuevas, que empiezan sin aceptar.
const path = require('path');
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { paginaEn, entrar, desborde, CUENTAS, declaracion } = require('./ayuda');
const { credenciales, BD_PRUEBAS, RAIZ } = require('../utilidades/bd');
const { Client } = require(path.join(RAIZ, 'node_modules', 'pg'));

const CLAVE = 'Prueba.2026!Aviso';
const correo = (n) => `zz.ui.aviso.${n}@test.com`;

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
  // La cuenta de un deportista crea también su ficha, que necesita el deporte
  const rugby = (await (await req.get('/api/disciplinas', { headers })).json()).find(d => d.nombre === 'Rugby').id;
  for (const [n, rol] of [['salud', 'personal_salud'], ['entrenador', 'entrenador'], ['deportista', 'jugador']]) {
    const r = await req.post('/api/usuarios', { headers, data: { nombre: `ZZ Aviso ${n}`, email: correo(n), password: CLAVE, rol, ...(rol === 'jugador' ? { ficha: { disciplina_id: rugby }, declaracion: await declaracion() } : {}) } });
    expect(r.status(), await r.text()).toBe(201);
  }
  await req.dispose();
});
test.afterAll(async () => {
  await sql(`DO $$ BEGIN PERFORM set_config('dt.mantenimiento', 'on', true);
    DELETE FROM aceptaciones WHERE usuario_id IN (SELECT id FROM usuarios WHERE email LIKE 'zz.ui.aviso.%');
    DELETE FROM usuarios WHERE email LIKE 'zz.ui.aviso.%';
    DELETE FROM jugadores WHERE nombre LIKE 'ZZ Aviso %'; END $$`);
});

async function entrarSinAviso(page, n) {
  await page.goto('/login');
  await page.fill('#email', correo(n));
  await page.fill('#password', CLAVE);
  await page.click('button[type=submit]');
}

test('CP-UI-AVI-001 [RF-32][RNF-04] Un usuario nuevo acepta su compromiso antes de entrar; sin aceptarlo solo puede salir', async ({ browser }) => {
  // Celular de 360 px: personal de salud nuevo
  const page = await paginaEn(browser, 'celular360');
  await entrarSinAviso(page, 'salud');
  const titulo = page.getByRole('heading', { level: 1, name: 'Compromiso de confidencialidad y manejo de datos' });
  await expect(titulo).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Historia clínica' })).toBeVisible(); // lo propio de salud
  await expect(page.getByText(/Texto en revisión por el docente/)).toBeVisible();
  const aceptar = page.getByRole('button', { name: 'Aceptar y continuar' });
  await expect(aceptar).toBeDisabled();
  await expect(aceptar).toBeInViewport(); // la casilla y el botón siempre a la mano
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  // Es lo primero que ve toda persona nueva: sin problemas graves de accesibilidad
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id)).toEqual([]);
  await page.getByLabel(/Leí este compromiso y lo acepto/).check();
  await aceptar.click();
  await expect(page.getByText('Gracias. Ya puedes continuar.')).toBeVisible();
  await expect(titulo).toHaveCount(0);
  await expect(page.locator('.pendientes-salud')).toBeVisible(); // ya trabaja: su inicio
  await page.reload();
  await expect(page.locator('.pendientes-salud')).toBeVisible();
  await expect(titulo).toHaveCount(0);
  await page.context().close();

  // Sin aceptar solo puede salir
  const otra = await paginaEn(browser, 'tableta');
  await entrarSinAviso(otra, 'entrenador');
  await expect(otra.getByRole('heading', { level: 1, name: 'Compromiso de confidencialidad y manejo de datos' })).toBeVisible();
  await expect(otra.getByRole('heading', { name: 'Datos deportivos' })).toBeVisible(); // lo propio del entrenador
  await otra.goto('/jugadores');
  await expect(otra.getByRole('heading', { level: 1, name: 'Compromiso de confidencialidad y manejo de datos' })).toBeVisible();
  await otra.getByRole('button', { name: 'Salir' }).click();
  await expect(otra).toHaveURL(/\/login$/);
  await otra.context().close();

  // Computador: el deportista en su cuenta ve el aviso de privacidad
  const pc = await paginaEn(browser, 'pc');
  await entrarSinAviso(pc, 'deportista');
  await expect(pc.getByRole('heading', { level: 1, name: 'Aviso de privacidad: tus datos en Administración Deportiva' })).toBeVisible();
  await expect(pc.getByRole('heading', { name: 'Tus derechos' })).toBeVisible();
  await pc.getByLabel(/Leí el aviso y entiendo/).check();
  await pc.getByRole('button', { name: 'Aceptar y continuar' }).click();
  await expect(pc.getByText('Gracias. Ya puedes continuar.')).toBeVisible();
  await pc.context().close();

  // Las aceptaciones quedaron registradas, cada una con su texto
  const { rows } = await sql(`SELECT u.email, a.aviso, a.via FROM aceptaciones a JOIN usuarios u ON u.id = a.usuario_id
                               WHERE u.email LIKE 'zz.ui.aviso.%' ORDER BY u.email`);
  expect(rows.map(r => [r.email, r.aviso, r.via])).toEqual([
    [correo('deportista'), 'aviso_deportista', 'cuenta'],
    [correo('salud'), 'compromiso_personal', 'cuenta'],
  ]);
});

test('CP-UI-AVI-002 [RF-32] Las cuentas que ya aceptaron entran directo, sin volver a ver el aviso', async ({ browser }) => {
  const page = await paginaEn(browser, 'celular');
  await entrar(page, 'entrenador');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Compromiso de confidencialidad y manejo de datos' })).toHaveCount(0);
  await expect(page.locator('.menu-inferior')).toBeVisible();
  await page.context().close();
});
