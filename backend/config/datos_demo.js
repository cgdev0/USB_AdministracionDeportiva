// Datos de demostración para desarrollo local: un plantel de rugby completo con dorsales,
// lesiones, controles médicos, entrenamientos con asistencia y el próximo partido.
// Las fechas se calculan desde hoy, así el inicio siempre se ve con información actual.
//   npm run demo        (después de npm run db:init y npm run seed)
// Es seguro ejecutarlo varias veces: si el equipo de demostración ya existe, no hace nada.
// No usar con usuarios reales. En Railway se carga solo si DATOS_DEMO=1 (versión para el tester).
const pool = require('./db');
const { crearUsuario, informar } = require('./seed');

const EQUIPO = 'Unisimón Rugby (demo)';
const JUGADORES = [
  [1, 'Andrés Torres', 'Pilar'], [2, 'Pedro Ramírez', 'Hooker'], [3, 'Carlos Méndez', 'Pilar'],
  [4, 'Luis García', 'Segunda línea'], [5, 'Miguel Flores', 'Segunda línea'], [6, 'Jhon Pabón', 'Ala'],
  [7, 'Andrés Contreras', 'Ala'], [8, 'Kevin Villamizar', 'Octavo'], [9, 'Sebastián Peñaranda', 'Medio scrum'],
  [10, 'Daniel Rincón', 'Apertura'], [11, 'Brayan Jaimes', 'Wing'], [12, 'Felipe Ortega', 'Centro'],
  [13, 'Santiago Sandoval', 'Centro'], [14, 'Julián Duarte', 'Wing'], [15, 'Mateo Carrillo', 'Fullback'],
  [16, 'Óscar Bautista', 'Hooker'], [17, 'Camilo Quintero', 'Pilar'], [18, 'Diego Suárez', 'Segunda línea'],
  [19, 'Nicolás Galvis', 'Ala'], [20, 'Juan Rojas', 'Medio scrum'], [21, 'Samuel Parada', 'Apertura'],
  [22, 'Esteban Mora', 'Centro'], [23, 'Tomás Ibarra', 'Wing'],
];

// Head coach de prueba asociado al entrenador. Su clave sigue las mismas reglas que seed.js.
async function asegurarHeadCoach(client) {
  const usuario = { nombre: 'Head Coach Demo', email: 'headcoach@dtdeportivo.com', rol: 'head_coach' };
  informar(usuario, await crearUsuario(client, usuario));
  const { rows: [hc] } = await client.query(
    `UPDATE usuarios SET rol = 'head_coach' WHERE email = $1 RETURNING id`, [usuario.email]);
  await client.query(
    `UPDATE usuarios SET head_coach_id = $1
     WHERE id = (SELECT id FROM usuarios WHERE rol = 'entrenador' ORDER BY id LIMIT 1)`, [hc.id]);
}

// v2.7 (T0.1): documentos ficticios, EPS y contacto de emergencia del plantel, y un deportista menor de edad
// (#23) con su acudiente. Solo completa a quien aún no tiene documento: así también se completa el plantel que
// ya estaba cargado en Railway antes de la v2.7, sin tocar lo que alguien haya corregido a mano.
const EPS_DEMO = ['Nueva EPS', 'Sanitas', 'Sura', 'Coosalud', 'Salud Total'];
const DORSAL_MENOR = 23;
async function completarIdentificacion(client, equipoId) {
  const { rows } = await client.query(
    'SELECT id, dorsal FROM jugadores WHERE equipo_id = $1 AND numero_documento IS NULL ORDER BY dorsal', [equipoId]);
  for (const { id, dorsal } of rows) {
    const dos = String(dorsal).padStart(2, '0');
    const menor = dorsal === DORSAL_MENOR;
    await client.query(
      `UPDATE jugadores SET tipo_documento = $2, numero_documento = $3, telefono = $4, eps = $5,
         municipio_residencia = 'Cúcuta', zona_residencia = 'urbana', nacionalidad = 'CO',
         contacto_emergencia_nombre = $6, contacto_emergencia_parentesco = $7, contacto_emergencia_telefono = $8,
         fecha_nacimiento = CASE WHEN $9::boolean THEN (CURRENT_DATE - INTERVAL '17 years 2 months')::date ELSE fecha_nacimiento END,
         edad = CASE WHEN $9::boolean THEN NULL ELSE edad END,
         acudiente_nombre = CASE WHEN $9::boolean THEN 'María Ibarra (demo)' ELSE acudiente_nombre END,
         acudiente_tipo_documento = CASE WHEN $9::boolean THEN 'CC' ELSE acudiente_tipo_documento END,
         acudiente_numero_documento = CASE WHEN $9::boolean THEN '60000000' ELSE acudiente_numero_documento END,
         acudiente_parentesco = CASE WHEN $9::boolean THEN 'Madre' ELSE acudiente_parentesco END,
         acudiente_telefono = CASE WHEN $9::boolean THEN '3000000099' ELSE acudiente_telefono END
       WHERE id = $1`,
      [id, menor ? 'TI' : 'CC', `10900000${dos}`, `30000000${dos}`, EPS_DEMO[dorsal % EPS_DEMO.length],
       menor ? 'María Ibarra (demo)' : 'Contacto de emergencia (demo)', menor ? 'Madre' : 'Madre', `31000000${dos}`, menor]);
  }
  return rows.length;
}

