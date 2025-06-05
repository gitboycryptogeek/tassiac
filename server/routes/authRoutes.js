// server/routes/authRoutes.js
const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticateJWT, isAdmin, isOwnResource } = require('../middlewares/auth');

const router = express.Router();

// Login route with validation
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], authController.login);

// Register user route (admin only) with enhanced validation
router.post(
  '/register', 
  authenticateJWT, 
  isAdmin, 
  [
    body('username')
      .trim()
      .isLength({ min: 3 })
      .withMessage('Username must be at least 3 characters')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Username can only contain letters, numbers, underscores and hyphens'),
    
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/\d/)
      .withMessage('New password must contain at least one number')
      .matches(/[A-Z]/)
      .withMessage('New password must contain at least one uppercase letter'),
    
    body('fullName')
      .trim()
      .notEmpty()
      .withMessage('Full name is required'),
    
    body('phone')
      .notEmpty()
      .withMessage('Phone number is required')
      .isMobilePhone()
      .withMessage('Invalid phone number format'),
    
    body('email')
      .optional({ nullable: true, checkFalsy: true })
      .isEmail()
      .withMessage('Valid email is required'),
    
    body('isAdmin')
      .optional()
      .isBoolean()
      .withMessage('isAdmin must be a boolean')
  ],
  authController.registerUser
);

// Change password route with validation
router.post(
  '/change-password',
  authenticateJWT,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/\d/)
      .withMessage('New password must contain at least one number')
      .matches(/[A-Z]/)
      .withMessage('New password must contain at least one uppercase letter')
      .not()
      .equals(body('currentPassword'))
      .withMessage('New password must be different from the current password')
  ],
  authController.changePassword
);

// Get user profile
router.get('/profile', authenticateJWT, authController.getProfile);

// Get all users (admin only)
router.get('/users', authenticateJWT, isAdmin, authController.getUsers);

// Update user route (admin only)
router.put(
  '/users/:userId',
  authenticateJWT,
  isAdmin,
  [
    body('fullName')
      .trim()
      .notEmpty()
      .withMessage('Full name is required'),
    
    body('phone')
      .notEmpty()
      .withMessage('Phone number is required')
      .isMobilePhone()
      .withMessage('Invalid phone number format'),
    
    body('email')
      .optional({ nullable: true, checkFalsy: true })
      .isEmail()
      .withMessage('Valid email is required'),
    
    body('isAdmin')
      .optional()
      .isBoolean()
      .withMessage('isAdmin must be a boolean')
  ],
  authController.updateUser
);

// Delete user route (admin only)
router.delete(
  '/users/:userId',
  authenticateJWT,
  isAdmin,
  authController.deleteUser
);

router.get('/logout', authController.logout); // Or POST if you prefer

// Reset user password (with old and new password)
router.post(
  '/reset-password/:userId',
  authenticateJWT,
  isAdmin,
  [
  
    
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/\d/)
      .withMessage('New password must contain at least one number')
      .matches(/[A-Z]/)
      .withMessage('New password must contain at least one uppercase letter')
  ],
  authController.resetUserPassword
);

// Note: The following routes have been commented out because the controller functions
// don't exist in your current setup. You can implement them later if needed.

/* 
// Request password reset (for forgotten passwords)
router.post(
  '/request-reset',
  [
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
  ],
  authController.requestPasswordReset
);

// Complete password reset with token
router.post(
  '/reset-password',
  [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/\d/)
      .withMessage('New password must contain at least one number')
      .matches(/[A-Z]/)
      .withMessage('New password must contain at least one uppercase letter')
  ],
  authController.completePasswordReset
);
*/

module.exports = router;