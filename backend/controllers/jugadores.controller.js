const db   = require('../config/db');
const { hoyLocal } = require('../utils/hoy');
const path = require('path');
const fs   = require('fs');
const { pathToFileURL } = require('url');
const multer = require('multer');

const { responderError } = require('../utils/errores');
const { UPLOADS_DIR } = require('../config/archivos');
const { registrar } = require('../utils/bitacora'); // v2.7 (T0.6)

// v2.7 (T0.1): las reglas de identificación viven en un solo archivo, el mismo que usan los formularios
// (frontend/src/utils/identificacion.js), igual que las fórmulas de antropometría.
const identificacion = import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'identificacion.js')).href);

// Pertenencia étnica y discapacidad son datos sensibles (Ley 1581 de 2012): solo los ven el personal de salud
// y el propio deportista. Para el resto de roles se quitan de la respuesta de la API, no solo de la pantalla.
function ocultarSensibles(fila, usuario) {
  const propio = usuario?.rol === 'jugador' && Number(usuario.jugador_id) === Number(fila.id);
  if (usuario?.rol === 'personal_salud' || propio) return fila;
  const { pertenencia_etnica, discapacidad, ...resto } = fila;
  return resto;
}

// Toma de `datos` solo los campos de identificación presentes (y los sensibles, que se validan aparte).
async function camposIdentificacion(datos = {}) {
  const { CAMPOS_IDENTIFICACION, CAMPOS_SENSIBLES } = await identificacion;
  return Object.fromEntries([...CAMPOS_IDENTIFICACION, ...CAMPOS_SENSIBLES]
    .filter(c => Object.prototype.hasOwnProperty.call(datos, c)).map(c => [c, datos[c]]));
}

// Valida la identificación y la regla del acudiente. `registro` es cómo queda el deportista (edad o fecha de
// nacimiento y acudiente) para saber si es menor sin acudiente. Devuelve { cambios } o { status, error }.
async function validarIdentificacion(datos, usuario, registro, revisarAcudiente = true) {
  const { normalizarIdentificacion, faltaAcudiente, MENSAJE_ACUDIENTE } = await identificacion;
  const r = normalizarIdentificacion(await camposIdentificacion(datos), { sensibles: usuario?.rol === 'personal_salud' });
  if (!r.ok) return { status: r.status, error: r.error };
  if (revisarAcudiente && faltaAcudiente({ ...registro, ...r.cambios }, hoyLocal())) return { status: 400, error: MENSAJE_ACUDIENTE };
  return { cambios: r.cambios };
}
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(Object.assign(new Error('Formato no permitido'), { status: 400 }));
  },
});

exports.uploadMiddleware = upload.single('foto');

exports.uploadPhoto = async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
  try {
    let foto_url;
    try {
      const dir = path.join(UPLOADS_DIR, 'players');
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
    responderError(res, err);
  }
};

