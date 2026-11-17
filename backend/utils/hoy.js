// Fecha de hoy 'YYYY-MM-DD' en la zona horaria de la app (db.js fija TZ = America/Bogota por defecto).
// toISOString() da la fecha UTC, que en Colombia después de las 7 p. m. ya es el día siguiente.
function hoyLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
module.exports = { hoyLocal };
