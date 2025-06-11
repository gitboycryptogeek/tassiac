// server/utils/kcbPaymentUtils.js
const axios = require('axios');
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

// Validate KCB configuration
function validateKcbConfig() {
  const requiredFields = ['apiKey', 'secretKey', 'merchantId', 'accountNumber'];
  const missing = requiredFields.filter(field => !KCB_CONFIG[field]);
  
  if (missing.length > 0) {
    throw new Error(`Missing KCB configuration: ${missing.join(', ')}`);
  }
  
  return true;
}

// Get KCB access token
async function getKcbAccessToken() {
  try {
    validateKcbConfig();
    
    const credentials = Buffer.from(`${KCB_CONFIG.apiKey}:${KCB_CONFIG.secretKey}`).toString('base64');
    
    debugLog('Requesting KCB access token');
    
    const response = await axios({
      method: 'post',
      url: KCB_CONFIG.tokenUrl,
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: 'grant_type=client_credentials'
    });
    
    if (response.data && response.data.access_token) {
      debugLog('KCB access token obtained successfully');
      return response.data.access_token;
    }
    
    throw new Error('No access token in response');
    
  } catch (error) {
    debugLog('Error getting KCB access token:', error.message);
    throw new Error(`Failed to get KCB access token: ${error.message}`);
  }
}

// Get KCB account balance
async function getKcbAccountBalance() {
  try {
    const accessToken = await getKcbAccessToken();
    
    debugLog('Fetching KCB account balance');
    
    const response = await axios({
      method: 'post',
      url: `${KCB_CONFIG.baseUrl}${KCB_CONFIG.endpoints.balance}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        accountNumber: KCB_CONFIG.accountNumber,
        merchantId: KCB_CONFIG.merchantId
      }
    });
    
    if (response.data && response.data.status === 'success') {
      debugLog('KCB account balance retrieved successfully');
      return {
        availableBalance: parseFloat(response.data.availableBalance || 0),
        actualBalance: parseFloat(response.data.actualBalance || 0),
        currency: response.data.currency || 'KES',
        accountNumber: KCB_CONFIG.accountNumber,
        lastUpdated: new Date().toISOString()
      };
    }
    
    throw new Error(response.data?.message || 'Failed to get account balance');
    
  } catch (error) {
    debugLog('Error getting KCB account balance:', error.message);
    throw new Error(`Failed to get KCB account balance: ${error.message}`);
  }
}

// Get KCB transaction history
async function getKcbTransactionHistory(startDate, endDate, pageSize = 50, pageNumber = 1) {
  try {
    const accessToken = await getKcbAccessToken();
    
    // Default to last 30 days if no dates provided
    if (!startDate) {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
    if (!endDate) {
      endDate = new Date().toISOString().split('T')[0];
    }
    
    debugLog(`Fetching KCB transaction history from ${startDate} to ${endDate}`);
    
    const response = await axios({
      method: 'post',
      url: `${KCB_CONFIG.baseUrl}${KCB_CONFIG.endpoints.transactions}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        accountNumber: KCB_CONFIG.accountNumber,
        merchantId: KCB_CONFIG.merchantId,
        startDate,
        endDate,
        pageSize,
        pageNumber
      }
    });
    
    if (response.data && response.data.status === 'success') {
      debugLog(`Retrieved ${response.data.transactions?.length || 0} transactions`);
      
      return {
        transactions: response.data.transactions || [],
        totalCount: response.data.totalCount || 0,
        pageSize,
        pageNumber,
        hasMore: response.data.hasMore || false
      };
    }
    
    throw new Error(response.data?.message || 'Failed to get transaction history');
    
  } catch (error) {
    debugLog('Error getting KCB transaction history:', error.message);
    throw new Error(`Failed to get KCB transaction history: ${error.message}`);
  }
}

