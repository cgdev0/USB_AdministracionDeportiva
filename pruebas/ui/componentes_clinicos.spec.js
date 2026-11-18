// Componentes de los formularios clínicos (v2.8, T1.1 del plan de historia clínica; RNF-04, RNF-06).
// Se prueban en la página de catálogo (/catalogo-clinico), que solo existe en la compilación de pruebas.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

// Celular (360 y 390), tableta vertical (768) y horizontal (1024) con pantalla táctil; computador (1440) con mouse
const ANCHOS = {
  celular360: { viewport: { width: 360, height: 800 }, tactil: true },
  celular: { viewport: { width: 390, height: 844 }, tactil: true },
  tableta: { viewport: { width: 768, height: 1024 }, tactil: true },
  tabletaHorizontal: { viewport: { width: 1024, height: 768 }, tactil: true },
  pc: { viewport: { width: 1440, height: 900 }, tactil: false },
};
async function abrir(browser, ancho) {
  const { viewport, tactil } = ANCHOS[ancho];
  const contexto = await browser.newContext({ viewport, hasTouch: tactil });
  const page = await contexto.newPage();
  await page.goto('/catalogo-clinico');
  await expect(page.getByRole('heading', { name: 'Componentes clínicos' })).toBeVisible();
  return page;
}
const desborde = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('CP-UI-SAL-003 [RNF-04][RNF-06] Los componentes caben en los 5 anchos, con objetivos táctiles de 44 px y sin problemas graves de accesibilidad', async ({ browser }) => {
  for (const ancho of Object.keys(ANCHOS)) {
    const page = await abrir(browser, ancho);
    expect(await desborde(page), `${ancho} sin desborde horizontal`).toBeLessThanOrEqual(0);
    if (ANCHOS[ancho].tactil) {
      const pequenos = await page.evaluate(() => [...document.querySelectorAll('button, select, input:not([type=file]):not([type=checkbox]), .interruptor')]
        .filter(e => e.offsetParent !== null && !e.closest('.sr-only'))
        .map(e => ({ texto: (e.innerText || e.getAttribute('aria-label') || e.id || e.tagName).trim().slice(0, 30), alto: Math.round(e.getBoundingClientRect().height) }))
        .filter(e => e.alto < 44));
      expect(pequenos, `${ancho}: objetivos táctiles de 44 px`).toEqual([]);
    }
    const axe = await new AxeBuilder({ page }).analyze();
    const graves = axe.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id);
    expect(graves, `${ancho}: accesibilidad`).toEqual([]);
    await page.context().close();
  }
});

test('CP-UI-SAL-004 [RNF-04] El formulario por secciones se adapta: pasos en celular, índice desplegable en tableta e índice lateral en pantallas amplias', async ({ browser }) => {
  // Celular: una sección por pantalla con "Paso N de 4"
  const celular = await abrir(browser, 'celular');
  await expect(celular.getByText('Paso 1 de 4')).toBeVisible();
  await expect(celular.getByRole('progressbar', { name: 'Avance del formulario' })).toHaveAttribute('aria-valuenow', '1');
  await expect(celular.getByRole('navigation', { name: 'Secciones' })).toHaveCount(0);
  await celular.getByRole('button', { name: /Siguiente/ }).click();
  await expect(celular.getByText('Paso 2 de 4')).toBeVisible();
  await expect(celular.getByRole('heading', { name: 'Observación postural' })).toBeFocused();
  await expect(celular.getByRole('button', { name: /Anterior/ })).toBeEnabled();
  await celular.context().close();

  // Tableta vertical: índice desplegable arriba
  const tableta = await abrir(browser, 'tableta');
  await expect(tableta.getByText(/Paso \d de/)).toHaveCount(0);
  await tableta.getByLabel('Secciones').selectOption('semiologicas');
  await expect(tableta.getByRole('heading', { name: 'Pruebas semiológicas' })).toBeVisible();
  await tableta.context().close();

  // Tableta horizontal y computador: índice lateral con el estado de cada sección
  for (const ancho of ['tabletaHorizontal', 'pc']) {
    const page = await abrir(browser, ancho);
    const indice = page.getByRole('navigation', { name: 'Secciones' });
    await expect(indice.getByRole('button')).toHaveCount(4);
    await expect(indice.getByRole('button', { name: /Signos vitales/ })).toHaveAttribute('aria-current', 'step');
    await page.getByLabel('Frecuencia cardiaca').fill('62');
    await expect(indice.getByRole('button', { name: /Signos vitales \(completa\)/ })).toBeVisible();
    await indice.getByRole('button', { name: /Fotos y documentos/ }).click();
    await expect(page.getByRole('heading', { name: 'Fotos y documentos' })).toBeVisible();
    await page.context().close();
  }
});

