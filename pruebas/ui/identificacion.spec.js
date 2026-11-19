// Identificación del deportista en el navegador (v2.7, T0.1 del plan de historia clínica):
// formulario en el celular y datos sensibles desde la tableta del personal de salud (RF-25, RNF-02, RNF-04).
const { test, expect } = require('@playwright/test');
const { paginaEn, entrar, desborde, CUENTAS } = require('./ayuda');

const NUMERO = `8${String(Date.now()).slice(-9)}`;
const NOMBRE = 'ZZ UI Menor de edad';
const nacidoHace = (anios) => { const d = new Date(); d.setFullYear(d.getFullYear() - anios); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); };

// Borra por la API lo que creó la prueba, para no cambiar el plantel que cuentan otras pruebas
async function borrarCreado(page) {
  const [email, password] = CUENTAS.entrenador;
  const login = await page.request.post('/api/auth/login', { data: { email, password } });
  const { access_token } = await login.json();
  const headers = { Authorization: `Bearer ${access_token}` };
  const lista = await (await page.request.get('/api/jugadores', { headers })).json();
  for (const j of lista.filter(x => x.nombre === NOMBRE)) await page.request.delete(`/api/jugadores/${j.id}`, { headers });
}

test('CP-UI-HC-001 [RF-25][RNF-04] En el celular, el entrenador registra un menor de edad con documento y acudiente', async ({ browser }) => {
  const page = await paginaEn(browser, 'celular360');
  await entrar(page, 'entrenador');
  await page.goto('/jugadores');
  await page.getByRole('button', { name: /Nuevo deportista/ }).click();
  const hoja = page.locator('.modal-box').first();

  await hoja.getByLabel('Nombre completo *').fill(NOMBRE);
  await hoja.getByLabel('Tipo de documento', { exact: true }).selectOption('TI');
  const numero = hoja.getByLabel('Número de documento', { exact: true });
  await expect(numero).toHaveAttribute('inputmode', 'numeric');
  await numero.fill(NUMERO);
  await hoja.getByLabel('Fecha de nacimiento').fill(nacidoHace(16));

  // Al ser menor de edad aparece el acudiente como obligatorio
  await expect(hoja.getByText('Menor de edad: nombre y teléfono obligatorios')).toBeVisible();
  await hoja.getByRole('button', { name: 'Guardar Deportista' }).click();
  await expect(page.getByText('Es menor de edad: escribe el nombre y el teléfono del acudiente.')).toBeVisible();

  await hoja.getByLabel('Nombre del acudiente *').fill('Acudiente UI');
  const telefono = hoja.getByLabel('Teléfono del acudiente *');
  await expect(telefono).toHaveAttribute('type', 'tel');
  await telefono.fill('300 000 0000');
  // Las secciones opcionales se pueden abrir y no desbordan la pantalla de 360 px
  await hoja.getByText('Contacto de emergencia').click();
  await expect(hoja.getByLabel('Teléfono', { exact: true })).toBeVisible();
  expect(await desborde(page)).toBeLessThanOrEqual(0);

  // v2.9 (T2.6): quien registra declara que informó al deportista (o a su acudiente) y que autorizó
  await hoja.getByLabel(/Declaro que informé al deportista/).check();
  await hoja.getByRole('button', { name: 'Guardar Deportista' }).click();
  await expect(page.getByText('Deportista registrado con éxito')).toBeVisible();

  // Se encuentra por el número de documento, aunque se escriba con puntos
  await page.getByPlaceholder('Buscar por nombre, documento, dorsal, posición o equipo').fill(`${NUMERO.slice(0, 1)}.${NUMERO.slice(1)}`);
  await expect(page.getByText(NOMBRE).first()).toBeVisible();

  await borrarCreado(page);
  await page.context().close();
});

test('CP-UI-HC-002 [RF-25][RNF-02] En la tableta, el personal de salud completa los datos sensibles desde la ficha', async ({ browser }) => {
  const page = await paginaEn(browser, 'tableta');
  await entrar(page, 'salud');
  await page.goto('/jugadores');
  await page.getByPlaceholder('Buscar por nombre, documento, dorsal, posición o equipo').fill('1090000015');
  await page.getByRole('button', { name: 'Ficha de Mateo Carrillo' }).first().click();
  const ficha = page.locator('.modal-box').first();
  await expect(ficha.getByText('CC 1090000015')).toBeVisible();
  await expect(ficha.getByText('Contacto y emergencia')).toBeVisible();

  await ficha.getByRole('button', { name: /Datos de identificación/ }).click();
  const hoja = page.locator('.modal-box').first();
  await hoja.getByText('Datos sensibles').click();
  await hoja.getByLabel('Pertenencia étnica').selectOption('ninguna');
  await hoja.getByLabel('Discapacidad').selectOption('ninguna');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Datos de identificación guardados')).toBeVisible();

  // La ficha se vuelve a abrir con los datos guardados
  const nueva = page.locator('.modal-box').first();
  await expect(nueva.locator('.ficha-datos')).toContainText('Discapacidad');
  await expect(nueva.locator('.ficha-datos')).toContainText('Ninguna');
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  await page.context().close();
});

// ── T0.2: datos de quien atiende ──
test('CP-UI-HC-003 [RF-26][RNF-04] En el celular, el administrador crea un practicante sin registro profesional y con supervisor', async ({ browser }) => {
  const path = require('path');
  const { credenciales, BD_PRUEBAS, RAIZ } = require('../utilidades/bd');
  const { Client } = require(path.join(RAIZ, 'node_modules', 'pg'));
  const email = `zz.ui.practicante.${Date.now()}@test.com`;

  const page = await paginaEn(browser, 'celular');
  await entrar(page, 'administrador');
  await page.goto('/usuarios');
  await page.getByRole('button', { name: /Nuevo usuario/ }).click();
  const hoja = page.locator('.modal-box').first();
  await hoja.getByRole('radio', { name: 'Personal de salud' }).click();
  await hoja.getByLabel('Nombre completo *').fill('ZZ UI Practicante');
  await hoja.getByLabel('Correo *').fill(email);
  await hoja.locator('#u-clave').fill('Prueba123!');

  // Datos profesionales: el registro es opcional y se ve cómo quedará identificado
  await hoja.getByLabel('Profesión o programa').selectOption('fisioterapia');
  await hoja.getByRole('button', { name: 'Practicante' }).click();
  await expect(hoja.getByText('Opcional. Los practicantes y estudiantes aún no lo tienen.')).toBeVisible();
  await hoja.getByLabel('Supervisor').selectOption({ label: 'Personal Salud' });
  await expect(hoja.getByText('Practicante de fisioterapia · Supervisa: Personal Salud')).toBeVisible();
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  await hoja.getByRole('button', { name: 'Crear' }).click();

  await expect(page.locator('.quien-atiende-linea', { hasText: 'Practicante de fisioterapia · Supervisa: Personal Salud' })).toBeVisible();
  await page.context().close();

  const c = new Client(credenciales(BD_PRUEBAS));
  await c.connect();
  await c.query('DELETE FROM usuarios WHERE email = $1', [email]);
  await c.end();
});
