const router = require('express').Router();
const ctrl = require('../controllers/userController');
const { authenticate, authorize, selfOrAdmin } = require('../middleware/auth');
const { updateUserValidators, paramIdValidator, validate } = require('../middleware/validators');

// All routes require authentication
router.use(authenticate);

// Admin-only: list all users
router.get('/', authorize('users:read'), ctrl.getUsers);

// Self or admin: get a user by ID
router.get('/:id', paramIdValidator, validate, selfOrAdmin('id'), ctrl.getUserById);

// Self or admin: update a user
router.patch('/:id', paramIdValidator, updateUserValidators, validate, selfOrAdmin('id'), ctrl.updateUser);

// Admin-only: delete a user
router.delete('/:id', paramIdValidator, validate, authorize('users:delete'), ctrl.deleteUser);

module.exports = router;
