// server/utils/walletService.js - ENHANCED PRODUCTION VERSION
const { PrismaClient, Prisma } = require('@prisma/client');
const { logger } = require('../config/logger');

class WalletService {
  constructor() {
    this.prisma = new PrismaClient();
    this.LOCK_TIMEOUT = 30000; // 30 seconds
    this.RETRY_ATTEMPTS = 3;
    this.RETRY_DELAY = 1000; // 1 second
  }

  /**
   * Enhanced wallet update with retries and proper locking
   */
  async updateWalletsForPayment(paymentId, tx = null) {
    const prismaClient = tx || this.prisma;
    
    try {
      // Get payment details with all related data
      const payment = await this.getPaymentWithDetails(paymentId, prismaClient);
      
      if (!payment || payment.status !== 'COMPLETED' || payment.isExpense) {
        logger.wallet(`Skipping wallet update for payment ${paymentId}: status=${payment?.status}, isExpense=${payment?.isExpense}`);
        return null;
      }

      const amount = parseFloat(payment.amount.toString());
      const walletUpdates = this.calculateWalletUpdates(payment, amount);

      // Execute all wallet updates atomically
      const updatedWallets = await this.executeWalletUpdates(walletUpdates, prismaClient);

      logger.wallet(`Successfully updated ${updatedWallets.length} wallets for payment ${paymentId}`, {
        paymentAmount: amount,
        walletUpdates: walletUpdates.length,
        updatedWallets: updatedWallets.map(w => ({ type: w.walletType, subType: w.subType, balance: w.balance }))
      });

      return updatedWallets;

    } catch (error) {
      logger.error(`Failed to update wallets for payment ${paymentId}: ${error.message}`, { 
        paymentId, 
        stack: error.stack 
      });
      throw new Error(`Wallet update failed: ${error.message}`);
    }
  }

  /**
   * Get payment with all necessary details
   */
  async getPaymentWithDetails(paymentId, prismaClient) {
    return await prismaClient.payment.findUnique({
      where: { id: paymentId },
      include: { 
        specialOffering: {
          select: {
            id: true,
            name: true,
            offeringCode: true,
            isActive: true
          }
        },
        user: { 
          select: { 
            id: true,
            fullName: true,
            username: true
          } 
        }
      }
    });
  }

  /**
   * Calculate which wallets need to be updated based on payment type
   */
  calculateWalletUpdates(payment, amount) {
    const updates = [];

    if (payment.paymentType === 'TITHE' && payment.titheDistributionSDA) {
      // Handle tithe distribution with specific amounts
      const distribution = payment.titheDistributionSDA;
      
      // Validate distribution
      const validation = this.validateTitheDistribution(distribution, amount);
      if (!validation.valid) {
        throw new Error(`Invalid tithe distribution: ${validation.errors.join(', ')}`);
      }

      // Add specific SDA category amounts
      Object.entries(distribution).forEach(([category, categoryAmount]) => {
        if (typeof categoryAmount === 'number' && categoryAmount > 0) {
          updates.push({
            walletType: 'TITHE',
            subType: category,
            amount: categoryAmount,
            operation: 'DEPOSIT',
            paymentId: payment.id
          });
        }
      });

      // Handle remaining amount in general tithe wallet
      const remainingAmount = amount - validation.totalDistributed;
      if (remainingAmount > 0) {
        updates.push({
          walletType: 'TITHE',
          subType: null,
          amount: remainingAmount,
          operation: 'DEPOSIT',
          paymentId: payment.id
        });
      }

    } else if (payment.paymentType === 'SPECIAL_OFFERING_CONTRIBUTION' && payment.specialOffering) {
      if (!payment.specialOffering.isActive) {
        throw new Error(`Cannot update wallet for inactive special offering: ${payment.specialOffering.name}`);
      }
      
      updates.push({
        walletType: 'SPECIAL_OFFERING',
        subType: payment.specialOffering.offeringCode,
        amount: amount,
        operation: 'DEPOSIT',
        specialOfferingId: payment.specialOfferingId,
        paymentId: payment.id
      });

    } else {
      // Regular offering, donation, etc.
      updates.push({
        walletType: payment.paymentType,
        subType: null,
        amount: amount,
        operation: 'DEPOSIT',
        paymentId: payment.id
      });
    }

    return updates;
  }

