// Flujos clínicos en computador y con teclado (v2.8, T1.6 del plan de historia clínica; RNF-04, RNF-06).
// Lo que ya se prueba en celular y tableta (identificación, valoración, retirar y reactivar) se repite en 1440 px,
// usando el teclado: Tab con foco visible y sin salirse de la ventana, Enter guarda, Escape cierra y Ctrl+S guarda
// el borrador. También el giro de la tableta (vertical ↔ horizontal).
const path = require('path');
const { test, expect } = require('@playwright/test');
const { paginaEn, entrar, desborde, ANCHOS, CUENTAS } = require('./ayuda');
const { credenciales, BD_PRUEBAS, RAIZ } = require('../utilidades/bd');
const { Client } = require(path.join(RAIZ, 'node_modules', 'pg'));

const NOMBRE = 'ZZ UI PC Teclado';
const RETIRO = 'ZZ UI PC Retiro';
const MOTIVO = 'ZZ UI PC: molestia en el hombro derecho al lanzar';

async function sql(texto) {
  const c = new Client(credenciales(BD_PRUEBAS));
  await c.connect();
  try { return await c.query(texto); } finally { await c.end(); }
}
async function cabeceras(page, rol) {
  const [email, password] = CUENTAS[rol];
  const r = await page.request.post('/api/auth/login', { data: { email, password } });
  return { Authorization: `Bearer ${(await r.json()).access_token}` };
}
// ¿El elemento con el foco está dentro de una ventana y se ve el foco?
const foco = (page) => page.evaluate(() => {
  const e = document.activeElement;
  const s = getComputedStyle(e);
  return { enVentana: !!e.closest('[role=dialog], [role=alertdialog]'), visible: s.outlineStyle !== 'none' || s.boxShadow !== 'none' };
});

test.afterAll(async () => {
  await sql(`DO $$ BEGIN PERFORM set_config('dt.mantenimiento', 'on', true);
    DELETE FROM notas_aclaratorias WHERE valoracion_id IN (SELECT id FROM valoraciones WHERE contenido->>'motivo_consulta' = '${MOTIVO}');
    DELETE FROM valoraciones WHERE contenido->>'motivo_consulta' = '${MOTIVO}';
    DELETE FROM jugadores WHERE nombre IN ('${NOMBRE}', '${RETIRO}'); END $$`);
});

test('CP-UI-PC-001 [RNF-04] Al girar la tableta, la ficha y los formularios pasan de pestañas a dos columnas y vuelven', async ({ browser }) => {
  const page = await paginaEn(browser, 'tableta');
  await entrar(page, 'salud');
  await page.goto('/pacientes');
  await page.locator('.pacientes-tarjetas a').first().click();
  await expect(page.getByRole('tablist', { name: 'Secciones de la ficha' })).toBeVisible();
  // Horizontal (1024 × 768): resumen e historia lado a lado
  await page.setViewportSize(ANCHOS.tabletaH);
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Resumen del deportista' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Historia' })).toBeVisible();
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  // De nuevo vertical
  await page.setViewportSize(ANCHOS.tableta);
  await expect(page.getByRole('tablist', { name: 'Secciones de la ficha' })).toBeVisible();

  // Formulario por secciones: índice desplegable en vertical, índice lateral en horizontal
  await page.goto('/catalogo-clinico');
  await expect(page.locator('.fps-tableta .fps-selector')).toBeVisible();
  await page.setViewportSize(ANCHOS.tabletaH);
  await expect(page.locator('.fps-amplio .fps-indice')).toBeVisible();
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  await page.context().close();
});

