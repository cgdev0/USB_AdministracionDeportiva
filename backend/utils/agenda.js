// Operaciones comunes de entrenamientos y partidos por equipo (v1.7): listar, ver, validar y comprobar permisos.
const db = require('../config/db');
const { condicionEquipos, puedeUsarEquipo } = require('./alcance');
const { hoyLocal } = require('./hoy');

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// v2.6: horas que se pueden programar (las mismas que muestra la pantalla): de 6:00 a. m. a 10:00 p. m., cada 30 minutos
const HORAS_DISPONIBLES = [];
for (let m = 6 * 60; m <= 22 * 60; m += 30) HORAS_DISPONIBLES.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);

// Hora actual 'HH:MM' en la zona horaria de la app (db.js fija TZ = America/Bogota)
const horaActual = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Horas ya ocupadas por un equipo en una fecha (entrenamientos y partidos). `excluir` = { tabla, id } de la actividad que se edita.
async function horasOcupadas(equipoId, fecha, excluir = {}) {
  if (!equipoId || !FECHA.test(String(fecha || ''))) return [];
  const { rows } = await db.query(`
    SELECT hora FROM entrenamientos WHERE equipo_id = $1 AND fecha = $2 AND hora IS NOT NULL AND NOT ($3 = 'entrenamientos' AND id = $4)
    UNION
    SELECT hora FROM partidos WHERE equipo_id = $1 AND fecha = $2 AND hora IS NOT NULL AND NOT ($3 = 'partidos' AND id = $4)`,
  [equipoId, fecha, excluir.tabla || '', excluir.id || 0]);
  return rows.map(r => r.hora).sort();
}

// v2.6: no se programan entrenamientos ni partidos en el pasado, y la hora debe ser una de las disponibles.
// Al editar, una fecha u hora que no cambia se conserva aunque ya haya pasado (por ejemplo, para anotar el
// resultado de un partido jugado). Devuelve { error, status } o {}.
async function validarFechaHora(tabla, { fecha, hora, equipo_id }, actual = null) {
  if (!FECHA.test(String(fecha || ''))) return { error: 'La fecha no es válida. Elige un día en el calendario.' };
  const cambiaFecha = !actual || actual.fecha !== fecha;
  const cambiaHora = !actual || (actual.hora || null) !== (hora || null);
  const hoy = hoyLocal();
  if (cambiaFecha && fecha < hoy) return { error: 'No se puede programar en una fecha pasada. Elige hoy o un día siguiente.' };
  if (hora && (cambiaFecha || cambiaHora)) {
    if (!HORAS_DISPONIBLES.includes(hora)) return { error: 'Elige una de las horas disponibles (de 6:00 a. m. a 10:00 p. m., cada 30 minutos).' };
    if (fecha === hoy && hora <= horaActual()) return { error: 'Esa hora ya pasó. Elige una de las horas disponibles.' };
    const ocupadas = await horasOcupadas(equipo_id, fecha, { tabla, id: actual?.id });
    if (ocupadas.includes(hora)) return { error: 'El equipo ya tiene otra actividad a esa hora. Elige una de las horas disponibles.', status: 409 };
  }
  return {};
}

// Lee equipo, hora y lugar del cuerpo y los valida. Devuelve { error } o { equipo_id, hora, lugar }.
async function camposAgenda(usuario, cuerpo) {
  const equipo_id = cuerpo.equipo_id === '' || cuerpo.equipo_id === undefined || cuerpo.equipo_id === null ? null : Number(cuerpo.equipo_id);
  if (equipo_id !== null && (!Number.isInteger(equipo_id) || equipo_id < 1)) return { error: 'El equipo indicado no es válido.' };
  const hora = typeof cuerpo.hora === 'string' && cuerpo.hora.trim() ? cuerpo.hora.trim() : null;
  if (hora && !HORA.test(hora)) return { error: 'La hora debe tener el formato HH:MM.' };
  const lugar = typeof cuerpo.lugar === 'string' && cuerpo.lugar.trim() ? cuerpo.lugar.trim() : null;
  // v2.0 (DEF-042): solo el administrador crea actividades generales (para todos los equipos). Un entrenador
  // debe elegir uno de sus equipos; si no, su entrenamiento le aparecía también a los equipos de otros deportes.
  if (equipo_id === null && usuario?.rol !== 'administrador') return { error: 'Elige el equipo para esta actividad.' };
  if (!(await puedeUsarEquipo(db, usuario, equipo_id))) return { error: 'Solo puedes asignar equipos de tu deporte.', status: 403 };
  return { equipo_id, hora, lugar };
}

// Lista de una tabla de agenda ('entrenamientos' o 'partidos') visible para el usuario, con el nombre del equipo
async function listar(tabla, usuario, extra = '') {
  const params = [];
  const cond = condicionEquipos(usuario, params, 'a.equipo_id');
  const { rows } = await db.query(`
    SELECT a.*, eq.nombre AS equipo_nombre, eq.disciplina_id, dd.nombre AS disciplina_nombre FROM ${tabla} a
    LEFT JOIN equipos eq ON eq.id = a.equipo_id LEFT JOIN disciplinas dd ON dd.id = eq.disciplina_id
    ${cond ? `WHERE ${cond}` : ''} ${extra} ORDER BY a.fecha DESC, a.hora NULLS LAST, a.id DESC`, params);
  return rows;
}

// Una actividad si el usuario puede verla; null si no existe o está fuera de su alcance
async function buscar(tabla, usuario, id, cliente = db) {
  const params = [id];
  const cond = condicionEquipos(usuario, params, 'a.equipo_id');
  const { rows } = await cliente.query(`
    SELECT a.*, eq.nombre AS equipo_nombre, eq.disciplina_id, dd.nombre AS disciplina_nombre FROM ${tabla} a
    LEFT JOIN equipos eq ON eq.id = a.equipo_id LEFT JOIN disciplinas dd ON dd.id = eq.disciplina_id
    WHERE a.id = $1${cond ? ` AND ${cond}` : ''}`, params);
  return rows[0] || null;
}

// GET /api/entrenamientos/horas-disponibles y /api/partidos/horas-disponibles?fecha=AAAA-MM-DD&equipo_id=&id=
// Devuelve todas las horas del día con su estado, para que la pantalla muestre solo las que se pueden elegir.
function rutaHorasDisponibles(tabla) {
  return async (req, res) => {
    try {
      const fecha = String(req.query.fecha || '');
      if (!FECHA.test(fecha)) return res.status(400).json({ error: 'La fecha no es válida.' });
      const equipoId = Number(req.query.equipo_id) || null;
      const id = Number(req.query.id) || null;
      // Solo se consulta la agenda de equipos propios (el administrador, cualquiera)
      const propio = equipoId ? await puedeUsarEquipo(db, req.usuario, equipoId) : true;
      const ocupadas = propio ? await horasOcupadas(equipoId, fecha, { tabla, id }) : [];
      const hoy = hoyLocal(), ahora = horaActual();
      res.json({
        fecha,
        pasada: fecha < hoy,
        horas: HORAS_DISPONIBLES.map(hora => {
          const motivo = fecha < hoy || (fecha === hoy && hora <= ahora) ? 'pasada' : ocupadas.includes(hora) ? 'ocupada' : null;
          return { hora, disponible: !motivo, motivo };
        }),
      });
    } catch (err) {
      require('./errores').responderError(res, err);
    }
  };
}

module.exports = { rutaHorasDisponibles, camposAgenda, listar, buscar, validarFechaHora, horasOcupadas, HORAS_DISPONIBLES, horaActual };
