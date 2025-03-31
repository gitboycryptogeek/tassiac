// server/controllers/contactController.js
const { validationResult } = require('express-validator');
const { sendEmailNotification } = require('../utils/notificationUtils');

// Submit contact form
exports.submitContactForm = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { name, email, phone, subject, message } = req.body;
    
    // Send notification to admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@tassiac.church';
    
    const emailSubject = `New Contact Form: ${subject}`;
    const emailMessage = `
      New contact form submission:
      
      Name: ${name}
      Email: ${email}
      Phone: ${phone || 'Not provided'}
      Subject: ${subject}
      
      Message:
      ${message}
    `;
    
    await sendEmailNotification(adminEmail, emailSubject, emailMessage);
    
    res.json({
      success: true,
      message: 'Your message has been sent. We will contact you shortly.'
    });
  } catch (error) {
    console.error('Contact form submission error:', error);
    res.status(500).json({ 
      message: 'Failed to send your message. Please try again later.',
      // Only send error details in development
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};

// Get contact information
exports.getContactInfo = async (req, res) => {
  try {
    // Return church contact information
    res.json({
      email: 'info@tassiac.church',
      phone: '+254 123 456 789',
      address: '123 Church Street, Nairobi, Kenya',
      socialMedia: {
        facebook: 'https://facebook.com/tassiacchurch',
        twitter: 'https://twitter.com/tassiacchurch',
        instagram: 'https://instagram.com/tassiacchurch'
      },
      serviceHours: 'Sunday: 9:00 AM - 12:00 PM'
    });
  } catch (error) {
    console.error('Get contact info error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve contact information',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};

module.exports = exports;