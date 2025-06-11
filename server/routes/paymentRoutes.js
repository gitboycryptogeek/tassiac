// server/routes/paymentRoutes.js
const express = require('express');
const { body, query, param } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const paymentController = require('../controllers/paymentController.js');
const { authenticateJWT, isAdmin, isOwnResource } = require('../middlewares/auth.js');

const router = express.Router();

// Multer setup for expense receipt uploads
const expenseUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'expense_receipts');
if (!fs.existsSync(expenseUploadDir)) {
  fs.mkdirSync(expenseUploadDir, { recursive: true });
}

const expenseStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, expenseUploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
  }
});

const expenseUpload = multer({
  storage: expenseStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('File upload only supports a subset of types (JPEG, PNG, PDF)'));
  }
});

// --- Public Routes (Payment Callbacks) ---

// POST M-Pesa callback
router.post(
  '/mpesa/callback',
  paymentController.mpesaCallback
);

// POST KCB callback
router.post(
  '/kcb/callback',
  paymentController.kcbCallback
);

// Legacy M-Pesa callback route for backward compatibility
router.post(
  '/mpesa-callback',
  paymentController.mpesaCallback
);

// Legacy KCB callback route for backward compatibility
router.post(
  '/kcb-callback',
  paymentController.kcbCallback
);

// --- Admin Routes ---

// GET all payments (admin only) - with pagination and filtering
router.get(
    '/all',
    authenticateJWT,
    isAdmin,
    [
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
        query('startDate').optional().isISO8601().toDate(),
        query('endDate').optional().isISO8601().toDate(),
        query('paymentType').optional().isString().trim(),
        query('userId').optional().isInt().toInt(),
        query('department').optional().isString().trim(),
        query('status').optional().isString().trim(),
        query('search').optional().isString().trim(),
        query('specialOfferingId').optional().isInt().toInt(),
        query('titheCategory').optional().isString().trim(),
    ],
    paymentController.getAllPayments
);

// GET payment statistics (admin only)
router.get(
    '/stats',
    authenticateJWT,
    isAdmin,
    paymentController.getPaymentStats
);

// POST add manual payment or expense (admin only)
router.post(
  '/manual',
  authenticateJWT,
  isAdmin,
  expenseUpload.single('expenseReceiptImage'),
  [
    body('userId').isInt().withMessage('Valid User ID is required.'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),
    body('paymentType').isString().notEmpty().withMessage('Payment type is required.')
      .custom(value => {
        const validTypes = ['TITHE', 'OFFERING', 'DONATION', 'EXPENSE', 'SPECIAL_OFFERING_CONTRIBUTION'];
        
        // Accept SPECIAL_OFFERING_ID format from frontend or numeric IDs
        if (value.startsWith('SPECIAL_OFFERING_') || validTypes.includes(value) || /^\d+$/.test(value)) {
          return true;
        }
        
        throw new Error(`Invalid payment type received: ${value}. Expected format: SPECIAL_OFFERING_[ID], numeric ID, or standard types.`);
      }),
    body('description').optional().isString().trim(),
    body('paymentDate').optional().isISO8601().toDate().withMessage('Valid payment date is required if provided.'),
    body('paymentMethod').optional().isIn(['MANUAL', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'MPESA', 'KCB']).withMessage('Invalid payment method.'),
    
    // Conditional validation for expenses
    body('isExpense').optional().isBoolean().toBoolean(),
    body('department').if(body('isExpense').equals(true)).notEmpty().withMessage('Department is required for expenses.'),

    // Conditional validation for tithes
    body('titheDistributionSDA').if(body('paymentType').equals('TITHE')).optional().isObject().withMessage('Tithe distribution data must be an object.')
      .custom((value, { req }) => {
        if (req.body.paymentType === 'TITHE' && value) {
          const requiredKeys = ["campMeetingExpenses", "welfare", "thanksgiving", "stationFund", "mediaMinistry"];
          for (const key of requiredKeys) {
            if (value.hasOwnProperty(key) && typeof value[key] !== 'boolean') {
              throw new Error(`Invalid tithe category: ${key}. Must be a boolean value.`);
            }
          }
        }
        return true;
      }),

    // Conditional validation for special offering contributions
    body('specialOfferingId').optional().isInt().withMessage('Special Offering ID must be an integer.'),
    body('reference').optional().isString().trim(),
  ],
  paymentController.addManualPayment
);
router.route('/:batchId/add-items').post(authenticateJWT, isAdmin, paymentController.addItemsToBatch);

