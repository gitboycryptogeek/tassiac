// server/utils/kcbPaymentUtils.js
const fs = require('fs');
const path = require('path');

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
  baseUrl: process.env.KCB_BASE_URL || 'https://api.kcbbankgroup.com/v1', // Replace with actual KCB API URL
  apiKey: process.env.KCB_API_KEY,
  secretKey: process.env.KCB_SECRET_KEY,
  merchantId: process.env.KCB_MERCHANT_ID,
  environment: process.env.NODE_ENV || 'development'
};

/**
 * Generate KCB API authentication token
 */
async function generateKcbToken() {
  try {
    debugLog('Generating KCB authentication token');
    
    // TODO: Implement actual KCB token generation logic
    // This is a placeholder - replace with actual KCB API authentication
    
    const credentials = Buffer.from(`${KCB_CONFIG.apiKey}:${KCB_CONFIG.secretKey}`).toString('base64');
    
    const response = await fetch(`${KCB_CONFIG.baseUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify({
        grant_type: 'client_credentials'
      })
    });

    if (!response.ok) {
      throw new Error(`KCB token request failed: ${response.status} ${response.statusText}`);
    }

    const tokenData = await response.json();
    debugLog('KCB token generated successfully');
    
    return tokenData.access_token;
  } catch (error) {
    debugLog('Error generating KCB token:', error.message);
    throw new Error(`Failed to generate KCB authentication token: ${error.message}`);
  }
}

/**
 * Initiate KCB payment
 * @param {string} paymentId - Internal payment ID
 * @param {number} amount - Payment amount
 * @param {string} phoneNumber - Customer phone number
 * @param {string} description - Payment description
 */
async function initiateKcbPayment(paymentId, amount, phoneNumber, description) {
  try {
    debugLog('Initiating KCB payment', {
      paymentId,
      amount,
      phoneNumber: phoneNumber.substring(0, 5) + '****', // Mask phone number in logs
      description
    });

    // Validate inputs
    if (!paymentId || !amount || !phoneNumber) {
      throw new Error('Missing required parameters for KCB payment initiation');
    }

    // Validate phone number format for Kenya
    const cleanPhoneNumber = phoneNumber.replace(/\s+/g, '');
    if (!/^254\d{9}$/.test(cleanPhoneNumber)) {
      throw new Error('Invalid phone number format. Expected format: 254XXXXXXXXX');
    }

    // Generate authentication token
    const authToken = await generateKcbToken();

    // Prepare payment request payload
    const paymentRequest = {
      merchantId: KCB_CONFIG.merchantId,
      transactionReference: `PAYMENT_${paymentId}_${Date.now()}`,
      amount: parseFloat(amount).toFixed(2),
      currency: 'KES',
      phoneNumber: cleanPhoneNumber,
      description: description.substring(0, 100), // Limit description length
      callbackUrl: `${process.env.BASE_URL}/api/payment/kcb-callback`,
      metadata: {
        paymentId: paymentId,
        source: 'church_payment_system'
      }
    };

    debugLog('Sending KCB payment request', {
      merchantId: paymentRequest.merchantId,
      transactionReference: paymentRequest.transactionReference,
      amount: paymentRequest.amount
    });

    // TODO: Replace with actual KCB API endpoint and request structure
    const response = await fetch(`${KCB_CONFIG.baseUrl}/payments/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-Merchant-ID': KCB_CONFIG.merchantId
      },
      body: JSON.stringify(paymentRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      debugLog('KCB payment initiation failed', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`KCB payment request failed: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    debugLog('KCB payment initiated successfully', {
      transactionReference: responseData.transactionReference,
      status: responseData.status
    });

    // Return standardized response format
    return {
      reference: responseData.transactionReference || paymentRequest.transactionReference,
      transactionId: responseData.transactionId || responseData.transactionReference,
      message: responseData.message || 'KCB payment initiated. Please complete the transaction on your phone.',
      status: responseData.status || 'PENDING',
      providerResponse: responseData
    };

  } catch (error) {
    debugLog('Error initiating KCB payment:', error.message);
    
    // Return error in standardized format
    return {
      reference: `ERROR_${paymentId}_${Date.now()}`,
      transactionId: null,
      message: `KCB payment initiation failed: ${error.message}`,
      status: 'FAILED',
      error: error.message
    };
  }
}

/**
 * Query KCB payment status
 * @param {string} transactionReference - KCB transaction reference
 */
async function queryKcbPaymentStatus(transactionReference) {
  try {
    debugLog('Querying KCB payment status', { transactionReference });

    const authToken = await generateKcbToken();

    // TODO: Replace with actual KCB status query endpoint
    const response = await fetch(`${KCB_CONFIG.baseUrl}/payments/status/${transactionReference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Merchant-ID': KCB_CONFIG.merchantId
      }
    });

    if (!response.ok) {
      throw new Error(`KCB status query failed: ${response.status} ${response.statusText}`);
    }

    const statusData = await response.json();
    debugLog('KCB payment status retrieved', {
      transactionReference,
      status: statusData.status
    });

    return {
      transactionReference: statusData.transactionReference,
      status: statusData.status, // PENDING, COMPLETED, FAILED, etc.
      amount: statusData.amount,
      transactionDate: statusData.transactionDate,
      transactionId: statusData.transactionId,
      resultDescription: statusData.resultDescription
    };

  } catch (error) {
    debugLog('Error querying KCB payment status:', error.message);
    throw new Error(`Failed to query KCB payment status: ${error.message}`);
  }
}

/**
 * Validate KCB callback signature (if KCB provides signature validation)
 * @param {object} callbackData - KCB callback payload
 * @param {string} signature - KCB signature header
 */
function validateKcbCallback(callbackData, signature) {
  try {
    // TODO: Implement actual KCB signature validation if provided by KCB
    // This is a placeholder for security validation
    
    debugLog('Validating KCB callback signature');
    
    if (!callbackData || !callbackData.transactionReference) {
      return false;
    }

    // Basic validation - replace with actual signature verification
    return true;
  } catch (error) {
    debugLog('Error validating KCB callback:', error.message);
    return false;
  }
}

module.exports = {
  initiateKcbPayment,
  queryKcbPaymentStatus,
  validateKcbCallback,
  generateKcbToken
};