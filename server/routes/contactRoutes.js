// server/routes/contactRoutes.js
const express = require('express');
const { body } = require('express-validator');
const contactController = require('../controllers/contactController');

const router = express.Router();

// Submit contact form
router.post(
  '/submit',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('message').notEmpty().withMessage('Message is required'),
    body('phone').optional().isMobilePhone().withMessage('Valid phone number is required')
  ],
  contactController.submitContactForm
);

// Get contact information (no authentication required)
router.get('/info', contactController.getContactInfo);

module.exports = router;