// server/routes/specialOfferingRoutes.js
const express = require('express');
const { body, param, query } = require('express-validator');
const { authenticateJWT, isAdmin } = require('../middlewares/auth.js');
const specialOfferingController = require('../controllers/specialOfferingController.js');

const router = express.Router();

// Create a special offering (Admin only, excluding view-only admins)
router.post(
  '/',
  authenticateJWT,
  isAdmin, // General admin check
  [
    body('offeringCode').isString().notEmpty().withMessage('Offering code is required.').trim()
      .isLength({ min: 3, max: 50 }).withMessage('Offering code must be between 3 and 50 characters.')
      .matches(/^[A-Z0-9_]+$/).withMessage('Offering code can only contain uppercase letters, numbers, and underscores.'),
    body('name').isString().notEmpty().withMessage('Name is required.').trim()
      .isLength({ min: 3, max: 100 }).withMessage('Name must be between 3 and 100 characters.'),
    body('description').optional().isString().trim(),
    body('targetAmount').optional({nullable: true}).isFloat({ min: 0 }).withMessage('Target amount must be a non-negative number.'),
    body('startDate').optional({nullable: true}).isISO8601().toDate().withMessage('Valid start date is required if provided.'),
    body('endDate').optional({ nullable: true, checkFalsy: true }).isISO8601().toDate().withMessage('Valid end date required if provided.')
      .custom((value, { req }) => {
        if (value && req.body.startDate && new Date(value) < new Date(req.body.startDate)) {
          throw new Error('End date must be after start date.');
        }
        return true;
      }),
    body('isActive').optional().isBoolean().toBoolean(),
    body('customFields').optional({nullable: true}).isObject().withMessage('Custom fields must be an object or null.'),
  ],
  specialOfferingController.createSpecialOffering
);

// Get all special offerings (Publicly accessible, or add authenticateJWT if needed for logged-in users)
router.get('/', [
    query('activeOnly').optional().isBoolean().toBoolean(),
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(10),
    query('search').optional().isString().trim()
  ],
  specialOfferingController.getAllSpecialOfferings
);

// Get a specific special offering by ID or Code
router.get(
  '/:identifier',
   [
    param('identifier').notEmpty().withMessage('Offering identifier (ID or Code) is required.').trim()
  ],
  specialOfferingController.getSpecialOffering
);

// Update a special offering (Admin only, excluding view-only admins)
router.put(
  '/:identifier',
  authenticateJWT,
  isAdmin,
  [
    param('identifier').notEmpty().withMessage('Offering identifier (ID or Code) is required.').trim(),
    body('name').optional().isString().notEmpty().withMessage('Name cannot be empty if provided.').trim()
      .isLength({ min: 3, max: 100 }).withMessage('Name must be between 3 and 100 characters.'),
    body('offeringCode').optional().isString().notEmpty().withMessage('Offering code cannot be empty if provided.').trim()
      .isLength({ min: 3, max: 50 }).withMessage('Offering code must be between 3 and 50 characters.')
      .matches(/^[A-Z0-9_]+$/).withMessage('Offering code can only contain uppercase letters, numbers, and underscores.'),
    body('description').optional({nullable: true}).isString().trim(),
    body('targetAmount').optional({nullable: true}).isFloat({ min: 0 }).withMessage('Target amount must be a non-negative number.'),
    body('startDate').optional({nullable: true}).isISO8601().toDate().withMessage('Valid start date is required if provided.'),
    body('endDate').optional({ nullable: true, checkFalsy: true }).isISO8601().toDate().withMessage('Valid end date required if provided.')
     .custom((value, { req }) => {
        if (value && req.body.startDate && new Date(value) < new Date(req.body.startDate)) {
          throw new Error('End date must be after start date.');
        }
        return true;
      }),
    body('isActive').optional().isBoolean().toBoolean(),
    body('customFields').optional({nullable: true}).isObject().withMessage('Custom fields must be an object or null.'),
  ],
  specialOfferingController.updateSpecialOffering
);

// Delete a special offering (Admin only, excluding view-only admins)
router.delete(
  '/:identifier',
  authenticateJWT,
  isAdmin,
  [
    param('identifier').notEmpty().withMessage('Offering identifier (ID or Code) is required.').trim()
  ],
  specialOfferingController.deleteSpecialOffering
);

// Get progress for a special offering
router.get(
  '/:identifier/progress',
  [
    param('identifier').notEmpty().withMessage('Offering identifier (ID or Code) is required.').trim()
  ],
  specialOfferingController.getSpecialOfferingProgress
);

// Make a payment (contribution) to a specific special offering (Authenticated User)
router.post(
  '/:identifier/contribution', // Changed from /payment to avoid conflict with main payment routes if base changes
  authenticateJWT,
  [
    param('identifier').notEmpty().withMessage('Offering identifier (ID or Code) is required.').trim(),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),
    body('description').optional().isString().trim(),
    body('paymentMethod').optional().isIn(['MPESA', 'MANUAL']).withMessage('Invalid payment method for this context. Admins use "MANUAL", users initiate "MPESA".')
      .default('MPESA'), // Default to MPESA for user contributions
    body('phoneNumber').optional().if(body('paymentMethod').equals('MPESA'))
      .isMobilePhone('any', { strictMode: false }).withMessage('Valid phone number required for M-Pesa.')
  ],
  specialOfferingController.makePaymentToOffering
);

module.exports = router;