const router = require('express').Router();
const ctrl   = require('../controllers/lesiones.controller');
const { verificarToken, autorizar, autorizarEstricto } = require('../middleware/auth');

router.use(verificarToken);

// Lectura: cada rol ve solo lo que le corresponde (filtrado en el controlador). v2.7 (T0.7): el entrenador, el
// head coach y el administrador reciben solo la disponibilidad (fechas, estado y retorno), sin el tipo ni la
// descripción de la lesión; el detalle clínico es del personal de salud y del propio deportista.
router.get('/',       autorizar('administrador', 'personal_salud', 'head_coach', 'entrenador', 'jugador'), ctrl.getAll);
router.get('/:id',    autorizar('administrador', 'personal_salud', 'head_coach', 'entrenador', 'jugador'), ctrl.getOne);
// v2.7 (T0.7): solo el personal de salud registra, edita o elimina lesiones (antes también el administrador)
router.post('/',      autorizarEstricto('personal_salud'), ctrl.create);
router.put('/:id',    autorizarEstricto('personal_salud'), ctrl.update);
router.delete('/:id', autorizarEstricto('personal_salud'), ctrl.remove);

module.exports = router;
