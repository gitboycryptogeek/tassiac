// server/controllers/batchPaymentController.js
const { PrismaClient, Prisma } = require('@prisma/client');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { initiateKcbPayment } = require('../utils/kcbPaymentUtils.js');
const { generateReceiptNumber } = require('../utils/receiptUtils.js');

const prisma = new PrismaClient();

// Setup debug log file
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOG_DIR, 'batch-payment-controller-debug.log');

function debugLog(message, data = null) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] BATCH_PAYMENT_CTRL: ${message}`;
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

const isViewOnlyAdmin = (user) => {
  if (!user || !user.isAdmin) return false;
  const viewOnlyUsernames = (process.env.VIEW_ONLY_ADMIN_USERNAMES || 'admin3,admin4,admin5').split(',');
  return viewOnlyUsernames.includes(user.username);
};

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

// Create a new batch payment
exports.createBatchPayment = async (req, res) => {
  debugLog('Create Batch Payment attempt started');
  try {
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot create batch payments.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debugLog('Validation errors on batch payment creation:', errors.array());
      return sendResponse(res, 400, false, null, 'Validation failed', {
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({ field: err.path, message: err.msg })),
      });
    }

    const { payments, description } = req.body;

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return sendResponse(res, 400, false, null, 'Payments array is required and must not be empty.', { code: 'MISSING_PAYMENTS' });
    }

    // Validate all payments before processing
    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      
      if (!payment.userId || !payment.amount || !payment.paymentType) {
        return sendResponse(res, 400, false, null, `Payment ${i + 1}: Missing required fields (userId, amount, paymentType).`, { code: 'INVALID_PAYMENT_DATA' });
      }

      if (parseFloat(payment.amount) <= 0) {
        return sendResponse(res, 400, false, null, `Payment ${i + 1}: Amount must be positive.`, { code: 'INVALID_AMOUNT' });
      }
    }

    // Generate unique batch reference
    const batchReference = `BATCH-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const result = await prisma.$transaction(async (tx) => {
      // Calculate totals
      const totalAmount = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
      const totalCount = payments.length;

      // Create batch payment record
      const batchPayment = await tx.batchPayment.create({
        data: {
          batchReference,
          totalAmount,
          totalCount,
          description: description || `Batch payment with ${totalCount} transactions`,
          createdById: req.user.id,
          status: 'PENDING',
        },
      });

      // Create individual payment records
      const createdPayments = [];
      for (const paymentData of payments) {
        // Validate user exists
        const user = await tx.user.findUnique({ where: { id: parseInt(paymentData.userId) } });
        if (!user) {
          throw new Error(`User with ID ${paymentData.userId} not found`);
        }

        // Handle special offering validation
        let processedPaymentType = paymentData.paymentType;
        let processedSpecialOfferingId = paymentData.specialOfferingId;
        
        if (!['TITHE', 'OFFERING', 'DONATION', 'EXPENSE'].includes(paymentData.paymentType)) {
          if (/^\d+$/.test(paymentData.paymentType)) {
            processedSpecialOfferingId = parseInt(paymentData.paymentType);
            processedPaymentType = 'SPECIAL_OFFERING_CONTRIBUTION';
          }
        }

        if (processedPaymentType === 'SPECIAL_OFFERING_CONTRIBUTION' && processedSpecialOfferingId) {
          const offering = await tx.specialOffering.findUnique({ where: { id: processedSpecialOfferingId } });
          if (!offering || !offering.isActive) {
            throw new Error(`Special offering with ID ${processedSpecialOfferingId} not found or not active`);
          }
        }

        // Validate tithe distribution if provided
        let validatedTitheDistribution = null;
        if (processedPaymentType === 'TITHE' && paymentData.titheDistributionSDA) {
          const sdaCategories = ['campMeetingExpenses', 'welfare', 'thanksgiving', 'stationFund', 'mediaMinistry'];
          validatedTitheDistribution = {};
          
          for (const key of sdaCategories) {
            if (paymentData.titheDistributionSDA.hasOwnProperty(key)) {
              validatedTitheDistribution[key] = Boolean(paymentData.titheDistributionSDA[key]);
            }
          }
        }

        const payment = await tx.payment.create({
          data: {
            userId: parseInt(paymentData.userId),
            amount: parseFloat(paymentData.amount),
            paymentType: processedPaymentType,
            paymentMethod: 'BATCH_KCB',
            description: paymentData.description || `${processedPaymentType} payment (Batch)`,
            status: 'PENDING',
            paymentDate: paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date(),
            processedById: req.user.id,
            isExpense: !!paymentData.isExpense,
            department: paymentData.department || null,
            specialOfferingId: processedSpecialOfferingId || null,
            titheDistributionSDA: validatedTitheDistribution,
            batchPaymentId: batchPayment.id,
            isBatchProcessed: false,
            bankDepositStatus: 'PENDING',
          },
          include: {
            user: { select: { fullName: true, phone: true, email: true } },
            specialOffering: { select: { name: true, offeringCode: true } },
          },
        });

        createdPayments.push(payment);
      }

      return { batchPayment, payments: createdPayments };
    }, {
      maxWait: 20000,
      timeout: 60000,
    });

    await logAdminActivity('CREATE_BATCH_PAYMENT', result.batchPayment.id, req.user.id, { 
      batchReference,
      totalAmount: result.batchPayment.totalAmount,
      totalCount: result.batchPayment.totalCount
    });

    debugLog(`Batch payment created: ${batchReference} with ${result.payments.length} payments`);
    return sendResponse(res, 201, true, {
      batchPayment: {
        ...result.batchPayment,
        totalAmount: parseFloat(result.batchPayment.totalAmount.toString())
      },
      paymentsCreated: result.payments.length,
      batchReference,
    }, `Batch payment created successfully with ${result.payments.length} payments. Ready for KCB deposit.`);

  } catch (error) {
    debugLog('Error creating batch payment:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, error.message || 'Server error creating batch payment.', {
      code: 'BATCH_PAYMENT_ERROR',
      details: error.message,
    });
  }
};

