const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function safeDeleteMany(model, modelName) {
  try {
    await model.deleteMany({});
    console.log(`✓ Cleaned ${modelName}`);
  } catch (error) {
    if (error.code === 'P2021') {
      console.log(`⚠ Table ${modelName} does not exist, skipping...`);
    } else {
      throw error;
    }
  }
}

async function main() {
  console.log('Start seeding ...');

  // 1. Clean up the database (safely)
  console.log('Cleaning database...');
  
  // Delete in an order that respects foreign key constraints
  await safeDeleteMany(prisma.withdrawalApproval, 'WithdrawalApprovals');
  await safeDeleteMany(prisma.withdrawalRequest, 'WithdrawalRequests');
  await safeDeleteMany(prisma.wallet, 'Wallets');
  await safeDeleteMany(prisma.kcbTransactionSync, 'KcbTransactionSyncs');
  await safeDeleteMany(prisma.receipt, 'Receipts');
  await safeDeleteMany(prisma.payment, 'Payments');
  await safeDeleteMany(prisma.batchPayment, 'BatchPayments');
  await safeDeleteMany(prisma.specialOffering, 'SpecialOfferings');
  await safeDeleteMany(prisma.adminActionApproval, 'AdminActionApprovals');
  await safeDeleteMany(prisma.adminAction, 'AdminActions');
  await safeDeleteMany(prisma.notification, 'Notifications');
  await safeDeleteMany(prisma.contactInquiry, 'ContactInquiries');
  await safeDeleteMany(prisma.user, 'Users');
  
  console.log('Database cleaning completed.');

  // 2. Create Users
  console.log('Creating users...');
  const saltRounds = 10;
  const adminPassword = await bcrypt.hash('Admin@123', saltRounds);
  const userPassword1 = await bcrypt.hash('User@123', saltRounds);
  const userPassword2 = await bcrypt.hash('User@456', saltRounds);

  const adminUser = await prisma.user.create({
    data: {
      username: 'admin',
      password: adminPassword,
      fullName: 'Admin User',
      email: 'admin@example.com',
      phone: '0700000000',
      isAdmin: true,
      role: 'SUPER_ADMIN',
    },
  });

  const user1 = await prisma.user.create({
    data: {
      username: 'john.doe',
      password: userPassword1,
      fullName: 'John Doe',
      email: 'john.doe@example.com',
      phone: '0712345678',
      isAdmin: false,
      role: 'MEMBER',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      username: 'jane.doe',
      password: userPassword2,
      fullName: 'Jane Doe',
      email: 'jane.doe@example.com',
      phone: '0787654321',
      isAdmin: false,
      role: 'MEMBER',
    },
  });
  console.log(`✓ Created admin user: ${adminUser.username}`);
  console.log(`✓ Created regular user: ${user1.username}`);
  console.log(`✓ Created regular user: ${user2.username}`);

  // 3. Create a Special Offering
  console.log('Creating special offering...');
  const specialOffering = await prisma.specialOffering.create({
    data: {
      name: 'Church Building Fund',
      offeringCode: 'BLD2024',
      description: 'Fundraising for the new church building project.',
      targetAmount: 5000000.0,
      startDate: new Date('2024-01-01T00:00:00Z'),
      endDate: new Date('2024-12-31T23:59:59Z'),
      isActive: true,
      creator: {
        connect: { id: adminUser.id },
      },
    },
  });
  console.log(`✓ Created special offering: ${specialOffering.name}`);

  // 4. Create sample payments
  console.log('Creating sample payments...');
  
  // Example: Create a Tithe payment for John Doe
  await prisma.payment.create({
    data: {
      userId: user1.id,
      amount: 1000.0,
      paymentType: 'TITHE',
      paymentMethod: 'MANUAL',
      description: 'Monthly Tithe - August',
      status: 'COMPLETED',
      paymentDate: new Date(),
      titheDistributionSDA: {
        welfare: 500,
        stationFund: 500,
      },
      processedById: adminUser.id,
    },
  });
  console.log(`✓ Created sample Tithe payment for ${user1.fullName}`);
  
  // Example: Create a contribution to the special offering for Jane Doe
  await prisma.payment.create({
      data: {
        userId: user2.id,
        amount: 5000.0,
        paymentType: `SPECIAL_OFFERING_${specialOffering.id}`,
        paymentMethod: 'MANUAL',
        description: `Contribution to ${specialOffering.name}`,
        status: 'COMPLETED',
        paymentDate: new Date(),
        specialOfferingId: specialOffering.id,
        processedById: adminUser.id,
      }
  });
  console.log(`✓ Created sample Special Offering payment for ${user2.fullName}`);

  console.log('\n🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });