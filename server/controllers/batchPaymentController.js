// server/controllers/batchPaymentController.js - ENHANCED PRODUCTION VERSION
const { PrismaClient, Prisma } = require('@prisma/client');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { initiateKcbPayment } = require('../utils/kcbPaymentUtils.js');
const { generateReceiptNumber } = require('../utils/receiptUtils.js');
const { logger } = require('../config/logger');
const WalletService = require('../utils/walletService.js');

const prisma = new PrismaClient();
const walletService = new WalletService();

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
    logger.info(`Admin activity logged: ${actionType} for target ${targetId} by user ${initiatedBy}`);
  } catch (error) {
    logger.error(`Error logging admin activity for ${actionType} on ${targetId}: ${error.message}`);
  }
}

/**
 * Create a new batch payment with enhanced validation
 */
exports.createBatchPayment = async (req, res) => {
  logger.info('Create Batch Payment attempt started', { userId: req.user.id });
  
  try {
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot create batch payments.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation errors on batch payment creation', { errors: errors.array() });
      return sendResponse(res, 400, false, null, 'Validation failed', {
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({ field: err.path, message: err.msg })),
      });
    }

    const { payments, description } = req.body;

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return sendResponse(res, 400, false, null, 'Payments array is required and must not be empty.', { code: 'MISSING_PAYMENTS' });
    }

    if (payments.length > 500) {
      return sendResponse(res, 400, false, null, 'Batch size cannot exceed 500 payments.', { code: 'BATCH_TOO_LARGE' });
    }

    // Enhanced validation for all payments
    const validationErrors = await validateBatchPayments(payments);
    if (validationErrors.length > 0) {
      return sendResponse(res, 400, false, null, 'Payment validation failed', {
        code: 'PAYMENT_VALIDATION_ERROR',
        details: validationErrors
      });
    }

    // Generate unique batch reference with enhanced format
    const batchReference = generateBatchReference();

    const result = await prisma.$transaction(async (tx) => {
      // Calculate totals with enhanced precision
      const totalAmount = payments.reduce((sum, payment) => {
        return sum + parseFloat(payment.amount);
      }, 0);
      const totalCount = payments.length;

      // Create batch payment record with metadata
      const batchPayment = await tx.batchPayment.create({
        data: {
          batchReference,
          totalAmount: Math.round(totalAmount * 100) / 100, // Ensure 2 decimal places
          totalCount,
          description: description || `Batch payment with ${totalCount} transactions`,
          createdById: req.user.id,
          status: 'PENDING',
        },
      });

      // Create individual payment records with enhanced validation
      const createdPayments = [];
      for (let i = 0; i < payments.length; i++) {
        const paymentData = payments[i];
        
        try {
          const payment = await createBatchPaymentItem(paymentData, batchPayment.id, req.user.id, tx, i + 1);
          createdPayments.push(payment);
        } catch (itemError) {
          throw new Error(`Payment ${i + 1}: ${itemError.message}`);
        }
      }

      logger.info(`Batch payment created: ${batchReference} with ${createdPayments.length} payments`);
      return { batchPayment, payments: createdPayments };
    }, {
      maxWait: 30000,
      timeout: 120000,
    });

    await logAdminActivity('CREATE_BATCH_PAYMENT', result.batchPayment.id, req.user.id, { 
      batchReference,
      totalAmount: result.batchPayment.totalAmount,
      totalCount: result.batchPayment.totalCount
    });

    return sendResponse(res, 201, true, {
      batchPayment: {
        ...result.batchPayment,
        totalAmount: parseFloat(result.batchPayment.totalAmount.toString())
      },
      paymentsCreated: result.payments.length,
      batchReference,
    }, `Batch payment created successfully with ${result.payments.length} payments. Ready for KCB deposit.`);

  } catch (error) {
    logger.error('Error creating batch payment', { error: error.message, userId: req.user.id });
    return sendResponse(res, 500, false, null, error.message || 'Server error creating batch payment.', {
      code: 'BATCH_PAYMENT_ERROR',
      details: error.message,
    });
  }
};

/**
 * ENHANCED: Add items to an existing batch payment
 */
