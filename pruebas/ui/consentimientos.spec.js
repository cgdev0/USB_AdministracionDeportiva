// Consentimientos en el navegador (v2.9, T2.3 del plan de historia clínica; RF-27, RNF-02, RNF-04).
// En el celular se registra un consentimiento firmado con la foto del papel; la imagen solo la abre el personal de
// salud; los avisos de "falta firmar" llevan a registrarlo desde la lista, la ficha y el inicio.
const path = require('path');
const { test, expect } = require('@playwright/test');
const { paginaEn, entrar, desborde, CUENTAS } = require('./ayuda');
const { credenciales, BD_PRUEBAS, RAIZ } = require('../utilidades/bd');
const { Client } = require(path.join(RAIZ, 'node_modules', 'pg'));

let tomas = null;

async function sql(texto, params) {
  const c = new Client(credenciales(BD_PRUEBAS));
  await c.connect();
  try { return await c.query(texto, params); } finally { await c.end(); }
}
async function cabeceras(request, rol) {
  const [email, password] = CUENTAS[rol];
  const { access_token } = await (await request.post('/api/auth/login', { data: { email, password } })).json();
  return { Authorization: `Bearer ${access_token}` };
}
// Foto del papel generada en el navegador (CampoFoto la reduce y la convierte a JPG antes de subirla)
const fotoDelPapel = (page) => page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 1600;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1200, 1600); g.fillStyle = '#111'; g.fillRect(150, 1300, 500, 6);
  return c.toDataURL('image/png').split(',')[1];
});

test.beforeAll(async () => {
  ({ rows: [{ id: tomas }] } = await sql(`SELECT id FROM jugadores WHERE numero_documento = '1090000023'`));
});
test.afterAll(async () => {
  await sql(`DO $$ BEGIN PERFORM set_config('dt.mantenimiento', 'on', true);
    DELETE FROM consentimientos WHERE jugador_id = ${Number(tomas)};
    DELETE FROM archivos_clinicos WHERE tipo = 'consentimiento' AND jugador_id = ${Number(tomas)}; END $$`);
});

test('CP-UI-SAL-013 [RF-27][RNF-04] En el celular, salud registra el consentimiento de un menor con la foto del papel, lo ve y lo revoca', async ({ browser }) => {
  const page = await paginaEn(browser, 'celular');
  await entrar(page, 'salud');
  // En la lista: filtro de consentimiento pendiente
  await page.goto('/pacientes');
  await page.getByRole('button', { name: /Consentimiento pendiente/ }).click();
  await page.getByLabel('Buscar paciente por nombre, documento o dorsal').fill('1090000023');
  const tarjeta = page.locator('.pacientes-tarjetas > li').first();
  await expect(tarjeta).toContainText('Falta firmar: atención y datos personales');
  await tarjeta.getByRole('link').click();

  // El aviso del encabezado lleva a los consentimientos
  await page.locator('#ficha-avisos').getByRole('button', { name: /Falta firmar: atención y datos personales/ }).click();
  await expect(page.getByRole('tab', { name: 'Consentimientos' })).toHaveAttribute('aria-selected', 'true');
  const atencion = page.locator('.cons-tarjeta').filter({ hasText: 'Atención fisioterapéutica' });
  await expect(atencion).toContainText('Pendiente');

  // Registrar la firma: firma el acudiente (ya diligenciado) y el menor da su asentimiento
  const inicio = Date.now();
  await atencion.getByRole('button', { name: 'Registrar firma: Atención fisioterapéutica' }).click();
  const ventana = page.getByRole('dialog', { name: 'Atención fisioterapéutica: Tomás Ibarra' });
  await expect(ventana.getByLabel('Nombre del acudiente *')).toHaveValue('María Ibarra (demo)');
  await ventana.getByRole('button', { name: 'Guardar' }).click();
  await expect(ventana.getByRole('alert')).toContainText('adjunta la foto o el PDF del papel firmado');
  await ventana.locator('#cons-papel-camara').setInputFiles({ name: 'papel.png', mimeType: 'image/png', buffer: Buffer.from(await fotoDelPapel(page), 'base64') });
  await expect(ventana.getByRole('img', { name: 'Vista previa: Foto del papel firmado *' })).toBeVisible();
  await ventana.getByRole('button', { name: 'Guardar' }).click();
  await expect(ventana.getByRole('alert')).toContainText('registra si dio su asentimiento');
  await ventana.getByRole('group', { name: '¿El menor dio su asentimiento? *' }).getByRole('button', { name: 'Sí' }).click();
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  await ventana.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Atención fisioterapéutica: firmado')).toBeVisible();
  expect(Date.now() - inicio, 'menos de un minuto').toBeLessThan(60000);
  await expect(atencion).toContainText('Firmado');
  await expect(atencion).toContainText('María Ibarra (demo) (acudiente, madre) · asentimiento del menor: sí');
  await expect(page.locator('#ficha-avisos')).toContainText('Falta firmar: datos personales');

  // Ver el papel: se abre por la ruta protegida
  await atencion.getByRole('button', { name: 'Ver papel' }).click();
  const papel = page.getByRole('dialog', { name: 'Papel firmado · Atención fisioterapéutica' });
  await expect(papel.getByRole('img', { name: /Papel firmado del consentimiento/ })).toBeVisible();
  await papel.getByRole('button', { name: 'Cerrar', exact: true }).click();

  // Revocar: pide el motivo y deja el historial
  await atencion.getByRole('button', { name: 'Revocar' }).click();
  const revocar = page.getByRole('dialog', { name: /Revocar · Atención fisioterapéutica/ });
  await revocar.getByRole('button', { name: 'Revocar' }).click();
  await expect(revocar.getByRole('alert')).toContainText('Escribe el motivo de la revocación');
  await revocar.getByLabel('Motivo de la revocación *').fill('La familia prefiere la atención de su EPS');
  await revocar.getByRole('button', { name: 'Revocar' }).click();
  await expect(atencion).toContainText('Revocado');
  await expect(atencion).toContainText('La familia prefiere la atención de su EPS');
  await atencion.getByText('Historial (1 registro anterior)').click();
  await expect(atencion.locator('.cons-historial')).toContainText('Firmado el');
  await expect(page.locator('#ficha-avisos')).toContainText('atención (revocado)');
  // El papel quedó en la historia, como archivo clínico
  await page.getByRole('tab', { name: /Historia/ }).click();
  await expect(page.locator('.ficha-item').filter({ hasText: 'Consentimiento' })).toHaveCount(1);
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  await page.context().close();
});