// Process batch payment deposit via KCB
exports.processBatchDeposit = async (req, res) => {
  debugLog('Process Batch Deposit attempt started');
  try {
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot process batch deposits.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const { batchId } = req.params;
    const { phoneNumber, depositDescription } = req.body;

    const batchPayment = await prisma.batchPayment.findUnique({
      where: { id: parseInt(batchId) },
      include: {
        payments: {
          include: {
            user: { select: { fullName: true, phone: true } },
          },
        },
      },
    });

    if (!batchPayment) {
      return sendResponse(res, 404, false, null, 'Batch payment not found.', { code: 'BATCH_NOT_FOUND' });
    }

    if (batchPayment.status !== 'PENDING') {
      return sendResponse(res, 400, false, null, 'Batch payment is not pending deposit.', { code: 'INVALID_BATCH_STATUS' });
    }

    const userPhoneForPayment = phoneNumber || req.user.phone;
    if (!userPhoneForPayment) {
      return sendResponse(res, 400, false, null, 'Phone number is required for KCB deposit.', { code: 'PHONE_REQUIRED' });
    }

    // Initiate KCB payment for the total batch amount
    const description = depositDescription || `Batch deposit: ${batchPayment.batchReference}`;
    
    try {
      const kcbResponse = await initiateKcbPayment(
        batchPayment.batchReference,
        parseFloat(batchPayment.totalAmount.toString()),
        userPhoneForPayment,
        description
      );

      // Update batch payment with KCB transaction details
      const updatedBatch = await prisma.batchPayment.update({
        where: { id: parseInt(batchId) },
        data: {
          status: 'DEPOSITED',
          kcbTransactionId: kcbResponse.transactionId,
          kcbReference: kcbResponse.reference,
          processedById: req.user.id,
          depositedAt: new Date(),
        },
      });

      await logAdminActivity('PROCESS_BATCH_DEPOSIT', batchPayment.id, req.user.id, { 
        batchReference: batchPayment.batchReference,
        totalAmount: parseFloat(batchPayment.totalAmount.toString()),
        kcbReference: kcbResponse.reference
      });

      debugLog(`Batch deposit initiated: ${batchPayment.batchReference}, KCB Reference: ${kcbResponse.reference}`);
      return sendResponse(res, 200, true, {
        batchPayment: {
          ...updatedBatch,
          totalAmount: parseFloat(updatedBatch.totalAmount.toString())
        },
        kcbResponse: {
          reference: kcbResponse.reference,
          message: kcbResponse.message,
        },
      }, `KCB deposit initiated for batch ${batchPayment.batchReference}. Check your phone to complete the transaction.`);

    } catch (kcbError) {
      debugLog('KCB deposit initiation failed:', kcbError.message);
      return sendResponse(res, 500, false, null, `Failed to initiate KCB deposit: ${kcbError.message}`, {
        code: 'KCB_DEPOSIT_ERROR',
        details: kcbError.message,
      });
    }

  } catch (error) {
    debugLog('Error processing batch deposit:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error processing batch deposit.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Complete batch payment processing (called after successful KCB callback)
exports.completeBatchPayment = async (req, res) => {
  debugLog('Complete Batch Payment attempt started');
  try {
    const { batchId } = req.params;
    const { kcbTransactionId, kcbReceiptNumber } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const batchPayment = await tx.batchPayment.findUnique({
        where: { id: parseInt(batchId) },
        include: {
          payments: {
            include: {
              user: { select: { fullName: true, phone: true, email: true } },
            },
          },
        },
      });

      if (!batchPayment) {
        throw new Error('Batch payment not found');
      }

      if (batchPayment.status !== 'DEPOSITED') {
        throw new Error('Batch payment is not in deposited status');
      }

      // Update all individual payments to completed status
      const completedPayments = [];
      for (const payment of batchPayment.payments) {
        const receiptNumber = generateReceiptNumber(payment.paymentType);
        
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'COMPLETED',
            receiptNumber,
            kcbTransactionId: kcbTransactionId || batchPayment.kcbTransactionId,
            bankDepositStatus: 'DEPOSITED',
            isBatchProcessed: true,
            updatedAt: new Date(),
          },
        });

        // Create receipt for each payment
        await tx.receipt.create({
          data: {
            receiptNumber,
            paymentId: payment.id,
            userId: payment.userId,
            generatedById: batchPayment.processedById,
            receiptDate: new Date(),
            receiptData: {
              paymentId: payment.id,
              amount: parseFloat(payment.amount.toString()),
              paymentType: payment.paymentType,
              userName: payment.user.fullName,
              paymentDate: payment.paymentDate,
              description: payment.description,
              batchReference: batchPayment.batchReference,
              kcbTransactionId: kcbTransactionId || batchPayment.kcbTransactionId,
              titheDesignations: payment.paymentType === 'TITHE' ? payment.titheDistributionSDA : null,
            },
          },
        });

        completedPayments.push({
          ...updatedPayment,
          amount: parseFloat(updatedPayment.amount.toString())
        });
      }

      // Update batch payment status
      const finalBatchPayment = await tx.batchPayment.update({
        where: { id: parseInt(batchId) },
        data: {
          status: 'COMPLETED',
          kcbTransactionId: kcbTransactionId || batchPayment.kcbTransactionId,
          updatedAt: new Date(),
        },
      });

      return { 
        batchPayment: {
          ...finalBatchPayment,
          totalAmount: parseFloat(finalBatchPayment.totalAmount.toString())
        }, 
        completedPayments 
      };
    }, {
      maxWait: 30000,
      timeout: 120000,
    });

    await logAdminActivity('COMPLETE_BATCH_PAYMENT', result.batchPayment.id, req.user.id, { 
      batchReference: result.batchPayment.batchReference,
      completedPayments: result.completedPayments.length,
      kcbTransactionId: kcbTransactionId || result.batchPayment.kcbTransactionId
    });

    debugLog(`Batch payment completed: ${result.batchPayment.batchReference} with ${result.completedPayments.length} payments`);
    return sendResponse(res, 200, true, {
      batchPayment: result.batchPayment,
      completedPayments: result.completedPayments.length,
    }, `Batch payment completed successfully. ${result.completedPayments.length} payments processed and receipts generated.`);

  } catch (error) {
    debugLog('Error completing batch payment:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, error.message || 'Server error completing batch payment.', {
      code: 'BATCH_COMPLETION_ERROR',
      details: error.message,
    });
  }
};

