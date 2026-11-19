// Ayudante para las pruebas de API: levanta la app contra la base de pruebas,
// hace peticiones, inicia sesión y cronometra cada respuesta (métrica M-E1).
const fs = require('fs');
const path = require('path');
const { ENV_PRUEBAS, RAIZ } = require('./bd');

// La app y su conexión deben cargarse DESPUÉS de fijar el entorno de pruebas.
Object.assign(process.env, ENV_PRUEBAS);
const app = require(path.join(RAIZ, 'api', 'index.js'));
const pool = require(path.join(RAIZ, 'backend', 'config', 'db.js'));

const CUENTAS = require('./cuentas');

const tiempos = [];
let servidor = null;
let base = '';

// v2.9 (T2.6): versión vigente de las declaraciones (frontend/src/utils/avisos.js), para conDeclaracion
let VERSIONES = null;
async function iniciar() {
  VERSIONES = (await import(require('url').pathToFileURL(path.join(RAIZ, 'frontend', 'src', 'utils', 'avisos.js')).href)).VERSIONES_AVISO;
  await new Promise(resolve => { servidor = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${servidor.address().port}`;
}

async function cerrar(nombreArchivo) {
  if (servidor) await new Promise(resolve => servidor.close(resolve));
  await pool.end();
  if (nombreArchivo && tiempos.length) {
    const dir = path.join(RAIZ, 'pruebas', 'resultados');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `tiempos-${path.basename(nombreArchivo, '.test.js')}.json`), JSON.stringify(tiempos));
  }
}

async function llamar(metodo, ruta, token, cuerpo) {
  const inicio = performance.now();
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const ms = performance.now() - inicio;
  tiempos.push({ metodo, ruta: ruta.replace(/\/\d+/g, '/:id').split('?')[0], status: res.status, ms: Math.round(ms * 10) / 10 });
  let datos = null;
  try { datos = await res.json(); } catch { /* respuesta sin cuerpo JSON */ }
  return { status: res.status, datos };
}

// Envío multipart (archivos), por ejemplo la carga de usuarios por CSV
async function llamarFormulario(ruta, token, formulario) {
  const res = await fetch(base + ruta, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formulario });
  let datos = null;
  try { datos = await res.json(); } catch { /* sin cuerpo JSON */ }
  return { status: res.status, datos };
}

// Petición sin procesar: cuerpo tal cual (por ejemplo, JSON mal formado) y acceso a las cabeceras
async function llamarCrudo(metodo, ruta, { headers = {}, body } = {}) {
  const res = await fetch(base + ruta, { method: metodo, headers, body });
  let datos = null;
  try { datos = await res.json(); } catch { /* sin cuerpo JSON */ }
  return { status: res.status, datos, headers: res.headers };
}

// v2.7 (T0.5): descarga binaria (archivos clínicos) con sus cabeceras
async function descargar(ruta, token) {
  const res = await fetch(base + ruta, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: res.status, headers: res.headers, buffer: Buffer.from(await res.arrayBuffer()) };
}

// v2.9 (T2.5): sin aceptar su aviso nadie trabaja con datos, así que la sesión de prueba lo acepta, como haría la
// persona. Con { aceptar: false } queda pendiente (pruebas de los avisos). `credenciales`: [email, clave] de otra cuenta.
async function aceptarAviso(tk) {
  const { datos } = await llamar('GET', '/api/avisos/mios', tk);
  if (datos?.aviso && !datos.aceptado) {
    const r = await llamar('POST', '/api/avisos/aceptar', tk, { aviso: datos.aviso.aviso, version: datos.aviso.version, acepto: true });
    if (r.status >= 300) throw new Error(`No se pudo aceptar el aviso: ${r.status} ${JSON.stringify(r.datos)}`);
  }
}
async function token(rol, { aceptar = true, credenciales = null } = {}) {
  const [email, password] = credenciales || CUENTAS[rol];
  const r = await llamar('POST', '/api/auth/login', null, { email, password });
  if (r.status !== 200) throw new Error(`No se pudo iniciar sesión como ${rol}: ${r.status}`);
  if (aceptar) await aceptarAviso(r.datos.access_token);
  return r.datos.access_token;
}

// Consulta directa a la base de pruebas (para verificar efectos y limpiar)
const sql = (texto, params) => pool.query(texto, params);

// v2.7: la app nunca borra la historia clínica (valoraciones cerradas, deportistas con historia, lesiones con
// seguimiento); los triggers de la base lo impiden. La limpieza de la base de pruebas lo hace en modo mantenimiento.
async function sqlMantenimiento(texto, params) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query("SELECT set_config('dt.mantenimiento', 'on', true)");
    const r = await cliente.query(texto, params);
    await cliente.query('COMMIT');
    return r;
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    cliente.release();
  }
}

// v2.9 (T2.6): quien registra a un deportista declara que lo informó y que autorizó; con 'carga', la de una carga masiva
function conDeclaracion(cuerpo = {}, tipo = 'registro') {
  return { ...cuerpo, declaracion: { acepto: true, version: VERSIONES[tipo === 'carga' ? 'declaracion_carga' : 'declaracion_registro'] } };
}
const declaracionDeCarga = () => ({ declaracion_acepto: 'true', declaracion_version: VERSIONES.declaracion_carga });

module.exports = { iniciar, cerrar, llamar, llamarFormulario, llamarCrudo, descargar, token, aceptarAviso, sql, sqlMantenimiento, CUENTAS, conDeclaracion, declaracionDeCarga };
