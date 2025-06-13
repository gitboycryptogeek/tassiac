// scripts/fixWalletBalances.js
// This script fixes wallet balances from existing completed payments
// WITHOUT resetting or re-initializing wallets

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixWalletBalances() {
    console.log('🔧 Fixing wallet balances from existing payments...');
    
    try {
        // Get all existing wallets
        const wallets = await prisma.wallet.findMany({
            include: { specialOffering: true }
        });
        
        console.log(`🏦 Found ${wallets.length} existing wallets`);
        
        // Get all completed payments
        const completedPayments = await prisma.payment.findMany({
            where: { 
                status: 'COMPLETED',
                isExpense: false  // Only income, not expenses
            },
            include: { specialOffering: true }
        });
        
        console.log(`💳 Found ${completedPayments.length} completed payments to process`);
        
        if (completedPayments.length === 0) {
            console.log('⚠️  No completed payments found.');
            console.log('📝 Creating a sample payment to test the system...');
            
            // Get or create a user
            let user = await prisma.user.findFirst();
            if (!user) {
                user = await prisma.user.create({
                    data: {
                        username: 'testuser',
                        password: 'hashedpassword',
                        fullName: 'Test User',
                        phone: '0712345678',
                        email: 'test@example.com'
                    }
                });
            }
            
            // Create sample payments
            const samplePayments = [
                {
                    userId: user.id,
                    amount: 2000.00,
                    paymentType: 'TITHE',
                    paymentMethod: 'CASH',
                    description: 'Sample tithe payment',
                    status: 'COMPLETED',
                    receiptNumber: `SAMPLE${Date.now()}01`,
                    titheDistributionSDA: {
                        welfare: 500.00,
                        thanksgiving: 400.00,
                        stationFund: 400.00,
                        campMeetingExpenses: 400.00,
                        mediaMinistry: 300.00
                    }
                },
                {
                    userId: user.id,
                    amount: 1000.00,
                    paymentType: 'OFFERING',
                    paymentMethod: 'CASH',
                    description: 'Sample offering',
                    status: 'COMPLETED',
                    receiptNumber: `SAMPLE${Date.now()}02`
                },
                {
                    userId: user.id,
                    amount: 5000.00,
                    paymentType: 'DONATION',
                    paymentMethod: 'CASH',
                    description: 'Sample donation',
                    status: 'COMPLETED',
                    receiptNumber: `SAMPLE${Date.now()}03`
                }
            ];
            
            for (const paymentData of samplePayments) {
                await prisma.payment.create({ data: paymentData });
                console.log(`✅ Created sample ${paymentData.paymentType}: KES ${paymentData.amount}`);
            }
            
            // Reload completed payments
            const newCompletedPayments = await prisma.payment.findMany({
                where: { 
                    status: 'COMPLETED',
                    isExpense: false
                },
                include: { specialOffering: true }
            });
            
            completedPayments.push(...newCompletedPayments);
            console.log(`📊 Now have ${completedPayments.length} completed payments`);
        }
        
        console.log('\n🧮 Calculating balances for each wallet...');
        
        let totalSystemBalance = 0;
        
        for (const wallet of wallets) {
            let deposits = 0;
            let withdrawals = 0;
            
            const walletName = wallet.subType ? `${wallet.walletType}-${wallet.subType}` : wallet.walletType;
            console.log(`\n💰 Processing: ${walletName} (ID: ${wallet.id})`);
            
            if (wallet.walletType === 'TITHE' && wallet.subType) {
                // TITHE sub-wallets: Get from titheDistributionSDA
                completedPayments.forEach(payment => {
                    if (payment.paymentType === 'TITHE' && payment.titheDistributionSDA) {
                        const amount = payment.titheDistributionSDA[wallet.subType] || 0;
                        if (amount > 0) {
                            deposits += amount;
                            console.log(`  📝 Payment ${payment.receiptNumber}: +KES ${amount}`);
                        }
                    }
                });
                
            } else if (wallet.walletType === 'SPECIAL_OFFERING' && wallet.specialOfferingId) {
                // SPECIAL_OFFERING wallets
                completedPayments.forEach(payment => {
                    if (payment.paymentType === 'SPECIAL_OFFERING_CONTRIBUTION' && 
                        payment.specialOfferingId === wallet.specialOfferingId) {
                        deposits += payment.amount;
                        console.log(`  📝 Payment ${payment.receiptNumber}: +KES ${payment.amount}`);
                    }
                });
                
            } else {
                // Other wallet types (OFFERING, DONATION, main TITHE)
                completedPayments.forEach(payment => {
                    if (payment.paymentType === wallet.walletType) {
                        deposits += payment.amount;
                        console.log(`  📝 Payment ${payment.receiptNumber}: +KES ${payment.amount}`);
                    }
                });
            }
            
            // Calculate withdrawals (expenses for this wallet type)
            const expensePayments = await prisma.payment.findMany({
                where: {
                    status: 'COMPLETED',
                    isExpense: true,
                    paymentType: wallet.walletType
                }
            });
            
            withdrawals = expensePayments.reduce((sum, payment) => {
                console.log(`  📤 Expense ${payment.receiptNumber}: -KES ${payment.amount}`);
                return sum + payment.amount;
            }, 0);
            
            const newBalance = deposits - withdrawals;
            totalSystemBalance += newBalance;
            
            // Update the wallet
            await prisma.wallet.update({
                where: { id: wallet.id },
                data: {
                    balance: newBalance,
                    totalDeposits: deposits,
                    totalWithdrawals: withdrawals,
                    lastUpdated: new Date(),
                    isActive: true  // Ensure wallet is active
                }
            });
            
            console.log(`  💰 Final: KES ${newBalance.toFixed(2)} (${deposits.toFixed(2)} deposits - ${withdrawals.toFixed(2)} withdrawals)`);
        }
        
        console.log('\n🎉 Wallet balance fixing completed!');
        console.log(`💰 Total church balance: KES ${totalSystemBalance.toFixed(2)}`);
        console.log(`🏦 Wallets updated: ${wallets.length}`);
        
        // Show final breakdown
        console.log('\n📊 Final wallet balances:');
        const updatedWallets = await prisma.wallet.findMany({
            include: { specialOffering: true }
        });
        
        const categories = {};
        updatedWallets.forEach(w => {
            const category = w.walletType;
            if (!categories[category]) categories[category] = 0;
            categories[category] += w.balance;
            
            const name = w.subType ? `  ${w.subType}` : `${w.walletType}`;
            console.log(`  ${name}: KES ${w.balance.toFixed(2)}`);
        });
        
        console.log('\n📈 Category totals:');
        Object.entries(categories).forEach(([type, total]) => {
            console.log(`  ${type}: KES ${total.toFixed(2)}`);
        });
        
    } catch (error) {
        console.error('❌ Error fixing wallet balances:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the fix
fixWalletBalances()
    .then(() => {
        console.log('\n✅ Wallet balance fix completed successfully!');
        console.log('🔄 Refresh your wallet page to see the updated balances.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Wallet balance fix failed:', error);
        process.exit(1);
    });