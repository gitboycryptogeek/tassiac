// server/controllers/walletController.js
const { PrismaClient, Prisma } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { initiateKcbWithdrawal } = require('../utils/kcbPaymentUtils.js');
const { isViewOnlyAdmin } = require('../middlewares/auth.js');
const WalletService = require('../utils/walletService.js'); 

const prisma = new PrismaClient();

// Centralized logging utility (non-blocking)
const logActivity = async (message, data = null) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] WALLET_CTRL: ${message}${data ? ` | Data: ${JSON.stringify(data)}` : ''}`;
  console.log(logMessage);
  
  // Non-blocking file logging
  if (process.env.NODE_ENV !== 'production') {
    const LOG_DIR = path.join(__dirname, '..', 'logs');
    const LOG_FILE = path.join(LOG_DIR, 'wallet-controller.log');
    
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
      console.error(`Failed to log admin activity ${actionType}:`, error.message);
    }
  });
};

// Initialize wallet system - create default wallets
exports.initializeWallets = async (req, res) => {
  try {
    await logActivity('Initialize Wallets attempt started');
    
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot initialize wallets.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const result = await prisma.$transaction(async (tx) => {
      return await WalletService.initializeDefaultWallets(tx);
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    await logAdminActivity('INITIALIZE_WALLETS', 'SYSTEM', req.user.id, { walletsCreated: result.length });
    await logActivity(`Wallet initialization completed. Created ${result.length} new wallets.`);
    
    return sendResponse(res, 200, true, { walletsCreated: result }, `Wallet system initialized. Created ${result.length} new wallets.`);

  } catch (error) {
    await logActivity('Error initializing wallets:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error initializing wallets.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Add new function to recalculate wallet balances
exports.recalculateWalletBalances = async (req, res) => {
  try {
    await logActivity('Recalculate Wallet Balances attempt started');
    
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot recalculate wallet balances.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const result = await prisma.$transaction(async (tx) => {
      return await WalletService.recalculateAllWalletBalances(tx);
    }, {
      maxWait: 30000,
      timeout: 120000,
    });

    await logAdminActivity('RECALCULATE_WALLET_BALANCES', 'SYSTEM', req.user.id, { 
      walletsProcessed: result.length 
    });
    
    await logActivity(`Wallet balance recalculation completed for ${result.length} wallets.`);
    
    return sendResponse(res, 200, true, { 
      walletSummary: result,
      walletsProcessed: result.length
    }, `Wallet balances recalculated successfully for ${result.length} wallets.`);

  } catch (error) {
    await logActivity('Error recalculating wallet balances:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error recalculating wallet balances.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Add function to validate tithe distribution
exports.validateTitheDistribution = async (req, res) => {
  try {
    const { distribution, totalAmount } = req.body;
    
    if (!distribution || !totalAmount) {
      return sendResponse(res, 400, false, null, 'Distribution and totalAmount are required.', { code: 'MISSING_PARAMETERS' });
    }

    const validation = WalletService.validateTitheDistribution(distribution, parseFloat(totalAmount));
    
    return sendResponse(res, 200, true, validation, 'Tithe distribution validation completed.');

  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error validating tithe distribution.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Get all wallets with their balances
exports.getAllWallets = async (req, res) => {
  try {
    await logActivity('Get All Wallets attempt started');
    
    const wallets = await prisma.wallet.findMany({
      where: { isActive: true },
      orderBy: [
        { walletType: 'asc' },
        { subType: 'asc' },
      ],
    });

    // Group wallets by type for better frontend organization
    const groupedWallets = {
      TITHE: wallets.filter(w => w.walletType === 'TITHE'),
      OFFERING: wallets.filter(w => w.walletType === 'OFFERING'),
      DONATION: wallets.filter(w => w.walletType === 'DONATION'),
      SPECIAL_OFFERING: wallets.filter(w => w.walletType === 'SPECIAL_OFFERING'),
    };

    // Calculate totals safely
    const totalBalance = wallets.reduce((sum, wallet) => sum + parseFloat(wallet.balance.toString()), 0);
    const totalDeposits = wallets.reduce((sum, wallet) => sum + parseFloat(wallet.totalDeposits.toString()), 0);
    const totalWithdrawals = wallets.reduce((sum, wallet) => sum + parseFloat(wallet.totalWithdrawals.toString()), 0);

    // Convert Decimal fields to numbers for JSON serialization
    const serializedGroupedWallets = {};
    Object.keys(groupedWallets).forEach(key => {
      serializedGroupedWallets[key] = groupedWallets[key].map(wallet => ({
        ...wallet,
        balance: parseFloat(wallet.balance.toString()),
        totalDeposits: parseFloat(wallet.totalDeposits.toString()),
        totalWithdrawals: parseFloat(wallet.totalWithdrawals.toString()),
      }));
    });

    await logActivity(`Retrieved ${wallets.length} wallets with total balance: ${totalBalance}`);
    
    return sendResponse(res, 200, true, {
      wallets: serializedGroupedWallets,
      summary: {
        totalBalance: parseFloat(totalBalance.toFixed(2)),
        totalDeposits: parseFloat(totalDeposits.toFixed(2)),
        totalWithdrawals: parseFloat(totalWithdrawals.toFixed(2)),
        walletsCount: wallets.length,
      },
    }, 'Wallets retrieved successfully.');

  } catch (error) {
    await logActivity('Error getting wallets:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error retrieving wallets.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Update wallet balances based on completed payments - ATOMIC OPERATIONS
exports.updateWalletBalances = async (req, res) => {
  try {
    await logActivity('Manual Update Wallet Balances attempt started');
    
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot update wallet balances.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const { paymentIds } = req.body;
    
    if (!paymentIds || !Array.isArray(paymentIds)) {
      return sendResponse(res, 400, false, null, 'Payment IDs array is required.', { code: 'MISSING_PAYMENT_IDS' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedWallets = [];
      const processedPayments = [];
      
      for (const paymentId of paymentIds) {
        try {
          const wallets = await WalletService.updateWalletsForPayment(parseInt(paymentId), tx);
          if (wallets) {
            updatedWallets.push(...wallets);
            processedPayments.push(paymentId);
          }
        } catch (error) {
          console.error(`Error updating wallets for payment ${paymentId}:`, error.message);
        }
      }

      return { updatedWallets, processedPayments };
    }, {
      maxWait: 15000,
      timeout: 60000,
    });

    await logAdminActivity('MANUAL_UPDATE_WALLET_BALANCES', 'SYSTEM', req.user.id, { 
      paymentsProcessed: result.processedPayments.length, 
      walletsUpdated: result.updatedWallets.length 
    });
    
    await logActivity(`Manually updated ${result.updatedWallets.length} wallets from ${result.processedPayments.length} payments`);
    
    return sendResponse(res, 200, true, { 
      updatedWallets: result.updatedWallets.map(wallet => ({
        ...wallet,
        balance: parseFloat(wallet.balance.toString()),
        totalDeposits: parseFloat(wallet.totalDeposits.toString()),
        totalWithdrawals: parseFloat(wallet.totalWithdrawals.toString()),
      })),
      processedPayments: result.processedPayments
    }, `Updated ${result.updatedWallets.length} wallets from ${result.processedPayments.length} payments.`);

  } catch (error) {
    await logActivity('Error updating wallet balances:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error updating wallet balances.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Create withdrawal request
exports.createWithdrawalRequest = async (req, res) => {
  try {
    await logActivity('Create Withdrawal Request attempt started');
    
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot create withdrawal requests.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await logActivity('Validation errors on withdrawal request:', errors.array());
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
      // Import validation service
      const WalletValidationService = require('../utils/walletValidation.js');
      
      // Validate wallet existence and get with row-level locking
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
      
      // Enhanced validation
      WalletValidationService.validateWithdrawalAmount(wallet, withdrawalAmount);
      WalletValidationService.validateWithdrawalDestination(withdrawalMethod, destinationAccount, destinationPhone);
      
      // Business hours validation (can be disabled in env)
      if (process.env.ENFORCE_BUSINESS_HOURS === 'true') {
        WalletValidationService.validateBusinessHours();
      }
      
      // Daily withdrawal limit validation
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

      // Generate unique withdrawal reference with better format
      const currentDate = new Date();
      const dateStr = currentDate.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = currentDate.toTimeString().slice(0, 8).replace(/:/g, '');
      const randomStr = crypto.randomBytes(3).toString('hex').toUpperCase();
      const withdrawalReference = `WD-${dateStr}-${timeStr}-${randomStr}`;

      // Create withdrawal request
      const withdrawalRequest = await tx.withdrawalRequest.create({
        data: {
          withdrawalReference,
          walletId: parseInt(walletId),
          amount: withdrawalAmount,
          purpose: purpose.trim(),
          description: description.trim(),
          requestedById: req.user.id,
          withdrawalMethod,
          destinationAccount: destinationAccount ? destinationAccount.trim() : null,
          destinationPhone: destinationPhone ? destinationPhone.trim() : null,
          requiredApprovals: parseInt(process.env.REQUIRED_WITHDRAWAL_APPROVALS || '3'),
          currentApprovals: 0,
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

    await logActivity(`Withdrawal request created: ${result.withdrawalReference} for amount ${result.amount}`);
    
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
    await logActivity('Error creating withdrawal request:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, error.message || 'Server error creating withdrawal request.', { code: 'SERVER_ERROR', details: error.message });
  }
};

exports.uploadWithdrawalReceipt = async (req, res) => {
  try {
    await logActivity('Upload Withdrawal Receipt attempt started');
    
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot upload receipts.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const { withdrawalId } = req.params;
    
    if (!req.file) {
      return sendResponse(res, 400, false, null, 'No file uploaded.', { code: 'NO_FILE_UPLOADED' });
    }

    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(req.file.mimetype)) {
      return sendResponse(res, 400, false, null, 'Invalid file type. Only JPEG, PNG, and PDF files are allowed.', { code: 'INVALID_FILE_TYPE' });
    }

    if (req.file.size > maxSize) {
      return sendResponse(res, 400, false, null, 'File too large. Maximum size is 5MB.', { code: 'FILE_TOO_LARGE' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawalRequest.findUnique({
        where: { id: parseInt(withdrawalId) }
      });

      if (!withdrawal) {
        throw new Error('Withdrawal request not found.');
      }

      // Update withdrawal with receipt path
      const receiptPath = `/uploads/withdrawal-receipts/${req.file.filename}`;
      
      const updatedWithdrawal = await tx.withdrawalRequest.update({
        where: { id: parseInt(withdrawalId) },
        data: {
          // Add receipt path to existing data structure
          // You might need to add a receiptPath field to your schema
        }
      });

      return updatedWithdrawal;
    });

    await logAdminActivity('UPLOAD_WITHDRAWAL_RECEIPT', parseInt(withdrawalId), req.user.id, { 
      filename: req.file.filename,
      fileSize: req.file.size
    });

    await logActivity(`Withdrawal receipt uploaded: ${req.file.filename}`);
    return sendResponse(res, 200, true, { receiptPath: `/uploads/withdrawal-receipts/${req.file.filename}` }, 'Receipt uploaded successfully.');

  } catch (error) {
    await logActivity('Error uploading withdrawal receipt:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, error.message || 'Server error uploading receipt.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Approve withdrawal request
exports.approveWithdrawalRequest = async (req, res) => {
  try {
    await logActivity('Approve Withdrawal Request attempt started');
    
    const { withdrawalId } = req.params;
    const { password, approvalMethod = 'PASSWORD', comment } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const withdrawalRequest = await tx.withdrawalRequest.findUnique({
        where: { id: parseInt(withdrawalId) },
        include: {
          wallet: true,
          approvals: { include: { approver: { select: { username: true, fullName: true } } } },
        },
      });

      if (!withdrawalRequest) {
        throw new Error('Withdrawal request not found.');
      }

      if (withdrawalRequest.status !== 'PENDING') {
        throw new Error('Withdrawal request is not pending approval.');
      }

      // Check if user has already approved
      const existingApproval = withdrawalRequest.approvals.find(approval => approval.approvedById === req.user.id);
      if (existingApproval) {
        throw new Error('You have already approved this withdrawal request.');
      }

      // Validate password if using password method
      if (approvalMethod === 'PASSWORD') {
        const requiredPasswords = [
          process.env.WITHDRAWAL_PASSWORD_1,
          process.env.WITHDRAWAL_PASSWORD_2,
          process.env.WITHDRAWAL_PASSWORD_3,
        ].filter(Boolean);

        if (!requiredPasswords.includes(password)) {
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

      // Update withdrawal request approval count ATOMICALLY
      const updatedRequest = await tx.withdrawalRequest.update({
        where: { id: parseInt(withdrawalId) },
        data: {
          currentApprovals: { increment: 1 },
        },
      });

      // Check if all required approvals are met
      if (updatedRequest.currentApprovals >= updatedRequest.requiredApprovals) {
        // Process the withdrawal using WalletService
        return await processWithdrawalWithWalletService(tx, updatedRequest);
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
      currentApprovals: result.currentApprovals || 'completed'
    });

    const message = result.requiresMoreApprovals 
      ? `Approval recorded. ${result.requiredApprovals - result.currentApprovals} more approvals needed.`
      : 'Withdrawal request fully approved and processed.';

    await logActivity(`Withdrawal approval processed: ${message}`);
    
    return sendResponse(res, 200, true, result, message);

  } catch (error) {
    await logActivity('Error approving withdrawal request:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, error.message || 'Server error processing withdrawal approval.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Process withdrawal (internal function) - ATOMIC OPERATIONS
async function processWithdrawalWithWalletService(tx, withdrawalRequest) {
  await logActivity(`Processing withdrawal using WalletService: ${withdrawalRequest.withdrawalReference}`);
  
  try {
    // Use WalletService to update wallet balance
    await WalletService.updateOrCreateWallet(
      withdrawalRequest.wallet.walletType,
      withdrawalRequest.wallet.subType,
      withdrawalRequest.amount,
      'WITHDRAWAL',
      withdrawalRequest.wallet.specialOfferingId,
      tx
    );

    // Create expense record for the withdrawal
    const expensePayment = await tx.payment.create({
      data: {
        userId: withdrawalRequest.requestedById,
        amount: withdrawalRequest.amount,
        paymentType: 'EXPENSE',
        paymentMethod: withdrawalRequest.withdrawalMethod,
        description: `Withdrawal: ${withdrawalRequest.purpose} - ${withdrawalRequest.description || ''}`,
        status: 'COMPLETED',
        isExpense: true,
        department: `${withdrawalRequest.wallet.walletType}_WITHDRAWAL`,
        reference: withdrawalRequest.withdrawalReference,
        processedById: withdrawalRequest.requestedById,
      },
    });

    // Initiate KCB withdrawal if applicable
    let kcbResponse = null;
    if (withdrawalRequest.withdrawalMethod === 'BANK_TRANSFER' || withdrawalRequest.withdrawalMethod === 'MPESA') {
      try {
        kcbResponse = await initiateKcbWithdrawal(
          withdrawalRequest.withdrawalReference,
          withdrawalRequest.amount,
          withdrawalRequest.destinationAccount || withdrawalRequest.destinationPhone,
          withdrawalRequest.purpose
        );
      } catch (kcbError) {
        await logActivity('KCB withdrawal initiation failed:', kcbError.message);
        // Continue with local processing even if KCB fails
      }
    }

    // Update withdrawal request status
    const finalWithdrawalRequest = await tx.withdrawalRequest.update({
      where: { id: withdrawalRequest.id },
      data: {
        status: 'COMPLETED',
        processedAt: new Date(),
        kcbTransactionId: kcbResponse?.transactionId || null,
        kcbReference: kcbResponse?.reference || null,
      },
    });

    await logActivity(`Withdrawal processed successfully using WalletService: ${withdrawalRequest.withdrawalReference}`);
    
    return {
      approved: true,
      processed: true,
      withdrawalRequest: {
        ...finalWithdrawalRequest,
        amount: parseFloat(finalWithdrawalRequest.amount.toString()),
      },
      expensePaymentId: expensePayment.id,
      kcbResponse: kcbResponse
    };

  } catch (error) {
    await logActivity('Error in processWithdrawalWithWalletService:', error.message);
    throw error;
  }
}

// Get withdrawal requests
exports.getWithdrawalRequests = async (req, res) => {
  try {
    await logActivity('Get Withdrawal Requests attempt started');
    
    const { status, page = 1, limit = 20 } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const whereConditions = {};
    if (status && status !== 'ALL') {
      whereConditions.status = status;
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

    // Serialize Decimal fields
    const serializedRequests = withdrawalRequests.map(request => ({
      ...request,
      amount: parseFloat(request.amount.toString()),
      wallet: {
        ...request.wallet,
        balance: parseFloat(request.wallet.balance.toString()),
        totalDeposits: parseFloat(request.wallet.totalDeposits.toString()),
        totalWithdrawals: parseFloat(request.wallet.totalWithdrawals.toString()),
      },
    }));

    await logActivity(`Retrieved ${withdrawalRequests.length} withdrawal requests`);
    
    return sendResponse(res, 200, true, {
      withdrawalRequests: serializedRequests,
      totalPages: Math.ceil(totalRequests / take),
      currentPage: parseInt(page),
      totalRequests,
    }, 'Withdrawal requests retrieved successfully.');

  } catch (error) {
    await logActivity('Error getting withdrawal requests:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error retrieving withdrawal requests.', { code: 'SERVER_ERROR', details: error.message });
  }
};

module.exports = exports;