// GET /api/jugadores
exports.getAll = async (req, res) => {
  try {
    const { disciplina_id, equipo_id, entrenador_id, posicion, edad_min, edad_max, retirados } = req.query;

    // Si es jugador, solo devuelve su propio registro
    if (req.usuario?.rol === 'jugador') {
      const { rows } = await db.query(
        `SELECT j.*, COALESCE(date_part('year', age(j.fecha_nacimiento))::int, j.edad) AS edad, eq.nombre AS equipo_nombre, d.nombre AS disciplina_nombre
         FROM jugadores j
         LEFT JOIN equipos eq ON j.equipo_id = eq.id
         LEFT JOIN disciplinas d ON j.disciplina_id = d.id
         WHERE j.id = $1`,
        [req.usuario.jugador_id]
      );
      return res.json(rows.map(f => ocultarSensibles(f, req.usuario)));
    }

    let query = `
      SELECT j.*, COALESCE(date_part('year', age(j.fecha_nacimiento))::int, j.edad) AS edad, eq.nombre AS equipo_nombre, d.nombre AS disciplina_nombre, u.nombre AS entrenador_nombre
      FROM jugadores j
      LEFT JOIN equipos eq ON j.equipo_id = eq.id
      LEFT JOIN disciplinas d ON j.disciplina_id = d.id
      LEFT JOIN usuarios u ON u.id = j.entrenador_id
    `;
    const params = [];
    const conditions = [];

    // v2.7 (T0.4): por defecto, el plantel actual. ?retirados=incluir trae también a los retirados y ?retirados=solo,
    // solo a ellos (para consultarlos o reactivarlos; su historia se conserva).
    if (retirados === 'solo') conditions.push('NOT j.activo');
    else if (retirados !== 'incluir') conditions.push('j.activo');

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
    if (edad_min !== undefined && edad_min !== '') { params.push(Number(edad_min)); conditions.push(`COALESCE(date_part('year', age(j.fecha_nacimiento))::int, j.edad) >= $${params.length}`); }
    if (edad_max !== undefined && edad_max !== '') { params.push(Number(edad_max)); conditions.push(`COALESCE(date_part('year', age(j.fecha_nacimiento))::int, j.edad) <= $${params.length}`); }
    if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;

    query += ` ORDER BY j.nombre ASC`;

    const { rows } = await db.query(query, params);
    res.json(rows.map(f => ocultarSensibles(f, req.usuario)));
  } catch (err) {
    responderError(res, err);
  }
};

