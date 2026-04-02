const router = require('express').Router();
const ctrl = require('../controllers/recordController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  createRecordValidators, updateRecordValidators,
  recordQueryValidators, paramIdValidator, validate,
} = require('../middleware/validators');

router.use(authenticate);

// Read — Viewer, Analyst, Admin
router.get('/', authorize('records:read'), recordQueryValidators, validate, ctrl.getRecords);
router.get('/:id', authorize('records:read'), paramIdValidator, validate, ctrl.getRecordById);

// Write — Analyst, Admin
router.post('/', authorize('records:create'), createRecordValidators, validate, ctrl.createRecord);
router.patch('/:id', authorize('records:update'), paramIdValidator, updateRecordValidators, validate, ctrl.updateRecord);

// Delete/Restore — Admin only
router.delete('/:id', authorize('records:delete'), paramIdValidator, validate, ctrl.deleteRecord);
router.post('/:id/restore', authorize('records:delete'), paramIdValidator, validate, ctrl.restoreRecord);

module.exports = router;
