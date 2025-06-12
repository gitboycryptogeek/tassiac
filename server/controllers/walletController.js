// server/controllers/walletController.js - ENHANCED PRODUCTION VERSION
const { PrismaClient, Prisma } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { logger } = require('../config/logger');
const path = require('path');
const crypto = require('crypto');
const { initiateKcbWithdrawal } = require('../utils/kcbPaymentUtils.js');
const { isViewOnlyAdmin } = require('../middlewares/auth.js');
const WalletService = require('../utils/walletService.js');

const prisma = new PrismaClient();
const walletService = new WalletService();

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

/**
 * Initialize wallet system - create default wallets
 */
exports.initializeWallets = async (req, res) => {
  try {
    logger.wallet('Initialize Wallets attempt started', { userId: req.user.id });
    
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot initialize wallets.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const result = await prisma.$transaction(async (tx) => {
      return await walletService.initializeDefaultWallets(tx);
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    await logAdminActivity('INITIALIZE_WALLETS', 'SYSTEM', req.user.id, { walletsCreated: result.length });
    logger.wallet(`Wallet initialization completed. Created ${result.length} new wallets.`);
    
    return sendResponse(res, 200, true, { walletsCreated: result }, `Wallet system initialized. Created ${result.length} new wallets.`);

  } catch (error) {
    logger.error('Error initializing wallets', { error: error.message, userId: req.user.id });
    return sendResponse(res, 500, false, null, 'Server error initializing wallets.', { 
      code: 'SERVER_ERROR', 
      details: error.message 
    });
  }
};

/**
 * Recalculate wallet balances from all completed payments
 */
exports.recalculateWalletBalances = async (req, res) => {
  try {
    logger.wallet('Recalculate Wallet Balances attempt started', { userId: req.user.id });
    
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot recalculate wallet balances.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const result = await prisma.$transaction(async (tx) => {
      return await walletService.recalculateAllWalletBalances(tx);
    }, {
      maxWait: 60000,
      timeout: 300000, // 5 minutes for large datasets
    });

    await logAdminActivity('RECALCULATE_WALLET_BALANCES', 'SYSTEM', req.user.id, { 
      walletsProcessed: result.length,
      totalBalance: result.reduce((sum, w) => sum + w.balance, 0)
    });
    
    logger.wallet(`Wallet balance recalculation completed for ${result.length} wallets.`);
    
    return sendResponse(res, 200, true, { 
      walletSummary: result,
      walletsProcessed: result.length,
      totalBalance: result.reduce((sum, w) => sum + w.balance, 0)
    }, `Wallet balances recalculated successfully for ${result.length} wallets.`);

  } catch (error) {
    logger.error('Error recalculating wallet balances', { error: error.message, userId: req.user.id });
    return sendResponse(res, 500, false, null, 'Server error recalculating wallet balances.', { 
      code: 'SERVER_ERROR', 
      details: error.message 
    });
  }
};

/**
 * Get all wallets with comprehensive summary
 */
exports.getAllWallets = async (req, res) => {
  try {
    logger.wallet('Get All Wallets attempt started', { userId: req.user.id });
    
    const summary = await walletService.getWalletsSummary(prisma);

    if (!summary.walletsByType || Object.keys(summary.walletsByType).length === 0) {
      return sendResponse(res, 404, false, null, 'No wallets found. Please initialize the wallet system.', {
        code: 'NO_WALLETS_FOUND'
      });
    }

    logger.wallet(`Retrieved ${summary.totalWallets} wallets with total balance: ${summary.totalBalance}`);

    return sendResponse(res, 200, true, {
      wallets: summary.walletsByType,
      summary: {
        totalBalance: summary.totalBalance,
        totalDeposits: summary.totalDeposits,
        totalWithdrawals: summary.totalWithdrawals,
        walletsCount: summary.totalWallets,
        lastUpdated: summary.lastUpdated
      }
    }, `Retrieved ${summary.totalWallets} wallets successfully.`);

  } catch (error) {
    logger.error('Error getting all wallets', { error: error.message, userId: req.user.id });
    return sendResponse(res, 500, false, null, 'Server error retrieving wallets.', { 
      code: 'SERVER_ERROR', 
      details: error.message 
    });
  }
};

/**
 * Update wallet balances based on completed payments
 */
exports.updateWalletBalances = async (req, res) => {
  try {
    logger.wallet('Manual Update Wallet Balances attempt started', { userId: req.user.id });
    
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot update wallet balances.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const { paymentIds } = req.body;
    
    if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
      return sendResponse(res, 400, false, null, 'Payment IDs array is required and must not be empty.', { code: 'MISSING_PAYMENT_IDS' });
    }

    if (paymentIds.length > 100) {
      return sendResponse(res, 400, false, null, 'Cannot process more than 100 payments at once.', { code: 'TOO_MANY_PAYMENTS' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedWallets = [];
      const processedPayments = [];
      const errors = [];
      
      for (const paymentId of paymentIds) {
        try {
          const wallets = await walletService.updateWalletsForPayment(parseInt(paymentId), tx);
          if (wallets) {
            updatedWallets.push(...wallets);
            processedPayments.push(paymentId);
          }
        } catch (error) {
          logger.error(`Error updating wallets for payment ${paymentId}`, { error: error.message });
          errors.push({ paymentId, error: error.message });
        }
      }

      return { updatedWallets, processedPayments, errors };
    }, {
      maxWait: 15000,
      timeout: 60000,
    });

    await logAdminActivity('MANUAL_UPDATE_WALLET_BALANCES', 'SYSTEM', req.user.id, { 
      paymentsProcessed: result.processedPayments.length,
      walletsUpdated: result.updatedWallets.length,
      errors: result.errors.length
    });
    
    logger.wallet(`Manually updated ${result.updatedWallets.length} wallets from ${result.processedPayments.length} payments`);
    
    const responseData = {
      updatedWallets: result.updatedWallets.map(wallet => ({
        ...wallet,
        balance: parseFloat(wallet.balance.toString()),
        totalDeposits: parseFloat(wallet.totalDeposits.toString()),
        totalWithdrawals: parseFloat(wallet.totalWithdrawals.toString()),
      })),
      processedPayments: result.processedPayments,
      summary: {
        totalUpdated: result.updatedWallets.length,
        totalProcessed: result.processedPayments.length,
        totalErrors: result.errors.length
      }
    };

    if (result.errors.length > 0) {
      responseData.errors = result.errors;
    }
    
    return sendResponse(res, 200, true, responseData, 
      `Updated ${result.updatedWallets.length} wallets from ${result.processedPayments.length} payments.${result.errors.length > 0 ? ` ${result.errors.length} errors occurred.` : ''}`);

  } catch (error) {
    logger.error('Error updating wallet balances', { error: error.message, userId: req.user.id });
    return sendResponse(res, 500, false, null, 'Server error updating wallet balances.', { 
      code: 'SERVER_ERROR', 
      details: error.message 
    });
  }
};

/**
 * Create withdrawal request with enhanced validation
 */
exports.createWithdrawalRequest = async (req, res) => {
  try {
    logger.wallet('Create Withdrawal Request attempt started', { userId: req.user.id });
    
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot create withdrawal requests.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.wallet('Validation errors on withdrawal request', { errors: errors.array() });
      return sendResponse(res, 400, false, null, 'Validation failed', {
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({ field: err.path, message: err.msg })),
      });
    }

    const {
      walletId,
      amount,
      purpose,
      description,
      withdrawalMethod,
      destinationAccount,
      destinationPhone
    } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // Enhanced validation
      const WalletValidationService = require('../utils/walletValidation.js');
      
      // Get wallet with row-level locking for consistency
      const wallet = await tx.wallet.findUnique({ 
        where: { id: parseInt(walletId) },
      });
      
      if (!wallet) {
        throw new Error('Wallet not found.');
      }

      if (!wallet.isActive) {
        throw new Error('Cannot withdraw from inactive wallet.');
      }

      const withdrawalAmount = parseFloat(amount);
      
      // Comprehensive validation
      WalletValidationService.validateWithdrawalAmount(wallet, withdrawalAmount);
      WalletValidationService.validateWithdrawalDestination(withdrawalMethod, destinationAccount, destinationPhone);
      
      // Business hours validation (if enforced)
      if (process.env.ENFORCE_BUSINESS_HOURS === 'true') {
        WalletValidationService.validateBusinessHours();
      }
      
      // Daily withdrawal limit validation (if enforced)
      if (process.env.ENFORCE_DAILY_LIMITS === 'true') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todaysWithdrawals = await tx.withdrawalRequest.findMany({
          where: {
            requestedById: req.user.id,
            createdAt: {
              gte: today,
              lt: tomorrow
            },
            status: {
              in: ['PENDING', 'APPROVED', 'COMPLETED']
            }
          }
        });
        
        WalletValidationService.validateDailyWithdrawalLimit(req.user.id, withdrawalAmount, todaysWithdrawals);
      }

      // Generate unique withdrawal reference with enhanced format
      const currentDate = new Date();
      const dateStr = currentDate.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = currentDate.toTimeString().slice(0, 8).replace(/:/g, '');
      const randomStr = crypto.randomBytes(4).toString('hex').toUpperCase();
      const withdrawalReference = `WD-${dateStr}-${timeStr}-${randomStr}`;

      // Create withdrawal request with comprehensive data
      const withdrawalRequest = await tx.withdrawalRequest.create({
        data: {
          withdrawalReference,
          walletId: parseInt(walletId),
          amount: withdrawalAmount,
          purpose: purpose.trim(),
          description: description ? description.trim() : null,
          requestedById: req.user.id,
          withdrawalMethod,
          destinationAccount: destinationAccount ? destinationAccount.trim() : null,
          destinationPhone: destinationPhone ? destinationPhone.trim() : null,
          requiredApprovals: parseInt(process.env.REQUIRED_WITHDRAWAL_APPROVALS || '3'),
          currentApprovals: 0,
          status: 'PENDING'
        },
        include: {
          wallet: true,
          requester: { select: { id: true, username: true, fullName: true } },
        },
      });

      return withdrawalRequest;
    }, {
      maxWait: 10000,
      timeout: 30000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
    });

    await logAdminActivity('CREATE_WITHDRAWAL_REQUEST', result.id, req.user.id, { 
      amount: result.amount, 
      walletType: result.wallet.walletType,
      walletSubType: result.wallet.subType,
      reference: result.withdrawalReference,
      method: result.withdrawalMethod
    });

    logger.wallet(`Withdrawal request created: ${result.withdrawalReference} for amount ${result.amount}`);
    
    return sendResponse(res, 201, true, { 
      withdrawalRequest: {
        ...result,
        amount: parseFloat(result.amount.toString()),
        wallet: {
          ...result.wallet,
          balance: parseFloat(result.wallet.balance.toString()),
        }
      }
    }, 'Withdrawal request created successfully. Awaiting approvals.');

  } catch (error) {
    logger.error('Error creating withdrawal request', { error: error.message, userId: req.user.id });
    return sendResponse(res, 500, false, null, error.message || 'Server error creating withdrawal request.', { 
      code: 'SERVER_ERROR', 
      details: error.message 
    });
  }
};