// GET /api/jugadores/:id
exports.getOne = async (req, res) => {
  try {
    const { rows: playerRows } = await db.query(
      `SELECT j.*, COALESCE(date_part('year', age(j.fecha_nacimiento))::int, j.edad) AS edad, eq.nombre AS equipo_nombre, d.nombre AS disciplina_nombre
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

    // v2.7 (T0.7): la antropometría es parte de la historia clínica: solo salud y el propio deportista
    const veAntropometria = req.usuario?.rol === 'personal_salud'
      || (req.usuario?.rol === 'jugador' && Number(req.usuario.jugador_id) === Number(player.id));
    if (veAntropometria) {
      const { rows: antroRows } = await db.query(
        'SELECT * FROM antropometria WHERE jugador_id = $1 ORDER BY fecha DESC LIMIT 1',
        [req.params.id]
      );
      player.ultima_antropometria = antroRows[0] || null;
    }

    const { rows: evalRows } = await db.query(
      'SELECT * FROM evaluaciones_rugby WHERE jugador_id = $1 ORDER BY fecha DESC LIMIT 1',
      [req.params.id]
    );
    player.ultima_evaluacion = evalRows[0] || null;

    res.json(ocultarSensibles(player, req.usuario));
  } catch (err) {
    responderError(res, err);
  }
};

// ── Dorsal (número de camiseta) ───────────────────────────
// Valor permitido: entero de 0 a 99, o vacío para quitarlo.
function normalizarDorsal(valor) {
  if (valor === undefined || valor === null || valor === '') return { ok: true, valor: null };
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 0 || n > 99) {
    return { ok: false, error: 'El dorsal debe ser un número entero entre 0 y 99' };
  }
  return { ok: true, valor: n };
}

// Si PostgreSQL rechaza el dorsal por estar ocupado en el equipo, responde 409 con quién lo tiene.
async function responderDorsalOcupado(err, res, { dorsal, equipo_id }) {
  if (err.code !== '23505' || !String(err.constraint || '').includes('dorsal')) return false;
  let quien = 'otro jugador';
  if (equipo_id && dorsal !== null && dorsal !== undefined) {
    const { rows } = await db.query(
      'SELECT nombre FROM jugadores WHERE equipo_id = $1 AND dorsal = $2 LIMIT 1', [equipo_id, dorsal]
    );
    if (rows.length) quien = rows[0].nombre;
  }
  res.status(409).json({ error: `El dorsal ${dorsal} ya lo usa ${quien} en este equipo. Elige otro número.` });
  return true;
}

// Entrenador y head coach solo modifican deportistas que les pertenecen.
async function verificarPermisoEscritura(req, jugadorId, accion = 'modificar') {
  const { rows } = await db.query('SELECT id, entrenador_id, equipo_id, dorsal FROM jugadores WHERE id = $1', [jugadorId]);
  if (!rows.length) return { status: 404, error: 'Jugador no encontrado' };
  const jugador = rows[0];
  const rol = req.usuario?.rol;
  if (rol === 'jugador') return { status: 403, error: `No tienes permiso para ${accion} este deportista` };
  if (rol === 'entrenador' && Number(jugador.entrenador_id) !== Number(req.usuario.id)) {
    return { status: 403, error: `No tienes permiso para ${accion} este deportista` };
  }
  if (rol === 'head_coach') {
    const { rows: linked } = await db.query('SELECT id FROM usuarios WHERE id = $1 AND head_coach_id = $2', [jugador.entrenador_id, req.usuario.id]);
    if (!linked.length) return { status: 403, error: 'Este deportista no pertenece a tus entrenadores asociados' };
  }
  return { jugador };
}

// POST /api/jugadores
exports.create = async (req, res) => {
  const { nombre, posicion, peso, altura, equipo_id, disciplina_id } = req.body;
  let { edad } = req.body;
  const fecha_nacimiento = req.body.fecha_nacimiento ? String(req.body.fecha_nacimiento).slice(0, 10) : null;
  if (fecha_nacimiento && (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_nacimiento) || fecha_nacimiento > hoyLocal())) {
    return res.status(400).json({ error: 'La fecha de nacimiento no es válida.' });
  }
  if (fecha_nacimiento) edad = null;
  const genero = ['masculino', 'femenino'].includes(req.body.genero) ? req.body.genero : null;
  const entrenador_id = req.usuario?.rol === 'entrenador' ? req.usuario.id : (req.body.entrenador_id || null);
  if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const dorsal = normalizarDorsal(req.body.dorsal);
  if (!dorsal.ok) return res.status(400).json({ error: dorsal.error });
  // v2.7: documento, contacto, emergencia y acudiente (obligatorio si es menor de edad)
  const ident = await validarIdentificacion(req.body, req.usuario, { fecha_nacimiento, edad });
  if (ident.error) return res.status(ident.status).json({ error: ident.error });

  try {
    const valores = {
      nombre: String(nombre).trim(), edad: edad || null, posicion: posicion || null, peso: peso || null, altura: altura || null,
      equipo_id: equipo_id || null, disciplina_id: disciplina_id || null, entrenador_id, dorsal: dorsal.valor, fecha_nacimiento, genero,
      ...ident.cambios,
    };
    const columnas = Object.keys(valores);
    const { rows } = await db.query(
      `INSERT INTO jugadores (${columnas.join(', ')}) VALUES (${columnas.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
      Object.values(valores)
    );
    res.status(201).json({ id: rows[0].id, nombre, edad, posicion, peso, altura, equipo_id, disciplina_id, dorsal: dorsal.valor });
  } catch (err) {
    if (await responderDorsalOcupado(err, res, { dorsal: dorsal.valor, equipo_id })) return;
    responderError(res, err);
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
    const { CAMPOS_IDENTIFICACION, normalizarIdentificacion, faltaAcudiente, MENSAJE_ACUDIENTE } = await identificacion;
    const client = await db.connect();
    const inserted = [];
    const errors = [];
    const avisos = [];
    const documentosDelArchivo = new Set();

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

        let edad = item.edad ? parseInt(item.edad, 10) : null;
        // v2.7: fecha de nacimiento (AAAA-MM-DD), documento, contacto y acudiente. Una fila inválida no se importa.
        const fecha_nacimiento = item.fecha_nacimiento ? String(item.fecha_nacimiento).trim().slice(0, 10) : null;
        if (fecha_nacimiento && (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_nacimiento) || fecha_nacimiento > hoyLocal())) {
          errors.push({ fila: i + 1, error: `${nombre}: la fecha de nacimiento no es válida (usa AAAA-MM-DD)` });
          continue;
        }
        if (fecha_nacimiento) edad = null;
        const ident = normalizarIdentificacion(
          Object.fromEntries(CAMPOS_IDENTIFICACION.filter(c => item[c] !== undefined).map(c => [c, item[c]])));
        if (!ident.ok) { errors.push({ fila: i + 1, error: `${nombre}: ${ident.error}` }); continue; }
        if (faltaAcudiente({ fecha_nacimiento, edad, ...ident.cambios }, hoyLocal())) {
          errors.push({ fila: i + 1, error: `${nombre}: ${MENSAJE_ACUDIENTE}` });
          continue;
        }
        const documento = ident.cambios.numero_documento;
        if (documento) {
          const { rows: repetido } = await client.query('SELECT 1 FROM jugadores WHERE numero_documento = $1', [documento]);
          if (repetido.length || documentosDelArchivo.has(documento)) {
            errors.push({ fila: i + 1, error: `${nombre}: ya hay un deportista registrado con el documento ${documento}` });
            continue;
          }
          documentosDelArchivo.add(documento);
        }
        const peso = item.peso ? parseFloat(item.peso) : null;
        const altura = item.altura ? parseFloat(item.altura) : null;
        const posicion = item.posicion ? item.posicion.trim() : null;

        // Dorsal opcional: si es inválido o ya está ocupado en el equipo, se importa sin dorsal y se avisa
        let { ok, valor: dorsal } = normalizarDorsal(item.dorsal);
        if (!ok) {
          avisos.push({ fila: i + 1, aviso: `Dorsal "${item.dorsal}" no válido (0 a 99): ${nombre} se importó sin dorsal` });
          dorsal = null;
        } else if (dorsal !== null && equipo_id) {
          const { rows: ocupado } = await client.query(
            'SELECT nombre FROM jugadores WHERE equipo_id = $1 AND dorsal = $2 LIMIT 1', [equipo_id, dorsal]
          );
          if (ocupado.length) {
            avisos.push({ fila: i + 1, aviso: `El dorsal ${dorsal} ya lo usa ${ocupado[0].nombre}: ${nombre} se importó sin dorsal` });
            dorsal = null;
          }
        }

        const valores = {
          nombre, edad: isNaN(edad) ? null : edad, fecha_nacimiento, posicion, peso: isNaN(peso) ? null : peso,
          altura: isNaN(altura) ? null : altura, equipo_id, disciplina_id, dorsal, ...ident.cambios,
        };
        const columnas = Object.keys(valores);
        const { rows } = await client.query(
          `INSERT INTO jugadores (${columnas.join(', ')}) VALUES (${columnas.map((_, n) => `$${n + 1}`).join(', ')}) RETURNING id`,
          Object.values(valores)
        );

        inserted.push({ id: rows[0].id, nombre, posicion, disciplina_id, equipo_id, dorsal });
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
      errores: errors,
      avisos,
    });
  } catch (err) {
    responderError(res, err);
  }
};

