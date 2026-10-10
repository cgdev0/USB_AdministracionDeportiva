const db = require('../config/db');

const { responderError } = require('../utils/errores');
exports.getAll = async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM entrenamientos ORDER BY fecha DESC');
    res.json(rows);
  } catch (err) {
    responderError(res, err);
  }
};

exports.getOne = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM entrenamientos WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Entrenamiento no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    responderError(res, err);
  }
};

exports.create = async (req, res) => {
  const { fecha, tipo, descripcion } = req.body;
  if (!fecha || !tipo) return res.status(400).json({ error: 'Fecha y tipo son obligatorios' });
  try {
    const { rows } = await db.query(
      'INSERT INTO entrenamientos (fecha, tipo, descripcion) VALUES ($1,$2,$3) RETURNING id',
      [fecha, tipo, descripcion]
    );
    res.status(201).json({ id: rows[0].id, fecha, tipo, descripcion });
  } catch (err) {
    responderError(res, err);
  }
};

exports.update = async (req, res) => {
  const { fecha, tipo, descripcion } = req.body;
  try {
    const { rowCount } = await db.query(
      'UPDATE entrenamientos SET fecha=$1, tipo=$2, descripcion=$3 WHERE id=$4',
      [fecha, tipo, descripcion, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Entrenamiento no encontrado' });
    res.json({ message: 'Entrenamiento actualizado correctamente' });
  } catch (err) {
    responderError(res, err);
  }
};

exports.remove = async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM entrenamientos WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Entrenamiento no encontrado' });
    res.json({ message: 'Entrenamiento eliminado correctamente' });
  } catch (err) {
    responderError(res, err);
  }
};
