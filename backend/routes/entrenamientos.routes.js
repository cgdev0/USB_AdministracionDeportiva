const router = require('express').Router();
const ctrl   = require('../controllers/entrenamientos.controller');
const { verificarToken, autorizar } = require('../middleware/auth');
const { rutaHorasDisponibles } = require('../utils/agenda');

router.use(verificarToken);

router.get('/',       ctrl.getAll);
// v2.6: horas que el sistema ofrece para programar (antes de '/:id' para que no se lea como un id)
router.get('/horas-disponibles', autorizar('administrador', 'entrenador'), rutaHorasDisponibles('entrenamientos'));
router.get('/:id',    ctrl.getOne);
router.post('/',      autorizar('administrador', 'entrenador'), ctrl.create);
router.put('/:id',    autorizar('administrador', 'entrenador'), ctrl.update);
router.delete('/:id', autorizar('administrador', 'entrenador'), ctrl.remove);

module.exports = router;
