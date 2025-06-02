// server/utils/paymentUtils.js
const axios = require('axios');
// const crypto = require('crypto'); // Not typically needed for basic STK password generation

// Helper for debug logging (consistent with other controllers)
const fs = require('fs');
const path = require('path');
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOG_DIR, 'payment-utils-debug.log');

function debugLog(message, data = null) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] PAYMENT_UTILS: ${message}`;
  if (data !== null) {
    try {
      const dataStr = JSON.stringify(data);
      logMessage += ` | Data: ${dataStr}`;
    } catch (err) {
      logMessage += ` | Data: [Failed to stringify: ${err.message}]`;
    }
  }
  console.log(logMessage); // For server logs
  try {
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  } catch (err) {
    // console.error('Failed to write to debug log file:', err);
  }
}

// Function to get M-Pesa access token for LIVE environment
const getMpesaAccessToken = async () => {
  const consumerKey = process.env.MPESA_LIVE_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_LIVE_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    debugLog('M-Pesa Live API credentials (Consumer Key/Secret) are not set in environment variables.');
    throw new Error('M-Pesa API credentials missing. Please check server configuration.');
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const url = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
  // Note: For some production environments, the URL might be 'https://live.safaricom.co.ke/...'
  // ALWAYS VERIFY WITH OFFICIAL SAFARICOM DOCUMENTATION.

  debugLog('Requesting M-Pesa access token from LIVE environment.');
  try {
    const response = await axios({
      method: 'get',
      url: url,
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });
    debugLog('M-Pesa access token received successfully.');
    return response.data.access_token;
  } catch (error) {
    const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    debugLog('Error getting M-Pesa access token:', errorMsg);
    throw new Error(`Failed to get M-Pesa access token: ${errorMsg}`);
  }
};

// Initiate M-Pesa STK Push for LIVE environment
const initiateMpesaPayment = async (internalPaymentId, amount, phoneNumber, transactionDescription) => {
  debugLog(`Initiating M-Pesa STK Push for Payment ID: ${internalPaymentId}, Amount: ${amount}, Phone: ${phoneNumber}`);
  try {
    const accessToken = await getMpesaAccessToken();

    let formattedPhone = String(phoneNumber).trim();
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('+254')) {
      formattedPhone = formattedPhone.substring(1); // Keep 254...
    } else if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }
    debugLog(`Formatted M-Pesa phone number: ${formattedPhone}`);

    const shortCode = process.env.MPESA_LIVE_SHORTCODE;
    const passkey = process.env.MPESA_LIVE_PASSKEY;
    const callbackURL = process.env.MPESA_LIVE_CALLBACK_URL; // Your server's public callback URL

    if (!shortCode || !passkey || !callbackURL) {
      debugLog('M-Pesa Live STK Push configuration (ShortCode, Passkey, CallbackURL) is missing.');
      throw new Error('M-Pesa STK Push configuration incomplete. Check server environment variables.');
    }

    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const password = Buffer.from(shortCode + passkey + timestamp).toString('base64');

    const stkPushUrl = 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
    // ALWAYS VERIFY THIS URL WITH OFFICIAL SAFARICOM DOCUMENTATION.

    const requestBody = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline', // Or 'CustomerBuyGoodsOnline' - depends on your shortcode type
      Amount: Math.round(amount), // M-Pesa requires whole numbers for STK push
      PartyA: formattedPhone,
      PartyB: shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackURL,
      AccountReference: String(internalPaymentId).substring(0, 12), // Max 12 chars, ensure it's a useful reference
      TransactionDesc: String(transactionDescription).substring(0, 13), // Max 13 chars
    };

    debugLog('Sending STK Push request to LIVE API:', requestBody);

    const stkResponse = await axios({
      method: 'post',
      url: stkPushUrl,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: requestBody,
    });

    debugLog('M-Pesa STK Push Response (Live):', stkResponse.data);

    if (stkResponse.data && (stkResponse.data.ResponseCode === "0" || stkResponse.data.ResponseCode === 0)) {
      debugLog('M-Pesa STK Push initiated successfully.');
      return {
        success: true,
        reference: stkResponse.data.CheckoutRequestID,      // Crucial for tracking
        transactionId: stkResponse.data.MerchantRequestID, // Also important
        message: stkResponse.data.ResponseDescription || 'STK Push initiated. Check your phone to complete payment.',
        platformFee: 0 // Platform fee calculation is now handled in paymentController for pending record
      };
    } else {
      const errorMessage = stkResponse.data.errorMessage || stkResponse.data.ResponseDescription || 'Failed to initiate M-Pesa STK Push (unknown reason).';
      debugLog('M-Pesa STK Push initiation failed:', errorMessage, stkResponse.data);
      throw new Error(errorMessage);
    }
  } catch (error) {
    const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    debugLog('M-Pesa payment initiation error (Live):', errorMsg);
    // Construct a more user-friendly error message if possible
    let displayError = `Failed to initiate M-Pesa payment.`;
    if (error.response && error.response.data && error.response.data.errorMessage) {
        displayError += ` Reason: ${error.response.data.errorMessage}`;
    } else if (error.message) {
        displayError += ` Reason: ${error.message}`;
    }
    throw new Error(displayError);
  }
};

// Placeholder for card payment processing
const processCardPayment = async (paymentId, amount, cardDetails, description) => {
  debugLog(`Placeholder: Processing card payment for Payment ID: ${paymentId}, Amount: ${amount}`);
  // This is where you would integrate with a real card payment gateway like Stripe, PayPal, etc.
  // For now, it simulates a success.
  // const transactionId = 'card_simulated_' + Date.now();
  // return {
  //   success: true,
  //   reference: `CARD-REF-${paymentId}`,
  //   transactionId,
  //   message: 'Card payment processed successfully (simulated).',
  // };
  throw new Error("Card payments are not yet implemented.");
};

module.exports = {
  initiateMpesaPayment,
  processCardPayment, // Keep or remove based on whether you intend to implement it
};