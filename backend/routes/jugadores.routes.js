const router = require('express').Router();
const ctrl   = require('../controllers/jugadores.controller');
const { verificarToken, autorizar } = require('../middleware/auth');

router.use(verificarToken);

router.get('/',          ctrl.getAll);
router.get('/:id',       ctrl.getOne);
router.post('/bulk',     autorizar('administrador', 'entrenador'), ctrl.bulkCreate);
router.post('/',         autorizar('administrador', 'entrenador'), ctrl.create);
router.post('/:id/foto', autorizar('administrador', 'entrenador'), ctrl.uploadMiddleware, ctrl.uploadPhoto);
router.put('/:id',       autorizar('administrador', 'entrenador'), ctrl.update);
router.patch('/:id/dorsal', autorizar('administrador', 'entrenador'), ctrl.updateDorsal);
// v2.7: documento, contacto y acudiente; el personal de salud también registra los datos sensibles
router.patch('/:id/identificacion', autorizar('administrador', 'entrenador', 'personal_salud'), ctrl.updateIdentificacion);
// v2.7 (T0.4): retirar conserva la historia; eliminar solo se permite si no tiene historia clínica
router.patch('/:id/retirar',  autorizar('administrador', 'entrenador'), ctrl.retirar);
router.patch('/:id/reactivar', autorizar('administrador', 'entrenador'), ctrl.reactivar);
router.delete('/:id',    autorizar('administrador', 'entrenador'), ctrl.remove);

module.exports = router;