// v2.9 (T2.9): consentimientos y aceptaciones de demostración en distintos estados, con un PDF de demostración como
// papel firmado (para que "Ver papel" funcione). Solo si el plantel de demostración aún no tiene consentimientos:
// así también se completa el plantel que ya estaba cargado en Railway, sin repetir nada.
const PAPEL_DEMO = Buffer.from('%PDF-1.4\n% Documento de demostracion: consentimiento ficticio, sin valor legal\n%%EOF\n');
async function completarConsentimientos(client, equipoId) {
  if (process.env.DEMO_SIN_CONSENTIMIENTOS === '1') return 0;
  const { rows: [{ n }] } = await client.query(
    'SELECT COUNT(*)::int AS n FROM consentimientos c JOIN jugadores j ON j.id = c.jugador_id WHERE j.equipo_id = $1', [equipoId]);
  if (n > 0) return 0;
  const crypto = require('crypto');
  const fs = require('fs');
  const path = require('path');
  const { pathToFileURL } = require('url');
  const { CLINICO_DIR } = require('./archivos');
  const { datosDeQuienAtiende } = require('../utils/quienAtiende');
  const utilidad = (f) => import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', f)).href);
  const [{ VERSION_FORMATO }, { avisoDeportista, textoCanonico }] = await Promise.all([utilidad('consentimientos.js'), utilidad('avisos.js')]);
  const { rows: [salud] } = await client.query(`SELECT id, nombre FROM usuarios WHERE email = 'salud@dtdeportivo.com'`);
  if (!salud) return 0;
  const qa = await datosDeQuienAtiende(client, salud.id);
  const { rows } = await client.query(
    `SELECT id, dorsal, nombre, tipo_documento, numero_documento, acudiente_nombre, acudiente_tipo_documento, acudiente_numero_documento, acudiente_parentesco
       FROM jugadores WHERE equipo_id = $1`, [equipoId]);
  const porDorsal = Object.fromEntries(rows.map(j => [j.dorsal, j]));
  await fs.promises.mkdir(CLINICO_DIR, { recursive: true, mode: 0o700 });
  const sha = crypto.createHash('sha256').update(PAPEL_DEMO).digest('hex');
  let creados = 0;
  const registrar = async (dorsal, tipo, estado, { menor = false, asentimiento = null, diasAtras = 20, motivo = null, revoca = null } = {}) => {
    const j = porDorsal[dorsal];
    if (!j) return null;
    let archivoId = null;
    if (estado === 'firmado') {
      const nombre = `${crypto.randomUUID()}.pdf`;
      await fs.promises.writeFile(path.join(CLINICO_DIR, nombre), PAPEL_DEMO, { mode: 0o600 });
      const { rows: [a] } = await client.query(
        `INSERT INTO archivos_clinicos (jugador_id, tipo, nombre_archivo, nombre_original, mime, tamano, sha256, descripcion, subido_por)
         VALUES ($1, 'consentimiento', $2, 'consentimiento-demo.pdf', 'application/pdf', $3, $4, $5, $6) RETURNING id`,
        [j.id, nombre, PAPEL_DEMO.length, sha, `Consentimiento de demostración: ${tipo}`, salud.id]);
      archivoId = a.id;
    }
    const firmante = estado === 'revocado' ? {} : menor
      ? { firma_quien: 'acudiente', firmante_nombre: j.acudiente_nombre, firmante_tipo_documento: j.acudiente_tipo_documento, firmante_numero_documento: j.acudiente_numero_documento, firmante_parentesco: j.acudiente_parentesco }
      : { firma_quien: 'deportista', firmante_nombre: j.nombre, firmante_tipo_documento: j.tipo_documento, firmante_numero_documento: j.numero_documento };
    const { rows: [c] } = await client.query(
      `INSERT INTO consentimientos (jugador_id, tipo, estado, fecha, firma_quien, firmante_nombre, firmante_tipo_documento, firmante_numero_documento,
                                    firmante_parentesco, asentimiento, archivo_id, version_formato, motivo, revoca_id, registrado_por, quien_atiende, registrado_en)
       VALUES ($1, $2, $3, CURRENT_DATE - $4::int, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now() - ($4::int || ' days')::interval)
       RETURNING id`,
      [j.id, tipo, estado, diasAtras, firmante.firma_quien || null, firmante.firmante_nombre || null, firmante.firmante_tipo_documento || null,
       firmante.firmante_numero_documento || null, firmante.firmante_parentesco || null, asentimiento, archivoId, VERSION_FORMATO, motivo, revoca, salud.id, qa]);
    creados++;
    // La autorización de datos firmada en papel cuenta como la aceptación del aviso (T2.6)
    if (tipo === 'datos_personales' && estado === 'firmado') {
      const aviso = avisoDeportista({ menor });
      await client.query(
        `INSERT INTO aceptaciones (aviso, version, texto_sha256, via, jugador_id, aceptante_nombre, testigo_id, consentimiento_id, usuario_nombre, usuario_rol)
         VALUES ('aviso_deportista', $1, $2, 'papel', $3, $4, $5, $6, $7, 'personal_salud')`,
        [aviso.version, crypto.createHash('sha256').update(textoCanonico(aviso), 'utf8').digest('hex'), j.id, firmante.firmante_nombre, salud.id, c.id, salud.nombre]);
    }
    return c.id;
  };
  await registrar(2, 'atencion', 'firmado');
  await registrar(2, 'datos_personales', 'firmado');
  await registrar(9, 'atencion', 'firmado', { diasAtras: 30 });
  await registrar(9, 'datos_personales', 'firmado', { diasAtras: 30 });
  await registrar(9, 'investigacion', 'rechazado', { diasAtras: 30, motivo: 'No desea participar en estudios' });
  const revocado = await registrar(10, 'atencion', 'firmado', { diasAtras: 40 });
  if (revocado) await registrar(10, 'atencion', 'revocado', { diasAtras: 5, motivo: 'Prefiere atenderse con su EPS', revoca: revocado });
  await registrar(15, 'atencion', 'firmado', { diasAtras: 10 });
  await registrar(DORSAL_MENOR, 'atencion', 'firmado', { menor: true, asentimiento: true });
  await registrar(DORSAL_MENOR, 'investigacion', 'firmado', { menor: true, asentimiento: false });
  // #15 aceptó el aviso de privacidad en la tableta del profesional (testigo: la cuenta de salud)
  if (porDorsal[15]) {
    const aviso = avisoDeportista();
    await client.query(
      `INSERT INTO aceptaciones (aviso, version, texto_sha256, via, jugador_id, aceptante_nombre, testigo_id, usuario_nombre, usuario_rol)
       VALUES ('aviso_deportista', $1, $2, 'tableta', $3, $4, $5, $6, 'personal_salud')`,
      [aviso.version, crypto.createHash('sha256').update(textoCanonico(aviso), 'utf8').digest('hex'), porDorsal[15].id, porDorsal[15].nombre, salud.id, salud.nombre]);
  }
  return creados;
}

