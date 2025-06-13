// scripts/simpleWalletFix.js
// Simple script to fix wallet issues without complex Prisma queries

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function ensureNumber(value) {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
}

function formatCurrency(amount) {
    return ensureNumber(amount).toFixed(2);
}

async function simpleWalletFix() {
    console.log('🔧 Simple wallet system fix...');
    
    try {
        // Step 1: Get all wallets and fix any with missing types
        console.log('\n📝 Step 1: Checking and fixing wallet types...');
        
        const allWallets = await prisma.wallet.findMany({
            include: { specialOffering: true }
        });
        
        console.log(`🏦 Found ${allWallets.length} wallets total`);
        
        // Fix wallets with missing walletType
        let fixedCount = 0;
        for (const wallet of allWallets) {
            if (!wallet.walletType || wallet.walletType === '') {
                let newType = 'UNKNOWN';
                
                // Try to determine type from subType
                if (wallet.subType) {
                    const titheSubTypes = ['welfare', 'thanksgiving', 'stationFund', 'campMeetingExpenses', 'mediaMinistry'];
                    if (titheSubTypes.includes(wallet.subType)) {
                        newType = 'TITHE';
                    }
                } else if (wallet.specialOfferingId) {
                    newType = 'SPECIAL_OFFERING';
                }
                
                await prisma.wallet.update({
                    where: { id: wallet.id },
                    data: { 
                        walletType: newType,
                        isActive: true 
                    }
                });
                
                console.log(`✅ Fixed wallet ${wallet.id}: ${newType}${wallet.subType ? `-${wallet.subType}` : ''}`);
                fixedCount++;
            }
        }
        
        if (fixedCount === 0) {
            console.log('✅ All wallets have proper types');
        }
        
        // Step 2: Ensure we have all required wallet categories
        console.log('\n🆕 Step 2: Creating missing wallet categories...');
        
        const updatedWallets = await prisma.wallet.findMany({
            include: { specialOffering: true }
        });
        
        const requiredWallets = [
            { walletType: 'OFFERING', subType: null, uniqueKey: 'OFFERING-NULL' },
            { walletType: 'DONATION', subType: null, uniqueKey: 'DONATION-NULL' },
            { walletType: 'TITHE', subType: null, uniqueKey: 'TITHE-NULL' },
            { walletType: 'TITHE', subType: 'welfare', uniqueKey: 'TITHE-welfare' },
            { walletType: 'TITHE', subType: 'thanksgiving', uniqueKey: 'TITHE-thanksgiving' },
            { walletType: 'TITHE', subType: 'stationFund', uniqueKey: 'TITHE-stationFund' },
            { walletType: 'TITHE', subType: 'campMeetingExpenses', uniqueKey: 'TITHE-campMeetingExpenses' },
            { walletType: 'TITHE', subType: 'mediaMinistry', uniqueKey: 'TITHE-mediaMinistry' }
        ];
        
        let createdCount = 0;
        for (const required of requiredWallets) {
            const exists = updatedWallets.find(w => 
                w.walletType === required.walletType && 
                w.subType === required.subType
            );
            
            if (!exists) {
                await prisma.wallet.create({
                    data: {
                        walletType: required.walletType,
                        subType: required.subType,
                        uniqueKey: required.uniqueKey,
                        balance: 0,
                        totalDeposits: 0,
                        totalWithdrawals: 0,
                        isActive: true,
                        lastUpdated: new Date()
                    }
                });
                console.log(`✅ Created ${required.walletType}${required.subType ? `-${required.subType}` : ''}`);
                createdCount++;
            }
        }
        
        if (createdCount === 0) {
            console.log('✅ All required wallets exist');
        }
        
        // Step 3: Handle special offerings
        console.log('\n✨ Step 3: Processing special offerings...');
        
        const specialOfferings = await prisma.specialOffering.findMany({
            where: { isActive: true }
        });
        
        console.log(`📋 Found ${specialOfferings.length} active special offerings`);
        
        if (specialOfferings.length === 0) {
            console.log('🆕 Creating sample special offering...');
            
            // Get first user
            let user = await prisma.user.findFirst();
            if (!user) {
                throw new Error('No users found. Please create a user first.');
            }
            
            const newOffering = await prisma.specialOffering.create({
                data: {
                    offeringCode: 'BUILDING2024',
                    name: 'Church Building Fund',
                    description: 'Fundraising for new church building construction',
                    targetAmount: 500000,
                    isActive: true,
                    createdById: user.id
                }
            });
            
            specialOfferings.push(newOffering);
            console.log(`✅ Created special offering: ${newOffering.name}`);
        }
        
        // Create wallets for special offerings
        for (const offering of specialOfferings) {
            const existingWallet = updatedWallets.find(w => 
                w.walletType === 'SPECIAL_OFFERING' && 
                w.specialOfferingId === offering.id
            );
            
            if (!existingWallet) {
                await prisma.wallet.create({
                    data: {
                        walletType: 'SPECIAL_OFFERING',
                        subType: offering.offeringCode,
                        uniqueKey: `SPECIAL_OFFERING-${offering.id}`,
                        specialOfferingId: offering.id,
                        balance: 0,
                        totalDeposits: 0,
                        totalWithdrawals: 0,
                        isActive: true,
                        lastUpdated: new Date()
                    }
                });
                console.log(`✅ Created wallet for: ${offering.name}`);
            }
        }
        
        // Step 4: Calculate balances from payments
        console.log('\n💰 Step 4: Calculating wallet balances...');
        
        const completedPayments = await prisma.payment.findMany({
            where: { 
                status: 'COMPLETED',
                isExpense: false
            }
        });
        
        console.log(`💳 Found ${completedPayments.length} completed payments`);
        
        if (completedPayments.length === 0) {
            console.log('⚠️ No payments found. Creating sample payments...');
            
            let user = await prisma.user.findFirst();
            if (!user) {
                throw new Error('No users found');
            }
            
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
            
            // Add special offering payment if we have one
            const firstOffering = specialOfferings[0];
            if (firstOffering) {
                samplePayments.push({
                    userId: user.id,
                    amount: 5000.00,
                    paymentType: 'SPECIAL_OFFERING_CONTRIBUTION',
                    paymentMethod: 'CASH',
                    description: 'Building fund contribution',
                    status: 'COMPLETED',
                    receiptNumber: `SAMPLE${timestamp}04`,
                    specialOfferingId: firstOffering.id
                });
            }
            
            for (const paymentData of samplePayments) {
                await prisma.payment.create({ data: paymentData });
                console.log(`✅ Created ${paymentData.paymentType}: KES ${paymentData.amount}`);
            }
            
            // Reload payments
            const newPayments = await prisma.payment.findMany({
                where: { 
                    status: 'COMPLETED',
                    isExpense: false
                }
            });
            
            completedPayments.push(...newPayments);
        }
        
        // Step 5: Update all wallet balances
        console.log('\n🧮 Step 5: Updating wallet balances...');
        
        const finalWallets = await prisma.wallet.findMany({
            include: { specialOffering: true }
        });
        
        let grandTotal = 0;
        
        for (const wallet of finalWallets) {
            let totalDeposits = 0;
            let totalWithdrawals = 0;
            
            const walletName = wallet.subType ? `${wallet.walletType}-${wallet.subType}` : wallet.walletType;
            
            // Calculate deposits based on wallet type
            if (wallet.walletType === 'TITHE' && wallet.subType) {
                // TITHE sub-wallets from titheDistributionSDA
                for (const payment of completedPayments) {
                    if (payment.paymentType === 'TITHE' && payment.titheDistributionSDA) {
                        const amount = ensureNumber(payment.titheDistributionSDA[wallet.subType]);
                        totalDeposits += amount;
                    }
                }
            } else if (wallet.walletType === 'SPECIAL_OFFERING' && wallet.specialOfferingId) {
                // Special offering contributions
                for (const payment of completedPayments) {
                    if (payment.paymentType === 'SPECIAL_OFFERING_CONTRIBUTION' && 
                        payment.specialOfferingId === wallet.specialOfferingId) {
                        totalDeposits += ensureNumber(payment.amount);
                    }
                }
            } else {
                // Other wallet types (OFFERING, DONATION, main TITHE)
                for (const payment of completedPayments) {
                    if (payment.paymentType === wallet.walletType) {
                        totalDeposits += ensureNumber(payment.amount);
                    }
                }
            }
            
            // Calculate withdrawals (expenses)
            const expenses = await prisma.payment.findMany({
                where: {
                    status: 'COMPLETED',
                    isExpense: true,
                    paymentType: wallet.walletType
                }
            });
            
            for (const expense of expenses) {
                totalWithdrawals += ensureNumber(expense.amount);
            }
            
            const finalBalance = totalDeposits - totalWithdrawals;
            grandTotal += finalBalance;
            
            // Update wallet
            await prisma.wallet.update({
                where: { id: wallet.id },
                data: {
                    balance: ensureNumber(finalBalance),
                    totalDeposits: ensureNumber(totalDeposits),
                    totalWithdrawals: ensureNumber(totalWithdrawals),
                    lastUpdated: new Date(),
                    isActive: true
                }
            });
            
            if (finalBalance > 0 || totalDeposits > 0) {
                console.log(`💰 ${walletName}: KES ${formatCurrency(finalBalance)} (${formatCurrency(totalDeposits)} - ${formatCurrency(totalWithdrawals)})`);
            }
        }
        
        // Final summary
        console.log('\n🎉 Simple wallet fix completed!');
        console.log(`💰 Total church balance: KES ${formatCurrency(grandTotal)}`);
        console.log(`🏦 Total wallets: ${finalWallets.length}`);
        
        // Show category totals
        const categories = {};
        for (const wallet of finalWallets) {
            const category = wallet.walletType;
            if (!categories[category]) categories[category] = 0;
            categories[category] += ensureNumber(wallet.balance);
        }
        
        console.log('\n📈 Balance by category:');
        Object.entries(categories).forEach(([category, total]) => {
            if (total > 0) {
                console.log(`  ${category}: KES ${formatCurrency(total)}`);
            }
        });
        
        // List wallets with balances
        console.log('\n📋 Wallets with balances:');
        const walletsWithBalance = finalWallets.filter(w => w.balance > 0);
        if (walletsWithBalance.length > 0) {
            walletsWithBalance.forEach(w => {
                const name = w.subType ? `${w.walletType}-${w.subType}` : w.walletType;
                console.log(`  ${name}: KES ${formatCurrency(w.balance)}`);
            });
        } else {
            console.log('  No wallets have positive balances yet');
        }
        
    } catch (error) {
        console.error('❌ Error in simple wallet fix:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Main execution
async function main() {
    try {
        await simpleWalletFix();
        console.log('\n✅ SUCCESS: Simple wallet fix completed!');
        console.log('🔄 Refresh your wallet page to see the changes.');
    } catch (error) {
        console.error('\n💥 FAILED: Simple wallet fix failed');
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();