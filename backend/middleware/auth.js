const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/secretos');

const PERMISOS = {
  administrador: ['*'],
  head_coach: ['dashboard', 'head_coach', 'jugadores:read', 'entrenamientos:read', 'partidos:read', 'lesiones:read', 'estadisticas:read'],
  entrenador: [
    'dashboard', 'jugadores', 'entrenamientos', 'asistencia',
    'partidos', 'estadisticas', 'evaluaciones:read', 'lesiones:read',
    'antropometria:read', 'usuarios:create_limited',
  ],
  personal_salud: [
    'dashboard', 'jugadores:read', 'lesiones', 'antropometria',
    'evaluaciones', 'estadisticas:read',
  ],
  jugador: ['dashboard:own', 'jugadores:own', 'lesiones:own', 'evaluaciones:own', 'antropometria:own'],
};

exports.verificarToken = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    const token = auth.split(' ')[1];
    req.usuario = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

exports.autorizar = (...roles) => (req, res, next) => {
  if (!req.usuario) return res.status(401).json({ error: 'No autenticado' });
  if (roles.includes(req.usuario.rol) || req.usuario.rol === 'administrador') return next();
  return res.status(403).json({ error: 'Acceso denegado para tu rol' });
};

// v2.7 (T0.3): igual que `autorizar`, pero SIN el pase libre del administrador. Lo usan las rutas de la historia
// clínica: el administrador gestiona cuentas, no es parte del equipo de salud (Resolución 1995 de 1999, art. 14;
// decisión D5 del plan). La T0.7 lo extiende al resto de rutas clínicas.
exports.autorizarEstricto = (...roles) => (req, res, next) => {
  if (!req.usuario) return res.status(401).json({ error: 'No autenticado' });
  if (roles.includes(req.usuario.rol)) return next();
  return res.status(403).json({ error: 'Acceso denegado para tu rol' });
};
