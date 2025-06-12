// server/utils/walletService.js
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

// Centralized wallet update service
class WalletService {
  // Update wallets when payment is completed
  static async updateWalletsForPayment(paymentId, tx = null) {
    const prismaClient = tx || prisma;
    
    try {
      // Get payment details with all related data
      const payment = await prismaClient.payment.findUnique({
        where: { id: paymentId },
        include: { 
          specialOffering: true,
          user: { select: { fullName: true } }
        }
      });

      if (!payment || payment.status !== 'COMPLETED' || payment.isExpense) {
        return null; // Skip non-completed payments or expenses
      }

      const amount = parseFloat(payment.amount.toString());
      const walletsToUpdate = [];

      // Determine which wallets to update based on payment type
      if (payment.paymentType === 'TITHE' && payment.titheDistributionSDA) {
        // Handle tithe distribution with amounts
        const distribution = payment.titheDistributionSDA;
        
        // Validate that distributed amounts don't exceed total
        const totalDistributed = Object.values(distribution)
          .filter(val => typeof val === 'number')
          .reduce((sum, val) => sum + val, 0);
        
        if (totalDistributed > amount) {
          throw new Error(`Tithe distribution total (${totalDistributed}) exceeds payment amount (${amount})`);
        }

        // Add specific SDA category amounts
        Object.entries(distribution).forEach(([category, categoryAmount]) => {
          if (typeof categoryAmount === 'number' && categoryAmount > 0) {
            walletsToUpdate.push({
              walletType: 'TITHE',
              subType: category,
              amount: categoryAmount,
            });
          }
        });

        // Handle remaining amount (if any) - put in general tithe wallet
        const remainingAmount = amount - totalDistributed;
        if (remainingAmount > 0) {
          walletsToUpdate.push({
            walletType: 'TITHE',
            subType: null, // General tithe wallet
            amount: remainingAmount,
          });
        }
      } else if (payment.paymentType === 'SPECIAL_OFFERING_CONTRIBUTION' && payment.specialOffering) {
        walletsToUpdate.push({
          walletType: 'SPECIAL_OFFERING',
          subType: payment.specialOffering.offeringCode,
          amount: amount,
          specialOfferingId: payment.specialOfferingId,
        });
      } else {
        // Regular offering, donation, etc.
        walletsToUpdate.push({
          walletType: payment.paymentType,
          subType: null,
          amount: amount,
        });
      }

      // Atomically update all wallets
      const updatedWallets = [];
      for (const walletUpdate of walletsToUpdate) {
        const updatedWallet = await this.updateOrCreateWallet(
          walletUpdate.walletType,
          walletUpdate.subType,
          walletUpdate.amount,
          'DEPOSIT',
          walletUpdate.specialOfferingId,
          prismaClient
        );
        updatedWallets.push(updatedWallet);
      }

      console.log(`✅ Updated ${updatedWallets.length} wallets for payment ${paymentId}`);
      return updatedWallets;

    } catch (error) {
      console.error(`❌ Error updating wallets for payment ${paymentId}:`, error.message);
      throw error;
    }
  }

  // Atomic wallet update or creation
  static async updateOrCreateWallet(walletType, subType, amount, operation = 'DEPOSIT', specialOfferingId = null, tx = null) {
    const prismaClient = tx || prisma;
    
    try {
      // Find or create wallet
      let wallet = await prismaClient.wallet.findFirst({ // MODIFIED
        where: {                                      // MODIFIED
            walletType: walletType,                     // MODIFIED
            subType: subType,                           // MODIFIED
        },                                              // MODIFIED
      });

      if (!wallet) {
        // Create new wallet
        wallet = await prismaClient.wallet.create({
          data: {
            walletType: walletType,
            subType: subType,
            balance: operation === 'DEPOSIT' ? amount : 0,
            totalDeposits: operation === 'DEPOSIT' ? amount : 0,
            totalWithdrawals: operation === 'WITHDRAWAL' ? amount : 0,
            specialOfferingId: specialOfferingId,
            lastUpdated: new Date(),
          },
        });
        console.log(`📝 Created new wallet: ${walletType}/${subType || 'general'}`);
      } else {
        // Update existing wallet atomically
        const updateData = {
          lastUpdated: new Date(),
        };

        if (operation === 'DEPOSIT') {
          updateData.balance = { increment: amount };
          updateData.totalDeposits = { increment: amount };
        } else if (operation === 'WITHDRAWAL') {
          updateData.balance = { decrement: amount };
          updateData.totalWithdrawals = { increment: amount };
        }

        wallet = await prismaClient.wallet.update({
          where: { id: wallet.id },
          data: updateData,
        });

        // Verify balance didn't go negative
        if (parseFloat(wallet.balance.toString()) < 0) {
          throw new Error(`Wallet ${walletType}/${subType || 'general'} would have negative balance after ${operation}`);
        }
      }

      console.log(`💰 ${operation}: ${walletType}/${subType || 'general'} - Amount: ${amount}, New Balance: ${wallet.balance}`);
      return wallet;

    } catch (error) {
      console.error(`❌ Error updating wallet ${walletType}/${subType}:`, error.message);
      throw error;
    }
  }