test('CP-UI-SAL-005 [RNF-03][RNF-06] Las medidas usan teclado numérico, muestran su unidad, aceptan coma y avisan sin bloquear', async ({ browser }) => {
  const page = await abrir(browser, 'celular');
  const fc = page.getByLabel('Frecuencia cardiaca');
  await expect(fc).toHaveAttribute('inputmode', 'decimal');
  await expect(page.locator('.campo-medida-unidad', { hasText: 'lpm' })).toBeVisible();

  await page.getByLabel('Peso').fill('72,55');
  await expect(page.getByLabel('Peso')).toHaveValue('72,5'); // un decimal; se escribe con coma
  await fc.fill('42');
  await expect(page.getByText('Revisa el valor: lo habitual es entre 40 y 100 lpm.')).toHaveCount(0);
  await fc.fill('38');
  await expect(page.getByText('Revisa el valor: lo habitual es entre 40 y 100 lpm.')).toBeVisible(); // aviso, no error
  await expect(fc).not.toHaveAttribute('aria-invalid', 'true');
  await fc.fill('300');
  await expect(page.getByRole('alert')).toContainText('debe estar entre 20 y 250 lpm');
  await expect(fc).toHaveAttribute('aria-invalid', 'true');
  await page.context().close();
});

test('CP-UI-SAL-006 [RNF-06] Opciones como botones grandes, lado del cuerpo, "No evaluado" y estado del guardado', async ({ browser }) => {
  const page = await abrir(browser, 'tabletaHorizontal');
  const indice = page.getByRole('navigation', { name: 'Secciones' });
  await indice.getByRole('button', { name: /Observación postural/ }).click();
  const alterado = page.getByRole('button', { name: 'Alterado' });
  await alterado.click();
  await expect(alterado).toHaveAttribute('aria-pressed', 'true');
  const lado = page.getByRole('group', { name: 'Hombro elevado' });
  await expect(lado.getByRole('button')).toHaveText(['Derecho', 'Izquierdo']);
  await lado.getByRole('button', { name: 'Izquierdo' }).click();
  await expect(lado.getByRole('button', { name: 'Izquierdo' })).toHaveAttribute('aria-pressed', 'true');
  await alterado.click(); // tocar de nuevo la opción elegida la quita
  await expect(alterado).toHaveAttribute('aria-pressed', 'false');

  await indice.getByRole('button', { name: /Pruebas semiológicas/ }).click();
  await expect(page.getByRole('group', { name: 'Lachman' })).toBeVisible();
  await page.getByRole('switch', { name: 'No evaluado' }).check();
  await expect(page.getByRole('group', { name: 'Lachman' })).toHaveCount(0);
  await expect(page.getByText('Quedará registrada como no evaluada')).toBeVisible();
  await expect(indice.getByRole('button', { name: /Pruebas semiológicas \(no evaluada\)/ })).toBeVisible();

  const estado = page.getByRole('group', { name: 'Estado del guardado (demostración)' });
  await estado.getByRole('button', { name: 'Sin conexión' }).click();
  await expect(page.locator('.estado-guardado')).toContainText('Sin conexión: se guardará cuando vuelva la señal');
  await estado.getByRole('button', { name: 'Guardado' }).click();
  await expect(page.locator('.estado-guardado')).toContainText('Guardado hace');
  await page.context().close();
});

test('CP-UI-SAL-007 [RNF-08] La foto se reduce a 1600 px antes de subirla; también acepta PDF y rechaza otros archivos', async ({ browser }) => {
  const page = await abrir(browser, 'celular');
  await page.getByRole('button', { name: /Siguiente/ }).click();
  await page.getByRole('button', { name: /Siguiente/ }).click();
  await page.getByRole('button', { name: /Siguiente/ }).click();
  await expect(page.getByRole('heading', { name: 'Fotos y documentos' })).toBeVisible();
  // El botón "Tomar foto" abre la cámara trasera
  await expect(page.locator('#cat-foto-camara')).toHaveAttribute('capture', 'environment');

  // Foto de 3000 × 2000 px generada en el navegador
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 3000; c.height = 2000;
    const g = c.getContext('2d'); g.fillStyle = '#0A7F39'; g.fillRect(0, 0, 3000, 2000); g.fillStyle = '#B5F23D'; g.fillRect(500, 500, 2000, 1000);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#cat-foto-archivo').setInputFiles({ name: 'postura.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.locator('.campo-foto-info')).toContainText('1600 × 1067 px');
  await expect(page.getByRole('img', { name: 'Vista previa: Foto de la vista anterior' })).toBeVisible();

  await page.getByRole('button', { name: /Quitar/ }).click();
  await page.locator('#cat-foto-archivo').setInputFiles({ name: 'consentimiento.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') });
  await expect(page.locator('.campo-foto-pdf')).toContainText('consentimiento.pdf');

  await page.getByRole('button', { name: /Quitar/ }).click();
  await page.locator('#cat-foto-archivo').setInputFiles({ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') });
  await expect(page.getByRole('alert')).toContainText('Elige una foto o un PDF.');
  expect(await desborde(page)).toBeLessThanOrEqual(0);
  await page.context().close();
});