async function run() {
  const client = await pool.connect();
  try {
    await asegurarHeadCoach(client);
    // v2.7 (T0.2): la cuenta de salud de demostración es fisioterapeuta profesional (solo si aún no tiene datos)
    await client.query(`UPDATE usuarios SET profesion = 'fisioterapia', vinculo = 'profesional'
      WHERE email = 'salud@dtdeportivo.com' AND profesion IS NULL AND vinculo IS NULL`);
    const { rows: existe } = await client.query('SELECT id FROM equipos WHERE nombre = $1', [EQUIPO]);
    if (existe.length) {
      const completados = await completarIdentificacion(client, existe[0].id);
      const consentimientos = await completarConsentimientos(client, existe[0].id);
      console.log(`ℹ️  El plantel de demostración ya existe; se verificó el head coach de prueba${completados ? ` y se completó la identificación de ${completados} deportistas` : ''}${consentimientos ? ` y se agregaron ${consentimientos} consentimientos de demostración` : ''}.`);
      return;
    }

    await client.query('BEGIN');
    const { rows: [rugby] } = await client.query(
      `INSERT INTO disciplinas (nombre) VALUES ('Rugby') ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id`);
    const { rows: [equipo] } = await client.query(
      `INSERT INTO equipos (nombre, categoria, disciplina_id) VALUES ($1, 'Primera', $2) RETURNING id`, [EQUIPO, rugby.id]);
    const { rows: entrenador } = await client.query(`SELECT id FROM usuarios WHERE rol = 'entrenador' ORDER BY id LIMIT 1`);
    const { rows: salud } = await client.query(`SELECT id FROM usuarios WHERE rol = 'personal_salud' ORDER BY id LIMIT 1`);
    const entrenadorId = entrenador[0]?.id || null;
    const saludId = salud[0]?.id || null;

    const ids = {};
    for (const [dorsal, nombre, posicion] of JUGADORES) {
      const { rows: [j] } = await client.query(
        // v2.9 (T2.6, D11): datos de demostración, sin autorización exigida (autorizacion_previa)
        `INSERT INTO jugadores (nombre, edad, posicion, dorsal, equipo_id, disciplina_id, entrenador_id, genero, autorizacion_previa)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'masculino', TRUE) RETURNING id`,
        [nombre, 19 + (dorsal % 9), posicion, dorsal, equipo.id, rugby.id, entrenadorId]);
      ids[dorsal] = j.id;
    }

    // Lesiones activas (con seguimiento y retorno estimado)
    const lesiones = [[2, 'Esguince de tobillo', 9, 10], [14, 'Desgarro de isquiotibial', 15, 6], [22, 'Contusión de hombro', 4, 12]];
    for (const [dorsal, tipo, haceDias, retornoEnDias] of lesiones) {
      const { rows: [l] } = await client.query(
        `INSERT INTO lesiones (jugador_id, tipo, descripcion, fecha_inicio) VALUES ($1, $2, 'Registrada en entrenamiento', CURRENT_DATE - $3::int) RETURNING id`,
        [ids[dorsal], tipo, haceDias]);
      await client.query(
        `INSERT INTO seguimiento_lesiones (lesion_id, gravedad, evolucion, fecha_seguimiento, fecha_retorno_estimada, estado, profesional_id)
         VALUES ($1, 'moderada', 'Evolución favorable', CURRENT_DATE - 1, CURRENT_DATE + $2::int, 'en_recuperacion', $3)`,
        [l.id, retornoEnDias, saludId]);
    }

    // Controles médicos: dos con restricciones, uno vencido, el resto apto
    for (const [dorsal] of JUGADORES) {
      let aptitud = 'apto', restricciones = null, proxima = 'CURRENT_DATE + 60';
      if (dorsal === 7) { aptitud = 'apto_restricciones'; restricciones = 'Sin contacto en el scrum por 5 días'; }
      if (dorsal === 18) { aptitud = 'apto_restricciones'; restricciones = 'Máximo 40 minutos de juego'; }
      if (dorsal === 10) proxima = 'CURRENT_DATE - 3';
      await client.query(
        `INSERT INTO controles_medicos (jugador_id, fecha, proxima_fecha, tipo, aptitud, restricciones, profesional_id)
         VALUES ($1, CURRENT_DATE - 20, ${proxima}, 'Control precompetitivo', $2, $3, $4)`,
        [ids[dorsal], aptitud, restricciones, saludId]);
    }

    // Entrenamientos pasados con asistencia
    const pasados = [[8, 'Resistencia', 21], [6, 'Fuerza', 20], [3, 'Táctica', 18], [1, 'Resistencia', 22]];
    for (const [haceDias, tipo, presentes] of pasados) {
      const { rows: [e] } = await client.query(
        `INSERT INTO entrenamientos (fecha, tipo, descripcion, equipo_id, hora, lugar)
         VALUES (CURRENT_DATE - $1::int, $2, 'Sesión del plantel de rugby', $3, '17:30', 'Cancha sintética') RETURNING id`,
        [haceDias, tipo, equipo.id]);
      for (const [dorsal] of JUGADORES) {
        await client.query(
          'INSERT INTO asistencia_entrenamiento (jugador_id, entrenamiento_id, asistencia) VALUES ($1, $2, $3)',
          [ids[dorsal], e.id, dorsal <= presentes]);
      }
    }

    // Próximos días: partido y entrenamientos
    await client.query(`INSERT INTO partidos (fecha, rival, tipo, equipo_id, hora, lugar)
      VALUES (CURRENT_DATE + 1, 'Deportivo Sur', 'liga', $1, '15:00', 'Estadio General Santander')`, [equipo.id]);
    await client.query(`INSERT INTO entrenamientos (fecha, tipo, descripcion, equipo_id, hora, lugar) VALUES
      (CURRENT_DATE + 2, 'Fuerza y recuperación', 'Trabajo de fuerza y movilidad', $1, '06:00', 'Gimnasio'),
      (CURRENT_DATE + 4, 'Táctica: salidas y line-out', 'Salidas de juego y line-out', $1, '17:30', 'Cancha sintética'),
      (CURRENT_DATE + 6, 'Resistencia', 'Intervalos de resistencia', $1, '17:30', 'Pista atlética')`, [equipo.id]);

    // Estadísticas de anotación
    // v2.1: con las métricas propias del rugby (tries, conversiones, penales, pases de try, tackles, minutos)
    for (const [dorsal, tries, conv, pen, pases, tackles] of [
      [10, 1, 6, 3, 2, 5], [11, 3, 0, 0, 1, 4], [15, 2, 0, 0, 1, 6], [9, 1, 0, 0, 3, 7], [12, 1, 0, 0, 1, 9],
      [10, 0, 3, 2, 2, 4], [11, 2, 0, 0, 0, 3], [6, 0, 0, 0, 0, 14], [7, 1, 0, 0, 0, 12], [2, 0, 0, 0, 0, 11]]) {
      const metricas = { tries, conversiones: conv, penales: pen, drops: 0, pases_try: pases, tackles, minutos: 80 };
      await client.query(
        `INSERT INTO estadisticas_jugador (jugador_id, goles, asistencias, minutos_jugados, metricas) VALUES ($1, $2, $3, 80, $4)`,
        [ids[dorsal], tries, pases, metricas]);
    }

    await completarIdentificacion(client, equipo.id);
    await completarConsentimientos(client, equipo.id); // v2.9 (T2.9)

    // El usuario jugador de prueba queda vinculado al #9
    await client.query(`UPDATE usuarios SET jugador_id = $1 WHERE email = 'jugador@dtdeportivo.com'`, [ids[9]]);

    await client.query('COMMIT');
    console.log(`✅  Datos de demostración creados: ${JUGADORES.length} jugadores en "${EQUIPO}".`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Se ejecuta como script (npm run demo, despliegue); las pruebas importan completarConsentimientos
if (require.main === module) run().catch(err => { console.error('❌ ', err.message); process.exitCode = 1; });
module.exports = { completarConsentimientos, EQUIPO };
