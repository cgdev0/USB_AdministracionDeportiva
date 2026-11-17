// Fechas relativas a hoy en la zona horaria de la app (ejecutar-api.js fija TZ = America/Bogota).
// v2.6: los entrenamientos y partidos no se pueden programar en el pasado, así que las pruebas no usan fechas fijas.
function fechaEnDias(dias) {
  const d = new Date(); d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const horaActual = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
module.exports = { fechaEnDias, horaActual };
