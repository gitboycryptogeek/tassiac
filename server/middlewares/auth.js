// server/middlewares/auth.js
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client'); // Import PrismaClient
const prisma = new PrismaClient(); // Instantiate PrismaClient

// Middleware to authenticate JWT token
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key-for-tassiac-app', (err, user) => { // Corrected default secret key
    if (err) {
      // Log the error for debugging, but send a generic message to client
      console.error('JWT verification error:', err.message);
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

    // The JWT token should contain the isAdmin status.
    // The `isAdmin` property in the JWT payload is set during login from the database.
    // Prisma schema defines `isAdmin` as Boolean.
    if (req.user.isAdmin === true) {
      return next(); 
    }

    // Optional: Fallback to DB check if you want to ensure the most current status,
    // or if token might not always have `isAdmin`.
    // If the token is considered the single source of truth for the duration of its validity,
    // this DB check can be omitted. For security/consistency, verifying against DB can be good.
    // console.log(`Admin middleware: isAdmin flag in token is '${req.user.isAdmin}'. Re-checking DB for user ${req.user.id}.`);
    const userFromDb = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isAdmin: true, isActive: true }
    });
    
    // If user not found in DB or not active, or not admin in DB, deny access.
    if (!userFromDb || !userFromDb.isActive || userFromDb.isAdmin !== true) {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    // If DB check passes and token might have been out of sync (e.g., role change not reflected in an old token),
    // you could update req.user.isAdmin here if needed for subsequent middleware in the same request chain.
    // However, for this middleware's purpose, just granting access is sufficient.
    req.user.isAdmin = true; // Ensure req.user reflects the definitive admin status for this request
    next();
  } catch (error) {
    console.error('Error in isAdmin middleware:', error);
    res.status(500).json({ message: 'Server error during admin authorization check', error: error.message });
  }
};

// Middleware to check if the user is accessing their own data
const isOwnResource = (req, res, next) => {
  // Get resource's user ID from params (e.g., /users/:userId/profile) or body.
  // Ensure it's an integer.
  let resourceUserId;
  if (req.params.userId) {
    resourceUserId = parseInt(req.params.userId);
  } else if (req.body.userId) {
    resourceUserId = parseInt(req.body.userId);
  }
  // If checking a resource that directly belongs to the logged-in user without a :userId param,
  // the controller logic usually handles this by using req.user.id directly.

  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Admins can access any resource
  // Check req.user.isAdmin which should be correctly set by `isAdmin` middleware if it runs before,
  // or directly from the token if `isAdmin` middleware hasn't run yet for this route.
  if (req.user.isAdmin === true) {
    return next();
  }

  // If a resourceUserId is identified from the request, check ownership.
  if (resourceUserId && !isNaN(resourceUserId)) {
    if (req.user.id !== resourceUserId) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource.' });
    }
  }
  // If no specific resourceUserId is part of the request (e.g., GET /api/auth/profile),
  // this middleware implicitly allows it as the controller will use req.user.id.
  // For routes like GET /api/payment/user (without :userId), the controller itself uses req.user.id.

  next();
};

module.exports = {
  authenticateJWT,
  isAdmin,
  isOwnResource
};