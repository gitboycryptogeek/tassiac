// server/routes/index.js
const express = require('express');
const authRoutes = require('./authRoutes.js');
const paymentRoutes = require('./paymentRoutes.js');
const receiptRoutes = require('./receiptRoutes.js');
const contactRoutes = require('./contactRoutes.js'); // This file
const specialOfferingRoutes = require('./specialOfferingRoutes.js');
const adminRoutes = require('./adminRoutes.js'); // Assuming you created this

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/payment', paymentRoutes);
router.use('/receipt', receiptRoutes);
router.use('/contact', contactRoutes); // Mounts all routes from contactRoutes.js under /api/contact
router.use('/special-offerings', specialOfferingRoutes);
router.use('/admin', adminRoutes); // For admin-specific dashboard/reporting

// Base API route
router.get('/', (req, res) => {
  res.json({
    message: 'TASSIAC API is running',
    version: '1.2.0-prisma-contact',
  });
});

module.exports = router;