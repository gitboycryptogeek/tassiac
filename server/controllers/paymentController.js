// server/controllers/paymentController.js
const { Op } = require('sequelize');
const { models } = require('../models');
const { validationResult } = require('express-validator');
const { generateReceiptNumber } = require('../utils/receiptUtils');
const { sendSmsNotification } = require('../utils/notificationUtils');
const { initiateMpesaPayment } = require('../utils/paymentUtils');
const sequelize = require('../config/database');

const User = models.User;
const Payment = models.Payment;
const Receipt = models.Receipt;
const Notification = models.Notification;

// Get all payments (admin only)
exports.getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20, startDate, endDate, paymentType, userId, department, isPromoted } = req.query;
    const offset = (page - 1) * limit;
    
    // Build filter conditions
    const whereConditions = {
      isTemplate: false  // Exclude special offering templates
    };
    
    if (startDate && endDate) {
      whereConditions.paymentDate = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }
    
    if (paymentType) {
      if (paymentType === 'SPECIAL') {
        // Handle special offerings (paymentType starts with SPECIAL_)
        whereConditions.paymentType = {
          [Op.like]: 'SPECIAL_%'
        };
      } else {
        whereConditions.paymentType = paymentType;
      }
    }
    
    if (userId) {
      whereConditions.userId = userId;
    }
    
    if (department) {
      whereConditions.department = department;
    }
    
    if (isPromoted === 'true' || isPromoted === true) {
      whereConditions.isPromoted = true;
    }
    
    // Get payments with pagination
    const payments = await Payment.findAndCountAll({
      where: whereConditions,
      include: [
        { 
          model: User,
          attributes: ['id', 'username', 'fullName', 'phone'] 
        },
        {
          model: User,
          as: 'AdminUser',
          attributes: ['id', 'username', 'fullName'],
          required: false
        }
      ],
      order: [['paymentDate', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      total: payments.count,
      totalPages: Math.ceil(payments.count / limit),
      currentPage: parseInt(page),
      payments: payments.rows
    });
  } catch (error) {
    console.error('Get all payments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user payments
exports.getUserPayments = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    const { page = 1, limit = 10, startDate, endDate, paymentType } = req.query;
    const offset = (page - 1) * limit;
    
    // Build filter conditions
    const whereConditions = { 
      userId,
      isTemplate: false  // Exclude templates
    };
    
    if (startDate && endDate) {
      whereConditions.paymentDate = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }
    
    if (paymentType) {
      if (paymentType === 'SPECIAL') {
        // Handle special offerings (paymentType starts with SPECIAL_)
        whereConditions.paymentType = {
          [Op.like]: 'SPECIAL_%'
        };
      } else {
        whereConditions.paymentType = paymentType;
      }
    }
    
    // Get user's payments with pagination
    const payments = await Payment.findAndCountAll({
      where: whereConditions,
      order: [['paymentDate', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      total: payments.count,
      totalPages: Math.ceil(payments.count / limit),
      currentPage: parseInt(page),
      payments: payments.rows
    });
  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get payment statistics (admin only)
exports.getPaymentStats = async (req, res) => {
  try {
    // Get total revenue (non-expenses)
    const revenueTotal = await Payment.sum('amount', {
      where: {
        isExpense: false,
        isTemplate: false,  // Exclude templates
        status: 'COMPLETED'
      }
    });
    
    // Get total expenses
    const expensesTotal = await Payment.sum('amount', {
      where: {
        isExpense: true,
        isTemplate: false,  // Exclude templates
        status: 'COMPLETED'
      }
    });
    
    // Get total platform fees
    const platformFeesTotal = await Payment.sum('platformFee', {
      where: {
        status: 'COMPLETED',
        isTemplate: false  // Exclude templates
      }
    });
    
    // Get expense breakdown by department
    const expensesByDepartment = await Payment.findAll({
      attributes: [
        'department', 
        [sequelize.fn('SUM', sequelize.col('amount')), 'total']
      ],
      where: {
        isExpense: true,
        isTemplate: false,  // Exclude templates
        status: 'COMPLETED',
        department: {
          [Op.ne]: null
        }
      },
      group: ['department']
    });
    
    // Get payment breakdown by type
    const paymentsByType = await Payment.findAll({
      attributes: [
        'paymentType', 
        [sequelize.fn('SUM', sequelize.col('amount')), 'total']
      ],
      where: {
        isExpense: false,
        isTemplate: false,  // Exclude templates
        status: 'COMPLETED'
      },
      group: ['paymentType']
    });
    
    res.json({
      revenue: revenueTotal || 0,
      expenses: expensesTotal || 0,
      platformFees: platformFeesTotal || 0,
      netBalance: (revenueTotal || 0) - (expensesTotal || 0),
      expensesByDepartment,
      paymentsByType
    });
  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Initiate a payment
exports.initiatePayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { amount, paymentType, description, titheDistribution } = req.body;
    const userId = req.user.id;
    
    // Calculate platform fee (2% for M-Pesa)
    const platformFee = parseFloat((amount * 0.02).toFixed(2));
    
    // Create a pending payment record
    const payment = await Payment.create({
      userId,
      amount,
      paymentType,
      paymentMethod: 'MPESA',
      description,
      status: 'PENDING',
      platformFee,
      titheDistribution: paymentType === 'TITHE' ? titheDistribution : null,
      isTemplate: false  // Explicitly mark as not a template
    });
    
    // Get user phone number
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Initiate M-Pesa payment (include platform fee in amount)
    const paymentResponse = await initiateMpesaPayment(
      payment.id,
      amount + platformFee,
      user.phone,
      `TASSIAC ${paymentType}`
    );
    
    // Update payment with response data
    await payment.update({
      reference: paymentResponse.reference || null,
      transactionId: paymentResponse.transactionId || null
    });
    
    res.json({
      message: 'Payment initiated successfully',
      payment,
      paymentDetails: paymentResponse
    });
  } catch (error) {
    console.error('Initiate payment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add manual payment (admin only)
exports.addManualPayment = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { userId, amount, paymentType, description } = req.body;

    // Validate that specified user exists
    const user = await User.findByPk(userId);
    if (!user) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Invalid user ID specified' });
    }

    // Create payment with correct user and admin tracking
    const payment = await Payment.create({
      userId: userId, // Use the specified user ID (person who paid)
      amount,
      paymentType,
      paymentMethod: 'MANUAL',
      description,
      status: 'COMPLETED',
      addedBy: req.user.id, // Track the admin who added it
      ...req.body // Include other valid fields
    }, { transaction });

    await transaction.commit();

    res.json({
      message: 'Manual payment added successfully',
      payment
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error adding manual payment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get promoted payments
exports.getPromotedPayments = async (req, res) => {
  try {
    const promotedPayments = await Payment.findAll({
      where: {
        isPromoted: true,
        isExpense: false,
        isTemplate: false,  // Exclude templates
        status: 'COMPLETED'
      },
      order: [['createdAt', 'DESC']],
      limit: 5
    });
    
    res.json({ promotedPayments });
  } catch (error) {
    console.error('Get promoted payments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get active special offerings
exports.getSpecialOfferings = async (req, res) => {
  try {
    const now = new Date();
    
    const specialOfferings = await Payment.findAll({
      where: {
        paymentType: {
          [Op.like]: 'SPECIAL_%'
        },
        isTemplate: true,  // Only include templates
        // Only include active offerings (either no end date, or end date in the future)
        [Op.or]: [
          { endDate: null },
          { endDate: { [Op.gte]: now } }
        ],
        isPromoted: true
      },
      order: [['createdAt', 'DESC']]
    });
    
    res.json({ specialOfferings });
  } catch (error) {
    console.error('Get special offerings error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Payment callback (for M-Pesa)
exports.mpesaCallback = async (req, res) => {
  try {
    const { 
      Body: { 
        stkCallback: { 
          MerchantRequestID, 
          CheckoutRequestID,
          ResultCode,
          ResultDesc,
          CallbackMetadata 
        } 
      } 
    } = req.body;
    
    // Find the payment by the reference ID
    const payment = await Payment.findOne({ 
      where: { reference: CheckoutRequestID || MerchantRequestID }
    });
    
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    // Process the payment result
    if (ResultCode === 0) {
      // Payment successful
      const metadata = CallbackMetadata.Item.reduce((acc, item) => {
        if (item.Name && item.Value) {
          acc[item.Name] = item.Value;
        }
        return acc;
      }, {});
      
      // Generate receipt number
      const receiptNumber = generateReceiptNumber(payment.paymentType);
      
      // Update payment
      await payment.update({
        status: 'COMPLETED',
        transactionId: metadata.MpesaReceiptNumber || metadata.TransactionID,
        receiptNumber,
        isTemplate: false // Ensure it's never marked as template
      });
      
      // Create receipt
      const user = await User.findByPk(payment.userId);
      
      const receiptData = {
        paymentId: payment.id,
        amount: payment.amount,
        paymentType: payment.paymentType,
        paymentMethod: 'MPESA',
        description: payment.description,
        userDetails: {
          name: user.fullName,
          phone: user.phone,
          email: user.email
        },
        churchDetails: {
          name: 'TASSIAC Church',
          address: 'Church Address',
          phone: 'Church Phone',
          email: 'church@tassiac.com'
        },
        transactionDetails: {
          mpesaReceiptNumber: metadata.MpesaReceiptNumber,
          transactionDate: metadata.TransactionDate || new Date()
        },
        receiptNumber,
        paymentDate: new Date(),
        issuedDate: new Date(),
        titheDistribution: payment.titheDistribution
      };
      
      await Receipt.create({
        receiptNumber,
        paymentId: payment.id,
        userId: payment.userId,
        receiptData
      });
      
    } else {
      // Payment failed
      await payment.update({
        status: 'FAILED',
        description: `${payment.description} - Failed: ${ResultDesc}`
      });
    }
    
    // Always return success to M-Pesa
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    // Always return success to M-Pesa even on error
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};

exports.createManualPayment = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const paymentData = req.body;
    
    // Special handling for special offerings
    if (paymentData.paymentType?.startsWith('SPECIAL_')) {
      // Validate special offering requirements
      if (paymentData.isTemplate) {
        if (!paymentData.targetGoal || !paymentData.endDate) {
          await transaction.rollback();
          return res.status(400).json({
            message: "Special offerings require targetGoal and endDate"
          });
        }
      } else {
        // Regular payment to special offering
        if (!paymentData.userId) {
          await transaction.rollback();
          return res.status(400).json({
            message: "User ID is required for special offering payments"
          });
        }
      }
    }

    // Create the payment with proper tracking
    const payment = await Payment.create({
      ...paymentData,
      addedBy: req.user.id,
      status: 'COMPLETED',
      paymentMethod: paymentData.paymentMethod || 'MANUAL'
    }, { transaction });

    await transaction.commit();
    
    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      payment
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating payment:', error);
    res.status(400).json({
      message: error.message || 'Error creating payment'
    });
  }
};

// DO NOT CHANGE THIS EXPORT
module.exports = exports;