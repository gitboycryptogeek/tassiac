// server/controllers/paymentController.js
const { PrismaClient, Prisma } = require('@prisma/client');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const { generateReceiptNumber } = require('../utils/receiptUtils.js');
const { sendSmsNotification } = require('../utils/notificationUtils.js');
const { initiateMpesaPayment } = require('../utils/paymentUtils.js');
const { initiateKcbPayment } = require('../utils/kcbPaymentUtils.js'); // KCB payment utility

const prisma = new PrismaClient();

// Setup debug log file
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOG_DIR, 'payment-controller-debug.log');

function debugLog(message, data = null) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] PAYMENT_CTRL: ${message}`;
  if (data !== null) {
    try {
      const dataStr = JSON.stringify(data);
      logMessage += ` | Data: ${dataStr}`;
    } catch (err) {
      logMessage += ` | Data: [Failed to stringify: ${err.message}]`;
    }
  }
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
  return logMessage;
}

// Helper for sending standardized responses
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

// Helper to check for view-only admin
const isViewOnlyAdmin = (user) => {
  if (!user || !user.isAdmin) return false;
  const viewOnlyUsernames = ['admin3', 'admin4', 'admin5'];
  return viewOnlyUsernames.includes(user.username);
};

// Log Admin Activity
async function logAdminActivity(actionType, targetId, initiatedBy, actionData = {}) {
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
    debugLog(`Admin activity logged: ${actionType} for target ${targetId} by user ${initiatedBy}`);
  } catch (error) {
    debugLog(`Error logging admin activity for ${actionType} on ${targetId}:`, error.message);
  }
}

// Get all payments (admin only)
exports.getAllPayments = async (req, res) => {
  debugLog('Admin: Get All Payments attempt started');
  try {
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
      titheCategory
    } = req.query;

    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const whereConditions = { isTemplate: false };

    // Basic date filters
    if (startDate || endDate) {
      whereConditions.paymentDate = {};
      if (startDate) whereConditions.paymentDate.gte = new Date(startDate);
      if (endDate) whereConditions.paymentDate.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }
    
    // Enhanced payment type filtering
    if (paymentType === 'TITHE') {
      whereConditions.paymentType = 'TITHE';
      if (titheCategory) {
        whereConditions.titheDistributionSDA = {
          path: `$.${titheCategory}`,
          equals: true
        };
      }
    } else if (paymentType === 'SPECIAL_OFFERING_CONTRIBUTION') {
      whereConditions.paymentType = 'SPECIAL_OFFERING_CONTRIBUTION';
      if (specialOfferingId) {
        whereConditions.specialOfferingId = parseInt(specialOfferingId);
      }
    } else if (paymentType) {
      whereConditions.paymentType = paymentType;
    }

    // Other filters
    if (userId) whereConditions.userId = parseInt(userId);
    if (department) whereConditions.department = { contains: department, mode: 'insensitive' };
    if (status) whereConditions.status = status;

    // Enhanced search functionality
    if (search) {
      const searchClauses = [
        { description: { contains: search } },
        { reference: { contains: search } },
        { transactionId: { contains: search } },
        { receiptNumber: { contains: search } },
        { user: { fullName: { contains: search } } },
        { user: { username: { contains: search } } },
        { specialOffering: { name: { contains: search } } }
      ];
      
      const searchAmount = parseFloat(search);
      if (!isNaN(searchAmount)) {
        searchClauses.push({ amount: searchAmount });
      }
      
      whereConditions.OR = searchClauses;
    }

    const payments = await prisma.payment.findMany({
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
            description: true
          }
        },
        processor: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        }
      },
      orderBy: { paymentDate: 'desc' },
      skip,
      take,
    });

    const totalPayments = await prisma.payment.count({ where: whereConditions });

    debugLog(`Admin: Retrieved ${payments.length} of ${totalPayments} payments.`);
    return sendResponse(res, 200, true, {
      payments: payments.map(p => ({
        ...p,
        amount: parseFloat(p.amount.toString()),
        platformFee: p.platformFee ? parseFloat(p.platformFee.toString()) : 0
      })),
      totalPages: Math.ceil(totalPayments / take),
      currentPage: parseInt(page),
      totalPayments,
    }, 'Payments retrieved successfully.');

  } catch (error) {
    debugLog('Admin: Error getting all payments:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error fetching payments.', 
      { code: 'SERVER_ERROR', details: error.message });
  }
};

// Get payments for a specific user (or the logged-in user)
exports.getUserPayments = async (req, res) => {
  debugLog('Get User Payments attempt started');
  try {
    const requestingUserId = req.user.id;
    const targetUserIdParam = req.params.userId;
    const userIdToFetch = targetUserIdParam ? parseInt(targetUserIdParam) : requestingUserId;

    if (!req.user.isAdmin && requestingUserId !== userIdToFetch) {
      debugLog(`Forbidden: User ${requestingUserId} trying to access payments for ${userIdToFetch}`);
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
        { description: { contains: search } },
        { reference: { contains: search } },
        { transactionId: { contains: search } },
        { receiptNumber: { contains: search } },
      ];
      const searchAmount = parseFloat(search);
      if (!isNaN(searchAmount)) {
        searchClauses.push({ amount: searchAmount });
      }
       if (whereConditions.OR) {
        whereConditions.AND = [ {OR: whereConditions.OR }, {OR: searchClauses}];
        delete whereConditions.OR;
      } else {
        whereConditions.OR = searchClauses;
      }
    }

    const payments = await prisma.payment.findMany({
      where: whereConditions,
      orderBy: { paymentDate: 'desc' },
      include: { specialOffering: { select: { id: true, name: true, offeringCode: true } } },
      skip,
      take,
    });
    const totalPayments = await prisma.payment.count({ where: whereConditions });

    debugLog(`Retrieved ${payments.length} payments for user ${userIdToFetch}.`);
    return sendResponse(res, 200, true, {
      payments,
      totalPages: Math.ceil(totalPayments / take),
      currentPage: parseInt(page),
      totalPayments,
    }, 'User payments retrieved successfully.');

  } catch (error) {
    debugLog('Error getting user payments:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error fetching user payments.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Get payment statistics (admin only)
exports.getPaymentStats = async (req, res) => {
  debugLog('Admin: Get Payment Stats attempt started');
  try {
    const commonWhere = { status: 'COMPLETED', isTemplate: false };

    const totalRevenueResult = await prisma.payment.aggregate({ _sum: { amount: true }, where: { ...commonWhere, isExpense: false } });
    const totalExpensesResult = await prisma.payment.aggregate({ _sum: { amount: true }, where: { ...commonWhere, isExpense: true } });
    const platformFeesResult = await prisma.payment.aggregate({ _sum: { platformFee: true }, where: { ...commonWhere } });

    const totalRevenue = totalRevenueResult._sum.amount || new Prisma.Decimal(0);
    const totalExpenses = totalExpensesResult._sum.amount || new Prisma.Decimal(0);
    const totalPlatformFees = platformFeesResult._sum.platformFee || new Prisma.Decimal(0);

    // Correct way to subtract Prisma Decimals
    const netBalanceDecimal = totalRevenue.sub(totalExpenses);

    let monthlyData;
    const isPostgres = prisma._engineConfig?.activeProvider === 'postgresql';

    if (isPostgres) {
        monthlyData = await prisma.$queryRaw`
            SELECT
              TO_CHAR("paymentDate", 'YYYY-MM') as month,
              SUM(CASE WHEN "isExpense" = FALSE THEN amount ELSE 0 END) as revenue,
              SUM(CASE WHEN "isExpense" = TRUE THEN amount ELSE 0 END) as expenses
            FROM "Payments"
            WHERE status = 'COMPLETED' AND "isTemplate" = FALSE
              AND "paymentDate" >= date_trunc('month', NOW() - INTERVAL '11 months')
            GROUP BY month
            ORDER BY month ASC;
        `;
    } else { // SQLite
        monthlyData = await prisma.$queryRaw`
            SELECT
              strftime('%Y-%m', "paymentDate") as month,
              SUM(CASE WHEN "isExpense" = 0 THEN amount ELSE 0 END) as revenue,
              SUM(CASE WHEN "isExpense" = 1 THEN amount ELSE 0 END) as expenses
            FROM "Payments"
            WHERE status = 'COMPLETED' AND "isTemplate" = 0
              AND "paymentDate" >= date('now', '-12 months')
            GROUP BY month
            ORDER BY month ASC;
        `;
    }
    
    const paymentsByType = await prisma.payment.groupBy({
      by: ['paymentType'],
      _sum: { amount: true },
      where: { ...commonWhere, isExpense: false },
      orderBy: { _sum: { amount: 'desc' } },
    });

    const expensesByDepartment = await prisma.payment.groupBy({
      by: ['department'],
      _sum: { amount: true },
      where: { ...commonWhere, isExpense: true, department: { not: null } },
      orderBy: { _sum: { amount: 'desc' } },
    });
    
    const pendingInquiries = await prisma.contactInquiry.count({ where: { status: 'PENDING' }});

    const stats = {
      revenue: parseFloat(totalRevenue.toString()),
      expenses: parseFloat(totalExpenses.toString()),
      netBalance: parseFloat(netBalanceDecimal.toString()),
      platformFees: parseFloat(totalPlatformFees.toString()),
      monthlyData: monthlyData.map(m => ({...m, revenue: Number(m.revenue || 0), expenses: Number(m.expenses || 0), net: Number(m.revenue || 0) - Number(m.expenses || 0) })),
      paymentsByType: paymentsByType.map(p => ({ type: p.paymentType, total: parseFloat((p._sum.amount || 0).toString()) })),
      expensesByDepartment: expensesByDepartment.map(d => ({ department: d.department || "Uncategorized", total: parseFloat((d._sum.amount || 0).toString()) })),
      pendingInquiries,
    };

    debugLog('Admin: Payment stats retrieved.');
    return sendResponse(res, 200, true, stats, 'Payment statistics retrieved successfully.');

  } catch (error) {
    debugLog('Admin: Error getting payment stats:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error fetching payment statistics.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Initiate a payment (KCB or M-Pesa) - Updated with KCB preference
exports.initiatePayment = async (req, res) => {
  debugLog('Initiate Payment attempt started');
  const validationErrors = validationResult(req);
  if (!validationErrors.isEmpty()) {
    debugLog('Validation errors:', validationErrors.array());
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
    paymentMethod = 'KCB' // Default to KCB instead of M-Pesa
  } = req.body;
  
  const userId = req.user.id;
  const userPhoneForPayment = phoneNumber || req.user.phone;

  if (!userPhoneForPayment) {
      return sendResponse(res, 400, false, null, 'Phone number is required for mobile payment.', {code: 'PHONE_REQUIRED'});
  }

  const paymentAmount = parseFloat(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return sendResponse(res, 400, false, null, 'Invalid payment amount.', { code: 'INVALID_AMOUNT' });
  }

  // Validate payment method - prioritize KCB
  const supportedMethods = ['KCB', 'MPESA'];
  if (!supportedMethods.includes(paymentMethod.toUpperCase())) {
    return sendResponse(res, 400, false, null, 'Unsupported payment method. Supported methods: KCB (recommended), MPESA', { code: 'INVALID_PAYMENT_METHOD' });
  }

  let platformFee = 0; // KCB has no platform fee
  if (paymentMethod.toUpperCase() === 'MPESA') {
    platformFee = 5.00; 
    if (paymentAmount > 500) { 
      platformFee = Math.max(5.00, parseFloat((paymentAmount * 0.01).toFixed(2)));
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Process special offering ID conversion
      let processedPaymentType = paymentType;
      let processedSpecialOfferingId = specialOfferingId;
      
      // Convert frontend special offering format to backend format
      if (paymentType === 'SPECIAL' && specialOfferingId) {
        processedSpecialOfferingId = parseInt(specialOfferingId);
        processedPaymentType = 'SPECIAL_OFFERING_CONTRIBUTION';
      }

      let paymentData = {
        userId: parseInt(userId),
        amount: paymentAmount,
        paymentType: processedPaymentType,
        paymentMethod: paymentMethod.toUpperCase(),
        description: description || `${processedPaymentType} payment via ${paymentMethod}`,
        status: 'PENDING',
        paymentDate: new Date(),
        processedById: null, // User-initiated payments
        isExpense: false,
        platformFee: platformFee,
        isTemplate: false,
        reference: null, // Will be set after payment gateway response
        bankDepositStatus: 'PENDING'
      };

      // Handle special offering validation
      if (processedPaymentType === 'SPECIAL_OFFERING_CONTRIBUTION') {
        if (!processedSpecialOfferingId) {
          throw new Error('Special offering ID is required for special offering contributions.');
        }
        
        debugLog('Processing special offering contribution for offering ID:', processedSpecialOfferingId);
        
        const offering = await tx.specialOffering.findUnique({ 
          where: { id: processedSpecialOfferingId } 
        });
        
        if (!offering) {
          throw new Error(`Special offering with ID ${processedSpecialOfferingId} not found.`);
        }
        
        if (!offering.isActive) {
          throw new Error(`Special offering "${offering.name}" is not currently active.`);
        }
        
        paymentData.specialOfferingId = offering.id;
        paymentData.description = description || `Contribution to ${offering.name}`;
        
        debugLog('Special offering validated and added to payment data:', {
          offeringId: offering.id,
          offeringName: offering.name,
          isActive: offering.isActive
        });
      }

      // Handle tithe distribution
      if (processedPaymentType === 'TITHE' && titheDistributionSDA) {
        // Ensure titheDistributionSDA contains booleans
        const sdaCategories = ['campMeetingExpenses', 'welfare', 'thanksgiving', 'stationFund', 'mediaMinistry'];
        const validatedTitheDistribution = {};
        
        for (const key of sdaCategories) {
          if (titheDistributionSDA.hasOwnProperty(key) && typeof titheDistributionSDA[key] === 'boolean') {
            validatedTitheDistribution[key] = titheDistributionSDA[key];
          } else if (titheDistributionSDA.hasOwnProperty(key)) {
            debugLog(`Warning: Tithe category ${key} was not a boolean: ${titheDistributionSDA[key]}`);
            validatedTitheDistribution[key] = !!titheDistributionSDA[key]; // Coerce to boolean
          } else {
            validatedTitheDistribution[key] = false; // Default to false if not provided
          }
        }
        paymentData.titheDistributionSDA = validatedTitheDistribution;
      }

      const payment = await tx.payment.create({ data: paymentData });
      debugLog('Pending payment record created:', payment.id);

      let gatewayResponse;
      
      // Initiate payment based on method - prioritize KCB
      if (paymentMethod.toUpperCase() === 'KCB') {
        const { initiateKcbMpesaStkPush } = require('../utils/kcbPaymentUtils.js');
        gatewayResponse = await initiateKcbMpesaStkPush(
          payment.id.toString(),
          paymentAmount,
          userPhoneForPayment,
          paymentData.description
        );
        debugLog(`KCB STK push initiated for payment ${payment.id}. Ref: ${gatewayResponse.reference}`);
      } else if (paymentMethod.toUpperCase() === 'MPESA') {
        gatewayResponse = await initiateMpesaPayment(
          payment.id.toString(),
          paymentAmount,
          userPhoneForPayment,
          paymentData.description
        );
        debugLog(`M-Pesa STK push initiated for payment ${payment.id}. Ref: ${gatewayResponse.reference}`);
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          reference: gatewayResponse.reference,
          transactionId: gatewayResponse.transactionId,
          kcbReference: paymentMethod.toUpperCase() === 'KCB' ? gatewayResponse.reference : null,
        },
      });
      
      return { payment, gatewayResponse };
    });

    return sendResponse(res, 200, true,
      { 
        paymentId: result.payment.id, 
        checkoutRequestId: result.gatewayResponse.reference,
        paymentMethod: paymentMethod.toUpperCase()
      },
      result.gatewayResponse.message || `${paymentMethod} payment initiated. Check your phone.`
    );
  } catch (error) {
    debugLog('Error in initiatePayment controller:', error.message);
    console.error(error);
    if (error.message.includes('Special offering') && error.message.includes('not available')) {
        return sendResponse(res, 400, false, null, error.message, { code: 'OFFERING_NOT_AVAILABLE' });
    }
    return sendResponse(res, 500, false, null, error.message || `Failed to initiate ${paymentMethod} payment.`, {
      code: 'PAYMENT_INIT_ERROR',
      details: error.message,
    });
  }
};

// Legacy method for backward compatibility
exports.initiateMpesaPayment = exports.initiatePayment;

// Get payment status
exports.getPaymentStatus = async (req, res) => {
  debugLog('Get Payment Status attempt started');
  try {
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
        receiptNumber: true
      }
    });

    if (!payment) {
      return sendResponse(res, 404, false, null, 'Payment not found.', { code: 'PAYMENT_NOT_FOUND' });
    }

    // Check if user can access this payment
    if (!req.user.isAdmin && payment.userId !== req.user.id) {
      return sendResponse(res, 403, false, null, 'Forbidden. You can only check your own payment status.', { code: 'FORBIDDEN' });
    }

    debugLog(`Payment status retrieved for payment ${numericPaymentId}: ${payment.status}`);
    return sendResponse(res, 200, true, payment, 'Payment status retrieved successfully.');

  } catch (error) {
    debugLog('Error getting payment status:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error fetching payment status.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Add manual payment (admin only)
exports.addManualPayment = async (req, res) => {
  // Pre-convert numeric paymentType to expected format
  if (req.body.paymentType && /^\d+$/.test(req.body.paymentType)) {
    req.body.paymentType = `SPECIAL_OFFERING_${req.body.paymentType}`;
  }
  
  debugLog('Admin: Add Manual Payment attempt started');
  if (isViewOnlyAdmin(req.user)) {
    debugLog(`View-only admin ${req.user.username} (ID: ${req.user.id}) attempted to add payments.`);
    return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot add payments.", { code: 'FORBIDDEN_VIEW_ONLY' });
  }
  
  const validationErrors = validationResult(req);
  if (!validationErrors.isEmpty()) {
    debugLog('Validation errors:', validationErrors.array());
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
    
  // Convert frontend special offering format to backend format
  debugLog('Received payment data:', { userId, amount, paymentType, description, paymentDate, specialOfferingId });
  let processedPaymentType = paymentType;
  let processedSpecialOfferingId = specialOfferingId;
  
  // New conversion: if paymentType is not one of the standard types, assume it's a special offering ID
  if (!['TITHE', 'OFFERING', 'DONATION', 'EXPENSE'].includes(paymentType)) {
    processedSpecialOfferingId = parseInt(paymentType);
    processedPaymentType = 'SPECIAL_OFFERING_CONTRIBUTION';
    debugLog('Converted special offering payment:', { 
      originalType: paymentType, 
      processedType: processedPaymentType, 
      offeringId: processedSpecialOfferingId 
    });
  }
  
  const processedByAdminId = req.user.id;

  const paymentAmount = parseFloat(amount);
  if (!userId || isNaN(paymentAmount) || paymentAmount <= 0 || !paymentType) {
    return sendResponse(res, 400, false, null, 'Missing or invalid required fields: userId, amount, paymentType.', { code: 'MISSING_INVALID_FIELDS' });
  }

  try {
    const user = await prisma.user.findUnique({ 
      where: { id: parseInt(userId) },
      select: { id: true, fullName: true, phone: true, email: true }
    });
    if (!user) throw new Error('User not found.');

    let paymentData = {
      userId: parseInt(userId),
      amount: paymentAmount,
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
    
    debugLog('Created payment data object:', paymentData);

    // Handle special offering payment types
    if (paymentType.startsWith('SPECIAL_OFFERING_')) {
      const offeringId = paymentType.replace('SPECIAL_OFFERING_', '');
      const offering = await prisma.specialOffering.findUnique({ where: { id: parseInt(offeringId) } });
      if (!offering || !offering.isActive) throw new Error('Selected special offering is not available or not active.');
      paymentData.specialOfferingId = offering.id;
      paymentData.paymentType = 'SPECIAL_OFFERING_CONTRIBUTION';
      paymentData.description = description || `Contribution to ${offering.name}`;
    }

    // Handle converted special offering
    if (processedPaymentType === 'SPECIAL_OFFERING_CONTRIBUTION' && processedSpecialOfferingId) {
      const offering = await prisma.specialOffering.findUnique({ where: { id: processedSpecialOfferingId } });
      if (!offering || !offering.isActive) throw new Error('Selected special offering is not available or not active.');
      paymentData.specialOfferingId = offering.id;
      paymentData.description = description || `Contribution to ${offering.name}`;
    }

    // Handle tithe distribution
    if (processedPaymentType === 'TITHE' && titheDistributionSDA) {
      paymentData.titheDistributionSDA = titheDistributionSDA;
    }

    // Handle expenses
    if (isExpense) {
      if (!department) throw new Error('Department is required for expenses.');
      paymentData.department = department;
      if (expenseReceiptUrl) {
        paymentData.expenseReceiptUrl = expenseReceiptUrl;
      }
    }

    const createdPayment = await prisma.payment.create({ 
      data: paymentData,
      include: { user: true } 
    });
    debugLog('Manual payment record created:', createdPayment.id);

    // Generate receipt for non-expense completed payments
    if (!createdPayment.isExpense && createdPayment.status === 'COMPLETED') {
      const receiptNumber = generateReceiptNumber(createdPayment.paymentType);
      await prisma.receipt.create({
        data: {
          receiptNumber: receiptNumber,
          paymentId: createdPayment.id,
          userId: createdPayment.userId,
          generatedById: createdPayment.processedById,
          receiptDate: new Date(),
          receiptData: {
            paymentId: createdPayment.id, 
            amount: createdPayment.amount, 
            paymentType: createdPayment.paymentType,
            userName: user.fullName, 
            paymentDate: createdPayment.paymentDate,
            description: createdPayment.description,
            titheDesignations: paymentType === 'TITHE' ? createdPayment.titheDistributionSDA : null 
          },
        }
      });
      
      await prisma.payment.update({ 
        where: { id: createdPayment.id }, 
        data: { receiptNumber }
      });
      debugLog(`Receipt ${receiptNumber} generated for payment ${createdPayment.id}`);
    }

    await logAdminActivity(isExpense ? 'ADMIN_ADD_EXPENSE' : 'ADMIN_ADD_MANUAL_PAYMENT', createdPayment.id, req.user.id, { 
      amount: createdPayment.amount, 
      type: createdPayment.paymentType, 
      userId: createdPayment.userId 
    });

    return sendResponse(res, 201, true, { payment: createdPayment }, 'Manual payment added successfully.');

  } catch (error) {
    debugLog('Error adding manual payment:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, error.message || 'Failed to add manual payment.', {
      code: 'MANUAL_PAYMENT_ERROR',
      details: error.message,
    });
  }
};

// M-Pesa Callback
exports.mpesaCallback = async (req, res) => {
  debugLog('M-Pesa Callback received:', JSON.stringify(req.body, null, 2));
  const callbackData = req.body.Body?.stkCallback;

  if (!callbackData) {
    debugLog('Invalid M-Pesa callback structure.');
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
        include: { user: true }
      });

      if (!payment) {
        debugLog(`No matching PENDING M-Pesa payment found for CheckoutRequestID: ${CheckoutRequestID} or MerchantRequestID: ${MerchantRequestID}.`);
        return { alreadyProcessedOrNotFound: true };
      }

      debugLog(`Processing M-Pesa callback for payment ID: ${payment.id}`);
      let updatedPaymentData = {};

      if (String(ResultCode) === "0") { // Successful
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
            } catch (e) { debugLog("Error parsing M-Pesa transaction date from callback", e); }
          }
        }

        const internalReceiptNumber = generateReceiptNumber(payment.paymentType);
        updatedPaymentData = {
          status: 'COMPLETED',
          transactionId: mpesaReceiptNumber || payment.transactionId,
          receiptNumber: internalReceiptNumber,
          paymentDate: transactionDate, 
        };

        await tx.payment.update({ where: { id: payment.id }, data: updatedPaymentData });

        if (payment.user) {
            await tx.receipt.create({
                data: {
                receiptNumber: internalReceiptNumber,
                paymentId: payment.id,
                userId: payment.userId,
                generatedById: null,
                receiptDate: new Date(),
                receiptData: {
                    paymentId: payment.id, amount: payment.amount, paymentType: payment.paymentType,
                    userName: payment.user.fullName, paymentDate: transactionDate,
                    description: payment.description, mpesaReceipt: mpesaReceiptNumber,
                    titheDesignations: payment.paymentType === 'TITHE' ? payment.titheDistributionSDA : null 
                },
                },
            });
            debugLog(`Payment ${payment.id} COMPLETED. M-Pesa Receipt: ${mpesaReceiptNumber}. Internal Receipt: ${internalReceiptNumber}`);

            if (payment.user.phone) {
                try {
                await sendSmsNotification(
                    payment.user.phone,
                    `Dear ${payment.user.fullName}, your M-Pesa payment of KES ${payment.amount.toFixed(2)} for ${payment.paymentType} was successful. Receipt No: ${internalReceiptNumber}. Thank you.`
                );
                debugLog(`SMS notification sent for payment ${payment.id}`);
                } catch (smsError) {
                debugLog(`SMS notification failed for payment ${payment.id}:`, smsError.message);
                }
            }
        } else {
            debugLog(`User not found for payment ID ${payment.id}, cannot create receipt or send SMS.`);
        }
         return { success: true, paymentId: payment.id };
      } else { // Failed
        updatedPaymentData = {
          status: 'FAILED',
          description: `${payment.description || ''} (M-Pesa Callback Failed: ${ResultDesc})`.substring(0, 191),
        };
        await tx.payment.update({ where: { id: payment.id }, data: updatedPaymentData });
        debugLog(`Payment ${payment.id} FAILED. Reason: ${ResultDesc}`);
        return { success: false, reason: ResultDesc, paymentId: payment.id };
      }
    });
  } catch (error) {
    debugLog('Critical error in M-Pesa callback processing:', error.message);
    console.error(error);
  }
  
  return res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback received and processed.' });
};

// KCB Callback
exports.kcbCallback = async (req, res) => {
  debugLog('KCB Callback received:', JSON.stringify(req.body, null, 2));
  const callbackData = req.body;

  if (!callbackData || !callbackData.transactionReference) {
    debugLog('Invalid KCB callback structure.');
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
        include: { user: true }
      });

      if (!payment) {
        debugLog(`No matching PENDING KCB payment found for reference: ${transactionReference} or transactionId: ${transactionId}.`);
        return { alreadyProcessedOrNotFound: true };
      }

      debugLog(`Processing KCB callback for payment ID: ${payment.id}`);
      let updatedPaymentData = {};

      if (String(resultCode) === "0" || String(resultCode) === "00") { // Successful
        const internalReceiptNumber = generateReceiptNumber(payment.paymentType);
        const parsedTransactionDate = transactionDate ? new Date(transactionDate) : payment.paymentDate;
        
        updatedPaymentData = {
          status: 'COMPLETED',
          transactionId: transactionId || payment.transactionId,
          receiptNumber: internalReceiptNumber,
          paymentDate: parsedTransactionDate, 
        };

        await tx.payment.update({ where: { id: payment.id }, data: updatedPaymentData });

        if (payment.user) {
            await tx.receipt.create({
                data: {
                receiptNumber: internalReceiptNumber,
                paymentId: payment.id,
                userId: payment.userId,
                generatedById: null,
                receiptDate: new Date(),
                receiptData: {
                    paymentId: payment.id, amount: payment.amount, paymentType: payment.paymentType,
                    userName: payment.user.fullName, paymentDate: parsedTransactionDate,
                    description: payment.description, kcbTransactionId: transactionId,
                    titheDesignations: payment.paymentType === 'TITHE' ? payment.titheDistributionSDA : null 
                },
                },
            });
            debugLog(`Payment ${payment.id} COMPLETED. KCB Transaction: ${transactionId}. Internal Receipt: ${internalReceiptNumber}`);

            if (payment.user.phone) {
                try {
                await sendSmsNotification(
                    payment.user.phone,
                    `Dear ${payment.user.fullName}, your KCB payment of KES ${payment.amount.toFixed(2)} for ${payment.paymentType} was successful. Receipt No: ${internalReceiptNumber}. Thank you.`
                );
                debugLog(`SMS notification sent for payment ${payment.id}`);
                } catch (smsError) {
                debugLog(`SMS notification failed for payment ${payment.id}:`, smsError.message);
                }
            }
        } else {
            debugLog(`User not found for payment ID ${payment.id}, cannot create receipt or send SMS.`);
        }
         return { success: true, paymentId: payment.id };
      } else { // Failed
        updatedPaymentData = {
          status: 'FAILED',
          description: `${payment.description || ''} (KCB Callback Failed: ${resultDescription})`.substring(0, 191),
        };
        await tx.payment.update({ where: { id: payment.id }, data: updatedPaymentData });
        debugLog(`Payment ${payment.id} FAILED. Reason: ${resultDescription}`);
        return { success: false, reason: resultDescription, paymentId: payment.id };
      }
    });
  } catch (error) {
    debugLog('Critical error in KCB callback processing:', error.message);
    console.error(error);
  }
  
  return res.status(200).json({ status: 'success', message: 'Callback received and processed.' });
};

// Update payment status (admin only)
exports.updatePaymentStatus = async (req, res) => {
  debugLog('Admin: Update Payment Status attempt started');
  try {
    if (isViewOnlyAdmin(req.user)) {
      debugLog(`View-only admin ${req.user.username} (ID: ${req.user.id}) attempted to update payment status.`);
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

    const payment = await prisma.payment.findUnique({ where: { id: numericPaymentId } });
    if (!payment) {
      return sendResponse(res, 404, false, null, 'Payment not found.', { code: 'PAYMENT_NOT_FOUND' });
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: numericPaymentId },
      data: { status: status.toUpperCase() },
    });

    await logAdminActivity('ADMIN_UPDATE_PAYMENT_STATUS', updatedPayment.id, req.user.id, { oldStatus: payment.status, newStatus: updatedPayment.status });
    debugLog(`Payment ${numericPaymentId} status updated to ${status.toUpperCase()} by admin ${req.user.username}`);
    return sendResponse(res, 200, true, { payment: updatedPayment }, 'Payment status updated successfully.');

  } catch (error) {
    debugLog('Admin: Error updating payment status:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error updating payment status.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Delete payment (admin only)
exports.deletePayment = async (req, res) => {
  debugLog('Admin: Delete Payment attempt started');
  const { paymentId } = req.params;
  const numericPaymentId = parseInt(paymentId);

  if (isNaN(numericPaymentId)) {
    return sendResponse(res, 400, false, null, 'Invalid Payment ID format.', { code: 'INVALID_PAYMENT_ID' });
  }

  if (isViewOnlyAdmin(req.user)) {
    debugLog(`View-only admin ${req.user.username} (ID: ${req.user.id}) attempted to delete payment.`);
    return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot delete payments.", { code: 'FORBIDDEN_VIEW_ONLY' });
  }
  
  try {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: numericPaymentId } });
      if (!payment) {
        const err = new Error('Payment not found.');
        err.statusCode = 404; 
        throw err;
      }

      await tx.receipt.deleteMany({ where: { paymentId: numericPaymentId } });
      debugLog(`Associated receipts for payment ${numericPaymentId} deleted.`);

      await tx.payment.delete({ where: { id: numericPaymentId } });
      debugLog(`Payment ${numericPaymentId} deleted.`);
      await logAdminActivity('ADMIN_DELETE_PAYMENT', numericPaymentId, req.user.id, { amount: payment.amount, type: payment.paymentType });
    });

    return sendResponse(res, 200, true, { paymentId: numericPaymentId }, 'Payment and associated receipts deleted successfully.');
  } catch (error) {
    debugLog('Admin: Error deleting payment:', error.message);
    console.error(error);
    if (error.statusCode === 404 || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')) {
        return sendResponse(res, 404, false, null, 'Payment not found.', {code: 'PAYMENT_NOT_FOUND'});
    }
    return sendResponse(res, 500, false, null, 'Server error deleting payment.', { code: 'SERVER_ERROR', details: error.message });
  }
};