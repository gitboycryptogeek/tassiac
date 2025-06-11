// scripts/startup.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { 
  validateEnvironmentVariables, 
  validateKcbConfiguration, 
  validateMpesaConfiguration,
  generateEnvExample 
} = require('../server/utils/envValidation.js');
const { testKcbConnection } = require('../server/utils/kcbPaymentUtils.js');

// Load environment variables
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Tassia Central SDA Church Management System - Startup Script\n');
  
  // Step 1: Environment Validation
  console.log('📋 Step 1: Validating Environment Variables...');
  if (!validateEnvironmentVariables()) {
    console.error('❌ Environment validation failed. Please fix the issues above before continuing.');
    process.exit(1);
  }
  
  // Step 2: Database Connection Test
  console.log('\n📋 Step 2: Testing Database Connection...');
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('💡 Please check your DATABASE_URL_PRISMA and ensure your database server is running.');
    process.exit(1);
  }
  
  // Step 3: Database Schema Validation
  console.log('\n📋 Step 3: Validating Database Schema...');
  try {
    // Test if key tables exist by querying them
    const userCount = await prisma.user.count();
    const paymentCount = await prisma.payment.count();
    const walletCount = await prisma.wallet.count();
    
    console.log('✅ Database schema is valid');
    console.log(`📊 Current data: ${userCount} users, ${paymentCount} payments, ${walletCount} wallets`);
  } catch (error) {
    console.error('❌ Database schema validation failed:', error.message);
    console.error('💡 Please run: npx prisma db push');
    process.exit(1);
  }
  
  // Step 4: Admin User Check
  console.log('\n📋 Step 4: Checking Admin User...');
  try {
    const adminUser = await prisma.user.findFirst({
      where: { isAdmin: true, isActive: true }
    });
    
    if (!adminUser) {
      console.log('⚠️  No admin user found. Creating default admin...');
      await createDefaultAdmin();
    } else {
      console.log(`✅ Admin user found: ${adminUser.username} (${adminUser.fullName})`);
    }
  } catch (error) {
    console.error('❌ Admin user check failed:', error.message);
  }
  
  // Step 5: Wallet System Check
  console.log('\n📋 Step 5: Checking Wallet System...');
  try {
    const walletCount = await prisma.wallet.count();
    
    if (walletCount === 0) {
      console.log('⚠️  No wallets found. Initializing default wallets...');
      await initializeWallets();
    } else {
      console.log(`✅ Wallet system initialized: ${walletCount} wallets found`);
      
      // Show wallet summary
      const wallets = await prisma.wallet.findMany({
        where: { isActive: true }
      });
      
      const totalBalance = wallets.reduce((sum, w) => sum + parseFloat(w.balance.toString()), 0);
      console.log(`💰 Total wallet balance: KES ${totalBalance.toFixed(2)}`);
    }
  } catch (error) {
    console.error('❌ Wallet system check failed:', error.message);
  }
  
  // Step 6: KCB Integration Test
  console.log('\n📋 Step 6: Testing KCB Integration...');
  if (validateKcbConfiguration()) {
    try {
      const kcbTest = await testKcbConnection();
      if (kcbTest.success) {
        console.log('✅ KCB integration is working');
      } else {
        console.log('⚠️  KCB integration test failed:', kcbTest.message);
      }
    } catch (error) {
      console.log('⚠️  KCB integration test failed:', error.message);
    }
  } else {
    console.log('⚠️  KCB configuration incomplete - payment features will be limited');
  }
  
  // Step 7: M-Pesa Integration Test
  console.log('\n📋 Step 7: Checking M-Pesa Integration...');
  if (validateMpesaConfiguration()) {
    console.log('✅ M-Pesa configuration is complete');
  } else {
    console.log('⚠️  M-Pesa configuration incomplete - M-Pesa payments will not work');
  }
  
  // Step 8: Directory Structure Check
  console.log('\n📋 Step 8: Checking Directory Structure...');
  await checkDirectories();
  
  // Step 9: Generate Documentation
  console.log('\n📋 Step 9: Generating Documentation...');
  generateEnvExample();
  await generateSystemInfo();
  
  // Final Summary
  console.log('\n🎉 Startup validation completed successfully!');
  console.log('\n📋 System Summary:');
  
  const users = await prisma.user.count();
  const payments = await prisma.payment.count();
  const wallets = await prisma.wallet.count();
  const specialOfferings = await prisma.specialOffering.count();
  const receipts = await prisma.receipt.count();
  
  console.log(`👥 Users: ${users}`);
  console.log(`💳 Payments: ${payments}`);
  console.log(`👛 Wallets: ${wallets}`);
  console.log(`🎁 Special Offerings: ${specialOfferings}`);
  console.log(`🧾 Receipts: ${receipts}`);
  
  console.log('\n🚀 Your system is ready to use!');
  console.log('💡 Start the server with: npm run dev or npm start');
  
  await prisma.$disconnect();
}

