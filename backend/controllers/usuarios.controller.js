const db     = require('../config/db');
const { hashClave } = require('../utils/claves');
const { responderError } = require('../utils/errores');

// GET /api/usuarios
exports.getAll = async (_req, res) => {
  try {
    const { rows } = await db.query(
      // disciplinas: deportes relacionados con la cuenta, para filtrar por deporte (v1.9). Deportista: el suyo;
      // entrenador: el asignado y los de sus deportistas; head coach: el suyo y los de sus entrenadores.
      `SELECT u.id, u.nombre, u.email, u.rol, u.jugador_id, u.head_coach_id, hc.nombre AS head_coach_nombre, u.activo, u.primer_login, u.created_at,
              u.disciplina_id, ARRAY(
                SELECT DISTINCT x FROM (
                  SELECT u.disciplina_id AS x
                  UNION ALL SELECT COALESCE(j.disciplina_id, eq.disciplina_id) FROM jugadores j LEFT JOIN equipos eq ON eq.id = j.equipo_id WHERE j.id = u.jugador_id
                  UNION ALL SELECT COALESCE(j.disciplina_id, eq.disciplina_id) FROM jugadores j LEFT JOIN equipos eq ON eq.id = j.equipo_id
                    WHERE j.entrenador_id = u.id OR j.entrenador_id IN (SELECT e.id FROM usuarios e WHERE e.head_coach_id = u.id)
                  UNION ALL SELECT e.disciplina_id FROM usuarios e WHERE e.head_coach_id = u.id
                ) d WHERE x IS NOT NULL
              ) AS disciplinas
       FROM usuarios u LEFT JOIN usuarios hc ON hc.id=u.head_coach_id ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    responderError(res, err);
  }
};

// POST /api/usuarios
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

  try {
    const { password_hash: hash, salt } = await hashClave(password);
    const { rows } = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, salt, rol, jugador_id, head_coach_id, disciplina_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [nombre, email.toLowerCase().trim(), hash, salt, rol, jugador_id || null, head_coach_id || null,
       ['entrenador', 'head_coach'].includes(rol) ? disciplina_id || null : null]
    );
    res.status(201).json({ id: rows[0].id, nombre, email, rol, activo: true, primer_login: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' });
    responderError(res, err);
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
    const { rows: [actual] } = await db.query('SELECT jugador_id, head_coach_id, disciplina_id FROM usuarios WHERE id = $1', [req.params.id]);
    if (!actual) return res.status(404).json({ error: 'Usuario no encontrado' });
    const jugadorId = viene('jugador_id') ? req.body.jugador_id || null : actual.jugador_id;
    const headCoachId = viene('head_coach_id') ? req.body.head_coach_id || null : actual.head_coach_id;
    const disciplinaId = !['entrenador', 'head_coach'].includes(rol) ? null
      : viene('disciplina_id') ? req.body.disciplina_id || null : actual.disciplina_id;
    const { rowCount } = await db.query(
      `UPDATE usuarios SET nombre=$1, email=$2, rol=$3, jugador_id=$4, head_coach_id=$5, activo=$6, disciplina_id=$7 WHERE id=$8`,
      [nombre, email?.toLowerCase().trim(), rol, jugadorId, headCoachId, activo ?? true, disciplinaId, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
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
    const { rowCount } = await db.query(
      'UPDATE usuarios SET password_hash=$1, salt=$2, primer_login=true WHERE id=$3',
      [hash, salt, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ message: 'Contraseña restablecida. El usuario deberá cambiarla en su próximo ingreso.' });
  } catch (err) {
    responderError(res, err);
  }
};

// DELETE /api/usuarios/:id  (desactivar, no borrar)
exports.remove = async (req, res) => {
  try {
    const { rowCount } = await db.query(
      'UPDATE usuarios SET activo=false WHERE id=$1',
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ message: 'Usuario desactivado correctamente' });
  } catch (err) {
    responderError(res, err);
  }
};

// POST /api/usuarios/csv  — carga masiva
exports.createFromCSV = async (req, res) => {
  const { parse } = require('csv-parse/sync');
  if (!req.file) return res.status(400).json({ error: 'Archivo CSV requerido' });

  try {
    const records = parse(req.file.buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const rolesValidos = ['administrador', 'head_coach', 'entrenador', 'personal_salud', 'jugador'];
    const resultados = { creados: 0, errores: [] };

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
        await db.query(
          `INSERT INTO usuarios (nombre, email, password_hash, salt, rol)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (email) DO NOTHING`,
          [nombre, email.toLowerCase().trim(), hash, salt, rol]
        );
        resultados.creados++;
      } catch (err) {
        resultados.errores.push({ fila: i + 2, error: 'No se pudo crear el usuario: revisa los datos de la fila.' });
      }
    }
    res.json(resultados);
  } catch (err) {
    responderError(res, err);
  }
};
