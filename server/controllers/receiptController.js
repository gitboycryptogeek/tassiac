// server/controllers/receiptController.js
const { PrismaClient, Prisma } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit'); // For PDF generation
const { validationResult } = require('express-validator'); // If you add validation in routes

const prisma = new PrismaClient();

// Setup debug log file
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOG_DIR, 'receipt-controller-debug.log');

function debugLog(message, data = null) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] RECEIPT_CTRL: ${message}`;
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

// Log Admin Activity
async function logAdminActivity(actionType, targetId, initiatedBy, actionData = {}) {
  try {
    await prisma.adminAction.create({
      data: {
        actionType,
        targetId: String(targetId),
        initiatedBy,
        actionData,
        status: 'COMPLETED',
      },
    });
    debugLog(`Admin activity logged: ${actionType} for target ${targetId} by user ${initiatedBy}`);
  } catch (error) {
    debugLog(`Error logging admin activity for ${actionType} on ${targetId}:`, error.message);
  }
}

// Helper to format date (consider moving to a shared util if used elsewhere)
const formatDateForPdf = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return dateString.toString();
  }
};

// Get all receipts (admin only)
exports.getAllReceipts = async (req, res) => {
  debugLog('Admin: Get All Receipts attempt started');
  try {
    const { page = 1, limit = 20, startDate, endDate, userId, search } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const whereConditions = {};
    if (startDate) whereConditions.receiptDate = { ...whereConditions.receiptDate, gte: new Date(startDate) };
    if (endDate) whereConditions.receiptDate = { ...whereConditions.receiptDate, lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) };
    if (userId) whereConditions.userId = parseInt(userId);

    if (search) {
      whereConditions.OR = [
        { receiptNumber: { contains: search, mode: 'insensitive' } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
        { payment: { description: { contains: search, mode: 'insensitive' } } }
      ];
       const searchAmount = parseFloat(search);
        if (!isNaN(searchAmount)) {
            whereConditions.OR.push({ payment: { amount: searchAmount } });
        }
    }

    const receipts = await prisma.receipt.findMany({
      where: whereConditions,
      include: {
        user: { select: { id: true, username: true, fullName: true, phone: true } },
        payment: { select: { id: true, amount: true, paymentType: true, paymentMethod: true, description: true, status: true, isExpense: true } },
        generator: { select: { id: true, username: true, fullName: true } }, // Admin who generated it
      },
      orderBy: { receiptDate: 'desc' },
      skip,
      take,
    });

    const totalReceipts = await prisma.receipt.count({ where: whereConditions });

    debugLog(`Admin: Retrieved ${receipts.length} of ${totalReceipts} receipts.`);
    return sendResponse(res, 200, true, {
      receipts,
      totalPages: Math.ceil(totalReceipts / take),
      currentPage: parseInt(page),
      totalReceipts,
    }, 'Receipts retrieved successfully.');

  } catch (error) {
    debugLog('Admin: Error getting all receipts:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error fetching receipts.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Get receipts for a specific user (or the logged-in user)
exports.getUserReceipts = async (req, res) => {
  debugLog('Get User Receipts attempt started');
  try {
    const requestingUserId = req.user.id;
    const targetUserIdParam = req.params.userId;
    const userIdToFetch = targetUserIdParam ? parseInt(targetUserIdParam) : requestingUserId;

    if (!req.user.isAdmin && requestingUserId !== userIdToFetch) {
      debugLog(`Forbidden: User ${requestingUserId} trying to access receipts for ${userIdToFetch}`);
      return sendResponse(res, 403, false, null, 'Forbidden. You can only access your own receipts.', { code: 'FORBIDDEN' });
    }

    const { page = 1, limit = 10, startDate, endDate, search } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const whereConditions = { userId: userIdToFetch };
    if (startDate) whereConditions.receiptDate = { ...whereConditions.receiptDate, gte: new Date(startDate) };
    if (endDate) whereConditions.receiptDate = { ...whereConditions.receiptDate, lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) };
    
    if (search) {
      whereConditions.OR = [
        { receiptNumber: { contains: search, mode: 'insensitive' } },
        { payment: { description: { contains: search, mode: 'insensitive' } } },
      ];
      const searchAmount = parseFloat(search);
        if (!isNaN(searchAmount)) {
            whereConditions.OR.push({ payment: { amount: searchAmount } });
        }
    }


    const receipts = await prisma.receipt.findMany({
      where: whereConditions,
      include: {
        payment: { select: { id: true, amount: true, paymentType: true, paymentMethod: true, description: true, status: true, paymentDate: true } },
      },
      orderBy: { receiptDate: 'desc' },
      skip,
      take,
    });

    const totalReceipts = await prisma.receipt.count({ where: whereConditions });

    debugLog(`Retrieved ${receipts.length} receipts for user ${userIdToFetch}.`);
    return sendResponse(res, 200, true, {
      receipts,
      totalPages: Math.ceil(totalReceipts / take),
      currentPage: parseInt(page),
      totalReceipts,
    }, 'User receipts retrieved successfully.');

  } catch (error) {
    debugLog('Error getting user receipts:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error fetching user receipts.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Get receipt by ID
exports.getReceiptById = async (req, res) => {
  debugLog('Get Receipt By ID attempt started');
  try {
    const { receiptId } = req.params;
    const numericReceiptId = parseInt(receiptId);

    if (isNaN(numericReceiptId)) {
      return sendResponse(res, 400, false, null, 'Invalid Receipt ID format.', { code: 'INVALID_RECEIPT_ID' });
    }

    const receipt = await prisma.receipt.findUnique({
      where: { id: numericReceiptId },
      include: {
        user: { select: { id: true, username: true, fullName: true, phone: true, email: true } },
        payment: {
          select: {
            id: true, amount: true, paymentType: true, paymentMethod: true,
            description: true, status: true, paymentDate: true, isExpense: true,
            titheDistributionSDA: true, // Include SDA tithe distribution
            specialOffering: { select: { name: true, offeringCode: true } } // If it's for a special offering
          }
        },
        generator: { select: { id: true, username: true, fullName: true } },
      },
    });

    if (!receipt) {
      debugLog(`Receipt not found: ID ${numericReceiptId}`);
      return sendResponse(res, 404, false, null, 'Receipt not found.', { code: 'RECEIPT_NOT_FOUND' });
    }

    if (!req.user.isAdmin && receipt.userId !== req.user.id) {
      debugLog(`Forbidden: User ${req.user.id} trying to access receipt ${numericReceiptId} for user ${receipt.userId}`);
      return sendResponse(res, 403, false, null, 'Forbidden. You are not authorized to view this receipt.', { code: 'FORBIDDEN' });
    }

    debugLog(`Receipt ${numericReceiptId} retrieved successfully.`);
    return sendResponse(res, 200, true, { receipt }, 'Receipt retrieved successfully.');

  } catch (error) {
    debugLog('Error getting receipt by ID:', error.message);
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error retrieving receipt.', { code: 'SERVER_ERROR', details: error.message });
  }
};

// Generate PDF receipt
exports.generatePdfReceipt = async (req, res) => {
  const { receiptId } = req.params;
  debugLog(`Generate PDF Receipt attempt for ID: ${receiptId}`);
  try {
    const numericReceiptId = parseInt(receiptId);
    if (isNaN(numericReceiptId)) {
      return sendResponse(res, 400, false, null, 'Invalid Receipt ID format.', { code: 'INVALID_RECEIPT_ID' });
    }

    const receipt = await prisma.receipt.findUnique({
      where: { id: numericReceiptId },
      include: {
        user: { select: { fullName: true, phone: true, email: true } },
        payment: {
          select: {
            amount: true, paymentType: true, paymentMethod: true,
            description: true, paymentDate: true, isExpense: true,
            titheDistributionSDA: true,
            specialOffering: { select: { name: true, offeringCode: true } }
          }
        },
      },
    });

    if (!receipt) {
      debugLog(`Receipt not found for PDF generation: ID ${numericReceiptId}`);
      return sendResponse(res, 404, false, null, 'Receipt not found.', { code: 'RECEIPT_NOT_FOUND' });
    }

    if (!req.user.isAdmin && receipt.userId !== req.user.id) {
      debugLog(`Forbidden PDF generation: User ${req.user.id} for receipt ${numericReceiptId}`);
      return sendResponse(res, 403, false, null, 'Forbidden to generate this receipt.', { code: 'FORBIDDEN' });
    }

    const receiptDir = path.join(__dirname, '..', 'public', 'receipts');
    if (!fs.existsSync(receiptDir)) {
      fs.mkdirSync(receiptDir, { recursive: true });
    }

    const filename = `receipt_${receipt.receiptNumber.replace(/\//g, '-')}_${Date.now()}.pdf`;
    const filepath = path.join(receiptDir, filename);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const writeStream = fs.createWriteStream(filepath);
    doc.pipe(writeStream);

    // --- PDF Content ---
    doc.fontSize(20).font('Helvetica-Bold').text('TASSIA CENTRAL SDA CHURCH', { align: 'center' });
    doc.fontSize(10).text('P.O. Box 12345 - 00100, Nairobi, Kenya', { align: 'center' });
    doc.text('Phone: +254 7XX XXX XXX | Email: info@tassiacsda.org', { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(16).font('Helvetica-Bold').text('OFFICIAL RECEIPT', { align: 'center' });
    doc.moveDown(1);

    // Receipt Info Table
    const receiptInfoTop = doc.y;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Receipt No:', 40, receiptInfoTop);
    doc.text('Date Issued:', 40, receiptInfoTop + 15 );
    doc.font('Helvetica');
    doc.text(receipt.receiptNumber || 'N/A', 120, receiptInfoTop);
    doc.text(formatDateForPdf(receipt.receiptDate), 120, receiptInfoTop + 15);

    doc.font('Helvetica-Bold');
    doc.text('Payment Date:', 300, receiptInfoTop);
    doc.text('Payment ID:', 300, receiptInfoTop + 15);
    doc.font('Helvetica');
    doc.text(formatDateForPdf(receipt.payment.paymentDate), 380, receiptInfoTop);
    doc.text(String(receipt.paymentId), 380, receiptInfoTop + 15);
    doc.moveDown(2);

    // Member Details
    doc.font('Helvetica-Bold').fontSize(11).text('RECEIVED FROM:');
    doc.font('Helvetica').fontSize(10);
    doc.text(receipt.user.fullName || 'N/A');
    if (receipt.user.phone) doc.text(`Phone: ${receipt.user.phone}`);
    if (receipt.user.email) doc.text(`Email: ${receipt.user.email}`);
    doc.moveDown(1.5);

    // Payment Particulars
    doc.font('Helvetica-Bold').fontSize(11).text('PARTICULARS:');
    doc.font('Helvetica').fontSize(10);
    const paymentAmount = receipt.payment.amount ? parseFloat(receipt.payment.amount.toString()) : 0;

    let paymentTypeDisplay = receipt.payment.paymentType;
    if (paymentTypeDisplay === 'SPECIAL_OFFERING_CONTRIBUTION' && receipt.payment.specialOffering) {
        paymentTypeDisplay = `Special Offering: ${receipt.payment.specialOffering.name} (${receipt.payment.specialOffering.offeringCode})`;
    } else if (paymentTypeDisplay === 'TITHE') {
        paymentTypeDisplay = 'Tithe';
    }


    const particulars = [
      { label: 'Payment Type', value: paymentTypeDisplay },
      { label: 'Payment Method', value: receipt.payment.paymentMethod || 'N/A' },
      { label: 'Description', value: receipt.payment.description || 'N/A' },
      { label: 'Amount', value: `KES ${paymentAmount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    ];

    const tableTop = doc.y;
    const itemX = 40;
    const amountX = 450; // For right-aligning amount

    particulars.forEach(item => {
        doc.font('Helvetica').text(item.label, itemX, doc.y, { width: 380, continued: item.label !== 'Amount' });
        if (item.label === 'Amount') {
             doc.font('Helvetica-Bold').text(item.value, amountX, doc.y - 10, {width: 100, align: 'right'}); // y -10 because it was already moved down
        } else {
            doc.font('Helvetica').text(item.value);
        }
        doc.moveDown(0.3);
    });
    doc.moveDown(0.5);

    // Tithe Distribution (if applicable)
    if (receipt.payment.paymentType === 'TITHE' && receipt.payment.titheDistributionSDA) {
      doc.font('Helvetica-Bold').fontSize(11).text('TITHE DISTRIBUTION DETAILS:');
      doc.moveDown(0.5);
      const sdaTithe = receipt.payment.titheDistributionSDA;
      const sdaCategories = [
        { key: 'campMeetingExpenses', label: 'Camp Meeting Expenses' },
        { key: 'welfare', label: 'Welfare' },
        { key: 'thanksgiving', label: 'Thanksgiving' },
        { key: 'stationFund', label: 'Station Fund' },
        { key: 'mediaMinistry', label: 'Media Ministry' },
      ];
      sdaCategories.forEach(cat => {
        const amount = sdaTithe[cat.key] ? parseFloat(sdaTithe[cat.key].toString()) : 0;
        if (amount > 0) {
          doc.font('Helvetica').fontSize(10).text(cat.label, itemX + 10, doc.y, {width: 370, continued: true});
          doc.font('Helvetica').fontSize(10).text(`KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, amountX, doc.y, {width:100, align: 'right'});
          doc.moveDown(0.3);
        }
      });
      doc.moveDown(0.5);
    }
    
    // Line for total
    const totalY = doc.y + 5;
    doc.strokeColor('#aaaaaa').lineWidth(0.5).moveTo(40, totalY).lineTo(555, totalY).stroke();
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('TOTAL AMOUNT RECEIVED:', itemX, doc.y);
    doc.text(`KES ${paymentAmount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, amountX, doc.y, {width: 100, align: 'right'});
    doc.moveDown(2);


    doc.fontSize(9).fillColor('#555555')
       .text('This is a computer-generated receipt and does not require a physical signature if sent electronically.', 40, doc.y, {align: 'center'});
    doc.text('Thank you for your faithful stewardship!', { align: 'center' });
    doc.moveDown(2);

    // Footer with church details again or a stamp area
    const pageHeight = doc.page.height;
    doc.fontSize(8).fillColor('#333333')
       .text(`Tassia Central SDA Church | Generated: ${formatDateForPdf(new Date())}`, 40, pageHeight - 50, { align: 'left', lineBreak: false });
    doc.text(`Receipt System v1.0`, pageHeight - 40, pageHeight - 50, { align: 'right' });


    // --- End PDF Content ---
    doc.end();

    writeStream.on('finish', async () => {
      debugLog(`PDF generated successfully: ${filename}`);
      await prisma.receipt.update({
        where: { id: numericReceiptId },
        data: { pdfPath: `/receipts/${filename}` }, // Relative path for serving
      });
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        const readStream = fs.createReadStream(filepath);
        readStream.pipe(res);

        // Optional: Delete file after sending if not needed on server long-term
        // readStream.on('end', () => fs.unlinkSync(filepath));
        // readStream.on('error', (err) => {
        //   debugLog('Error streaming PDF to response:', err.message);
        //   if (!res.headersSent) res.status(500).send('Error sending PDF');
        // });
      }
    });
    writeStream.on('error', (err) => {
      debugLog('Error writing PDF to stream:', err.message);
      if (!res.headersSent){
        return sendResponse(res, 500, false, null, 'Failed to generate PDF.', { code: 'PDF_GENERATION_ERROR', details: err.message });
      }
    });

  } catch (error) {
    debugLog('Error generating PDF receipt:', error.message);
    console.error(error);
    if (!res.headersSent) {
        return sendResponse(res, 500, false, null, 'Server error generating PDF receipt.', { code: 'SERVER_ERROR', details: error.message });
    }
  }
};

// Upload receipt attachment (Admin action for manual payments/expenses)
// This assumes multer is configured on the route for 'attachment' field
exports.uploadReceiptAttachment = async (req, res) => {
  debugLog('Upload Receipt Attachment attempt started');
  try {
    if (isViewOnlyAdmin(req.user)) {
      debugLog(`View-only admin ${req.user.username} attempted to upload attachment.`);
      if (req.file && req.file.path) fs.unlinkSync(req.file.path); // Clean up uploaded file
      return sendResponse(res, 403, false, null, "Forbidden: View-only admins cannot upload attachments.", { code: 'FORBIDDEN_VIEW_ONLY' });
    }

    const { receiptId } = req.params;
    const numericReceiptId = parseInt(receiptId);

    if (isNaN(numericReceiptId)) {
      if (req.file && req.file.path) fs.unlinkSync(req.file.path);
      return sendResponse(res, 400, false, null, 'Invalid Receipt ID format.', { code: 'INVALID_RECEIPT_ID' });
    }

    if (!req.file) {
      return sendResponse(res, 400, false, null, 'No file uploaded.', { code: 'NO_FILE_UPLOADED' });
    }

    const receipt = await prisma.receipt.findUnique({ where: { id: numericReceiptId } });
    if (!receipt) {
      if (req.file && req.file.path) fs.unlinkSync(req.file.path);
      return sendResponse(res, 404, false, null, 'Receipt not found.', { code: 'RECEIPT_NOT_FOUND' });
    }

    // Construct relative path for storing in DB
    const attachmentPath = `/uploads/receipts/${req.file.filename}`;

    await prisma.receipt.update({
      where: { id: numericReceiptId },
      data: {
        attachmentPath: attachmentPath,
        // attachmentType: req.file.mimetype, // You might want to add this field to your Prisma schema
      },
    });
    
    await logAdminActivity('UPLOAD_RECEIPT_ATTACHMENT', numericReceiptId, req.user.id, { filename: req.file.filename });
    debugLog(`Attachment uploaded for receipt ${numericReceiptId}: ${attachmentPath}`);
    return sendResponse(res, 200, true, { attachmentPath }, 'Attachment uploaded successfully.');

  } catch (error) {
    debugLog('Error uploading receipt attachment:', error.message);
    if (req.file && req.file.path) { // Clean up temp file on error
        try { fs.unlinkSync(req.file.path); } catch (e) { debugLog("Error cleaning up temp file", e.message);}
    }
    console.error(error);
    return sendResponse(res, 500, false, null, 'Server error uploading attachment.', { code: 'SERVER_ERROR', details: error.message });
  }
};


module.exports = exports;