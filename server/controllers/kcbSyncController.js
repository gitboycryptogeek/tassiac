// server/controllers/kcbSyncController.js
const { PrismaClient, Prisma } = require('@prisma/client');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const { 
  getKcbAccountBalance, 
  getKcbTransactionHistory, 
  syncKcbTransactions,
  tryLinkTransaction 
} = require('../utils/kcbPaymentUtils.js');

const prisma = new PrismaClient();

// Setup debug log file
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOG_DIR, 'kcb-sync-controller-debug.log');

function debugLog(message, data = null) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] KCB_SYNC_CTRL: ${message}`;
  if (data !== null) {
    try {
      const dataStr = JSON.stringify(data);
      logMessage += ` | Data: ${dataStr}`;
    } catch (err) {
      logMessage += ` | Data: [Failed to stringify: ${err.message}]`;
    }
  }
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
  return logMessage;
}

const sendResponse = (res, statusCode, success, data, message, errorDetails = null) => {
  const responsePayload = { success, message };
  if (data !== null && data !== undefined) {
    responsePayload.data = data;
  }
  if (errorDetails) {
    responsePayload.error = errorDetails;
  }
  return res.status(statusCode).json(responsePayload);
};

const isViewOnlyAdmin = (user) => {
  if (!user || !user.isAdmin) return false;
  const viewOnlyUsernames = ['admin3', 'admin4', 'admin5'];
  return viewOnlyUsernames.includes(user.username);
};

async function logAdminActivity(actionType, targetId, initiatedBy, actionData = {}) {
  try {
    await prisma.adminAction.create({
      data: {
        actionType,
        targetId: String(targetId),
        initiatedById: initiatedBy,
        actionData,
        status: 'COMPLETED',
      },
    });
    debugLog(`Admin activity logged: ${actionType} for target ${targetId} by user ${initiatedBy}`);
  } catch (error) {
    debugLog(`Error logging admin activity for ${actionType} on ${targetId}:`, error.message);
  }
}

// Get KCB account balance
exports.getAccountBalance = async (req, res) => {
  debugLog('Get KCB Account Balance attempt started');
  try {
    const balanceData = await getKcbAccountBalance();
    
    debugLog('KCB account balance retrieved successfully', {
      availableBalance: balanceData.availableBalance,
      actualBalance: balanceData.actualBalance
    });

    return sendResponse(res, 200, true, {
      balance: balanceData,
      lastChecked: new Date().toISOString(),
    }, 'KCB account balance retrieved successfully.');

  } catch (error) {
    debugLog('Error getting KCB account balance:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Failed to retrieve KCB account balance.', {
      code: 'KCB_BALANCE_ERROR',
      details: error.message,
    });
  }
};

// Get KCB transaction history
exports.getTransactionHistory = async (req, res) => {
  debugLog('Get KCB Transaction History attempt started');
  try {
    const { startDate, endDate, pageSize = 50, pageNumber = 1 } = req.query;
    
    const transactionData = await getKcbTransactionHistory(
      startDate, 
      endDate, 
      parseInt(pageSize), 
      parseInt(pageNumber)
    );
    
    debugLog('KCB transaction history retrieved successfully', {
      transactionCount: transactionData.transactions.length,
      totalCount: transactionData.totalCount
    });

    return sendResponse(res, 200, true, {
      transactions: transactionData.transactions,
      pagination: {
        totalCount: transactionData.totalCount,
        pageSize: transactionData.pageSize,
        pageNumber: transactionData.pageNumber,
        hasMore: transactionData.hasMore,
      },
      dateRange: {
        startDate: startDate || 'Last 30 days',
        endDate: endDate || 'Today',
      },
    }, 'KCB transaction history retrieved successfully.');

  } catch (error) {
    debugLog('Error getting KCB transaction history:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Failed to retrieve KCB transaction history.', {
      code: 'KCB_HISTORY_ERROR',
      details: error.message,
    });
  }
};

// Sync KCB transactions with database
exports.syncTransactions = async (req, res) => {
  debugLog('Sync KCB Transactions attempt started');
  try {
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot sync transactions.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const { startDate, endDate, forceSync = false } = req.body;
    
    // Default to last 7 days if no dates provided
    const defaultStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const defaultEndDate = new Date().toISOString().split('T')[0];
    
    const syncStartDate = startDate || defaultStartDate;
    const syncEndDate = endDate || defaultEndDate;

    debugLog('Starting KCB transaction sync', { syncStartDate, syncEndDate, forceSync });

    const syncResults = await syncKcbTransactions(syncStartDate, syncEndDate);
    
    await logAdminActivity('SYNC_KCB_TRANSACTIONS', 'SYSTEM', req.user.id, {
      dateRange: { startDate: syncStartDate, endDate: syncEndDate },
      results: syncResults
    });

    debugLog('KCB transaction sync completed', syncResults);
    return sendResponse(res, 200, true, {
      syncResults,
      dateRange: {
        startDate: syncStartDate,
        endDate: syncEndDate,
      },
    }, `KCB transaction sync completed. ${syncResults.new} new transactions, ${syncResults.linkedToPayments} automatically linked.`);

  } catch (error) {
    debugLog('Error syncing KCB transactions:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Failed to sync KCB transactions.', {
      code: 'KCB_SYNC_ERROR',
      details: error.message,
    });
  }
};

// Get unlinked KCB transactions
exports.getUnlinkedTransactions = async (req, res) => {
  debugLog('Get Unlinked KCB Transactions attempt started');
  try {
    const { page = 1, limit = 20, transactionType } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const whereConditions = { syncStatus: 'UNLINKED' };
    if (transactionType && transactionType !== 'ALL') {
      whereConditions.transactionType = transactionType;
    }

    const unlinkedTransactions = await prisma.kcbTransactionSync.findMany({
      where: whereConditions,
      orderBy: { transactionDate: 'desc' },
      skip,
      take,
    });

    const totalUnlinked = await prisma.kcbTransactionSync.count({ where: whereConditions });

    debugLog(`Retrieved ${unlinkedTransactions.length} unlinked KCB transactions`);
    return sendResponse(res, 200, true, {
      transactions: unlinkedTransactions.map(tx => ({
        ...tx,
        amount: parseFloat(tx.amount.toString()),
      })),
      totalPages: Math.ceil(totalUnlinked / take),
      currentPage: parseInt(page),
      totalUnlinked,
    }, 'Unlinked KCB transactions retrieved successfully.');

  } catch (error) {
    debugLog('Error getting unlinked KCB transactions:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Failed to retrieve unlinked KCB transactions.', {
      code: 'UNLINKED_TRANSACTIONS_ERROR',
      details: error.message,
    });
  }
};

// Manually link KCB transaction to payment
exports.linkTransaction = async (req, res) => {
  debugLog('Manual Link KCB Transaction attempt started');
  try {
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot link transactions.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debugLog('Validation errors on link transaction:', errors.array());
      return sendResponse(res, 400, false, null, 'Validation failed', {
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({ field: err.path, message: err.msg })),
      });
    }

    const { kcbSyncId, paymentId } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // Get KCB sync record
      const kcbSync = await tx.kcbTransactionSync.findUnique({
        where: { id: parseInt(kcbSyncId) }
      });

      if (!kcbSync) {
        throw new Error('KCB transaction sync record not found');
      }

      if (kcbSync.syncStatus === 'LINKED') {
        throw new Error('KCB transaction is already linked');
      }

      // Get payment record
      const payment = await tx.payment.findUnique({
        where: { id: parseInt(paymentId) }
      });

      if (!payment) {
        throw new Error('Payment record not found');
      }

      // Validate amounts match (within reasonable tolerance)
      const amountDifference = Math.abs(parseFloat(kcbSync.amount.toString()) - parseFloat(payment.amount.toString()));
      if (amountDifference > 1.0) { // Allow 1 KES tolerance
        throw new Error(`Amount mismatch: KCB transaction (${kcbSync.amount}) vs Payment (${payment.amount})`);
      }

      // Update KCB sync record
      const updatedKcbSync = await tx.kcbTransactionSync.update({
        where: { id: parseInt(kcbSyncId) },
        data: {
          syncStatus: 'LINKED',
          linkedPaymentId: parseInt(paymentId),
          updatedAt: new Date(),
        },
      });

      // Update payment record
      const updatedPayment = await tx.payment.update({
        where: { id: parseInt(paymentId) },
        data: {
          kcbTransactionId: kcbSync.kcbTransactionId,
          kcbReference: kcbSync.kcbReference,
          updatedAt: new Date(),
        },
      });

      return { kcbSync: updatedKcbSync, payment: updatedPayment };
    });

    await logAdminActivity('MANUAL_LINK_KCB_TRANSACTION', result.kcbSync.id, req.user.id, {
      kcbTransactionId: result.kcbSync.kcbTransactionId,
      paymentId: result.payment.id,
      amount: result.kcbSync.amount
    });

    debugLog('KCB transaction manually linked successfully', {
      kcbSyncId: result.kcbSync.id,
      paymentId: result.payment.id
    });

    return sendResponse(res, 200, true, {
      linkedTransaction: result.kcbSync,
      linkedPayment: result.payment,
    }, 'KCB transaction linked to payment successfully.');

  } catch (error) {
    debugLog('Error linking KCB transaction:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, error.message || 'Failed to link KCB transaction.', {
      code: 'LINK_TRANSACTION_ERROR',
      details: error.message,
    });
  }
};

// Mark KCB transaction as ignored
exports.ignoreTransaction = async (req, res) => {
  debugLog('Ignore KCB Transaction attempt started');
  try {
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot ignore transactions.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const { kcbSyncId } = req.params;
    const { reason } = req.body;

    const kcbSync = await prisma.kcbTransactionSync.findUnique({
      where: { id: parseInt(kcbSyncId) }
    });

    if (!kcbSync) {
      return sendResponse(res, 404, false, null, 'KCB transaction sync record not found.', { code: 'KCB_SYNC_NOT_FOUND' });
    }

    if (kcbSync.syncStatus !== 'UNLINKED') {
      return sendResponse(res, 400, false, null, 'Only unlinked KCB transactions can be ignored.', { code: 'INVALID_SYNC_STATUS' });
    }

    const updatedKcbSync = await prisma.kcbTransactionSync.update({
      where: { id: parseInt(kcbSyncId) },
      data: {
        syncStatus: 'IGNORED',
        rawData: {
          ...kcbSync.rawData,
          ignoredReason: reason || 'Manually ignored by admin',
          ignoredBy: req.user.id,
          ignoredAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      },
    });

    await logAdminActivity('IGNORE_KCB_TRANSACTION', updatedKcbSync.id, req.user.id, {
      kcbTransactionId: updatedKcbSync.kcbTransactionId,
      reason: reason || 'No reason provided'
    });

    debugLog('KCB transaction marked as ignored', {
      kcbSyncId: updatedKcbSync.id,
      kcbTransactionId: updatedKcbSync.kcbTransactionId
    });

    return sendResponse(res, 200, true, { ignoredTransaction: updatedKcbSync }, 'KCB transaction marked as ignored.');

  } catch (error) {
    debugLog('Error ignoring KCB transaction:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Failed to ignore KCB transaction.', {
      code: 'IGNORE_TRANSACTION_ERROR',
      details: error.message,
    });
  }
};

// Get KCB sync statistics
exports.getSyncStatistics = async (req, res) => {
  debugLog('Get KCB Sync Statistics attempt started');
  try {
    const totalSyncRecords = await prisma.kcbTransactionSync.count();
    const linkedRecords = await prisma.kcbTransactionSync.count({ where: { syncStatus: 'LINKED' } });
    const unlinkedRecords = await prisma.kcbTransactionSync.count({ where: { syncStatus: 'UNLINKED' } });
    const ignoredRecords = await prisma.kcbTransactionSync.count({ where: { syncStatus: 'IGNORED' } });

    // Get recent sync activity
    const recentSyncs = await prisma.kcbTransactionSync.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        kcbTransactionId: true,
        amount: true,
        transactionDate: true,
        syncStatus: true,
        createdAt: true,
      },
    });

    // Calculate totals by transaction type
    const creditTotal = await prisma.kcbTransactionSync.aggregate({
      _sum: { amount: true },
      where: { transactionType: 'CREDIT', syncStatus: 'LINKED' },
    });

    const debitTotal = await prisma.kcbTransactionSync.aggregate({
      _sum: { amount: true },
      where: { transactionType: 'DEBIT', syncStatus: 'LINKED' },
    });

    const statistics = {
      totalRecords: totalSyncRecords,
      linked: linkedRecords,
      unlinked: unlinkedRecords,
      ignored: ignoredRecords,
      linkageRate: totalSyncRecords > 0 ? ((linkedRecords / totalSyncRecords) * 100).toFixed(2) : 0,
      totals: {
        linkedCredits: parseFloat((creditTotal._sum.amount || 0).toString()),
        linkedDebits: parseFloat((debitTotal._sum.amount || 0).toString()),
        netLinked: parseFloat((creditTotal._sum.amount || 0).toString()) - parseFloat((debitTotal._sum.amount || 0).toString()),
      },
      recentActivity: recentSyncs.map(sync => ({
        ...sync,
        amount: parseFloat(sync.amount.toString()),
      })),
    };

    debugLog('KCB sync statistics retrieved', {
      totalRecords: statistics.totalRecords,
      linkageRate: statistics.linkageRate
    });

    return sendResponse(res, 200, true, { statistics }, 'KCB sync statistics retrieved successfully.');

  } catch (error) {
    debugLog('Error getting KCB sync statistics:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Failed to retrieve KCB sync statistics.', {
      code: 'SYNC_STATISTICS_ERROR',
      details: error.message,
    });
  }
};

module.exports = exports;