async function createDefaultAdmin() {
  try {
    const defaultPassword = 'Admin@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        fullName: 'System Administrator',
        email: 'admin@tassiac.church',
        phone: '0700000000',
        isAdmin: true,
        role: 'SUPER_ADMIN',
        isActive: true
      }
    });
    
    console.log('✅ Default admin user created:');
    console.log(`   Username: admin`);
    console.log(`   Password: ${defaultPassword}`);
    console.log('⚠️  IMPORTANT: Change the default password after first login!');
    
    return admin;
  } catch (error) {
    console.error('❌ Failed to create default admin:', error.message);
    throw error;
  }
}

async function initializeWallets() {
  try {
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
      
      // Special offering wallet
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
        }
      } catch (error) {
        console.error(`Failed to create wallet ${walletConfig.walletType}/${walletConfig.subType}:`, error.message);
      }
    }
    
    console.log(`✅ Created ${createdWallets.length} default wallets`);
    return createdWallets;
  } catch (error) {
    console.error('❌ Failed to initialize wallets:', error.message);
    throw error;
  }
}

async function checkDirectories() {
  const fs = require('fs');
  const path = require('path');
  
  const requiredDirs = [
    'server/public',
    'server/public/receipts',
    'server/public/uploads',
    'server/public/uploads/receipt_attachments',
    'server/public/uploads/expense_receipts',
    'server/public/reports',
    'server/logs'
  ];

  let createdDirs = 0;
  
  for (const dir of requiredDirs) {
    const fullPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      createdDirs++;
    }
  }
  
  if (createdDirs > 0) {
    console.log(`✅ Created ${createdDirs} missing directories`);
  } else {
    console.log('✅ All required directories exist');
  }
}

async function generateSystemInfo() {
  const fs = require('fs');
  const path = require('path');
  
  const systemInfo = {
    system: 'Tassia Central SDA Church Management System',
    version: '2.0.0',
    generatedAt: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    
    features: [
      'User Authentication & Authorization',
      'Payment Processing (KCB & M-Pesa)',
      'Batch Payment Management',
      'Wallet System with Atomic Operations',
      'Receipt Generation (PDF)',
      'Special Offerings Management',
      'Admin Activity Logging',
      'Multi-Admin Withdrawal Approvals',
      'Contact Form Management',
      'Transaction Synchronization',
      'SMS Notifications'
    ],
    
    apiEndpoints: {
      auth: '/api/auth',
      payments: '/api/payment',
      receipts: '/api/receipt',
      contact: '/api/contact',
      specialOfferings: '/api/special-offerings',
      admin: '/api/admin',
      wallets: '/api/wallets',
      batchPayments: '/api/batch-payments',
      kcbSync: '/api/kcb-sync'
    },
    
    security: {
      authentication: 'JWT',
      passwordHashing: 'bcrypt',
      sessionManagement: 'express-session',
      rateLimiting: 'Custom middleware',
      inputValidation: 'express-validator',
      sqlInjectionPrevention: 'Prisma ORM',
      xssProtection: 'helmet',
      corsConfiguration: 'Configured'
    },
    
    database: {
      orm: 'Prisma',
      supportedDatabases: ['PostgreSQL', 'MySQL', 'SQLite'],
      migrations: 'Prisma Migrate',
      transactions: 'Atomic with isolation levels'
    },
    
    integrations: {
      kcb: 'KCB Bank API for payments and transactions',
      mpesa: 'Safaricom M-Pesa STK Push',
      sms: "Africa's Talking SMS Gateway",
      email: 'Ready for implementation'
    }
  };
  
  try {
    const infoPath = path.join(__dirname, '..', 'SYSTEM_INFO.json');
    fs.writeFileSync(infoPath, JSON.stringify(systemInfo, null, 2));
    console.log('✅ Generated SYSTEM_INFO.json');
  } catch (error) {
    console.error('⚠️  Failed to generate system info:', error.message);
  }
}

// Handle errors and cleanup
process.on('unhandledRejection', async (reason, promise) => {
  console.error('💥 Unhandled Promise Rejection:', reason);
  await prisma.$disconnect();
  process.exit(1);
});

process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught Exception:', error);
  await prisma.$disconnect();
  process.exit(1);
});

// Run the startup script
main()
  .catch(async (error) => {
    console.error('💥 Startup script failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });