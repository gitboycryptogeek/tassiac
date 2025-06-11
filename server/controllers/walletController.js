// server/controllers/walletController.js
const { PrismaClient, Prisma } = require('@prisma/client');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { initiateKcbWithdrawal } = require('../utils/kcbPaymentUtils.js');

const prisma = new PrismaClient();

// Setup debug log file
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOG_DIR, 'wallet-controller-debug.log');

function debugLog(message, data = null) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] WALLET_CTRL: ${message}`;
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
  const viewOnlyUsernames = ['admin3', 'admin4', 'admin5'];
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

// Initialize wallet system - create default wallets
exports.initializeWallets = async (req, res) => {
  debugLog('Initialize Wallets attempt started');
  try {
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

    const createdWallets = [];
    for (const walletConfig of defaultWallets) {
      try {
        const existingWallet = await prisma.wallet.findUnique({
          where: {
            walletType_subType: {
              walletType: walletConfig.walletType,
              subType: walletConfig.subType,
            },
          },
        });

        if (!existingWallet) {
          const wallet = await prisma.wallet.create({
            data: walletConfig,
          });
          createdWallets.push(wallet);
          debugLog(`Created wallet: ${walletConfig.walletType}/${walletConfig.subType}`);
        }
      } catch (error) {
        debugLog(`Error creating wallet ${walletConfig.walletType}/${walletConfig.subType}:`, error.message);
      }
    }

    await logAdminActivity('INITIALIZE_WALLETS', 'SYSTEM', req.user.id, { walletsCreated: createdWallets.length });
    return sendResponse(res, 200, true, { walletsCreated: createdWallets }, `Wallet system initialized. Created ${createdWallets.length} new wallets.`);

  } catch (error) {
    debugLog('Error initializing wallets:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error initializing wallets.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Get all wallets with their balances
exports.getAllWallets = async (req, res) => {
  debugLog('Get All Wallets attempt started');
  try {
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

    // Calculate totals
    const totalBalance = wallets.reduce((sum, wallet) => sum + parseFloat(wallet.balance.toString()), 0);
    const totalDeposits = wallets.reduce((sum, wallet) => sum + parseFloat(wallet.totalDeposits.toString()), 0);
    const totalWithdrawals = wallets.reduce((sum, wallet) => sum + parseFloat(wallet.totalWithdrawals.toString()), 0);

    debugLog(`Retrieved ${wallets.length} wallets with total balance: ${totalBalance}`);
    return sendResponse(res, 200, true, {
      wallets: groupedWallets,
      summary: {
        totalBalance: parseFloat(totalBalance.toFixed(2)),
        totalDeposits: parseFloat(totalDeposits.toFixed(2)),
        totalWithdrawals: parseFloat(totalWithdrawals.toFixed(2)),
        walletsCount: wallets.length,
      },
    }, 'Wallets retrieved successfully.');

  } catch (error) {
    debugLog('Error getting wallets:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error retrieving wallets.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Update wallet balances based on completed payments
exports.updateWalletBalances = async (req, res) => {
  debugLog('Update Wallet Balances attempt started');
  try {
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot update wallet balances.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const { paymentIds } = req.body;
    
    if (!paymentIds || !Array.isArray(paymentIds)) {
      return sendResponse(res, 400, false, null, 'Payment IDs array is required.', { code: 'MISSING_PAYMENT_IDS' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedWallets = [];
      
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
            // If no specific categories, distribute equally among all tithe wallets
            walletsToUpdate.push({
              walletType: 'TITHE',
              subType: 'general',
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

        // Update the wallets
        for (const walletUpdate of walletsToUpdate) {
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
              },
            });
          } else {
            // Update existing wallet
            wallet = await tx.wallet.update({
              where: { id: wallet.id },
              data: {
                balance: wallet.balance + walletUpdate.amount,
                totalDeposits: wallet.totalDeposits + walletUpdate.amount,
                lastUpdated: new Date(),
              },
            });
          }

          updatedWallets.push(wallet);
          debugLog(`Updated wallet ${wallet.walletType}/${wallet.subType} with amount ${walletUpdate.amount}`);
        }
      }

      return updatedWallets;
    });

    await logAdminActivity('UPDATE_WALLET_BALANCES', 'SYSTEM', req.user.id, { paymentsProcessed: paymentIds.length, walletsUpdated: result.length });
    return sendResponse(res, 200, true, { updatedWallets: result }, `Updated ${result.length} wallets from ${paymentIds.length} payments.`);

  } catch (error) {
    debugLog('Error updating wallet balances:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error updating wallet balances.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Create withdrawal request
exports.createWithdrawalRequest = async (req, res) => {
  debugLog('Create Withdrawal Request attempt started');
  try {
    if (isViewOnlyAdmin(req.user)) {
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot create withdrawal requests.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debugLog('Validation errors on withdrawal request:', errors.array());
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

    // Validate wallet and amount
    const wallet = await prisma.wallet.findUnique({ where: { id: parseInt(walletId) } });
    if (!wallet) {
      return sendResponse(res, 404, false, null, 'Wallet not found.', { code: 'WALLET_NOT_FOUND' });
    }

    const withdrawalAmount = parseFloat(amount);
    if (withdrawalAmount > parseFloat(wallet.balance.toString())) {
      return sendResponse(res, 400, false, null, 'Insufficient wallet balance.', { code: 'INSUFFICIENT_BALANCE' });
    }

    // Generate unique withdrawal reference
    const withdrawalReference = `WD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const withdrawalRequest = await prisma.withdrawalRequest.create({
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

    await logAdminActivity('CREATE_WITHDRAWAL_REQUEST', withdrawalRequest.id, req.user.id, { 
      amount: withdrawalAmount, 
      walletType: wallet.walletType,
      walletSubType: wallet.subType,
      reference: withdrawalReference 
    });

    debugLog(`Withdrawal request created: ${withdrawalReference} for amount ${withdrawalAmount}`);
    return sendResponse(res, 201, true, { withdrawalRequest }, 'Withdrawal request created successfully. Awaiting approvals.');

  } catch (error) {
    debugLog('Error creating withdrawal request:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error creating withdrawal request.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Approve withdrawal request
exports.approveWithdrawalRequest = async (req, res) => {
  debugLog('Approve Withdrawal Request attempt started');
  try {
    const { withdrawalId } = req.params;
    const { password, approvalMethod = 'PASSWORD' } = req.body;

    const withdrawalRequest = await prisma.withdrawalRequest.findUnique({
      where: { id: parseInt(withdrawalId) },
      include: {
        wallet: true,
        approvals: { include: { approver: { select: { username: true, fullName: true } } } },
      },
    });

    if (!withdrawalRequest) {
      return sendResponse(res, 404, false, null, 'Withdrawal request not found.', { code: 'WITHDRAWAL_NOT_FOUND' });
    }

    if (withdrawalRequest.status !== 'PENDING') {
      return sendResponse(res, 400, false, null, 'Withdrawal request is not pending approval.', { code: 'INVALID_STATUS' });
    }

    // Check if user has already approved
    const existingApproval = withdrawalRequest.approvals.find(approval => approval.approvedById === req.user.id);
    if (existingApproval) {
      return sendResponse(res, 400, false, null, 'You have already approved this withdrawal request.', { code: 'ALREADY_APPROVED' });
    }

    // Validate password if using password method
    if (approvalMethod === 'PASSWORD') {
      const requiredPasswords = [
        process.env.WITHDRAWAL_PASSWORD_1,
        process.env.WITHDRAWAL_PASSWORD_2,
        process.env.WITHDRAWAL_PASSWORD_3,
      ].filter(Boolean);

      if (!requiredPasswords.includes(password)) {
        return sendResponse(res, 401, false, null, 'Invalid withdrawal approval password.', { code: 'INVALID_PASSWORD' });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create approval record
      const approval = await tx.withdrawalApproval.create({
        data: {
          withdrawalRequestId: parseInt(withdrawalId),
          approvedById: req.user.id,
          approved: true,
          password: password ? 'VERIFIED' : null, // Don't store actual password
          approvalMethod,
          comment: req.body.comment || null,
        },
      });

      // Update withdrawal request approval count
      const updatedRequest = await tx.withdrawalRequest.update({
        where: { id: parseInt(withdrawalId) },
        data: {
          currentApprovals: withdrawalRequest.currentApprovals + 1,
        },
      });

      // Check if all required approvals are met
      if (updatedRequest.currentApprovals >= updatedRequest.requiredApprovals) {
        // Process the withdrawal
        return await processWithdrawal(tx, updatedRequest);
      }

      return { approved: true, requiresMoreApprovals: true, currentApprovals: updatedRequest.currentApprovals };
    });

    await logAdminActivity('APPROVE_WITHDRAWAL_REQUEST', withdrawalRequest.id, req.user.id, { 
      reference: withdrawalRequest.withdrawalReference,
      approvalMethod,
      currentApprovals: result.currentApprovals || withdrawalRequest.currentApprovals + 1
    });

    const message = result.requiresMoreApprovals 
      ? `Approval recorded. ${withdrawalRequest.requiredApprovals - result.currentApprovals} more approvals needed.`
      : 'Withdrawal request fully approved and processed.';

    return sendResponse(res, 200, true, result, message);

  } catch (error) {
    debugLog('Error approving withdrawal request:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error processing withdrawal approval.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Process withdrawal (internal function)
async function processWithdrawal(tx, withdrawalRequest) {
  debugLog(`Processing withdrawal: ${withdrawalRequest.withdrawalReference}`);
  
  try {
    // Update wallet balance
    const updatedWallet = await tx.wallet.update({
      where: { id: withdrawalRequest.walletId },
      data: {
        balance: { decrement: withdrawalRequest.amount },
        totalWithdrawals: { increment: withdrawalRequest.amount },
        lastUpdated: new Date(),
      },
    });

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
        debugLog('KCB withdrawal initiation failed:', kcbError.message);
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

    debugLog(`Withdrawal processed successfully: ${withdrawalRequest.withdrawalReference}`);
    
    return {
      approved: true,
      processed: true,
      withdrawalRequest: finalWithdrawalRequest,
      walletBalance: parseFloat(updatedWallet.balance.toString()),
      expensePaymentId: expensePayment.id,
      kcbResponse: kcbResponse
    };

  } catch (error) {
    debugLog('Error in processWithdrawal:', error.message);
    throw error;
  }
}

// Get withdrawal requests
exports.getWithdrawalRequests = async (req, res) => {
  debugLog('Get Withdrawal Requests attempt started');
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const whereConditions = {};
    if (status && status !== 'ALL') {
      whereConditions.status = status;
    }

    const withdrawalRequests = await prisma.withdrawalRequest.findMany({
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
    });

    const totalRequests = await prisma.withdrawalRequest.count({ where: whereConditions });

    debugLog(`Retrieved ${withdrawalRequests.length} withdrawal requests`);
    return sendResponse(res, 200, true, {
      withdrawalRequests,
      totalPages: Math.ceil(totalRequests / take),
      currentPage: parseInt(page),
      totalRequests,
    }, 'Withdrawal requests retrieved successfully.');

  } catch (error) {
    debugLog('Error getting withdrawal requests:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error retrieving withdrawal requests.', { code: 'SERVER_ERROR', details: error.message });
  }
};

module.exports = exports;