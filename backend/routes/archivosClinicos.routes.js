// Archivos clínicos protegidos (v2.7, T0.5). Sin el pase libre del administrador: no es parte del equipo de salud.
const router = require('express').Router();
const ctrl   = require('../controllers/archivosClinicos.controller');
const { verificarToken, autorizarEstricto: autorizar } = require('../middleware/auth');

router.use(verificarToken);

router.post('/',    autorizar('personal_salud'), ctrl.recibirArchivo, ctrl.subir);
router.get('/',     autorizar('personal_salud', 'jugador'), ctrl.listar);
router.get('/:id',  autorizar('personal_salud', 'jugador'), ctrl.descargar);

module.exports = router;
