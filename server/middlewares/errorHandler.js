// server/middlewares/errorHandler.js
const { ValidationError } = require('sequelize');

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // Check if error is a Sequelize validation error
  if (err instanceof ValidationError) {
    return res.status(400).json({
      message: 'Validation error',
      errors: err.errors.map(e => ({
        field: e.path,
        message: e.message
      }))
    });
  }
  
  // JWT authentication error
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Authentication failed',
      error: 'Invalid or expired token'
    });
  }
  
  // Handle multer errors
  if (err.name === 'MulterError') {
    let message = 'File upload error';
    
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File is too large';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected field';
        break;
      default:
        message = err.message;
    }
    
    return res.status(400).json({
      message,
      error: 'File upload failed'
    });
  }
  
  // Default to 500 server error
  const statusCode = err.statusCode || 500;
  const errorMessage = err.message || 'Something went wrong';
  
  res.status(statusCode).json({
    message: errorMessage,
    // Only show detailed error info in development
    error: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
};

module.exports = errorHandler;