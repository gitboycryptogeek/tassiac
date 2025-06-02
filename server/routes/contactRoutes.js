// server/routes/contactRoutes.js
const express = require('express');
const { body, param, query } = require('express-validator');
const contactController = require('../controllers/contactController.js');
const { authenticateJWT, isAdmin } = require('../middlewares/auth.js');

const router = express.Router();

// --- Public Routes ---

// GET contact information (church details)
router.get(
  '/info',
  contactController.getContactInfo
);

// POST submit a contact form inquiry
router.post(
  '/submit',
  // This route can be public, or you can add authenticateJWT if only logged-in users can submit
  // If using authenticateJWT, req.user will be available in the controller
  // For now, making it public but the controller can link to a user if req.user exists
  [
    body('name').isString().notEmpty().withMessage('Name is required.').trim().isLength({ min: 2, max: 100 }),
    body('email').isEmail().withMessage('A valid email address is required.').normalizeEmail(),
    body('phone').optional({ checkFalsy: true }).isString().trim().isLength({ min: 10, max: 15 }).withMessage('Phone number seems invalid.'),
    body('subject').isString().notEmpty().withMessage('Subject is required.').trim().isLength({ min: 3, max: 150 }),
    body('message').isString().notEmpty().withMessage('Message is required.').trim().isLength({ min: 10, max: 2000 }),
  ],
  contactController.submitContactForm
);

// --- Admin Routes for Managing Inquiries ---
// All routes below require admin authentication

// GET all contact inquiries (Admin only)
router.get(
  '/inquiries', // Base path for admin to view inquiries
  authenticateJWT,
  isAdmin,
  [
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt().default(15),
    query('status').optional().isString().toUpperCase().isIn(['PENDING', 'VIEWED', 'RESOLVED', 'ARCHIVED', 'SPAM', 'ALL']).withMessage('Invalid status filter.'),
    query('search').optional().isString().trim(),
  ],
  contactController.getAllInquiries
);

// GET a single contact inquiry by ID (Admin only)
router.get(
  '/inquiries/:inquiryId',
  authenticateJWT,
  isAdmin,
  [
    param('inquiryId').isInt().withMessage('Valid Inquiry ID is required.'),
  ],
  contactController.getInquiryById
);

// PUT update the status of an inquiry (Admin only - excluding view-only)
router.put(
  '/inquiries/:inquiryId/status',
  authenticateJWT,
  isAdmin, // Further view-only check will be in the controller
  [
    param('inquiryId').isInt().withMessage('Valid Inquiry ID is required.'),
    body('status').isString().notEmpty().toUpperCase().isIn(['PENDING', 'VIEWED', 'RESOLVED', 'ARCHIVED', 'SPAM'])
      .withMessage('Invalid status value. Must be one of: PENDING, VIEWED, RESOLVED, ARCHIVED, SPAM.'),
    body('resolutionNotes').optional({nullable: true}).isString().trim()
  ],
  contactController.updateInquiryStatus
);

// DELETE (Archive) an inquiry (Admin only - excluding view-only)
router.delete(
  '/inquiries/:inquiryId', // This will likely mark as 'ARCHIVED' or similar, not hard delete
  authenticateJWT,
  isAdmin, // Further view-only check in controller
  [
    param('inquiryId').isInt().withMessage('Valid Inquiry ID is required.'),
  ],
  contactController.deleteInquiry // This controller method should handle archival logic
);

module.exports = router;