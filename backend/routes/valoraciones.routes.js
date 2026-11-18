// Valoraciones de la historia clínica (v2.7, T0.3). Solo el personal de salud las crea, edita y cierra;
// el deportista consulta las suyas cerradas (Resolución 1995 de 1999, art. 14).
const router = require('express').Router();
const ctrl   = require('../controllers/valoraciones.controller');
// autorizarEstricto: sin el pase libre del administrador (no es parte del equipo de salud)
const { verificarToken, autorizarEstricto: autorizar } = require('../middleware/auth');

router.use(verificarToken);

router.get('/',                  autorizar('personal_salud', 'jugador'), ctrl.listar);
router.get('/:id',               autorizar('personal_salud', 'jugador'), ctrl.obtener);
router.get('/:id/integridad',    autorizar('personal_salud'), ctrl.integridad);
router.post('/',                 autorizar('personal_salud'), ctrl.crear);
router.put('/:id',               autorizar('personal_salud'), ctrl.guardar);
router.post('/:id/cerrar',       autorizar('personal_salud'), ctrl.cerrar);
router.post('/:id/notas',        autorizar('personal_salud'), ctrl.agregarNota);
router.delete('/:id',            autorizar('personal_salud'), ctrl.descartar);

module.exports = router;
