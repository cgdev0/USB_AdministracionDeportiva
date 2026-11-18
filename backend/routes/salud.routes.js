const router=require('express').Router();
const ctrl=require('../controllers/salud.controller');
const {verificarToken,autorizar,autorizarEstricto}=require('../middleware/auth');
router.use(verificarToken);
// v2.7 (T0.7): la información clínica es del equipo de salud (Res. 1995 de 1999, art. 14). Se usa autorizarEstricto
// porque `autorizar` deja pasar siempre al administrador, que gestiona cuentas pero no es parte del equipo de salud.
// La disponibilidad del plantel (apto, restricciones, retorno) la ven el entrenador y el administrador en el inicio.
router.get('/historias',autorizarEstricto('personal_salud'),ctrl.getHistorias);
router.post('/historias',autorizarEstricto('personal_salud'),ctrl.saveHistoria);
router.get('/controles',autorizarEstricto('personal_salud','jugador'),ctrl.getControles);
router.get('/seguimientos-lesiones',autorizarEstricto('personal_salud'),ctrl.getSeguimientos);
router.post('/seguimientos-lesiones',autorizarEstricto('personal_salud'),ctrl.createSeguimiento);
router.post('/controles',autorizarEstricto('personal_salud'),ctrl.createControl);
// Las notificaciones son personales (avisos de la campanita), no información clínica
router.get('/notificaciones',autorizar('administrador','personal_salud','jugador'),ctrl.getNotificaciones);
router.patch('/notificaciones/:id/leida',autorizar('administrador','personal_salud','jugador'),ctrl.leerNotificacion);
module.exports=router;