exports.addItemsToBatch = async (req, res) => {
  logger.info('Add Items to Batch attempt started', { userId: req.user.id });
  
  try {
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot modify batches.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const { batchId } = req.params;
    const { payments } = req.body;

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return sendResponse(res, 400, false, null, 'No payment items provided.', { code: 'INVALID_REQUEST' });
    }

    if (payments.length > 100) {
      return sendResponse(res, 400, false, null, 'Cannot add more than 100 items at once.', { code: 'TOO_MANY_ITEMS' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Find and validate the batch
      const batch = await tx.batchPayment.findUnique({
        where: { id: parseInt(batchId) },
        include: { 
          _count: { select: { payments: true } },
          creator: { select: { fullName: true } }
        }
      });

      if (!batch) {
        throw new Error('Batch not found.');
      }

      if (batch.status !== 'PENDING') {
        throw new Error(`Can only add items to PENDING batches. Current status: ${batch.status}`);
      }

      // Check batch size limits
      const currentCount = batch._count.payments;
      if (currentCount + payments.length > 500) {
        throw new Error(`Batch size limit exceeded. Current: ${currentCount}, Adding: ${payments.length}, Max: 500`);
      }

      // Validate all new payments
      const validationErrors = await validateBatchPayments(payments);
      if (validationErrors.length > 0) {
        throw new Error(`Payment validation failed: ${validationErrors.map(e => e.message).join(', ')}`);
      }

      // Calculate new amounts
      const addedAmount = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

      // Create new payment items
      const createdPayments = [];
      for (let i = 0; i < payments.length; i++) {
        const paymentData = payments[i];
        
        try {
          const payment = await createBatchPaymentItem(
            paymentData, 
            parseInt(batchId), 
            req.user.id, 
            tx, 
            currentCount + i + 1
          );
          createdPayments.push(payment);
        } catch (itemError) {
          throw new Error(`Payment ${i + 1}: ${itemError.message}`);
        }
      }

      // Update batch totals atomically
      const updatedBatch = await tx.batchPayment.update({
        where: { id: parseInt(batchId) },
        data: {
          totalAmount: { increment: Math.round(addedAmount * 100) / 100 },
          totalCount: { increment: payments.length },
          updatedAt: new Date()
        },
        include: {
          creator: { select: { fullName: true, username: true } },
          _count: { select: { payments: true } }
        }
      });

      logger.info(`Added ${createdPayments.length} items to batch ${batch.batchReference}`, {
        batchId: batch.id,
        addedCount: createdPayments.length,
        addedAmount,
        newTotal: updatedBatch.totalAmount
      });

      return { 
        batch: updatedBatch, 
        newPayments: createdPayments,
        addedAmount: Math.round(addedAmount * 100) / 100
      };
    }, {
      maxWait: 20000,
      timeout: 60000,
    });

    await logAdminActivity('ADD_BATCH_ITEMS', parseInt(batchId), req.user.id, {
      itemsAdded: result.newPayments.length,
      addedAmount: result.addedAmount,
      batchReference: result.batch.batchReference
    });

    return sendResponse(res, 200, true, {
      batchPayment: {
        ...result.batch,
        totalAmount: parseFloat(result.batch.totalAmount.toString())
      },
      addedPayments: result.newPayments.length,
      addedAmount: result.addedAmount,
      summary: {
        totalPayments: result.batch.totalCount,
        totalAmount: parseFloat(result.batch.totalAmount.toString())
      }
    }, `Successfully added ${result.newPayments.length} payments totaling KES ${result.addedAmount.toFixed(2)} to batch.`);

  } catch (error) {
    logger.error('Error adding items to batch', { 
      error: error.message, 
      batchId: req.params.batchId,
      userId: req.user.id 
    });
    return sendResponse(res, 500, false, null, error.message || 'Server error adding items to batch.', {
      code: 'ADD_ITEMS_ERROR',
      details: error.message
    });
  }
};

/**
 * Process batch payment deposit via KCB with enhanced error handling
 */
