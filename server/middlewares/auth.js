// server/middlewares/auth.js
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Validate required environment variables on startup
const requiredSecrets = {
  JWT_SECRET: process.env.JWT_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET
};

// Fail fast if critical secrets are missing
Object.entries(requiredSecrets).forEach(([key, value]) => {
  if (!value) {
    console.error(`❌ CRITICAL: Environment variable ${key} is required but not set`);
    process.exit(1);
  }
  if (value.includes('default') || value.includes('fallback') || value.length < 32) {
    console.error(`❌ CRITICAL: Environment variable ${key} appears to be using a weak/default value`);
    process.exit(1);
  }
});

console.log('✅ Authentication middleware: Environment variables validated');

/**
 * Centralized view-only admin configuration
 * Should be moved to database or environment variable in production
 */
const getViewOnlyAdmins = () => {
  const viewOnlyList = process.env.VIEW_ONLY_ADMIN_USERNAMES || '';
  return viewOnlyList.split(',').filter(username => username.trim().length > 0);
};

/**
 * Check if user is a view-only admin
 * @param {Object} user - User object with username and isAdmin properties
 * @returns {boolean} True if user is view-only admin
 */
const isViewOnlyAdmin = (user) => {
  if (!user || !user.isAdmin) return false;
  const viewOnlyUsernames = getViewOnlyAdmins();
  return viewOnlyUsernames.includes(user.username);
};

/**
 * Middleware to authenticate JWT token
 * Validates token and attaches user information to request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ 
        success: false,
        message: 'Authorization header missing',
        error: { code: 'MISSING_AUTH_HEADER' }
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Bearer token missing',
        error: { code: 'MISSING_TOKEN' }
      });
    }

    // Verify JWT token (no fallback secret - fail if env var missing)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists and is active in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { 
        id: true, 
        username: true, 
        fullName: true, 
        email: true, 
        phone: true,
        isAdmin: true, 
        isActive: true,
        role: true,
        lastLogin: true 
      }
    });

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'User not found',
        error: { code: 'USER_NOT_FOUND' }
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        success: false,
        message: 'Account has been deactivated',
        error: { code: 'ACCOUNT_INACTIVE' }
      });
    }

    // Attach user information to request
    req.user = user;
    
    // Log authentication for audit trail (non-blocking)
    setImmediate(async () => {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() }
        });
      } catch (error) {
        console.error('Failed to update last login:', error.message);
      }
    });

    next();
  } catch (error) {
    console.error('JWT authentication error:', error.message);
    
    let errorResponse = {
      success: false,
      message: 'Authentication failed',
      error: { code: 'AUTH_FAILED' }
    };

    if (error.name === 'JsonWebTokenError') {
      errorResponse.message = 'Invalid token';
      errorResponse.error.code = 'INVALID_TOKEN';
    } else if (error.name === 'TokenExpiredError') {
      errorResponse.message = 'Token has expired';
      errorResponse.error.code = 'TOKEN_EXPIRED';
    }

    return res.status(401).json(errorResponse);
  }
};

/**
 * Middleware to check if user has admin privileges
 * Must be used after authenticateJWT middleware
 * 
 * @param {Object} req - Express request object (must have req.user)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const isAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required',
        error: { code: 'UNAUTHENTICATED' }
      });
    }

    // Check admin status from the authenticated user data
    if (req.user.isAdmin !== true) {
      return res.status(403).json({ 
        success: false,
        message: 'Admin access required',
        error: { code: 'INSUFFICIENT_PRIVILEGES' }
      });
    }

    // Double-check admin status in database for security
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isAdmin: true, isActive: true }
    });

    if (!currentUser || !currentUser.isActive || !currentUser.isAdmin) {
      return res.status(403).json({ 
        success: false,
        message: 'Admin access denied',
        error: { code: 'ADMIN_ACCESS_DENIED' }
      });
    }

    // Attach view-only status for downstream middleware
    req.user.isViewOnlyAdmin = isViewOnlyAdmin(req.user);

    next();
  } catch (error) {
    console.error('Admin authorization error:', error.message);
    return res.status(500).json({ 
      success: false,
      message: 'Server error during authorization check',
      error: { 
        code: 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'production' ? undefined : error.message
      }
    });
  }
};

/**
 * Middleware to check if user can access specific resource
 * Allows admin access to any resource, restricts regular users to their own resources
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const isOwnResource = (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required',
        error: { code: 'UNAUTHENTICATED' }
      });
    }

    // Admins can access any resource
    if (req.user.isAdmin === true) {
      return next();
    }

    // Extract resource user ID from request
    let resourceUserId;
    if (req.params.userId) {
      resourceUserId = parseInt(req.params.userId);
    } else if (req.body.userId) {
      resourceUserId = parseInt(req.body.userId);
    }

    // If no specific resource user ID, allow (controller will use req.user.id)
    if (!resourceUserId || isNaN(resourceUserId)) {
      return next();
    }

    // Check if user is accessing their own resource
    if (req.user.id !== resourceUserId) {
      return res.status(403).json({ 
        success: false,
        message: 'Forbidden: You can only access your own resources',
        error: { code: 'RESOURCE_ACCESS_DENIED' }
      });
    }

    next();
  } catch (error) {
    console.error('Resource access check error:', error.message);
    return res.status(500).json({ 
      success: false,
      message: 'Server error during resource access check',
      error: { 
        code: 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'production' ? undefined : error.message
      }
    });
  }
};

/**
 * Middleware to check if admin has write permissions (not view-only)
 * Use this for operations that modify data
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const requireWriteAccess = (req, res, next) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false,
        message: 'Admin access required',
        error: { code: 'ADMIN_ACCESS_REQUIRED' }
      });
    }

    if (isViewOnlyAdmin(req.user)) {
      return res.status(403).json({ 
        success: false,
        message: 'Write access denied: View-only admin',
        error: { code: 'VIEW_ONLY_ADMIN' }
      });
    }

    next();
  } catch (error) {
    console.error('Write access check error:', error.message);
    return res.status(500).json({ 
      success: false,
      message: 'Server error during write access check',
      error: { 
        code: 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'production' ? undefined : error.message
      }
    });
  }
};

/**
 * Generate secure JWT token for user
 * 
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
const generateToken = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { 
    expiresIn: '8h',
    issuer: 'tassiac-church-system',
    audience: 'tassiac-users'
  });
};

/**
 * Verify and decode JWT token without middleware overhead
 * 
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
};

module.exports = {
  authenticateJWT,
  isAdmin,
  isOwnResource,
  requireWriteAccess,
  isViewOnlyAdmin,
  generateToken,
  verifyToken
};