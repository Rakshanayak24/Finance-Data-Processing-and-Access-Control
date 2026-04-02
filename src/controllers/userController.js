/**
 * User Controller
 */

const userService = require('../services/userService');
const { sendSuccess, buildPaginationMeta, parsePagination } = require('../utils/response');
const { createAuditLog } = require('../services/auditService');

function getUsers(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { role, status, search } = req.query;

    const { users, total } = userService.getAllUsers({ page, limit, role, status, search });

    return sendSuccess(
      res, users, 'Users fetched successfully.',
      200, buildPaginationMeta(page, limit, total)
    );
  } catch (err) {
    next(err);
  }
}

function getUserById(req, res, next) {
  try {
    const user = userService.getUserById(req.params.id);
    return sendSuccess(res, user, 'User fetched successfully.');
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const user = await userService.updateUser(req.params.id, req.body, req.user);
    createAuditLog({
      userId: req.user.id,
      action: 'UPDATE_USER',
      resource: 'users',
      resourceId: req.params.id,
      details: { updatedFields: Object.keys(req.body) },
      ipAddress: req.ip,
    });
    return sendSuccess(res, user, 'User updated successfully.');
  } catch (err) {
    next(err);
  }
}

function deleteUser(req, res, next) {
  try {
    userService.deleteUser(req.params.id, req.user.id);
    createAuditLog({
      userId: req.user.id,
      action: 'DELETE_USER',
      resource: 'users',
      resourceId: req.params.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, null, 'User deleted successfully.');
  } catch (err) {
    next(err);
  }
}

module.exports = { getUsers, getUserById, updateUser, deleteUser };
