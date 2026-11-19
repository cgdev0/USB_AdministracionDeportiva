// Nadie trabaja con datos sin haber aceptado su aviso (v2.9, T2.5 del plan de historia clínica; D9 y D10).
// Va antes de todas las rutas de la API, salvo las de la sesión (/api/auth) y las del aviso (/api/avisos):
//  - sin token o con un token inválido, deja pasar: la ruta responde 401 como siempre;
//  - si al usuario le falta aceptar la versión vigente de su aviso, responde 403 con codigo ACEPTACION_PENDIENTE,
//    y la pantalla muestra el aviso para aceptarlo.
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/secretos');
const { pendienteDe } = require('../controllers/avisos.controller');
const { recordar, aceptoHacePoco } = require('../utils/aceptadosRecientes');

const MENSAJE = {
  compromiso_personal: 'Acepta el compromiso de confidencialidad y manejo de datos para continuar.',
  aviso_deportista: 'Acepta el aviso de privacidad para continuar.',
};

exports.exigirAceptacion = async (req, res, next) => {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return next();
  let usuario;
  try {
    usuario = jwt.verify(auth.slice(7), JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return next();
  }
  if (aceptoHacePoco(usuario.id)) return next();
  try {
    const pendiente = await pendienteDe(usuario);
    if (!pendiente) {
      recordar(usuario.id);
      return next();
    }
    return res.status(403).json({ error: MENSAJE[pendiente.aviso] || MENSAJE.compromiso_personal, codigo: 'ACEPTACION_PENDIENTE', aviso: pendiente.aviso });
  } catch (err) {
    return next(err);
  }
};
