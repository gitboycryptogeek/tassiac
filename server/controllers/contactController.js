// server/controllers/contactController.js
const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
// const { sendEmailNotification } = require('../utils/notificationUtils.js'); // Keep if you still want email notifications

const prisma = new PrismaClient();

// Setup debug log file
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOG_DIR, 'contact-controller-debug.log');

function debugLog(message, data = null) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] CONTACT_CTRL: ${message}`;
  if (data !== null) {
    try {
      const dataStr = JSON.stringify(data);
      logMessage += ` | Data: ${dataStr}`;
    } catch (err) {
      logMessage += ` | Data: [Failed to stringify: ${err.message}]`;
    }
  }
  console.log(logMessage);
  
  return logMessage;
}

// Helper for sending standardized responses
const sendResponse = (res, statusCode, success, data, message, errorDetails = null) => {
  const responsePayload = { success, message };
  if (data !== null && data !== undefined) {
    responsePayload.data = data;
  }
  if (errorDetails) {
    responsePayload.error = errorDetails;
  }
  return res.status(statusCode).json(responsePayload);
};

// Helper to check for view-only admin (ADAPT THIS LOGIC)
const isViewOnlyAdmin = (user) => {
  if (!user || !user.isAdmin) return false;
  const viewOnlyUsernames = ['admin3', 'admin4', 'admin5']; // Example
  return viewOnlyUsernames.includes(user.username);
};

// Log Admin Activity (or general system activity)
async function logActivity(actionType, targetId, initiatedBy, actionData = {}) {
  // If you have AdminAction model and want to log this there:
  try {
    await prisma.adminAction.create({ // Or a more generic ActivityLog model
      data: {
        actionType,
        targetId: String(targetId),
        initiatedBy: initiatedBy || null, // Can be null if public submission
        actionData,
        status: 'LOGGED', // Different status for general logs vs admin actions needing approval
      },
    });
    debugLog(`Activity logged: ${actionType} for target ${targetId}`);
  } catch (error) {
    debugLog(`Error logging activity for ${actionType} on ${targetId}:`, error.message);
  }
}

// Submit contact form - now saves to database
exports.submitContactForm = async (req, res) => {
  debugLog('Submit Contact Form attempt started');
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debugLog('Validation errors:', errors.array());
      return sendResponse(res, 400, false, null, 'Validation failed.', {
        code: 'VALIDATION_ERROR',
        details: errors.array().map(err => ({ field: err.path, message: err.msg })),
      });
    }

    const { name, email, phone, subject, message } = req.body;
    const userId = req.user ? req.user.id : null; // If user is logged in

    const inquiryData = {
      name,
      email,
      phone: phone || null,
      subject,
      message,
      userId, // Link to user if logged in
      status: 'PENDING', // Default status
    };

    const newInquiry = await prisma.contactInquiry.create({
      data: inquiryData,
    });

    debugLog('Contact inquiry saved to database:', newInquiry.id);
    await logActivity('CONTACT_FORM_SUBMISSION', newInquiry.id, userId, { subject });


    // Optional: Still send an email notification to admins
    // const adminEmail = process.env.ADMIN_EMAIL || 'admin@tassiac.church';
    // const emailSubject = `New Contact Inquiry: ${subject}`;
    // const emailMessage = `New inquiry from ${name} (${email}):\n\n${message}`;
    // try {
    //   await sendEmailNotification(adminEmail, emailSubject, emailMessage);
    //   debugLog('Admin email notification sent for new inquiry.');
    // } catch (emailError) {
    //   debugLog('Failed to send admin email notification for inquiry:', emailError.message);
    //   // Don't fail the whole request if email fails, inquiry is saved.
    // }

    return sendResponse(res, 201, true, { inquiryId: newInquiry.id }, 'Your message has been received. We will get back to you shortly.');

  } catch (error) {
    debugLog('Error submitting contact form:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Failed to send your message. Please try again later.', {
      code: 'SERVER_ERROR',
      details: error.message,
    });
  }
};

// Get contact information (static, or could be fetched from a settings table)
exports.getContactInfo = async (req, res) => {
  debugLog('Get Contact Info attempt started');
  try {
    // This data can be hardcoded or fetched from a 'Settings' table in your DB
    const contactInfo = {
      email: process.env.CHURCH_CONTACT_EMAIL || 'info@tassiac.church',
      phone: process.env.CHURCH_CONTACT_PHONE || '+254 123 456 789',
      address: process.env.CHURCH_ADDRESS || '123 Church Street, Nairobi, Kenya',
      socialMedia: {
        facebook: process.env.CHURCH_FACEBOOK_URL || 'https://facebook.com/tassiacchurch',
        twitter: process.env.CHURCH_TWITTER_URL || 'https://twitter.com/tassiacchurch',
        // Add more social links as needed
      },
      serviceHours: 'Sunday: 9:00 AM - 12:00 PM | Wednesday: 7:00 PM - 8:00 PM',
    };
    return sendResponse(res, 200, true, contactInfo, 'Contact information retrieved.');
  } catch (error) {
    debugLog('Error getting contact info:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Failed to retrieve contact information.', { code: 'SERVER_ERROR', details: error.message });
  }
};


// --- Admin-specific functions for managing inquiries ---

// Get all contact inquiries (Admin only)
exports.getAllInquiries = async (req, res) => {
  debugLog('Admin: Get All Inquiries attempt started');
  try {
    const { page = 1, limit = 15, status, search } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const whereConditions = {};
    if (status && status !== 'ALL') {
      whereConditions.status = status;
    }
    if (search) {
      whereConditions.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }

    const inquiries = await prisma.contactInquiry.findMany({
      where: whereConditions,
      include: {
        user: { select: { id: true, username: true, fullName: true } } // Include user if linked
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const totalInquiries = await prisma.contactInquiry.count({ where: whereConditions });

    debugLog(`Admin: Retrieved ${inquiries.length} of ${totalInquiries} inquiries.`);
    return sendResponse(res, 200, true, {
      inquiries,
      totalPages: Math.ceil(totalInquiries / take),
      currentPage: parseInt(page),
      totalInquiries,
    }, 'Inquiries retrieved successfully.');

  } catch (error) {
    debugLog('Admin: Error getting all inquiries:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error fetching inquiries.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Get a single contact inquiry by ID (Admin only)
exports.getInquiryById = async (req, res) => {
  const { inquiryId } = req.params;
  debugLog(`Admin: Get Inquiry By ID attempt: ${inquiryId}`);
  try {
    const numericInquiryId = parseInt(inquiryId);
    if (isNaN(numericInquiryId)) {
      return sendResponse(res, 400, false, null, 'Invalid Inquiry ID format.', { code: 'INVALID_INQUIRY_ID' });
    }

    const inquiry = await prisma.contactInquiry.findUnique({
      where: { id: numericInquiryId },
      include: { user: { select: { id: true, username: true, fullName: true } } }
    });

    if (!inquiry) {
      return sendResponse(res, 404, false, null, 'Inquiry not found.', { code: 'INQUIRY_NOT_FOUND' });
    }

    // If inquiry status is PENDING, admin viewing it might change status to VIEWED
    if (inquiry.status === 'PENDING') {
        await prisma.contactInquiry.update({
            where: { id: numericInquiryId },
            data: { status: 'VIEWED' }
        });
        inquiry.status = 'VIEWED'; // Reflect change in returned object
        debugLog(`Admin: Inquiry ${numericInquiryId} status updated to VIEWED.`);
         await logAdminActivity('ADMIN_VIEW_INQUIRY', numericInquiryId, req.user.id, { subject: inquiry.subject });
    }


    return sendResponse(res, 200, true, { inquiry }, 'Inquiry retrieved successfully.');
  } catch (error) {
    debugLog('Admin: Error getting inquiry by ID:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error fetching inquiry.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Update inquiry status (Admin only)
exports.updateInquiryStatus = async (req, res) => {
  const { inquiryId } = req.params;
  const { status } = req.body;
  debugLog(`Admin: Update Inquiry Status attempt: ${inquiryId} to ${status}`);

  try {
    if (isViewOnlyAdmin(req.user)) {
      debugLog(`View-only admin ${req.user.username} (ID: ${req.user.id}) attempted to update inquiry status.`);
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot update inquiry statuses.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const numericInquiryId = parseInt(inquiryId);
    if (isNaN(numericInquiryId)) {
      return sendResponse(res, 400, false, null, 'Invalid Inquiry ID format.', { code: 'INVALID_INQUIRY_ID' });
    }

    const validStatuses = ['PENDING', 'VIEWED', 'RESOLVED', 'ARCHIVED', 'SPAM']; // Added SPAM
    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return sendResponse(res, 400, false, null, `Invalid status. Must be one of: ${validStatuses.join(', ')}.`, { code: 'INVALID_STATUS' });
    }

    const inquiry = await prisma.contactInquiry.findUnique({ where: { id: numericInquiryId } });
    if (!inquiry) {
      return sendResponse(res, 404, false, null, 'Inquiry not found.', { code: 'INQUIRY_NOT_FOUND' });
    }

    const updatedInquiry = await prisma.contactInquiry.update({
      where: { id: numericInquiryId },
      data: { status: status.toUpperCase() },
    });

    await logAdminActivity('ADMIN_UPDATE_INQUIRY_STATUS', numericInquiryId, req.user.id, { oldStatus: inquiry.status, newStatus: updatedInquiry.status });
    debugLog(`Admin: Inquiry ${numericInquiryId} status updated to ${status.toUpperCase()} by admin ${req.user.username}`);
    return sendResponse(res, 200, true, { inquiry: updatedInquiry }, 'Inquiry status updated successfully.');

  } catch (error) {
    debugLog('Admin: Error updating inquiry status:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error updating inquiry status.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Delete an inquiry (Admin only - perhaps soft delete or archive)
exports.deleteInquiry = async (req, res) => {
    const { inquiryId } = req.params;
    debugLog(`Admin: Delete Inquiry attempt: ${inquiryId}`);

    try {
        if (isViewOnlyAdmin(req.user)) {
            debugLog(`View-only admin ${req.user.username} (ID: ${req.user.id}) attempted to delete inquiry.`);
            return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot delete inquiries.", { code: 'FORBIDDEN_VIEW_ONLY' });
        }

        const numericInquiryId = parseInt(inquiryId);
        if (isNaN(numericInquiryId)) {
            return sendResponse(res, 400, false, null, 'Invalid Inquiry ID format.', { code: 'INVALID_INQUIRY_ID' });
        }

        const inquiry = await prisma.contactInquiry.findUnique({ where: { id: numericInquiryId } });
        if (!inquiry) {
            return sendResponse(res, 404, false, null, 'Inquiry not found.', { code: 'INQUIRY_NOT_FOUND' });
        }

        // Instead of deleting, you might want to change status to 'ARCHIVED' or 'DELETED'
        // For a hard delete:
        // await prisma.contactInquiry.delete({ where: { id: numericInquiryId } });
        // For a soft delete (by changing status):
        const archivedInquiry = await prisma.contactInquiry.update({
            where: {id: numericInquiryId},
            data: { status: 'ARCHIVED'} // Assuming ARCHIVED is a valid status
        });


        await logAdminActivity('ADMIN_ARCHIVE_INQUIRY', numericInquiryId, req.user.id, { subject: inquiry.subject });
        debugLog(`Admin: Inquiry ${numericInquiryId} archived by admin ${req.user.username}`);
        return sendResponse(res, 200, true, { inquiryId: numericInquiryId, status: 'archived' }, 'Inquiry archived successfully.');

    } catch (error) {
        debugLog('Admin: Error deleting/archiving inquiry:', error.message);
        console.error(error);
        return sendResponse(res, 500, false, null, 'Server error processing inquiry deletion/archival.', { code: 'SERVER_ERROR', details: error.message });
    }
};


module.exports = exports;