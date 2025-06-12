// server/controllers/paymentController.js
const { PrismaClient, Prisma } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const { generateReceiptNumber } = require('../utils/receiptUtils.js');
const { sendSmsNotification } = require('../utils/notificationUtils.js');
const { initiateMpesaPayment } = require('../utils/paymentUtils.js');
const { initiateKcbMpesaStkPush } = require('../utils/kcbPaymentUtils.js');
const { isViewOnlyAdmin } = require('../middlewares/auth.js');
const WalletService = require('../utils/walletService.js');
const { logger } = require('../config/logger');

const prisma = new PrismaClient();

// Centralized logging utility (non-blocking)
const logActivity = async (message, data = null) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] PAYMENT_CTRL: ${message}${data ? ` | Data: ${JSON.stringify(data)}` : ''}`;
  console.log(logMessage);
  
  // Non-blocking file logging
  if (process.env.NODE_ENV !== 'production') {
    const LOG_DIR = path.join(__dirname, '..', 'logs');
    const LOG_FILE = path.join(LOG_DIR, 'payment-controller.log');
    
    try {
      await fs.mkdir(LOG_DIR, { recursive: true });
      await fs.appendFile(LOG_FILE, logMessage + '\n');
    } catch (error) {
      console.error('Logging failed:', error.message);
    }
  }
};

// Standardized response helper
const sendResponse = (res, statusCode, success, data, message, errorDetails = null) => {
  const responsePayload = { success, message };
  if (data !== null && data !== undefined) {
    responsePayload.data = data;
  }
  if (errorDetails) {
    responsePayload.error = errorDetails;
  }
  return res.status(statusCode).json(responsePayload);
};

// Log Admin Activity (non-blocking)
const logAdminActivity = async (actionType, targetId, initiatedBy, actionData = {}) => {
  setImmediate(async () => {
    try {
      await prisma.adminAction.create({
        data: {
          actionType,
          targetId: String(targetId),
          initiatedById: initiatedBy,
          actionData,
          status: 'COMPLETED',
        },
      });
    } catch (error) {
      logger.error(`Failed to log admin activity ${actionType}: ${error.message}`);
    }
  });
};

exports.getAllPayments = async (req, res) => {
  try {
    logger.info('Admin: Get All Payments attempt started', { userId: req.user.id });
    
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      paymentType,
      userId,
      department,
      status,
      search,
      specialOfferingId,
      titheCategory,
      paymentMethod,
      sortBy = 'paymentDate',
      sortOrder = 'desc'
    } = req.query;

    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    // Enhanced filtering with better validation
    const whereConditions = { isTemplate: { not: true } };

    // Date filters with validation
    if (startDate || endDate) {
      whereConditions.paymentDate = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return sendResponse(res, 400, false, null, 'Invalid start date format.', { code: 'INVALID_DATE' });
        }
        whereConditions.paymentDate.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return sendResponse(res, 400, false, null, 'Invalid end date format.', { code: 'INVALID_DATE' });
        }
        whereConditions.paymentDate.lte = new Date(end.setHours(23, 59, 59, 999));
      }
    }
    
    // Payment type filtering with tithe category support
    if (paymentType === 'TITHE') {
      whereConditions.paymentType = 'TITHE';
      if (titheCategory && titheCategory !== 'ALL') {
        whereConditions.titheDistributionSDA = {
          path: `$.${titheCategory}`,
          not: 0
        };
      }
    } else if (paymentType === 'SPECIAL_OFFERING_CONTRIBUTION') {
      whereConditions.paymentType = 'SPECIAL_OFFERING_CONTRIBUTION';
      if (specialOfferingId && specialOfferingId !== 'ALL') {
        whereConditions.specialOfferingId = parseInt(specialOfferingId);
      }
    } else if (paymentType && paymentType !== 'ALL') {
      whereConditions.paymentType = paymentType;
    }

    // Other enhanced filters
    if (userId && userId !== 'ALL') whereConditions.userId = parseInt(userId);
    if (department && department !== 'ALL') whereConditions.department = { contains: department, mode: 'insensitive' };
    if (status && status !== 'ALL') whereConditions.status = status;
    if (paymentMethod && paymentMethod !== 'ALL') whereConditions.paymentMethod = paymentMethod;

    // Enhanced search functionality
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const searchClauses = [
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { reference: { contains: searchTerm, mode: 'insensitive' } },
        { transactionId: { contains: searchTerm, mode: 'insensitive' } },
        { receiptNumber: { contains: searchTerm, mode: 'insensitive' } },
        { user: { fullName: { contains: searchTerm, mode: 'insensitive' } } },
        { user: { username: { contains: searchTerm, mode: 'insensitive' } } },
        { specialOffering: { name: { contains: searchTerm, mode: 'insensitive' } } }
      ];
      
      // Try to parse as amount
      const searchAmount = parseFloat(searchTerm);
      if (!isNaN(searchAmount)) {
        searchClauses.push({ amount: searchAmount });
      }
      
      whereConditions.OR = searchClauses;
    }

    // Validate and apply sorting
    const validSortFields = ['paymentDate', 'amount', 'status', 'createdAt', 'paymentType'];
    const validSortOrders = ['asc', 'desc'];
    
    const orderBy = {};
    if (validSortFields.includes(sortBy) && validSortOrders.includes(sortOrder.toLowerCase())) {
      orderBy[sortBy] = sortOrder.toLowerCase();
    } else {
      orderBy.paymentDate = 'desc'; // Default fallback
    }

    const [payments, totalPayments] = await Promise.all([
      prisma.payment.findMany({
        where: whereConditions,
        include: {
          user: { 
            select: { 
              id: true, 
              username: true, 
              fullName: true, 
              phone: true, 
              email: true 
            } 
          },
          specialOffering: {
            select: {
              id: true,
              name: true,
              offeringCode: true,
              description: true,
              isActive: true
            }
          },
          processor: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          },
          receipt: {
            select: {
              id: true,
              receiptNumber: true,
              receiptDate: true
            }
          }
        },
        orderBy,
        skip,
        take,
      }),
      prisma.payment.count({ where: whereConditions })
    ]);

    // Calculate summary statistics
    const summaryData = await prisma.payment.aggregate({
      where: whereConditions,
      _sum: { amount: true, platformFee: true },
      _count: { id: true }
    });

    const summary = {
      totalAmount: parseFloat((summaryData._sum.amount || 0).toString()),
      totalPlatformFees: parseFloat((summaryData._sum.platformFee || 0).toString()),
      averageAmount: summaryData._count.id > 0 ? 
        parseFloat((parseFloat((summaryData._sum.amount || 0).toString()) / summaryData._count.id).toFixed(2)) : 0
    };

    logger.info(`Retrieved ${payments.length} of ${totalPayments} payments`);
    
    return sendResponse(res, 200, true, {
      payments: payments.map(p => ({
        ...p,
        amount: parseFloat(p.amount.toString()),
        platformFee: p.platformFee ? parseFloat(p.platformFee.toString()) : 0,
        hasReceipt: !!p.receipt
      })),
      pagination: {
        totalPages: Math.ceil(totalPayments / take),
        currentPage: parseInt(page),
        totalPayments,
        hasNextPage: skip + take < totalPayments,
        hasPreviousPage: parseInt(page) > 1
      },
      summary
    }, 'Payments retrieved successfully.');

  } catch (error) {
    logger.error('Error getting all payments', { error: error.message, userId: req.user.id });
    return sendResponse(res, 500, false, null, 'Server error fetching payments.', 
      { code: 'SERVER_ERROR', details: error.message });
  }
};

// Get payments for a specific user (or the logged-in user)
exports.getUserPayments = async (req, res) => {
  try {
    await logActivity('Get User Payments attempt started');
    
    const requestingUserId = req.user.id;
    const targetUserIdParam = req.params.userId;
    const userIdToFetch = targetUserIdParam ? parseInt(targetUserIdParam) : requestingUserId;

    if (!req.user.isAdmin && requestingUserId !== userIdToFetch) {
      await logActivity(`Forbidden: User ${requestingUserId} trying to access payments for ${userIdToFetch}`);
      return sendResponse(res, 403, false, null, 'Forbidden. You can only access your own payments.', { code: 'FORBIDDEN' });
    }

    const { page = 1, limit = 10, startDate, endDate, paymentType, status, search } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const whereConditions = { userId: userIdToFetch, isTemplate: false };

    if (startDate) whereConditions.paymentDate = { ...whereConditions.paymentDate, gte: new Date(startDate) };
    if (endDate) whereConditions.paymentDate = { ...whereConditions.paymentDate, lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) };
    if (status) whereConditions.status = status;
    
    if (paymentType && paymentType !== 'ALL') {
      whereConditions.paymentType = paymentType;
    }

    if (search) {
      const searchClauses = [
        { description: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { transactionId: { contains: search, mode: 'insensitive' } },
        { receiptNumber: { contains: search, mode: 'insensitive' } },
      ];
      const searchAmount = parseFloat(search);
      if (!isNaN(searchAmount)) {
        searchClauses.push({ amount: searchAmount });
      }
      whereConditions.OR = searchClauses;
    }

    const [payments, totalPayments] = await Promise.all([
      prisma.payment.findMany({
        where: whereConditions,
        orderBy: { paymentDate: 'desc' },
        include: { specialOffering: { select: { id: true, name: true, offeringCode: true } } },
        skip,
        take,
      }),
      prisma.payment.count({ where: whereConditions })
    ]);

    await logActivity(`Retrieved ${payments.length} payments for user ${userIdToFetch}`);
    
    return sendResponse(res, 200, true, {
      payments: payments.map(p => ({
        ...p,
        amount: parseFloat(p.amount.toString())
      })),
      totalPages: Math.ceil(totalPayments / take),
      currentPage: parseInt(page),
      totalPayments,
    }, 'User payments retrieved successfully.');

  } catch (error) {
    await logActivity('Error getting user payments:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error fetching user payments.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Get payment statistics (admin only)
exports.getPaymentStats = async (req, res) => {
  try {
    await logActivity('Admin: Get Payment Stats attempt started');
    
    const commonWhere = { status: 'COMPLETED', isTemplate: false };

    const [totalRevenueResult, totalExpensesResult, platformFeesResult] = await Promise.all([
      prisma.payment.aggregate({ _sum: { amount: true }, where: { ...commonWhere, isExpense: false } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { ...commonWhere, isExpense: true } }),
      prisma.payment.aggregate({ _sum: { platformFee: true }, where: { ...commonWhere } })
    ]);

    const totalRevenue = totalRevenueResult._sum.amount || new Prisma.Decimal(0);
    const totalExpenses = totalExpensesResult._sum.amount || new Prisma.Decimal(0);
    const totalPlatformFees = platformFeesResult._sum.platformFee || new Prisma.Decimal(0);
    const netBalanceDecimal = totalRevenue.sub(totalExpenses);

    // Safe monthly data query using JavaScript processing
    const elevenMonthsAgo = new Date();
    elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);
    elevenMonthsAgo.setDate(1);
    elevenMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyPayments = await prisma.payment.findMany({
      where: {
        status: 'COMPLETED',
        isTemplate: false,
        paymentDate: { gte: elevenMonthsAgo }
      },
      select: {
        paymentDate: true,
        amount: true,
        isExpense: true
      }
    });

    // Process monthly data in JavaScript
    const monthlyDataMap = new Map();
    
    monthlyPayments.forEach(payment => {
      const monthKey = payment.paymentDate.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyDataMap.has(monthKey)) {
        monthlyDataMap.set(monthKey, { month: monthKey, revenue: 0, expenses: 0 });
      }
      
      const monthData = monthlyDataMap.get(monthKey);
      const amount = parseFloat(payment.amount.toString());
      
      if (payment.isExpense) {
        monthData.expenses += amount;
      } else {
        monthData.revenue += amount;
      }
    });

    const monthlyData = Array.from(monthlyDataMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        net: m.revenue - m.expenses
      }));
    
    const [paymentsByType, expensesByDepartment, pendingInquiries] = await Promise.all([
      prisma.payment.groupBy({
        by: ['paymentType'],
        _sum: { amount: true },
        where: { ...commonWhere, isExpense: false },
        orderBy: { _sum: { amount: 'desc' } },
      }),
      prisma.payment.groupBy({
        by: ['department'],
        _sum: { amount: true },
        where: { ...commonWhere, isExpense: true, department: { not: null } },
        orderBy: { _sum: { amount: 'desc' } },
      }),
      prisma.contactInquiry.count({ where: { status: 'PENDING' } })
    ]);

    const stats = {
      revenue: parseFloat(totalRevenue.toString()),
      expenses: parseFloat(totalExpenses.toString()),
      netBalance: parseFloat(netBalanceDecimal.toString()),
      platformFees: parseFloat(totalPlatformFees.toString()),
      monthlyData,
      paymentsByType: paymentsByType.map(p => ({ 
        type: p.paymentType, 
        total: parseFloat((p._sum.amount || 0).toString()) 
      })),
      expensesByDepartment: expensesByDepartment.map(d => ({ 
        department: d.department || "Uncategorized", 
        total: parseFloat((d._sum.amount || 0).toString()) 
      })),
      pendingInquiries,
    };

    await logActivity('Payment stats retrieved successfully');
    return sendResponse(res, 200, true, stats, 'Payment statistics retrieved successfully.');

  } catch (error) {
    await logActivity('Error getting payment stats:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error fetching payment statistics.', { code: 'SERVER_ERROR', details: error.message });
  }
};

exports.initiatePayment = async (req, res) => {
  try {
    logger.info('Initiate Payment attempt started', { userId: req.user.id });
    
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      logger.warn('Payment initiation validation errors', { errors: validationErrors.array() });
      return sendResponse(res, 400, false, null, 'Validation failed', {
        code: 'VALIDATION_ERROR',
        details: validationErrors.array().map(err => ({ field: err.path, message: err.msg })),
      });
    }

    const { 
      amount, 
      paymentType, 
      description, 
      titheDistributionSDA, 
      specialOfferingId, 
      phoneNumber,
      paymentMethod = 'KCB' // Default to KCB as preferred method
    } = req.body;
    
    const userId = req.user.id;
    const userPhoneForPayment = phoneNumber || req.user.phone;

    if (!userPhoneForPayment) {
      return sendResponse(res, 400, false, null, 'Phone number is required for mobile payment.', {code: 'PHONE_REQUIRED'});
    }

    // Enhanced phone number validation
    const phonePattern = /^(\+254|0)?[17]\d{8}$/;
    if (!phonePattern.test(userPhoneForPayment)) {
      return sendResponse(res, 400, false, null, 'Invalid Kenyan phone number format.', { code: 'INVALID_PHONE' });
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return sendResponse(res, 400, false, null, 'Invalid payment amount.', { code: 'INVALID_AMOUNT' });
    }

    // Validate payment method
    const supportedMethods = ['KCB', 'MPESA'];
    if (!supportedMethods.includes(paymentMethod.toUpperCase())) {
      return sendResponse(res, 400, false, null, 'Unsupported payment method. Supported methods: KCB (recommended), MPESA', { code: 'INVALID_PAYMENT_METHOD' });
    }

    // Calculate platform fee for MPESA
    let platformFee = 0;
    if (paymentMethod.toUpperCase() === 'MPESA') {
      platformFee = 5.00; 
      if (paymentAmount > 500) { 
        platformFee = Math.max(5.00, parseFloat((paymentAmount * 0.01).toFixed(2)));
      }
    }

    // Enhanced tithe distribution validation
    if (paymentType === 'TITHE' && titheDistributionSDA) {
      const validation = walletService.validateTitheDistribution(titheDistributionSDA, paymentAmount);
      if (!validation.valid) {
        return sendResponse(res, 400, false, null, 'Invalid tithe distribution', {
          code: 'INVALID_TITHE_DISTRIBUTION',
          details: validation.errors
        });
      }
    }

    // ATOMIC TRANSACTION: Gateway first, then database
    const result = await prisma.$transaction(async (tx) => {
      // Process special offering validation
      let processedPaymentType = paymentType;
      let processedSpecialOfferingId = specialOfferingId;
      
      if (paymentType === 'SPECIAL' && specialOfferingId) {
        processedSpecialOfferingId = parseInt(specialOfferingId);
        processedPaymentType = 'SPECIAL_OFFERING_CONTRIBUTION';
      }

      // Enhanced special offering validation
      if (processedPaymentType === 'SPECIAL_OFFERING_CONTRIBUTION') {
        if (!processedSpecialOfferingId) {
          throw new Error('Special offering ID is required for special offering contributions.');
        }
        
        const offering = await tx.specialOffering.findUnique({ 
          where: { id: processedSpecialOfferingId },
          select: { id: true, name: true, isActive: true, endDate: true }
        });
        
        if (!offering) {
          throw new Error(`Special offering with ID ${processedSpecialOfferingId} not found.`);
        }
        
        if (!offering.isActive) {
          throw new Error(`Special offering "${offering.name}" is not currently active.`);
        }

        if (offering.endDate && new Date(offering.endDate) < new Date()) {
          throw new Error(`Special offering "${offering.name}" has ended.`);
        }
      }

      // Generate payment reference with enhanced format
      const timestamp = new Date().toISOString().replace(/[-:.]/g, '').substring(0, 14);
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      const tempReference = `${paymentMethod}_${timestamp}_${randomPart}`;
      
      // CRITICAL: Initiate payment gateway FIRST
      let gatewayResponse;
      const paymentDescription = description || `${processedPaymentType} payment via ${paymentMethod}`;
      
      try {
        if (paymentMethod.toUpperCase() === 'KCB') {
          gatewayResponse = await initiateKcbMpesaStkPush(
            tempReference,
            paymentAmount,
            userPhoneForPayment,
            paymentDescription
          );
          logger.info(`KCB STK push initiated. Ref: ${gatewayResponse.reference}`);
        } else if (paymentMethod.toUpperCase() === 'MPESA') {
          gatewayResponse = await initiateMpesaPayment(
            tempReference,
            paymentAmount,
            userPhoneForPayment,
            paymentDescription
          );
          logger.info(`M-Pesa STK push initiated. Ref: ${gatewayResponse.reference}`);
        }
      } catch (gatewayError) {
        logger.error('Payment gateway error', { error: gatewayError.message, method: paymentMethod });
        throw new Error(`Payment gateway error: ${gatewayError.message}`);
      }

      // Only create payment record AFTER successful gateway response
      const paymentData = {
        userId: parseInt(userId),
        amount: Math.round(paymentAmount * 100) / 100, // Ensure 2 decimal places
        paymentType: processedPaymentType,
        paymentMethod: paymentMethod.toUpperCase(),
        description: paymentDescription,
        status: 'PENDING',
        paymentDate: new Date(),
        processedById: null,
        isExpense: false,
        platformFee: Math.round(platformFee * 100) / 100,
        isTemplate: false,
        reference: gatewayResponse.reference,
        transactionId: gatewayResponse.transactionId,
        kcbReference: paymentMethod.toUpperCase() === 'KCB' ? gatewayResponse.reference : null,
        bankDepositStatus: 'PENDING',
        specialOfferingId: processedSpecialOfferingId || null,
        titheDistributionSDA: titheDistributionSDA || null
      };

      const payment = await tx.payment.create({ data: paymentData });
      logger.info('Payment record created after successful gateway response', { paymentId: payment.id });
      
      return { payment, gatewayResponse };
    }, {
      maxWait: 20000, // 20 seconds
      timeout: 60000, // 60 seconds
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
    });

    await logAdminActivity('INITIATE_PAYMENT', result.payment.id, userId, {
      amount: paymentAmount,
      method: paymentMethod,
      type: result.payment.paymentType,
      reference: result.gatewayResponse.reference
    });

    return sendResponse(res, 200, true,
      { 
        paymentId: result.payment.id, 
        checkoutRequestId: result.gatewayResponse.reference,
        paymentMethod: paymentMethod.toUpperCase(),
        amount: paymentAmount,
        platformFee: platformFee
      },
      result.gatewayResponse.message || `${paymentMethod} payment initiated. Check your phone.`
    );
    
  } catch (error) {
    logger.error('Error in initiatePayment controller', { error: error.message, userId: req.user.id });
    
    if (error.message.includes('Special offering') && error.message.includes('not available')) {
      return sendResponse(res, 400, false, null, error.message, { code: 'OFFERING_NOT_AVAILABLE' });
    }
    
    return sendResponse(res, 500, false, null, error.message || `Failed to initiate ${req.body.paymentMethod || 'payment'}.`, {
      code: 'PAYMENT_INIT_ERROR',
      details: error.message,
    });
  }
};

// Legacy method for backward compatibility
exports.initiateMpesaPayment = exports.initiatePayment;

// Get payment status
exports.getPaymentStatus = async (req, res) => {
  try {
    await logActivity('Get Payment Status attempt started');
    
    const { paymentId } = req.params;
    const numericPaymentId = parseInt(paymentId);

    if (isNaN(numericPaymentId)) {
      return sendResponse(res, 400, false, null, 'Invalid Payment ID format.', { code: 'INVALID_PAYMENT_ID' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: numericPaymentId },
      select: {
        id: true,
        status: true,
        amount: true,
        paymentType: true,
        paymentMethod: true,
        description: true,
        paymentDate: true,
        reference: true,
        transactionId: true,
        receiptNumber: true,
        userId: true
      }
    });

    if (!payment) {
      return sendResponse(res, 404, false, null, 'Payment not found.', { code: 'PAYMENT_NOT_FOUND' });
    }

    if (!req.user.isAdmin && payment.userId !== req.user.id) {
      return sendResponse(res, 403, false, null, 'Forbidden. You can only check your own payment status.', { code: 'FORBIDDEN' });
    }

    await logActivity(`Payment status retrieved for payment ${numericPaymentId}: ${payment.status}`);
    return sendResponse(res, 200, true, {
      ...payment,
      amount: parseFloat(payment.amount.toString())
    }, 'Payment status retrieved successfully.');

  } catch (error) {
    await logActivity('Error getting payment status:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error fetching payment status.', { code: 'SERVER_ERROR', details: error.message });
  }
};

/**
 * Add manual payment with automatic wallet updates and enhanced validation
 */
exports.addManualPayment = async (req, res) => {
  try {
    logger.info('Admin: Add Manual Payment attempt started', { userId: req.user.id });
    
    if (isViewOnlyAdmin(req.user)) {
      logger.warn(`View-only admin ${req.user.username} attempted to add payments.`);
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot add payments.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }
    
    // Enhanced validation for request body
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      logger.warn('Manual payment validation errors', { errors: validationErrors.array() });
      return sendResponse(res, 400, false, null, 'Validation failed', {
        code: 'VALIDATION_ERROR',
        details: validationErrors.array().map(err => ({ field: err.path, message: err.msg })),
      });
    }

    const {
      userId, amount, paymentType, description, paymentDate,
      department, isExpense = false, titheDistributionSDA, specialOfferingId,
      paymentMethod = 'MANUAL', expenseReceiptUrl, reference,
    } = req.body;
    
    // Enhanced payment type processing
    let processedPaymentType = paymentType;
    let processedSpecialOfferingId = specialOfferingId;
    
    // Handle special offering ID conversion from frontend
    if (paymentType.startsWith('SPECIAL_OFFERING_') || /^\d+$/.test(paymentType)) {
      if (paymentType.startsWith('SPECIAL_OFFERING_')) {
        processedSpecialOfferingId = parseInt(paymentType.replace('SPECIAL_OFFERING_', ''));
      } else {
        processedSpecialOfferingId = parseInt(paymentType);
      }
      processedPaymentType = 'SPECIAL_OFFERING_CONTRIBUTION';
    }
    
    const processedByAdminId = req.user.id;
    const paymentAmount = parseFloat(amount);
    
    // Enhanced validation
    if (!userId || isNaN(paymentAmount) || paymentAmount <= 0 || !paymentType) {
      return sendResponse(res, 400, false, null, 'Missing or invalid required fields: userId, amount, paymentType.', { code: 'MISSING_INVALID_FIELDS' });
    }

    // Validate tithe distribution with enhanced logic
    if (processedPaymentType === 'TITHE' && titheDistributionSDA) {
      const validation = walletService.validateTitheDistribution(titheDistributionSDA, paymentAmount);
      if (!validation.valid) {
        return sendResponse(res, 400, false, null, 'Invalid tithe distribution', {
          code: 'INVALID_TITHE_DISTRIBUTION',
          details: validation.errors
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Validate user exists and is active
      const user = await tx.user.findUnique({ 
        where: { id: parseInt(userId) },
        select: { id: true, fullName: true, phone: true, email: true, isActive: true }
      });
      
      if (!user) {
        throw new Error('User not found.');
      }
      
      if (!user.isActive) {
        throw new Error('Cannot create payment for inactive user.');
      }

      // Prepare payment data with enhanced structure
      let paymentData = {
        userId: parseInt(userId),
        amount: Math.round(paymentAmount * 100) / 100, // Ensure 2 decimal places
        paymentType: processedPaymentType,
        paymentMethod,
        description: description || `${processedPaymentType} (${paymentMethod})`,
        status: 'COMPLETED',
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        processedById: processedByAdminId,
        isExpense: !!isExpense,
        platformFee: 0,
        isTemplate: false,
        reference: reference || null
      };

      // Handle special offering payments with validation
      if (processedPaymentType === 'SPECIAL_OFFERING_CONTRIBUTION' && processedSpecialOfferingId) {
        const offering = await tx.specialOffering.findUnique({ 
          where: { id: processedSpecialOfferingId },
          select: { id: true, name: true, isActive: true, endDate: true }
        });
        
        if (!offering) {
          throw new Error('Selected special offering not found.');
        }
        
        if (!offering.isActive) {
          throw new Error('Selected special offering is not active.');
        }
        
        if (offering.endDate && new Date(offering.endDate) < new Date()) {
          throw new Error('Selected special offering has ended.');
        }
        
        paymentData.specialOfferingId = offering.id;
        paymentData.description = description || `Contribution to ${offering.name}`;
      }

      // Store tithe distribution with validation
      if (processedPaymentType === 'TITHE' && titheDistributionSDA) {
        paymentData.titheDistributionSDA = titheDistributionSDA;
      }

      // Handle expense-specific fields
      if (isExpense) {
        if (!department) {
          throw new Error('Department is required for expenses.');
        }
        paymentData.department = department;
        if (expenseReceiptUrl) {
          paymentData.expenseReceiptUrl = expenseReceiptUrl;
        }
      }

      // Create payment record
      const createdPayment = await tx.payment.create({ 
        data: paymentData,
        include: { 
          user: { select: { fullName: true, phone: true, email: true } },
          specialOffering: { select: { name: true, offeringCode: true } }
        } 
      });

      // 🚀 AUTOMATICALLY UPDATE WALLETS FOR NON-EXPENSE COMPLETED PAYMENTS
      if (!createdPayment.isExpense && createdPayment.status === 'COMPLETED') {
        try {
          await walletService.updateWalletsForPayment(createdPayment.id, tx);
          logger.info(`✅ Wallets updated for manual payment ${createdPayment.id}`);
        } catch (walletError) {
          logger.error(`Wallet update failed for payment ${createdPayment.id}`, { error: walletError.message });
          throw new Error(`Payment created but wallet update failed: ${walletError.message}`);
        }
      }

      // Generate receipt for non-expense completed payments
      if (!createdPayment.isExpense && createdPayment.status === 'COMPLETED') {
        const receiptNumber = generateReceiptNumber(createdPayment.paymentType);
        
        await tx.receipt.create({
          data: {
            receiptNumber: receiptNumber,
            paymentId: createdPayment.id,
            userId: createdPayment.userId,
            generatedById: createdPayment.processedById,
            receiptDate: new Date(),
            receiptData: {
              paymentId: createdPayment.id, 
              amount: parseFloat(createdPayment.amount.toString()), 
              paymentType: createdPayment.paymentType,
              userName: user.fullName, 
              paymentDate: createdPayment.paymentDate,
              description: createdPayment.description,
              titheDesignations: createdPayment.paymentType === 'TITHE' ? createdPayment.titheDistributionSDA : null,
              specialOffering: createdPayment.specialOffering
            },
          }
        });
        
        // Update payment with receipt number
        await tx.payment.update({ 
          where: { id: createdPayment.id }, 
          data: { receiptNumber }
        });
        
        // Update the local object for response
        createdPayment.receiptNumber = receiptNumber;
      }

      return createdPayment;
    }, {
      maxWait: 15000,
      timeout: 45000,
    });

    await logAdminActivity(isExpense ? 'ADMIN_ADD_EXPENSE' : 'ADMIN_ADD_MANUAL_PAYMENT', result.id, req.user.id, { 
      amount: parseFloat(result.amount.toString()), 
      type: result.paymentType, 
      userId: result.userId,
      hasWalletUpdate: !result.isExpense
    });

    logger.info('Manual payment created successfully', {
      paymentId: result.id,
      amount: parseFloat(result.amount.toString()),
      type: result.paymentType,
      hasWalletUpdate: !result.isExpense
    });
    
    return sendResponse(res, 201, true, { 
      payment: {
        ...result,
        amount: parseFloat(result.amount.toString())
      }
    }, `Manual payment added successfully${!result.isExpense ? ' and wallets updated' : ''}.`);

  } catch (error) {
    logger.error('Error adding manual payment', { error: error.message, userId: req.user.id });
    return sendResponse(res, 500, false, null, error.message || 'Failed to add manual payment.', {
      code: 'MANUAL_PAYMENT_ERROR',
      details: error.message,
    });
  }
};

exports.kcbCallback = async (req, res) => {
  logger.info('KCB Callback received', { body: JSON.stringify(req.body, null, 2) });
  
  const callbackData = req.body;

  if (!callbackData || !callbackData.transactionReference) {
    logger.warn('Invalid KCB callback structure.');
    return res.status(400).json({ status: 'error', message: 'Invalid callback data' });
  }

  const { transactionReference, resultCode, resultDescription, transactionId, transactionDate } = callbackData;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: {
          OR: [
            { reference: transactionReference },
            { transactionId: transactionId }
          ],
          status: 'PENDING',
          paymentMethod: 'KCB'
        },
        include: { 
          user: { select: { fullName: true, phone: true } },
          specialOffering: { select: { name: true, offeringCode: true } }
        }
      });

      if (!payment) {
        logger.warn(`No matching PENDING KCB payment found for reference: ${transactionReference} or transactionId: ${transactionId}.`);
        return { alreadyProcessedOrNotFound: true };
      }

      logger.info(`Processing KCB callback for payment ID: ${payment.id}`);

      if (String(resultCode) === "0" || String(resultCode) === "00") {
        // Successful payment
        const internalReceiptNumber = generateReceiptNumber(payment.paymentType);
        const parsedTransactionDate = transactionDate ? new Date(transactionDate) : payment.paymentDate;
        
        // ATOMIC UPDATE: Update payment status
        const updatedPayment = await tx.payment.update({ 
          where: { id: payment.id }, 
          data: {
            status: 'COMPLETED',
            transactionId: transactionId || payment.transactionId,
            receiptNumber: internalReceiptNumber,
            paymentDate: parsedTransactionDate,
            kcbTransactionId: transactionId,
            kcbReference: transactionReference,
            bankDepositStatus: 'DEPOSITED',
          }
        });

        // 🚀 AUTOMATICALLY UPDATE WALLETS
        try {
          await walletService.updateWalletsForPayment(payment.id, tx);
          logger.info(`✅ Wallets updated for completed KCB payment ${payment.id}`);
        } catch (walletError) {
          logger.error('Wallet update failed for KCB payment', { 
            error: walletError.message, 
            paymentId: payment.id 
          });
          // Don't fail the entire transaction, but log the error
        }

        // Create receipt atomically
        if (payment.user) {
          await tx.receipt.create({
            data: {
              receiptNumber: internalReceiptNumber,
              paymentId: payment.id,
              userId: payment.userId,
              generatedById: null,
              receiptDate: new Date(),
              receiptData: {
                paymentId: payment.id, 
                amount: parseFloat(payment.amount.toString()), 
                paymentType: payment.paymentType,
                userName: payment.user.fullName, 
                paymentDate: parsedTransactionDate,
                description: payment.description, 
                kcbTransactionId: transactionId,
                titheDesignations: payment.paymentType === 'TITHE' ? payment.titheDistributionSDA : null,
                specialOffering: payment.specialOffering
              },
            },
          });
          
          logger.info(`Payment ${payment.id} COMPLETED. KCB Transaction: ${transactionId}. Internal Receipt: ${internalReceiptNumber}`);

          // Send SMS notification (non-blocking)
          if (payment.user.phone) {
            setImmediate(async () => {
              try {
                await sendSmsNotification(
                  payment.user.phone,
                  `Dear ${payment.user.fullName}, your KCB payment of KES ${parseFloat(payment.amount.toString()).toFixed(2)} for ${payment.paymentType} was successful. Receipt No: ${internalReceiptNumber}. Thank you.`
                );
                logger.info(`SMS notification sent for payment ${payment.id}`);
              } catch (smsError) {
                logger.warn(`SMS notification failed for payment ${payment.id}`, { error: smsError.message });
              }
            });
          }
        }
        
        return { success: true, paymentId: payment.id };
      } else {
        // Failed payment
        await tx.payment.update({ 
          where: { id: payment.id }, 
          data: {
            status: 'FAILED',
            description: `${payment.description || ''} (KCB Callback Failed: ${resultDescription})`.substring(0, 191),
            kcbTransactionId: transactionId,
            kcbReference: transactionReference,
          }
        });
        
        logger.info(`Payment ${payment.id} FAILED. Reason: ${resultDescription}`);
        return { success: false, reason: resultDescription, paymentId: payment.id };
      }
    }, {
      maxWait: 15000,
      timeout: 45000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
    
  } catch (error) {
    logger.error('Critical error in KCB callback processing', { error: error.message });
  }
  
  return res.status(200).json({ status: 'success', message: 'Callback received and processed.' });
};

/**
 * Enhanced M-Pesa callback with automatic wallet updates
 */
exports.mpesaCallback = async (req, res) => {
  logger.info('M-Pesa Callback received', { body: JSON.stringify(req.body, null, 2) });
  
  const callbackData = req.body.Body?.stkCallback;

  if (!callbackData) {
    logger.warn('Invalid M-Pesa callback structure.');
    return res.status(400).json({ ResultCode: 1, ResultDesc: 'Invalid callback data' });
  }

  const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callbackData;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: {
          OR: [
            { reference: CheckoutRequestID },
            { transactionId: MerchantRequestID }
          ],
          status: 'PENDING',
          paymentMethod: 'MPESA'
        },
        include: { 
          user: { select: { fullName: true, phone: true } },
          specialOffering: { select: { name: true, offeringCode: true } }
        }
      });

      if (!payment) {
        logger.warn(`No matching PENDING M-Pesa payment found for CheckoutRequestID: ${CheckoutRequestID} or MerchantRequestID: ${MerchantRequestID}.`);
        return { alreadyProcessedOrNotFound: true };
      }

      logger.info(`Processing M-Pesa callback for payment ID: ${payment.id}`);

      if (String(ResultCode) === "0") {
        // Successful payment
        const metadataItems = CallbackMetadata?.Item;
        let mpesaReceiptNumber = null;
        let transactionDate = payment.paymentDate; 

        if (metadataItems && Array.isArray(metadataItems)) {
          mpesaReceiptNumber = metadataItems.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
          const mpesaTransactionDateStr = metadataItems.find(item => item.Name === 'TransactionDate')?.Value;
          if (mpesaTransactionDateStr) {
            try { 
              const year = mpesaTransactionDateStr.substring(0, 4);
              const month = mpesaTransactionDateStr.substring(4, 6);
              const day = mpesaTransactionDateStr.substring(6, 8);
              const hour = mpesaTransactionDateStr.substring(8, 10);
              const minute = mpesaTransactionDateStr.substring(10, 12);
              const second = mpesaTransactionDateStr.substring(12, 14);
              transactionDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
            } catch (e) { 
              logger.warn("Error parsing M-Pesa transaction date from callback", { error: e.message }); 
            }
          }
        }

        const internalReceiptNumber = generateReceiptNumber(payment.paymentType);
        
        // ATOMIC UPDATE: Update payment status
        const updatedPayment = await tx.payment.update({ 
          where: { id: payment.id }, 
          data: {
            status: 'COMPLETED',
            transactionId: mpesaReceiptNumber || payment.transactionId,
            receiptNumber: internalReceiptNumber,
            paymentDate: transactionDate,
          }
        });

        // 🚀 AUTOMATICALLY UPDATE WALLETS
        try {
          await walletService.updateWalletsForPayment(payment.id, tx);
          logger.info(`✅ Wallets updated for completed M-Pesa payment ${payment.id}`);
        } catch (walletError) {
          logger.error('Wallet update failed for M-Pesa payment', {
            error: walletError.message,
            paymentId: payment.id
          });
        }

        // Create receipt atomically
        if (payment.user) {
          await tx.receipt.create({
            data: {
              receiptNumber: internalReceiptNumber,
              paymentId: payment.id,
              userId: payment.userId,
              generatedById: null,
              receiptDate: new Date(),
              receiptData: {
                paymentId: payment.id, 
                amount: parseFloat(payment.amount.toString()), 
                paymentType: payment.paymentType,
                userName: payment.user.fullName, 
                paymentDate: transactionDate,
                description: payment.description, 
                mpesaReceipt: mpesaReceiptNumber,
                titheDesignations: payment.paymentType === 'TITHE' ? payment.titheDistributionSDA : null,
                specialOffering: payment.specialOffering
              },
            },
          });
          
          logger.info(`Payment ${payment.id} COMPLETED. M-Pesa Receipt: ${mpesaReceiptNumber}. Internal Receipt: ${internalReceiptNumber}`);

          // Send SMS notification (non-blocking)
          if (payment.user.phone) {
            setImmediate(async () => {
              try {
                await sendSmsNotification(
                  payment.user.phone,
                  `Dear ${payment.user.fullName}, your M-Pesa payment of KES ${parseFloat(payment.amount.toString()).toFixed(2)} for ${payment.paymentType} was successful. Receipt No: ${internalReceiptNumber}. Thank you.`
                );
                logger.info(`SMS notification sent for payment ${payment.id}`);
              } catch (smsError) {
                logger.warn(`SMS notification failed for payment ${payment.id}`, { error: smsError.message });
              }
            });
          }
        }
        
        return { success: true, paymentId: payment.id };
      } else {
        // Failed payment
        await tx.payment.update({ 
          where: { id: payment.id }, 
          data: {
            status: 'FAILED',
            description: `${payment.description || ''} (M-Pesa Callback Failed: ${ResultDesc})`.substring(0, 191),
          }
        });
        
        logger.info(`Payment ${payment.id} FAILED. Reason: ${ResultDesc}`);
        return { success: false, reason: ResultDesc, paymentId: payment.id };
      }
    }, {
      maxWait: 15000,
      timeout: 45000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
    
  } catch (error) {
    logger.error('Critical error in M-Pesa callback processing', { error: error.message });
  }
  
  return res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback received and processed.' });
};

// Add new payment items to an existing batch
exports.addItemsToBatch = async (req, res) => {
  const { batchId } = req.params;
  const { payments } = req.body;

  if (!payments || !Array.isArray(payments) || payments.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No payment items provided to add to the batch.',
    });
  }

  try {
    const batch = await prisma.batchPayment.findUnique({
      where: { id: parseInt(batchId) },
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found.',
      });
    }

    if (batch.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot add items to a batch with status "${batch.status}". Only PENDING batches can be modified.`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const createdPayments = [];
      let totalNewAmount = 0;

      for (const item of payments) {
        // Validate payment data
        if (!item.userId || !item.amount || !item.paymentType) {
          throw new Error('Invalid payment data: userId, amount, and paymentType are required');
        }

        const paymentData = {
          userId: parseInt(item.userId),
          amount: parseFloat(item.amount),
          paymentType: item.paymentType,
          paymentMethod: 'BATCH_KCB',
          description: item.description || '',
          status: 'PENDING',
          paymentDate: item.paymentDate ? new Date(item.paymentDate) : new Date(),
          processedById: req.user.id,
          batchPaymentId: parseInt(batchId),
          isBatchProcessed: false,
          bankDepositStatus: 'PENDING',
          isExpense: !!item.isExpense,
          department: item.department || null,
          specialOfferingId: item.specialOfferingId || null,
          titheDistributionSDA: item.titheDistributionSDA || null,
        };

        const createdPayment = await tx.payment.create({ data: paymentData });
        createdPayments.push(createdPayment);
        totalNewAmount += parseFloat(item.amount);
      }

      // Update batch totals
      const updatedBatch = await tx.batchPayment.update({
        where: { id: parseInt(batchId) },
        data: {
          totalAmount: { increment: totalNewAmount },
          totalCount: { increment: createdPayments.length }
        },
      });

      return { createdPayments, updatedBatch, totalNewAmount };
    });

    await logAdminActivity('ADD_BATCH_ITEMS', parseInt(batchId), req.user.id, {
      itemsAdded: result.createdPayments.length,
      addedAmount: result.totalNewAmount,
      batchReference: batch.batchReference
    });

    res.status(200).json({
      success: true,
      message: `${result.createdPayments.length} items added to batch successfully.`,
      data: {
        batchPayment: {
          ...result.updatedBatch,
          totalAmount: parseFloat(result.updatedBatch.totalAmount.toString())
        },
        addedPayments: result.createdPayments.length,
        addedAmount: result.totalNewAmount
      },
    });

  } catch (error) {
    console.error('Error adding items to batch:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while adding items to batch.',
      error: error.message,
    });
  }
};

