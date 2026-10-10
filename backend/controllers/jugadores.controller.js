const db   = require('../config/db');
const path = require('path');
const fs   = require('fs');
const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Formato no permitido'));
  },
});

exports.uploadMiddleware = upload.single('foto');

exports.uploadPhoto = async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
  try {
    let foto_url;
    try {
      const dir = path.join(__dirname, '..', 'uploads', 'players');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
      const filename = `player-${id || Date.now()}${ext}`;
      const filePath = path.join(dir, filename);
      fs.writeFileSync(filePath, req.file.buffer);
      foto_url = `/uploads/players/${filename}`;
    } catch (diskErr) {
      foto_url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    await db.query('UPDATE jugadores SET foto_url = $1 WHERE id = $2', [foto_url, id]);
    res.json({ foto_url });
  } catch (err) {
    console.error('Error al actualizar foto del jugador:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/jugadores
exports.getAll = async (req, res) => {
  try {
    const { disciplina_id, equipo_id, entrenador_id, posicion, edad_min, edad_max } = req.query;

    // Si es jugador, solo devuelve su propio registro
    if (req.usuario?.rol === 'jugador') {
      const { rows } = await db.query(
        `SELECT j.*, eq.nombre AS equipo_nombre, d.nombre AS disciplina_nombre
         FROM jugadores j
         LEFT JOIN equipos eq ON j.equipo_id = eq.id
         LEFT JOIN disciplinas d ON j.disciplina_id = d.id
         WHERE j.id = $1`,
        [req.usuario.jugador_id]
      );
      return res.json(rows);
    }

    let query = `
      SELECT j.*, eq.nombre AS equipo_nombre, d.nombre AS disciplina_nombre, u.nombre AS entrenador_nombre
      FROM jugadores j
      LEFT JOIN equipos eq ON j.equipo_id = eq.id
      LEFT JOIN disciplinas d ON j.disciplina_id = d.id
      LEFT JOIN usuarios u ON u.id = j.entrenador_id
    `;
    const params = [];
    const conditions = [];

    // Los entrenadores solo consultan deportistas asignados a ellos.
    if (req.usuario?.rol === 'entrenador') {
      params.push(req.usuario.id);
      conditions.push(`j.entrenador_id = $${params.length}`);
    }
    // Head Coach consulta únicamente los deportistas de sus entrenadores asociados.
    if (req.usuario?.rol === 'head_coach') {
      params.push(req.usuario.id);
      conditions.push(`j.entrenador_id IN (SELECT id FROM usuarios WHERE head_coach_id = $${params.length})`);
    }
    if (disciplina_id && disciplina_id !== 'todos') { params.push(disciplina_id); conditions.push(`j.disciplina_id = $${params.length}`); }
    if (equipo_id && equipo_id !== 'todos') { params.push(equipo_id); conditions.push(`j.equipo_id = $${params.length}`); }
    if (entrenador_id && ['administrador','personal_salud','head_coach'].includes(req.usuario?.rol)) { params.push(entrenador_id); conditions.push(`j.entrenador_id = $${params.length}`); }
    if (posicion) { params.push(`%${posicion}%`); conditions.push(`j.posicion ILIKE $${params.length}`); }
    if (edad_min !== undefined && edad_min !== '') { params.push(Number(edad_min)); conditions.push(`j.edad >= $${params.length}`); }
    if (edad_max !== undefined && edad_max !== '') { params.push(Number(edad_max)); conditions.push(`j.edad <= $${params.length}`); }
    if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;

    query += ` ORDER BY j.nombre ASC`;

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/jugadores/:id
exports.getOne = async (req, res) => {
  try {
    const { rows: playerRows } = await db.query(
      `SELECT j.*, eq.nombre AS equipo_nombre, d.nombre AS disciplina_nombre
       FROM jugadores j
       LEFT JOIN equipos eq ON j.equipo_id = eq.id
       LEFT JOIN disciplinas d ON j.disciplina_id = d.id
       WHERE j.id = $1`,
      [req.params.id]
    );
    if (!playerRows.length) return res.status(404).json({ error: 'Jugador no encontrado' });

    const player = playerRows[0];
    if (req.usuario?.rol === 'jugador' && Number(player.id) !== Number(req.usuario.jugador_id)) {
      return res.status(403).json({ error: 'Solo puedes consultar tu propio perfil' });
    }
    if (req.usuario?.rol === 'entrenador' && Number(player.entrenador_id) !== Number(req.usuario.id)) {
      return res.status(403).json({ error: 'Solo puedes consultar deportistas asignados a ti' });
    }
    if (req.usuario?.rol === 'head_coach') {
      const { rows: linked } = await db.query('SELECT id FROM usuarios WHERE id=$1 AND head_coach_id=$2', [player.entrenador_id, req.usuario.id]);
      if (!linked.length) return res.status(403).json({ error: 'Este deportista no pertenece a tus entrenadores asociados' });
    }

    const { rows: antroRows } = await db.query(
      'SELECT * FROM antropometria WHERE jugador_id = $1 ORDER BY fecha DESC LIMIT 1',
      [req.params.id]
    );
    player.ultima_antropometria = antroRows[0] || null;

    const { rows: evalRows } = await db.query(
      'SELECT * FROM evaluaciones_rugby WHERE jugador_id = $1 ORDER BY fecha DESC LIMIT 1',
      [req.params.id]
    );
    player.ultima_evaluacion = evalRows[0] || null;

    res.json(player);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/jugadores
exports.create = async (req, res) => {
  const { nombre, edad, posicion, peso, altura, equipo_id, disciplina_id } = req.body;
  const entrenador_id = req.usuario?.rol === 'entrenador' ? req.usuario.id : (req.body.entrenador_id || null);
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

  try {
    const { rows } = await db.query(
      `INSERT INTO jugadores (nombre, edad, posicion, peso, altura, equipo_id, disciplina_id, entrenador_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [nombre, edad || null, posicion || null, peso || null, altura || null,
       equipo_id || null, disciplina_id || null, entrenador_id]
    );
    res.status(201).json({ id: rows[0].id, nombre, edad, posicion, peso, altura, equipo_id, disciplina_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/jugadores/bulk
// Importación masiva desde CSV
exports.bulkCreate = async (req, res) => {
  const { deportistas } = req.body;
  if (!Array.isArray(deportistas) || deportistas.length === 0) {
    return res.status(400).json({ error: 'Se requiere una lista de deportistas' });
  }

  try {
    const client = await db.connect();
    const inserted = [];
    const errors = [];

    try {
      await client.query('BEGIN');

      for (let i = 0; i < deportistas.length; i++) {
        const item = deportistas[i];
        const nombre = item.nombre ? item.nombre.trim() : '';
        if (!nombre) {
          errors.push({ fila: i + 1, error: 'Nombre vacío' });
          continue;
        }

        let disciplina_id = item.disciplina_id || null;
        // Si viene nombre de deporte o disciplina por texto, buscarla o crearla
        if (!disciplina_id && item.deporte) {
          const depName = item.deporte.trim();
          const { rows: dRows } = await client.query('SELECT id FROM disciplinas WHERE LOWER(nombre) = LOWER($1)', [depName]);
          if (dRows.length > 0) {
            disciplina_id = dRows[0].id;
          } else {
            const { rows: newD } = await client.query('INSERT INTO disciplinas (nombre) VALUES ($1) RETURNING id', [depName]);
            disciplina_id = newD[0].id;
          }
        }

        let equipo_id = item.equipo_id || null;
        if (!equipo_id && item.equipo) {
          const eqName = item.equipo.trim();
          const { rows: eRows } = await client.query('SELECT id FROM equipos WHERE LOWER(nombre) = LOWER($1)', [eqName]);
          if (eRows.length > 0) {
            equipo_id = eRows[0].id;
          } else {
            const { rows: newE } = await client.query('INSERT INTO equipos (nombre) VALUES ($1) RETURNING id', [eqName]);
            equipo_id = newE[0].id;
          }
        }

        const edad = item.edad ? parseInt(item.edad, 10) : null;
        const peso = item.peso ? parseFloat(item.peso) : null;
        const altura = item.altura ? parseFloat(item.altura) : null;
        const posicion = item.posicion ? item.posicion.trim() : null;

        const { rows } = await client.query(
          `INSERT INTO jugadores (nombre, edad, posicion, peso, altura, equipo_id, disciplina_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [nombre, isNaN(edad) ? null : edad, posicion, isNaN(peso) ? null : peso, isNaN(altura) ? null : altura, equipo_id, disciplina_id]
        );

        inserted.push({ id: rows[0].id, nombre, posicion, disciplina_id, equipo_id });
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    res.status(201).json({
      message: `Se importaron ${inserted.length} deportistas correctamente`,
      total: inserted.length,
      insertados: inserted,
      errores: errors
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al procesar la importación: ' + err.message });
  }
};

// PUT /api/jugadores/:id
exports.update = async (req, res) => {
  const { nombre, edad, posicion, peso, altura, equipo_id, disciplina_id } = req.body;
  const entrenador_id = req.usuario?.rol === 'entrenador' ? req.usuario.id : (req.body.entrenador_id || null);

  try {
    if (['entrenador','jugador','head_coach'].includes(req.usuario?.rol)) {
      const { rows: existing } = await db.query('SELECT id, entrenador_id FROM jugadores WHERE id=$1', [req.params.id]);
      if (!existing.length) return res.status(404).json({ error: 'Jugador no encontrado' });
      if (req.usuario.rol === 'jugador' || (req.usuario.rol === 'entrenador' && Number(existing[0].entrenador_id) !== Number(req.usuario.id))) return res.status(403).json({ error: 'No tienes permiso para modificar este deportista' });
      if (req.usuario.rol === 'head_coach') { const { rows: linked } = await db.query('SELECT id FROM usuarios WHERE id=$1 AND head_coach_id=$2', [existing[0].entrenador_id, req.usuario.id]); if (!linked.length) return res.status(403).json({ error: 'Este deportista no pertenece a tus entrenadores asociados' }); }
    }
    const { rowCount } = await db.query(
      `UPDATE jugadores SET nombre=$1, edad=$2, posicion=$3, peso=$4, altura=$5,
       equipo_id=$6, disciplina_id=$7, entrenador_id=$8 WHERE id=$9`,
      [nombre, edad || null, posicion || null, peso || null, altura || null,
       equipo_id || null, disciplina_id || null, entrenador_id, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Jugador no encontrado' });
    res.json({ message: 'Jugador actualizado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/jugadores/:id
exports.remove = async (req, res) => {
  try {
    if (['entrenador','jugador','head_coach'].includes(req.usuario?.rol)) {
      const { rows: existing } = await db.query('SELECT id, entrenador_id FROM jugadores WHERE id=$1', [req.params.id]);
      if (!existing.length) return res.status(404).json({ error: 'Jugador no encontrado' });
      if (req.usuario.rol === 'jugador' || (req.usuario.rol === 'entrenador' && Number(existing[0].entrenador_id) !== Number(req.usuario.id))) return res.status(403).json({ error: 'No tienes permiso para eliminar este deportista' });
      if (req.usuario.rol === 'head_coach') { const { rows: linked } = await db.query('SELECT id FROM usuarios WHERE id=$1 AND head_coach_id=$2', [existing[0].entrenador_id, req.usuario.id]); if (!linked.length) return res.status(403).json({ error: 'Este deportista no pertenece a tus entrenadores asociados' }); }
    }
    const { rowCount } = await db.query('DELETE FROM jugadores WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Jugador no encontrado' });
    res.json({ message: 'Jugador eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
