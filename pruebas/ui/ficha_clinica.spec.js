// Ficha clínica del deportista en el navegador (v2.8, T1.4 del plan de historia clínica; RF-26, RF-31, RNF-04).
// Desde la ficha se llega a cualquier registro del deportista y se inicia una valoración con 1 toque.
const path = require('path');
const { test, expect } = require('@playwright/test');
const { paginaEn, entrar, desborde, CUENTAS } = require('./ayuda');
const { credenciales, BD_PRUEBAS, RAIZ } = require('../utilidades/bd');
const { Client } = require(path.join(RAIZ, 'node_modules', 'pg'));

const MARCA = 'ZZ UI ficha';
const PDF = Buffer.from('%PDF-1.4\n% Resonancia de tobillo (prueba)\n%%EOF\n');
let pedro = null;

async function sql(texto, params) {
  const c = new Client(credenciales(BD_PRUEBAS));
  await c.connect();
  try { return await c.query(texto, params); } finally { await c.end(); }
}

// Un registro de cada tipo para Pedro Ramírez (plantel de demostración: ya tiene una lesión activa y un control)
test.beforeAll(async ({ playwright }) => {
  const req = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  const [email, password] = CUENTAS.salud;
  const { access_token } = await (await req.post('/api/auth/login', { data: { email, password } })).json();
  const headers = { Authorization: `Bearer ${access_token}` };
  pedro = (await (await req.get('/api/pacientes', { headers })).json()).find(p => p.numero_documento === '1090000002').id;
  const v = await (await req.post('/api/valoraciones', { headers, data: { jugador_id: pedro, tipo: 'post_lesion',
    contenido: { motivo_consulta: `${MARCA}: control del tobillo`, antecedentes: { alergias: 'Penicilina', cirugias: 'Ninguna' } } } })).json();
  await req.post(`/api/valoraciones/${v.id}/cerrar`, { headers, data: { version: v.version } });
  await req.post('/api/archivos-clinicos', { headers, multipart: {
    archivo: { name: 'resonancia-tobillo.pdf', mimeType: 'application/pdf', buffer: PDF }, jugador_id: String(pedro), tipo: 'examen', descripcion: MARCA } });
  await sql(`INSERT INTO antropometria (jugador_id, fecha, peso, estatura, imc, porcentaje_grasa) VALUES ($1, CURRENT_DATE, 81.3, 1.78, 25.7, 13.9)`, [pedro]);
  await req.dispose();
});

test.afterAll(async () => {
  // Lo cerrado no se borra por la app: la limpieza de la base de pruebas usa el modo de mantenimiento
  await sql(`DO $$ BEGIN PERFORM set_config('dt.mantenimiento', 'on', true);
    DELETE FROM archivos_clinicos WHERE descripcion = '${MARCA}';
    DELETE FROM antropometria WHERE peso = 81.3 AND porcentaje_grasa = 13.9;
    DELETE FROM valoraciones WHERE contenido->>'motivo_consulta' LIKE '${MARCA}%'; END $$`);
});

