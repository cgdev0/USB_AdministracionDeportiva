// Aplicación Express de la API. La usan server.js (raíz, desarrollo y producción),
// backend/server.js (solo API) y las pruebas automáticas.
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { manejadorFinal, validarId } = require('../backend/utils/errores');

const app = express();
app.disable('x-powered-by');

// CORS: en producción el frontend se sirve desde el mismo origen; FRONTEND_URL permite otros (separados por coma)
const origenes = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(s => s.trim()) : null;
app.use(cors({ origin: origenes || process.env.NODE_ENV !== 'production' }));

// Cabeceras de seguridad básicas
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  next();
});

app.use(express.json({ limit: '1mb' }));

// Servir estáticos de uploads
app.use('/uploads', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '..', 'backend', 'uploads')));

// Rutas API (cada router valida que sus parámetros :id sean enteros positivos)
const RUTAS = {
  auth: 'auth', usuarios: 'usuarios', equipos: 'equipos', disciplinas: 'disciplinas',
  jugadores: 'jugadores', entrenamientos: 'entrenamientos', asistencia: 'asistencia',
  lesiones: 'lesiones', evaluaciones: 'evaluaciones', partidos: 'partidos',
  estadisticas: 'estadisticas', dashboard: 'dashboard', settings: 'settings',
  antropometria: 'antropometria', 'head-coach': 'headcoach', salud: 'salud',
  convocatorias: 'convocatorias', notificaciones: 'notificaciones',
};
for (const [prefijo, archivo] of Object.entries(RUTAS)) {
  const router = require(`../backend/routes/${archivo}.routes`);
  for (const nombre of ['id', 'jugador_id']) router.param(nombre, validarId);
  app.use(`/api/${prefijo}`, router);
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// 404 handler for API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Ruta API no encontrada' });
});

// Errores no capturados: nunca devuelven detalles internos
app.use('/api', manejadorFinal);

module.exports = app;