  // Initialize default wallets
  static async initializeDefaultWallets(tx = null) {
    const prismaClient = tx || prisma;
    
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
      { walletType: 'TITHE', subType: null }, // General tithe wallet
    ];

    const createdWallets = [];
    
    for (const walletConfig of defaultWallets) {
      try {
        const existingWallet = await prismaClient.wallet.findFirst({ // MODIFIED
          where: {
            walletType: walletConfig.walletType,
            subType: walletConfig.subType,
          },
        });

        if (!existingWallet) {
          const wallet = await prismaClient.wallet.create({
            data: walletConfig,
          });
          createdWallets.push(wallet);
          console.log(`✅ Created wallet: ${walletConfig.walletType}/${walletConfig.subType || 'general'}`);
        }
      } catch (error) {
        console.error(`❌ Error creating wallet ${walletConfig.walletType}/${walletConfig.subType}:`, error.message);
      }
    }
    
    return createdWallets;
  }

  // Recalculate all wallet balances from payments (for data repair)
  static async recalculateAllWalletBalances(tx = null) {
    const prismaClient = tx || prisma;
    
    try {
      console.log('🔄 Starting wallet balance recalculation...');
      
      // Reset all wallet balances
      await prismaClient.wallet.updateMany({
        data: {
          balance: 0,
          totalDeposits: 0,
          totalWithdrawals: 0,
          lastUpdated: new Date(),
        },
      });

      // Get all completed payments (excluding expenses)
      const completedPayments = await prismaClient.payment.findMany({
        where: {
          status: 'COMPLETED',
          isExpense: false,
        },
        include: {
          specialOffering: true,
        },
        orderBy: { paymentDate: 'asc' },
      });

      console.log(`📊 Processing ${completedPayments.length} completed payments...`);

      let processedCount = 0;
      for (const payment of completedPayments) {
        try {
          await this.updateWalletsForPayment(payment.id, prismaClient);
          processedCount++;
        } catch (error) {
          console.error(`❌ Error processing payment ${payment.id}:`, error.message);
        }
      }

      console.log(`✅ Recalculation complete. Processed ${processedCount}/${completedPayments.length} payments.`);
      
      // Return summary
      const walletSummary = await prismaClient.wallet.findMany({
        where: { isActive: true },
        orderBy: [{ walletType: 'asc' }, { subType: 'asc' }],
      });

      return walletSummary.map(w => ({
        walletType: w.walletType,
        subType: w.subType,
        balance: parseFloat(w.balance.toString()),
        totalDeposits: parseFloat(w.totalDeposits.toString()),
        totalWithdrawals: parseFloat(w.totalWithdrawals.toString()),
      }));

    } catch (error) {
      console.error('❌ Error during wallet balance recalculation:', error.message);
      throw error;
    }
  }
  /**
   * Retrieves all wallets, groups them by type, and calculates overall summary statistics.
   * @returns {Promise<object>} An object containing grouped wallets and summary data.
   */
  static async getWalletsGroupedByType() {
    const allWallets = await prisma.wallet.findMany({
      orderBy: {
        walletType: 'asc',
        subType: 'asc',
      },
    });

    // If no wallets exist, return a default empty structure
    if (!allWallets || allWallets.length === 0) {
      return { 
        wallets: {}, 
        totalBalance: 0, 
        totalDeposits: 0, 
        totalWithdrawals: 0 
      };
    }

    // Calculate totals by iterating through the wallets
    let totalBalance = 0;
    let totalDeposits = 0;
    let totalWithdrawals = 0;

    allWallets.forEach(wallet => {
      totalBalance += Number(wallet.balance);
      totalDeposits += Number(wallet.totalDeposits);
      totalWithdrawals += Number(wallet.totalWithdrawals);
    });

    // Group wallets by their main type (e.g., TITHE, OFFERING)
    const groupedWallets = allWallets.reduce((acc, wallet) => {
      const key = wallet.walletType;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(wallet);
      return acc;
    }, {});

    return {
      wallets: groupedWallets,
      totalBalance,
      totalDeposits,
      totalWithdrawals
    };
  }

  // Validate tithe distribution amounts
  static validateTitheDistribution(distribution, totalAmount) {
    if (!distribution || typeof distribution !== 'object') {
      return { valid: true, totalDistributed: 0, remaining: totalAmount };
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
        errors.push(`Invalid amount for ${category}: must be a positive number`);
        return;
      }

      totalDistributed += amount;
    });

    // Check if total doesn't exceed payment amount
    if (totalDistributed > totalAmount) {
      errors.push(`Total distributed amount (${totalDistributed}) exceeds payment amount (${totalAmount})`);
    }

    return {
      valid: errors.length === 0,
      errors,
      totalDistributed,
      remaining: Math.max(0, totalAmount - totalDistributed)
    };
  }
}

module.exports = WalletService;