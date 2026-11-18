const router = require('express').Router();
const ctrl   = require('../controllers/evaluaciones.controller');
const { verificarToken, autorizar } = require('../middleware/auth');

router.use(verificarToken);

router.get('/',       ctrl.getAll);
// v2.7 (T0.7): las pruebas de condición física las registra el entrenador (el docente: "el entrenador se encarga de
// las condiciones físicas"); el personal de salud las consulta. Las pruebas de la valoración clínica van en la Fase 3.
router.post('/',      autorizar('administrador', 'entrenador'), ctrl.create);
router.delete('/:id', autorizar('administrador', 'entrenador'), ctrl.remove);

module.exports = router;
