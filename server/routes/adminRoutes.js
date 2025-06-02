// server/routes/adminRoutes.js
const express = require('express');
const { query, body } = require('express-validator');
const adminController = require('../controllers/adminController.js');
const { authenticateJWT, isAdmin } = require('../middlewares/auth.js');

const router = express.Router();

// Apply admin authentication to all routes in this file
router.use(authenticateJWT);
router.use(isAdmin);

// GET recent admin activity (e.g., audit trail)
router.get(
  '/activity',
  [
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(20),
  ],
  adminController.getRecentActivity
);

// POST to create a generic activity log entry (if needed as a direct endpoint)
// Often, activity logging is done directly within other controller actions.
// This endpoint is provided if you need a way for an admin to explicitly log an action.
router.post(
  '/activity-log',
  [
    body('actionType').isString().notEmpty().withMessage('Action type is required.').trim(),
    body('targetId').isString().notEmpty().withMessage('Target ID is required.').trim(),
    body('actionData').optional().isObject().withMessage('Action data must be an object.'),
  ],
  adminController.createActivityLog // Assumes view-only admin check is in the controller
);

// GET system-wide dashboard statistics
router.get(
  '/dashboard-stats',
  adminController.getDashboardStats
);

// POST to generate system reports (PDF/CSV)
router.post(
  '/reports',
  [
    body('reportType').isString().notEmpty().isIn(['REVENUE', 'EXPENSES', 'USERS', 'COMPREHENSIVE'])
      .withMessage('Valid report type is required (REVENUE, EXPENSES, USERS, COMPREHENSIVE).'),
    body('startDate').isISO8601().toDate().withMessage('Valid start date is required.'),
    body('endDate').isISO8601().toDate().withMessage('Valid end date is required.')
      .custom((value, { req }) => {
        if (new Date(value) < new Date(req.body.startDate)) {
          throw new Error('End date must be after start date.');
        }
        return true;
      }),
    body('format').optional().isIn(['pdf', 'csv']).default('pdf'),
  ],
  adminController.generateReport // Assumes view-only admin check for sensitive report generation is in the controller if needed
);

module.exports = router;