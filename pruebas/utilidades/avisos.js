// Aceptación de los avisos de las cuentas de prueba (v2.9, T2.5 del plan de historia clínica).
// Sin aceptar su aviso nadie trabaja con datos. Las pruebas de navegador empiezan con las cuentas de prueba
// ya aceptadas, como quedarían después de su primer inicio de sesión. Se calcula con el mismo módulo de textos y la
// misma huella que usa el servidor (backend/controllers/avisos.controller.js). Las pruebas del aviso usan cuentas
// nuevas, que siempre empiezan sin aceptar.
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { Client } = require(path.join(__dirname, '..', '..', 'node_modules', 'pg'));
const { credenciales, BD_PRUEBAS, RAIZ } = require('./bd');
const CUENTAS = require('./cuentas');

const utilidad = (archivo) => import(pathToFileURL(path.join(RAIZ, 'frontend', 'src', 'utils', archivo)).href);

async function aceptarAvisosDePrueba() {
  const [{ compromisoPara, avisoDeportista, textoCanonico, ROLES_PERSONAL }, { esMenorDeEdad }] = await Promise.all([utilidad('avisos.js'), utilidad('identificacion.js')]);
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const c = new Client(credenciales(BD_PRUEBAS));
  await c.connect();
  try {
    const { rows } = await c.query(
      `SELECT u.id, u.nombre, u.rol, u.jugador_id, j.fecha_nacimiento, j.edad FROM usuarios u LEFT JOIN jugadores j ON j.id = u.jugador_id
        WHERE u.email = ANY($1)`, [Object.values(CUENTAS).map(([email]) => email)]);
    for (const u of rows) {
      const aviso = ROLES_PERSONAL.includes(u.rol) ? compromisoPara(u.rol) : avisoDeportista({ menor: !!u.jugador_id && esMenorDeEdad(u, hoy) });
      const huella = crypto.createHash('sha256').update(textoCanonico(aviso), 'utf8').digest('hex');
      await c.query(
        `INSERT INTO aceptaciones (aviso, version, texto_sha256, via, usuario_id, usuario_nombre, usuario_rol, jugador_id, aceptante_nombre)
         SELECT $1::varchar, $2::varchar, $3, 'cuenta', $4::int, $5::varchar, $6, $7, $5::varchar
          WHERE NOT EXISTS (SELECT 1 FROM aceptaciones WHERE usuario_id = $4::int AND aviso = $1::varchar AND version = $2::varchar)`,
        [aviso.aviso, aviso.version, huella, u.id, u.nombre, u.rol, u.rol === 'jugador' ? u.jugador_id : null]);
    }
  } finally {
    await c.end();
  }
}

module.exports = { aceptarAvisosDePrueba };
