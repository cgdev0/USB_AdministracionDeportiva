// Qué deportistas puede ver cada rol (la misma regla que Deportistas, Lesiones e Inicio):
//   deportista → solo él mismo · entrenador → los suyos · head coach → los de sus entrenadores
//   administrador y personal de salud → todos
// Protege datos personales y de salud (Ley 1581 de 2012). v1.5.2.

// Condición SQL sobre la tabla jugadores (alias `j` por defecto), o null si el rol ve a todos.
function condicionAlcance(usuario, params, alias = 'j') {
  if (usuario?.rol === 'jugador') {
    params.push(usuario.jugador_id || 0);
    return `${alias}.id = $${params.length}`;
  }
  if (usuario?.rol === 'entrenador') {
    params.push(usuario.id);
    return `${alias}.entrenador_id = $${params.length}`;
  }
  if (usuario?.rol === 'head_coach') {
    params.push(usuario.id);
    return `${alias}.entrenador_id IN (SELECT id FROM usuarios WHERE head_coach_id = $${params.length})`;
  }
  return null;
}

// ¿Puede este usuario ver a este deportista?
async function puedeVerJugador(db, usuario, jugadorId) {
  const params = [jugadorId];
  const cond = condicionAlcance(usuario, params);
  const { rows } = await db.query(`SELECT 1 FROM jugadores j WHERE j.id = $1${cond ? ` AND ${cond}` : ''}`, params);
  return rows.length > 0;
}

module.exports = { condicionAlcance, puedeVerJugador };
