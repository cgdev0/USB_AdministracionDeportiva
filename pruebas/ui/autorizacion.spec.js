// Autorización de los deportistas en el navegador (v2.9, T2.6 del plan de historia clínica; RF-32, RNF-04, D10).
// Nadie registra a un deportista, uno por uno o por carga CSV, sin la declaración; la aceptación propia del deportista
// se registra en la tableta del profesional (solo se avisa si falta).
const path = require('path');
const { test, expect } = require('@playwright/test');
const { paginaEn, entrar, desborde, CUENTAS, declaracion } = require('./ayuda');
const { credenciales, BD_PRUEBAS, RAIZ } = require('../utilidades/bd');
const { Client } = require(path.join(RAIZ, 'node_modules', 'pg'));

const PRE = 'ZZ UI autoriza';
const documento = () => `2${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
const ids = {};

async function sql(texto, params) {
  const c = new Client(credenciales(BD_PRUEBAS));
  await c.connect();
  try { return await c.query(texto, params); } finally { await c.end(); }
}

test.beforeAll(async ({ playwright }) => {
  const req = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  const [email, password] = CUENTAS.entrenador;
  const { access_token } = await (await req.post('/api/auth/login', { data: { email, password } })).json();
  const headers = { Authorization: `Bearer ${access_token}` };
  const rugby = (await (await req.get('/api/disciplinas', { headers })).json()).find(d => d.nombre === 'Rugby').id;
  for (const n of ['tableta', 'entrenador']) {
    const r = await req.post('/api/jugadores', { headers, data: { nombre: `${PRE} ${n}`, disciplina_id: rugby, tipo_documento: 'CC', numero_documento: documento(), declaracion: await declaracion() } });
    expect(r.status(), await r.text()).toBe(201);
    ids[n] = (await r.json()).id;
  }
  await req.dispose();
});
test.afterAll(async () => {
  await sql(`DO $$ BEGIN PERFORM set_config('dt.mantenimiento', 'on', true);
    DELETE FROM aceptaciones WHERE jugador_id IN (SELECT id FROM jugadores WHERE nombre LIKE '${PRE}%')
      OR carga_id IN (SELECT id FROM cargas_masivas WHERE archivo_nombre = 'zz-ui-autoriza.csv');
    DELETE FROM cargas_masivas WHERE archivo_nombre = 'zz-ui-autoriza.csv';
    DELETE FROM jugadores WHERE nombre LIKE '${PRE}%'; END $$`);
});

test('CP-UI-AVI-003 [RF-32][RNF-04] En el celular, nadie registra a un deportista sin la declaración, ni uno por uno ni por carga CSV', async ({ browser }) => {
  const page = await paginaEn(browser, 'celular');
  await entrar(page, 'entrenador');
  await page.goto('/jugadores');
  // Uno por uno
  await page.getByRole('button', { name: /Nuevo deportista/ }).click();
  const hoja = page.getByRole('dialog', { name: 'Registrar Nuevo Deportista' });
  await hoja.getByLabel('Nombre completo *').fill(`${PRE} formulario`);
  await hoja.getByLabel('Tipo de documento', { exact: true }).selectOption('CC');
  await hoja.getByLabel('Número de documento', { exact: true }).fill(documento());
  const casilla = hoja.getByLabel(/Declaro que informé al deportista/);
  await expect(casilla).not.toBeChecked();
  await hoja.getByRole('button', { name: 'Guardar Deportista' }).click();
  await expect(page.getByText(/Marca la declaración: el deportista/)).toBeVisible();
  await expect(hoja).toBeVisible();
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  await casilla.check();
  await hoja.getByRole('button', { name: 'Guardar Deportista' }).click();
  await expect(page.getByText('Deportista registrado con éxito')).toBeVisible();

  // Por carga CSV: la declaración de la carga
  await page.getByRole('button', { name: /Importar CSV/ }).first().click();
  const carga = page.getByRole('dialog', { name: 'Importar deportistas desde CSV' });
  await carga.locator('input[type=file]').setInputFiles({ name: 'zz-ui-autoriza.csv', mimeType: 'text/csv',
    buffer: Buffer.from(`nombre,tipo_documento,numero_documento,deporte\n${PRE} csv uno,CC,${documento()},Rugby\n${PRE} csv dos,CC,${documento()},Rugby\n`) });
  const importar = carga.getByRole('button', { name: /Importar 2 Deportistas/ });
  await importar.click();
  await expect(page.getByText(/Marca la declaración de la carga/)).toBeVisible();
  await carga.getByLabel(/Declaro que cada persona de este archivo/).check();
  await importar.click();
  await expect(page.getByText(/Se importaron 2 deportistas/)).toBeVisible();
  await page.context().close();

  // La carga quedó registrada con su archivo, su huella y su resultado
  const { rows: [c] } = await sql(`SELECT tipo, archivo_sha256, creadas, usuario_rol FROM cargas_masivas WHERE archivo_nombre = 'zz-ui-autoriza.csv'`);
  expect([c.tipo, c.creadas, c.usuario_rol]).toEqual(['deportistas', 2, 'entrenador']);
  expect(c.archivo_sha256).toMatch(/^[0-9a-f]{64}$/);
});

test('CP-UI-AVI-004 [RF-32][RNF-04] Si falta la aceptación del deportista solo se avisa, y él la registra en la tableta del profesional', async ({ browser }) => {
  // Personal de salud, en la tableta: lista, filtro y ficha clínica
  const page = await paginaEn(browser, 'tableta');
  await entrar(page, 'salud');
  await page.goto('/pacientes');
  await page.getByRole('button', { name: /Falta aceptación/ }).click();
  const tarjeta = page.locator('.pacientes-tarjetas > li').filter({ hasText: `${PRE} tableta` });
  await expect(tarjeta).toContainText('Falta la aceptación del deportista');
  await tarjeta.getByRole('link').click();
  // No bloquea: la valoración se puede iniciar igual
  await expect(page.getByRole('button', { name: 'Nueva valoración' })).toBeEnabled();
  await page.locator('#ficha-avisos').getByRole('button', { name: /Falta la aceptación del deportista/ }).click();
  const ventana = page.getByRole('dialog', { name: `Aceptación del deportista: ${PRE} tableta` });
  await expect(ventana.getByRole('heading', { name: 'Aviso de privacidad: tus datos en Administración Deportiva' })).toBeVisible();
  await expect(ventana.getByLabel('Nombre de quien acepta *')).toHaveValue(`${PRE} tableta`);
  const registrar = ventana.getByRole('button', { name: 'Registrar aceptación' });
  await expect(registrar).toBeDisabled();
  await ventana.getByLabel(/Leí el aviso y entiendo/).check();
  await registrar.click();
  await expect(page.getByText(`Aceptación de ${PRE} tableta registrada`)).toBeVisible();
  await expect(page.locator('#ficha-avisos')).not.toContainText('Falta la aceptación del deportista');
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  await page.context().close();

  // El entrenador, desde la ficha de Deportistas en su celular
  const cel = await paginaEn(browser, 'celular');
  await entrar(cel, 'entrenador');
  await cel.goto('/jugadores');
  await cel.getByPlaceholder('Buscar por nombre, documento, dorsal, posición o equipo').fill(`${PRE} entrenador`);
  await cel.getByRole('button', { name: `Ficha de ${PRE} entrenador` }).first().click();
  await expect(cel.getByText('Falta que el deportista acepte el aviso de privacidad.')).toBeVisible();
  await cel.getByRole('button', { name: 'Registrar aceptación' }).click();
  const tableta = cel.getByRole('dialog', { name: `Aceptación del deportista: ${PRE} entrenador` });
  await tableta.getByLabel(/Leí el aviso y entiendo/).check();
  await tableta.getByRole('button', { name: 'Registrar aceptación' }).click();
  await expect(cel.getByText(`Aceptación de ${PRE} entrenador registrada`)).toBeVisible();
  await expect(cel.getByText('Falta que el deportista acepte el aviso de privacidad.')).toHaveCount(0);
  await cel.context().close();

  // Quedaron registradas, con el profesional como testigo
  const { rows } = await sql(`SELECT u.rol FROM aceptaciones a JOIN usuarios u ON u.id = a.testigo_id
    WHERE a.via = 'tableta' AND a.jugador_id = ANY($1) ORDER BY a.id`, [[ids.tableta, ids.entrenador]]);
  expect(rows.map(r => r.rol)).toEqual(['personal_salud', 'entrenador']);
});
