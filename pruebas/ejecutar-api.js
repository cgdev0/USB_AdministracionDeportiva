// Ejecuta las pruebas unitarias y de integración contra la base de pruebas.
//   npm run test:api
// 1. Recrea la base dt_deportivo_pruebas (esquema + usuarios + plantel de demostración).
// 2. Corre los archivos de uno en uno (comparten la base) con el corredor nativo de Node.
// 3. Guarda el resultado en pruebas/resultados/api.xml (formato JUnit) para el informe.
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { prepararBaseDePruebas, BD_PRUEBAS, RAIZ } = require('./utilidades/bd');

const zonaSistema = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
// v2.2: las pruebas calculan "hoy" y "mañana" en la misma zona horaria que la app (db.js)
process.env.TZ = process.env.ZONA_HORARIA || 'America/Bogota';

(async () => {
  const resultados = path.join(RAIZ, 'pruebas', 'resultados');
  fs.mkdirSync(resultados, { recursive: true });
  for (const f of fs.readdirSync(resultados)) if (f.startsWith('tiempos-')) fs.rmSync(path.join(resultados, f));

  process.stdout.write(`Preparando la base ${BD_PRUEBAS}… `);
  await prepararBaseDePruebas();
  console.log('lista.\n');
  // Datos del entorno para el informe (versión de PostgreSQL y zona horaria del sistema)
  try {
    const { Client } = require(path.join(RAIZ, 'node_modules', 'pg'));
    const { credenciales } = require('./utilidades/bd');
    const c = new Client(credenciales(BD_PRUEBAS)); await c.connect();
    const { rows: [v] } = await c.query('SHOW server_version'); await c.end();
    fs.writeFileSync(path.join(resultados, 'entorno.json'), JSON.stringify({ postgres: `PostgreSQL ${v.server_version.split(' ')[0]}`, zona: zonaSistema }, null, 2));
  } catch { /* el informe usa valores genéricos */ }

  const r = spawnSync(process.execPath, [
    '--test', '--test-concurrency=1',
    '--test-reporter=spec', '--test-reporter-destination=stdout',
    '--test-reporter=junit', `--test-reporter-destination=${path.join('pruebas', 'resultados', 'api.xml')}`,
    'pruebas/unitarias/*.test.js', 'pruebas/integracion/*.test.js',
  ], { cwd: RAIZ, stdio: 'inherit' });
  process.exitCode = r.status ?? 1;
})().catch(err => { console.error('❌ ', err.message); process.exitCode = 1; });
