const router = require('express').Router();
const ctrl   = require('../controllers/auth.controller');
const { verificarToken } = require('../middleware/auth');
const { limitarLogin } = require('../middleware/limite');

router.post('/login',             limitarLogin, ctrl.login);
router.post('/refresh',           ctrl.refresh);
router.get('/me',                 verificarToken, ctrl.me);
router.put('/cambiar-password',   verificarToken, ctrl.cambiarPassword);
// v2.7 (T0.8): desbloqueo por inactividad. El límite de intentos se lleva por la cuenta de la sesión.
const conCorreoDeLaSesion = (req, _res, next) => { req.body = { ...(req.body || {}), email: req.usuario.email }; next(); };
router.post('/desbloquear',       verificarToken, conCorreoDeLaSesion, limitarLogin, ctrl.desbloquear);

module.exports = router;
