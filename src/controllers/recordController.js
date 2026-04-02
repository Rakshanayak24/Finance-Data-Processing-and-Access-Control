/**
 * Financial Records Controller
 */

const recordService = require('../services/recordService');
const { sendSuccess, sendError, buildPaginationMeta, parsePagination } = require('../utils/response');
const { createAuditLog } = require('../services/auditService');

function getRecords(req, res, next) {
  try {
    const { page, limit } = parsePagination(req.query);
    const { sortBy = 'date', order = 'desc', type, category, startDate, endDate,
            minAmount, maxAmount, search, tags } = req.query;

    const filters = { type, category, startDate, endDate, minAmount, maxAmount, search };
    if (tags) filters.tags = Array.isArray(tags) ? tags : [tags];

    const { records, total } = recordService.getRecords({ page, limit, sortBy, order, filters });

    return sendSuccess(
      res, records, 'Records fetched successfully.',
      200, buildPaginationMeta(page, limit, total)
    );
  } catch (err) {
    next(err);
  }
}

function getRecordById(req, res, next) {
  try {
    const record = recordService.getRecordById(req.params.id);
    return sendSuccess(res, record, 'Record fetched successfully.');
  } catch (err) {
    next(err);
  }
}

function createRecord(req, res, next) {
  try {
    const record = recordService.createRecord({ ...req.body, userId: req.user.id });
    createAuditLog({
      userId: req.user.id,
      action: 'CREATE_RECORD',
      resource: 'financial_records',
      resourceId: record.id,
      details: { amount: record.amount, type: record.type, category: record.category },
      ipAddress: req.ip,
    });
    return sendSuccess(res, record, 'Record created successfully.', 201);
  } catch (err) {
    next(err);
  }
}

function updateRecord(req, res, next) {
  try {
    const record = recordService.updateRecord(req.params.id, req.body);
    createAuditLog({
      userId: req.user.id,
      action: 'UPDATE_RECORD',
      resource: 'financial_records',
      resourceId: req.params.id,
      details: { updatedFields: Object.keys(req.body) },
      ipAddress: req.ip,
    });
    return sendSuccess(res, record, 'Record updated successfully.');
  } catch (err) {
    next(err);
  }
}

function deleteRecord(req, res, next) {
  try {
    recordService.deleteRecord(req.params.id);
    createAuditLog({
      userId: req.user.id,
      action: 'DELETE_RECORD',
      resource: 'financial_records',
      resourceId: req.params.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, null, 'Record soft-deleted successfully.');
  } catch (err) {
    next(err);
  }
}

function restoreRecord(req, res, next) {
  try {
    const record = recordService.restoreRecord(req.params.id);
    createAuditLog({
      userId: req.user.id,
      action: 'RESTORE_RECORD',
      resource: 'financial_records',
      resourceId: req.params.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, record, 'Record restored successfully.');
  } catch (err) {
    next(err);
  }
}

module.exports = { getRecords, getRecordById, createRecord, updateRecord, deleteRecord, restoreRecord };
