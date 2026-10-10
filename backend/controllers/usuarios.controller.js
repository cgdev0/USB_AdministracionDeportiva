const db     = require('../config/db');
const { hashClave } = require('../utils/claves');
const { responderError } = require('../utils/errores');

// GET /api/usuarios
exports.getAll = async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.nombre, u.email, u.rol, u.jugador_id, u.head_coach_id, hc.nombre AS head_coach_nombre, u.activo, u.primer_login, u.created_at
       FROM usuarios u LEFT JOIN usuarios hc ON hc.id=u.head_coach_id ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    responderError(res, err);
  }
};

// POST /api/usuarios
exports.create = async (req, res) => {
  const { nombre, email, password, rol, jugador_id, head_coach_id } = req.body;
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
      `INSERT INTO usuarios (nombre, email, password_hash, salt, rol, jugador_id, head_coach_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [nombre, email.toLowerCase().trim(), hash, salt, rol, jugador_id || null, head_coach_id || null]
    );
    res.status(201).json({ id: rows[0].id, nombre, email, rol, activo: true, primer_login: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' });
    responderError(res, err);
  }
};

// PUT /api/usuarios/:id
exports.update = async (req, res) => {
  const { nombre, email, rol, jugador_id, head_coach_id, activo } = req.body;
  const rolesPermitidos = ['administrador', 'head_coach', 'entrenador', 'personal_salud', 'jugador'];
  if (!rolesPermitidos.includes(rol)) return res.status(400).json({ error: 'Rol inválido' });
  try {
    const { rowCount } = await db.query(
      `UPDATE usuarios SET nombre=$1, email=$2, rol=$3, jugador_id=$4, head_coach_id=$5, activo=$6 WHERE id=$7`,
      [nombre, email?.toLowerCase().trim(), rol, jugador_id || null, head_coach_id || null, activo ?? true, req.params.id]
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
