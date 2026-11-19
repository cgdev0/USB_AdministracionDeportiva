// Módulo de auditoría (v2.9, T2.7): exclusivo del administrador; ningún otro rol entra, ni por la API.
const router = require('express').Router();
const ctrl   = require('../controllers/auditoria.controller');
const { verificarToken, autorizarEstricto } = require('../middleware/auth');

router.use(verificarToken, autorizarEstricto('administrador'));
router.get('/eventos',      ctrl.eventos);
router.get('/aceptaciones', ctrl.aceptaciones);
router.get('/cargas',       ctrl.cargas);
router.get('/cargas/:id',   ctrl.carga);
router.get('/pendientes',   ctrl.pendientes);
router.get('/exportar',     ctrl.exportar);
router.get('/ajustes',      ctrl.ajustes);
router.put('/ajustes',      ctrl.cambiarAjustes);

module.exports = router;