// Sync KCB transactions with database
async function syncKcbTransactions(startDate, endDate) {
  try {
    debugLog(`Starting KCB transaction sync from ${startDate} to ${endDate}`);
    
    const transactionData = await getKcbTransactionHistory(startDate, endDate, 100, 1);
    const kcbTransactions = transactionData.transactions;
    
    let newTransactions = 0;
    let linkedToPayments = 0;
    let duplicates = 0;
    
    for (const kcbTx of kcbTransactions) {
      try {
        // Check if transaction already exists
        const existingSync = await prisma.kcbTransactionSync.findUnique({
          where: { kcbTransactionId: kcbTx.transactionId }
        });
        
        if (existingSync) {
          duplicates++;
          continue;
        }
        
        // Create new sync record
        const syncRecord = await prisma.kcbTransactionSync.create({
          data: {
            kcbTransactionId: kcbTx.transactionId,
            kcbReference: kcbTx.reference,
            amount: parseFloat(kcbTx.amount),
            transactionDate: new Date(kcbTx.transactionDate),
            description: kcbTx.description,
            transactionType: kcbTx.amount > 0 ? 'CREDIT' : 'DEBIT',
            syncStatus: 'UNLINKED',
            rawData: kcbTx
          }
        });
        
        newTransactions++;
        
        // Try to automatically link to existing payments
        const linkedPayment = await tryLinkTransaction(syncRecord);
        if (linkedPayment) {
          linkedToPayments++;
        }
        
      } catch (txError) {
        debugLog(`Error processing transaction ${kcbTx.transactionId}:`, txError.message);
      }
    }
    
    debugLog(`Sync completed: ${newTransactions} new, ${linkedToPayments} linked, ${duplicates} duplicates`);
    
    return {
      new: newTransactions,
      linkedToPayments,
      duplicates,
      total: kcbTransactions.length
    };
    
  } catch (error) {
    debugLog('Error syncing KCB transactions:', error.message);
    throw new Error(`Failed to sync KCB transactions: ${error.message}`);
  }
}

// Try to automatically link KCB transaction to payment
async function tryLinkTransaction(kcbSync) {
  try {
    // Look for payments with matching amount and approximate date
    const matchingPayments = await prisma.payment.findMany({
      where: {
        amount: kcbSync.amount,
        paymentDate: {
          gte: new Date(kcbSync.transactionDate.getTime() - 24 * 60 * 60 * 1000), // -1 day
          lte: new Date(kcbSync.transactionDate.getTime() + 24 * 60 * 60 * 1000)   // +1 day
        },
        status: 'COMPLETED',
        kcbTransactionId: null
      }
    });
    
    if (matchingPayments.length === 1) {
      // Exact match found, link automatically
      const payment = matchingPayments[0];
      
      await prisma.$transaction([
        prisma.kcbTransactionSync.update({
          where: { id: kcbSync.id },
          data: {
            syncStatus: 'LINKED',
            linkedPaymentId: payment.id
          }
        }),
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            kcbTransactionId: kcbSync.kcbTransactionId,
            kcbReference: kcbSync.kcbReference
          }
        })
      ]);
      
      debugLog(`Auto-linked KCB transaction ${kcbSync.kcbTransactionId} to payment ${payment.id}`);
      return payment;
    }
    
    return null;
    
  } catch (error) {
    debugLog(`Error auto-linking transaction ${kcbSync.kcbTransactionId}:`, error.message);
    return null;
  }
}

