const router = require('express').Router();
const { getAuditLogsHandler } = require('../controllers/auditController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('audit:read'));
router.get('/', getAuditLogsHandler);

module.exports = router;
