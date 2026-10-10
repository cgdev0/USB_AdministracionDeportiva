const router = require('express').Router();
const ctrl   = require('../controllers/lesiones.controller');
const { verificarToken, autorizar } = require('../middleware/auth');

router.use(verificarToken);

router.get('/',       autorizar('administrador', 'personal_salud'), ctrl.getAll);
router.get('/:id',    autorizar('administrador', 'personal_salud'), ctrl.getOne);
router.post('/',      autorizar('administrador', 'personal_salud'), ctrl.create);
router.put('/:id',    autorizar('administrador', 'personal_salud'), ctrl.update);
router.delete('/:id', autorizar('administrador', 'personal_salud'), ctrl.remove);

module.exports = router;