exports.processBatchDeposit = async (req, res) => {
  logger.info('Process Batch Deposit attempt started', { userId: req.user.id });
  
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
        creator: { select: { fullName: true } }
      },
    });

    if (!batchPayment) {
      return sendResponse(res, 404, false, null, 'Batch payment not found.', { code: 'BATCH_NOT_FOUND' });
    }

    if (batchPayment.status !== 'PENDING') {
      return sendResponse(res, 400, false, null, `Batch payment is not pending deposit. Current status: ${batchPayment.status}`, { code: 'INVALID_BATCH_STATUS' });
    }

    if (batchPayment.payments.length === 0) {
      return sendResponse(res, 400, false, null, 'Cannot process empty batch payment.', { code: 'EMPTY_BATCH' });
    }

    const userPhoneForPayment = phoneNumber || req.user.phone;
    if (!userPhoneForPayment) {
      return sendResponse(res, 400, false, null, 'Phone number is required for KCB deposit.', { code: 'PHONE_REQUIRED' });
    }

    // Validate phone number format
    const phonePattern = /^(\+254|0)?[17]\d{8}$/;
    if (!phonePattern.test(userPhoneForPayment)) {
      return sendResponse(res, 400, false, null, 'Invalid Kenyan phone number format.', { code: 'INVALID_PHONE' });
    }

    const description = depositDescription || `Batch deposit: ${batchPayment.batchReference}`;
    const amount = parseFloat(batchPayment.totalAmount.toString());
    
    try {
      // Initiate KCB payment with enhanced error handling
      const kcbResponse = await initiateKcbPayment(
        batchPayment.batchReference,
        amount,
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
        totalAmount: amount,
        kcbReference: kcbResponse.reference,
        phoneNumber: userPhoneForPayment.replace(/\d(?=\d{4})/g, '*') // Mask phone number in logs
      });

      logger.info(`Batch deposit initiated: ${batchPayment.batchReference}`, {
        kcbReference: kcbResponse.reference,
        amount,
        paymentsCount: batchPayment.payments.length
      });

      return sendResponse(res, 200, true, {
        batchPayment: {
          ...updatedBatch,
          totalAmount: parseFloat(updatedBatch.totalAmount.toString())
        },
        kcbResponse: {
          reference: kcbResponse.reference,
          message: kcbResponse.message,
        },
        summary: {
          paymentsCount: batchPayment.payments.length,
          totalAmount: amount
        }
      }, `KCB deposit initiated for batch ${batchPayment.batchReference}. Check your phone to complete the transaction.`);

    } catch (kcbError) {
      logger.error('KCB deposit initiation failed', { 
        error: kcbError.message, 
        batchId,
        amount 
      });
      return sendResponse(res, 500, false, null, `Failed to initiate KCB deposit: ${kcbError.message}`, {
        code: 'KCB_DEPOSIT_ERROR',
        details: kcbError.message,
      });
    }

  } catch (error) {
    logger.error('Error processing batch deposit', { 
      error: error.message, 
      batchId: req.params.batchId,
      userId: req.user.id 
    });
    return sendResponse(res, 500, false, null, 'Server error processing batch deposit.', { 
      code: 'SERVER_ERROR', 
      details: error.message 
    });
  }
};

/**
 * Complete batch payment processing with wallet updates
 */
exports.completeBatchPayment = async (req, res) => {
  logger.info('Complete Batch Payment attempt started', { userId: req.user.id });
  
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
              specialOffering: { select: { name: true, offeringCode: true } }
            },
          },
        },
      });

      if (!batchPayment) {
        throw new Error('Batch payment not found');
      }

      if (batchPayment.status !== 'DEPOSITED') {
        throw new Error(`Batch payment is not in deposited status: ${batchPayment.status}`);
      }

      // Update all individual payments to completed status with receipts
      const completedPayments = [];
      const walletUpdateErrors = [];
      
      for (const payment of batchPayment.payments) {
        try {
          const receiptNumber = generateReceiptNumber(payment.paymentType);
          
          // Update payment status
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

          // Create receipt
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
                specialOffering: payment.specialOffering
              },
            },
          });

          // Update wallets for each completed payment
          try {
            await walletService.updateWalletsForPayment(payment.id, tx);
            logger.info(`Wallets updated for batch payment ${payment.id}`);
          } catch (walletError) {
            logger.error(`Wallet update failed for payment ${payment.id}`, { error: walletError.message });
            walletUpdateErrors.push({ paymentId: payment.id, error: walletError.message });
          }

          completedPayments.push({
            ...updatedPayment,
            amount: parseFloat(updatedPayment.amount.toString())
          });

        } catch (paymentError) {
          logger.error(`Error completing payment ${payment.id}`, { error: paymentError.message });
          throw new Error(`Failed to complete payment ${payment.id}: ${paymentError.message}`);
        }
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
        completedPayments,
        walletUpdateErrors
      };
    }, {
      maxWait: 60000,
      timeout: 300000, // 5 minutes for large batches
    });

    await logAdminActivity('COMPLETE_BATCH_PAYMENT', result.batchPayment.id, req.user.id, { 
      batchReference: result.batchPayment.batchReference,
      completedPayments: result.completedPayments.length,
      kcbTransactionId: kcbTransactionId || result.batchPayment.kcbTransactionId,
      walletErrors: result.walletUpdateErrors.length
    });

    let message = `Batch payment completed successfully. ${result.completedPayments.length} payments processed and receipts generated.`;
    if (result.walletUpdateErrors.length > 0) {
      message += ` Note: ${result.walletUpdateErrors.length} wallet update errors occurred.`;
    }

    logger.info(`Batch payment completed: ${result.batchPayment.batchReference}`, {
      completedPayments: result.completedPayments.length,
      walletErrors: result.walletUpdateErrors.length
    });

    return sendResponse(res, 200, true, {
      batchPayment: result.batchPayment,
      completedPayments: result.completedPayments.length,
      summary: {
        paymentsCompleted: result.completedPayments.length,
        receiptsGenerated: result.completedPayments.length,
        walletsUpdated: result.completedPayments.length - result.walletUpdateErrors.length,
        walletErrors: result.walletUpdateErrors.length
      },
      walletUpdateErrors: result.walletUpdateErrors.length > 0 ? result.walletUpdateErrors : undefined
    }, message);

  } catch (error) {
    logger.error('Error completing batch payment', { 
      error: error.message, 
      batchId: req.params.batchId,
      userId: req.user.id 
    });
    return sendResponse(res, 500, false, null, error.message || 'Server error completing batch payment.', {
      code: 'BATCH_COMPLETION_ERROR',
      details: error.message,
    });
  }
};

