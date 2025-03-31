// server/utils/notificationUtils.js
const AfricasTalking = require('africastalking');

// Initialize Africa's Talking
const initializeAfricasTalking = () => {
  const credentials = {
    apiKey: process.env.AFRICASTALKING_API_KEY,
    username: process.env.AFRICASTALKING_USERNAME
  };
  
  return AfricasTalking(credentials);
};

// Send SMS notification
const sendSmsNotification = async (phoneNumber, message) => {
  try {
    // Initialize the SDK
    const africasTalking = initializeAfricasTalking();
    
    // Get the SMS service
    const sms = africasTalking.SMS;
    
    // Format the phone number (add + if not present)
    let formattedPhone = phoneNumber;
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+254' + formattedPhone.substring(1);
      } else if (!formattedPhone.startsWith('254')) {
        formattedPhone = '+' + formattedPhone;
      } else {
        formattedPhone = '+' + formattedPhone;
      }
    }
    
    // Send the message
    const response = await sms.send({
      to: formattedPhone,
      message,
      from: process.env.AFRICASTALKING_SENDER_ID || 'TASSIAC'
    });
    
    console.log('SMS notification sent:', response);
    return response;
  } catch (error) {
    console.error('SMS notification error:', error);
    throw new Error('Failed to send SMS notification: ' + error.message);
  }
};

// Send email notification (placeholder for future implementation)
const sendEmailNotification = async (email, subject, message) => {
  try {
    // This is a placeholder for actual email sending
    // You'll need to implement email sending using a service like Nodemailer
    console.log(`Email notification would be sent to ${email} with subject "${subject}"`);
    
    return {
      success: true,
      message: 'Email notification sent successfully (simulated)'
    };
  } catch (error) {
    console.error('Email notification error:', error);
    throw new Error('Failed to send email notification: ' + error.message);
  }
};

module.exports = {
  sendSmsNotification,
  sendEmailNotification
};