// server/routes/kcbSyncRoutes.js
const express = require('express');
const { body, param, query } = require('express-validator');
const kcbSyncController = require('../controllers/kcbSyncController.js');
const { authenticateJWT, isAdmin } = require('../middlewares/auth.js');

const router = express.Router();

// Apply admin authentication to all KCB sync routes
router.use(authenticateJWT);
router.use(isAdmin);

// GET KCB account balance
router.get(
  '/balance',
  kcbSyncController.getAccountBalance
);

// GET KCB transaction history
router.get(
  '/transactions',
  [
    query('startDate').optional().isISO8601().toDate().withMessage('Valid start date is required if provided.'),
    query('endDate').optional().isISO8601().toDate().withMessage('Valid end date is required if provided.')
      .custom((value, { req }) => {
        if (value && req.query.startDate && new Date(value) < new Date(req.query.startDate)) {
          throw new Error('End date must be after start date.');
        }
        return true;
      }),
    query('pageSize').optional().isInt({ min: 1, max: 200 }).toInt().default(50),
    query('pageNumber').optional().isInt({ min: 1 }).toInt().default(1),
  ],
  kcbSyncController.getTransactionHistory
);

// POST sync KCB transactions with database
router.post(
  '/sync',
  [
    body('startDate').optional().isISO8601().toDate().withMessage('Valid start date is required if provided.'),
    body('endDate').optional().isISO8601().toDate().withMessage('Valid end date is required if provided.')
      .custom((value, { req }) => {
        if (value && req.body.startDate && new Date(value) < new Date(req.body.startDate)) {
          throw new Error('End date must be after start date.');
        }
        return true;
      }),
    body('forceSync').optional().isBoolean().toBoolean(),
  ],
  kcbSyncController.syncTransactions
);

// GET unlinked KCB transactions
router.get(
  '/unlinked',
  [
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(20),
    query('transactionType').optional().isIn(['CREDIT', 'DEBIT', 'ALL']).withMessage('Invalid transaction type filter.'),
  ],
  kcbSyncController.getUnlinkedTransactions
);

// POST manually link KCB transaction to payment
router.post(
  '/link',
  [
    body('kcbSyncId').isInt().withMessage('Valid KCB sync ID is required.'),
    body('paymentId').isInt().withMessage('Valid payment ID is required.'),
  ],
  kcbSyncController.linkTransaction
);

// PUT mark KCB transaction as ignored
router.put(
  '/ignore/:kcbSyncId',
  [
    param('kcbSyncId').isInt().withMessage('Valid KCB sync ID is required.'),
    body('reason').optional().isString().trim().isLength({ max: 200 })
      .withMessage('Ignore reason must be 200 characters or less.'),
  ],
  kcbSyncController.ignoreTransaction
);

// GET KCB sync statistics
router.get(
  '/statistics',
  kcbSyncController.getSyncStatistics
);

module.exports = router;