test('CP-UI-PC-002 [RF-25][RNF-06] En computador, la identificación se completa con el teclado: Tab con foco visible, Enter guarda y Escape cierra', async ({ browser }) => {
  const page = await paginaEn(browser, 'pc');
  await entrar(page, 'entrenador');
  await page.goto('/jugadores');
  const nuevo = page.getByRole('button', { name: /Nuevo deportista/ });
  await nuevo.focus();
  await page.keyboard.press('Enter');
  const hoja = page.getByRole('dialog', { name: 'Registrar Nuevo Deportista' });
  await expect(hoja.getByLabel('Nombre completo *')).toBeFocused();
  await page.keyboard.type(NOMBRE);
  // Tab pasa al siguiente campo, con el foco a la vista
  await page.keyboard.press('Tab');
  await expect(hoja.getByLabel('Dorsal (número de camiseta)')).toBeFocused();
  expect(await foco(page)).toEqual({ enVentana: true, visible: true });
  // Tab no se sale de la ventana: desde el primer control, Mayús+Tab va al último
  await hoja.getByRole('button', { name: 'Cerrar', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  expect((await foco(page)).enVentana).toBe(true);
  await page.keyboard.press('Tab');
  await expect(hoja.getByRole('button', { name: 'Cerrar', exact: true })).toBeFocused();
  // Documento y Enter para guardar
  await hoja.getByLabel('Tipo de documento', { exact: true }).selectOption('CC');
  await hoja.getByLabel('Número de documento', { exact: true }).fill(`7${String(Date.now()).slice(-9)}`);
  await hoja.getByLabel('Número de documento', { exact: true }).press('Enter');
  await expect(page.getByText('Deportista registrado con éxito')).toBeVisible();
  await expect(hoja).toHaveCount(0);
  // Escape cierra la ventana y el foco vuelve al botón que la abrió
  await nuevo.focus();
  await page.keyboard.press('Enter');
  await expect(hoja).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(hoja).toHaveCount(0);
  await expect(nuevo).toBeFocused();
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  await page.context().close();
});

test('CP-UI-PC-003 [RF-26][RNF-06] En computador, una valoración se guarda con Ctrl+S, se cierra con Escape, se firma y se corrige con una nota', async ({ browser }) => {
  const page = await paginaEn(browser, 'pc');
  await entrar(page, 'salud');
  await page.goto('/pacientes');
  await page.getByLabel('Buscar paciente por nombre, documento o dorsal').fill('1090000015');
  const abrirFicha = page.getByRole('link', { name: 'Abrir la ficha de Mateo Carrillo' });
  await abrirFicha.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/pacientes\/\d+$/);

  const nueva = page.getByRole('button', { name: 'Nueva valoración' });
  await nueva.focus();
  await page.keyboard.press('Enter');
  // Al guardarse por primera vez, el título pasa de "Nueva valoración" a "Valoración en borrador"
  const editor = page.getByRole('dialog', { name: /^(Nueva valoración|Valoración en borrador): Mateo Carrillo$/ });
  await editor.getByLabel('Motivo de consulta').fill(MOTIVO);
  // Ctrl+S guarda el borrador (en vez de "Guardar página como…")
  await page.keyboard.press('Control+s');
  await expect(page.getByText('Borrador guardado')).toBeVisible();
  await expect(editor.locator('.estado-guardado')).toContainText('Guardado');
  // Escape cierra; el borrador queda en la historia
  await page.keyboard.press('Escape');
  await expect(editor).toHaveCount(0);
  await expect(page.locator('.ficha-item').filter({ hasText: 'Borrador' })).toHaveCount(1);

  // Continuar, pedir el cierre y arrepentirse: Escape cierra solo la confirmación
  await page.getByRole('button', { name: 'Continuar borrador' }).focus();
  await page.keyboard.press('Enter');
  const borrador = page.getByRole('dialog', { name: 'Valoración en borrador: Mateo Carrillo' });
  await expect(borrador.getByLabel('Motivo de consulta')).toHaveValue(MOTIVO);
  await borrador.getByRole('button', { name: 'Cerrar y firmar' }).click();
  const confirmar = page.getByRole('alertdialog', { name: '¿Cerrar y firmar la valoración?' });
  await expect(confirmar).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirmar).toHaveCount(0);
  await expect(borrador).toBeVisible();
  // Ahora sí: se firma con Enter sobre el botón
  await borrador.getByRole('button', { name: 'Cerrar y firmar' }).click();
  await confirmar.getByRole('button', { name: 'Sí, cerrar y firmar' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Valoración cerrada y firmada')).toBeVisible();

  const detalle = page.getByRole('dialog', { name: /: Mateo Carrillo$/ });
  await expect(detalle.locator('.valoracion-firma')).toContainText('Cerrada el');
  await detalle.getByLabel('Nueva nota aclaratoria').fill('ZZ UI PC nota: es el hombro izquierdo.');
  await detalle.getByRole('button', { name: 'Agregar nota' }).click();
  await expect(detalle.locator('.valoracion-notas')).toContainText('hombro izquierdo');
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal-box')).toHaveCount(0);
  await expect(page.locator('.ficha-item').filter({ hasText: 'Cerrada' }).first()).toBeVisible();
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  await page.context().close();
});

test('CP-UI-PC-004 [RNF-14][RNF-06] En computador, un deportista con historia se retira con Enter y se reactiva desde la tabla', async ({ browser }) => {
  const page = await paginaEn(browser, 'pc');
  const entrenador = await cabeceras(page, 'entrenador');
  const rugby = (await (await page.request.get('/api/disciplinas', { headers: entrenador })).json()).find(d => d.nombre === 'Rugby').id;
  const { id } = await (await page.request.post('/api/jugadores', { headers: entrenador,
    data: { nombre: RETIRO, disciplina_id: rugby, tipo_documento: 'CC', numero_documento: `6${String(Date.now()).slice(-9)}` } })).json();
  await page.request.post('/api/salud/controles', { headers: await cabeceras(page, 'salud'), data: { jugador_id: id, tipo: 'Control UI PC', aptitud: 'apto' } });

  await entrar(page, 'entrenador');
  await page.goto('/jugadores');
  await page.getByPlaceholder('Buscar por nombre, documento, dorsal, posición o equipo').fill(RETIRO);
  await page.getByRole('button', { name: `Retirar a ${RETIRO}` }).click();
  const hoja = page.getByRole('dialog', { name: `Retirar a ${RETIRO}` });
  await hoja.getByLabel('Motivo (opcional)').fill('Cambio de universidad');
  await hoja.getByLabel('Motivo (opcional)').press('Enter');
  await expect(page.getByText(`${RETIRO} salió del plantel. Su historia se conserva.`)).toBeVisible();
  await expect(page.getByRole('button', { name: `Retirar a ${RETIRO}` })).toHaveCount(0);

  await page.getByRole('button', { name: /^Retirados/ }).click();
  await page.getByRole('button', { name: `Reactivar a ${RETIRO}` }).click();
  await expect(page.getByText(`${RETIRO} volvió al plantel.`, { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /^Plantel actual/ }).click();
  await expect(page.getByRole('button', { name: `Retirar a ${RETIRO}` })).toHaveCount(1);
  await page.context().close();
});
