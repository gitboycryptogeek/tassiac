// server/routes/walletRoutes.js - CORRECTED VERSION

const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { authenticateJWT, isAdmin } = require('../middlewares/auth');
const { body, param, query } = require('express-validator');

// Apply admin authentication to all wallet routes
router.use(authenticateJWT);
router.use(isAdmin);

// Validation rules
const withdrawalValidation = [
    body('walletId').isInt().withMessage('Valid wallet ID is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('withdrawalMethod').isIn(['BANK_TRANSFER', 'MPESA']).withMessage('Invalid withdrawal method'),
    body('purpose').trim().isLength({ min: 3, max: 100 }).withMessage('Purpose must be 3-100 characters'),
    body('description').trim().isLength({ min: 10, max: 500 }).withMessage('Description must be 10-500 characters'),
    body('destinationAccount').optional().isString().withMessage('Destination account must be a string'),
    body('destinationPhone').optional().matches(/^(\+254|0)?[17]\d{8}$/).withMessage('Valid Kenyan phone number required')
];

const approveWithdrawalValidation = [
    param('withdrawalId').isInt().withMessage('Valid withdrawal ID required'),
    body('password').notEmpty().withMessage('Approval password required'),
    body('approvalMethod').optional().isIn(['PASSWORD', 'BIOMETRIC']).withMessage('Invalid approval method'),
    body('comment').optional().isString().trim().isLength({ max: 200 }).withMessage('Comment must be 200 characters or less')
];

const titheDistributionValidation = [
    body('distribution').isObject().withMessage('Valid distribution object required'),
    body('totalAmount').isFloat({ min: 0.01 }).withMessage('Valid total amount required')
];

// ====================
// CORE WALLET ROUTES
// ====================

// GET all wallets with summary
router.get('/all', walletController.getAllWallets);

// GET wallet transactions by wallet ID  
router.get('/:walletId/transactions', [
    param('walletId').isInt().withMessage('Valid wallet ID is required'),
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(20),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
    query('transactionType').optional().isIn(['DEPOSIT', 'WITHDRAWAL', 'ALL']).withMessage('Invalid transaction type')
], walletController.getWalletTransactions);

// ====================
// WALLET MANAGEMENT ROUTES
// ====================

// POST initialize wallet system
router.post('/initialize', walletController.initializeWallets);

// POST recalculate all wallet balances
router.post('/recalculate', walletController.recalculateWalletBalances);

// POST update wallet balances for specific payments
router.post('/update-balances', [
    body('paymentIds').isArray({ min: 1 }).withMessage('Payment IDs array is required'),
    body('paymentIds.*').isInt().withMessage('Each payment ID must be an integer')
], walletController.updateWalletBalances);

// ====================
// WITHDRAWAL ROUTES
// ====================

// GET all withdrawal requests with filtering
router.get('/withdrawals', [
    query('status').optional().isIn(['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'ALL']).withMessage('Invalid status filter'),
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(20),
    query('walletType').optional().isString().trim(),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate()
], walletController.getWithdrawalRequests);

// POST create new withdrawal request
router.post('/withdrawals', withdrawalValidation, walletController.createWithdrawalRequest);

// POST approve withdrawal request
router.post('/withdrawals/:withdrawalId/approve', 
    approveWithdrawalValidation, 
    walletController.approveWithdrawalRequest
);

// ====================
// UTILITY ROUTES
// ====================

// POST validate tithe distribution amounts
router.post('/validate-tithe', titheDistributionValidation, walletController.validateTitheDistribution);

// ====================
// ERROR HANDLING
// ====================

// Handle any routes that don't exist
router.all('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Wallet endpoint not found',
        error: {
            code: 'ENDPOINT_NOT_FOUND',
            details: `The wallet endpoint ${req.method} ${req.path} does not exist`
        }
    });
});

module.exports = router;