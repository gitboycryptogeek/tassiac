// server/routes/batchPaymentRoutes.js
const express = require('express');
const { body, param, query } = require('express-validator');
const batchPaymentController = require('../controllers/batchPaymentController.js');
const { authenticateJWT, isAdmin } = require('../middlewares/auth.js');

const router = express.Router();

// Apply admin authentication to all batch payment routes
router.use(authenticateJWT);
router.use(isAdmin);

// POST create a new batch payment
router.post(
  '/',
  [
    body('payments').isArray({ min: 1 }).withMessage('Payments array is required and must not be empty.'),
    body('payments.*.userId').isInt().withMessage('Valid user ID is required for each payment.'),
    body('payments.*.amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number for each payment.'),
    body('payments.*.paymentType').isString().notEmpty().withMessage('Payment type is required for each payment.')
      .custom(value => {
        const validTypes = ['TITHE', 'OFFERING', 'DONATION', 'EXPENSE'];
        // Also accept numeric IDs for special offerings or SPECIAL_OFFERING_CONTRIBUTION
        if (!validTypes.includes(value) && !/^\d+$/.test(value) && value !== 'SPECIAL_OFFERING_CONTRIBUTION') {
          throw new Error(`Invalid payment type: ${value}. Must be TITHE, OFFERING, DONATION, EXPENSE, or a special offering ID.`);
        }
        return true;
      }),
    body('payments.*.description').optional().isString().trim(),
    body('payments.*.paymentDate').optional().isISO8601().toDate(),
    body('payments.*.isExpense').optional().isBoolean(),
    body('payments.*.department').optional().isString().trim()
      .custom((value, { req, path }) => {
        const paymentIndex = path.split('[')[1].split(']')[0];
        const payment = req.body.payments[paymentIndex];
        if (payment.isExpense && !value) {
          throw new Error('Department is required for expense payments.');
        }
        return true;
      }),
    body('payments.*.specialOfferingId').optional().isInt(),
    body('payments.*.titheDistributionSDA').optional().isObject()
      .custom((value, { req, path }) => {
        if (value) {
          const requiredKeys = ['campMeetingExpenses', 'welfare', 'thanksgiving', 'stationFund', 'mediaMinistry'];
          for (const key of requiredKeys) {
            if (value.hasOwnProperty(key) && typeof value[key] !== 'boolean') {
              throw new Error(`Invalid tithe category: ${key}. Must be a boolean value.`);
            }
          }
        }
        return true;
      }),
    body('description').optional().isString().trim().isLength({ max: 200 })
      .withMessage('Batch description must be 200 characters or less.'),
  ],
  batchPaymentController.createBatchPayment
);

// GET all batch payments with pagination and filtering
router.get(
  '/',
  [
    query('status').optional().isIn(['PENDING', 'DEPOSITED', 'COMPLETED', 'CANCELLED', 'ALL'])
      .withMessage('Invalid status filter.'),
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(20),
  ],
  batchPaymentController.getAllBatchPayments
);

// GET specific batch payment details
router.get(
  '/:batchId',
  [
    param('batchId').isInt().withMessage('Valid batch ID is required.'),
  ],
  batchPaymentController.getBatchPaymentDetails
);

// POST process batch deposit via KCB
router.post(
  '/:batchId/deposit',
  [
    param('batchId').isInt().withMessage('Valid batch ID is required.'),
    body('phoneNumber').isMobilePhone('any', { strictMode: false })
      .withMessage('Valid phone number is required for KCB deposit.'),
    body('depositDescription').optional().isString().trim().isLength({ max: 100 })
      .withMessage('Deposit description must be 100 characters or less.'),
  ],
  batchPaymentController.processBatchDeposit
);

// POST complete batch payment processing (after successful KCB callback)
router.post(
  '/:batchId/complete',
  [
    param('batchId').isInt().withMessage('Valid batch ID is required.'),
    body('kcbTransactionId').optional().isString().trim(),
    body('kcbReceiptNumber').optional().isString().trim(),
  ],
  batchPaymentController.completeBatchPayment
);

// DELETE cancel batch payment (only if not yet deposited)
router.delete(
  '/:batchId',
  [
    param('batchId').isInt().withMessage('Valid batch ID is required.'),
    body('reason').optional().isString().trim().isLength({ max: 200 })
      .withMessage('Cancellation reason must be 200 characters or less.'),
  ],
  batchPaymentController.cancelBatchPayment
);

module.exports = router;