// PUT /api/jugadores/:id
// Actualización parcial: solo se modifican los campos presentes en el body.
// Así, asignar un equipo desde otra pantalla no borra el dorsal ni el entrenador.
exports.update = async (req, res) => {
  const permitidos = ['nombre', 'edad', 'fecha_nacimiento', 'genero', 'posicion', 'peso', 'altura', 'equipo_id', 'disciplina_id', 'entrenador_id', 'dorsal'];
  const presente = (campo) => Object.prototype.hasOwnProperty.call(req.body, campo);
  const vacioANull = (v) => (v === '' || v === undefined ? null : v);

  try {
    const permiso = await verificarPermisoEscritura(req, req.params.id);
    if (permiso.error) return res.status(permiso.status).json({ error: permiso.error });

    const cambios = {};
    for (const campo of permitidos) if (presente(campo)) cambios[campo] = vacioANull(req.body[campo]);

    if ('nombre' in cambios && !String(cambios.nombre || '').trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    if ('nombre' in cambios) cambios.nombre = String(cambios.nombre).trim();
    // Un entrenador no puede reasignar sus deportistas a otro entrenador
    if (req.usuario?.rol === 'entrenador') delete cambios.entrenador_id;
    // v2.0: con fecha de nacimiento, la edad se calcula sola cada vez que se consulta
    if ('fecha_nacimiento' in cambios && cambios.fecha_nacimiento) {
      const f = String(cambios.fecha_nacimiento).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || f > hoyLocal()) {
        return res.status(400).json({ error: 'La fecha de nacimiento no es válida.' });
      }
      cambios.fecha_nacimiento = f;
      delete cambios.edad;
    }
    if ('genero' in cambios && cambios.genero && !['masculino', 'femenino'].includes(cambios.genero)) delete cambios.genero;
    if ('dorsal' in cambios) {
      const dorsal = normalizarDorsal(cambios.dorsal);
      if (!dorsal.ok) return res.status(400).json({ error: dorsal.error });
      cambios.dorsal = dorsal.valor;
    }
    // v2.7: identificación. La regla del acudiente se revisa solo si el cambio toca la edad o el acudiente,
    // para que asignar un equipo o un dorsal a un menor registrado antes no quede bloqueado.
    const ident = await validarIdentificacion(req.body, req.usuario, await registroActual(req.params.id, cambios), tocaMenor(req.body));
    if (ident.error) return res.status(ident.status).json({ error: ident.error });
    Object.assign(cambios, ident.cambios);

    const campos = Object.keys(cambios);
    if (!campos.length) return res.status(400).json({ error: 'No hay cambios para guardar' });

    const set = campos.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const valores = [...campos.map(c => cambios[c]), req.params.id];
    try {
      await db.query(`UPDATE jugadores SET ${set} WHERE id = $${valores.length}`, valores);
    } catch (err) {
      const equipo_id = 'equipo_id' in cambios ? cambios.equipo_id : permiso.jugador.equipo_id;
      const dorsal = 'dorsal' in cambios ? cambios.dorsal : permiso.jugador.dorsal;
      if (await responderDorsalOcupado(err, res, { dorsal, equipo_id })) return;
      throw err;
    }
    res.json({ message: 'Jugador actualizado correctamente' });
  } catch (err) {
    responderError(res, err);
  }
};

