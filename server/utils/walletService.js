// server/utils/walletService.js - PRODUCTION VERSION
const { PrismaClient, Prisma } = require('@prisma/client');
const { logger } = require('../config/logger');
const crypto = require('crypto');

class WalletService {
  constructor() {
    this.prisma = new PrismaClient();
    this.LOCK_TIMEOUT = 30000; // 30 seconds
    this.RETRY_ATTEMPTS = 3;
    this.RETRY_DELAY = 1000; // 1 second
    
    // Valid SDA tithe categories
    this.VALID_TITHE_CATEGORIES = [
      'campMeetingExpenses',
      'welfare', 
      'thanksgiving',
      'stationFund',
      'mediaMinistry'
    ];
  }

  /**
   * Enhanced wallet update with proper locking and error handling
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

      const amount = new Prisma.Decimal(payment.amount.toString());
      const walletUpdates = this.calculateWalletUpdates(payment, amount);

      // Execute all wallet updates atomically
      const updatedWallets = await this.executeWalletUpdates(walletUpdates, prismaClient);

      logger.wallet(`Successfully updated ${updatedWallets.length} wallets for payment ${paymentId}`, {
        paymentAmount: amount.toString(),
        walletUpdates: walletUpdates.length,
        updatedWallets: updatedWallets.map(w => ({ 
          type: w.walletType, 
          subType: w.subType, 
          balance: w.balance.toString() 
        }))
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
      const validation = this.validateTitheDistribution(distribution, parseFloat(amount.toString()));
      if (!validation.valid) {
        throw new Error(`Invalid tithe distribution: ${validation.errors.join(', ')}`);
      }

      // Add specific SDA category amounts
      Object.entries(distribution).forEach(([category, categoryAmount]) => {
        if (typeof categoryAmount === 'number' && categoryAmount > 0) {
          if (!this.VALID_TITHE_CATEGORIES.includes(category)) {
            throw new Error(`Invalid tithe category: ${category}`);
          }
          
          updates.push({
            walletType: 'TITHE',
            subType: category,
            amount: new Prisma.Decimal(categoryAmount.toString()),
            operation: 'DEPOSIT',
            paymentId: payment.id
          });
        }
      });

      // Handle remaining amount in general tithe wallet
      const remainingAmount = parseFloat(amount.toString()) - validation.totalDistributed;
      if (remainingAmount > 0.01) { // Use small threshold to avoid floating point issues
        updates.push({
          walletType: 'TITHE',
          subType: null,
          amount: new Prisma.Decimal(remainingAmount.toString()),
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
   * Execute all wallet updates with proper error handling
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
      logger.error('Error executing wallet updates', { 
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
        
        if (error.code === 'P2034' || error.message.includes('timeout') || error.message.includes('lock')) {
          logger.warn(`Wallet update attempt ${attempt} failed due to lock/timeout, retrying...`, {
            walletType: updateData.walletType,
            subType: updateData.subType,
            attempt,
            error: error.message
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
      return await prismaClient.$transaction(async (txClient) => {
        // Generate unique key and advisory lock ID
        const uniqueKey = this.generateUniqueKey(walletType, subType);
        const lockId = this.generateLockId(uniqueKey);
        
        // Acquire advisory lock to prevent race conditions
        await txClient.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
        
        const now = new Date();
        
        // Use upsert for atomic operation
        const wallet = await txClient.wallet.upsert({
          where: { uniqueKey },
          create: {
            walletType,
            subType,
            uniqueKey,
            balance: operation === 'DEPOSIT' ? amount : new Prisma.Decimal(0),
            totalDeposits: operation === 'DEPOSIT' ? amount : new Prisma.Decimal(0),
            totalWithdrawals: operation === 'WITHDRAWAL' ? amount : new Prisma.Decimal(0),
            specialOfferingId: specialOfferingId || null,
            isActive: true,
            lastUpdated: now
          },
          update: {
            balance: operation === 'DEPOSIT' 
              ? { increment: amount } 
              : { decrement: amount },
            totalDeposits: operation === 'DEPOSIT' 
              ? { increment: amount } 
              : undefined,
            totalWithdrawals: operation === 'WITHDRAWAL' 
              ? { increment: amount } 
              : undefined,
            lastUpdated: now
          }
        });

        // Verify balance integrity
        const currentBalance = new Prisma.Decimal(wallet.balance.toString());
        if (currentBalance.lessThan(0)) {
          throw new Error(`Insufficient funds in ${walletType}/${subType || 'general'} wallet. Balance would be: ${currentBalance.toString()}`);
        }

        logger.wallet(`${operation} completed for wallet: ${walletType}/${subType || 'general'}`, {
          operation,
          amount: amount.toString(),
          newBalance: wallet.balance.toString(),
          uniqueKey
        });

        return wallet;
        
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: this.LOCK_TIMEOUT,
        timeout: this.LOCK_TIMEOUT * 2
      });

    } catch (error) {
      if (error.code === 'P2034') {
        throw new Error(`Wallet update timeout: ${walletType}/${subType || 'general'} is locked`);
      }
      
      logger.error(`Wallet operation failed: ${walletType}/${subType || 'general'}`, {
        operation: updateData.operation,
        amount: updateData.amount.toString(),
        error: error.message,
        code: error.code
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
      const walletBalance = new Prisma.Decimal(withdrawal.wallet.balance.toString());
      const withdrawalAmount = new Prisma.Decimal(withdrawal.amount.toString());

      if (walletBalance.lessThan(withdrawalAmount)) {
        throw new Error(`Insufficient wallet funds: Available ${walletBalance.toString()}, Requested ${withdrawalAmount.toString()}`);
      }

      // Process withdrawal atomically
      const updateData = {
        walletType: withdrawal.wallet.walletType,
        subType: withdrawal.wallet.subType,
        amount: withdrawalAmount,
        operation: 'WITHDRAWAL'
      };

      const updatedWallet = await this.updateOrCreateWallet(updateData, prismaClient);

      // Create expense record for audit trail
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
          processedById: withdrawal.requestedById,
          processedAt: new Date()
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
        amount: withdrawalAmount.toString(),
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
        const uniqueKey = this.generateUniqueKey(walletConfig.walletType, walletConfig.subType);
        
        const existingWallet = await prismaClient.wallet.findUnique({
          where: { uniqueKey }
        });

        if (!existingWallet) {
          const wallet = await prismaClient.wallet.create({
            data: {
              ...walletConfig,
              uniqueKey,
              balance: new Prisma.Decimal(0),
              totalDeposits: new Prisma.Decimal(0),
              totalWithdrawals: new Prisma.Decimal(0),
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
   * Enhanced tithe distribution validation
   */
  validateTitheDistribution(distribution, totalAmount) {
    if (!distribution || typeof distribution !== 'object') {
      return { valid: true, totalDistributed: 0, remaining: totalAmount, errors: [] };
    }

    const errors = [];
    let totalDistributed = 0;

    // Validate each category
    Object.entries(distribution).forEach(([category, amount]) => {
      if (!this.VALID_TITHE_CATEGORIES.includes(category)) {
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

    // Round to avoid floating point precision issues
    totalDistributed = Math.round(totalDistributed * 100) / 100;

    return {
      valid: errors.length === 0,
      errors,
      totalDistributed,
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
      totalBalance: new Prisma.Decimal(0),
      totalDeposits: new Prisma.Decimal(0),
      totalWithdrawals: new Prisma.Decimal(0),
      walletsByType: {},
      lastUpdated: new Date()
    };

    wallets.forEach(wallet => {
      const balance = new Prisma.Decimal(wallet.balance.toString());
      const deposits = new Prisma.Decimal(wallet.totalDeposits.toString());
      const withdrawals = new Prisma.Decimal(wallet.totalWithdrawals.toString());

      summary.totalBalance = summary.totalBalance.plus(balance);
      summary.totalDeposits = summary.totalDeposits.plus(deposits);
      summary.totalWithdrawals = summary.totalWithdrawals.plus(withdrawals);

      if (!summary.walletsByType[wallet.walletType]) {
        summary.walletsByType[wallet.walletType] = {
          count: 0,
          totalBalance: new Prisma.Decimal(0),
          wallets: []
        };
      }

      summary.walletsByType[wallet.walletType].count++;
      summary.walletsByType[wallet.walletType].totalBalance = 
        summary.walletsByType[wallet.walletType].totalBalance.plus(balance);
      
      summary.walletsByType[wallet.walletType].wallets.push({
        id: wallet.id,
        subType: wallet.subType,
        balance: parseFloat(balance.toString()),
        deposits: parseFloat(deposits.toString()),
        withdrawals: parseFloat(withdrawals.toString()),
        lastUpdated: wallet.lastUpdated
      });
    });

    // Convert Decimal to float for response
    return {
      ...summary,
      totalBalance: parseFloat(summary.totalBalance.toString()),
      totalDeposits: parseFloat(summary.totalDeposits.toString()),
      totalWithdrawals: parseFloat(summary.totalWithdrawals.toString()),
      walletsByType: Object.fromEntries(
        Object.entries(summary.walletsByType).map(([type, data]) => [
          type,
          {
            ...data,
            totalBalance: parseFloat(data.totalBalance.toString())
          }
        ])
      )
    };
  }

  /**
   * Generate unique key for wallet identification
   */
  generateUniqueKey(walletType, subType) {
    return `${walletType}-${subType || 'NULL'}`;
  }

  /**
   * Generate consistent lock IDs for advisory locks
   */
  generateLockId(uniqueKey) {
    return parseInt(crypto.createHash('md5').update(uniqueKey).digest('hex').slice(0, 8), 16);
  }

  /**
   * Utility method for delays
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate withdrawal permissions and limits
   */
  validateWithdrawalRequest(wallet, amount, user) {
    const errors = [];
    const walletBalance = new Prisma.Decimal(wallet.balance.toString());
    const requestedAmount = new Prisma.Decimal(amount.toString());

    // Check if wallet is active
    if (!wallet.isActive) {
      errors.push('Cannot withdraw from inactive wallet');
    }

    // Check sufficient funds
    if (walletBalance.lessThan(requestedAmount)) {
      errors.push(`Insufficient funds. Available: ${walletBalance.toString()}, Requested: ${requestedAmount.toString()}`);
    }

    // Check minimum withdrawal amount
    const minimumWithdrawal = new Prisma.Decimal(process.env.MINIMUM_WITHDRAWAL_AMOUNT || '10');
    if (requestedAmount.lessThan(minimumWithdrawal)) {
      errors.push(`Minimum withdrawal amount is ${minimumWithdrawal.toString()}`);
    }

    // Check maximum single withdrawal
    const maximumWithdrawal = new Prisma.Decimal(process.env.MAXIMUM_SINGLE_WITHDRAWAL || '100000');
    if (requestedAmount.greaterThan(maximumWithdrawal)) {
      errors.push(`Maximum single withdrawal amount is ${maximumWithdrawal.toString()}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Recalculate all wallet balances from scratch
   * This method was missing and causing test failures
   */
  async recalculateAllWalletBalances(prisma) {
    try {
      const wallets = await prisma.wallet.findMany({
        where: { isActive: true }
      });

      const recalculatedWallets = [];

      for (const wallet of wallets) {
        // Calculate total deposits
        const depositQuery = {
          where: {
            status: 'COMPLETED',
            isExpense: false
          }
        };

        // Add wallet-specific filters
        switch (wallet.walletType) {
          case 'OFFERING':
            depositQuery.where.paymentType = 'OFFERING';
            if (wallet.subType) {
              depositQuery.where.specialOfferingId = wallet.specialOfferingId;
            }
            break;
          
          case 'TITHE':
            depositQuery.where.paymentType = 'TITHE';
            if (wallet.subType) {
              // For tithe sub-categories, we need to check the distribution
              depositQuery.where.titheDistributionSDA = {
                path: [wallet.subType],
                not: null
              };
            }
            break;
          
          case 'DONATION':
            depositQuery.where.paymentType = 'DONATION';
            break;
          
          case 'SPECIAL_OFFERING':
            depositQuery.where.paymentType = 'SPECIAL_OFFERING_CONTRIBUTION';
            if (wallet.specialOfferingId) {
              depositQuery.where.specialOfferingId = wallet.specialOfferingId;
            }
            break;
        }

        // Calculate total deposits
        const depositsResult = await prisma.payment.aggregate({
          _sum: { amount: true },
          ...depositQuery
        });

        let totalDeposits = 0;
        if (wallet.walletType === 'TITHE' && wallet.subType) {
          // For tithe sub-categories, sum up the distributed amounts
          const payments = await prisma.payment.findMany({
            where: {
              status: 'COMPLETED',
              paymentType: 'TITHE',
              titheDistributionSDA: {
                path: [wallet.subType],
                not: null
              }
            }
          });

          totalDeposits = payments.reduce((sum, payment) => {
            const distribution = payment.titheDistributionSDA || {};
            const amount = distribution[wallet.subType] || 0;
            return sum + parseFloat(amount);
          }, 0);
        } else {
          totalDeposits = parseFloat((depositsResult._sum.amount || 0).toString());
        }

        // Calculate total withdrawals
        const withdrawalsResult = await prisma.withdrawalRequest.aggregate({
          _sum: { amount: true },
          where: {
            walletId: wallet.id,
            status: 'COMPLETED'
          }
        });

        const totalWithdrawals = parseFloat((withdrawalsResult._sum.amount || 0).toString());
        const newBalance = totalDeposits - totalWithdrawals;

        // Update wallet
        const updatedWallet = await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: newBalance,
            totalDeposits: totalDeposits,
            totalWithdrawals: totalWithdrawals,
            lastUpdated: new Date()
          }
        });

        recalculatedWallets.push(updatedWallet);
      }

      return recalculatedWallets;
    } catch (error) {
      console.error('Error recalculating wallet balances:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive wallet summary
   */
  async getWalletsSummary(prisma) {
    try {
      const wallets = await prisma.wallet.findMany({
        where: { isActive: true },
        include: {
          specialOffering: true
        }
      });

      const totalBalance = wallets.reduce((sum, wallet) => {
        return sum + parseFloat(wallet.balance.toString());
      }, 0);

      const summary = {
        totalWallets: wallets.length,
        totalBalance: totalBalance.toFixed(2),
        walletsByType: {}
      };

      // Group by wallet type
      wallets.forEach(wallet => {
        const type = wallet.subType ? `${wallet.walletType}_${wallet.subType}` : wallet.walletType;
        summary.walletsByType[type] = {
          id: wallet.id,
          balance: parseFloat(wallet.balance.toString()),
          totalDeposits: parseFloat(wallet.totalDeposits.toString()),
          totalWithdrawals: parseFloat(wallet.totalWithdrawals.toString()),
          lastUpdated: wallet.lastUpdated,
          specialOffering: wallet.specialOffering?.name || null
        };
      });

      return summary;
    } catch (error) {
      console.error('Error getting wallets summary:', error);
      throw error;
    }
  }

  /**
   * Validate wallet integrity
   */
  async validateWalletIntegrity(prisma) {
    const issues = [];

    try {
      const wallets = await prisma.wallet.findMany({
        where: { isActive: true }
      });

      for (const wallet of wallets) {
        // Check for negative balances
        if (parseFloat(wallet.balance.toString()) < 0) {
          issues.push({
            walletId: wallet.id,
            type: 'NEGATIVE_BALANCE',
            message: `Wallet ${wallet.walletType}${wallet.subType ? `/${wallet.subType}` : ''} has negative balance: ${wallet.balance}`
          });
        }

        // Check if total deposits minus withdrawals equals balance
        const calculatedBalance = parseFloat(wallet.totalDeposits.toString()) - parseFloat(wallet.totalWithdrawals.toString());
        const actualBalance = parseFloat(wallet.balance.toString());

        if (Math.abs(calculatedBalance - actualBalance) > 0.01) { // Allow for small rounding differences
          issues.push({
            walletId: wallet.id,
            type: 'BALANCE_MISMATCH',
            message: `Wallet balance mismatch. Calculated: ${calculatedBalance}, Actual: ${actualBalance}`
          });
        }
      }

      return {
        isValid: issues.length === 0,
        issues: issues
      };
    } catch (error) {
      console.error('Error validating wallet integrity:', error);
      throw error;
    }
  }

  /**
   * Process withdrawal - complete implementation
   */
  async processWithdrawal(withdrawalRequestId, prisma) {
    try {
      const withdrawal = await prisma.withdrawalRequest.findUnique({
        where: { id: withdrawalRequestId },
        include: {
          wallet: true,
          approvals: true
        }
      });

      if (!withdrawal) {
        throw new Error('Withdrawal request not found');
      }

      if (withdrawal.status !== 'PENDING') {
        throw new Error('Withdrawal request is not pending');
      }

      if (withdrawal.currentApprovals < withdrawal.requiredApprovals) {
        throw new Error('Insufficient approvals for withdrawal');
      }

      const withdrawalAmount = parseFloat(withdrawal.amount.toString());
      const currentBalance = parseFloat(withdrawal.wallet.balance.toString());

      if (currentBalance < withdrawalAmount) {
        throw new Error('Insufficient wallet balance for withdrawal');
      }

      // Process the withdrawal
      const [updatedWithdrawal, updatedWallet] = await prisma.$transaction(async (tx) => {
        // Update withdrawal request
        const withdrawalUpdate = await tx.withdrawalRequest.update({
          where: { id: withdrawalRequestId },
          data: {
            status: 'COMPLETED',
            processedAt: new Date()
          }
        });

        // Update wallet balances
        const walletUpdate = await tx.wallet.update({
          where: { id: withdrawal.walletId },
          data: {
            balance: { decrement: withdrawalAmount },
            totalWithdrawals: { increment: withdrawalAmount },
            lastUpdated: new Date()
          }
        });

        return [withdrawalUpdate, walletUpdate];
      });

      return {
        withdrawal: updatedWithdrawal,
        wallet: updatedWallet
      };
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      throw error;
    }
  }


  /**
   * Get wallet transaction history with pagination
   */
  async getWalletTransactionHistory(walletId, options = {}) {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      transactionType // 'DEPOSIT', 'WITHDRAWAL', or 'ALL'
    } = options;

    const skip = (page - 1) * limit;
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId }
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Build queries for deposits and withdrawals
    const transactions = [];
    
    // Get deposits (from payments)
    if (!transactionType || transactionType === 'DEPOSIT' || transactionType === 'ALL') {
      const depositQuery = this.buildDepositQuery(wallet, startDate, endDate);
      const deposits = await this.prisma.payment.findMany({
        where: depositQuery,
        include: {
          user: { select: { fullName: true, username: true } },
          specialOffering: { select: { name: true, offeringCode: true } }
        },
        orderBy: { paymentDate: 'desc' }
      });

      deposits.forEach(payment => {
        transactions.push({
          id: `P-${payment.id}`,
          type: 'DEPOSIT',
          amount: parseFloat(payment.amount.toString()),
          date: payment.paymentDate,
          description: payment.description || `${payment.paymentType} payment`,
          relatedUser: payment.user?.fullName || 'N/A',
          reference: payment.reference,
          receiptNumber: payment.receiptNumber
        });
      });
    }

    // Get withdrawals
    if (!transactionType || transactionType === 'WITHDRAWAL' || transactionType === 'ALL') {
      const withdrawalQuery = {
        walletId: walletId,
        status: 'COMPLETED'
      };

      if (startDate || endDate) {
        withdrawalQuery.processedAt = {};
        if (startDate) withdrawalQuery.processedAt.gte = new Date(startDate);
        if (endDate) withdrawalQuery.processedAt.lte = new Date(endDate);
      }

      const withdrawals = await this.prisma.withdrawalRequest.findMany({
        where: withdrawalQuery,
        include: {
          requester: { select: { fullName: true, username: true } }
        },
        orderBy: { processedAt: 'desc' }
      });

      withdrawals.forEach(withdrawal => {
        transactions.push({
          id: `W-${withdrawal.id}`,
          type: 'WITHDRAWAL',
          amount: -parseFloat(withdrawal.amount.toString()),
          date: withdrawal.processedAt,
          description: `${withdrawal.purpose} - ${withdrawal.description || ''}`.trim(),
          relatedUser: withdrawal.requester?.fullName || 'N/A',
          reference: withdrawal.withdrawalReference,
          withdrawalMethod: withdrawal.withdrawalMethod
        });
      });
    }

    // Sort by date and apply pagination
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    const paginatedTransactions = transactions.slice(skip, skip + limit);

    return {
      wallet: {
        id: wallet.id,
        walletType: wallet.walletType,
        subType: wallet.subType,
        balance: parseFloat(wallet.balance.toString()),
        totalDeposits: parseFloat(wallet.totalDeposits.toString()),
        totalWithdrawals: parseFloat(wallet.totalWithdrawals.toString())
      },
      transactions: paginatedTransactions,
      pagination: {
        currentPage: page,
        totalTransactions: transactions.length,
        totalPages: Math.ceil(transactions.length / limit),
        hasNextPage: skip + limit < transactions.length,
        hasPreviousPage: page > 1
      }
    };
  }

  /**
   * Build deposit query based on wallet type
   */
  buildDepositQuery(wallet, startDate, endDate) {
    let query = {
      status: 'COMPLETED',
      isExpense: false
    };

    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.gte = new Date(startDate);
      if (endDate) query.paymentDate.lte = new Date(endDate);
    }

    // Wallet-specific filtering
    if (wallet.walletType === 'TITHE') {
      query.paymentType = 'TITHE';
      if (wallet.subType) {
        query.titheDistributionSDA = {
          path: `$.${wallet.subType}`,
          not: 0
        };
      }
    } else if (wallet.walletType === 'SPECIAL_OFFERING') {
      query.specialOfferingId = wallet.specialOfferingId;
      query.paymentType = 'SPECIAL_OFFERING_CONTRIBUTION';
    } else {
      query.paymentType = wallet.walletType;
    }

    return query;
  }
}

module.exports = WalletService;