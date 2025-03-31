// server/utils/validationSchemas.js
const { body } = require('express-validator');

// User validation schemas
const userValidationRules = {
  register: [
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
      .withMessage('Password must contain at least one number')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter'),
    
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
  
  login: [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  
  changePassword: [
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
      .custom((value, { req }) => {
        if (value === req.body.currentPassword) {
          throw new Error('New password must be different from the current password');
        }
        return true;
      })
  ]
};

// Payment validation schemas
const paymentValidationRules = {
  initiatePayment: [
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be a positive number'),
    
    body('paymentType')
      .isIn(['TITHE', 'OFFERING', 'DONATION', 'OTHER'])
      .withMessage('Invalid payment type'),
    
    body('description')
      .optional()
      .isString()
      .withMessage('Description must be a string'),
    
    body('titheDistribution')
      .optional()
      .isObject()
      .withMessage('Tithe distribution must be an object')
  ],
  
  manualPayment: [
    body('userId')
      .isInt()
      .withMessage('Valid user ID is required'),
    
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be a positive number'),
    
    body('paymentType')
      .custom(value => {
        const standardTypes = ['TITHE', 'OFFERING', 'DONATION', 'EXPENSE', 'OTHER'];
        return standardTypes.includes(value) || value.startsWith('SPECIAL_') || value === 'SPECIAL';
      })
      .withMessage('Invalid payment type'),
    
    body('description')
      .optional()
      .isString()
      .withMessage('Description must be a string'),
    
    body('isExpense')
      .optional()
      .isBoolean()
      .withMessage('isExpense must be a boolean'),
    
    body('department')
      .optional()
      .isString()
      .withMessage('Department must be a string'),
    
    body('paymentDate')
      .optional()
      .isISO8601()
      .withMessage('Valid date is required'),
    
    body('titheDistribution')
      .optional()
      .isObject()
      .withMessage('Tithe distribution must be an object'),
    
    body('isPromoted')
      .optional()
      .isBoolean()
      .withMessage('isPromoted must be a boolean'),
    
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('Valid end date is required'),
    
    body('customFields')
      .optional(),
    
    body('targetGoal')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Target goal must be a positive number')
  ]
};

// Contact form validation
const contactValidationRules = [
  body('name')
    .notEmpty()
    .withMessage('Name is required'),
  
  body('email')
    .isEmail()
    .withMessage('Valid email is required'),
  
  body('subject')
    .notEmpty()
    .withMessage('Subject is required'),
  
  body('message')
    .notEmpty()
    .withMessage('Message is required'),
  
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number is required')
];

module.exports = {
  userValidationRules,
  paymentValidationRules,
  contactValidationRules
};