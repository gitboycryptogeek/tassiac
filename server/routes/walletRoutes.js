// server/routes/walletRoutes.js - RESTRUCTURED ROUTE DEFINITIONS

const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { authenticateJWT, isAdmin } = require('../middlewares/auth');
const { body, param } = require('express-validator');

// Validation rules
const withdrawalValidation = [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('withdrawalMethod').isIn(['BANK_TRANSFER', 'MPESA']).withMessage('Invalid withdrawal method'),
    body('purpose').trim().isLength({ min: 3, max: 100 }).withMessage('Purpose required'),
    body('description').trim().isLength({ min: 10, max: 500 }).withMessage('Description required'),
    body('bankDetails').if(body('withdrawalMethod').equals('BANK_TRANSFER')).isObject(),
    body('phoneNumber').if(body('withdrawalMethod').equals('MPESA'))
        .matches(/^(\+254|0)?[17]\d{8}$/).withMessage('Valid M-Pesa number required')
];

const titheDistributionValidation = [
    body('distribution').isObject().withMessage('Valid distribution required'),
    body('distribution.*.amount').isFloat({ min: 0 }).withMessage('Valid amounts required'),
    body('distribution.*.percentage').isFloat({ min: 0, max: 100 }).withMessage('Valid percentages required')
];

// Core wallet routes - Using only available controller methods
router.get('/all', authenticateJWT, isAdmin, walletController.getAllWallets);
// **FIX**: The route is now implemented and uncommented
router.get('/:walletId/transactions', authenticateJWT, isAdmin, [
    param('walletId').isInt().withMessage('A valid wallet ID is required.')
], walletController.getWalletTransactions);


// Wallet management routes
router.post('/initialize', authenticateJWT, isAdmin, walletController.initializeWallets);
router.post('/recalculate', authenticateJWT, isAdmin, walletController.recalculateWalletBalances);
router.post('/update-balances', authenticateJWT, isAdmin, walletController.updateWalletBalances);

// Withdrawal routes
router.post('/withdrawals', authenticateJWT, isAdmin, withdrawalValidation, 
    walletController.createWithdrawalRequest);
router.get('/withdrawals', authenticateJWT, isAdmin, 
    walletController.getWithdrawalRequests);
router.post('/withdrawals/:withdrawalId/approve', authenticateJWT, isAdmin, [
    param('withdrawalId').isInt().withMessage('Valid withdrawal ID required'),
    body('password').notEmpty().withMessage('Approver password required')
], walletController.approveWithdrawalRequest);

// Receipt upload route
router.post('/withdrawals/:withdrawalId/receipt', authenticateJWT, isAdmin,
    walletController.uploadWithdrawalReceipt);

// Tithe validation route
router.post('/validate-tithe', authenticateJWT, isAdmin, 
    titheDistributionValidation, walletController.validateTitheDistribution);

module.exports = router;