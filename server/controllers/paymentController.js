// server/controllers/paymentController.js
const { PrismaClient, Prisma } = require('@prisma/client');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const { generateReceiptNumber } = require('../utils/receiptUtils.js');
const { sendSmsNotification } = require('../utils/notificationUtils.js');
const { initiateMpesaPayment } = require('../utils/paymentUtils.js');

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
  const viewOnlyUsernames = ['admin3', 'admin4', 'admin5']; // ADAPT THIS
  return viewOnlyUsernames.includes(user.username);
};

// Log Admin Activity
async function logAdminActivity(actionType, targetId, initiatedBy, actionData = {}) {
  try {
    await prisma.adminAction.create({
      data: {
        actionType,
        targetId: String(targetId),
        initiatedBy,
        actionData,
        status: 'COMPLETED',
        initiator: {
          connect: { id: initiatedBy } // Connect to the user who initiated the action
        }
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
    } = req.query;

    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const whereConditions = { isTemplate: false }; // Exclude special offering definitions

    if (startDate) whereConditions.paymentDate = { ...whereConditions.paymentDate, gte: new Date(startDate) };
    if (endDate) whereConditions.paymentDate = { ...whereConditions.paymentDate, lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) };
    if (userId) whereConditions.userId = parseInt(userId);
    if (department) whereConditions.department = { contains: department, mode: 'insensitive' }; // Case-insensitive search for department
    if (status) whereConditions.status = status;

    if (paymentType && paymentType !== 'ALL') {
      whereConditions.paymentType = paymentType; // Includes TITHE, OFFERING, DONATION, EXPENSE, SPECIAL_OFFERING_CONTRIBUTION
    }

    if (search) {
      const searchClauses = [
        { description: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { transactionId: { contains: search, mode: 'insensitive' } },
        { receiptNumber: { contains: search, mode: 'insensitive' } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
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
      include: {
        user: { select: { id: true, username: true, fullName: true, phone: true } },
        processor: { select: { id: true, username: true, fullName: true } },
        specialOffering: { select: { id: true, name: true, offeringCode: true } }
      },
      orderBy: { paymentDate: 'desc' },
      skip,
      take,
    });

    const totalPayments = await prisma.payment.count({ where: whereConditions });

    debugLog(`Admin: Retrieved ${payments.length} of ${totalPayments} payments.`);
    return sendResponse(res, 200, true, {
      payments,
      totalPages: Math.ceil(totalPayments / take),
      currentPage: parseInt(page),
      totalPayments,
    }, 'Payments retrieved successfully.');

  } catch (error) {
    debugLog('Admin: Error getting all payments:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error fetching payments.', { code: 'SERVER_ERROR', details: error.message });
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
        { description: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { transactionId: { contains: search, mode: 'insensitive' } },
        { receiptNumber: { contains: search, mode: 'insensitive' } },
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
    const platformFeesResult = await prisma.payment.aggregate({ _sum: { platformFee: true }, where: commonWhere });

    const totalRevenue = totalRevenueResult._sum.amount || new Prisma.Decimal(0);
    const totalExpenses = totalExpensesResult._sum.amount || new Prisma.Decimal(0);
    const totalPlatformFees = platformFeesResult._sum.platformFee || new Prisma.Decimal(0);

    let monthlyData = [];
    // Prisma does not directly support date part extraction in a portable way for group by like strftime or TO_CHAR without raw queries.
    // For simplicity here, we fetch last 12 months of data and aggregate in JS, or use $queryRaw.
    // Using $queryRaw for better performance and DB-side aggregation:
     if (prisma.$queryRawUnsafe) { // Check if available (depends on Prisma version and preview features)
        monthlyData = await prisma.$queryRawUnsafe(`
            SELECT
              strftime('%Y-%m', "paymentDate") as month,
              SUM(CASE WHEN "isExpense" = 0 THEN amount ELSE 0 END) as revenue,
              SUM(CASE WHEN "isExpense" = 1 THEN amount ELSE 0 END) as expenses
            FROM "Payments"
            WHERE status = 'COMPLETED' AND "isTemplate" = 0
            AND "paymentDate" >= strftime('%Y-%m-%d', date('now', '-12 months'))
            GROUP BY month
            ORDER BY month ASC;
        `); // SQLite version
        // For PostgreSQL:
        // TO_CHAR("paymentDate", 'YYYY-MM') as month, ... WHERE "paymentDate" >= date_trunc('month', NOW() - INTERVAL '11 months') ...
    } else {
        debugLog("prisma.$queryRawUnsafe not available, monthly data aggregation will be less efficient or omitted.");
        // Fallback or alternative logic if raw query is not an option or desired
    }


    const paymentsByType = await prisma.payment.groupBy({
      by: ['paymentType'],
      _sum: { amount: true },
      where: { ...commonWhere, isExpense: false },
    });
    const expensesByDepartment = await prisma.payment.groupBy({
      by: ['department'],
      _sum: { amount: true },
      where: { ...commonWhere, isExpense: true, department: { not: null } },
    });
    
    const stats = {
      revenue: parseFloat(totalRevenue.toString()),
      expenses: parseFloat(totalExpenses.toString()),
      netBalance: parseFloat(totalRevenue.minus(totalExpenses).toString()),
      platformFees: parseFloat(totalPlatformFees.toString()),
      monthlyData: monthlyData.map(m => ({...m, revenue: Number(m.revenue), expenses: Number(m.expenses) })),
      paymentsByType: paymentsByType.map(p => ({ type: p.paymentType, total: parseFloat((p._sum.amount || 0).toString()) })),
      expensesByDepartment: expensesByDepartment.map(d => ({ department: d.department, total: parseFloat((d._sum.amount || 0).toString()) })),
    };

    debugLog('Admin: Payment stats retrieved.');
    return sendResponse(res, 200, true, stats, 'Payment statistics retrieved successfully.');

  } catch (error) {
    debugLog('Admin: Error getting payment stats:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error fetching payment statistics.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Initiate an M-Pesa payment (User action)
exports.initiatePayment = async (req, res) => {
  debugLog('Initiate M-Pesa Payment attempt started');
  const validationErrors = validationResult(req);
  if (!validationErrors.isEmpty()) {
    debugLog('Validation errors:', validationErrors.array());
    return sendResponse(res, 400, false, null, 'Validation failed', {
      code: 'VALIDATION_ERROR',
      details: validationErrors.array().map(err => ({ field: err.path, message: err.msg })),
    });
  }

  const { amount, paymentType, description, titheDistributionSDA, specialOfferingId, phoneNumber } = req.body;
  const userId = req.user.id;
  const userPhoneForMpesa = phoneNumber || req.user.phone;

  if (!userPhoneForMpesa) {
      return sendResponse(res, 400, false, null, 'Phone number is required for M-Pesa payment.', {code: 'PHONE_REQUIRED'});
  }

  const paymentAmount = parseFloat(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return sendResponse(res, 400, false, null, 'Invalid payment amount.', { code: 'INVALID_AMOUNT' });
  }

  let platformFee = 5.00; // Example flat fee
  if (paymentAmount > 500) { // Example tiered fee
    platformFee = Math.max(5.00, parseFloat((paymentAmount * 0.01).toFixed(2)));
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let paymentData = {
        userId,
        amount: paymentAmount, // Store the actual amount for the church
        paymentType,
        paymentMethod: 'MPESA',
        description: description || `${paymentType} Contribution`,
        status: 'PENDING',
        platformFee, // Store the calculated platform fee
        paymentDate: new Date(),
        isExpense: false,
        isTemplate: false,
        processedById: userId,
      };

      if (paymentType === 'TITHE' && titheDistributionSDA) {
        paymentData.titheDistributionSDA = titheDistributionSDA;
      } else if (paymentType === 'SPECIAL_OFFERING_CONTRIBUTION' && specialOfferingId) {
        const offering = await tx.specialOffering.findUnique({ where: { id: parseInt(specialOfferingId) } });
        if (!offering || !offering.isActive) {
          throw new Error('Selected special offering is not available or not active.');
        }
        paymentData.specialOfferingId = offering.id;
        paymentData.description = description || `Contribution to ${offering.name}`;
      }

      const payment = await tx.payment.create({ data: paymentData });
      debugLog('Pending payment record created:', payment.id);

      const mpesaAmountForStk = paymentAmount; // The amount to be charged to user via M-Pesa

      const mpesaResponse = await initiateMpesaPayment(
        payment.id.toString(),
        mpesaAmountForStk,
        userPhoneForMpesa,
        paymentData.description
      );

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          reference: mpesaResponse.reference,
          transactionId: mpesaResponse.transactionId,
        },
      });
      debugLog(`M-Pesa STK push initiated for payment ${payment.id}. Ref: ${mpesaResponse.reference}`);
      return { payment, mpesaResponse };
    });

    return sendResponse(res, 200, true,
      { paymentId: result.payment.id, mpesaCheckoutID: result.mpesaResponse.reference },
      result.mpesaResponse.message || 'M-Pesa payment initiated. Check your phone.'
    );
  } catch (error) {
    debugLog('Error in initiatePayment controller:', error.message);
    console.error(error);
    // If it's an error thrown from the transaction block with specific details
    if (error.message === 'Selected special offering is not available or not active.') {
        return sendResponse(res, 400, false, null, error.message, { code: 'OFFERING_NOT_AVAILABLE' });
    }
    return sendResponse(res, 500, false, null, error.message || 'Failed to initiate M-Pesa payment.', {
      code: 'MPESA_INIT_ERROR',
      details: error.message,
    });
  }
};

// Add manual payment (admin only)
exports.addManualPayment = async (req, res) => {
  debugLog('Admin: Add Manual Payment attempt started');
  if (isViewOnlyAdmin(req.user)) {
    debugLog(`View-only admin ${req.user.username} (ID: ${req.user.id}) attempted to add manual payment.`);
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
    paymentMethod = 'MANUAL', expenseReceiptUrl, reference, // Added reference
  } = req.body;
  const processedByAdminId = req.user.id;

  const paymentAmount = parseFloat(amount);
  // Basic validations
  if (!userId || isNaN(paymentAmount) || paymentAmount <= 0 || !paymentType) {
    return sendResponse(res, 400, false, null, 'Missing or invalid required fields: userId, amount, paymentType.', { code: 'MISSING_INVALID_FIELDS' });
  }

  try {
    const payment = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ 
        where: { id: parseInt(userId) },
        select: { id: true, fullName: true, phone: true, email: true }
      });
      if (!user) throw new Error('User not found.');

      let paymentData = {
        userId: parseInt(userId),
        amount: paymentAmount,
        paymentType,
        paymentMethod,
        description: description || `${paymentType} (${paymentMethod})`,
        status: 'COMPLETED',
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        processedById: processedByAdminId,
        isExpense: !!isExpense,
        platformFee: 0,
        isTemplate: false,
        reference: reference || null
      };

      if (isExpense) {
        if (!department) throw new Error('Department is required for expenses.');
        paymentData.department = department;
        if (req.file) { // Assuming multer middleware adds 'file' to 'req'
          paymentData.expenseReceiptUrl = `/uploads/expense_receipts/${req.file.filename}`; // Adjust path as needed
        } else if (expenseReceiptUrl) { // Allow passing URL directly if already uploaded elsewhere
          paymentData.expenseReceiptUrl = expenseReceiptUrl;
        }
      } else if (paymentType === 'TITHE') {
        if (!titheDistributionSDA || typeof titheDistributionSDA !== 'object') {
          throw new Error('Valid tithe distribution data is required for tithe payments.');
        }
        const distributedSum = Object.values(titheDistributionSDA).reduce((sum, val) => sum + parseFloat(val), 0);
        if (Math.abs(distributedSum - paymentAmount) > 0.01) {
           debugLog(`Warning: Tithe distribution sum (${distributedSum}) != payment amount (${paymentAmount}).`);
           // Decide if this is a hard error or just a warning to log
           // For now, allowing it but logging. Consider stricter validation.
        }
        paymentData.titheDistributionSDA = titheDistributionSDA;
      } else if (paymentType === 'SPECIAL_OFFERING_CONTRIBUTION') {
        if (!specialOfferingId) throw new Error('Special Offering ID is required.');
        const offering = await tx.specialOffering.findUnique({ where: { id: parseInt(specialOfferingId) } });
        if (!offering || !offering.isActive) throw new Error('Selected special offering is not available or not active.');
        paymentData.specialOfferingId = offering.id;
        paymentData.description = description || `Contribution to ${offering.name}`;
      }

      const createdPayment = await tx.payment.create({ 
        data: paymentData,
        include: { user: true }  // Include user relation in the created payment
      });
      debugLog('Manual payment record created:', createdPayment.id);

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
              amount: createdPayment.amount,
              paymentType: createdPayment.paymentType,
              userName: user.fullName, // Use the user object we queried earlier
              paymentDate: createdPayment.paymentDate,
              description: createdPayment.description
            },
          }
        });
        const finalPayment = await tx.payment.update({ 
          where: { id: createdPayment.id }, 
          data: { receiptNumber },
          include: { user: true }  // Include user relation in the final payment
        });
        debugLog(`Receipt ${receiptNumber} generated for payment ${createdPayment.id}`);
        await logAdminActivity('ADMIN_ADD_MANUAL_PAYMENT', finalPayment.id, req.user.id, { amount: finalPayment.amount, type: finalPayment.paymentType, userId: finalPayment.userId });
        return finalPayment;
      }
      await logAdminActivity(isExpense ? 'ADMIN_ADD_EXPENSE' : 'ADMIN_ADD_MANUAL_PAYMENT', createdPayment.id, req.user.id, { amount: createdPayment.amount, type: createdPayment.paymentType, userId: createdPayment.userId });
      return createdPayment;
    });

    return sendResponse(res, 201, true, { payment }, 'Manual payment added successfully.');
  } catch (error) {
    debugLog('Error adding manual payment:', error.message);
    console.error(error);
    return sendResponse(res, error.message === 'User not found.' ? 404 : (error.message.includes('required for') ? 400 : 500), false, null, error.message || 'Failed to add manual payment.', {
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
    return res.status(400).json({ ResultCode: 1, ResultDesc: 'Invalid callback data' }); // Bad request for invalid structure
  }

  const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callbackData;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: {
          OR: [
            { reference: CheckoutRequestID }, // Safaricom uses CheckoutRequestID
            { transactionId: MerchantRequestID } // And MerchantRequestID for internal tracking
          ],
          status: 'PENDING', // Important: Only process PENDING payments
        },
        include: { user: true }
      });

      if (!payment) {
        debugLog(`No matching PENDING payment found for CheckoutRequestID: ${CheckoutRequestID} or MerchantRequestID: ${MerchantRequestID}. It might have already been processed, does not exist, or is not PENDING.`);
        return { alreadyProcessedOrNotFound: true }; // Indicate special handling needed
      }

      debugLog(`Processing callback for payment ID: ${payment.id}`);
      let updatedPaymentData = {};

      if (String(ResultCode) === "0") { // Successful M-Pesa transaction
        const metadataItems = CallbackMetadata?.Item;
        let mpesaReceiptNumber = null;
        let transactionDate = payment.paymentDate; // Default to original paymentDate

        if (metadataItems && Array.isArray(metadataItems)) {
          mpesaReceiptNumber = metadataItems.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
          const mpesaTransactionDateStr = metadataItems.find(item => item.Name === 'TransactionDate')?.Value;
          if (mpesaTransactionDateStr) {
            try { // Format is YYYYMMDDHHMMSS
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
          paymentDate: transactionDate, // Update with M-Pesa's transaction date
        };

        await tx.payment.update({ where: { id: payment.id }, data: updatedPaymentData });

        if (payment.user) { // Ensure user exists
            await tx.receipt.create({
                data: {
                receiptNumber: internalReceiptNumber,
                paymentId: payment.id,
                userId: payment.userId,
                generatedById: null, // System generated
                receiptDate: new Date(),
                receiptData: {
                    paymentId: payment.id, amount: payment.amount, paymentType: payment.paymentType,
                    userName: payment.user.fullName, paymentDate: transactionDate,
                    description: payment.description, mpesaReceipt: mpesaReceiptNumber
                },
                },
            });
            debugLog(`Payment ${payment.id} COMPLETED. M-Pesa Receipt: ${mpesaReceiptNumber}. Internal Receipt: ${internalReceiptNumber}`);

            if (payment.user.phone) {
                try {
                await sendSmsNotification(
                    payment.user.phone,
                    `Dear ${payment.user.fullName}, your payment of KES ${payment.amount.toFixed(2)} for ${payment.paymentType} was successful. Receipt No: ${internalReceiptNumber}. Thank you.`
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
      } else { // M-Pesa transaction failed
        updatedPaymentData = {
          status: 'FAILED',
          description: `${payment.description || ''} (M-Pesa Callback Failed: ${ResultDesc})`,
        };
        await tx.payment.update({ where: { id: payment.id }, data: updatedPaymentData });
        debugLog(`Payment ${payment.id} FAILED. Reason: ${ResultDesc}`);
        return { success: false, reason: ResultDesc, paymentId: payment.id };
      }
    });
    // If result.alreadyProcessedOrNotFound, it means we acknowledged to M-Pesa but didn't find a PENDING payment.
    // This is fine, no further action here.
  } catch (error) {
    debugLog('Critical error in M-Pesa callback processing:', error.message);
    console.error(error);
    // The transaction will be rolled back by Prisma if an error is thrown from within it.
  }
  
  // Always acknowledge the callback to M-Pesa to prevent retries from their end
  return res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback received and processed.' });
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
        // Throw an error that will be caught by the outer try-catch and result in a 404
        const err = new Error('Payment not found.');
        err.statusCode = 404; // Custom property
        throw err;
      }

      // Delete associated receipts first
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