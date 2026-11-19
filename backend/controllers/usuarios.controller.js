const db     = require('../config/db');
const { hoyLocal } = require('../utils/hoy');
const { hashClave } = require('../utils/claves');
const { responderError } = require('../utils/errores');
// v2.9 (T2.6, D10): declaración de quien registra a un deportista y registro de las cargas masivas
const { revisarDeclaracion, registrarDeclaracion, registrarCarga, huella } = require('../utils/autorizaciones');
const { auditar } = require('../utils/auditoria'); // v2.9 (T2.7): gestión de cuentas en la auditoría
const path = require('path');
const { pathToFileURL } = require('url');

// v2.7 (T0.1): mismas reglas de identificación que Deportistas y los formularios
const identificacion = import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'identificacion.js')).href);
// v2.7 (T0.2): datos de quien atiende (profesión, vínculo, registro profesional y supervisor)
const { modulo: profesionales } = require('../utils/quienAtiende');

// Profesión, vínculo, registro profesional (opcional, decisión D1) y supervisor (opcional) del personal de salud.
// Para los demás roles estos datos quedan vacíos. Devuelve { cambios } o { status, error }.
async function validarProfesionales(datos, rol, usuarioId = null) {
  const { CAMPOS_PROFESIONALES, normalizarDatosProfesionales } = await profesionales;
  if (rol !== 'personal_salud') return { cambios: Object.fromEntries(CAMPOS_PROFESIONALES.map(c => [c, null])) };
  const r = normalizarDatosProfesionales(Object.fromEntries(CAMPOS_PROFESIONALES
    .filter(c => Object.prototype.hasOwnProperty.call(datos, c)).map(c => [c, datos[c]])));
  if (!r.ok) return { status: 400, error: r.error };
  const supervisor = r.cambios.supervisor_id;
  if (supervisor) {
    if (usuarioId && Number(supervisor) === Number(usuarioId)) return { status: 400, error: 'Una persona no puede supervisarse a sí misma.' };
    const { rows: [s] } = await db.query('SELECT rol, vinculo, activo FROM usuarios WHERE id = $1', [supervisor]);
    if (!s || s.rol !== 'personal_salud' || !s.activo || ['practicante', 'estudiante'].includes(s.vinculo)) {
      return { status: 400, error: 'El supervisor debe ser un profesional de salud activo (no un practicante ni un estudiante).' };
    }
  }
  return { cambios: r.cambios };
}

// GET /api/usuarios
exports.getAll = async (_req, res) => {
  try {
    const { rows } = await db.query(
      // disciplinas: deportes relacionados con la cuenta, para filtrar por deporte (v1.9). Deportista: el suyo;
      // entrenador: el asignado y los de sus deportistas; head coach: el suyo y los de sus entrenadores.
      `SELECT u.id, u.nombre, u.email, u.rol, u.jugador_id, u.head_coach_id, hc.nombre AS head_coach_nombre, u.activo, u.primer_login, u.created_at,
              u.profesion, u.vinculo, u.registro_profesional, u.supervisor_id, sup.nombre AS supervisor_nombre,
              u.disciplina_id, ARRAY(
                SELECT DISTINCT x FROM (
                  SELECT u.disciplina_id AS x
                  UNION ALL SELECT COALESCE(j.disciplina_id, eq.disciplina_id) FROM jugadores j LEFT JOIN equipos eq ON eq.id = j.equipo_id WHERE j.id = u.jugador_id
                  UNION ALL SELECT COALESCE(j.disciplina_id, eq.disciplina_id) FROM jugadores j LEFT JOIN equipos eq ON eq.id = j.equipo_id
                    WHERE j.entrenador_id = u.id OR j.entrenador_id IN (SELECT e.id FROM usuarios e WHERE e.head_coach_id = u.id)
                  UNION ALL SELECT e.disciplina_id FROM usuarios e WHERE e.head_coach_id = u.id
                ) d WHERE x IS NOT NULL
              ) AS disciplinas
       FROM usuarios u LEFT JOIN usuarios hc ON hc.id=u.head_coach_id LEFT JOIN usuarios sup ON sup.id = u.supervisor_id
       ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    responderError(res, err);
  }
};

// Edad a partir de la fecha de nacimiento ('YYYY-MM-DD'); null si no es válida o es futura
function validarNacimiento(valor) {
  if (!valor) return { ok: true, valor: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor))) return { ok: false, error: 'La fecha de nacimiento no es válida.' };
  const hoy = hoyLocal();
  if (valor > hoy || valor < '1900-01-01') return { ok: false, error: 'La fecha de nacimiento no es válida.' };
  return { ok: true, valor };
}

// POST /api/usuarios
// v2.0: al crear un deportista se crea también su ficha en el plantel (deporte, equipo, posición y fecha de
// nacimiento) y queda vinculada a la cuenta. Antes había que hacerlo por separado en Deportistas.
exports.create = async (req, res) => {
  const { nombre, email, password, rol, jugador_id, head_coach_id, disciplina_id } = req.body;
  if (!nombre || !email || !password || !rol)
    return res.status(400).json({ error: 'nombre, email, password y rol son obligatorios' });

  const rolesPermitidos = ['administrador', 'head_coach', 'entrenador', 'personal_salud', 'jugador'];
  if (!rolesPermitidos.includes(rol))
    return res.status(400).json({ error: 'Rol inválido' });

  // Entrenador solo puede crear jugador y personal_salud
  if (req.usuario.rol === 'entrenador' && !['jugador', 'personal_salud'].includes(rol))
    return res.status(403).json({ error: 'El entrenador solo puede crear usuarios de tipo jugador o personal_salud' });

  const ficha = req.body.ficha || null;
  const nacimiento = validarNacimiento(ficha?.fecha_nacimiento);
  if (!nacimiento.ok) return res.status(400).json({ error: nacimiento.error });
  if (rol === 'jugador' && !jugador_id && !ficha?.disciplina_id) {
    return res.status(400).json({ error: 'Elige el deporte del deportista.' });
  }
  // v2.7: documento, contacto y acudiente de la ficha nueva (el acudiente es obligatorio si es menor de edad)
  let identFicha = {};
  if (rol === 'jugador' && !jugador_id) {
    const { CAMPOS_IDENTIFICACION, normalizarIdentificacion, faltaAcudiente, MENSAJE_ACUDIENTE } = await identificacion;
    const r = normalizarIdentificacion(Object.fromEntries(CAMPOS_IDENTIFICACION
      .filter(c => Object.prototype.hasOwnProperty.call(ficha, c)).map(c => [c, ficha[c]])));
    if (!r.ok) return res.status(r.status).json({ error: r.error });
    if (faltaAcudiente({ fecha_nacimiento: nacimiento.valor, ...r.cambios }, hoyLocal())) {
      return res.status(400).json({ error: MENSAJE_ACUDIENTE });
    }
    identFicha = r.cambios;
  }
  const prof = await validarProfesionales(req.body, rol);
  if (prof.error) return res.status(prof.status).json({ error: prof.error });
  // v2.9 (T2.6): si se crea la ficha de un deportista nuevo, quien lo registra declara que lo informó y autorizó.
  // (Vincular la cuenta a un deportista que ya existe no lo registra de nuevo: él aceptará su aviso al entrar.)
  let declaracion = null;
  if (rol === 'jugador' && !jugador_id) {
    declaracion = await revisarDeclaracion(req.body, 'declaracion_registro');
    if (!declaracion.ok) return res.status(declaracion.status).json({ error: declaracion.error });
  }

  const cliente = await db.connect();
  try {
    const { password_hash: hash, salt } = await hashClave(password);
    await cliente.query('BEGIN');
    let jugadorId = jugador_id || null;
    if (rol === 'jugador' && !jugadorId) {
      const genero = ['masculino', 'femenino'].includes(ficha.genero) ? ficha.genero : null;
      // v2.7: columnas de identificación ya validadas (solo nombres de la lista blanca de identificacion.js)
      const extra = Object.keys(identFicha);
      const columnasExtra = extra.map(c => `, ${c}`).join('');
      const marcasExtra = extra.map((_, i) => `, $${i + 8}`).join('');
      const { rows: [j] } = await cliente.query(
        `INSERT INTO jugadores (nombre, fecha_nacimiento, edad, genero, posicion, disciplina_id, equipo_id, entrenador_id${columnasExtra})
         VALUES ($1, $2::date, CASE WHEN $2::date IS NULL THEN NULL ELSE date_part('year', age($2::date))::int END, $3, $4, $5, $6, $7${marcasExtra})
         RETURNING id`,
        [String(nombre).trim(), nacimiento.valor, genero, ficha.posicion || null, ficha.disciplina_id,
         ficha.equipo_id || null, ficha.entrenador_id || null, ...extra.map(c => identFicha[c])]);
      jugadorId = j.id;
      await registrarDeclaracion(cliente, req, declaracion, { jugadorId });
    }
    const { rows } = await cliente.query(
      `INSERT INTO usuarios (nombre, email, password_hash, salt, rol, jugador_id, head_coach_id, disciplina_id,
                             profesion, vinculo, registro_profesional, supervisor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [nombre, email.toLowerCase().trim(), hash, salt, rol, jugadorId, head_coach_id || null,
       ['entrenador', 'head_coach'].includes(rol) ? disciplina_id || null : null,
       prof.cambios.profesion ?? null, prof.cambios.vinculo ?? null, prof.cambios.registro_profesional ?? null, prof.cambios.supervisor_id ?? null]
    );
    await auditar(req, { accion: 'crear', recurso: 'usuario', recurso_id: rows[0].id, detalle: { nombre, email: email.toLowerCase().trim(), rol } }, cliente);
    if (declaracion) await auditar(req, { accion: 'crear', recurso: 'deportista', recurso_id: jugadorId, detalle: { nombre: String(nombre).trim(), desde: 'cuenta' } }, cliente);
    await cliente.query('COMMIT');
    res.status(201).json({ id: rows[0].id, nombre, email, rol, jugador_id: jugadorId, activo: true, primer_login: true });
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    // El documento repetido tiene su propio mensaje (errores.js); cualquier otro duplicado es el email
    if (err.code === '23505' && err.constraint !== 'uq_jugadores_documento') return res.status(409).json({ error: 'El email ya está registrado' });
    responderError(res, err);
  } finally {
    cliente.release();
  }
};

// PUT /api/usuarios/:id
exports.update = async (req, res) => {
  const { nombre, email, rol, activo } = req.body;
  const rolesPermitidos = ['administrador', 'head_coach', 'entrenador', 'personal_salud', 'jugador'];
  if (!rolesPermitidos.includes(rol)) return res.status(400).json({ error: 'Rol inválido' });
  // DEF-032: los vínculos que no vienen en la petición se conservan (antes, editar el nombre de un deportista
  // desde Usuarios borraba su vínculo con el plantel). El deporte asignado solo aplica a entrenador y head coach.
  const viene = (campo) => Object.prototype.hasOwnProperty.call(req.body, campo);
  try {
    const { rows: [actual] } = await db.query('SELECT jugador_id, head_coach_id, disciplina_id, rol, nombre, email FROM usuarios WHERE id = $1', [req.params.id]);
    if (!actual) return res.status(404).json({ error: 'Usuario no encontrado' });
    const jugadorId = viene('jugador_id') ? req.body.jugador_id || null : actual.jugador_id;
    const headCoachId = viene('head_coach_id') ? req.body.head_coach_id || null : actual.head_coach_id;
    const disciplinaId = !['entrenador', 'head_coach'].includes(rol) ? null
      : viene('disciplina_id') ? req.body.disciplina_id || null : actual.disciplina_id;
    // v2.7 (T0.2): datos profesionales. Si deja de ser personal de salud se borran; si no vienen, se conservan.
    const prof = await validarProfesionales(req.body, rol, req.params.id);
    if (prof.error) return res.status(prof.status).json({ error: prof.error });
    const extra = Object.keys(prof.cambios);
    const valores = [nombre, email?.toLowerCase().trim(), rol, jugadorId, headCoachId, activo ?? true, disciplinaId,
      ...extra.map(c => prof.cambios[c]), req.params.id];
    const { rowCount } = await db.query(
      `UPDATE usuarios SET nombre=$1, email=$2, rol=$3, jugador_id=$4, head_coach_id=$5, activo=$6, disciplina_id=$7${extra.map((c, i) => `, ${c}=$${8 + i}`).join('')}
       WHERE id=$${valores.length}`,
      valores
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    // v2.9 (T2.7): un cambio de rol es una acción propia en la auditoría (cambia lo que la persona puede ver)
    const cambios = Object.fromEntries([['nombre', actual.nombre, nombre], ['email', actual.email, email?.toLowerCase().trim()], ['rol', actual.rol, rol]]
      .filter(([, antes, despues]) => despues !== undefined && antes !== despues).map(([c, antes, despues]) => [c, { antes, despues }]));
    await auditar(req, { accion: cambios.rol ? 'cambiar_rol' : 'editar', recurso: 'usuario', recurso_id: req.params.id, detalle: { nombre: nombre || actual.nombre, cambios } });
    res.json({ message: 'Usuario actualizado correctamente' });
  } catch (err) {
    responderError(res, err);
  }
};

// PUT /api/usuarios/:id/reset-password
exports.resetPassword = async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Nueva contraseña requerida' });
  try {
    const { password_hash: hash, salt } = await hashClave(password);
    const { rows: [u] } = await db.query(
      'UPDATE usuarios SET password_hash=$1, salt=$2, primer_login=true WHERE id=$3 RETURNING nombre',
      [hash, salt, req.params.id]
    );
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    await auditar(req, { accion: 'restablecer_clave', recurso: 'usuario', recurso_id: req.params.id, detalle: { nombre: u.nombre } });
    res.json({ message: 'Contraseña restablecida. El usuario deberá cambiarla en su próximo ingreso.' });
  } catch (err) {
    responderError(res, err);
  }
};

// DELETE /api/usuarios/:id  (desactivar, no borrar)
exports.remove = async (req, res) => {
  try {
    if (String(req.params.id) === String(req.usuario.id)) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta.' });
    }
    const { rows: [u] } = await db.query('UPDATE usuarios SET activo=false WHERE id=$1 RETURNING nombre', [req.params.id]);
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    await auditar(req, { accion: 'desactivar', recurso: 'usuario', recurso_id: req.params.id, detalle: { nombre: u.nombre } });
    res.json({ message: 'Usuario desactivado correctamente' });
  } catch (err) {
    responderError(res, err);
  }
};

