// Tablas anchas en celular y tableta (v1.5 fase 5B, opción B): columnas clave sin desplazamiento lateral (RNF-04)
const { test, expect } = require('@playwright/test');
const { entrar, paginaEn } = require('./ayuda');

const anchoTabla = (page) => page.locator('table').first().evaluate(t => ({ tabla: t.scrollWidth, visible: t.parentElement.clientWidth }));

for (const ancho of ['celular360', 'celular', 'tableta']) {
  test(`CP-UI-RES-00${{ celular360: 1, celular: 2, tableta: 3 }[ancho]} [RNF-04] Deportistas y Estadísticas caben sin deslizar de lado (${ancho})`, async ({ browser }) => {
    const page = await paginaEn(browser, ancho);
    await entrar(page, 'administrador');
    for (const ruta of ['/jugadores', '/estadisticas']) {
      await page.goto(ruta);
      await expect(page.locator('table tbody tr').first()).toBeVisible();
      const { tabla, visible } = await anchoTabla(page);
      expect(tabla, `${ruta}: la tabla mide ${tabla} px en ${visible} px`).toBeLessThanOrEqual(visible + 1);
    }
    await page.context().close();
  });
}

test('CP-UI-RES-004 [RF-08] En celular, editar y eliminar un deportista están en su ficha', async ({ browser }) => {
  const page = await paginaEn(browser, 'celular');
  await entrar(page, 'administrador');
  await page.goto('/jugadores');
  const fila = page.locator('table tbody tr').first();
  await expect(fila.locator('.sub-movil')).toBeVisible();
  await expect(fila.getByRole('button', { name: /^Editar a / })).toBeHidden();
  await fila.getByRole('button', { name: /^Ficha de / }).click();
  const modal = page.locator('.modal-box, .modal').first();
  await expect(modal.getByRole('button', { name: 'Editar' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Eliminar' })).toBeVisible();
  await modal.getByRole('button', { name: 'Editar' }).click();
  await expect(page.locator('.modal-box, .modal').first()).toContainText(/Editar|Deportista/);
  await page.context().close();
});

// v2.8 (T1.6): las pantallas nuevas del personal de salud en los 5 anchos, cada una con su organización
test('CP-UI-RES-005 [RNF-04] Lista de pacientes y ficha clínica sin desplazamiento lateral en 360, 390, 768, 1024 y 1440 px', async ({ browser }) => {
  const { ANCHOS, desborde } = require('./ayuda');
  for (const ancho of Object.keys(ANCHOS)) {
    const page = await paginaEn(browser, ancho);
    await entrar(page, 'salud');
    await page.goto('/pacientes');
    const amplio = ANCHOS[ancho].width >= 1024;
    const computador = ANCHOS[ancho].width >= 1280;
    // Tabla en computador; tarjetas en celular y tableta (también horizontal, que es táctil)
    await expect(page.locator(computador ? '.tabla-pacientes' : '.pacientes-tarjetas')).toBeVisible();
    expect(await desborde(page), `/pacientes (${ancho})`).toBeLessThanOrEqual(0);
    await page.locator(computador ? '.tabla-pacientes a' : '.pacientes-tarjetas a').first().click();
    await expect(page.locator('.ficha-cabecera')).toBeVisible();
    // Dos columnas desde 1024 px; pestañas por debajo
    if (amplio) await expect(page.locator('.ficha-columnas')).toBeVisible();
    else await expect(page.getByRole('tablist', { name: 'Secciones de la ficha' })).toBeVisible();
    expect(await desborde(page), `ficha (${ancho})`).toBeLessThanOrEqual(0);
    if (!amplio) {
      await page.getByRole('tab', { name: /Historia/ }).click();
      expect(await desborde(page), `ficha, historia (${ancho})`).toBeLessThanOrEqual(0);
    }
    await page.context().close();
  }
});
