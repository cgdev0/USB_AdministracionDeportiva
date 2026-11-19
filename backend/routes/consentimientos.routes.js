// Consentimientos (v2.9, T2.1): los registra el personal de salud; los consulta también el propio deportista.
// Sin el pase libre del administrador: no es parte del equipo de salud.
const router = require('express').Router();
const ctrl   = require('../controllers/consentimientos.controller');
const { recibirArchivo } = require('../controllers/archivosClinicos.controller');
const { verificarToken, autorizarEstricto } = require('../middleware/auth');

router.use(verificarToken);
router.get('/',             autorizarEstricto('personal_salud', 'jugador'), ctrl.listar);
router.post('/',            autorizarEstricto('personal_salud'), recibirArchivo, ctrl.registrar);
router.post('/:id/revocar', autorizarEstricto('personal_salud'), recibirArchivo, ctrl.revocar);

module.exports = router;
