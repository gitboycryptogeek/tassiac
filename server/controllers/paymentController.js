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
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { 
      userId, 
      amount, 
      paymentType, 
      description, 
      isExpense, 
      department,
      paymentDate,
      titheDistribution,
      isPromoted,
      endDate,
      customFields,
      targetGoal
    } = req.body;
    
    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Calculate platform fee (0.5% for manual entries)
    const platformFee = parseFloat((amount * 0.005).toFixed(2));
    
    // Generate receipt number
    const receiptNumber = generateReceiptNumber(paymentType);
    
    // FIXED: Check if this is a special offering creation request
    // We handle this in the specialOfferingController now
    if (paymentType && paymentType.startsWith('SPECIAL_') && targetGoal) {
      // This appears to be a special offering template creation
      // Redirect to the appropriate controller
      return res.status(400).json({ 
        message: 'Use the special offering endpoint to create special offerings',
        error: 'Incorrect endpoint for special offering creation'
      });
    }
    
    // Determine if this is an actual payment to a special offering
    const isSpecialOfferingPayment = paymentType && paymentType.startsWith('SPECIAL_');
    
    // Create the payment (ensuring it's never marked as a template)
    const payment = await Payment.create({
      userId,
      amount,
      paymentType,
      paymentMethod: 'MANUAL',
      description,
      status: 'COMPLETED',
      receiptNumber,
      isExpense: isExpense || false,
      department: isExpense ? department : null,
      addedBy: req.user.id,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      platformFee,
      titheDistribution: paymentType === 'TITHE' ? titheDistribution : null,
      isPromoted: isPromoted || false,
      endDate: endDate || null,
      customFields: customFields || null,
      targetGoal: null, // Never set targetGoal for actual payments
      isTemplate: false // Always false for actual payments
    });
    
    // Create receipt
    const receiptData = {
      paymentId: payment.id,
      amount,
      paymentType,
      paymentMethod: 'MANUAL',
      description,
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
      receiptNumber,
      paymentDate: payment.paymentDate,
      issuedDate: new Date(),
      titheDistribution: payment.titheDistribution
    };
    
    await Receipt.create({
      receiptNumber,
      paymentId: payment.id,
      userId,
      generatedBy: req.user.id,
      receiptData
    });
    
    // Send SMS notification if not an expense
    if (!isExpense) {
      const notificationMessage = `Dear ${user.fullName}, your ${paymentType} payment of ${amount} has been recorded. Receipt: ${receiptNumber}. Thank you for your contribution to TASSIAC Church.`;
      
      await Notification.create({
        userId,
        notificationType: 'SMS',
        message: notificationMessage,
        reference: payment.id.toString(),
        status: 'PENDING'
      });
      
      // Send the SMS in background
      sendSmsNotification(user.phone, notificationMessage)
        .then(response => {
          Notification.update(
            { status: 'SENT', responseData: response },
            { where: { reference: payment.id.toString() } }
          );
        })
        .catch(error => {
          console.error('SMS notification error:', error);
          Notification.update(
            { status: 'FAILED', responseData: { error: error.message } },
            { where: { reference: payment.id.toString() } }
          );
        });
    }
    
    res.status(201).json({
      message: isSpecialOfferingPayment ? 
        'Payment to special offering added successfully' : 
        'Payment added successfully',
      payment,
      receiptNumber
    });
  } catch (error) {
    console.error('Add manual payment error:', error);
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
      
      // Send SMS notification
      const notificationMessage = `Dear ${user.fullName}, your ${payment.paymentType} payment of ${payment.amount} via M-Pesa has been received. Receipt: ${receiptNumber}. Thank you for your contribution to TASSIAC Church.`;
      
      await Notification.create({
        userId: payment.userId,
        notificationType: 'SMS',
        message: notificationMessage,
        reference: payment.id.toString(),
        status: 'PENDING'
      });
      
      // Send the SMS in background
      sendSmsNotification(user.phone, notificationMessage)
        .then(response => {
          Notification.update(
            { status: 'SENT', responseData: response },
            { where: { reference: payment.id.toString() } }
          );
        })
        .catch(error => {
          console.error('SMS notification error:', error);
          Notification.update(
            { status: 'FAILED', responseData: { error: error.message } },
            { where: { reference: payment.id.toString() } }
          );
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
  try {
    // Extract payment data from request
    const paymentData = req.body;
    
    // Allow special offerings if they have the required fields
    if (paymentData.paymentType?.startsWith('SPECIAL_')) {
      if (!paymentData.targetGoal || !paymentData.endDate) {
        return res.status(400).json({
          message: "Special offerings require targetGoal and endDate"
        });
      }
      // Set as template if it's the initial special offering creation
      if (!paymentData.userId) {
        paymentData.isTemplate = true;
        paymentData.status = 'COMPLETED';
      }
    }

    // Create the payment
    const payment = await Payment.create({
      ...paymentData,
      addedBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      payment
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(400).json({
      message: error.message || 'Error creating payment'
    });
  }
};

// DO NOT CHANGE THIS EXPORT
module.exports = exports;