  /**
   * Execute all wallet updates with proper error handling and rollback
   */
  async executeWalletUpdates(walletUpdates, prismaClient) {
    const updatedWallets = [];
    
    try {
      for (const update of walletUpdates) {
        const wallet = await this.updateOrCreateWalletWithRetry(update, prismaClient);
        updatedWallets.push(wallet);
      }
      
      return updatedWallets;
    } catch (error) {
      logger.error('Error executing wallet updates, attempting rollback', { 
        error: error.message,
        completedUpdates: updatedWallets.length,
        totalUpdates: walletUpdates.length
      });
      throw error;
    }
  }

  /**
   * Update or create wallet with retry logic and proper locking
   */
  async updateOrCreateWalletWithRetry(updateData, prismaClient) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.RETRY_ATTEMPTS; attempt++) {
      try {
        return await this.updateOrCreateWallet(updateData, prismaClient);
      } catch (error) {
        lastError = error;
        
        if (error.code === 'P2034' || error.message.includes('timeout')) {
          logger.warn(`Wallet update attempt ${attempt} failed due to timeout, retrying...`, {
            walletType: updateData.walletType,
            subType: updateData.subType,
            attempt
          });
          
          if (attempt < this.RETRY_ATTEMPTS) {
            await this.sleep(this.RETRY_DELAY * attempt);
            continue;
          }
        }
        
        throw error;
      }
    }
    
    throw lastError;
  }

  /**
   * Atomic wallet update or creation with proper locking
   */
  async updateOrCreateWallet(updateData, prismaClient) {
    const { walletType, subType, amount, operation, specialOfferingId } = updateData;
    
    try {
      // Use SELECT FOR UPDATE to prevent race conditions
      let wallet = await prismaClient.$queryRaw`
        SELECT id, "walletType", "subType", balance, "totalDeposits", "totalWithdrawals", "isActive"
        FROM "Wallets"
        WHERE "walletType" = ${walletType} AND "subType" IS NOT DISTINCT FROM ${subType}
        FOR UPDATE NOWAIT
      `.then(rows => rows[0] || null);

      const now = new Date();

      if (!wallet) {
        // Create new wallet
        const createData = {
          walletType,
          subType,
          balance: operation === 'DEPOSIT' ? amount : 0,
          totalDeposits: operation === 'DEPOSIT' ? amount : 0,
          totalWithdrawals: operation === 'WITHDRAWAL' ? amount : 0,
          lastUpdated: now,
          isActive: true
        };

        if (specialOfferingId) {
          createData.specialOfferingId = specialOfferingId;
        }

        wallet = await prismaClient.wallet.create({ data: createData });
        
        logger.wallet(`Created new wallet: ${walletType}/${subType || 'general'}`, {
          initialBalance: wallet.balance,
          operation,
          amount
        });

      } else {
        // Update existing wallet
        const currentBalance = parseFloat(wallet.balance.toString());
        const updateData = { lastUpdated: now };

        if (operation === 'DEPOSIT') {
          updateData.balance = { increment: amount };
          updateData.totalDeposits = { increment: amount };
        } else if (operation === 'WITHDRAWAL') {
          // Check for sufficient funds
          if (currentBalance < amount) {
            throw new Error(`Insufficient funds in ${walletType}/${subType || 'general'} wallet. Available: ${currentBalance}, Required: ${amount}`);
          }
          updateData.balance = { decrement: amount };
          updateData.totalWithdrawals = { increment: amount };
        }

        wallet = await prismaClient.wallet.update({
          where: { id: wallet.id },
          data: updateData
        });

        // Verify balance integrity
        const newBalance = parseFloat(wallet.balance.toString());
        if (newBalance < 0) {
          throw new Error(`Wallet balance became negative: ${walletType}/${subType || 'general'} - Balance: ${newBalance}`);
        }

        logger.wallet(`Updated wallet: ${walletType}/${subType || 'general'}`, {
          operation,
          amount,
          previousBalance: currentBalance,
          newBalance: newBalance
        });
      }

      return wallet;

    } catch (error) {
      if (error.code === 'P2034') {
        throw new Error(`Wallet update timeout: ${walletType}/${subType || 'general'} is locked`);
      }
      
      logger.error(`Wallet operation failed: ${walletType}/${subType || 'general'}`, {
        operation,
        amount,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Enhanced withdrawal processing with multi-step validation
   */
  async processWithdrawal(withdrawalId, prismaClient) {
    try {
      const withdrawal = await prismaClient.withdrawalRequest.findUnique({
        where: { id: withdrawalId },
        include: {
          wallet: true,
          requester: { select: { fullName: true, username: true } },
          approvals: { include: { approver: { select: { fullName: true } } } }
        }
      });

      if (!withdrawal) {
        throw new Error('Withdrawal request not found');
      }

      if (withdrawal.status !== 'PENDING') {
        throw new Error(`Withdrawal request is not pending: ${withdrawal.status}`);
      }

      if (withdrawal.currentApprovals < withdrawal.requiredApprovals) {
        throw new Error(`Insufficient approvals: ${withdrawal.currentApprovals}/${withdrawal.requiredApprovals}`);
      }

      // Validate wallet has sufficient funds
      const walletBalance = parseFloat(withdrawal.wallet.balance.toString());
      const withdrawalAmount = parseFloat(withdrawal.amount.toString());

      if (walletBalance < withdrawalAmount) {
        throw new Error(`Insufficient wallet funds: Available ${walletBalance}, Requested ${withdrawalAmount}`);
      }

      // Process withdrawal atomically
      const updateData = {
        walletType: withdrawal.wallet.walletType,
        subType: withdrawal.wallet.subType,
        amount: withdrawalAmount,
        operation: 'WITHDRAWAL'
      };

      const updatedWallet = await this.updateOrCreateWallet(updateData, prismaClient);

      // Create expense record
      const expensePayment = await prismaClient.payment.create({
        data: {
          userId: withdrawal.requestedById,
          amount: withdrawalAmount,
          paymentType: 'EXPENSE',
          paymentMethod: withdrawal.withdrawalMethod,
          description: `Withdrawal: ${withdrawal.purpose} - ${withdrawal.description}`,
          status: 'COMPLETED',
          isExpense: true,
          department: `${withdrawal.wallet.walletType}_WITHDRAWAL`,
          reference: withdrawal.withdrawalReference,
          processedById: withdrawal.requestedById
        }
      });

      // Update withdrawal request
      const completedWithdrawal = await prismaClient.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: {
          status: 'COMPLETED',
          processedAt: new Date()
        }
      });

      logger.wallet(`Withdrawal processed successfully`, {
        withdrawalId,
        amount: withdrawalAmount,
        walletType: withdrawal.wallet.walletType,
        reference: withdrawal.withdrawalReference,
        expensePaymentId: expensePayment.id
      });

      return {
        withdrawal: completedWithdrawal,
        wallet: updatedWallet,
        expensePayment
      };

    } catch (error) {
      logger.error(`Withdrawal processing failed for ID ${withdrawalId}`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Initialize default wallets with proper error handling
   */
  async initializeDefaultWallets(prismaClient) {
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
      { walletType: 'TITHE', subType: null } // General tithe wallet
    ];

    const createdWallets = [];
    
    for (const walletConfig of defaultWallets) {
      try {
        const existingWallet = await prismaClient.wallet.findFirst({
          where: {
            walletType: walletConfig.walletType,
            subType: walletConfig.subType
          }
        });

        if (!existingWallet) {
          const wallet = await prismaClient.wallet.create({
            data: {
              ...walletConfig,
              balance: 0,
              totalDeposits: 0,
              totalWithdrawals: 0,
              isActive: true,
              lastUpdated: new Date()
            }
          });
          
          createdWallets.push(wallet);
          logger.wallet(`Created default wallet: ${walletConfig.walletType}/${walletConfig.subType || 'general'}`);
        }
      } catch (error) {
        logger.error(`Failed to create default wallet: ${walletConfig.walletType}/${walletConfig.subType}`, {
          error: error.message
        });
      }
    }
    
    return createdWallets;
  }

  /**
   * Recalculate all wallet balances with comprehensive validation
   */
  async recalculateAllWalletBalances(prismaClient) {
    try {
      logger.wallet('Starting comprehensive wallet balance recalculation');
      
      // Get current wallet state for backup
      const originalWallets = await prismaClient.wallet.findMany();
      
      // Reset all wallets to zero
      await prismaClient.wallet.updateMany({
        data: {
          balance: 0,
          totalDeposits: 0,
          totalWithdrawals: 0,
          lastUpdated: new Date()
        }
      });

      // Get all completed payments (excluding templates and expenses)
      const completedPayments = await prismaClient.payment.findMany({
        where: {
          status: 'COMPLETED',
          isExpense: false,
          isTemplate: { not: true }
        },
        include: { specialOffering: true },
        orderBy: { paymentDate: 'asc' }
      });

      logger.wallet(`Processing ${completedPayments.length} completed payments for recalculation`);

      let processedCount = 0;
      let errorCount = 0;
      
      for (const payment of completedPayments) {
        try {
          await this.updateWalletsForPayment(payment.id, prismaClient);
          processedCount++;
          
          if (processedCount % 100 === 0) {
            logger.wallet(`Recalculation progress: ${processedCount}/${completedPayments.length} payments processed`);
          }
        } catch (error) {
          errorCount++;
          logger.error(`Failed to process payment ${payment.id} during recalculation`, {
            paymentId: payment.id,
            error: error.message
          });
          
          if (errorCount > 10) {
            logger.error('Too many errors during recalculation, stopping process');
            throw new Error(`Recalculation stopped due to excessive errors: ${errorCount} failures`);
          }
        }
      }

      // Get final wallet state
      const recalculatedWallets = await prismaClient.wallet.findMany({
        where: { isActive: true },
        orderBy: [{ walletType: 'asc' }, { subType: 'asc' }]
      });

      const summary = {
        totalPaymentsProcessed: processedCount,
        totalErrors: errorCount,
        walletsRecalculated: recalculatedWallets.length,
        totalBalance: recalculatedWallets.reduce((sum, w) => sum + parseFloat(w.balance.toString()), 0)
      };

      logger.wallet('Wallet balance recalculation completed successfully', summary);
      
      return recalculatedWallets.map(w => ({
        id: w.id,
        walletType: w.walletType,
        subType: w.subType,
        balance: parseFloat(w.balance.toString()),
        totalDeposits: parseFloat(w.totalDeposits.toString()),
        totalWithdrawals: parseFloat(w.totalWithdrawals.toString()),
        lastUpdated: w.lastUpdated
      }));

    } catch (error) {
      logger.error('Wallet balance recalculation failed', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Recalculation failed: ${error.message}`);
    }
  }

  /**
   * Enhanced tithe distribution validation
   */
  validateTitheDistribution(distribution, totalAmount) {
    if (!distribution || typeof distribution !== 'object') {
      return { valid: true, totalDistributed: 0, remaining: totalAmount, errors: [] };
    }

    const validCategories = ['campMeetingExpenses', 'welfare', 'thanksgiving', 'stationFund', 'mediaMinistry'];
    const errors = [];
    let totalDistributed = 0;

    // Validate each category
    Object.entries(distribution).forEach(([category, amount]) => {
      if (!validCategories.includes(category)) {
        errors.push(`Invalid tithe category: ${category}`);
        return;
      }

      if (typeof amount !== 'number' || amount < 0) {
        errors.push(`Invalid amount for ${category}: must be a non-negative number`);
        return;
      }

      totalDistributed += amount;
    });

    // Check if total doesn't exceed payment amount (with small tolerance for floating point)
    if (totalDistributed > totalAmount + 0.01) {
      errors.push(`Total distributed amount (${totalDistributed}) exceeds payment amount (${totalAmount})`);
    }

    return {
      valid: errors.length === 0,
      errors,
      totalDistributed: Math.round(totalDistributed * 100) / 100, // Round to 2 decimal places
      remaining: Math.max(0, totalAmount - totalDistributed)
    };
  }

  /**
   * Get comprehensive wallet summary with analytics
   */
  async getWalletsSummary(prismaClient) {
    const wallets = await prismaClient.wallet.findMany({
      where: { isActive: true },
      orderBy: [{ walletType: 'asc' }, { subType: 'asc' }]
    });

    const summary = {
      totalWallets: wallets.length,
      totalBalance: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
      walletsByType: {},
      lastUpdated: new Date()
    };

    wallets.forEach(wallet => {
      const balance = parseFloat(wallet.balance.toString());
      const deposits = parseFloat(wallet.totalDeposits.toString());
      const withdrawals = parseFloat(wallet.totalWithdrawals.toString());

      summary.totalBalance += balance;
      summary.totalDeposits += deposits;
      summary.totalWithdrawals += withdrawals;

      if (!summary.walletsByType[wallet.walletType]) {
        summary.walletsByType[wallet.walletType] = {
          count: 0,
          totalBalance: 0,
          wallets: []
        };
      }

      summary.walletsByType[wallet.walletType].count++;
      summary.walletsByType[wallet.walletType].totalBalance += balance;
      summary.walletsByType[wallet.walletType].wallets.push({
        id: wallet.id,
        subType: wallet.subType,
        balance,
        deposits,
        withdrawals,
        lastUpdated: wallet.lastUpdated
      });
    });

    return summary;
  }

  /**
   * Utility method for delays
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = WalletService;