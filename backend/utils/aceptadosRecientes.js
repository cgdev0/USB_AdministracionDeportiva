// Quién aceptó su aviso hace poco (v2.9, T2.5): así no se consulta la base en cada petición.
// Solo se recuerda lo aceptado, por 5 minutos y en la memoria del servidor; lo pendiente siempre se consulta.
// Al desplegar una versión con un texto nuevo, el servidor arranca vacío y todos vuelven a revisarse.
const VIGENCIA_MS = 5 * 60 * 1000;
const aceptados = new Map(); // usuario_id → vence (ms)

module.exports = {
  recordar: (usuarioId) => aceptados.set(Number(usuarioId), Date.now() + VIGENCIA_MS),
  aceptoHacePoco: (usuarioId) => (aceptados.get(Number(usuarioId)) || 0) > Date.now(),
  olvidar: (usuarioId) => aceptados.delete(Number(usuarioId)),
};
