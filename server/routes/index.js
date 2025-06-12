// server/routes/index.js
const express = require('express');
const authRoutes = require('./authRoutes');
const paymentRoutes = require('./paymentRoutes');
const kcbSyncRoutes = require('./kcbSyncRoutes');
const receiptRoutes = require('./receiptRoutes');
const specialOfferingRoutes = require('./specialOfferingRoutes');
const contactRoutes = require('./contactRoutes');
const adminRoutes = require('./adminRoutes');
const walletRoutes = require('./walletRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/payment', paymentRoutes);
router.use('/kcb-sync', kcbSyncRoutes);
router.use('/receipt', receiptRoutes);
router.use('/special-offerings', specialOfferingRoutes);
router.use('/contact', contactRoutes);
router.use('/admin', adminRoutes);
router.use('/wallets', walletRoutes);

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