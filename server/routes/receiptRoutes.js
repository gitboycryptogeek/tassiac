// server/routes/receiptRoutes.js
const express = require('express');
const receiptController = require('../controllers/receiptController');
const { authenticateJWT, isAdmin, isOwnResource } = require('../middlewares/auth');

const router = express.Router();

// Get all receipts (admin only)
router.get('/all', authenticateJWT, isAdmin, receiptController.getAllReceipts);

// Get user receipts
router.get(
  '/user/:userId?', 
  authenticateJWT, 
  isOwnResource, 
  receiptController.getUserReceipts
);

// Get receipt by ID
router.get(
  '/:receiptId', 
  authenticateJWT, 
  receiptController.getReceiptById
);

// Generate PDF receipt
router.get(
  '/:receiptId/pdf', 
  authenticateJWT, 
  receiptController.generatePdfReceipt
);

module.exports = router;