// Cómo queda el deportista después del cambio: edad, fecha de nacimiento y acudiente (para la regla del menor)
async function registroActual(id, cambios = {}) {
  const { rows: [actual] } = await db.query(
    'SELECT edad, fecha_nacimiento, acudiente_nombre, acudiente_telefono FROM jugadores WHERE id = $1', [id]);
  const registro = { ...(actual || {}) };
  if ('fecha_nacimiento' in cambios) { registro.fecha_nacimiento = cambios.fecha_nacimiento; if (cambios.fecha_nacimiento) registro.edad = null; }
  if ('edad' in cambios) registro.edad = cambios.edad;
  return registro;
}
const tocaMenor = (body) => ['fecha_nacimiento', 'edad', 'acudiente_nombre', 'acudiente_telefono']
  .some(c => Object.prototype.hasOwnProperty.call(body, c));

// PATCH /api/jugadores/:id/identificacion (v2.7)
// Documento, contacto, emergencia y acudiente. El personal de salud también registra los datos sensibles
// (pertenencia étnica y discapacidad), sin poder cambiar el equipo, el dorsal ni el entrenador.
exports.updateIdentificacion = async (req, res) => {
  try {
    const permiso = await verificarPermisoEscritura(req, req.params.id);
    if (permiso.error) return res.status(permiso.status).json({ error: permiso.error });
    const datos = await camposIdentificacion(req.body);
    if (!Object.keys(datos).length) return res.status(400).json({ error: 'No hay cambios para guardar' });
    const ident = await validarIdentificacion(datos, req.usuario, await registroActual(req.params.id), tocaMenor(datos));
    if (ident.error) return res.status(ident.status).json({ error: ident.error });
    const campos = Object.keys(ident.cambios);
    await db.query(`UPDATE jugadores SET ${campos.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${campos.length + 1}`,
      [...campos.map(c => ident.cambios[c]), req.params.id]);
    await registrar(req, { accion: 'editar', recurso: 'identificacion', jugador_id: req.params.id });
    res.json({ message: 'Datos de identificación actualizados' });
  } catch (err) {
    responderError(res, err);
  }
};

