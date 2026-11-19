// Avisos de manejo de datos (v2.9, T2.4): cada persona ve y acepta el que le corresponde según su rol.
const router = require('express').Router();
const ctrl   = require('../controllers/avisos.controller');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);
router.get('/mios',     ctrl.mios);
router.post('/aceptar', ctrl.aceptar);
// v2.9 (T2.6): aceptación del deportista en la tableta del profesional (testigo)
router.get('/deportista/:jugador_id',          ctrl.delDeportista);
router.post('/deportista/:jugador_id/aceptar', ctrl.aceptarEnTableta);

module.exports = router;