// Get all batch payments
exports.getAllBatchPayments = async (req, res) => {
  debugLog('Get All Batch Payments attempt started');
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const whereConditions = {};
    if (status && status !== 'ALL') {
      whereConditions.status = status;
    }

    const batchPayments = await prisma.batchPayment.findMany({
      where: whereConditions,
      include: {
        creator: { select: { id: true, username: true, fullName: true } },
        processor: { select: { id: true, username: true, fullName: true } },
        _count: { select: { payments: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const totalBatches = await prisma.batchPayment.count({ where: whereConditions });

    debugLog(`Retrieved ${batchPayments.length} batch payments`);
    return sendResponse(res, 200, true, {
      batchPayments: batchPayments.map(batch => ({
        ...batch,
        totalAmount: parseFloat(batch.totalAmount.toString()),
        paymentCount: batch._count.payments,
      })),
      totalPages: Math.ceil(totalBatches / take),
      currentPage: parseInt(page),
      totalBatches,
    }, 'Batch payments retrieved successfully.');

  } catch (error) {
    debugLog('Error getting batch payments:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error retrieving batch payments.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Get batch payment details
exports.getBatchPaymentDetails = async (req, res) => {
  debugLog('Get Batch Payment Details attempt started');
  try {
    const { batchId } = req.params;

    const batchPayment = await prisma.batchPayment.findUnique({
      where: { id: parseInt(batchId) },
      include: {
        creator: { select: { id: true, username: true, fullName: true } },
        processor: { select: { id: true, username: true, fullName: true } },
        payments: {
          include: {
            user: { select: { id: true, username: true, fullName: true, phone: true } },
            specialOffering: { select: { name: true, offeringCode: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!batchPayment) {
      return sendResponse(res, 404, false, null, 'Batch payment not found.', { code: 'BATCH_NOT_FOUND' });
    }

    debugLog(`Retrieved batch payment details: ${batchPayment.batchReference}`);
    return sendResponse(res, 200, true, {
      batchPayment: {
        ...batchPayment,
        totalAmount: parseFloat(batchPayment.totalAmount.toString()),
        payments: batchPayment.payments.map(payment => ({
          ...payment,
          amount: parseFloat(payment.amount.toString()),
        })),
      },
    }, 'Batch payment details retrieved successfully.');

  } catch (error) {
    debugLog('Error getting batch payment details:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error retrieving batch payment details.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Cancel batch payment (only if not yet deposited)
exports.cancelBatchPayment = async (req, res) => {
  debugLog('Cancel Batch Payment attempt started');
  try {
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot cancel batch payments.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const { batchId } = req.params;
    const { reason } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const batchPayment = await tx.batchPayment.findUnique({
        where: { id: parseInt(batchId) },
        include: { payments: true },
      });

      if (!batchPayment) {
        throw new Error('Batch payment not found');
      }

      if (batchPayment.status !== 'PENDING') {
        throw new Error('Only pending batch payments can be cancelled');
      }

      // Cancel all associated payments
      await tx.payment.updateMany({
        where: { batchPaymentId: parseInt(batchId) },
        data: {
          status: 'CANCELLED',
          description: {
            set: `${req.body.description || ''} - CANCELLED: ${reason || 'Batch cancelled by admin'}`.substring(0, 191)
          },
        },
      });

      // Update batch payment status
      const cancelledBatch = await tx.batchPayment.update({
        where: { id: parseInt(batchId) },
        data: {
          status: 'CANCELLED',
          description: `${batchPayment.description} - CANCELLED: ${reason || 'Cancelled by admin'}`,
        },
      });

      return { 
        batchPayment: {
          ...cancelledBatch,
          totalAmount: parseFloat(cancelledBatch.totalAmount.toString())
        }, 
        cancelledPayments: batchPayment.payments.length 
      };
    });

    await logAdminActivity('CANCEL_BATCH_PAYMENT', result.batchPayment.id, req.user.id, { 
      batchReference: result.batchPayment.batchReference,
      reason: reason || 'No reason provided',
      cancelledPayments: result.cancelledPayments
    });

    debugLog(`Batch payment cancelled: ${result.batchPayment.batchReference}`);
    return sendResponse(res, 200, true, {
      batchPayment: result.batchPayment,
      cancelledPayments: result.cancelledPayments,
    }, `Batch payment cancelled successfully. ${result.cancelledPayments} payments cancelled.`);

  } catch (error) {
    debugLog('Error cancelling batch payment:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, error.message || 'Server error cancelling batch payment.', {
      code: 'BATCH_CANCELLATION_ERROR',
      details: error.message,
    });
  }
};

/**
 * Add new items to an existing batch payment
 * @route POST /api/batch-payments/:batchId/add-items
 */
exports.addItemsToBatch = async (req, res) => {
  try {
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot modify batches.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const { batchId } = req.params;
    const { payments } = req.body;

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return sendResponse(res, 400, false, null, 'No payment items provided.', { code: 'INVALID_REQUEST' });
    }

    // Find the batch and verify it's in PENDING status
    const batch = await prisma.batchPayment.findUnique({
      where: { id: parseInt(batchId) }
    });

    if (!batch) {
      return sendResponse(res, 404, false, null, 'Batch not found.', { code: 'BATCH_NOT_FOUND' });
    }

    if (batch.status !== 'PENDING') {
      return sendResponse(res, 400, false, null, 'Can only add items to PENDING batches.', { code: 'INVALID_BATCH_STATUS' });
    }

    // Calculate total amount of new payments only
    const newTotalAmount = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

    // Process new payments within a transaction
    const result = await prisma.$transaction(async (tx) => {
      const createdPayments = [];

      for (const payment of payments) {
        // Validate payment data
        if (!payment.userId || !payment.amount || !payment.paymentType) {
          throw new Error('Invalid payment data');
        }

        // Handle special offering validation
        let processedPaymentType = payment.paymentType;
        let processedSpecialOfferingId = payment.specialOfferingId;
        
        if (!['TITHE', 'OFFERING', 'DONATION', 'EXPENSE'].includes(payment.paymentType)) {
          if (/^\d+$/.test(payment.paymentType)) {
            processedSpecialOfferingId = parseInt(payment.paymentType);
            processedPaymentType = 'SPECIAL_OFFERING_CONTRIBUTION';
          }
        }

        const newPayment = await tx.payment.create({
          data: {
            userId: parseInt(payment.userId),
            amount: parseFloat(payment.amount),
            paymentType: processedPaymentType,
            description: payment.description || '',
            paymentMethod: 'BATCH_KCB',
            status: 'PENDING',
            paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
            processedById: req.user.id,
            batchPaymentId: parseInt(batchId),
            titheDistributionSDA: payment.titheDistributionSDA || null,
            specialOfferingId: processedSpecialOfferingId,
            isExpense: !!payment.isExpense,
            department: payment.department || null,
            isBatchProcessed: false,
            bankDepositStatus: 'PENDING'
          }
        });

        createdPayments.push(newPayment);
      }

      // Update batch totals with only the new amount
      const updatedBatch = await tx.batchPayment.update({
        where: { id: parseInt(batchId) },
        data: {
          totalAmount: { increment: newTotalAmount },
          totalCount: { increment: payments.length }
        },
        include: {
          payments: true
        }
      });

      return { batch: updatedBatch, newPayments: createdPayments };
    });

    await logAdminActivity('ADD_BATCH_ITEMS', parseInt(batchId), req.user.id, {
      itemsAdded: payments.length,
      addedAmount: newTotalAmount,
      batchReference: batch.batchReference
    });

    return sendResponse(res, 200, true, {
      batchPayment: {
        ...result.batch,
        totalAmount: parseFloat(result.batch.totalAmount.toString())
      },
      addedPayments: result.newPayments.length,
      addedAmount: newTotalAmount
    }, `Successfully added ${result.newPayments.length} payments totaling ${newTotalAmount} to batch.`);

  } catch (error) {
    console.error('Error adding items to batch:', error);
    return sendResponse(res, 500, false, null, error.message || 'Server error adding items to batch.', {
      code: 'ADD_ITEMS_ERROR',
      details: error.message
    });
  }
};

module.exports = exports;