// PATCH /api/jugadores/:id/dorsal
// Cambio rápido del número de camiseta (edición en línea desde la tabla).
exports.updateDorsal = async (req, res) => {
  const dorsal = normalizarDorsal(req.body.dorsal);
  if (!dorsal.ok) return res.status(400).json({ error: dorsal.error });
  try {
    const permiso = await verificarPermisoEscritura(req, req.params.id);
    if (permiso.error) return res.status(permiso.status).json({ error: permiso.error });
    try {
      await db.query('UPDATE jugadores SET dorsal = $1 WHERE id = $2', [dorsal.valor, req.params.id]);
    } catch (err) {
      if (await responderDorsalOcupado(err, res, { dorsal: dorsal.valor, equipo_id: permiso.jugador.equipo_id })) return;
      throw err;
    }
    res.json({ id: Number(req.params.id), dorsal: dorsal.valor, message: dorsal.valor === null ? 'Dorsal quitado' : `Dorsal cambiado a ${dorsal.valor}` });
  } catch (err) {
    responderError(res, err);
  }
};

// PATCH /api/jugadores/:id/retirar (v2.7, T0.4)
// Sale del plantel actual (listados, asistencia, convocatorias) y libera su dorsal. Conserva toda su historia:
// la Resolución 839 de 2017 exige guardar la historia clínica 15 años. Se puede reactivar.
exports.retirar = async (req, res) => {
  try {
    const permiso = await verificarPermisoEscritura(req, req.params.id, 'retirar');
    if (permiso.error) return res.status(permiso.status).json({ error: permiso.error });
    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
    if (motivo.length > 200) return res.status(400).json({ error: 'El motivo admite máximo 200 caracteres.' });
    const { rowCount } = await db.query(
      `UPDATE jugadores SET activo = FALSE, retirado_en = now(), motivo_retiro = $1, dorsal = NULL WHERE id = $2 AND activo`,
      [motivo || null, req.params.id]);
    if (!rowCount) return res.status(409).json({ error: 'El deportista ya está retirado.' });
    res.json({ message: 'Deportista retirado del plantel. Su historia se conserva.' });
  } catch (err) {
    responderError(res, err);
  }
};

// PATCH /api/jugadores/:id/reactivar (v2.7, T0.4): vuelve al plantel actual (sin dorsal: se asigna de nuevo)
exports.reactivar = async (req, res) => {
  try {
    const permiso = await verificarPermisoEscritura(req, req.params.id, 'reactivar');
    if (permiso.error) return res.status(permiso.status).json({ error: permiso.error });
    const { rowCount } = await db.query(
      'UPDATE jugadores SET activo = TRUE, retirado_en = NULL, motivo_retiro = NULL WHERE id = $1 AND NOT activo', [req.params.id]);
    if (!rowCount) return res.status(409).json({ error: 'El deportista ya está en el plantel.' });
    res.json({ message: 'Deportista de nuevo en el plantel.' });
  } catch (err) {
    responderError(res, err);
  }
};

// DELETE /api/jugadores/:id
// v2.7 (T0.4, DEF-053): solo para registros creados por error. Si tiene historia clínica, un trigger de la base
// lo impide (409) y hay que retirarlo; antes se borraban en cascada sus lesiones, controles y antropometría.
exports.remove = async (req, res) => {
  try {
    const permiso = await verificarPermisoEscritura(req, req.params.id, 'eliminar');
    if (permiso.error) return res.status(permiso.status).json({ error: permiso.error });
    const { rowCount } = await db.query('DELETE FROM jugadores WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Jugador no encontrado' });
    res.json({ message: 'Jugador eliminado correctamente' });
  } catch (err) {
    responderError(res, err);
  }
};
