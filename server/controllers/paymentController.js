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
    const { 
      page = 1, 
      limit = 20, 
      startDate, 
      endDate, 
      paymentType, 
      userId, 
      department, 
      isPromoted 
    } = req.query;
    
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
    const { 
      page = 1, 
      limit = 10, 
      startDate, 
      endDate, 
      paymentType 
    } = req.query;
    
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
      group: ['department'],
      raw: true
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
      group: ['paymentType'],
      raw: true
    });
    
    res.json({
      revenue: revenueTotal || 0,
      expenses: expensesTotal || 0,
      platformFees: platformFeesTotal || 0,
      netBalance: (revenueTotal || 0) - (expensesTotal || 0),
      expensesByDepartment: expensesByDepartment || [],
      paymentsByType: paymentsByType || []
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
    
    const { 
      amount, 
      paymentType, 
      description, 
      titheDistribution 
    } = req.body;
    
    const userId = req.user.id;
    
    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    
    // Calculate platform fee (2% for M-Pesa)
    const platformFee = parseFloat((amount * 0.02).toFixed(2));
    
    // Create a pending payment record
    const payment = await Payment.create({
      userId,
      amount: parseFloat(amount),
      paymentType,
      paymentMethod: 'MPESA',
      description: description || '',
      status: 'PENDING',
      platformFee,
      titheDistribution: paymentType === 'TITHE' ? titheDistribution : null,
      isTemplate: false,  // Explicitly mark as not a template
      paymentDate: new Date()
    });
    
    // Get user phone number
    const user = await User.findByPk(userId);
    if (!user) {
      await payment.destroy();
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!user.phone) {
      await payment.destroy();
      return res.status(400).json({ message: 'User phone number not found' });
    }
    
    try {
      // Initiate M-Pesa payment (include platform fee in amount)
      const totalAmount = parseFloat(amount) + platformFee;
      const paymentResponse = await initiateMpesaPayment(
        payment.id,
        totalAmount,
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
    } catch (mpesaError) {
      // If M-Pesa initiation fails, update payment status
      await payment.update({
        status: 'FAILED',
        description: `${description || ''} - Failed to initiate M-Pesa payment`
      });
      throw mpesaError;
    }
  } catch (error) {
    console.error('Initiate payment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add manual payment (admin only)
exports.addManualPayment = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { 
      userId, 
      amount, 
      paymentType, 
      description,
      paymentDate,
      department,
      isExpense
    } = req.body;

    // Validate required fields
    if (!userId || !amount || !paymentType) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: 'Missing required fields: userId, amount, paymentType' 
      });
    }

    // Validate amount
    if (amount <= 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // Validate that specified user exists
    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Invalid user ID specified' });
    }

    // Create payment with correct user and admin tracking
    const payment = await Payment.create({
      userId: userId, // Use the specified user ID (person who paid)
      amount: parseFloat(amount),
      paymentType,
      paymentMethod: 'MANUAL',
      description: description || '',
      status: 'COMPLETED',
      addedBy: req.user.id, // Track the admin who added it
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      department: department || null,
      isExpense: isExpense || false,
      isTemplate: false,
      platformFee: 0 // No platform fee for manual payments
    }, { transaction });

    // Generate receipt for non-expense payments
    if (!isExpense) {
      const receiptNumber = generateReceiptNumber(payment.paymentType);
      
      await Receipt.create({
        receiptNumber,
        paymentId: payment.id,
        userId: payment.userId,
        generatedBy: req.user.id,
        receiptData: {
          paymentId: payment.id,
          amount: payment.amount,
          paymentType: payment.paymentType,
          paymentMethod: 'MANUAL',
          description: payment.description,
          userDetails: {
            name: user.fullName || '',
            phone: user.phone || '',
            email: user.email || ''
          },
          churchDetails: {
            name: 'TASSIAC Church',
            address: process.env.CHURCH_ADDRESS || 'Church Address',
            phone: process.env.CHURCH_PHONE || 'Church Phone',
            email: process.env.CHURCH_EMAIL || 'church@tassiac.com'
          },
          receiptNumber,
          paymentDate: payment.paymentDate,
          issuedDate: new Date()
        }
      }, { transaction });
      
      await payment.update({ receiptNumber }, { transaction });
    }

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
      include: [{
        model: User,
        attributes: ['id', 'username', 'fullName']
      }],
      order: [['createdAt', 'DESC']],
      limit: 5
    });
    
    res.json({ promotedPayments });
  } catch (error) {
    console.error('Get promoted payments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get special offerings (redirects to special offering controller)
exports.getSpecialOfferings = async (req, res) => {
  try {
    // Import the special offering controller
    const specialOfferingController = require('./specialOfferingController');
    
    // Delegate to the special offering controller
    return specialOfferingController.getAllSpecialOfferings(req, res);
  } catch (error) {
    console.error('Error getting special offerings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Payment callback (for M-Pesa)
exports.mpesaCallback = async (req, res) => {
  const transaction = await sequelize.transaction();
  
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
      where: { 
        [Op.or]: [
          { reference: CheckoutRequestID },
          { reference: MerchantRequestID }
        ]
      },
      transaction
    });
    
    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    // Process the payment result
    if (ResultCode === 0) {
      // Payment successful
      const metadata = CallbackMetadata?.Item?.reduce((acc, item) => {
        if (item.Name && item.Value !== undefined) {
          acc[item.Name] = item.Value;
        }
        return acc;
      }, {}) || {};
      
      // Generate receipt number
      const receiptNumber = generateReceiptNumber(payment.paymentType);
      
      // Update payment
      await payment.update({
        status: 'COMPLETED',
        transactionId: metadata.MpesaReceiptNumber || metadata.TransactionID || null,
        receiptNumber,
        isTemplate: false // Ensure it's never marked as template
      }, { transaction });
      
      // Create receipt
      const user = await User.findByPk(payment.userId, { transaction });
      
      if (user) {
        const receiptData = {
          paymentId: payment.id,
          amount: payment.amount,
          paymentType: payment.paymentType,
          paymentMethod: 'MPESA',
          description: payment.description,
          userDetails: {
            name: user.fullName || '',
            phone: user.phone || '',
            email: user.email || ''
          },
          churchDetails: {
            name: 'TASSIAC Church',
            address: process.env.CHURCH_ADDRESS || 'Church Address',
            phone: process.env.CHURCH_PHONE || 'Church Phone',
            email: process.env.CHURCH_EMAIL || 'church@tassiac.com'
          },
          transactionDetails: {
            mpesaReceiptNumber: metadata.MpesaReceiptNumber || '',
            transactionDate: metadata.TransactionDate || new Date()
          },
          receiptNumber,
          paymentDate: payment.paymentDate || new Date(),
          issuedDate: new Date(),
          titheDistribution: payment.titheDistribution
        };
        
        await Receipt.create({
          receiptNumber,
          paymentId: payment.id,
          userId: payment.userId,
          receiptData
        }, { transaction });
        
        // Send SMS notification if enabled
        try {
          await sendSmsNotification(
            user.phone,
            `Dear ${user.fullName}, your ${payment.paymentType} payment of KES ${payment.amount} has been received. Receipt: ${receiptNumber}. Thank you!`
          );
        } catch (smsError) {
          console.error('SMS notification error:', smsError);
          // Don't fail the transaction for SMS errors
        }
      }
      
    } else {
      // Payment failed
      await payment.update({
        status: 'FAILED',
        description: `${payment.description || ''} - Failed: ${ResultDesc || 'Unknown error'}`
      }, { transaction });
    }
    
    await transaction.commit();
    
    // Always return success to M-Pesa
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    await transaction.rollback();
    console.error('M-Pesa callback error:', error);
    // Always return success to M-Pesa even on error
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};

// Create manual payment (alternative endpoint)
exports.createManualPayment = async (req, res) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    
    const paymentData = req.body;
    
    // Validate required fields
    if (!paymentData?.userId || !paymentData?.amount || !paymentData?.paymentType) {
      throw new Error("Missing required fields: userId, amount, paymentType");
    }

    // Prevent special offering creation through this endpoint
    if (String(paymentData.paymentType).startsWith('SPECIAL_')) {
      throw new Error("Special offerings must be created through /payment/special-offering endpoint");
    }

    // Get user with transaction
    const user = await User.findByPk(paymentData.userId, { transaction });
    if (!user) {
      throw new Error('User not found');
    }

    // Create payment with safe data
    const payment = await Payment.create({
      userId: paymentData.userId,
      amount: parseFloat(paymentData.amount),
      paymentType: String(paymentData.paymentType),
      paymentMethod: 'MANUAL',
      description: String(paymentData.description || ''),
      status: 'COMPLETED',
      addedBy: req.user?.id,
      paymentDate: new Date(paymentData.paymentDate || Date.now()),
      isTemplate: false,
      platformFee: 0,
      department: paymentData.department || null,
      isExpense: paymentData.isExpense || false
    }, { transaction });

    const receiptNumber = generateReceiptNumber(payment.paymentType);

    // Create receipt with safe data
    await Receipt.create({
      receiptNumber,
      paymentId: payment.id,
      userId: payment.userId,
      generatedBy: req.user?.id,
      receiptData: {
        paymentId: payment.id,
        amount: payment.amount,
        paymentType: payment.paymentType,
        paymentMethod: 'MANUAL',
        description: payment.description,
        userDetails: {
          name: user.fullName || '',
          phone: user.phone || '',
          email: user.email || ''
        },
        churchDetails: {
          name: 'TASSIAC Church',
          address: process.env.CHURCH_ADDRESS || 'Church Address',
          phone: process.env.CHURCH_PHONE || 'Church Phone',
          email: process.env.CHURCH_EMAIL || 'church@tassiac.com'
        },
        receiptNumber,
        paymentDate: payment.paymentDate,
        issuedDate: new Date()
      }
    }, { transaction });

    await payment.update({ receiptNumber }, { transaction });
    await transaction.commit();
    
    return res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      payment
    });

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Error creating payment:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Error creating payment'
    });
  }
};