// PUT update payment status (admin only)
router.put(
  '/:paymentId/status',
  authenticateJWT,
  isAdmin,
  [
    param('paymentId').isInt().withMessage('Valid Payment ID is required.'),
    body('status').isString().notEmpty().isIn(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'])
      .withMessage('Invalid status value.'),
  ],
  paymentController.updatePaymentStatus
);

// DELETE payment (admin only)
router.delete(
  '/:paymentId',
  authenticateJWT,
  isAdmin,
  [
    param('paymentId').isInt().withMessage('Valid Payment ID is required.'),
  ],
  paymentController.deletePayment
);

// --- User Routes ---

// GET user's own payments (or specific user's payments if admin)
router.get(
  '/user/:userId?',
  authenticateJWT,
  [
    param('userId').optional().isInt().withMessage('User ID must be an integer.'),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
    query('paymentType').optional().isString().trim(),
    query('status').optional().isString().trim(),
    query('search').optional().isString().trim(),
  ],
  paymentController.getUserPayments
);

// GET payment status (user can check their own, admin can check any)
router.get(
  '/status/:paymentId',
  authenticateJWT,
  [
    param('paymentId').isInt().withMessage('Valid Payment ID is required.'),
  ],
  paymentController.getPaymentStatus
);

// POST initiate a payment (M-Pesa or KCB) - unified endpoint
router.post(
  '/initiate',
  authenticateJWT,
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),
    body('paymentType').isString().notEmpty().withMessage('Payment type is required.')
     .custom(value => {
        const validTypes = ['TITHE', 'OFFERING', 'DONATION', 'SPECIAL'];
        if (!validTypes.includes(value)) {
          throw new Error(`Invalid payment type. Must be one of: ${validTypes.join(', ')}`);
        }
        return true;
      }),
    body('description').optional().isString().trim(),
    body('paymentMethod').optional().isIn(['MPESA', 'KCB']).withMessage('Invalid payment method. Must be MPESA or KCB.'),
    body('phoneNumber').isMobilePhone('any', { strictMode: false }).withMessage('Valid phone number is required.'),
    
    // Conditional validation for tithes
    body('titheDistributionSDA').if(body('paymentType').equals('TITHE')).optional().isObject()
      .custom((value, { req }) => {
        if (req.body.paymentType === 'TITHE' && value) {
          const requiredKeys = ["campMeetingExpenses", "welfare", "thanksgiving", "stationFund", "mediaMinistry"];
          for (const key of requiredKeys) {
            if (value.hasOwnProperty(key) && typeof value[key] !== 'boolean') {
              throw new Error(`Invalid tithe category: ${key}. Must be a boolean value.`);
            }
          }
        }
        return true;
      }),
    
    // Conditional validation for special offerings
    body('specialOfferingId').if(body('paymentType').equals('SPECIAL')).isInt().withMessage('Special Offering ID is required for special offerings.'),
  ],
  paymentController.initiatePayment
);

// POST initiate M-Pesa payment (legacy endpoint for backward compatibility)
router.post(
  '/initiate-mpesa',
  authenticateJWT,
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),
    body('paymentType').isString().notEmpty().withMessage('Payment type is required.')
     .custom(value => {
        const validTypes = ['TITHE', 'OFFERING', 'DONATION', 'SPECIAL'];
        if (!validTypes.includes(value)) {
          throw new Error(`Invalid payment type. Must be one of: ${validTypes.join(', ')}`);
        }
        return true;
      }),
    body('description').optional().isString().trim(),
    body('phoneNumber').isMobilePhone('any', { strictMode: false }).withMessage('Valid phone number is required.'),
    body('titheDistributionSDA').if(body('paymentType').equals('TITHE')).optional().isObject(),
    body('specialOfferingId').if(body('paymentType').equals('SPECIAL')).optional().isInt(),
  ],
  paymentController.initiateMpesaPayment
);

// POST initiate KCB payment
router.post(
  '/initiate-kcb',
  authenticateJWT,
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),
    body('paymentType').isString().notEmpty().withMessage('Payment type is required.')
     .custom(value => {
        const validTypes = ['TITHE', 'OFFERING', 'DONATION', 'SPECIAL'];
        if (!validTypes.includes(value)) {
          throw new Error(`Invalid payment type. Must be one of: ${validTypes.join(', ')}`);
        }
        return true;
      }),
    body('description').optional().isString().trim(),
    body('phoneNumber').isMobilePhone('any', { strictMode: false }).withMessage('Valid phone number is required.'),
    body('titheDistributionSDA').if(body('paymentType').equals('TITHE')).optional().isObject(),
    body('specialOfferingId').if(body('paymentType').equals('SPECIAL')).optional().isInt(),
  ],
  (req, res, next) => {
    // Set payment method to KCB for this endpoint
    req.body.paymentMethod = 'KCB';
    next();
  },
  paymentController.initiatePayment
);

module.exports = router;