test('CP-UI-SAL-010 [RF-26][RF-31][RNF-04] En el celular, la ficha muestra los avisos, abre cualquier registro y empieza una valoración con 1 toque', async ({ browser }) => {
  const page = await paginaEn(browser, 'celular');
  await entrar(page, 'salud');
  await page.goto('/pacientes');
  await page.getByLabel('Buscar paciente por nombre, documento o dorsal').fill('1090000002');
  await page.locator('.pacientes-tarjetas a').first().click();
  await expect(page).toHaveURL(new RegExp(`/pacientes/${pedro}$`));
  await expect(page.getByRole('heading', { level: 1, name: '#2 Pedro Ramírez' })).toBeVisible();

  // Encabezado con los avisos siempre visibles
  const avisos = page.locator('#ficha-avisos');
  await expect(avisos).toContainText('Alergias: Penicilina');
  await expect(avisos).toContainText('Lesión: Esguince de tobillo');
  // Resumen: antecedentes de la última valoración cerrada y última medición
  await expect(page.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.ficha-bloque').filter({ hasText: 'Antecedentes' })).toContainText('Penicilina');
  await expect(page.locator('.ficha-bloque').filter({ hasText: 'Última medición' })).toContainText('81,3 kg');
  expect(await desborde(page)).toBeLessThanOrEqual(0);

  // Historia: un registro de cada tipo, del más reciente al más antiguo, y cada uno se abre
  await page.getByRole('tab', { name: /Historia/ }).click();
  const items = page.locator('.ficha-item');
  await expect(items).toHaveCount(5);
  const filtrar = (nombre) => page.getByRole('group', { name: 'Filtrar la historia por tipo' }).getByRole('button', { name: new RegExp(`^${nombre}`) }).click();
  const ventana = page.locator('.modal-box');
  const cerrarVentana = async () => { await ventana.getByRole('button', { name: 'Cerrar', exact: true }).click(); await expect(ventana).toHaveCount(0); };

  await filtrar('Lesiones');
  await expect(items).toHaveCount(1);
  await items.first().click();
  await expect(ventana).toContainText('Lesión: Esguince de tobillo');
  await expect(ventana).toContainText('Seguimientos');
  await cerrarVentana();

  await filtrar('Controles');
  await items.first().click();
  await expect(ventana).toContainText('Aptitud');
  await cerrarVentana();

  await filtrar('Mediciones');
  await items.first().click();
  await expect(ventana).toContainText('81,3 kg');
  await cerrarVentana();

  await filtrar('Valoraciones');
  await items.first().click();
  await expect(ventana).toContainText('Cerrada el');
  await expect(ventana).toContainText(`${MARCA}: control del tobillo`);
  await cerrarVentana();

  await filtrar('Archivos');
  const descarga = page.waitForEvent('download');
  await items.first().click();
  expect((await descarga).suggestedFilename()).toBe('resonancia-tobillo.pdf');
  expect(await desborde(page)).toBeLessThanOrEqual(0);

  // Accesos: la apertura de la ficha quedó en la bitácora
  await page.getByRole('tab', { name: 'Accesos' }).click();
  await expect(page.locator('.bitacora-lista')).toContainText('abrió la ficha clínica');

  // Nueva valoración: 1 toque desde cualquier pestaña, con los antecedentes de la anterior para revisarlos
  await page.locator('.barra-acciones').getByRole('button', { name: 'Nueva valoración' }).click();
  await expect(ventana.getByRole('heading', { name: 'Nueva valoración: Pedro Ramírez' })).toBeVisible();
  await expect(ventana.getByLabel('Alergias')).toHaveValue('Penicilina');
  await cerrarVentana();
  await page.context().close();

  // 360 px: sin desplazamiento horizontal en ninguna pestaña
  const chico = await paginaEn(browser, 'celular360');
  await entrar(chico, 'salud');
  await chico.goto(`/pacientes/${pedro}`);
  for (const pestana of ['Resumen', 'Historia', 'Accesos']) {
    await chico.getByRole('tab', { name: new RegExp(pestana) }).click();
    await chico.waitForLoadState('networkidle');
    expect(await desborde(chico), pestana).toBeLessThanOrEqual(0);
  }
  await chico.context().close();
});

test('CP-UI-SAL-011 [RF-26][RNF-04] En computador la ficha muestra resumen e historia lado a lado y se usa con el teclado; en tableta, con pestañas', async ({ browser }) => {
  const pc = await paginaEn(browser, 'pc');
  await entrar(pc, 'salud');
  await pc.goto(`/pacientes/${pedro}`);
  // Dos columnas, sin pestañas
  await expect(pc.getByRole('complementary', { name: 'Resumen del deportista' })).toBeVisible();
  await expect(pc.getByRole('heading', { name: 'Historia' })).toBeVisible();
  await expect(pc.getByRole('tablist')).toHaveCount(0);
  const [resumen, historia] = await Promise.all([pc.locator('.ficha-columnas > aside').boundingBox(), pc.locator('.ficha-historia').boundingBox()]);
  expect(historia.x).toBeGreaterThan(resumen.x + resumen.width - 1);

  // Teclado: Enter sobre un registro lo abre
  await pc.locator('.ficha-item').filter({ hasText: 'Esguince de tobillo' }).focus();
  await pc.keyboard.press('Enter');
  await expect(pc.locator('.modal-box')).toContainText('Seguimientos');
  await pc.locator('.modal-box').getByRole('button', { name: 'Cerrar', exact: true }).click();

  // Accesos en una ventana
  await pc.getByRole('button', { name: 'Accesos a esta historia' }).click();
  await expect(pc.locator('.modal-box .bitacora-lista')).toContainText('abrió la ficha clínica');
  await pc.locator('.modal-box').getByRole('button', { name: 'Cerrar', exact: true }).click();

  // Una valoración en borrador: al volver a la ficha aparece en la historia y se puede continuar
  await pc.getByRole('button', { name: 'Nueva valoración' }).click();
  await pc.getByLabel('Motivo de consulta').fill(`${MARCA}: borrador desde el computador`);
  await pc.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(pc.getByText('Borrador guardado')).toBeVisible();
  await pc.locator('.modal-box').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(pc.locator('#ficha-avisos')).toContainText('Borrador sin cerrar');
  await expect(pc.locator('.ficha-item').filter({ hasText: 'Borrador' })).toHaveCount(1);
  await pc.getByRole('button', { name: 'Continuar borrador' }).click();
  await expect(pc.getByLabel('Motivo de consulta')).toHaveValue(`${MARCA}: borrador desde el computador`);
  expect(await desborde(pc)).toBeLessThanOrEqual(0);
  await pc.context().close();

  // Tableta vertical: pestañas que se recorren con las flechas
  const tableta = await paginaEn(browser, 'tableta');
  await entrar(tableta, 'salud');
  await tableta.goto(`/pacientes/${pedro}`);
  await tableta.getByRole('tab', { name: 'Resumen' }).focus();
  await tableta.keyboard.press('ArrowRight');
  await expect(tableta.getByRole('tab', { name: /Historia/ })).toHaveAttribute('aria-selected', 'true');
  await expect(tableta.getByRole('tab', { name: /Historia/ })).toBeFocused();
  await expect(tableta.locator('.ficha-item').first()).toBeVisible();
  expect(await desborde(tableta)).toBeLessThanOrEqual(0);
  await tableta.context().close();

  // El administrador y el entrenador no entran a la ficha
  for (const rol of ['administrador', 'entrenador']) {
    const otra = await paginaEn(browser, 'pc');
    await entrar(otra, rol);
    await otra.goto(`/pacientes/${pedro}`);
    await expect(otra).toHaveURL(/\/$/);
    await otra.context().close();
  }
});

// DEF-058: el borrador de otra persona se mostraba como "Cerrada el" (sin fecha), con notas e integridad
test('CP-UI-HC-008 [RF-26] El borrador de otra persona se ve como borrador: sin firma, sin notas y sin poder editarlo', async ({ browser }) => {
  // Un borrador abierto por otro usuario (en la base de pruebas solo hay una cuenta de salud)
  await sql(`INSERT INTO valoraciones (jugador_id, profesional_id, contenido)
             SELECT $1, id, '{"motivo_consulta": "${MARCA}: borrador de otra persona"}'::jsonb FROM usuarios WHERE rol = 'administrador' LIMIT 1`, [pedro]);
  const page = await paginaEn(browser, 'pc');
  await entrar(page, 'salud');
  await page.goto(`/pacientes/${pedro}`);
  await page.locator('.ficha-item').filter({ hasText: 'Borrador' }).filter({ hasText: 'Administrador' }).click();
  const ventana = page.getByRole('dialog', { name: /: Pedro Ramírez$/ });
  await expect(ventana.locator('.valoracion-firma')).toContainText('Borrador abierto el');
  await expect(ventana).toContainText('Solo quien abrió el borrador puede editarlo o cerrarlo');
  await expect(ventana).toContainText(`${MARCA}: borrador de otra persona`);
  await expect(ventana).not.toContainText('Cerrada el');
  await expect(ventana.getByLabel('Nueva nota aclaratoria')).toHaveCount(0);
  await expect(ventana.getByRole('button', { name: 'Verificar integridad' })).toHaveCount(0);
  await page.context().close();
});
