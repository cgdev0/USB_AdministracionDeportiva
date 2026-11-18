// Guardado automático del borrador (v2.8, T1.2 del plan de historia clínica; RF-26, RNF-03).
// En el celular, con el reloj simulado y la red cortada a propósito.
const path = require('path');
const { test, expect } = require('@playwright/test');
const { paginaEn, entrar, CUENTAS } = require('./ayuda');
const { credenciales, BD_PRUEBAS, RAIZ } = require('../utilidades/bd');
const { Client } = require(path.join(RAIZ, 'node_modules', 'pg'));

const BASE = 'http://127.0.0.1:3100';
test.afterAll(async () => {
  const c = new Client(credenciales(BD_PRUEBAS));
  await c.connect();
  await c.query(`DO $$ BEGIN PERFORM set_config('dt.mantenimiento', 'on', true);
    DELETE FROM valoraciones WHERE contenido->>'motivo_consulta' LIKE 'ZZ auto%'; END $$`);
  await c.end();
});

// "Otro dispositivo": otra sesión de la misma cuenta, por la API
async function otraSesion() {
  const [email, password] = CUENTAS.salud;
  const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const { access_token } = await r.json();
  const pedir = async (metodo, ruta, cuerpo) => {
    const res = await fetch(`${BASE}${ruta}`, { method: metodo, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    return res.json();
  };
  return pedir;
}

test('CP-UI-SAL-008 [RF-26][RNF-03] El borrador se guarda solo, espera sin señal, avisa si cambió en otro dispositivo y no se pierde al salir', async ({ browser }) => {
  const page = await paginaEn(browser, 'celular');
  await page.clock.install();
  await entrar(page, 'salud');
  await page.goto('/salud');
  const opcion = page.locator('#val-jugador option', { hasText: 'Mateo Carrillo' });
  const mateo = await opcion.getAttribute('value');
  await page.locator('#val-jugador').selectOption(mateo);
  await page.getByRole('button', { name: 'Nueva valoración' }).click();
  const motivo = page.getByLabel('Motivo de consulta');
  const estado = page.locator('.modal-box .estado-guardado');
  const api = await otraSesion();
  const enServidor = async () => (await api('GET', `/api/valoraciones?jugador_id=${mateo}`))
    .find(v => v.estado === 'borrador' && v.contenido.motivo_consulta?.startsWith('ZZ auto'));

  // 1. Se guarda solo a los 20 segundos
  await motivo.fill('ZZ auto: primer texto');
  await expect(estado).toContainText('Cambios sin guardar');
  await page.clock.fastForward('00:21');
  await expect(estado).toContainText('Guardado');
  expect((await enServidor()).contenido.motivo_consulta).toBe('ZZ auto: primer texto');

  // 2. Sin señal: avisa y guarda en cuanto vuelve
  await page.context().setOffline(true);
  await motivo.fill('ZZ auto: escrito sin señal');
  await page.clock.fastForward('00:21');
  await expect(estado).toContainText('Sin conexión');
  await page.context().setOffline(false);
  await page.clock.fastForward('00:06');
  await expect(estado).toContainText('Guardado');
  expect((await enServidor()).contenido.motivo_consulta).toBe('ZZ auto: escrito sin señal');

  // 3. Otro dispositivo cambia el borrador: aquí no se pisa en silencio
  const actual = await enServidor();
  await api('PUT', `/api/valoraciones/${actual.id}`, { version: actual.version, contenido: { motivo_consulta: 'ZZ auto: desde otro dispositivo' } });
  await motivo.fill('ZZ auto: mi versión local');
  await page.clock.fastForward('00:21');
  const aviso = page.locator('.conflicto-version');
  await expect(aviso).toContainText('cambió en otro dispositivo');
  await expect(page.getByRole('button', { name: 'Cerrar y firmar' })).toBeDisabled();
  await aviso.getByRole('button', { name: 'Usar la versión guardada' }).click();
  await expect(motivo).toHaveValue('ZZ auto: desde otro dispositivo');
  await expect(aviso).toHaveCount(0);

  // 4. Salir de la página con cambios sin guardar pide confirmación
  await motivo.fill('ZZ auto: cambio sin guardar');
  const dialogo = page.waitForEvent('dialog');
  await page.close({ runBeforeUnload: true });
  const d = await dialogo;
  expect(d.type()).toBe('beforeunload');
  await d.dismiss();
  await page.context().close();
});
