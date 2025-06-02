// server/routes/receiptRoutes.js
const express = require('express');
const { param, query } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const receiptController = require('../controllers/receiptController.js');
const { authenticateJWT, isAdmin, isOwnResource } = require('../middlewares/auth.js');

const router = express.Router();

// Multer setup for receipt attachments (if you want to upload directly to a receipt)
// The directory should ideally match what's used in your controller for consistency.
const receiptAttachmentUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'receipt_attachments'); // Or just 'receipts' if that's where PDFs also go
if (!fs.existsSync(receiptAttachmentUploadDir)) {
  fs.mkdirSync(receiptAttachmentUploadDir, { recursive: true });
}

const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, receiptAttachmentUploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `attachment-${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
  }
});

const attachmentUpload = multer({
  storage: attachmentStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Attachment upload only supports JPEG, PNG, PDF.'));
  }
});

// --- Admin Routes ---

// GET all receipts (admin only) - with pagination and filtering
router.get(
  '/all',
  authenticateJWT,
  isAdmin,
  [
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().default(20),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
    query('userId').optional().isInt().toInt(),
    query('search').optional().isString().trim(),
  ],
  receiptController.getAllReceipts
);

// --- Authenticated User Routes (User or Admin) ---

// GET user's own receipts (or specific user's receipts if admin)
router.get(
  '/user/:userId?', // :userId is optional; if not provided, controller uses req.user.id
  authenticateJWT,
  // isOwnResource or controller logic handles authorization
  [
    param('userId').optional().isInt().withMessage('User ID must be an integer if provided.'),
    query('page').optional().isInt({ min: 1 }).toInt().default(1),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt().default(10),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
    query('search').optional().isString().trim(),
  ],
  receiptController.getUserReceipts
);

// GET a specific receipt by its ID
router.get(
  '/:receiptId',
  authenticateJWT,
  [
    param('receiptId').isInt().withMessage('Valid Receipt ID is required.'),
  ],
  receiptController.getReceiptById // Authorization (own receipt or admin) is handled in controller
);

// GET (Download) PDF version of a specific receipt
router.get(
  '/:receiptId/pdf',
  authenticateJWT,
  [
    param('receiptId').isInt().withMessage('Valid Receipt ID is required.'),
  ],
  receiptController.generatePdfReceipt // Authorization is handled in controller
);

// POST an attachment to a specific receipt (e.g., if a user uploads a proof or admin attaches a document)
// This assumes the 'uploadReceiptAttachment' function exists in your receiptController.
// The isOwnResource middleware might be tricky here if an admin can upload to any receipt.
// The controller should handle the specific authorization logic.
router.post(
  '/:receiptId/attachment',
  authenticateJWT, // Any authenticated user might upload, or just admin. Controller needs to check.
  attachmentUpload.single('attachmentFile'), // Field name for the uploaded file
  [
    param('receiptId').isInt().withMessage('Valid Receipt ID is required.'),
    // Add any other body validations if needed, e.g., a description for the attachment
  ],
  receiptController.uploadReceiptAttachment // This function was in your original controller
);


module.exports = router;