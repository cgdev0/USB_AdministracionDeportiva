// Recorrido completo por rol: 13 módulos × 4 anchos (RF-04, RF-05, RNF-04; métricas M-P1 y M-F4)
// Para cada combinación verifica: acceso o redirección según el rol, sin errores y sin desborde horizontal.
const { test, expect } = require('@playwright/test');
const { ANCHOS, modulos, entrar, vigilar, desborde, guardarMetrica } = require('./ayuda');

const ROLES = [
  ['administrador', 'administrador'],
  ['head_coach', 'head_coach'],
  ['entrenador', 'entrenador'],
  ['salud', 'personal_salud'],
  ['jugador', 'jugador'],
];

ROLES.forEach(([cuenta, rol], i) => {
  test(`CP-UI-REC-00${i + 1} [RF-04] [RF-05] Recorrido de ${rol}: 13 módulos en 4 anchos`, async ({ page }) => {
    const MODULOS = await modulos();
    const problemas = vigilar(page);
    await entrar(page, cuenta);
    const filas = [];

    for (const [ancho, tamano] of Object.entries(ANCHOS)) {
      await page.setViewportSize(tamano);
      for (const m of MODULOS) {
        problemas.length = 0;
        await page.goto(m.ruta);
        await page.waitForLoadState('networkidle');
        const permitido = rol === 'administrador' || m.roles.includes(rol);
        const esperado = permitido ? m.ruta : '/';
        const destino = new URL(page.url()).pathname;
        const d = await desborde(page);
        filas.push({ rol, ancho, ruta: m.ruta, permitido, destino, desborde: d, problemas: [...problemas],
          ok: destino === esperado && d <= 0 && problemas.length === 0 });
        expect.soft(destino, `${m.ruta} (${ancho}) debe ${permitido ? 'abrir' : 'redirigir al inicio'}`).toBe(esperado);
        expect.soft(d, `${m.ruta} (${ancho}) sin desborde horizontal`).toBeLessThanOrEqual(0);
        expect.soft(problemas, `${m.ruta} (${ancho}) sin errores`).toEqual([]);
      }
    }
    guardarMetrica(`recorrido-${rol}`, filas);
  });
});
