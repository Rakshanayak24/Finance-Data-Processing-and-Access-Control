const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { registerValidators, loginValidators, validate } = require('../middleware/validators');

// Public
router.post('/register', authLimiter, registerValidators, validate, ctrl.register);
router.post('/login',    authLimiter, loginValidators, validate, ctrl.login);
router.post('/refresh',  ctrl.refreshToken);

// Protected
router.get('/me',          authenticate, ctrl.getMe);
router.post('/logout',     authenticate, ctrl.logout);
router.post('/logout-all', authenticate, ctrl.logoutAll);

module.exports = router;
