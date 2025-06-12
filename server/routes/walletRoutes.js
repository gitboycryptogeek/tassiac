const express = require('express');
const { body, param, query } = require('express-validator');
const walletController = require('../controllers/walletController.js');
const { authenticateJWT, isAdmin } = require('../middlewares/auth.js');

const router = express.Router();

// Apply admin authentication to all wallet routes
router.use(authenticateJWT);
router.use(isAdmin);

// POST initialize wallet system (creates default wallets)
router.post(
  '/initialize',
  walletController.initializeWallets
);

// POST recalculate wallet balances from all payments (data repair function)
router.post(
  '/recalculate',
  walletController.recalculateWalletBalances
);

// POST validate tithe distribution
router.post(
  '/validate-tithe',
  [
    body('distribution').isObject().withMessage('Distribution must be an object.'),
    body('totalAmount').isFloat({ gt: 0 }).withMessage('Total amount must be a positive number.'),
  ],
  walletController.validateTitheDistribution
);

// GET all wallets with balances
router.get(
  '/',
  walletController.getAllWallets
);

// POST update wallet balances from completed payments (manual trigger)
router.post(
  '/update-balances',
  [
    body('paymentIds').isArray({ min: 1 }).withMessage('Payment IDs array is required and must not be empty.'),
    body('paymentIds.*').isInt().withMessage('Each payment ID must be an integer.'),
  ],
  walletController.updateWalletBalances
);

// POST create withdrawal request
router.post(
  '/withdraw',
  [
    body('walletId').isInt().withMessage('Valid wallet ID is required.'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),
    body('purpose').isString().notEmpty().withMessage('Purpose is required.')
      .isLength({ min: 5, max: 100 }).withMessage('Purpose must be between 5 and 100 characters.'),
    body('description').optional().isString().trim(),
    body('withdrawalMethod').isIn(['BANK_TRANSFER', 'MPESA', 'CASH'])
      .withMessage('Invalid withdrawal method. Must be BANK_TRANSFER, MPESA, or CASH.'),
    body('destinationAccount').optional().isString().trim()
      .custom((value, { req }) => {
        if (req.body.withdrawalMethod === 'BANK_TRANSFER' && !value) {
          throw new Error('Destination account is required for bank transfers.');
        }
        return true;
      }),
    body('destinationPhone').optional().isMobilePhone('any', { strictMode: false })
      .custom((value, { req }) => {
        if (req.body.withdrawalMethod === 'MPESA' && !value) {
          throw new Error('Destination phone number is required for MPESA withdrawals.');
        }
        return true;
      }),
  ],
  walletController.createWithdrawalRequest
);

// GET withdrawal requests with pagination and filtering
router.get(
  '/withdrawals',
  [
    query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'ALL'])
      .withMessage('Invalid status filter.'),
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(20),
  ],
  walletController.getWithdrawalRequests
);

// POST approve withdrawal request
router.post(
  '/withdrawals/:withdrawalId/approve',
  [
    param('withdrawalId').isInt().withMessage('Valid withdrawal ID is required.'),
    body('password').isString().notEmpty().withMessage('Approval password is required.'),
    body('approvalMethod').optional().isIn(['PASSWORD', 'EMAIL', 'GOOGLE_AUTH']).default('PASSWORD'),
    body('comment').optional().isString().trim(),
  ],
  walletController.approveWithdrawalRequest
);

module.exports = router; 