// Create special offering
exports.createSpecialOffering = async (req, res) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    
    const offeringData = req.body;
    
    // Validate required fields
    if (!offeringData?.name || !offeringData?.targetGoal || !offeringData?.offeringType) {
      throw new Error("Required fields missing: name, targetGoal, offeringType");
    }

    // Validate target goal
    if (parseFloat(offeringData.targetGoal) <= 0) {
      throw new Error("Target goal must be greater than 0");
    }

    // Normalize offering type
    const paymentType = String(offeringData.offeringType).startsWith('SPECIAL_') 
      ? offeringData.offeringType 
      : `SPECIAL_${offeringData.offeringType}`;

    // Check for duplicate with transaction
    const existingOffering = await Payment.findOne({
      where: {
        paymentType,
        isTemplate: true
      },
      transaction
    });

    if (existingOffering) {
      throw new Error("A special offering with this type already exists");
    }

    // Validate dates if provided
    const startDate = offeringData.startDate ? new Date(offeringData.startDate) : new Date();
    const endDate = offeringData.endDate ? new Date(offeringData.endDate) : null;
    
    if (endDate && endDate <= startDate) {
      throw new Error("End date must be after start date");
    }

    // Create offering with safe data
    const specialOffering = await Payment.create({
      userId: req.user?.id,
      amount: parseFloat(offeringData.targetGoal),
      paymentType,
      paymentMethod: 'MANUAL',
      description: String(offeringData.name).trim(),
      status: 'COMPLETED',
      addedBy: req.user?.id,
      paymentDate: startDate,
      targetGoal: parseFloat(offeringData.targetGoal),
      endDate: endDate,
      isPromoted: true,
      isTemplate: true,
      isExpense: false,
      platformFee: 0,
      customFields: JSON.stringify({
        fullDescription: String(offeringData.description || offeringData.name),
        fields: Array.isArray(offeringData.customFields) ? offeringData.customFields : []
      })
    }, { transaction });

    await transaction.commit();
    
    return res.status(201).json({
      success: true,
      message: 'Special offering created successfully',
      specialOffering
    });

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Error creating special offering:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Error creating special offering'
    });
  }
};

// Update payment status (admin only)
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }
    
    const payment = await Payment.findByPk(paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    await payment.update({ status });
    
    res.json({
      message: 'Payment status updated successfully',
      payment
    });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Toggle payment promotion (admin only)
exports.togglePaymentPromotion = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await Payment.findByPk(paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    await payment.update({ isPromoted: !payment.isPromoted });
    
    res.json({
      message: `Payment ${payment.isPromoted ? 'promoted' : 'unpromoted'} successfully`,
      payment
    });
  } catch (error) {
    console.error('Toggle payment promotion error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete payment (admin only)
exports.deletePayment = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { paymentId } = req.params;
    
    const payment = await Payment.findByPk(paymentId, { transaction });
    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    // Delete associated receipts
    await Receipt.destroy({
      where: { paymentId },
      transaction
    });
    
    // Delete the payment
    await payment.destroy({ transaction });
    
    await transaction.commit();
    
    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    console.error('Delete payment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DO NOT CHANGE THIS EXPORT
module.exports = exports;