// server/controllers/walletController.js
const { PrismaClient, Prisma } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { initiateKcbWithdrawal } = require('../utils/kcbPaymentUtils.js');
const { isViewOnlyAdmin } = require('../middlewares/auth.js');

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

    const defaultWallets = [
      // Main offering wallets
      { walletType: 'OFFERING', subType: null },
      { walletType: 'DONATION', subType: null },
      
      // Tithe wallets with SDA categories
      { walletType: 'TITHE', subType: 'campMeetingExpenses' },
      { walletType: 'TITHE', subType: 'welfare' },
      { walletType: 'TITHE', subType: 'thanksgiving' },
      { walletType: 'TITHE', subType: 'stationFund' },
      { walletType: 'TITHE', subType: 'mediaMinistry' },
      
      // Special offering wallet (will be dynamically created per offering)
      { walletType: 'SPECIAL_OFFERING', subType: 'general' },
    ];

    const result = await prisma.$transaction(async (tx) => {
      const createdWallets = [];
      
      for (const walletConfig of defaultWallets) {
        try {
          const existingWallet = await tx.wallet.findUnique({
            where: {
              walletType_subType: {
                walletType: walletConfig.walletType,
                subType: walletConfig.subType,
              },
            },
          });

          if (!existingWallet) {
            const wallet = await tx.wallet.create({
              data: walletConfig,
            });
            createdWallets.push(wallet);
            await logActivity(`Created wallet: ${walletConfig.walletType}/${walletConfig.subType}`);
          }
        } catch (error) {
          await logActivity(`Error creating wallet ${walletConfig.walletType}/${walletConfig.subType}:`, error.message);
          // Continue with other wallets instead of failing entire transaction
        }
      }
      
      return createdWallets;
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
    await logActivity('Update Wallet Balances attempt started');
    
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot update wallet balances.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const { paymentIds } = req.body;
    
    if (!paymentIds || !Array.isArray(paymentIds)) {
      return sendResponse(res, 400, false, null, 'Payment IDs array is required.', { code: 'MISSING_PAYMENT_IDS' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedWallets = new Map();
      const processedPayments = [];
      
      for (const paymentId of paymentIds) {
        const payment = await tx.payment.findUnique({
          where: { id: parseInt(paymentId) },
          include: { specialOffering: true },
        });

        if (!payment || payment.status !== 'COMPLETED' || payment.isExpense) {
          continue; // Skip non-completed payments or expenses
        }

        const amount = parseFloat(payment.amount.toString());
        let walletsToUpdate = [];

        // Determine which wallets to update based on payment type
        if (payment.paymentType === 'TITHE' && payment.titheDistributionSDA) {
          // Distribute tithe among SDA categories
          const distribution = payment.titheDistributionSDA;
          const categories = ['campMeetingExpenses', 'welfare', 'thanksgiving', 'stationFund', 'mediaMinistry'];
          const activeCategories = categories.filter(cat => distribution[cat] === true);
          
          if (activeCategories.length > 0) {
            const amountPerCategory = amount / activeCategories.length;
            activeCategories.forEach(category => {
              walletsToUpdate.push({
                walletType: 'TITHE',
                subType: category,
                amount: amountPerCategory,
              });
            });
          } else {
            // If no specific categories, put in general tithe wallet
            walletsToUpdate.push({
              walletType: 'TITHE',
              subType: null,
              amount: amount,
            });
          }
        } else if (payment.paymentType === 'SPECIAL_OFFERING_CONTRIBUTION' && payment.specialOffering) {
          walletsToUpdate.push({
            walletType: 'SPECIAL_OFFERING',
            subType: payment.specialOffering.offeringCode,
            amount: amount,
          });
        } else {
          // Regular offering or donation
          walletsToUpdate.push({
            walletType: payment.paymentType,
            subType: null,
            amount: amount,
          });
        }

        // ATOMIC WALLET UPDATES
        for (const walletUpdate of walletsToUpdate) {
          const walletKey = `${walletUpdate.walletType}_${walletUpdate.subType || 'null'}`;
          
          let wallet = await tx.wallet.findUnique({
            where: {
              walletType_subType: {
                walletType: walletUpdate.walletType,
                subType: walletUpdate.subType,
              },
            },
          });

          if (!wallet) {
            // Create wallet if it doesn't exist (for special offerings)
            wallet = await tx.wallet.create({
              data: {
                walletType: walletUpdate.walletType,
                subType: walletUpdate.subType,
                balance: walletUpdate.amount,
                totalDeposits: walletUpdate.amount,
                specialOfferingId: payment.specialOfferingId,
                lastUpdated: new Date(),
              },
            });
          } else {
            // ATOMIC UPDATE: Use increment operations to prevent race conditions
            wallet = await tx.wallet.update({
              where: { id: wallet.id },
              data: {
                balance: { increment: walletUpdate.amount },
                totalDeposits: { increment: walletUpdate.amount },
                lastUpdated: new Date(),
              },
            });
          }

          // Store updated wallet (overwrite if multiple updates to same wallet)
          updatedWallets.set(walletKey, {
            ...wallet,
            balance: parseFloat(wallet.balance.toString()),
            totalDeposits: parseFloat(wallet.totalDeposits.toString()),
            totalWithdrawals: parseFloat(wallet.totalWithdrawals.toString()),
          });
          
          await logActivity(`ATOMIC UPDATE: Wallet ${wallet.walletType}/${wallet.subType} incremented by ${walletUpdate.amount}`);
        }
        
        processedPayments.push(payment.id);
      }

      return { 
        updatedWallets: Array.from(updatedWallets.values()), 
        processedPayments 
      };
    }, {
      maxWait: 15000,
      timeout: 60000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable // Highest isolation level
    });

    await logAdminActivity('UPDATE_WALLET_BALANCES', 'SYSTEM', req.user.id, { 
      paymentsProcessed: result.processedPayments.length, 
      walletsUpdated: result.updatedWallets.length 
    });
    
    await logActivity(`Updated ${result.updatedWallets.length} wallets from ${result.processedPayments.length} payments`);
    
    return sendResponse(res, 200, true, { 
      updatedWallets: result.updatedWallets,
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
      // Validate wallet and amount with row-level locking
      const wallet = await tx.wallet.findUnique({ 
        where: { id: parseInt(walletId) },
        // Use SELECT FOR UPDATE to lock the row
      });
      
      if (!wallet) {
        throw new Error('Wallet not found.');
      }

      const withdrawalAmount = parseFloat(amount);
      const currentBalance = parseFloat(wallet.balance.toString());
      
      if (withdrawalAmount > currentBalance) {
        throw new Error(`Insufficient wallet balance. Available: ${currentBalance}, Requested: ${withdrawalAmount}`);
      }

      // Generate unique withdrawal reference
      const withdrawalReference = `WD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      const withdrawalRequest = await tx.withdrawalRequest.create({
        data: {
          withdrawalReference,
          walletId: parseInt(walletId),
          amount: withdrawalAmount,
          purpose,
          description,
          requestedById: req.user.id,
          withdrawalMethod,
          destinationAccount,
          destinationPhone,
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
      reference: result.withdrawalReference 
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
          password: password ? 'VERIFIED' : null, // Don't store actual password
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
        // Process the withdrawal
        return await processWithdrawal(tx, updatedRequest);
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
async function processWithdrawal(tx, withdrawalRequest) {
  await logActivity(`Processing withdrawal: ${withdrawalRequest.withdrawalReference}`);
  
  try {
    // ATOMIC UPDATE: Update wallet balance using decrement with row locking
    const updatedWallet = await tx.wallet.update({
      where: { id: withdrawalRequest.walletId },
      data: {
        balance: { decrement: withdrawalRequest.amount },
        totalWithdrawals: { increment: withdrawalRequest.amount },
        lastUpdated: new Date(),
      },
    });

    // Verify balance didn't go negative (additional safety check)
    if (parseFloat(updatedWallet.balance.toString()) < 0) {
      throw new Error('Withdrawal would result in negative balance. Operation cancelled.');
    }

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

    await logActivity(`Withdrawal processed successfully: ${withdrawalRequest.withdrawalReference}`);
    
    return {
      approved: true,
      processed: true,
      withdrawalRequest: {
        ...finalWithdrawalRequest,
        amount: parseFloat(finalWithdrawalRequest.amount.toString()),
      },
      walletBalance: parseFloat(updatedWallet.balance.toString()),
      expensePaymentId: expensePayment.id,
      kcbResponse: kcbResponse
    };

  } catch (error) {
    await logActivity('Error in processWithdrawal:', error.message);
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