test('CP-UI-SAL-014 [RF-27][RNF-02] La imagen del consentimiento solo la abre el personal de salud; el inicio y el computador llevan a los consentimientos', async ({ browser, playwright }) => {
  const req = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  // Datos personales firmados con un PDF, para probar quién abre el papel
  const salud = await cabeceras(req, 'salud');
  const firmado = await req.post('/api/consentimientos', { headers: salud, multipart: {
    archivo: { name: 'datos.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% autorización\n%%EOF\n') },
    jugador_id: String(tomas), tipo: 'datos_personales', estado: 'firmado', asentimiento: 'si' } });
  expect(firmado.status()).toBe(201);
  const archivo = (await firmado.json()).registro.archivo_id;
  expect((await req.get(`/api/archivos-clinicos/${archivo}`, { headers: salud })).status()).toBe(200);
  for (const rol of ['administrador', 'entrenador', 'head_coach']) {
    expect((await req.get(`/api/archivos-clinicos/${archivo}`, { headers: await cabeceras(req, rol) })).status(), rol).toBe(403);
  }
  expect((await req.get(`/api/archivos-clinicos/${archivo}`, { headers: await cabeceras(req, 'jugador') })).status(), 'otro deportista').toBe(404);
  await req.dispose();

  // Inicio del personal de salud: "Consentimientos sin firmar" lleva directo a la pestaña
  const page = await paginaEn(browser, 'celular');
  await entrar(page, 'salud');
  await page.goto('/');
  const grupo = page.locator('.pend-grupo').filter({ hasText: 'Consentimientos sin firmar' });
  await expect(grupo).toBeVisible();
  await grupo.getByRole('button', { name: /^Ver los/ }).click();
  await grupo.locator('.pend-item').filter({ hasText: 'Tomás Ibarra' }).click();
  await expect(page).toHaveURL(/\/pacientes\/\d+$/);
  await expect(page.getByRole('tab', { name: 'Consentimientos' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.cons-tarjeta').filter({ hasText: 'Tratamiento de datos personales' })).toContainText('Firmado');
  await page.context().close();

  // Computador: el panel está a la izquierda y el aviso del encabezado lo enfoca
  const pc = await paginaEn(browser, 'pc');
  await entrar(pc, 'salud');
  await pc.goto(`/pacientes/${tomas}`);
  const panel = pc.locator('#ficha-consentimientos');
  await expect(pc.getByRole('complementary', { name: 'Resumen del deportista' }).locator('#ficha-consentimientos')).toBeVisible();
  await pc.locator('#ficha-avisos').getByRole('button', { name: /Falta firmar/ }).click();
  await expect(panel).toBeFocused();
  // Imprimir formato abre la hoja del deportista
  await panel.getByRole('link', { name: 'Imprimir formato: Uso en investigación' }).click();
  await expect(pc).toHaveURL(new RegExp(`/pacientes/${tomas}/formatos/investigacion$`));
  await expect(pc.locator('.fc-hoja')).toContainText('Tomás Ibarra');
  await pc.context().close();
});

test('CP-UI-CON-003 [RF-27][RNF-04] Con la regla D2 encendida, Nueva valoración avisa que falta el consentimiento y lleva a registrarlo', async ({ browser, playwright }) => {
  const req = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  const admin = await cabeceras(req, 'administrador');
  const regla = (valor) => req.put('/api/auditoria/ajustes', { headers: admin, data: { exigir_consentimiento_atencion: valor } });
  const { rows: [{ id: pedro }] } = await sql(`SELECT id FROM jugadores WHERE numero_documento = '1090000002'`);
  try {
    expect((await regla(true)).status()).toBe(200);
    const page = await paginaEn(browser, 'celular');
    await entrar(page, 'salud');
    await page.goto(`/pacientes/${pedro}`);
    await page.locator('.barra-acciones').getByRole('button', { name: 'Nueva valoración' }).click();
    const aviso = page.getByRole('dialog', { name: 'Falta el consentimiento de atención' });
    await expect(aviso).toContainText('debe tener firmado el consentimiento de atención');
    await aviso.getByRole('button', { name: 'Registrar el consentimiento' }).click();
    await expect(page.getByRole('tab', { name: 'Consentimientos' })).toHaveAttribute('aria-selected', 'true');
    await page.context().close();
    // Apagada (como queda hasta la aprobación del docente), Nueva valoración abre el editor
    expect((await regla(false)).status()).toBe(200);
    const otra = await paginaEn(browser, 'celular');
    await entrar(otra, 'salud');
    await otra.goto(`/pacientes/${pedro}`);
    await otra.locator('.barra-acciones').getByRole('button', { name: 'Nueva valoración' }).click();
    await expect(otra.getByRole('dialog', { name: 'Nueva valoración: Pedro Ramírez' })).toBeVisible();
    await otra.context().close();
  } finally {
    await regla(false);
    await req.dispose();
  }
});
