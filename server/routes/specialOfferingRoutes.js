// server/routes/specialOfferingRoutes.js
const express = require('express');
const { body, query } = require('express-validator');
const { authenticateJWT, isAdmin } = require('../middlewares/auth');
const specialOfferingController = require('../controllers/specialOfferingController');

const router = express.Router();

// Get all special offerings (does not require auth)
router.get('/', specialOfferingController.getAllSpecialOfferings);

// Get a specific special offering by type
router.get('/:offeringType', specialOfferingController.getSpecialOfferingByType);

// Get progress for a special offering
router.get('/:offeringType/progress', specialOfferingController.getSpecialOfferingProgress);

// Create a special offering (admin only)
router.post(
  '/',
  authenticateJWT,
  isAdmin,
  [
    body('offeringType').isString().withMessage('Valid offering type is required'),
    body('name').isString().withMessage('Name is required'),
    body('description').isString().withMessage('Description is required'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
    body('targetGoal').optional().isFloat({ min: 0 }).withMessage('Target goal must be a positive number'),
    body('customFields').optional()
  ],
  specialOfferingController.createSpecialOffering
);

// Update a special offering (admin only)
router.put(
  '/:offeringType',
  authenticateJWT,
  isAdmin,
  [
    body('name').optional().isString().withMessage('Name must be a string'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
    body('targetGoal').optional().isFloat({ min: 0 }).withMessage('Target goal must be a positive number'),
    body('customFields').optional(),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
  ],
  specialOfferingController.updateSpecialOffering
);

// Delete a special offering (admin only)
router.delete(
  '/:offeringType',
  authenticateJWT,
  isAdmin,
  specialOfferingController.deleteSpecialOffering
);

// Make a payment to a special offering (authenticated user)
router.post(
  '/:offeringType/payment',
  authenticateJWT,
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
    body('description').optional().isString().withMessage('Description must be a string')
  ],
  specialOfferingController.makePaymentToOffering
);

// Cleanup duplicate templates (admin only)
router.post(
  '/admin/cleanup',
  authenticateJWT,
  isAdmin,
  specialOfferingController.cleanupDuplicateTemplates
);

module.exports = router;