const router = require('express').Router();
const ctrl   = require('../controllers/antropometria.controller');
const { verificarToken, autorizarEstricto } = require('../middleware/auth');

router.use(verificarToken);

// v2.7 (T0.7): la antropometría hace parte de la historia clínica (tablero del docente: "Antropometría").
// La registra y la consulta el personal de salud; el deportista consulta las suyas (el controlador revisa que sean
// suyas). El entrenador, el head coach y el administrador no (antes el entrenador también la registraba).
router.get('/jugador/:id',  autorizarEstricto('personal_salud', 'jugador'), ctrl.getAntropometriaByJugador);
router.post('/',            autorizarEstricto('personal_salud'), ctrl.createAntropometria);
router.put('/:id',          autorizarEstricto('personal_salud'), ctrl.updateAntropometria);
router.delete('/:id',       autorizarEstricto('personal_salud'), ctrl.deleteAntropometria);

module.exports = router;