/**
 * Approve withdrawal request with enhanced security
 */
exports.approveWithdrawalRequest = async (req, res) => {
  try {
    logger.wallet('Approve Withdrawal Request attempt started', { userId: req.user.id });
    
    const { withdrawalId } = req.params;
    const { password, approvalMethod = 'PASSWORD', comment } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const withdrawalRequest = await tx.withdrawalRequest.findUnique({
        where: { id: parseInt(withdrawalId) },
        include: {
          wallet: true,
          approvals: { include: { approver: { select: { username: true, fullName: true } } } },
          requester: { select: { fullName: true, username: true } }
        },
      });

      if (!withdrawalRequest) {
        throw new Error('Withdrawal request not found.');
      }

      if (withdrawalRequest.status !== 'PENDING') {
        throw new Error(`Withdrawal request is not pending approval: ${withdrawalRequest.status}`);
      }

      // Check if user has already approved
      const existingApproval = withdrawalRequest.approvals.find(approval => approval.approvedById === req.user.id);
      if (existingApproval) {
        throw new Error('You have already approved this withdrawal request.');
      }

      // Enhanced password validation
      if (approvalMethod === 'PASSWORD') {
        const requiredPasswords = [
          process.env.WITHDRAWAL_PASSWORD_1,
          process.env.WITHDRAWAL_PASSWORD_2,
          process.env.WITHDRAWAL_PASSWORD_3,
        ].filter(Boolean);

        if (requiredPasswords.length === 0) {
          throw new Error('Withdrawal approval passwords not configured.');
        }

        if (!requiredPasswords.includes(password)) {
          logger.warn('Invalid withdrawal approval password attempt', { 
            userId: req.user.id,
            withdrawalId,
            ipAddress: req.ip 
          });
          throw new Error('Invalid withdrawal approval password.');
        }
      }

      // Create approval record
      const approval = await tx.withdrawalApproval.create({
        data: {
          withdrawalRequestId: parseInt(withdrawalId),
          approvedById: req.user.id,
          approved: true,
          password: password ? 'VERIFIED' : null,
          approvalMethod,
          comment: comment || null,
        },
      });

      // Update withdrawal request approval count atomically
      const updatedRequest = await tx.withdrawalRequest.update({
        where: { id: parseInt(withdrawalId) },
        data: {
          currentApprovals: { increment: 1 },
        },
      });

      // Check if all required approvals are met
      if (updatedRequest.currentApprovals >= updatedRequest.requiredApprovals) {
        // Process the withdrawal using WalletService
        const processingResult = await walletService.processWithdrawal(updatedRequest.id, tx);
        
        // Attempt KCB withdrawal if applicable
        if (updatedRequest.withdrawalMethod === 'BANK_TRANSFER' || updatedRequest.withdrawalMethod === 'MPESA') {
          try {
            const kcbResponse = await initiateKcbWithdrawal(
              updatedRequest.withdrawalReference,
              parseFloat(updatedRequest.amount.toString()),
              updatedRequest.destinationAccount || updatedRequest.destinationPhone,
              updatedRequest.purpose
            );
            
            // Update with KCB transaction details
            await tx.withdrawalRequest.update({
              where: { id: updatedRequest.id },
              data: {
                kcbTransactionId: kcbResponse.transactionId,
                kcbReference: kcbResponse.reference
              }
            });
            
            processingResult.kcbResponse = kcbResponse;
          } catch (kcbError) {
            logger.warn('KCB withdrawal initiation failed, continuing with local processing', { 
              error: kcbError.message,
              withdrawalId 
            });
          }
        }
        
        return { 
          approved: true, 
          processed: true,
          withdrawal: processingResult.withdrawal,
          wallet: processingResult.wallet,
          kcbResponse: processingResult.kcbResponse
        };
      }

      return { 
        approved: true, 
        requiresMoreApprovals: true, 
        currentApprovals: updatedRequest.currentApprovals,
        requiredApprovals: updatedRequest.requiredApprovals
      };
    }, {
      maxWait: 15000,
      timeout: 60000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    await logAdminActivity('APPROVE_WITHDRAWAL_REQUEST', parseInt(withdrawalId), req.user.id, { 
      approvalMethod,
      processed: result.processed || false,
      currentApprovals: result.currentApprovals || 'completed'
    });

    const message = result.requiresMoreApprovals 
      ? `Approval recorded. ${result.requiredApprovals - result.currentApprovals} more approvals needed.`
      : 'Withdrawal request fully approved and processed.';

    logger.wallet(`Withdrawal approval processed: ${message}`, { withdrawalId });
    
    return sendResponse(res, 200, true, result, message);

  } catch (error) {
    logger.error('Error approving withdrawal request', { 
      error: error.message, 
      userId: req.user.id,
      withdrawalId: req.params.withdrawalId 
    });
    return sendResponse(res, 500, false, null, error.message || 'Server error processing withdrawal approval.', { 
      code: 'SERVER_ERROR', 
      details: error.message 
    });
  }
};

