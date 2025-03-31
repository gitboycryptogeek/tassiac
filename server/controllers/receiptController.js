// server/controllers/receiptController.js
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { models } = require('../models');

const Receipt = models.Receipt;
const Payment = models.Payment;
const User = models.User;


const multer = require('multer');


// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'receipts');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'receipt-' + uniqueSuffix + ext);
  }
});

// Filter for file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  }
});

// Get all receipts (admin only)
const getAllReceipts = async (req, res) => {
  try {
    const { page = 1, limit = 20, startDate, endDate, userId } = req.query;
    const offset = (page - 1) * limit;
    
    // Build filter conditions
    const whereConditions = {};
    
    if (startDate && endDate) {
      whereConditions.receiptDate = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }
    
    if (userId) {
      whereConditions.userId = userId;
    }
    
    // Get receipts with pagination
    const receipts = await Receipt.findAndCountAll({
      where: whereConditions,
      include: [
        { 
          model: User,
          attributes: ['id', 'username', 'fullName', 'phone'] 
        },
        {
          model: Payment,
          attributes: ['id', 'amount', 'paymentType', 'paymentMethod', 'description', 'status', 'isExpense']
        },
        {
          model: User,
          as: 'Generator',
          attributes: ['id', 'username', 'fullName'],
          required: false
        }
      ],
      order: [['receiptDate', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      total: receipts.count,
      totalPages: Math.ceil(receipts.count / limit),
      currentPage: parseInt(page),
      receipts: receipts.rows
    });
  } catch (error) {
    console.error('Get all receipts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user receipts
const getUserReceipts = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    const { page = 1, limit = 10, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;
    
    // Build filter conditions
    const whereConditions = { userId };
    
    if (startDate && endDate) {
      whereConditions.receiptDate = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }
    
    // Get user's receipts with pagination
    const receipts = await Receipt.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: Payment,
          attributes: ['id', 'amount', 'paymentType', 'paymentMethod', 'description', 'status']
        }
      ],
      order: [['receiptDate', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      total: receipts.count,
      totalPages: Math.ceil(receipts.count / limit),
      currentPage: parseInt(page),
      receipts: receipts.rows
    });
  } catch (error) {
    console.error('Get user receipts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get receipt by ID
const getReceiptById = async (req, res) => {
  try {
    const { receiptId } = req.params;
    
    const receipt = await Receipt.findByPk(receiptId, {
      include: [
        { 
          model: User,
          attributes: ['id', 'username', 'fullName', 'phone', 'email'] 
        },
        {
          model: Payment,
          attributes: ['id', 'amount', 'paymentType', 'paymentMethod', 'description', 'status', 'paymentDate', 'isExpense']
        }
      ]
    });
    
    if (!receipt) {
      return res.status(404).json({ message: 'Receipt not found' });
    }
    
    // Check if the user is authorized to view this receipt
    if (!req.user.isAdmin && receipt.userId !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to view this receipt' });
    }
    
    res.json({ receipt });
  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Generate PDF receipt
const generatePdfReceipt = async (req, res) => {
  try {
    const { receiptId } = req.params;
    
    const receipt = await Receipt.findByPk(receiptId, {
      include: [
        { 
          model: User,
          attributes: ['id', 'fullName', 'phone', 'email'] 
        },
        {
          model: Payment,
          attributes: ['id', 'amount', 'paymentType', 'paymentMethod', 'description', 'paymentDate']
        }
      ]
    });
    
    if (!receipt) {
      return res.status(404).json({ message: 'Receipt not found' });
    }
    
    // Check if the user is authorized to download this receipt
    if (!req.user.isAdmin && receipt.userId !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to download this receipt' });
    }
    
    // Create directory for receipts if it doesn't exist
    const receiptDir = path.join(__dirname, '..', 'public', 'receipts');
    if (!fs.existsSync(receiptDir)) {
      fs.mkdirSync(receiptDir, { recursive: true });
    }
    
    // Create PDF filename
    const filename = `receipt_${receipt.receiptNumber.replace(/\//g, '-')}.pdf`;
    const filepath = path.join(receiptDir, filename);
    
    // Create a PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Pipe the PDF into a file
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);
    
    // Add content to the PDF
    
    // Header
    doc.fontSize(20).text('TASSIAC CHURCH', { align: 'center' });
    doc.fontSize(14).text('Official Receipt', { align: 'center' });
    doc.moveDown();
    
    // Receipt details
    doc.fontSize(12).text(`Receipt Number: ${receipt.receiptNumber}`);
    doc.text(`Date: ${new Date(receipt.receiptDate).toLocaleDateString()}`);
    doc.moveDown();
    
    // User details
    doc.text(`Name: ${receipt.User.fullName}`);
    doc.text(`Phone: ${receipt.User.phone}`);
    if (receipt.User.email) {
      doc.text(`Email: ${receipt.User.email}`);
    }
    doc.moveDown();
    
    // Payment details
    doc.text(`Payment Type: ${receipt.Payment.paymentType}`);
    doc.text(`Payment Method: ${receipt.Payment.paymentMethod}`);
    doc.text(`Amount: ${receipt.Payment.amount}`);
    if (receipt.Payment.description) {
      doc.text(`Description: ${receipt.Payment.description}`);
    }
    doc.text(`Payment Date: ${new Date(receipt.Payment.paymentDate).toLocaleDateString()}`);
    doc.moveDown();
    
    // Additional receipt data if available
    if (receipt.receiptData && receipt.receiptData.transactionDetails) {
      doc.text('Transaction Details:');
      const txDetails = receipt.receiptData.transactionDetails;
      Object.keys(txDetails).forEach(key => {
        if (txDetails[key]) {
          const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          doc.text(`${formattedKey}: ${txDetails[key]}`);
        }
      });
      doc.moveDown();
    }
    
    // Footer
    doc.fontSize(10).text('Thank you for your contribution to TASSIAC Church.', { align: 'center' });
    doc.text('This is an official receipt. Please keep it for your records.', { align: 'center' });
    
    // Add signature line
    doc.moveDown(3);
    doc.lineCap('butt')
      .moveTo(50, doc.y)
      .lineTo(200, doc.y)
      .stroke();
    doc.text('Authorized Signature', 75, doc.y + 5);
    
    // Finalize the PDF
    doc.end();
    
    // Wait for the stream to finish
    stream.on('finish', () => {
      // Update the receipt with the PDF path
      receipt.update({ pdfPath: `/receipts/${filename}` });
      
      // Send the file
      res.download(filepath, filename, err => {
        if (err) {
          console.error('Error sending file:', err);
          res.status(500).json({ message: 'Error sending receipt' });
        }
      });
    });
  } catch (error) {
    console.error('Generate PDF receipt error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
exports.uploadReceiptAttachment = async (req, res) => {
  try {
    const { receiptId } = req.params;
    
    // Find receipt
    const receipt = await Receipt.findByPk(receiptId);
    if (!receipt) {
      return res.status(404).json({ message: 'Receipt not found' });
    }
    
    // Check if the user is authorized
    if (!req.user.isAdmin && receipt.userId !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to update this receipt' });
    }
    
    // Handle file upload (in route definition)
    const uploadSingle = upload.single('attachment');
    
    uploadSingle(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Update receipt with attachment information
      const attachmentPath = `/uploads/receipts/${req.file.filename}`;
      await receipt.update({
        attachmentPath,
        attachmentType: req.file.mimetype
      });
      
      res.json({
        success: true,
        message: 'Attachment uploaded successfully',
        attachmentPath
      });
    });
  } catch (error) {
    console.error('Upload receipt attachment error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};
module.exports = {
  getAllReceipts,
  getUserReceipts,
  getReceiptById,
  generatePdfReceipt
};