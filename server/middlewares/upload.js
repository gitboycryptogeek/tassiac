const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');


// Ensure upload directories exist
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Storage configuration for withdrawal receipts
const withdrawalReceiptStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'withdrawal-receipts');
    ensureDirectoryExists(uploadDir);
    cb(null, uploadDir);
  },
 
filename: (req, file, cb) => {
  const uuid = crypto.randomUUID();
  const safeExtension = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
  
  if (!allowedExtensions.includes(safeExtension)) {
    return cb(new Error('Invalid file type'), null);
  }
  
  const safeName = `attachment-${uuid}${safeExtension}`;
  cb(null, safeName);
}
});

// File filter for security
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'), false);
  }
};

// Configure multer
const uploadWithdrawalReceipt = multer({
  storage: withdrawalReceiptStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only one file at a time
  },
  fileFilter: fileFilter
});

module.exports = {
  uploadWithdrawalReceipt: uploadWithdrawalReceipt.single('withdrawalReceipt')
};