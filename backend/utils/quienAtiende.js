// Datos de quien atiende en el área de salud (v2.7, T0.2 del plan de historia clínica).
// La descripción ("Practicante de fisioterapia · Supervisa: …") sale de frontend/src/utils/profesionales.js,
// la misma que usa la pantalla. Desde la T0.3, cada valoración guarda una copia de estos datos al cerrarse.
const path = require('path');
const { pathToFileURL } = require('url');

const modulo = import(pathToFileURL(path.join(__dirname, '..', '..', 'frontend', 'src', 'utils', 'profesionales.js')).href);

// Columnas y JOIN para agregar a una consulta que ya tiene la tabla de usuarios con el alias `alias`
// (por ejemplo, el profesional de un control médico). El supervisor queda con el alias `${alias}_sup`.
function columnasQuienAtiende(alias) {
  return {
    columnas: `${alias}.nombre AS atendio_nombre, ${alias}.profesion AS atendio_profesion, ${alias}.vinculo AS atendio_vinculo,
      ${alias}.registro_profesional AS atendio_registro, ${alias}_sup.nombre AS atendio_supervisor`,
    join: `LEFT JOIN usuarios ${alias}_sup ON ${alias}_sup.id = ${alias}.supervisor_id`,
  };
}

// Agrega a cada fila el texto "Nombre · Practicante de fisioterapia · Supervisa: …" y quita las columnas auxiliares
async function conQuienAtiende(filas) {
  const { descripcionQuienAtiende } = await modulo;
  return filas.map(({ atendio_nombre, atendio_profesion, atendio_vinculo, atendio_registro, atendio_supervisor, ...fila }) => ({
    ...fila,
    atendio: atendio_nombre ? `${atendio_nombre} · ${descripcionQuienAtiende({
      profesion: atendio_profesion, vinculo: atendio_vinculo, registro_profesional: atendio_registro, supervisor_nombre: atendio_supervisor,
    })}` : null,
  }));
}

// Datos completos de quien atiende, para copiarlos en un registro clínico (T0.3) o mostrarlos en la sesión
async function datosDeQuienAtiende(db, usuarioId) {
  const { rows: [u] } = await db.query(
    `SELECT u.id, u.nombre, u.rol, u.profesion, u.vinculo, u.registro_profesional, u.supervisor_id,
            s.nombre AS supervisor_nombre, s.registro_profesional AS supervisor_registro
       FROM usuarios u LEFT JOIN usuarios s ON s.id = u.supervisor_id WHERE u.id = $1`, [usuarioId]);
  if (!u) return null;
  const { descripcionQuienAtiende } = await modulo;
  return {
    usuario_id: u.id,
    nombre: u.nombre,
    profesion: u.profesion,
    vinculo: u.vinculo,
    registro_profesional: u.registro_profesional,
    supervisor_id: u.supervisor_id,
    supervisor_nombre: u.supervisor_nombre,
    supervisor_registro: u.supervisor_registro,
    descripcion: descripcionQuienAtiende(u),
  };
}

module.exports = { modulo, columnasQuienAtiende, conQuienAtiende, datosDeQuienAtiende };
