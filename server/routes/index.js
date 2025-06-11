// server/routes/index.js
const express = require('express');
const authRoutes = require('./authRoutes.js');
const paymentRoutes = require('./paymentRoutes.js');
const receiptRoutes = require('./receiptRoutes.js');
const contactRoutes = require('./contactRoutes.js');
const specialOfferingRoutes = require('./specialOfferingRoutes.js');
const adminRoutes = require('./adminRoutes.js');
const walletRoutes = require('./walletRoutes.js');
const batchPaymentRoutes = require('./batchPaymentRoutes.js');
const kcbSyncRoutes = require('./kcbSyncRoutes.js');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/payment', paymentRoutes);
router.use('/receipt', receiptRoutes);
router.use('/contact', contactRoutes);
router.use('/special-offerings', specialOfferingRoutes);
router.use('/admin', adminRoutes);
router.use('/wallets', walletRoutes);
router.use('/batch-payments', batchPaymentRoutes);
router.use('/kcb-sync', kcbSyncRoutes);

// Base API route
router.get('/', (req, res) => {
  res.json({
    message: 'TASSIAC API is running',
    version: '2.0.0-kcb-wallets-batch',
    features: [
      'KCB Payment Integration',
      'Wallet Management System',
      'Batch Payment Processing',
      'Transaction Synchronization',
      'Multi-Admin Withdrawal Approval',
      'Automated Receipt Generation'
    ],
    endpoints: {
      auth: '/api/auth',
      payments: '/api/payment',
      receipts: '/api/receipt',
      contact: '/api/contact',
      specialOfferings: '/api/special-offerings',
      admin: '/api/admin',
      wallets: '/api/wallets',
      batchPayments: '/api/batch-payments',
      kcbSync: '/api/kcb-sync'
    }
  });
});

module.exports = router;