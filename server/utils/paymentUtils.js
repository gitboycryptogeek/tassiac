// server/utils/paymentUtils.js
const axios = require('axios');
const crypto = require('crypto');

// Initiate M-Pesa payment
const initiateMpesaPayment = async (paymentId, amount, phoneNumber, description) => {
  try {
    // Format the phone number (remove leading 0 or +254 and add 254)
    let formattedPhone = phoneNumber;
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('+254')) {
      formattedPhone = formattedPhone.substring(1);
    }

    // Generate timestamp
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    
    // Generate password
    const shortCode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const password = Buffer.from(shortCode + passkey + timestamp).toString('base64');
    
    // Get access token
    const auth = Buffer.from(
      process.env.MPESA_CONSUMER_KEY + ':' + process.env.MPESA_CONSUMER_SECRET
    ).toString('base64');
    
    const tokenResponse = await axios({
      method: 'get',
      url: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });
    
    const accessToken = tokenResponse.data.access_token;
    
    // Initiate STK Push
    const stkResponse = await axios({
      method: 'post',
      url: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount), // M-Pesa requires whole numbers
        PartyA: formattedPhone,
        PartyB: shortCode,
        PhoneNumber: formattedPhone,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: `TASSIAC-${paymentId}`,
        TransactionDesc: description.substring(0, 20) // Max 20 chars
      }
    });
    
    return {
      success: true,
      reference: stkResponse.data.CheckoutRequestID,
      transactionId: stkResponse.data.MerchantRequestID,
      message: 'M-Pesa payment initiated successfully'
    };
  } catch (error) {
    console.error('M-Pesa payment error:', error.response?.data || error.message);
    throw new Error('Failed to initiate M-Pesa payment: ' + (error.response?.data?.errorMessage || error.message));
  }
};

// Process card payment using Stripe
const processCardPayment = async (paymentId, amount, cardDetails, description) => {
  try {
    // This is a placeholder for actual Stripe integration
    // You'll need to add Stripe SDK and implement actual card processing

    // In production, you would use Stripe's API to create a payment intent
    // and handle the card processing securely

    // For development, we'll just simulate a successful payment
    const transactionId = 'card_' + crypto.randomBytes(8).toString('hex');
    
    return {
      success: true,
      reference: `TASSIAC-${paymentId}`,
      transactionId,
      message: 'Card payment processed successfully'
    };
  } catch (error) {
    console.error('Card payment error:', error);
    throw new Error('Failed to process card payment: ' + error.message);
  }
};

module.exports = {
  initiateMpesaPayment,
  processCardPayment
};