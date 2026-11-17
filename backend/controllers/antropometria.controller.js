const path = require('path');
const { pathToFileURL } = require('url');
const pool = require('../config/db');

const { responderError } = require('../utils/errores');
const { puedeVerJugador } = require('../utils/alcance');

// v2.5: las fórmulas viven en un solo archivo, el mismo que usa la pantalla (frontend/src/utils/anthropometry.js).
// Antes había una copia aquí y el error de la masa ósea (diámetro de húmero en lugar de muñeca) estaba en las dos.
const modulo = import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'anthropometry.js')).href);

const numero = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// Calcula los valores derivados. Un % de grasa, masa ósea o masa muscular escrito a mano por el profesional
// (por ejemplo, de una medición directa) tiene prioridad sobre el calculado.
const calcularAntropometria = async (data, genero = 'masculino', edad = null) => {
  const { calculateAnthropometry, masaMuscularPorDiferencia } = await modulo;
  const c = calculateAnthropometry(data, genero, edad);
  const porcentaje_grasa = numero(data.porcentaje_grasa) ?? c.porcentaje_grasa;
  const masa_mineral_osea = numero(data.masa_mineral_osea) ?? c.masa_mineral_osea;
  const masa_muscular_esqueletica = numero(data.masa_muscular_esqueletica)
    ?? masaMuscularPorDiferencia(data.peso, porcentaje_grasa, masa_mineral_osea, genero);
  return {
    imc: c.imc ?? numero(data.imc),
    porcentaje_grasa,
    masa_mineral_osea,
    masa_muscular_esqueletica,
    endomorfia: c.endomorfia,
    mesomorfia: c.mesomorfia,
    ectomorfia: c.ectomorfia,
    x_somatocarta: c.x_somatocarta,
    y_somatocarta: c.y_somatocarta,
    sumatoria_pliegues: c.sumatoria_pliegues,
  };
};

// Columnas que se pueden escribir en la tabla antropometria.
// Cualquier otra clave del body se descarta (evita errores e inyección SQL en los nombres de columna).
const COLUMNAS = [
  'jugador_id', 'fecha', 'peso', 'estatura', 'imc',
  'pliegue_biceps', 'pliegue_triceps', 'pliegue_subescapular', 'pliegue_suprailiaco',
  'pliegue_supraespinal', 'pliegue_abdominal', 'pliegue_muslo_anterior', 'pliegue_pierna_medial',
  'perimetro_brazo_relajado', 'perimetro_brazo_contraido', 'perimetro_muslo_medio', 'perimetro_pierna',
  'diametro_humero', 'diametro_muneca', 'diametro_femur',
  'porcentaje_grasa', 'masa_muscular_esqueletica', 'masa_mineral_osea', 'sumatoria_pliegues',
  'posicion_rugby', 'categoria', 'grupo',
  'endomorfia', 'mesomorfia', 'ectomorfia', 'x_somatocarta', 'y_somatocarta',
];

const soloColumnas = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => COLUMNAS.includes(k)));

// Sexo y edad del deportista: la ecuación de Durnin-Womersley usa coeficientes por sexo y grupo de edad
const datosDelJugador = async (jugadorId) => {
  if (!jugadorId) return { genero: 'masculino', edad: null };
  const { rows } = await pool.query(
    `SELECT genero, COALESCE(date_part('year', age(fecha_nacimiento))::int, edad) AS edad FROM jugadores WHERE id = $1`,
    [jugadorId]
  );
  return { genero: rows[0]?.genero || 'masculino', edad: rows[0]?.edad ?? null };
};

const getAntropometriaByJugador = async (req, res) => {
  try {
    // Solo quien puede ver al deportista accede a sus medidas (DEF-029)
    if (!(await puedeVerJugador(pool, req.usuario, req.params.id))) {
      return res.status(404).json({ error: 'Deportista no encontrado o fuera de tu alcance.' });
    }
    const { rows } = await pool.query(
      'SELECT * FROM antropometria WHERE jugador_id = $1 ORDER BY fecha DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    responderError(res, err);
  }
};

const createAntropometria = async (req, res) => {
  try {
    const data = soloColumnas(req.body);
    for (const key in data) if (data[key] === '') data[key] = null;

    const { genero, edad } = await datosDelJugador(data.jugador_id);
    const calculated = await calcularAntropometria(data, genero, edad);
    const fields = soloColumnas({ ...data, ...calculated });
    const keys   = Object.keys(fields);
    const vals   = Object.values(fields);
    const params = keys.map((_, i) => `$${i + 1}`).join(', ');

    const { rows } = await pool.query(
      `INSERT INTO antropometria (${keys.join(', ')}) VALUES (${params}) RETURNING id`,
      vals
    );
    res.status(201).json({ id: rows[0].id, ...fields });
  } catch (err) {
    responderError(res, err);
  }
};

const updateAntropometria = async (req, res) => {
  try {
    const data = soloColumnas(req.body);
    for (const key in data) if (data[key] === '') data[key] = null;

    const { genero, edad } = await datosDelJugador(data.jugador_id);
    const calculated = await calcularAntropometria(data, genero, edad);
    const fields = soloColumnas({ ...data, ...calculated });
    const keys   = Object.keys(fields);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const vals = [...Object.values(fields), req.params.id];

    await pool.query(
      `UPDATE antropometria SET ${setClause} WHERE id = $${vals.length}`,
      vals
    );
    res.json({ message: 'Registro actualizado correctamente', ...fields });
  } catch (err) {
    responderError(res, err);
  }
};

const deleteAntropometria = async (req, res) => {
  try {
    await pool.query('DELETE FROM antropometria WHERE id = $1', [req.params.id]);
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (err) {
    responderError(res, err);
  }
};

module.exports = { calcularAntropometria, getAntropometriaByJugador, createAntropometria, updateAntropometria, deleteAntropometria };