/**
 * Get all batch payments with enhanced filtering and pagination
 */
exports.getAllBatchPayments = async (req, res) => {
  logger.info('Get All Batch Payments attempt started', { userId: req.user.id });
  
  try {
    const { status, page = 1, limit = 20, startDate, endDate, search } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const whereConditions = {};
    if (status && status !== 'ALL') {
      whereConditions.status = status;
    }

    if (startDate || endDate) {
      whereConditions.createdAt = {};
      if (startDate) whereConditions.createdAt.gte = new Date(startDate);
      if (endDate) whereConditions.createdAt.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    if (search) {
      whereConditions.OR = [
        { batchReference: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { creator: { fullName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [batchPayments, totalBatches] = await Promise.all([
      prisma.batchPayment.findMany({
        where: whereConditions,
        include: {
          creator: { select: { id: true, username: true, fullName: true } },
          processor: { select: { id: true, username: true, fullName: true } },
          _count: { select: { payments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.batchPayment.count({ where: whereConditions })
    ]);

    // Enhanced batch data with status indicators
    const enhancedBatches = batchPayments.map(batch => ({
      ...batch,
      totalAmount: parseFloat(batch.totalAmount.toString()),
      paymentCount: batch._count.payments,
      statusColor: getStatusColor(batch.status),
      canModify: batch.status === 'PENDING',
      canProcess: batch.status === 'PENDING' && batch._count.payments > 0,
      canComplete: batch.status === 'DEPOSITED'
    }));

    logger.info(`Retrieved ${batchPayments.length} batch payments`);
    
    return sendResponse(res, 200, true, {
      batchPayments: enhancedBatches,
      pagination: {
        totalPages: Math.ceil(totalBatches / take),
        currentPage: parseInt(page),
        totalBatches,
        hasNextPage: skip + take < totalBatches,
        hasPreviousPage: parseInt(page) > 1
      },
      summary: {
        totalAmount: enhancedBatches.reduce((sum, batch) => sum + batch.totalAmount, 0),
        totalPayments: enhancedBatches.reduce((sum, batch) => sum + batch.paymentCount, 0)
      }
    }, 'Batch payments retrieved successfully.');

  } catch (error) {
    logger.error('Error getting batch payments', { error: error.message, userId: req.user.id });
    return sendResponse(res, 500, false, null, 'Server error retrieving batch payments.', { 
      code: 'SERVER_ERROR', 
      details: error.message 
    });
  }
};

/**
 * Get batch payment details with comprehensive information
 */
exports.getBatchPaymentDetails = async (req, res) => {
  logger.info('Get Batch Payment Details attempt started', { userId: req.user.id });
  
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

    // Calculate summary statistics
    const summary = {
      totalAmount: parseFloat(batchPayment.totalAmount.toString()),
      totalCount: batchPayment.totalCount,
      completedCount: batchPayment.payments.filter(p => p.status === 'COMPLETED').length,
      pendingCount: batchPayment.payments.filter(p => p.status === 'PENDING').length,
      failedCount: batchPayment.payments.filter(p => p.status === 'FAILED').length,
      averageAmount: batchPayment.totalCount > 0 ? parseFloat((parseFloat(batchPayment.totalAmount.toString()) / batchPayment.totalCount).toFixed(2)) : 0,
      paymentTypes: {}
    };

    // Group by payment types
    batchPayment.payments.forEach(payment => {
      const type = payment.paymentType;
      if (!summary.paymentTypes[type]) {
        summary.paymentTypes[type] = { count: 0, amount: 0 };
      }
      summary.paymentTypes[type].count++;
      summary.paymentTypes[type].amount += parseFloat(payment.amount.toString());
    });

    // Round payment type amounts
    Object.keys(summary.paymentTypes).forEach(type => {
      summary.paymentTypes[type].amount = Math.round(summary.paymentTypes[type].amount * 100) / 100;
    });

    logger.info(`Retrieved batch payment details: ${batchPayment.batchReference}`);
    
    return sendResponse(res, 200, true, {
      batchPayment: {
        ...batchPayment,
        totalAmount: parseFloat(batchPayment.totalAmount.toString()),
        payments: batchPayment.payments.map(payment => ({
          ...payment,
          amount: parseFloat(payment.amount.toString()),
        })),
        canModify: batchPayment.status === 'PENDING',
        canProcess: batchPayment.status === 'PENDING' && batchPayment.payments.length > 0,
        canComplete: batchPayment.status === 'DEPOSITED'
      },
      summary
    }, 'Batch payment details retrieved successfully.');

  } catch (error) {
    logger.error('Error getting batch payment details', { 
      error: error.message, 
      batchId: req.params.batchId,
      userId: req.user.id 
    });
    return sendResponse(res, 500, false, null, 'Server error retrieving batch payment details.', { 
      code: 'SERVER_ERROR', 
      details: error.message 
    });
  }
};

/**
 * Cancel batch payment with enhanced validation
 */
exports.cancelBatchPayment = async (req, res) => {
  logger.info('Cancel Batch Payment attempt started', { userId: req.user.id });
  
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

      if (!['PENDING', 'DEPOSITED'].includes(batchPayment.status)) {
        throw new Error(`Cannot cancel batch with status: ${batchPayment.status}`);
      }

      // Cancel all associated payments
      const updatePromises = batchPayment.payments.map(payment => {
        const newDescription = `${payment.description || ''} - CANCELLED: ${reason || 'Batch cancelled by admin'}`.substring(0, 191);
        return tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'CANCELLED',
            description: newDescription,
            updatedAt: new Date()
          }
        });
      });

      await Promise.all(updatePromises);

      // Update batch payment status
      const cancelledBatch = await tx.batchPayment.update({
        where: { id: parseInt(batchId) },
        data: {
          status: 'CANCELLED',
          description: `${batchPayment.description} - CANCELLED: ${reason || 'Cancelled by admin'}`,
          updatedAt: new Date()
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

    logger.info(`Batch payment cancelled: ${result.batchPayment.batchReference}`, {
      reason: reason || 'No reason provided',
      cancelledPayments: result.cancelledPayments
    });
    
    return sendResponse(res, 200, true, {
      batchPayment: result.batchPayment,
      cancelledPayments: result.cancelledPayments,
    }, `Batch payment cancelled successfully. ${result.cancelledPayments} payments cancelled.`);

  } catch (error) {
    logger.error('Error cancelling batch payment', { 
      error: error.message, 
      batchId: req.params.batchId,
      userId: req.user.id 
    });
    return sendResponse(res, 500, false, null, error.message || 'Server error cancelling batch payment.', {
      code: 'BATCH_CANCELLATION_ERROR',
      details: error.message,
    });
  }
};

// ===== HELPER FUNCTIONS =====

/**
 * Generate unique batch reference
 */
function generateBatchReference() {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '').substring(0, 14);
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `BATCH-${timestamp}-${randomPart}`;
}

/**
 * Validate batch payments array
 */
async function validateBatchPayments(payments) {
  const errors = [];
  
  for (let i = 0; i < payments.length; i++) {
    const payment = payments[i];
    const position = i + 1;
    
    // Required fields validation
    if (!payment.userId || !payment.amount || !payment.paymentType) {
      errors.push({
        position,
        field: 'required',
        message: `Missing required fields (userId, amount, paymentType)`
      });
      continue;
    }

    // Amount validation
    const amount = parseFloat(payment.amount);
    if (isNaN(amount) || amount <= 0) {
      errors.push({
        position,
        field: 'amount',
        message: `Amount must be a positive number`
      });
    }

    // User validation
    try {
      const user = await prisma.user.findUnique({ 
        where: { id: parseInt(payment.userId) },
        select: { id: true, isActive: true }
      });
      
      if (!user) {
        errors.push({
          position,
          field: 'userId',
          message: `User with ID ${payment.userId} not found`
        });
      } else if (!user.isActive) {
        errors.push({
          position,
          field: 'userId',
          message: `User with ID ${payment.userId} is inactive`
        });
      }
    } catch (dbError) {
      errors.push({
        position,
        field: 'userId',
        message: `Error validating user: ${dbError.message}`
      });
    }

    // Special offering validation
    if (payment.paymentType === 'SPECIAL_OFFERING_CONTRIBUTION' && payment.specialOfferingId) {
      try {
        const offering = await prisma.specialOffering.findUnique({ 
          where: { id: parseInt(payment.specialOfferingId) },
          select: { id: true, isActive: true, endDate: true }
        });
        
        if (!offering) {
          errors.push({
            position,
            field: 'specialOfferingId',
            message: `Special offering with ID ${payment.specialOfferingId} not found`
          });
        } else if (!offering.isActive) {
          errors.push({
            position,
            field: 'specialOfferingId',
            message: `Special offering with ID ${payment.specialOfferingId} is not active`
          });
        } else if (offering.endDate && new Date(offering.endDate) < new Date()) {
          errors.push({
            position,
            field: 'specialOfferingId',
            message: `Special offering with ID ${payment.specialOfferingId} has ended`
          });
        }
      } catch (dbError) {
        errors.push({
          position,
          field: 'specialOfferingId',
          message: `Error validating special offering: ${dbError.message}`
        });
      }
    }
  }
  
  return errors;
}

/**
 * Create individual batch payment item
 */
async function createBatchPaymentItem(paymentData, batchId, processedById, tx, position) {
  // Handle special offering validation and conversion
  let processedPaymentType = paymentData.paymentType;
  let processedSpecialOfferingId = paymentData.specialOfferingId;
  
  if (!['TITHE', 'OFFERING', 'DONATION', 'EXPENSE'].includes(paymentData.paymentType)) {
    if (/^\d+$/.test(paymentData.paymentType)) {
      processedSpecialOfferingId = parseInt(paymentData.paymentType);
      processedPaymentType = 'SPECIAL_OFFERING_CONTRIBUTION';
    }
  }

  // Validate tithe distribution if provided
  let validatedTitheDistribution = null;
  if (processedPaymentType === 'TITHE' && paymentData.titheDistributionSDA) {
    const validation = walletService.validateTitheDistribution(
      paymentData.titheDistributionSDA, 
      parseFloat(paymentData.amount)
    );
    
    if (!validation.valid) {
      throw new Error(`Invalid tithe distribution: ${validation.errors.join(', ')}`);
    }
    
    validatedTitheDistribution = paymentData.titheDistributionSDA;
  }

  // Create payment record
  const paymentRecord = await tx.payment.create({
    data: {
      userId: parseInt(paymentData.userId),
      amount: Math.round(parseFloat(paymentData.amount) * 100) / 100, // Ensure 2 decimal places
      paymentType: processedPaymentType,
      paymentMethod: 'BATCH_KCB',
      description: paymentData.description || `${processedPaymentType} payment (Batch)`,
      status: 'PENDING',
      paymentDate: paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date(),
      processedById: processedById,
      isExpense: !!paymentData.isExpense,
      department: paymentData.department || null,
      specialOfferingId: processedSpecialOfferingId || null,
      titheDistributionSDA: validatedTitheDistribution,
      batchPaymentId: batchId,
      isBatchProcessed: false,
      bankDepositStatus: 'PENDING',
    },
    include: {
      user: { select: { fullName: true, phone: true, email: true } },
      specialOffering: { select: { name: true, offeringCode: true } },
    },
  });

  return paymentRecord;
}

/**
 * Get status color for UI
 */
function getStatusColor(status) {
  const colors = {
    'PENDING': 'orange',
    'DEPOSITED': 'blue', 
    'COMPLETED': 'green',
    'CANCELLED': 'red',
    'FAILED': 'red'
  };
  return colors[status] || 'gray';
}

module.exports = exports;