// Bitácora de accesos a la historia clínica (v2.7, T0.6). Salud: por deportista; deportista: la suya;
// administrador: vista general de auditoría (sin contenido clínico). El entrenador y el head coach no.
const router = require('express').Router();
const ctrl   = require('../controllers/bitacora.controller');
const { verificarToken, autorizarEstricto } = require('../middleware/auth');

router.use(verificarToken);
router.get('/', autorizarEstricto('personal_salud', 'administrador', 'jugador'), ctrl.listar);

module.exports = router;
