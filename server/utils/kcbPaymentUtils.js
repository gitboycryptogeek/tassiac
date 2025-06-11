// server/utils/kcbPaymentUtils.js
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Setup debug log file
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOG_DIR, 'kcb-payment-debug.log');

function debugLog(message, data = null) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] KCB_PAYMENT: ${message}`;
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

// KCB API Configuration
const KCB_CONFIG = {
  // Payment APIs
  baseUrl: process.env.KCB_BASE_URL || 'https://uat.buni.kcbgroup.com',
  apiKey: process.env.KCB_API_KEY,
  secretKey: process.env.KCB_SECRET_KEY,
  merchantId: process.env.KCB_MERCHANT_ID,
  
  // Account management APIs
  accountNumber: process.env.KCB_ACCOUNT_NUMBER,
  
  // Authentication
  tokenUrl: process.env.KCB_TOKEN_URL || 'https://uat.buni.kcbgroup.com/token?grant_type=client_credentials',
  
  // Endpoints
  endpoints: {
    payment: '/kcb/transaction/query/1.0.0/api/v1/payment/query',
    balance: '/kcb/account/balance/1.0.0/api/v1/account/balance',
    transactions: '/kcb/transaction/history/1.0.0/api/v1/transactions',
    transfer: '/kcb/funds/transfer/1.0.0/api/v1/transfer',
    stkPush: '/kcb/mpesa/stk/1.0.0/api/v1/stkpush'
  },
  
  environment: process.env.NODE_ENV || 'development'
};