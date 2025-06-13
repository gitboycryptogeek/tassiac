// scripts/cleanWalletFix.js
// Clean script to fix wallet balances with proper type handling

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function ensureNumber(value) {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
}

function formatCurrency(amount) {
    return ensureNumber(amount).toFixed(2);
}

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
                isExpense: false
            },
            include: { specialOffering: true }
        });
        
        console.log(`💳 Found ${completedPayments.length} completed payments to process`);
        
        if (completedPayments.length === 0) {
            console.log('⚠️ No completed payments found. Creating sample payments...');
            
            // Get first user
            let user = await prisma.user.findFirst();
            if (!user) {
                throw new Error('No users found in database. Please create a user first.');
            }
            
            // Create sample payments with proper amounts
            const timestamp = Date.now();
            const samplePayments = [
                {
                    userId: user.id,
                    amount: 3000.00,
                    paymentType: 'TITHE',
                    paymentMethod: 'CASH',
                    description: 'Sample tithe payment',
                    status: 'COMPLETED',
                    receiptNumber: `SAMPLE${timestamp}01`,
                    titheDistributionSDA: {
                        welfare: 800.00,
                        thanksgiving: 600.00,
                        stationFund: 500.00,
                        campMeetingExpenses: 600.00,
                        mediaMinistry: 500.00
                    }
                },
                {
                    userId: user.id,
                    amount: 1500.00,
                    paymentType: 'OFFERING',
                    paymentMethod: 'CASH',
                    description: 'Sample offering',
                    status: 'COMPLETED',
                    receiptNumber: `SAMPLE${timestamp}02`
                },
                {
                    userId: user.id,
                    amount: 2500.00,
                    paymentType: 'DONATION',
                    paymentMethod: 'CASH',
                    description: 'Sample donation',
                    status: 'COMPLETED',
                    receiptNumber: `SAMPLE${timestamp}03`
                }
            ];
            
            for (const paymentData of samplePayments) {
                await prisma.payment.create({ data: paymentData });
                console.log(`✅ Created ${paymentData.paymentType}: KES ${paymentData.amount}`);
            }
            
            // Reload payments
            const newPayments = await prisma.payment.findMany({
                where: { 
                    status: 'COMPLETED',
                    isExpense: false
                },
                include: { specialOffering: true }
            });
            
            completedPayments.push(...newPayments);
            console.log(`📊 Total payments now: ${completedPayments.length}`);
        }
        
        console.log('\n🧮 Processing each wallet...');
        
        let grandTotal = 0;
        const results = [];
        
        for (const wallet of wallets) {
            const walletName = wallet.subType ? `${wallet.walletType}-${wallet.subType}` : wallet.walletType;
            console.log(`\n💰 Processing: ${walletName} (ID: ${wallet.id})`);
            
            let totalDeposits = 0;
            let totalWithdrawals = 0;
            
            // Process deposits based on wallet type
            if (wallet.walletType === 'TITHE' && wallet.subType) {
                // Handle TITHE sub-wallets
                for (const payment of completedPayments) {
                    if (payment.paymentType === 'TITHE' && payment.titheDistributionSDA) {
                        const distribution = payment.titheDistributionSDA;
                        const amount = ensureNumber(distribution[wallet.subType]);
                        if (amount > 0) {
                            totalDeposits += amount;
                            const ref = payment.receiptNumber || `ID-${payment.id}`;
                            console.log(`  📝 ${ref}: +KES ${formatCurrency(amount)}`);
                        }
                    }
                }
            } else if (wallet.walletType === 'SPECIAL_OFFERING' && wallet.specialOfferingId) {
                // Handle SPECIAL_OFFERING wallets
                for (const payment of completedPayments) {
                    if (payment.paymentType === 'SPECIAL_OFFERING_CONTRIBUTION' && 
                        payment.specialOfferingId === wallet.specialOfferingId) {
                        const amount = ensureNumber(payment.amount);
                        totalDeposits += amount;
                        const ref = payment.receiptNumber || `ID-${payment.id}`;
                        console.log(`  📝 ${ref}: +KES ${formatCurrency(amount)}`);
                    }
                }
            } else {
                // Handle other wallet types (OFFERING, DONATION, main TITHE)
                for (const payment of completedPayments) {
                    if (payment.paymentType === wallet.walletType) {
                        const amount = ensureNumber(payment.amount);
                        totalDeposits += amount;
                        const ref = payment.receiptNumber || `ID-${payment.id}`;
                        console.log(`  📝 ${ref}: +KES ${formatCurrency(amount)}`);
                    }
                }
            }
            
            // Process withdrawals (expenses)
            const expensePayments = await prisma.payment.findMany({
                where: {
                    status: 'COMPLETED',
                    isExpense: true,
                    paymentType: wallet.walletType
                }
            });
            
            for (const expense of expensePayments) {
                const amount = ensureNumber(expense.amount);
                totalWithdrawals += amount;
                const ref = expense.receiptNumber || `ID-${expense.id}`;
                console.log(`  📤 ${ref}: -KES ${formatCurrency(amount)}`);
            }
            
            // Calculate final balance
            const finalBalance = totalDeposits - totalWithdrawals;
            grandTotal += finalBalance;
            
            // Store result
            results.push({
                id: wallet.id,
                name: walletName,
                balance: finalBalance,
                deposits: totalDeposits,
                withdrawals: totalWithdrawals
            });
            
            console.log(`  💰 Balance: KES ${formatCurrency(finalBalance)} (${formatCurrency(totalDeposits)} - ${formatCurrency(totalWithdrawals)})`);
        }
        
        console.log('\n📊 Updating database...');
        
        // Update all wallets in database
        for (const result of results) {
            await prisma.wallet.update({
                where: { id: result.id },
                data: {
                    balance: ensureNumber(result.balance),
                    totalDeposits: ensureNumber(result.deposits),
                    totalWithdrawals: ensureNumber(result.withdrawals),
                    lastUpdated: new Date(),
                    isActive: true
                }
            });
            console.log(`✅ Updated ${result.name}: KES ${formatCurrency(result.balance)}`);
        }
        
        console.log('\n🎉 Wallet fixing completed successfully!');
        console.log(`💰 Total church balance: KES ${formatCurrency(grandTotal)}`);
        console.log(`🏦 Wallets updated: ${wallets.length}`);
        
        // Show category breakdown
        console.log('\n📈 Balance by category:');
        const categories = {};
        
        for (const result of results) {
            const [category] = result.name.split('-');
            if (!categories[category]) categories[category] = 0;
            categories[category] += result.balance;
        }
        
        Object.entries(categories).forEach(([category, total]) => {
            if (total > 0) {
                console.log(`  ${category}: KES ${formatCurrency(total)}`);
            }
        });
        
        // Show individual wallet breakdown
        console.log('\n📋 Individual wallet balances:');
        results
            .filter(r => r.balance > 0)
            .forEach(result => {
                console.log(`  ${result.name}: KES ${formatCurrency(result.balance)}`);
            });
        
        // Data quality check
        console.log('\n🔍 Data quality check:');
        const paymentsWithoutReceipts = completedPayments.filter(p => !p.receiptNumber).length;
        const titheWithDistribution = completedPayments.filter(p => 
            p.paymentType === 'TITHE' && p.titheDistributionSDA
        ).length;
        const totalTithe = completedPayments.filter(p => p.paymentType === 'TITHE').length;
        
        console.log(`  Payments without receipts: ${paymentsWithoutReceipts}/${completedPayments.length}`);
        console.log(`  Tithe with SDA distribution: ${titheWithDistribution}/${totalTithe}`);
        
        if (paymentsWithoutReceipts > 0) {
            console.log('💡 Consider adding receipt numbers to existing payments');
        }
        
    } catch (error) {
        console.error('❌ Error fixing wallet balances:', error);
        console.error('Stack trace:', error.stack);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Main execution
async function main() {
    try {
        await fixWalletBalances();
        console.log('\n✅ SUCCESS: Wallet balances fixed!');
        console.log('🔄 Refresh your admin wallet page to see the changes.');
    } catch (error) {
        console.error('\n💥 FAILED: Could not fix wallet balances');
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Run the script
main();