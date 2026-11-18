// Lista de pacientes (v2.8, T1.3) y ficha clínica (T1.4): solo el personal de salud (información clínica; sin el pase del administrador)
const router = require('express').Router();
const ctrl   = require('../controllers/pacientes.controller');
const { verificarToken, autorizarEstricto } = require('../middleware/auth');

router.use(verificarToken);
router.get('/', autorizarEstricto('personal_salud'), ctrl.listar);
router.get('/:id', autorizarEstricto('personal_salud'), ctrl.ficha);

module.exports = router;
