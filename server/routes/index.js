// server/routes/index.js
const express = require('express');
const authRoutes = require('./authRoutes');
const paymentRoutes = require('./paymentRoutes');
const receiptRoutes = require('./receiptRoutes');
const contactRoutes = require('./contactRoutes');

// Fix the path if needed - adjust this to match your actual file location
const specialOfferingRoutes = require('./specialOfferingRoutes');

const router = express.Router();

// API versioning
router.use('/auth', authRoutes);
router.use('/payment', paymentRoutes);
router.use('/receipt', receiptRoutes);
router.use('/contact', contactRoutes);
router.use('/payment/special-offering', specialOfferingRoutes);

// Base API route
router.get('/', (req, res) => {
  res.json({
    message: 'TASSIAC API is running',
    version: '1.0.0'
  });
});

module.exports = router;