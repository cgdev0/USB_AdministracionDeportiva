// Formatos de consentimiento para imprimir (v2.9, T2.2 del plan de historia clínica; RF-27, RNF-02).
// Cada formato cabe en una hoja carta, en blanco y con los datos de un deportista mayor y de uno menor de edad.
const { test, expect } = require('@playwright/test');
const { paginaEn, entrar, CUENTAS } = require('./ayuda');

const TIPOS = ['atencion', 'datos_personales', 'investigacion', 'asentimiento'];
// Páginas de un PDF: cada objeto /Type /Page (no /Pages)
const paginas = (pdf) => (pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length;

async function idPorDocumento(page, documento) {
  const [email, password] = CUENTAS.salud;
  const { access_token } = await (await page.request.post('/api/auth/login', { data: { email, password } })).json();
  const lista = await (await page.request.get('/api/pacientes', { headers: { Authorization: `Bearer ${access_token}` } })).json();
  return lista.find(p => p.numero_documento === documento).id;
}

test('CP-UI-CON-001 [RF-27] Cada formato de consentimiento cabe en una hoja carta, en blanco y con los datos del deportista', async ({ browser }) => {
  const page = await paginaEn(browser, 'pc');
  await entrar(page, 'salud');
  const mayor = await idPorDocumento(page, '1090000015');
  const menor = await idPorDocumento(page, '1090000023');
  const casos = [
    ...TIPOS.map(t => [`/formatos-consentimiento/${t}`, `${t} en blanco`]),
    ...TIPOS.map(t => [`/pacientes/${menor}/formatos/${t}`, `${t} de un menor`]),
    ...TIPOS.filter(t => t !== 'asentimiento').map(t => [`/pacientes/${mayor}/formatos/${t}`, `${t} de un mayor`]),
  ];
  for (const [ruta, nombre] of casos) {
    await page.goto(ruta);
    await expect(page.locator('.fc-hoja')).toHaveCount(1);
    await page.waitForLoadState('networkidle');
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    expect(paginas(pdf), nombre).toBe(1);
  }
  // "Los cuatro" en blanco: una hoja por formato
  await page.goto('/formatos-consentimiento/todos');
  await expect(page.locator('.fc-hoja')).toHaveCount(4);
  expect(paginas(await page.pdf({ preferCSSPageSize: true }))).toBe(4);
  await page.context().close();
});

test('CP-UI-CON-002 [RF-27][RNF-02] El formato sale diligenciado: el menor con su acudiente y su asentimiento; solo lo abre el personal de salud', async ({ browser }) => {
  const page = await paginaEn(browser, 'tableta');
  await entrar(page, 'salud');
  const menor = await idPorDocumento(page, '1090000023');
  const mayor = await idPorDocumento(page, '1090000015');
  // Menor de edad: datos del deportista y del acudiente, que es quien firma
  await page.goto(`/pacientes/${menor}/formatos/atencion`);
  const hoja = page.locator('.fc-hoja');
  await expect(hoja).toContainText('Tomás Ibarra');
  await expect(hoja.locator('.fc-datos')).toContainText('María Ibarra (demo)');
  await expect(hoja.locator('.fc-datos')).toContainText('Madre');
  await expect(hoja.locator('.fc-firmas')).toContainText('Firma del acudiente (representante legal)');
  await expect(hoja.locator('.fc-borrador')).toContainText('BORRADOR');
  await expect(hoja.locator('.fc-huella')).toHaveCount(1);
  // Los cuatro, para un menor, incluyen el asentimiento
  await page.goto(`/pacientes/${menor}/formatos/todos`);
  await expect(page.locator('.fc-hoja')).toHaveCount(4);
  // Mayor de edad: firma él mismo y el asentimiento no aplica
  await page.goto(`/pacientes/${mayor}/formatos/todos`);
  await expect(page.locator('.fc-hoja')).toHaveCount(3);
  await expect(page.locator('.fc-firmas').first()).toContainText('Firma del deportista');
  await page.goto(`/pacientes/${mayor}/formatos/asentimiento`);
  await expect(page.getByText('es mayor de edad: el asentimiento solo se firma cuando el deportista es menor')).toBeVisible();
  // La barra de la pantalla no sale en la impresión
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.fc-barra')).toBeHidden();
  await page.context().close();

  // El administrador y el entrenador no abren formatos con datos de salud
  for (const rol of ['administrador', 'entrenador']) {
    const otra = await paginaEn(browser, 'pc');
    await entrar(otra, rol);
    await otra.goto(`/pacientes/${menor}/formatos/atencion`);
    await expect(otra).toHaveURL(/\/$/);
    await otra.context().close();
  }
});
