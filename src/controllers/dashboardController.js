/**
 * Dashboard & Analytics Controller
 *
 * Controllers are intentionally thin — they parse the request,
 * delegate to the service layer, and send a response.
 */
const dashboardService = require('../services/dashboardService');
const { sendSuccess } = require('../utils/response');

function getOverview(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const userId = dashboardService.resolveUserScope(req.user);
    const data = dashboardService.getDashboardOverview({ startDate, endDate, userId });
    return sendSuccess(res, data, 'Dashboard overview fetched successfully.');
  } catch (err) { next(err); }
}

function getSummary(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const userId = dashboardService.resolveUserScope(req.user);
    const data = dashboardService.getSummary({ startDate, endDate, userId });
    return sendSuccess(res, data, 'Summary fetched successfully.');
  } catch (err) { next(err); }
}

function getCategoryBreakdown(req, res, next) {
  try {
    const { startDate, endDate, type } = req.query;
    const userId = dashboardService.resolveUserScope(req.user);
    const data = dashboardService.getCategoryBreakdown({ startDate, endDate, type, userId });
    return sendSuccess(res, data, 'Category breakdown fetched successfully.');
  } catch (err) { next(err); }
}

function getMonthlyTrends(req, res, next) {
  try {
    const { months = 12 } = req.query;
    const userId = dashboardService.resolveUserScope(req.user);
    const data = dashboardService.getMonthlyTrends({ months, userId });
    return sendSuccess(res, data, 'Monthly trends fetched successfully.');
  } catch (err) { next(err); }
}

function getWeeklyTrends(req, res, next) {
  try {
    const { weeks = 8 } = req.query;
    const userId = dashboardService.resolveUserScope(req.user);
    const data = dashboardService.getWeeklyTrends({ weeks, userId });
    return sendSuccess(res, data, 'Weekly trends fetched successfully.');
  } catch (err) { next(err); }
}

function getRecentActivity(req, res, next) {
  try {
    const { limit = 10 } = req.query;
    const userId = dashboardService.resolveUserScope(req.user);
    const data = dashboardService.getRecentActivity({ limit, userId });
    return sendSuccess(res, data, 'Recent activity fetched successfully.');
  } catch (err) { next(err); }
}

function getTopCategories(req, res, next) {
  try {
    const { limit = 5, startDate, endDate } = req.query;
    const userId = dashboardService.resolveUserScope(req.user);
    const data = dashboardService.getTopCategories({ limit, startDate, endDate, userId });
    return sendSuccess(res, data, 'Top categories fetched successfully.');
  } catch (err) { next(err); }
}

module.exports = {
  getOverview, getSummary, getCategoryBreakdown,
  getMonthlyTrends, getWeeklyTrends, getRecentActivity, getTopCategories,
};