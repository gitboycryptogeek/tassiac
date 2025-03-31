// server/routes/paymentRoutes.js
const express = require('express');
const { body, query, param } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const { authenticateJWT, isAdmin, isOwnResource } = require('../middlewares/auth');
const { createAdminAction, verifyAdminApprovals } = require('../middlewares/multiAdmin');

const router = express.Router();

// Get all payments (admin only)
router.get('/all', authenticateJWT, isAdmin, paymentController.getAllPayments);

// Get user payments
router.get(
  '/user/:userId?', 
  authenticateJWT, 
  isOwnResource, 
  paymentController.getUserPayments
);

// Get payment statistics (admin only)
router.get('/stats', authenticateJWT, isAdmin, paymentController.getPaymentStats);

// Get promoted payments
router.get('/promoted', paymentController.getPromotedPayments);

// Get special offerings
router.get('/special-offerings', authenticateJWT, paymentController.getSpecialOfferings);

// Initiate a payment
router.post(
  '/initiate',
  authenticateJWT,
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
    body('paymentType').isIn(['TITHE', 'OFFERING', 'DONATION', 'OTHER']).withMessage('Invalid payment type'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('titheDistribution').optional().isObject().withMessage('Tithe distribution must be an object')
  ],
  paymentController.initiatePayment
);

// Add manual payment (admin only)
router.post(
  '/manual',
  authenticateJWT,
  isAdmin,
  [
    body('userId').isInt().withMessage('Valid user ID is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
    // Update this line to include 'SPECIAL' or allow custom special offering types
    body('paymentType').custom(value => {
      const standardTypes = ['TITHE', 'OFFERING', 'DONATION', 'EXPENSE', 'OTHER'];
      return standardTypes.includes(value) || value.startsWith('SPECIAL_') || value === 'SPECIAL';
    }).withMessage('Invalid payment type'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('isExpense').optional().isBoolean().withMessage('isExpense must be a boolean'),
    body('department').optional().isString().withMessage('Department must be a string'),
    body('paymentDate').optional().isISO8601().withMessage('Valid date is required'),
    body('titheDistribution').optional().isObject().withMessage('Tithe distribution must be an object'),
    body('isPromoted').optional().isBoolean().withMessage('isPromoted must be a boolean'),
    // Add validation for special offering fields
    body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
    body('customFields').optional(),
    body('targetGoal').optional().isFloat({ min: 0 }).withMessage('Target goal must be a positive number')
  ],
  paymentController.addManualPayment
);

// Delete payment (requires 3 admin approvals)
router.delete(
  '/:paymentId',
  authenticateJWT,
  isAdmin,
  createAdminAction,
  [
    body('adminApprovals').isArray({ min: 3 }).withMessage('At least 3 admin approvals are required'),
    body('adminApprovals.*.username').isString().withMessage('Admin username is required'),
    body('adminApprovals.*.password').isString().withMessage('Admin password is required')
  ],
  verifyAdminApprovals,
  (req, res) => {
    // This would be the actual delete logic after approvals are verified
    res.json({ message: 'Payment deleted successfully' });
  }
);

// M-Pesa callback route
router.post('/mpesa/callback', paymentController.mpesaCallback);

module.exports = router;