const router = require('express').Router();
const ctrl = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// All roles can see the dashboard
router.get('/overview',            authorize('dashboard:read'), ctrl.getOverview);
router.get('/summary',             authorize('dashboard:read'), ctrl.getSummary);
router.get('/recent-activity',     authorize('dashboard:read'), ctrl.getRecentActivity);

// Analyst + Admin
router.get('/categories',          authorize('analytics:read'), ctrl.getCategoryBreakdown);
router.get('/trends/monthly',      authorize('analytics:read'), ctrl.getMonthlyTrends);
router.get('/trends/weekly',       authorize('analytics:read'), ctrl.getWeeklyTrends);
router.get('/top-categories',      authorize('analytics:read'), ctrl.getTopCategories);

module.exports = router;