// Update payment status (admin only)
exports.updatePaymentStatus = async (req, res) => {
  try {
    logger.info('Admin: Update Payment Status attempt started', { userId: req.user.id });
    
    if (isViewOnlyAdmin(req.user)) {
      logger.warn(`View-only admin ${req.user.username} attempted to update payment status.`);
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot update payment statuses.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const { paymentId } = req.params;
    const { status } = req.body;
    const numericPaymentId = parseInt(paymentId);

    if (isNaN(numericPaymentId)) {
      return sendResponse(res, 400, false, null, 'Invalid Payment ID format.', { code: 'INVALID_PAYMENT_ID' });
    }

    const validStatuses = ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'];
    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return sendResponse(res, 400, false, null, `Invalid status. Must be one of: ${validStatuses.join(', ')}.`, { code: 'INVALID_STATUS' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ 
        where: { id: numericPaymentId },
        include: { 
          specialOffering: { select: { name: true, offeringCode: true } },
          user: { select: { fullName: true } }
        }
      });
      
      if (!payment) {
        throw new Error('Payment not found.');
      }

      const oldStatus = payment.status;
      const newStatus = status.toUpperCase();

      // Prevent certain status transitions
      if (oldStatus === 'COMPLETED' && ['PENDING', 'FAILED'].includes(newStatus)) {
        throw new Error('Cannot change status from COMPLETED to PENDING or FAILED. Use REFUNDED if needed.');
      }

      const updatedPayment = await tx.payment.update({
        where: { id: numericPaymentId },
        data: { 
          status: newStatus,
          updatedAt: new Date()
        },
      });

      // Handle wallet updates when status changes to COMPLETED
      if (oldStatus !== 'COMPLETED' && newStatus === 'COMPLETED' && !payment.isExpense) {
        try {
          await walletService.updateWalletsForPayment(numericPaymentId, tx);
          logger.info(`✅ Wallets updated for payment ${numericPaymentId} status change to COMPLETED`);
        } catch (walletError) {
          logger.error('Wallet update failed', { error: walletError.message, paymentId: numericPaymentId });
          throw new Error(`Status updated but wallet update failed: ${walletError.message}`);
        }
      }

      // Generate receipt if payment is now completed and doesn't have one
      if (newStatus === 'COMPLETED' && !payment.receiptNumber && !payment.isExpense) {
        const receiptNumber = generateReceiptNumber(payment.paymentType);
        
        await tx.receipt.create({
          data: {
            receiptNumber,
            paymentId: payment.id,
            userId: payment.userId,
            generatedById: req.user.id,
            receiptDate: new Date(),
            receiptData: {
              paymentId: payment.id,
              amount: parseFloat(payment.amount.toString()),
              paymentType: payment.paymentType,
              userName: payment.user.fullName,
              paymentDate: payment.paymentDate,
              description: payment.description,
              titheDesignations: payment.paymentType === 'TITHE' ? payment.titheDistributionSDA : null,
              specialOffering: payment.specialOffering
            },
          }
        });
        
        await tx.payment.update({
          where: { id: numericPaymentId },
          data: { receiptNumber }
        });
        
        updatedPayment.receiptNumber = receiptNumber;
      }

      return { payment, updatedPayment };
    });

    await logAdminActivity('ADMIN_UPDATE_PAYMENT_STATUS', result.updatedPayment.id, req.user.id, { 
      oldStatus: result.payment.status, 
      newStatus: result.updatedPayment.status 
    });
    
    logger.info(`Payment ${numericPaymentId} status updated to ${status.toUpperCase()} by admin ${req.user.username}`);
    
    return sendResponse(res, 200, true, { 
      payment: {
        ...result.updatedPayment,
        amount: parseFloat(result.updatedPayment.amount.toString())
      }
    }, 'Payment status updated successfully.');

  } catch (error) {
    logger.error('Error updating payment status', { 
      error: error.message, 
      paymentId: req.params.paymentId,
      userId: req.user.id 
    });
    return sendResponse(res, 500, false, null, error.message || 'Server error updating payment status.', { 
      code: 'SERVER_ERROR', 
      details: error.message 
    });
  }
};
// Delete payment (admin only)
exports.deletePayment = async (req, res) => {
  try {
    await logActivity('Admin: Delete Payment attempt started');
    
    const { paymentId } = req.params;
    const numericPaymentId = parseInt(paymentId);

    if (isNaN(numericPaymentId)) {
      return sendResponse(res, 400, false, null, 'Invalid Payment ID format.', { code: 'INVALID_PAYMENT_ID' });
    }

    if (isViewOnlyAdmin(req.user)) {
      await logActivity(`View-only admin ${req.user.username} attempted to delete payment.`);
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot delete payments.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }
    
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: numericPaymentId } });
      if (!payment) {
        throw new Error('Payment not found.');
      }

      await tx.receipt.deleteMany({ where: { paymentId: numericPaymentId } });
      await tx.payment.delete({ where: { id: numericPaymentId } });
      
      return payment;
    });

    await logAdminActivity('ADMIN_DELETE_PAYMENT', numericPaymentId, req.user.id, { 
      amount: parseFloat(result.amount.toString()), 
      type: result.paymentType 
    });

    await logActivity(`Payment ${numericPaymentId} and associated receipts deleted.`);
    return sendResponse(res, 200, true, { paymentId: numericPaymentId }, 'Payment and associated receipts deleted successfully.');
    
  } catch (error) {
    await logActivity('Error deleting payment:', error.message);
    console.error(error);
    
    if (error.message === 'Payment not found.' || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')) {
      return sendResponse(res, 404, false, null, 'Payment not found.', {code: 'PAYMENT_NOT_FOUND'});
    }
    
    return sendResponse(res, 500, false, null, 'Server error deleting payment.', { code: 'SERVER_ERROR', details: error.message });
  }
};

module.exports = exports;