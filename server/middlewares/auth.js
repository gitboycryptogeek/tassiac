// server/middlewares/auth.js
const jwt = require('jsonwebtoken');
const sequelize = require('../config/database');

// Middleware to authenticate JWT token
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  });
};

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // First check if admin status is in JWT claims
    // Handle different possible formats for isAdmin (boolean true, number 1, or string '1')
    if (req.user.isAdmin === true || req.user.isAdmin === 1 || req.user.isAdmin === '1') {
      return next(); // Allow access if token claims user is admin
    }

    // If not in token, check the database as a fallback
    const result = await sequelize.query(
      `SELECT isAdmin FROM Users WHERE id = ?`,
      {
        replacements: [req.user.id],
        type: sequelize.QueryTypes.SELECT
      }
    );
    
    // Make sure we have results and handle different result formats
    if (!result || !result.length) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const user = result[0]; // Get the first row
    
    // Handle various ways isAdmin could be stored in SQLite (1, true, '1', etc.)
    if (!user || (user.isAdmin !== true && user.isAdmin !== 1 && user.isAdmin !== '1')) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Error in admin middleware:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Middleware to check if the user is accessing their own data
const isOwnResource = (req, res, next) => {
  const resourceUserId = parseInt(req.params.userId || req.body.userId);
  
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Allow admins to access any resource
  if (req.user.isAdmin === true || req.user.isAdmin === 1 || req.user.isAdmin === '1') {
    return next();
  }

  // Check if the user is accessing their own resource
  if (req.user.id !== resourceUserId) {
    return res.status(403).json({ message: 'You can only access your own data' });
  }

  next();
};

module.exports = {
  authenticateJWT,
  isAdmin,
  isOwnResource
};