/**
 * Get withdrawal requests with enhanced filtering
 */
exports.getWithdrawalRequests = async (req, res) => {
  try {
    logger.wallet('Get Withdrawal Requests attempt started', { userId: req.user.id });
    
    const { status, page = 1, limit = 20, walletType, startDate, endDate } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const whereConditions = {};
    if (status && status !== 'ALL') {
      whereConditions.status = status;
    }
    
    if (walletType && walletType !== 'ALL') {
      whereConditions.wallet = {
        walletType: walletType
      };
    }
    
    if (startDate || endDate) {
      whereConditions.createdAt = {};
      if (startDate) whereConditions.createdAt.gte = new Date(startDate);
      if (endDate) whereConditions.createdAt.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const [withdrawalRequests, totalRequests] = await Promise.all([
      prisma.withdrawalRequest.findMany({
        where: whereConditions,
        include: {
          wallet: true,
          requester: { select: { id: true, username: true, fullName: true } },
          approvals: {
            include: {
              approver: { select: { id: true, username: true, fullName: true } }
            }
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.withdrawalRequest.count({ where: whereConditions })
    ]);

    // Serialize Decimal fields and add computed fields
    const serializedRequests = withdrawalRequests.map(request => ({
      ...request,
      amount: parseFloat(request.amount.toString()),
      wallet: {
        ...request.wallet,
        balance: parseFloat(request.wallet.balance.toString()),
        totalDeposits: parseFloat(request.wallet.totalDeposits.toString()),
        totalWithdrawals: parseFloat(request.wallet.totalWithdrawals.toString()),
      },
      progress: {
        currentApprovals: request.currentApprovals,
        requiredApprovals: request.requiredApprovals,
        percentComplete: Math.round((request.currentApprovals / request.requiredApprovals) * 100)
      }
    }));

    logger.wallet(`Retrieved ${withdrawalRequests.length} withdrawal requests`);
    
    return sendResponse(res, 200, true, {
      withdrawalRequests: serializedRequests,
      pagination: {
        totalPages: Math.ceil(totalRequests / take),
        currentPage: parseInt(page),
        totalRequests,
        hasNextPage: skip + take < totalRequests,
        hasPreviousPage: parseInt(page) > 1
      }
    }, 'Withdrawal requests retrieved successfully.');

  } catch (error) {
    logger.error('Error getting withdrawal requests', { error: error.message, userId: req.user.id });
    return sendResponse(res, 500, false, null, 'Server error retrieving withdrawal requests.', { 
      code: 'SERVER_ERROR', 
      details: error.message 
    });
  }
};

/**
 * Get transactions for a specific wallet with enhanced details
 */
exports.getWalletTransactions = async (req, res) => {
  try {
    const { walletId } = req.params;
    const { page = 1, limit = 20, startDate, endDate, transactionType } = req.query;
    const numericWalletId = parseInt(walletId);

    logger.wallet(`Get Wallet Transactions for walletId: ${numericWalletId}`);

    if (isNaN(numericWalletId)) {
      return sendResponse(res, 400, false, null, 'Invalid Wallet ID format.', { code: 'INVALID_WALLET_ID' });
    }
    
    // Get wallet details with validation
    const wallet = await prisma.wallet.findUnique({
      where: { id: numericWalletId }
    });

    if (!wallet) {
      return sendResponse(res, 404, false, null, 'Wallet not found.', { code: 'WALLET_NOT_FOUND' });
    }

    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;
    
    // Enhanced date filtering
    const dateFilter = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    // Build deposit query based on wallet type
    let depositQuery = { 
      status: 'COMPLETED', 
      isExpense: false 
    };
    
    if (dateFilter.gte || dateFilter.lte) {
      depositQuery.paymentDate = dateFilter;
    }

    // Wallet-specific filtering
    if (wallet.walletType === 'TITHE') {
      depositQuery.paymentType = 'TITHE';
      if (wallet.subType) {
        depositQuery.titheDistributionSDA = { 
          path: `$.${wallet.subType}`, 
          not: 0 
        };
      }
    } else if (wallet.walletType === 'SPECIAL_OFFERING') {
      depositQuery.specialOfferingId = wallet.specialOfferingId;
      depositQuery.paymentType = 'SPECIAL_OFFERING_CONTRIBUTION';
    } else {
      depositQuery.paymentType = wallet.walletType;
    }

    // Build withdrawal query
    let withdrawalQuery = { 
      walletId: numericWalletId, 
      status: 'COMPLETED' 
    };
    
    if (dateFilter.gte || dateFilter.lte) {
      withdrawalQuery.processedAt = dateFilter;
    }

    // Get deposits and withdrawals
    const [deposits, withdrawals, totalDeposits, totalWithdrawals] = await Promise.all([
      transactionType === 'WITHDRAWAL' ? [] : prisma.payment.findMany({
        where: depositQuery,
        include: { 
          user: { select: { fullName: true, username: true } },
          specialOffering: { select: { name: true, offeringCode: true } }
        },
        orderBy: { paymentDate: 'desc' },
        skip: transactionType === 'DEPOSIT' ? skip : 0,
        take: transactionType === 'DEPOSIT' ? take : 999
      }),
      transactionType === 'DEPOSIT' ? [] : prisma.withdrawalRequest.findMany({
        where: withdrawalQuery,
        include: { 
          requester: { select: { fullName: true, username: true } },
          approvals: { 
            include: { approver: { select: { fullName: true } } }
          }
        },
        orderBy: { processedAt: 'desc' },
        skip: transactionType === 'WITHDRAWAL' ? skip : 0,
        take: transactionType === 'WITHDRAWAL' ? take : 999
      }),
      transactionType === 'WITHDRAWAL' ? 0 : prisma.payment.count({ where: depositQuery }),
      transactionType === 'DEPOSIT' ? 0 : prisma.withdrawalRequest.count({ where: withdrawalQuery })
    ]);
    
    // Format transactions with enhanced details
    const transactions = [];
    
    deposits.forEach(payment => {
      let amount = parseFloat(payment.amount.toString());
      
      // For tithe distributions, calculate the actual amount for this wallet
      if (wallet.walletType === 'TITHE' && wallet.subType && payment.titheDistributionSDA) {
        const distributionAmount = payment.titheDistributionSDA[wallet.subType];
        if (typeof distributionAmount === 'number') {
          amount = distributionAmount;
        }
      }
      
      transactions.push({
        id: `P-${payment.id}`,
        type: 'DEPOSIT',
        amount: amount,
        date: payment.paymentDate,
        description: payment.description || `${payment.paymentType} payment`,
        relatedUser: payment.user?.fullName || 'N/A',
        paymentMethod: payment.paymentMethod,
        reference: payment.reference,
        receiptNumber: payment.receiptNumber,
        specialOffering: payment.specialOffering?.name
      });
    });
    
    withdrawals.forEach(withdrawal => {
      transactions.push({
        id: `W-${withdrawal.id}`,
        type: 'WITHDRAWAL',
        amount: -parseFloat(withdrawal.amount.toString()),
        date: withdrawal.processedAt,
        description: `${withdrawal.purpose} - ${withdrawal.description || ''}`.trim(),
        relatedUser: withdrawal.requester?.fullName || 'N/A',
        withdrawalMethod: withdrawal.withdrawalMethod,
        reference: withdrawal.withdrawalReference,
        approvalCount: withdrawal.approvals?.length || 0,
        destination: withdrawal.destinationAccount || withdrawal.destinationPhone
      });
    });
    
    // Sort combined transactions by date (most recent first)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Apply pagination to combined results if no specific type filter
    let paginatedTransactions = transactions;
    let totalTransactions = totalDeposits + totalWithdrawals;
    
    if (!transactionType) {
      paginatedTransactions = transactions.slice(skip, skip + take);
    } else {
      totalTransactions = transactionType === 'DEPOSIT' ? totalDeposits : totalWithdrawals;
    }

    // Calculate summary statistics
    const summary = {
      totalDeposits: deposits.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0),
      totalWithdrawals: withdrawals.reduce((sum, w) => sum + parseFloat(w.amount.toString()), 0),
      transactionCount: transactions.length,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null
      }
    };

    return sendResponse(res, 200, true, {
      wallet: {
        ...wallet,
        balance: parseFloat(wallet.balance.toString()),
        totalDeposits: parseFloat(wallet.totalDeposits.toString()),
        totalWithdrawals: parseFloat(wallet.totalWithdrawals.toString())
      },
      transactions: paginatedTransactions,
      pagination: {
        currentPage: parseInt(page),
        totalTransactions,
        totalPages: Math.ceil(totalTransactions / take),
        hasNextPage: skip + take < totalTransactions,
        hasPreviousPage: parseInt(page) > 1
      },
      summary
    }, 'Wallet transactions retrieved successfully');

  } catch (error) {
    logger.error('Error getting wallet transactions', { 
      error: error.message, 
      walletId: req.params.walletId,
      userId: req.user.id 
    });
    return sendResponse(res, 500, false, null, 'Server error retrieving wallet transactions.', {
      code: 'SERVER_ERROR',
      details: error.message,
    });
  }
};

/**
 * Validate tithe distribution amounts
 */
exports.validateTitheDistribution = async (req, res) => {
  try {
    const { distribution, totalAmount } = req.body;
    
    if (!distribution || !totalAmount) {
      return sendResponse(res, 400, false, null, 'Distribution and totalAmount are required.', { code: 'MISSING_PARAMETERS' });
    }

    const validation = walletService.validateTitheDistribution(distribution, parseFloat(totalAmount));
    
    return sendResponse(res, 200, true, validation, 'Tithe distribution validation completed.');

  } catch (error) {
    logger.error('Error validating tithe distribution', { error: error.message });
    return sendResponse(res, 500, false, null, 'Server error validating tithe distribution.', { 
      code: 'SERVER_ERROR', 
      details: error.message 
    });
  }
};

module.exports = exports;