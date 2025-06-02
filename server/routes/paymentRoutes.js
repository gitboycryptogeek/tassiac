// server/routes/paymentRoutes.js
const express = require('express');
const { body, query, param } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const paymentController = require('../controllers/paymentController.js');
const { authenticateJWT, isAdmin, isOwnResource } = require('../middlewares/auth.js');
// The multi-admin approval middleware might be used for sensitive operations like delete,
// but for now, we'll keep it simple as per the current controller structure.
// const { createAdminAction, verifyAdminApprovals } = require('../middlewares/multiAdmin');

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
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`); // Replace spaces in filename
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
// Middleware for expense receipt upload is conditional within the controller logic (or use separate routes)
// For simplicity, we'll handle the file in the controller for now if `isExpense` is true.
// A more robust way would be a dedicated `/expenses` route with `expenseUpload.single('receiptImage')` middleware.
// Let's assume for now that addManualPayment will check `isExpense` and expect `req.file` if true,
// so we apply the multer middleware here.
router.post(
  '/manual',
  authenticateJWT,
  isAdmin,
  expenseUpload.single('expenseReceiptImage'), // Middleware for file upload
  [
    body('userId').isInt().withMessage('Valid User ID is required.'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),
    body('paymentType').isString().notEmpty().withMessage('Payment type is required.')
  .custom(value => {
    const validTypes = ['TITHE', 'OFFERING', 'DONATION', 'EXPENSE', 'SPECIAL_OFFERING_CONTRIBUTION'];
    
    // Accept SPECIAL_OFFERING_ID format from frontend
    if (value.startsWith('SPECIAL_OFFERING_') || validTypes.includes(value)) {
      return true;
    }
    
    throw new Error(`Invalid payment type received: ${value}`);
  }),
    body('description').optional().isString().trim(),
    body('paymentDate').optional().isISO8601().toDate().withMessage('Valid payment date is required if provided.'),
    body('paymentMethod').optional().isIn(['MANUAL', 'CASH', 'BANK_TRANSFER', 'CHEQUE']).default('MANUAL'),
    
    // Conditional validation for expenses
    body('isExpense').optional().isBoolean().toBoolean(),
    body('department').if(body('isExpense').equals(true)).notEmpty().withMessage('Department is required for expenses.'),
    // `expenseReceiptUrl` will be derived from `req.file` if an image is uploaded.

    // Conditional validation for tithes
    body('titheDistributionSDA').if(body('paymentType').equals('TITHE')).isObject().withMessage('Tithe distribution data is required for tithe payments.')
      .custom((value, { req }) => {
        if (req.body.paymentType === 'TITHE') {
          const requiredKeys = ["campMeetingExpenses", "welfare", "thanksgiving", "stationFund", "mediaMinistry"];
          for (const key of requiredKeys) {
            if (typeof value[key] !== 'boolean') {
              throw new Error(`Invalid tithe category: ${key}. Must be a boolean value.`);
            }
          }
        }
        return true;
      }),

    // Conditional validation for special offering contributions
    body('specialOfferingId').if(body('paymentType').equals('SPECIAL_OFFERING_CONTRIBUTION')).isInt().withMessage('Special Offering ID is required for this payment type.'),
    body('reference').optional().isString().trim(),
  ],
  paymentController.addManualPayment
);

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
  // If you implement multi-admin approval later, it would go here:
  // createAdminAction,
  // verifyAdminApprovals,
  paymentController.deletePayment
);


// --- User Routes ---

// GET user's own payments (or specific user's payments if admin)
// The isOwnResource middleware should be adapted or the controller should handle this logic.
// For now, the controller handles the logic that admin can see any, user only their own.
router.get(
  '/user/:userId?', // :userId is optional; if not provided, controller uses req.user.id
  authenticateJWT,
  // isOwnResource, // Controller now has logic to enforce this or allow admin override
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

// POST initiate an M-Pesa payment (user action)
router.post(
  '/initiate-mpesa', // Renamed for clarity from just '/initiate'
  authenticateJWT,
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),
    body('paymentType').isString().notEmpty().withMessage('Payment type is required.')
     .custom(value => {
        const validTypes = ['TITHE', 'OFFERING', 'DONATION', 'SPECIAL_OFFERING_CONTRIBUTION']; // User-initiated types
        if (!validTypes.includes(value)) {
          throw new Error(`Invalid payment type. Must be one of: ${validTypes.join(', ')}`);
        }
        return true;
      }),
    body('description').optional().isString().trim(),
    body('titheDistributionSDA').if(body('paymentType').equals('TITHE')).optional().isObject(), // Validated more deeply in controller if present
    body('specialOfferingId').if(body('paymentType').equals('SPECIAL_OFFERING_CONTRIBUTION')).optional().isInt(),
    body('phoneNumber').optional().isMobilePhone('any', { strictMode: false }).withMessage('Valid phone number is required if overriding.')
  ],
  paymentController.initiatePayment
);

// --- Public Routes (M-Pesa Callback) ---

// POST M-Pesa callback
router.post(
  '/mpesa/callback',
  paymentController.mpesaCallback // No JWT auth here as it's M-Pesa calling
);

module.exports = router;