// Initiate KCB M-Pesa STK Push
async function initiateKcbMpesaStkPush(reference, amount, phoneNumber, description) {
  try {
    const accessToken = await getKcbAccessToken();
    
    // Format phone number
    let formattedPhone = String(phoneNumber).trim();
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('+254')) {
      formattedPhone = formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }
    
    debugLog(`Initiating KCB STK Push: ${reference}, Amount: ${amount}, Phone: ${formattedPhone}`);
    
    const requestData = {
      merchantId: KCB_CONFIG.merchantId,
      accountReference: reference,
      amount: Math.round(amount),
      phoneNumber: formattedPhone,
      description: description || 'Payment to Tassia Central SDA Church',
      callbackUrl: process.env.KCB_CALLBACK_URL || `${process.env.BACKEND_URL}/api/payment/kcb/callback`
    };
    
    const response = await axios({
      method: 'post',
      url: `${KCB_CONFIG.baseUrl}${KCB_CONFIG.endpoints.stkPush}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: requestData
    });
    
    if (response.data && (response.data.status === 'success' || response.data.ResponseCode === '0')) {
      debugLog('KCB STK Push initiated successfully');
      
      return {
        success: true,
        reference: response.data.checkoutRequestId || response.data.reference || reference,
        transactionId: response.data.merchantRequestId || response.data.transactionId,
        message: response.data.message || 'STK Push sent to your phone. Please complete the payment.'
      };
    }
    
    throw new Error(response.data?.message || 'Failed to initiate STK Push');
    
  } catch (error) {
    debugLog('Error initiating KCB STK Push:', error.message);
    throw new Error(`Failed to initiate KCB payment: ${error.message}`);
  }
}

// Initiate KCB payment (for batch payments)
async function initiateKcbPayment(reference, amount, phoneNumber, description) {
  return await initiateKcbMpesaStkPush(reference, amount, phoneNumber, description);
}

// Initiate KCB withdrawal
async function initiateKcbWithdrawal(reference, amount, destination, purpose) {
  try {
    const accessToken = await getKcbAccessToken();
    
    debugLog(`Initiating KCB withdrawal: ${reference}, Amount: ${amount}, Destination: ${destination}`);
    
    const requestData = {
      merchantId: KCB_CONFIG.merchantId,
      accountNumber: KCB_CONFIG.accountNumber,
      reference: reference,
      amount: Math.round(amount),
      destination: destination,
      purpose: purpose || 'Church withdrawal',
      transactionType: 'WITHDRAWAL'
    };
    
    const response = await axios({
      method: 'post',
      url: `${KCB_CONFIG.baseUrl}${KCB_CONFIG.endpoints.transfer}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: requestData
    });
    
    if (response.data && response.data.status === 'success') {
      debugLog('KCB withdrawal initiated successfully');
      
      return {
        success: true,
        transactionId: response.data.transactionId,
        reference: response.data.reference || reference,
        message: response.data.message || 'Withdrawal initiated successfully'
      };
    }
    
    throw new Error(response.data?.message || 'Failed to initiate withdrawal');
    
  } catch (error) {
    debugLog('Error initiating KCB withdrawal:', error.message);
    throw new Error(`Failed to initiate KCB withdrawal: ${error.message}`);
  }
}

// Query KCB payment status
async function queryKcbPaymentStatus(transactionId) {
  try {
    const accessToken = await getKcbAccessToken();
    
    debugLog(`Querying KCB payment status for: ${transactionId}`);
    
    const response = await axios({
      method: 'post',
      url: `${KCB_CONFIG.baseUrl}${KCB_CONFIG.endpoints.payment}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        merchantId: KCB_CONFIG.merchantId,
        transactionId: transactionId
      }
    });
    
    if (response.data) {
      debugLog(`KCB payment status retrieved: ${response.data.status}`);
      return response.data;
    }
    
    throw new Error('No response data');
    
  } catch (error) {
    debugLog('Error querying KCB payment status:', error.message);
    throw new Error(`Failed to query payment status: ${error.message}`);
  }
}

// Test KCB connectivity
async function testKcbConnection() {
  try {
    debugLog('Testing KCB connection');
    
    validateKcbConfig();
    const token = await getKcbAccessToken();
    
    if (token) {
      debugLog('KCB connection test successful');
      return { success: true, message: 'KCB connection is working' };
    }
    
    throw new Error('No token received');
    
  } catch (error) {
    debugLog('KCB connection test failed:', error.message);
    return { success: false, message: error.message };
  }
}

module.exports = {
  getKcbAccountBalance,
  getKcbTransactionHistory,
  syncKcbTransactions,
  tryLinkTransaction,
  initiateKcbMpesaStkPush,
  initiateKcbPayment,
  initiateKcbWithdrawal,
  queryKcbPaymentStatus,
  testKcbConnection,
  validateKcbConfig,
  KCB_CONFIG
};