// PATCH /api/usuarios/:id/activar  (v2.0, DEF-043: antes un usuario desactivado no se podía recuperar)
exports.activar = async (req, res) => {
  try {
    const { rows: [u] } = await db.query('UPDATE usuarios SET activo=true WHERE id=$1 RETURNING nombre', [req.params.id]);
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    await auditar(req, { accion: 'activar', recurso: 'usuario', recurso_id: req.params.id, detalle: { nombre: u.nombre } });
    res.json({ message: 'Usuario reactivado correctamente' });
  } catch (err) {
    responderError(res, err);
  }
};

// POST /api/usuarios/csv  — carga masiva
exports.createFromCSV = async (req, res) => {
  const { parse } = require('csv-parse/sync');
  if (!req.file) return res.status(400).json({ error: 'Archivo CSV requerido' });
  // v2.9 (T2.6, D10): quien carga declara que cada persona del archivo fue informada y autorizó
  const declaracion = await revisarDeclaracion(req.body, 'declaracion_carga');
  if (!declaracion.ok) return res.status(declaracion.status).json({ error: declaracion.error });

  try {
    const records = parse(req.file.buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const rolesValidos = ['administrador', 'head_coach', 'entrenador', 'personal_salud', 'jugador'];
    const resultados = { creados: 0, errores: [] };
    const creados = [];

    for (const [i, row] of records.entries()) {
      const { nombre, email, password, rol } = row;
      if (!nombre || !email || !password || !rol) {
        resultados.errores.push({ fila: i + 2, error: 'Faltan campos obligatorios (nombre, email, password, rol)' });
        continue;
      }
      if (!rolesValidos.includes(rol)) {
        resultados.errores.push({ fila: i + 2, error: `Rol inválido: ${rol}` });
        continue;
      }
      if (req.usuario.rol === 'entrenador' && !['jugador', 'personal_salud'].includes(rol)) {
        resultados.errores.push({ fila: i + 2, error: 'Entrenador no puede crear este rol' });
        continue;
      }
      try {
        const { password_hash: hash, salt } = await hashClave(password);
        const { rows: nuevo } = await db.query(
          `INSERT INTO usuarios (nombre, email, password_hash, salt, rol)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (email) DO NOTHING RETURNING id`,
          [nombre, email.toLowerCase().trim(), hash, salt, rol]
        );
        if (nuevo.length) creados.push(nuevo[0].id);
        else resultados.errores.push({ fila: i + 2, error: 'El correo ya está registrado: no se creó de nuevo.' });
        resultados.creados = creados.length;
      } catch (err) {
        resultados.errores.push({ fila: i + 2, error: 'No se pudo crear el usuario: revisa los datos de la fila.' });
      }
    }
    // La carga queda registrada con la huella del archivo recibido y su resultado (cada usuario creado aceptará su
    // aviso al entrar por primera vez, T2.5)
    const cliente = await db.connect();
    try {
      resultados.carga_id = await registrarCarga(cliente, req, declaracion, {
        tipo: 'usuarios', archivoNombre: req.file.originalname, archivoSha: huella(req.file.buffer.toString('utf8')),
        filasTotal: records.length, creadas: creados.length, rechazadas: resultados.errores.length,
        detalle: { creados, errores: resultados.errores },
      });
      await auditar(req, { accion: 'importar', recurso: 'carga', recurso_id: resultados.carga_id,
        detalle: { tipo: 'usuarios', archivo: req.file.originalname, creadas: creados.length, rechazadas: resultados.errores.length } }, cliente);
    } finally {
      cliente.release();
    }
    res.json(resultados);
  } catch (err) {
    responderError(res, err);
  }
};
